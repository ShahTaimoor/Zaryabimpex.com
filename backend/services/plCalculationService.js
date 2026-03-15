const FinancialStatementRepository = require('../repositories/FinancialStatementRepository');
const FinancialStatement = require('../models/FinancialStatement');
const SalesRepository = require('../repositories/SalesRepository');
const ProductRepository = require('../repositories/ProductRepository');
const PurchaseOrderRepository = require('../repositories/PurchaseOrderRepository');
const PurchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');
const ReturnRepository = require('../repositories/ReturnRepository');
const TransactionRepository = require('../repositories/TransactionRepository');
const ChartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const AccountingService = require('./accountingService');
const financialValidationService = require('./financialValidationService');
const expenseAccountMapping = require('../config/expenseAccountMapping');
const expenseCategorizationService = require('./expenseCategorizationService');
const budgetComparisonService = require('./budgetComparisonService');
const taxCalculationService = require('./taxCalculationService');
const mongoose = require('mongoose');

class PLCalculationService {
  constructor() {
    this.expenseCategories = {
      selling: [
        'advertising', 'marketing', 'sales_commissions', 'sales_salaries',
        'travel_entertainment', 'promotional', 'customer_service'
      ],
      administrative: [
        'office_supplies', 'rent', 'utilities', 'insurance', 'legal',
        'accounting', 'management_salaries', 'training', 'software',
        'equipment', 'maintenance', 'professional_services'
      ]
    };
  }

  // Generate comprehensive P&L statement
  async generatePLStatement(period, options = {}) {
    const {
      companyInfo = {},
      includeDetails = true,
      calculateComparisons = true,
      userId = null
    } = options;

    const startTime = Date.now();

    try {
      // Block if any transaction group is unbalanced (double-entry integrity)
      const ledgerValidation = await financialValidationService.validateLedgerDoubleEntry(period.endDate);
      if (!ledgerValidation.valid) {
        const msg = ledgerValidation.message || 'Unbalanced ledger entries detected.';
        throw new Error(`${msg} Unbalanced groups: ${JSON.stringify(ledgerValidation.unbalancedGroups)}`);
      }

      // Calculate all financial data from General Ledger only (no cached balances)
      const financialData = await this.calculateFinancialData(period);

      // Create P&L statement (using model for instance methods)
      const plStatement = new FinancialStatement({
        type: 'profit_loss',
        period: {
          startDate: period.startDate,
          endDate: period.endDate,
          type: period.type || 'monthly',
        },
        company: companyInfo,
        generatedBy: userId,
        status: 'draft',
        metadata: {
          calculationMethod: 'automated',
          currency: 'USD',
          dataSource: 'database',
          generationTime: 0,
        },
      });

      // Populate all financial data
      await this.populateRevenueData(plStatement, financialData, includeDetails);
      await this.populateCOGSData(plStatement, financialData, includeDetails);
      await this.populateExpenseData(plStatement, financialData, includeDetails);
      await this.populateOtherData(plStatement, financialData, includeDetails);

      // Calculate all derived values
      plStatement.calculateDerivedValues();

      // Add comparisons if requested
      if (calculateComparisons) {
        await this.addComparisons(plStatement);
      }

      // Calculate generation time
      plStatement.metadata.generationTime = Date.now() - startTime;

      // Save the statement
      await plStatement.save();

      return plStatement;
    } catch (error) {
      console.error('Error generating P&L statement:', error);
      throw error;
    }
  }

  // Calculate all financial data from database
  async calculateFinancialData(period) {
    const data = {
      revenue: await this.calculateRevenue(period),
      cogs: await this.calculateCOGS(period),
      expenses: await this.calculateExpenses(period),
      otherIncome: await this.calculateOtherIncome(period),
      otherExpenses: await this.calculateOtherExpenses(period),
    };

    // Calculate earnings before tax first (needed for income tax calculation)
    const grossProfit = data.revenue.grossSales - data.revenue.salesReturns -
      data.revenue.salesDiscounts - data.cogs.totalCOGS;
    const operatingIncome = grossProfit -
      (Object.values(data.expenses.selling).reduce((sum, val) => sum + val, 0) +
        Object.values(data.expenses.administrative).reduce((sum, val) => sum + val, 0));
    const earningsBeforeTax = operatingIncome +
      (data.otherIncome.interestIncome + data.otherIncome.rentalIncome + data.otherIncome.other) -
      (data.otherExpenses.interestExpense + data.otherExpenses.depreciation +
        data.otherExpenses.amortization + data.otherExpenses.other);

    // Calculate taxes with earnings before tax
    data.taxes = await this.calculateTaxes(period, earningsBeforeTax);

    return data;
  }

  // Get account codes dynamically
  async getAccountCodes() {
    if (!this._accountCodes) {
      this._accountCodes = await AccountingService.getDefaultAccountCodes();
    }
    return this._accountCodes;
  }

  // Calculate revenue data from the General Ledger only (no cached balances).
  // Account type: Revenue increases with Credit. Revenue balance = Credit - Debit.
  async calculateRevenue(period) {
    try {
      const accountCodes = await this.getAccountCodes();
      const salesRevenueCode = accountCodes.salesRevenue;

      if (!salesRevenueCode) {
        console.warn('[P&L] Sales Revenue account code not found');
        return this.calculateRevenueFallback(period);
      }

      const summary = await AccountingService.getPeriodSummary(
        salesRevenueCode,
        period.startDate,
        period.endDate
      );

      // Revenue is credit-normal: net period change = Credits - Debits (positive = revenue)
      const totalCredit = summary.totalCredit || 0;
      const totalDebit = summary.totalDebit || 0;

      return {
        grossSales: totalCredit,
        salesReturns: totalDebit,
        salesDiscounts: 0,
        salesByCategory: { 'Ledger Revenue': totalCredit },
        returnsByCategory: { 'Ledger Returns': totalDebit },
        discountsByType: {},
        discountDetails: [],
      };
    } catch (error) {
      console.error('Error calculating revenue from ledger:', error);
      return this.calculateRevenueFallback(period);
    }
  }

  /**
   * Fallback for revenue calculation (deprecated)
   */
  async calculateRevenueFallback(period) {
    // Original implementation...
    const accountCodes = await this.getAccountCodes();
    const salesRevenueCode = accountCodes.salesRevenue;

    const revenueTransactions = await TransactionRepository.findAll({
      accountCode: salesRevenueCode,
      createdAt: { $gte: period.startDate, $lte: period.endDate },
      status: 'completed'
    });

    let grossSales = 0;
    let salesReturns = 0;

    revenueTransactions.forEach(transaction => {
      if (transaction.creditAmount > 0) {
        grossSales += transaction.creditAmount;
      }
      if (transaction.debitAmount > 0) {
        salesReturns += transaction.debitAmount;
      }
    });

    return {
      grossSales,
      salesReturns,
      salesDiscounts: 0,
      salesByCategory: { 'Estimated': grossSales },
      returnsByCategory: { 'Estimated': salesReturns },
      discountsByType: {},
      discountDetails: []
    };
  }

  // Helper method to categorize revenue
  categorizeRevenue(description) {
    if (description.toLowerCase().includes('sale')) return 'Sales';
    if (description.toLowerCase().includes('service')) return 'Services';
    if (description.toLowerCase().includes('rental')) return 'Rental Income';
    if (description.toLowerCase().includes('interest')) return 'Interest Income';
    return 'Other Revenue';
  }

  // Helper method to categorize discount type
  categorizeDiscountType(discountType, discountCode) {
    if (!discountType) return 'other';

    const type = discountType.toLowerCase();
    const code = (discountCode || '').toLowerCase();

    // Check discount type
    if (type.includes('bulk') || code.includes('bulk')) return 'bulk';
    if (type.includes('loyalty') || code.includes('loyalty') || code.includes('reward')) return 'loyalty';
    if (type.includes('promotional') || type.includes('promo') || code.includes('promo')) return 'promotional';
    if (type.includes('customer') || code.includes('customer') || code.includes('cust')) return 'customer';
    if (type.includes('seasonal') || code.includes('seasonal')) return 'seasonal';
    if (type.includes('clearance') || code.includes('clearance')) return 'clearance';
    if (type.includes('first') || code.includes('first') || code.includes('new')) return 'first_time';

    return 'other';
  }

  // Calculate Cost of Goods Sold from the ledger
  async calculateCOGS(period) {
    try {
      // Get COGS account code dynamically
      const accountCodes = await this.getAccountCodes();
      const cogsCode = accountCodes.costOfGoodsSold;

      if (!cogsCode) {
        console.warn('[P&L] COGS account code not found');
        return this.calculateCOGSFallback(period);
      }

      // Expense (COGS): net period change = Debits - Credits (source: General Ledger only)
      const summary = await AccountingService.getPeriodSummary(
        cogsCode,
        period.startDate,
        period.endDate
      );
      const totalCOGSPeriod = (summary.totalDebit || 0) - (summary.totalCredit || 0);

      const beginningInventory = await this.getInventoryValue(period.startDate);
      const endingInventory = await this.getInventoryValue(period.endDate);

      return {
        beginningInventory,
        endingInventory,
        purchases: 0,
        totalCOGS: totalCOGSPeriod, // Expense = Debit - Credit
        cogsDetails: [{
          description: 'Ledger COGS',
          amount: totalCOGSPeriod,
          date: period.endDate
        }]
      };
    } catch (error) {
      console.error('Error calculating COGS from ledger:', error);
      return this.calculateCOGSFallback(period);
    }
  }

  /**
   * Fallback for COGS calculation (deprecated)
   */
  async calculateCOGSFallback(period) {
    // Original implementation logic...
    const accountCodes = await this.getAccountCodes();
    const cogsCode = accountCodes.costOfGoodsSold;

    const cogsTransactions = await TransactionRepository.findAll({
      accountCode: cogsCode,
      createdAt: { $gte: period.startDate, $lte: period.endDate },
      status: 'completed'
    });

    let totalCOGS = 0;
    cogsTransactions.forEach(t => {
      totalCOGS += (t.debitAmount || 0) - (t.creditAmount || 0);
    });

    return {
      beginningInventory: 0,
      endingInventory: 0,
      purchases: 0,
      totalCOGS,
      cogsDetails: []
    };
  }

  /**
   * Calculate inventory value at a specific date from the ledger
   * @param {Date} date - Date to calculate value for
   * @returns {Promise<Number>} Total inventory value
   */
  async getInventoryValue(date) {
    try {
      const accountCodes = await this.getAccountCodes();
      const inventoryAccountCode = accountCodes.inventory;

      if (!inventoryAccountCode) {
        console.warn('[P&L] Inventory account code not found, falling back to product-based calculation');
        return this.getInventoryValueFallback(date);
      }

      // Fetch dynamic balance from ledger
      return await AccountingService.getAccountBalance(inventoryAccountCode, date);
    } catch (error) {
      console.error('Error calculating inventory value from ledger:', error);
      return this.getInventoryValueFallback(date);
    }
  }

  /**
   * Fallback for inventory value calculation (deprecated)
   */
  async getInventoryValueFallback(date) {
    const products = await ProductRepository.findAll({ status: 'active' });
    let totalValue = 0;

    for (const product of products) {
      const stockValue = (product.inventory?.currentStock || 0) * (product.pricing?.cost || 0);
      totalValue += stockValue;
    }

    return totalValue;
  }

  // Calculate purchases during period from the ledger
  async calculatePurchases(period) {
    try {
      const accountCodes = await this.getAccountCodes();
      const inventoryCode = accountCodes.inventory;

      if (!inventoryCode) {
        console.warn('[P&L] Inventory account code not found for purchase calculation');
        return { total: 0, details: [], freightIn: 0 };
      }

      // Purchases are typically debits to Inventory (in a perpetual system)
      // that are NOT related to returns or direct adjustments
      const purchaseTransactions = await TransactionRepository.findAll({
        accountCode: inventoryCode,
        createdAt: { $gte: period.startDate, $lte: period.endDate },
        status: 'completed',
        debitAmount: { $gt: 0 }
      });

      let totalPurchases = 0;
      let freightIn = 0;
      const purchaseDetails = [];

      purchaseTransactions.forEach(txn => {
        // Exclude internal adjustments if possible (by description or metadata)
        const desc = (txn.description || '').toLowerCase();
        if (desc.includes('return') || desc.includes('adjustment') || desc.includes('correction')) {
          return;
        }

        totalPurchases += txn.debitAmount;

        // If freight/shipping is tracked in metadata or separable, add it
        if (txn.metadata?.shippingCost) {
          freightIn += txn.metadata.shippingCost;
        }

        purchaseDetails.push({
          supplier: txn.metadata?.supplierName || 'Ledger Purchase',
          amount: txn.debitAmount,
          date: txn.createdAt,
        });
      });

      return {
        total: totalPurchases,
        details: purchaseDetails,
        freightIn,
      };
    } catch (error) {
      console.error('Error calculating purchases from ledger:', error);
      return { total: 0, details: [], freightIn: 0 };
    }
  }

  // Calculate purchase adjustments (returns and discounts) from the ledger
  async calculatePurchaseAdjustments(period) {
    try {
      const accountCodes = await this.getAccountCodes();
      const inventoryCode = accountCodes.inventory;

      if (!inventoryCode) {
        return { returns: 0, discounts: 0, returnDetails: [], discountDetails: [] };
      }

      // Purchase returns are typically credits to Inventory
      const adjustmentTransactions = await TransactionRepository.findAll({
        accountCode: inventoryCode,
        createdAt: { $gte: period.startDate, $lte: period.endDate },
        status: 'completed',
        creditAmount: { $gt: 0 }
      });

      let purchaseReturns = 0;
      let purchaseDiscounts = 0;
      const returnDetails = [];
      const discountDetails = [];

      adjustmentTransactions.forEach(txn => {
        const desc = (txn.description || '').toLowerCase();

        // Categorize based on description
        if (desc.includes('return')) {
          purchaseReturns += txn.creditAmount;
          returnDetails.push({
            returnNumber: txn.reference || 'Ledger Return',
            date: txn.createdAt,
            amount: txn.creditAmount,
            supplier: txn.metadata?.supplierName || 'Unknown',
          });
        } else if (desc.includes('discount')) {
          purchaseDiscounts += txn.creditAmount;
          discountDetails.push({
            invoiceNumber: txn.reference || 'Ledger Discount',
            date: txn.createdAt,
            amount: txn.creditAmount,
            supplier: txn.metadata?.supplierName || 'Unknown',
          });
        }
      });

      return {
        returns: purchaseReturns,
        discounts: purchaseDiscounts,
        returnDetails: returnDetails,
        discountDetails: discountDetails,
      };
    } catch (error) {
      console.error('Error calculating purchase adjustments from ledger:', error);
      return { returns: 0, discounts: 0, returnDetails: [], discountDetails: [] };
    }
  }

  // Calculate operating expenses from actual transactions
  async calculateExpenses(period) {
    // Get expense account codes dynamically
    const accountCodes = await this.getAccountCodes();

    // Get all expense accounts (include all expense categories, not just operating_expenses)
    // This ensures all expense transactions are included in P&L, regardless of category
    const expenseAccounts = await ChartOfAccountsRepository.findAll({
      accountType: 'expense',
      accountCategory: { $in: ['operating_expenses', 'other_expenses', 'cost_of_goods_sold'] },
      isActive: true,
      allowDirectPosting: true
    }, {
      select: 'accountCode accountName accountCategory'
    });

    // Also get any expense accounts that might not have the standard categories
    // This catches custom expense accounts that users create
    const allExpenseAccounts = await ChartOfAccountsRepository.findAll({
      accountType: 'expense',
      isActive: true,
      allowDirectPosting: true
    }, {
      select: 'accountCode accountName accountCategory'
    });

    // Combine and deduplicate by accountCode
    const accountMap = new Map();
    allExpenseAccounts.forEach(acc => {
      if (!accountMap.has(acc.accountCode)) {
        accountMap.set(acc.accountCode, acc);
      }
    });
    const allUniqueExpenseAccounts = Array.from(accountMap.values());

    // Get all expense transactions for the period
    const expenseAccountCodes = allUniqueExpenseAccounts.map(acc => acc.accountCode);

    // If no expense accounts found, try to get by category codes
    // Try to find common expense account codes
    const commonExpenseCodes = [accountCodes.otherExpenses].filter(Boolean);
    expenseAccountCodes.push(...commonExpenseCodes);

    // Query all expense transactions
    // Use createdAt for date filtering (Transaction model uses createdAt, not a separate date field)
    const expenseTransactions = await TransactionRepository.findAll({
      accountCode: { $in: expenseAccountCodes },
      createdAt: { $gte: period.startDate, $lte: period.endDate },
      status: 'completed',
      debitAmount: { $gt: 0 } // Expenses are debits
    }, {
      populate: [{ path: 'orderId', select: 'orderNumber' }]
    });

    // Debug logging to help diagnose missing expenses
    if (expenseAccountCodes.length > 0) {
      console.log(`[P&L] Querying expenses for ${expenseAccountCodes.length} account codes:`, expenseAccountCodes.slice(0, 10));
      console.log(`[P&L] Date range: ${period.startDate.toISOString()} to ${period.endDate.toISOString()}`);
      console.log(`[P&L] Found ${expenseTransactions.length} expense transactions`);
    }

    // Categorize expenses
    const sellingExpenses = {};
    const administrativeExpenses = {};

    // Store transaction details
    const sellingExpenseDetails = [];
    const administrativeExpenseDetails = [];

    // Map account codes to categories (use allUniqueExpenseAccounts instead of expenseAccounts)
    const accountCategoryMap = {};
    allUniqueExpenseAccounts.forEach(acc => {
      accountCategoryMap[acc.accountCode] = acc.accountName;
    });

    // Process each expense transaction
    expenseTransactions.forEach(transaction => {
      const accountCode = transaction.accountCode;
      const amount = transaction.debitAmount || 0;
      const accountName = accountCategoryMap[accountCode] || transaction.description || 'Unknown';

      // Create transaction detail object
      const transactionDetail = {
        transactionId: transaction.transactionId,
        date: transaction.createdAt,
        amount: amount,
        description: transaction.description || accountName,
        accountCode: accountCode,
        accountName: accountName,
        reference: transaction.reference || transaction.orderId?.orderNumber || '',
      };

      // Use enhanced categorization service
      const categorization = expenseCategorizationService.categorizeExpense({
        accountCode: accountCode,
        accountName: accountName,
        description: transaction.description || '',
        tags: transaction.metadata?.tags || [],
        metadata: transaction.metadata || {}
      });

      const expenseType = categorization.expenseType;
      const category = categorization.category;

      // Add confidence and factors to transaction detail for transparency
      transactionDetail.category = category;
      transactionDetail.categorizationConfidence = categorization.confidence;
      transactionDetail.categorizationReason = expenseCategorizationService.getReason(categorization.factors);

      if (expenseType === 'selling') {
        sellingExpenses[category] = (sellingExpenses[category] || 0) + amount;
        sellingExpenseDetails.push(transactionDetail);
      } else {
        // Default to administrative
        administrativeExpenses[category] = (administrativeExpenses[category] || 0) + amount;
        administrativeExpenseDetails.push(transactionDetail);
      }
    });

    // If no expenses found, return empty objects (not estimates)
    return {
      selling: sellingExpenses,
      administrative: administrativeExpenses,
      sellingDetails: sellingExpenseDetails,
      administrativeDetails: administrativeExpenseDetails,
    };
  }

  // Helper method to categorize selling expenses (uses configuration with fallback)
  categorizeSellingExpense(accountName, description) {
    // Try to get category from configuration first
    const nameBased = expenseAccountMapping.getExpenseTypeFromName(accountName);
    if (nameBased.expenseType === 'selling') {
      return nameBased.category;
    }

    // Fallback to description-based categorization
    const name = (accountName + ' ' + (description || '')).toLowerCase();
    if (name.includes('advertising') || name.includes('ad')) return 'advertising';
    if (name.includes('marketing')) return 'marketing';
    if (name.includes('commission')) return 'sales_commissions';
    if (name.includes('sales') && name.includes('salar')) return 'sales_salaries';
    if (name.includes('travel') || name.includes('entertainment')) return 'travel_entertainment';
    if (name.includes('promotional') || name.includes('promo')) return 'promotional';
    if (name.includes('customer') && name.includes('service')) return 'customer_service';
    return 'other_selling';
  }

  // Helper method to categorize administrative expenses (uses configuration with fallback)
  categorizeAdministrativeExpense(accountName, description) {
    // Try to get category from configuration first
    const nameBased = expenseAccountMapping.getExpenseTypeFromName(accountName);
    if (nameBased.expenseType === 'administrative') {
      return nameBased.category;
    }

    // Fallback to description-based categorization
    const name = (accountName + ' ' + (description || '')).toLowerCase();
    if (name.includes('office') && name.includes('suppl')) return 'office_supplies';
    if (name.includes('rent')) return 'rent';
    if (name.includes('utilit')) return 'utilities';
    if (name.includes('insurance')) return 'insurance';
    if (name.includes('legal')) return 'legal';
    if (name.includes('accounting')) return 'accounting';
    if (name.includes('management') && name.includes('salar')) return 'management_salaries';
    if (name.includes('training')) return 'training';
    if (name.includes('software') || name.includes('subscription')) return 'software';
    if (name.includes('equipment')) return 'equipment';
    if (name.includes('maintenance')) return 'maintenance';
    if (name.includes('professional') || name.includes('consulting')) return 'professional_services';
    return 'other_administrative';
  }

  // Calculate other income from actual transactions
  async calculateOtherIncome(period) {
    // Get account codes dynamically
    const accountCodes = await this.getAccountCodes();

    // Find other income accounts (revenue accounts that are not sales revenue)
    const otherIncomeAccounts = await ChartOfAccountsRepository.findAll({
      accountType: 'revenue',
      accountCategory: 'other_revenue',
      isActive: true,
      allowDirectPosting: true
    }, {
      select: 'accountCode accountName'
    });

    // Also find accounts by name patterns for interest and rental
    const interestAccounts = await ChartOfAccountsRepository.findAll({
      accountType: 'revenue',
      isActive: true,
      allowDirectPosting: true,
      $or: [
        { accountName: { $regex: /interest/i } }
      ]
    }, {
      select: 'accountCode accountName'
    });

    const rentalAccounts = await ChartOfAccountsRepository.findAll({
      accountType: 'revenue',
      isActive: true,
      allowDirectPosting: true,
      accountName: { $regex: /rental|rent/i }
    }, {
      select: 'accountCode accountName'
    });

    // Combine all other income account codes
    const allOtherIncomeCodes = [
      ...otherIncomeAccounts.map(acc => acc.accountCode),
      ...interestAccounts.map(acc => acc.accountCode),
      ...rentalAccounts.map(acc => acc.accountCode),
      accountCodes.otherRevenue // Fallback
    ].filter(Boolean);

    // Remove duplicates
    const uniqueOtherIncomeCodes = [...new Set(allOtherIncomeCodes)];

    // Query all other income transactions
    const otherIncomeTransactions = await TransactionRepository.findAll({
      accountCode: { $in: uniqueOtherIncomeCodes },
      createdAt: { $gte: period.startDate, $lte: period.endDate },
      status: 'completed',
      creditAmount: { $gt: 0 } // Income is credits
    });

    // Categorize income
    let interestIncome = 0;
    let rentalIncome = 0;
    let otherIncome = 0;

    // Create maps for quick lookup
    const interestAccountCodes = new Set(interestAccounts.map(acc => acc.accountCode));
    const rentalAccountCodes = new Set(rentalAccounts.map(acc => acc.accountCode));
    const otherRevenueAccountCodes = new Set(otherIncomeAccounts.map(acc => acc.accountCode));

    otherIncomeTransactions.forEach(transaction => {
      const accountCode = transaction.accountCode;
      const amount = transaction.creditAmount || 0;
      const description = (transaction.description || '').toLowerCase();

      // Categorize by account code or description
      if (interestAccountCodes.has(accountCode) || description.includes('interest')) {
        interestIncome += amount;
      } else if (rentalAccountCodes.has(accountCode) || description.includes('rental') || description.includes('rent')) {
        rentalIncome += amount;
      } else {
        // Other income (exclude sales revenue if it somehow got in)
        if (accountCode !== accountCodes.salesRevenue) {
          otherIncome += amount;
        }
      }
    });

    return {
      interestIncome,
      rentalIncome,
      other: otherIncome,
    };
  }

  // Calculate other expenses from actual transactions
  async calculateOtherExpenses(period) {
    // Get account codes dynamically
    const accountCodes = await this.getAccountCodes();

    // Find other expense accounts (expense accounts that are not operating expenses or COGS)
    const otherExpenseAccounts = await ChartOfAccountsRepository.findAll({
      accountType: 'expense',
      accountCategory: 'other_expenses',
      isActive: true,
      allowDirectPosting: true
    }, {
      select: 'accountCode accountName'
    });

    // Find accounts by name patterns for interest, depreciation, and amortization
    const interestExpenseAccounts = await ChartOfAccountsRepository.findAll({
      accountType: 'expense',
      isActive: true,
      allowDirectPosting: true,
      $or: [
        { accountName: { $regex: /interest/i } },
        { accountCode: { $regex: /^53/ } } // Common pattern for interest expense
      ]
    }, {
      select: 'accountCode accountName'
    });

    const depreciationAccounts = await ChartOfAccountsRepository.findAll({
      accountType: 'expense',
      isActive: true,
      allowDirectPosting: true,
      accountName: { $regex: /depreciation|depreciat/i }
    }, {
      select: 'accountCode accountName'
    });

    const amortizationAccounts = await ChartOfAccountsRepository.findAll({
      accountType: 'expense',
      isActive: true,
      allowDirectPosting: true,
      accountName: { $regex: /amortization|amortiz/i }
    }, {
      select: 'accountCode accountName'
    });

    // Combine all other expense account codes
    const allOtherExpenseCodes = [
      ...otherExpenseAccounts.map(acc => acc.accountCode),
      ...interestExpenseAccounts.map(acc => acc.accountCode),
      ...depreciationAccounts.map(acc => acc.accountCode),
      ...amortizationAccounts.map(acc => acc.accountCode),
      accountCodes.otherExpenses // Fallback
    ].filter(Boolean);

    // Remove duplicates
    const uniqueOtherExpenseCodes = [...new Set(allOtherExpenseCodes)];

    // Query all other expense transactions
    const otherExpenseTransactions = await TransactionRepository.findAll({
      accountCode: { $in: uniqueOtherExpenseCodes },
      createdAt: { $gte: period.startDate, $lte: period.endDate },
      status: 'completed',
      debitAmount: { $gt: 0 } // Expenses are debits
    });

    // Categorize expenses
    let interestExpense = 0;
    let depreciation = 0;
    let amortization = 0;
    let otherExpense = 0;

    // Create maps for quick lookup
    const interestExpenseAccountCodes = new Set(interestExpenseAccounts.map(acc => acc.accountCode));
    const depreciationAccountCodes = new Set(depreciationAccounts.map(acc => acc.accountCode));
    const amortizationAccountCodes = new Set(amortizationAccounts.map(acc => acc.accountCode));
    const otherExpenseAccountCodes = new Set(otherExpenseAccounts.map(acc => acc.accountCode));

    otherExpenseTransactions.forEach(transaction => {
      const accountCode = transaction.accountCode;
      const amount = transaction.debitAmount || 0;
      const description = (transaction.description || '').toLowerCase();

      // Categorize by account code or description
      if (interestExpenseAccountCodes.has(accountCode) || description.includes('interest')) {
        interestExpense += amount;
      } else if (depreciationAccountCodes.has(accountCode) || description.includes('depreciation') || description.includes('depreciat')) {
        depreciation += amount;
      } else if (amortizationAccountCodes.has(accountCode) || description.includes('amortization') || description.includes('amortiz')) {
        amortization += amount;
      } else {
        // Other expenses (exclude COGS and operating expenses if they somehow got in)
        if (accountCode !== accountCodes.costOfGoodsSold &&
          !accountCode.startsWith('52')) { // Operating expenses typically start with 52
          otherExpense += amount;
        }
      }
    });

    return {
      interestExpense,
      depreciation,
      amortization,
      other: otherExpense,
    };
  }

  // Calculate taxes
  async calculateTaxes(period, earningsBeforeTax = 0) {
    // Calculate all taxes using tax calculation service
    const taxData = await taxCalculationService.calculateAllTaxes(period, earningsBeforeTax);

    return {
      salesTax: taxData.salesTax.salesTax,
      incomeTax: taxData.incomeTax.total,
      current: taxData.incomeTax.current,
      deferred: taxData.incomeTax.deferred,
      totalTax: taxData.totalTax,
      salesTaxDetails: taxData.salesTax,
      incomeTaxDetails: taxData.incomeTax
    };
  }

  // Populate revenue data in P&L statement
  async populateRevenueData(statement, data, includeDetails) {
    statement.revenue.grossSales.amount = data.revenue.grossSales;
    statement.revenue.salesReturns.amount = data.revenue.salesReturns;
    statement.revenue.salesDiscounts.amount = data.revenue.salesDiscounts;
    statement.revenue.otherRevenue.amount = data.otherIncome.interestIncome +
      data.otherIncome.rentalIncome + data.otherIncome.other;

    if (includeDetails) {
      // Add sales by category details
      Object.entries(data.revenue.salesByCategory).forEach(([category, amount]) => {
        statement.revenue.grossSales.details.push({
          category,
          amount,
          description: `Sales in ${category} category`,
        });
      });

      // Add discount details by type
      Object.entries(data.revenue.discountsByType).forEach(([type, amount]) => {
        statement.revenue.salesDiscounts.details.push({
          type,
          amount,
          description: `${type} discounts`,
        });
      });

      // Add individual discount transaction details if available
      if (data.revenue.discountDetails && data.revenue.discountDetails.length > 0) {
        // Group discounts by type for better organization
        const discountsByTypeMap = {};
        data.revenue.discountDetails.forEach(detail => {
          if (!discountsByTypeMap[detail.type]) {
            discountsByTypeMap[detail.type] = [];
          }
          discountsByTypeMap[detail.type].push(detail);
        });

        // Add to existing discount details or create new entries
        Object.entries(discountsByTypeMap).forEach(([type, details]) => {
          const existingDetail = statement.revenue.salesDiscounts.details.find(d => d.type === type);
          if (existingDetail) {
            // Add transaction details as subcategories
            existingDetail.transactions = details.map(d => ({
              orderNumber: d.orderNumber,
              date: d.date,
              amount: d.amount,
              discountCode: d.discountCode,
            }));
          }
        });
      }
    }
  }

  // Populate COGS data in P&L statement
  async populateCOGSData(statement, data, includeDetails) {
    statement.costOfGoodsSold.beginningInventory = data.cogs.beginningInventory;
    statement.costOfGoodsSold.endingInventory = data.cogs.endingInventory;
    statement.costOfGoodsSold.purchases.amount = data.cogs.purchases;
    statement.costOfGoodsSold.freightIn = data.cogs.freightIn;
    statement.costOfGoodsSold.purchaseReturns = data.cogs.purchaseReturns;
    statement.costOfGoodsSold.purchaseDiscounts = data.cogs.purchaseDiscounts;

    // Set the calculated COGS from transactions (primary method)
    statement.costOfGoodsSold.totalCOGS.amount = data.cogs.totalCOGS;
    statement.costOfGoodsSold.totalCOGS.calculationMethod = 'transaction';
    statement.costOfGoodsSold.totalCOGS.calculation = `Sum of ${data.cogs.cogsDetails?.length || 0} COGS transaction(s)`;

    if (includeDetails) {
      statement.costOfGoodsSold.purchases.details = data.cogs.purchaseDetails;
      // Add COGS transaction details
      statement.costOfGoodsSold.cogsDetails = data.cogs.cogsDetails;

      // Add purchase return details if available
      if (data.cogs.purchaseAdjustments?.returnDetails && data.cogs.purchaseAdjustments.returnDetails.length > 0) {
        // Store as array on the statement (will be saved if schema supports it, otherwise ignored)
        statement.costOfGoodsSold.purchaseReturnDetails = data.cogs.purchaseAdjustments.returnDetails;
      }

      // Add purchase discount details if available
      if (data.cogs.purchaseAdjustments?.discountDetails && data.cogs.purchaseAdjustments.discountDetails.length > 0) {
        // Store as array on the statement (will be saved if schema supports it, otherwise ignored)
        statement.costOfGoodsSold.purchaseDiscountDetails = data.cogs.purchaseAdjustments.discountDetails;
      }
    }
  }

  // Populate expense data in P&L statement
  async populateExpenseData(statement, data, includeDetails) {
    // Get budget comparison if available
    const budgetComparison = await budgetComparisonService.compareExpensesWithBudget(
      data.expenses,
      statement.period
    );

    // Selling expenses
    let sellingTotal = 0;

    // Group transactions by category
    const sellingByCategory = {};
    if (data.expenses.sellingDetails) {
      data.expenses.sellingDetails.forEach(detail => {
        if (!sellingByCategory[detail.category]) {
          sellingByCategory[detail.category] = {
            category: detail.category,
            amount: 0,
            description: `${detail.category.replace('_', ' ')} expenses`,
            transactions: []
          };
        }
        sellingByCategory[detail.category].amount += detail.amount;
        if (includeDetails) {
          sellingByCategory[detail.category].transactions.push({
            date: detail.date,
            amount: detail.amount,
            description: detail.description,
            accountCode: detail.accountCode,
            accountName: detail.accountName,
            reference: detail.reference,
            transactionId: detail.transactionId,
          });
        }
      });
    }

    // Add category totals with budget comparison
    Object.values(sellingByCategory).forEach(categoryData => {
      sellingTotal += categoryData.amount;
      const detailEntry = {
        category: categoryData.category,
        amount: categoryData.amount,
        description: categoryData.description,
      };

      // Add budget comparison if available
      if (budgetComparison.hasBudget && budgetComparison.sellingExpenses[categoryData.category]) {
        const budgetData = budgetComparison.sellingExpenses[categoryData.category];
        detailEntry.budget = {
          amount: budgetData.budget,
          variance: budgetData.variance,
          variancePercent: budgetData.variancePercent,
          status: budgetData.status
        };
      }

      // Add transaction details as subcategories if includeDetails is true
      if (includeDetails && categoryData.transactions.length > 0) {
        detailEntry.subcategories = categoryData.transactions.map(txn => ({
          name: txn.description || `${txn.accountName} - ${txn.reference}`,
          amount: txn.amount,
          date: txn.date,
          transactionId: txn.transactionId,
        }));
      }

      statement.operatingExpenses.sellingExpenses.details.push(detailEntry);
    });

    statement.operatingExpenses.sellingExpenses.total = sellingTotal;

    // Add budget comparison summary for selling expenses
    if (budgetComparison.hasBudget) {
      statement.operatingExpenses.sellingExpenses.budgetComparison = {
        budget: budgetComparison.totals.budget.selling,
        actual: budgetComparison.totals.actual.selling,
        variance: budgetComparison.totals.variance.selling,
        variancePercent: budgetComparison.totals.variancePercent.selling
      };
    }

    // Administrative expenses
    let adminTotal = 0;

    // Group transactions by category
    const adminByCategory = {};
    if (data.expenses.administrativeDetails) {
      data.expenses.administrativeDetails.forEach(detail => {
        if (!adminByCategory[detail.category]) {
          adminByCategory[detail.category] = {
            category: detail.category,
            amount: 0,
            description: `${detail.category.replace('_', ' ')} expenses`,
            transactions: []
          };
        }
        adminByCategory[detail.category].amount += detail.amount;
        if (includeDetails) {
          adminByCategory[detail.category].transactions.push({
            date: detail.date,
            amount: detail.amount,
            description: detail.description,
            accountCode: detail.accountCode,
            accountName: detail.accountName,
            reference: detail.reference,
            transactionId: detail.transactionId,
          });
        }
      });
    }

    // Add category totals with budget comparison
    Object.values(adminByCategory).forEach(categoryData => {
      adminTotal += categoryData.amount;
      const detailEntry = {
        category: categoryData.category,
        amount: categoryData.amount,
        description: categoryData.description,
      };

      // Add budget comparison if available
      if (budgetComparison.hasBudget && budgetComparison.administrativeExpenses[categoryData.category]) {
        const budgetData = budgetComparison.administrativeExpenses[categoryData.category];
        detailEntry.budget = {
          amount: budgetData.budget,
          variance: budgetData.variance,
          variancePercent: budgetData.variancePercent,
          status: budgetData.status
        };
      }

      // Add transaction details as subcategories if includeDetails is true
      if (includeDetails && categoryData.transactions.length > 0) {
        detailEntry.subcategories = categoryData.transactions.map(txn => ({
          name: txn.description || `${txn.accountName} - ${txn.reference}`,
          amount: txn.amount,
          date: txn.date,
          transactionId: txn.transactionId,
        }));
      }

      statement.operatingExpenses.administrativeExpenses.details.push(detailEntry);
    });

    statement.operatingExpenses.administrativeExpenses.total = adminTotal;

    // Add budget comparison summary for administrative expenses
    if (budgetComparison.hasBudget) {
      statement.operatingExpenses.administrativeExpenses.budgetComparison = {
        budget: budgetComparison.totals.budget.administrative,
        actual: budgetComparison.totals.actual.administrative,
        variance: budgetComparison.totals.variance.administrative,
        variancePercent: budgetComparison.totals.variancePercent.administrative
      };

      // Add overall budget comparison
      statement.operatingExpenses.budgetComparison = {
        budget: budgetComparison.totals.budget.total,
        actual: budgetComparison.totals.actual.total,
        variance: budgetComparison.totals.variance.total,
        variancePercent: budgetComparison.totals.variancePercent.total,
        budgetId: budgetComparison.budgetId,
        budgetName: budgetComparison.budgetName
      };
    }
  }

  // Populate other data in P&L statement
  async populateOtherData(statement, data, includeDetails) {
    statement.otherIncome.interestIncome = data.otherIncome.interestIncome;
    statement.otherIncome.rentalIncome = data.otherIncome.rentalIncome;
    statement.otherIncome.other.amount = data.otherIncome.other;

    statement.otherExpenses.interestExpense = data.otherExpenses.interestExpense;
    statement.otherExpenses.depreciation = data.otherExpenses.depreciation;
    statement.otherExpenses.amortization = data.otherExpenses.amortization;
    statement.otherExpenses.other.amount = data.otherExpenses.other;

    // Populate tax data
    statement.incomeTax.current = data.taxes.incomeTax;
    statement.incomeTax.deferred = data.taxes.deferred;

    // Add sales tax and tax details if available
    if (data.taxes.salesTaxDetails) {
      statement.salesTax = {
        amount: data.taxes.salesTax,
        taxableSales: data.taxes.salesTaxDetails.taxableSales,
        taxExemptSales: data.taxes.salesTaxDetails.taxExemptSales,
        taxByMonth: data.taxes.salesTaxDetails.taxByMonth,
        source: data.taxes.salesTaxDetails.source
      };
    }

    if (data.taxes.incomeTaxDetails && includeDetails) {
      statement.incomeTax.details = {
        effectiveRate: data.taxes.incomeTaxDetails.effectiveRate,
        calculation: data.taxes.incomeTaxDetails.calculation,
        bracketDetails: data.taxes.incomeTaxDetails.bracketDetails
      };
    }
  }

  // Add comparisons to P&L statement
  async addComparisons(statement) {
    try {
      // Get previous period statement
      const previousStatement = await FinancialStatementRepository.findOne({
        type: 'profit_loss',
        'period.endDate': { $lt: statement.period.startDate },
      }, {
        sort: { 'period.endDate': -1 }
      });

      if (previousStatement) {
        const netIncomeChange = statement.netIncome.amount - previousStatement.netIncome.amount;
        const netIncomeChangePercent = previousStatement.netIncome.amount !== 0 ?
          (netIncomeChange / previousStatement.netIncome.amount) * 100 : 0;

        statement.comparison.previousPeriod = {
          period: `${previousStatement.period.startDate.toISOString().split('T')[0]} to ${previousStatement.period.endDate.toISOString().split('T')[0]}`,
          netIncome: previousStatement.netIncome.amount,
          change: netIncomeChange,
          changePercent: netIncomeChangePercent,
        };
      }

      // Get budget statement (if exists)
      const budgetStatement = await FinancialStatementRepository.findOne({
        type: 'budget_profit_loss',
        'period.startDate': statement.period.startDate,
        'period.endDate': statement.period.endDate,
      });

      if (budgetStatement) {
        const variance = statement.netIncome.amount - budgetStatement.netIncome.amount;
        const variancePercent = budgetStatement.netIncome.amount !== 0 ?
          (variance / budgetStatement.netIncome.amount) * 100 : 0;

        statement.comparison.budget = {
          period: 'Budget',
          netIncome: budgetStatement.netIncome.amount,
          variance,
          variancePercent,
        };
      }
    } catch (error) {
      console.error('Error adding comparisons:', error);
      // Don't throw error, just skip comparisons
    }
  }

  // Get P&L summary for dashboard (always calculates fresh - no caching)
  async getPLSummary(period) {
    // Always calculate fresh data for real-time updates
    const financialData = await this.calculateFinancialData(period);

    // Calculate derived values
    const grossSales = financialData.revenue.grossSales;
    const salesReturns = financialData.revenue.salesReturns;
    const salesDiscounts = financialData.revenue.salesDiscounts;
    const totalRevenue = grossSales - salesReturns - salesDiscounts +
      (financialData.otherIncome.interestIncome + financialData.otherIncome.rentalIncome + financialData.otherIncome.other);

    const totalCOGS = financialData.cogs.totalCOGS;
    const grossProfit = totalRevenue - totalCOGS;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Calculate operating expenses
    const sellingExpenses = Object.values(financialData.expenses.selling).reduce((sum, val) => sum + val, 0);
    const administrativeExpenses = Object.values(financialData.expenses.administrative).reduce((sum, val) => sum + val, 0);
    const totalOperatingExpenses = sellingExpenses + administrativeExpenses;
    const operatingIncome = grossProfit - totalOperatingExpenses;
    const operatingMargin = totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0;

    // Calculate other income/expenses
    const otherIncome = financialData.otherIncome.interestIncome + financialData.otherIncome.rentalIncome + financialData.otherIncome.other;
    const otherExpenses = financialData.otherExpenses.interestExpense + financialData.otherExpenses.depreciation +
      financialData.otherExpenses.amortization + financialData.otherExpenses.other;

    // Calculate earnings before tax
    const earningsBeforeTax = operatingIncome + otherIncome - otherExpenses;

    // Calculate net income (after taxes)
    const totalTax = financialData.taxes.totalTax;
    const netIncome = earningsBeforeTax - totalTax;
    const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    // Format period dates as ISO strings for consistent display
    const formatPeriodDate = (date) => {
      if (!date) return null;
      const d = date instanceof Date ? date : new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      totalRevenue,
      grossProfit,
      operatingIncome,
      netIncome,
      grossMargin,
      operatingMargin,
      netMargin,
      period: {
        startDate: formatPeriodDate(period.startDate),
        endDate: formatPeriodDate(period.endDate),
        type: period.type || 'custom'
      },
      lastUpdated: new Date(), // Always show current time for real-time data
      // Additional breakdown for transparency
      breakdown: {
        grossSales,
        salesReturns,
        salesDiscounts,
        totalCOGS,
        sellingExpenses,
        administrativeExpenses,
        otherIncome,
        otherExpenses,
        totalTax
      }
    };
  }

  // Get P&L trends over time
  async getPLTrends(periods) {
    const statements = await FinancialStatementRepository.findAll({
      type: 'profit_loss',
      'period.startDate': { $in: periods.map(p => p.startDate) },
    }, {
      sort: { 'period.startDate': 1 }
    });

    return statements.map(statement => ({
      period: statement.period,
      totalRevenue: statement.revenue.totalRevenue.amount,
      grossProfit: statement.grossProfit.amount,
      operatingIncome: statement.operatingIncome.amount,
      netIncome: statement.netIncome.amount,
      grossMargin: statement.grossProfit.margin,
      operatingMargin: statement.operatingIncome.margin,
      netMargin: statement.netIncome.margin,
    }));
  }
}

module.exports = new PLCalculationService();
