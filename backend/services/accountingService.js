const mongoose = require('mongoose');
const TransactionRepository = require('../repositories/TransactionRepository');
const ChartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const BalanceSheetRepository = require('../repositories/BalanceSheetRepository');
const Transaction = require('../models/Transaction');
const ChartOfAccounts = require('../models/ChartOfAccounts');
const BalanceSheet = require('../models/BalanceSheet');

class AccountingService {
  /**
   * Validate that an account exists and is active
   * @param {String} accountCode - Account code to validate
   * @param {Object} options - Optional parameters (e.g., session)
   * @returns {Promise<Object>} Account object
   */
  static async validateAccount(accountCode, options = {}) {
    if (!accountCode || typeof accountCode !== 'string') {
      throw new Error('Account code is required and must be a string');
    }
    const account = await ChartOfAccountsRepository.findOne({
      accountCode: accountCode.toUpperCase(),
      isActive: true
    }, options);

    if (!account) {
      throw new Error(`Account code ${accountCode} not found or inactive in Chart of Accounts`);
    }

    if (!account.allowDirectPosting) {
      throw new Error(`Account ${accountCode} (${account.accountName}) does not allow direct posting`);
    }

    return account;
  }

  /**
   * Get account code by account name and type
   * @param {String} accountName - Account name (partial match)
   * @param {String} accountType - Account type (asset, liability, etc.)
   * @param {String} accountCategory - Account category (optional)
   * @returns {Promise<String>} Account code
   */
  static async getAccountCode(accountName, accountType, accountCategory = null) {
    // Create flexible search patterns for common account name variations
    const namePatterns = {
      'Cash': ['Cash', 'Cash on Hand', 'Cash Account'],
      'Bank': ['Bank', 'Bank Accounts', 'Bank Account'],
      'Accounts Receivable': ['Accounts Receivable', 'Account Receivable', 'AR', 'Receivables'],
      'Inventory': ['Inventory', 'Stock', 'Merchandise'],
      'Accounts Payable': ['Accounts Payable', 'Account Payable', 'AP', 'Payables'],
      'Sales Revenue': ['Sales Revenue', 'Sales', 'Revenue from Sales'],
      'Other Revenue': ['Other Revenue', 'Other Income', 'Miscellaneous Revenue'],
      'Cost of Goods Sold': ['Cost of Goods Sold', 'COGS', 'Cost of Sales'],
      'Other Expenses': ['Other Expenses', 'Miscellaneous Expenses', 'Other Operating Expenses'],
      "Owner's Equity": ["Owner's Equity", "Owner's Capital", "Capital", "Retained Earnings"]
    };

    // Get search terms for this account name
    const searchTerms = namePatterns[accountName] || [accountName];

    // Try each search pattern
    for (const searchTerm of searchTerms) {
      const query = {
        accountName: { $regex: new RegExp(`^${searchTerm}$`, 'i') },
        accountType: accountType,
        isActive: true,
        allowDirectPosting: true
      };

      if (accountCategory) {
        query.accountCategory = accountCategory;
      }

      const account = await ChartOfAccountsRepository.findOne(query);
      if (account) {
        return account.accountCode;
      }
    }

    // Fallback: Try to find by account name pattern (partial match) and type
    const fallbackAccount = await ChartOfAccountsRepository.findOne({
      accountName: { $regex: new RegExp(accountName.split(' ')[0], 'i') }, // Match first word
      accountType: accountType,
      isActive: true,
      allowDirectPosting: true
    });

    if (fallbackAccount) {
      return fallbackAccount.accountCode;
    }

    // Final fallback: Try to find by account name only (any type)
    const anyTypeAccount = await ChartOfAccountsRepository.findOne({
      accountName: { $regex: new RegExp(accountName.split(' ')[0], 'i') },
      isActive: true
    });

    if (anyTypeAccount) {
      console.warn(`Account found but type mismatch: ${accountName}. Expected: ${accountType}, Found: ${anyTypeAccount.accountType}`);
      return anyTypeAccount.accountCode;
    }

    throw new Error(`Account not found: ${accountName} (${accountType}${accountCategory ? '/' + accountCategory : ''})`);
  }

  /**
   * Get default account codes (with fallback to hardcoded if not found)
   * @returns {Promise<Object>} Object with account codes
   */
  static async getDefaultAccountCodes() {
    const codes = {};

    try {
      codes.cash = await this.getAccountCode('Cash', 'asset', 'current_assets').catch(err => {
        console.warn(`Account lookup failed for Cash:`, err.message);
        return null;
      });
      codes.bank = await this.getAccountCode('Bank', 'asset', 'current_assets').catch(err => {
        console.warn(`Account lookup failed for Bank:`, err.message);
        return null;
      });
      codes.accountsReceivable = await this.getAccountCode('Accounts Receivable', 'asset', 'current_assets').catch(err => {
        console.warn(`Account lookup failed for Accounts Receivable:`, err.message);
        return null;
      });
      codes.inventory = await this.getAccountCode('Inventory', 'asset', 'inventory').catch(err => {
        console.warn(`Account lookup failed for Inventory:`, err.message);
        return null;
      });
      codes.accountsPayable = await this.getAccountCode('Accounts Payable', 'liability', 'current_liabilities').catch(err => {
        console.warn(`Account lookup failed for Accounts Payable:`, err.message);
        return null;
      });
      codes.salesRevenue = await this.getAccountCode('Sales Revenue', 'revenue', 'sales_revenue').catch(err => {
        console.warn(`Account lookup failed for Sales Revenue:`, err.message);
        return null;
      });
      codes.otherRevenue = await this.getAccountCode('Other Revenue', 'revenue', 'other_revenue').catch(err => {
        console.warn(`Account lookup failed for Other Revenue:`, err.message);
        return null;
      });
      codes.costOfGoodsSold = await this.getAccountCode('Cost of Goods Sold', 'expense', 'cost_of_goods_sold').catch(err => {
        console.warn(`Account lookup failed for Cost of Goods Sold:`, err.message);
        return null;
      });
      codes.otherExpenses = await this.getAccountCode('Other Expenses', 'expense', 'other_expenses').catch(err => {
        console.warn(`Account lookup failed for Other Expenses:`, err.message);
        return null;
      });
      codes.equity = await this.getAccountCode("Owner's Equity", 'equity').catch(err => {
        console.warn(`Account lookup failed for Equity:`, err.message);
        return null;
      });
    } catch (error) {
      console.error('Error loading default account codes:', error);
    }

    return codes;
  }
  /**
   * Create accounting entries for cash receipts
   * @param {Object} cashReceipt - Cash receipt data
   * @returns {Promise<Array>} Created transactions
   */
  static async recordCashReceipt(cashReceipt) {
    const session = await mongoose.startSession();
    try {
      let transactions = [];
      await session.withTransaction(async () => {
        const accountCodes = await this.getDefaultAccountCodes();

        // Debit: Cash Account
        const cashTransaction = await this.createTransaction({
          transactionId: `CR-${cashReceipt._id}`,
          orderId: cashReceipt.order || cashReceipt._id, // Use cash receipt ID if no order
          paymentId: cashReceipt._id,
          paymentMethod: cashReceipt.paymentMethod || 'cash',
          type: 'sale',
          amount: cashReceipt.amount,
          currency: 'USD',
          status: 'completed',
          description: `Cash Receipt: ${cashReceipt.particular}`,
          accountCode: accountCodes.cash,
          debitAmount: cashReceipt.amount,
          creditAmount: 0,
          reference: cashReceipt.voucherCode,
          customer: cashReceipt.customer,
          createdBy: cashReceipt.createdBy
        }, { session });
        transactions.push(cashTransaction);

        // Credit: Accounts Receivable (if customer payment) or Revenue
        if (cashReceipt.customer) {
          // Customer payment - reduce accounts receivable
          const arTransaction = await this.createTransaction({
            transactionId: `CR-AR-${cashReceipt._id}`,
            orderId: cashReceipt.order || cashReceipt._id, // Use cash receipt ID if no order
            paymentId: cashReceipt._id,
            paymentMethod: cashReceipt.paymentMethod || 'cash',
            type: 'sale',
            amount: cashReceipt.amount,
            currency: 'USD',
            status: 'completed',
            description: `Customer Payment: ${cashReceipt.particular}`,
            accountCode: accountCodes.accountsReceivable,
            debitAmount: 0,
            creditAmount: cashReceipt.amount,
            reference: cashReceipt.voucherCode,
            customer: cashReceipt.customer,
            createdBy: cashReceipt.createdBy
          }, { session });
          transactions.push(arTransaction);
        } else {
          // Other income - credit revenue (use Other Revenue, not Sales Revenue)
          const revenueTransaction = await this.createTransaction({
            transactionId: `CR-REV-${cashReceipt._id}`,
            orderId: cashReceipt.order || cashReceipt._id, // Use cash receipt ID if no order
            paymentId: cashReceipt._id,
            paymentMethod: cashReceipt.paymentMethod || 'cash',
            type: 'sale',
            amount: cashReceipt.amount,
            currency: 'USD',
            status: 'completed',
            description: `Other Income: ${cashReceipt.particular}`,
            accountCode: accountCodes.otherRevenue,
            debitAmount: 0,
            creditAmount: cashReceipt.amount,
            reference: cashReceipt.voucherCode,
            createdBy: cashReceipt.createdBy
          }, { session });
          transactions.push(revenueTransaction);
        }

        // Validate double-entry balance
        await this.validateBalance(transactions, `cash receipt ${cashReceipt.voucherCode || cashReceipt._id}`, { session });
      });

      // Calculate balance for logging purposes after commit
      const totalDebits = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
      const totalCredits = transactions.reduce((sum, t) => sum + (t.creditAmount || 0), 0);
      console.log(`Created ${transactions.length} accounting entries for cash receipt ${cashReceipt._id} (Debits: ${totalDebits.toFixed(2)} = Credits: ${totalCredits.toFixed(2)})`);

      return transactions;
    } catch (error) {
      console.error('Error creating accounting entries for cash receipt:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Create accounting entries for cash payments
   * @param {Object} cashPayment - Cash payment data
   * @returns {Promise<Array>} Created transactions
   */
  static async recordCashPayment(cashPayment) {
    const session = await mongoose.startSession();
    try {
      let transactions = [];
      await session.withTransaction(async () => {
        const accountCodes = await this.getDefaultAccountCodes();

        // Credit: Cash Account
        const cashTransaction = await this.createTransaction({
          transactionId: `CP-${cashPayment._id}`,
          orderId: cashPayment.order || cashPayment._id, // Use cash payment ID if no order
          paymentId: cashPayment._id,
          paymentMethod: cashPayment.paymentMethod || 'cash',
          type: 'sale',
          amount: cashPayment.amount,
          currency: 'USD',
          status: 'completed',
          description: `Cash Payment: ${cashPayment.particular}`,
          accountCode: accountCodes.cash,
          debitAmount: 0,
          creditAmount: cashPayment.amount,
          reference: cashPayment.voucherCode,
          supplier: cashPayment.supplier,
          customer: cashPayment.customer,
          createdBy: cashPayment.createdBy
        }, { session });
        transactions.push(cashTransaction);

        // Debit: Accounts Payable (if supplier payment) or Expense
        if (cashPayment.supplier) {
          // Supplier payment - reduce accounts payable
          const apTransaction = await this.createTransaction({
            transactionId: `CP-AP-${cashPayment._id}`,
            orderId: cashPayment.order || cashPayment._id, // Use cash payment ID if no order
            paymentId: cashPayment._id,
            paymentMethod: cashPayment.paymentMethod || 'cash',
            type: 'sale',
            amount: cashPayment.amount,
            currency: 'USD',
            status: 'completed',
            description: `Supplier Payment: ${cashPayment.particular}`,
            accountCode: accountCodes.accountsPayable,
            debitAmount: cashPayment.amount,
            creditAmount: 0,
            reference: cashPayment.voucherCode,
            supplier: cashPayment.supplier,
            createdBy: cashPayment.createdBy
          }, { session });
          transactions.push(apTransaction);
        } else if (cashPayment.customer) {
          // Customer refund - debit accounts receivable
          const arTransaction = await this.createTransaction({
            transactionId: `CP-AR-${cashPayment._id}`,
            orderId: cashPayment.order || undefined,
            paymentId: cashPayment._id,
            paymentMethod: cashPayment.paymentMethod || 'cash',
            type: 'refund',
            amount: cashPayment.amount,
            currency: 'USD',
            status: 'completed',
            description: `Customer Refund: ${cashPayment.particular}`,
            accountCode: accountCodes.accountsReceivable,
            debitAmount: cashPayment.amount,
            creditAmount: 0,
            reference: cashPayment.voucherCode,
            customer: cashPayment.customer,
            createdBy: cashPayment.createdBy
          }, { session });
          transactions.push(arTransaction);
        } else {
          // Other expense - debit specified expense account when provided
          let expenseAccountCode = accountCodes.otherExpenses;
          if (cashPayment.expenseAccount) {
            try {
              // We need to verify if the account exists, using the session if we are doing updates, 
              // but here just a read. We can pass session for consistency.
              const expenseAccount = await ChartOfAccounts.findById(cashPayment.expenseAccount)
                .select('accountCode accountName')
                .session(session);

              if (expenseAccount?.accountCode) {
                expenseAccountCode = expenseAccount.accountCode;
              } else {
                console.warn(`Expense account ${cashPayment.expenseAccount} not found or missing accountCode. Falling back to Other Expenses.`);
              }
            } catch (lookupError) {
              console.error(`Error resolving expense account ${cashPayment.expenseAccount} for cash payment ${cashPayment._id}:`, lookupError);
            }
          }

          const expenseTransaction = await this.createTransaction({
            transactionId: `CP-EXP-${cashPayment._id}`,
            orderId: cashPayment.order || undefined, // Use undefined instead of null for optional field
            paymentId: cashPayment._id,
            paymentMethod: cashPayment.paymentMethod || 'cash', // Provide payment method
            type: 'sale',
            amount: cashPayment.amount,
            currency: 'USD',
            status: 'completed',
            description: `Expense: ${cashPayment.particular}`,
            accountCode: expenseAccountCode,
            debitAmount: cashPayment.amount,
            creditAmount: 0,
            reference: cashPayment.voucherCode,
            createdBy: cashPayment.createdBy
          }, { session });
          transactions.push(expenseTransaction);
        }

        // Validate double-entry balance
        await this.validateBalance(transactions, `cash payment ${cashPayment.voucherCode || cashPayment._id}`, { session });
      });

      // Calculate balance for logging purposes after commit
      const totalDebits = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
      const totalCredits = transactions.reduce((sum, t) => sum + (t.creditAmount || 0), 0);
      console.log(`Created ${transactions.length} accounting entries for cash payment ${cashPayment._id} (Debits: ${totalDebits.toFixed(2)} = Credits: ${totalCredits.toFixed(2)})`);

      return transactions;
    } catch (error) {
      console.error('Error creating accounting entries for cash payment:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Create accounting entries for bank receipts
   * @param {Object} bankReceipt - Bank receipt data
   * @returns {Promise<Array>} Created transactions
   */
  static async recordBankReceipt(bankReceipt) {
    const session = await mongoose.startSession();
    try {
      let transactions = [];
      await session.withTransaction(async () => {
        const accountCodes = await this.getDefaultAccountCodes();

        // Debit: Bank Account
        const bankTransaction = await this.createTransaction({
          transactionId: `BR-${bankReceipt._id}`,
          orderId: bankReceipt.order || undefined,
          paymentId: bankReceipt._id,
          paymentMethod: 'bank_transfer',
          type: 'sale',
          amount: bankReceipt.amount,
          currency: 'USD',
          status: 'completed',
          description: `Bank Receipt: ${bankReceipt.particular}`,
          accountCode: accountCodes.bank,
          debitAmount: bankReceipt.amount,
          creditAmount: 0,
          reference: bankReceipt.transactionReference,
          customer: bankReceipt.customer,
          createdBy: bankReceipt.createdBy
        }, { session });
        transactions.push(bankTransaction);

        // Credit: Accounts Receivable (if customer payment) or Revenue
        if (bankReceipt.customer) {
          // Customer payment - reduce accounts receivable
          const arTransaction = await this.createTransaction({
            transactionId: `BR-AR-${bankReceipt._id}`,
            orderId: bankReceipt.order || undefined,
            paymentId: bankReceipt._id,
            paymentMethod: 'bank_transfer',
            type: 'sale',
            amount: bankReceipt.amount,
            currency: 'USD',
            status: 'completed',
            description: `Customer Payment: ${bankReceipt.particular}`,
            accountCode: accountCodes.accountsReceivable,
            debitAmount: 0,
            creditAmount: bankReceipt.amount,
            reference: bankReceipt.transactionReference,
            customer: bankReceipt.customer,
            createdBy: bankReceipt.createdBy
          }, { session });
          transactions.push(arTransaction);
        } else {
          // Other income - credit revenue (use Other Revenue, not Sales Revenue)
          const revenueTransaction = await this.createTransaction({
            transactionId: `BR-REV-${bankReceipt._id}`,
            orderId: bankReceipt.order || undefined,
            paymentId: bankReceipt._id,
            paymentMethod: 'bank_transfer',
            type: 'sale',
            amount: bankReceipt.amount,
            currency: 'USD',
            status: 'completed',
            description: `Other Income: ${bankReceipt.particular}`,
            accountCode: accountCodes.otherRevenue,
            debitAmount: 0,
            creditAmount: bankReceipt.amount,
            reference: bankReceipt.transactionReference,
            createdBy: bankReceipt.createdBy
          }, { session });
          transactions.push(revenueTransaction);
        }

        // Validate double-entry balance
        await this.validateBalance(transactions, `bank receipt ${bankReceipt.transactionReference || bankReceipt._id}`, { session });
      });

      // Calculate balance for logging purposes after commit
      const totalDebits = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
      const totalCredits = transactions.reduce((sum, t) => sum + (t.creditAmount || 0), 0);
      console.log(`Created ${transactions.length} accounting entries for bank receipt ${bankReceipt._id} (Debits: ${totalDebits.toFixed(2)} = Credits: ${totalCredits.toFixed(2)})`);

      return transactions;
    } catch (error) {
      console.error('Error creating accounting entries for bank receipt:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Create accounting entries for bank payments
   * @param {Object} bankPayment - Bank payment data
   * @returns {Promise<Array>} Created transactions
   */
  static async recordBankPayment(bankPayment) {
    const session = await mongoose.startSession();
    try {
      let transactions = [];
      await session.withTransaction(async () => {
        const accountCodes = await this.getDefaultAccountCodes();

        // Credit: Bank Account
        const bankTransaction = await this.createTransaction({
          transactionId: `BP-${bankPayment._id}`,
          orderId: bankPayment.order || undefined,
          paymentId: bankPayment._id,
          paymentMethod: 'bank_transfer',
          type: 'sale',
          amount: bankPayment.amount,
          currency: 'USD',
          status: 'completed',
          description: `Bank Payment: ${bankPayment.particular}`,
          accountCode: accountCodes.bank,
          debitAmount: 0,
          creditAmount: bankPayment.amount,
          reference: bankPayment.transactionReference,
          supplier: bankPayment.supplier,
          customer: bankPayment.customer,
          createdBy: bankPayment.createdBy
        }, { session });
        transactions.push(bankTransaction);

        // Debit: Accounts Payable (if supplier payment) or Expense
        if (bankPayment.supplier) {
          // Supplier payment - reduce accounts payable
          const apTransaction = await this.createTransaction({
            transactionId: `BP-AP-${bankPayment._id}`,
            orderId: bankPayment.order || undefined,
            paymentId: bankPayment._id,
            paymentMethod: 'bank_transfer',
            type: 'sale',
            amount: bankPayment.amount,
            currency: 'USD',
            status: 'completed',
            description: `Supplier Payment: ${bankPayment.particular}`,
            accountCode: accountCodes.accountsPayable,
            debitAmount: bankPayment.amount,
            creditAmount: 0,
            reference: bankPayment.transactionReference,
            supplier: bankPayment.supplier,
            createdBy: bankPayment.createdBy
          }, { session });
          transactions.push(apTransaction);
        } else if (bankPayment.customer) {
          // Customer refund - debit accounts receivable
          const arTransaction = await this.createTransaction({
            transactionId: `BP-AR-${bankPayment._id}`,
            orderId: bankPayment.order || undefined,
            paymentId: bankPayment._id,
            paymentMethod: 'bank_transfer',
            type: 'refund',
            amount: bankPayment.amount,
            currency: 'USD',
            status: 'completed',
            description: `Customer Refund: ${bankPayment.particular}`,
            accountCode: accountCodes.accountsReceivable,
            debitAmount: bankPayment.amount,
            creditAmount: 0,
            reference: bankPayment.transactionReference,
            customer: bankPayment.customer,
            createdBy: bankPayment.createdBy
          }, { session });
          transactions.push(arTransaction);
        } else {
          // Other expense - debit specified expense account when provided
          let expenseAccountCode = accountCodes.otherExpenses;
          if (bankPayment.expenseAccount) {
            try {
              const expenseAccount = await ChartOfAccounts.findById(bankPayment.expenseAccount)
                .select('accountCode accountName')
                .session(session);
              if (expenseAccount?.accountCode) {
                expenseAccountCode = expenseAccount.accountCode;
              } else {
                console.warn(`Expense account ${bankPayment.expenseAccount} not found or missing accountCode. Falling back to Other Expenses.`);
              }
            } catch (lookupError) {
              console.error(`Error resolving expense account ${bankPayment.expenseAccount} for bank payment ${bankPayment._id}:`, lookupError);
            }
          }

          const expenseTransaction = await this.createTransaction({
            transactionId: `BP-EXP-${bankPayment._id}`,
            orderId: bankPayment.order || undefined, // Use undefined instead of null for optional field
            paymentId: bankPayment._id,
            paymentMethod: 'bank_transfer', // Bank payment uses bank transfer
            type: 'sale',
            amount: bankPayment.amount,
            currency: 'USD',
            status: 'completed',
            description: `Expense: ${bankPayment.particular}`,
            accountCode: expenseAccountCode,
            debitAmount: bankPayment.amount,
            creditAmount: 0,
            reference: bankPayment.transactionReference,
            createdBy: bankPayment.createdBy
          }, { session });
          transactions.push(expenseTransaction);
        }

        // Validate double-entry balance
        await this.validateBalance(transactions, `bank payment ${bankPayment.transactionReference || bankPayment._id}`, { session });
      });

      // Calculate balance for logging purposes after commit
      const totalDebits = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
      const totalCredits = transactions.reduce((sum, t) => sum + (t.creditAmount || 0), 0);
      console.log(`Created ${transactions.length} accounting entries for bank payment ${bankPayment._id} (Debits: ${totalDebits.toFixed(2)} = Credits: ${totalCredits.toFixed(2)})`);

      return transactions;
    } catch (error) {
      console.error('Error creating accounting entries for bank payment:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Validate that transactions are balanced (double-entry bookkeeping)
   * @param {Array} transactions - Array of transaction objects
   * @param {String} reference - Reference identifier for error messages
   * @returns {Promise<Object>} Balance information {totalDebits, totalCredits}
   */
  static async validateBalance(transactions, reference, options = {}) {
    const totalDebits = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
    const totalCredits = transactions.reduce((sum, t) => sum + (t.creditAmount || 0), 0);
    const balanceDifference = Math.abs(totalDebits - totalCredits);

    if (balanceDifference > 0.01) {
      // If we are in a session, just throw error - the transaction abort will roll back everything
      if (options.session) {
        throw new Error(`Unbalanced transaction entries for ${reference}: Debits ${totalDebits.toFixed(2)} ≠ Credits ${totalCredits.toFixed(2)}`);
      }

      // Otherwise, manually delete created transactions (legacy behavior)
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          for (const transaction of transactions) {
            if (transaction._id) {
              await Transaction.findByIdAndDelete(transaction._id, { session });
            }
          }
        });
      } catch (deleteError) {
        console.error(`Failed to delete unbalanced transactions for ${reference}:`, deleteError);
        // Still throw the original balance error
      } finally {
        await session.endSession();
      }
      throw new Error(`Unbalanced transaction entries for ${reference}: Debits ${totalDebits.toFixed(2)} ≠ Credits ${totalCredits.toFixed(2)}`);
    }

    return { totalDebits, totalCredits };
  }

  /**
   * Get total debits and credits for an account over a period
   * @param {String} accountCode - Account code
   * @param {Date} startDate - Start of period
   * @param {Date} endDate - End of period
   * @returns {Promise<Object>} Period summary { totalDebit, totalCredit, netChange }
   */
  static async getPeriodSummary(accountCode, startDate, endDate) {
    try {
      const normalizedAccountCode = accountCode ? accountCode.toString().trim().toUpperCase() : null;
      if (!normalizedAccountCode) {
        return { totalDebit: 0, totalCredit: 0, netChange: 0 };
      }

      const aggregationResult = await Transaction.aggregate([
        {
          $match: {
            accountCode: normalizedAccountCode,
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalDebit: { $sum: '$debitAmount' },
            totalCredit: { $sum: '$creditAmount' }
          }
        }
      ]);

      const totals = aggregationResult[0] || { totalDebit: 0, totalCredit: 0 };

      // Net change depends on account type normally, but here we just return the raw totals
      // and a simple net (Debit - Credit)
      return {
        totalDebit: Math.round(totals.totalDebit * 100) / 100,
        totalCredit: Math.round(totals.totalCredit * 100) / 100,
        netChange: Math.round((totals.totalDebit - totals.totalCredit) * 100) / 100
      };
    } catch (error) {
      console.error(`Error calculating period summary for ${accountCode}:`, error);
      throw error;
    }
  }

  /**
   * Create a single transaction entry
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  static async createTransaction(transactionData, options = {}) {
    try {
      // Validate account code before creating transaction
      if (transactionData.accountCode) {
        await this.validateAccount(transactionData.accountCode, options);
      }

      const transaction = new Transaction(transactionData);
      await transaction.save(options); // pass session if provided

      // Note: We no longer update ChartOfAccounts.currentBalance
      // All balances are now fetched dynamically from the ledger

      return transaction;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Get account balance from General Ledger only. Do not use ChartOfAccounts.currentBalance
   * for any report; this method uses openingBalance + ledger transactions as the only source of truth.
   * Account type mapping (double-entry):
   * - Assets, Expenses: increase with Debit → balance = openingBalance + Debits - Credits
   * - Liabilities, Equity, Revenue: increase with Credit → balance = openingBalance + Credits - Debits
   */
  static async getAccountBalance(accountCode, asOfDate = new Date()) {
    try {
      const normalizedAccountCode = accountCode ? accountCode.toString().trim().toUpperCase() : null;
      if (!normalizedAccountCode) {
        return 0;
      }

      const account = await ChartOfAccountsRepository.findOne({
        accountCode: normalizedAccountCode,
        isActive: true
      });

      if (!account) {
        console.warn(`Account ${normalizedAccountCode} not found or inactive`);
        return 0;
      }

      const aggregationResult = await Transaction.aggregate([
        {
          $match: {
            accountCode: normalizedAccountCode,
            createdAt: { $lte: asOfDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalDebit: { $sum: '$debitAmount' },
            totalCredit: { $sum: '$creditAmount' }
          }
        }
      ]);

      const totals = aggregationResult[0] || { totalDebit: 0, totalCredit: 0 };
      let balance = account.openingBalance || 0;

      const isCreditNormal = account.normalBalance === 'credit' ||
        ['liability', 'equity', 'revenue'].includes(account.accountType);

      if (isCreditNormal) {
        balance = balance + totals.totalCredit - totals.totalDebit;
      } else {
        balance = balance + totals.totalDebit - totals.totalCredit;
      }

      return Math.round(balance * 100) / 100;
    } catch (error) {
      console.error('Error calculating account balance:', error);
      throw error;
    }
  }

  /**
   * Get balance for a specific customer directly from the ledger
   * @param {String} customerId - Customer ID
   * @param {Date} asOfDate - Date to calculate balance as of
   * @returns {Promise<Number>} Customer balance
   */
  static async getCustomerBalance(customerId, asOfDate = new Date()) {
    try {
      const Customer = require('../models/Customer');
      const customer = await Customer.findById(customerId);
      if (!customer) return 0;

      // If customer has a specific ledger account, use that primarily
      if (customer.ledgerAccount) {
        const coa = await ChartOfAccountsRepository.findById(customer.ledgerAccount);
        if (coa) {
          return await this.getAccountBalance(coa.accountCode, asOfDate);
        }
      }

      // Otherwise, aggregate all transactions referencing this customer ID
      const aggregationResult = await Transaction.aggregate([
        {
          $match: {
            'customer.id': new mongoose.Types.ObjectId(customerId),
            createdAt: { $lte: asOfDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalDebit: { $sum: '$debitAmount' },
            totalCredit: { $sum: '$creditAmount' }
          }
        }
      ]);

      const totals = aggregationResult[0] || { totalDebit: 0, totalCredit: 0 };
      let balance = customer.openingBalance || 0;

      // Customer Accounts (AR) are Debit normal
      balance = balance + totals.totalDebit - totals.totalCredit;

      return Math.round(balance * 100) / 100;
    } catch (error) {
      console.error('Error calculating customer balance:', error);
      throw error;
    }
  }

  /**
   * Get balance for a specific supplier directly from the ledger
   * @param {String} supplierId - Supplier ID
   * @param {Date} asOfDate - Date to calculate balance as of
   * @returns {Promise<Number>} Supplier balance
   */
  static async getSupplierBalance(supplierId, asOfDate = new Date()) {
    try {
      const Supplier = require('../models/Supplier');
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) return 0;

      if (supplier.ledgerAccount) {
        const coa = await ChartOfAccountsRepository.findById(supplier.ledgerAccount);
        if (coa) {
          return await this.getAccountBalance(coa.accountCode, asOfDate);
        }
      }

      const aggregationResult = await Transaction.aggregate([
        {
          $match: {
            supplier: new mongoose.Types.ObjectId(supplierId),
            createdAt: { $lte: asOfDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalDebit: { $sum: '$debitAmount' },
            totalCredit: { $sum: '$creditAmount' }
          }
        }
      ]);

      const totals = aggregationResult[0] || { totalDebit: 0, totalCredit: 0 };
      let balance = supplier.openingBalance || 0;

      // Supplier Accounts (AP) are Credit normal
      balance = balance + totals.totalCredit - totals.totalDebit;

      return Math.round(balance * 100) / 100;
    } catch (error) {
      console.error('Error calculating supplier balance:', error);
      throw error;
    }
  }

  /**
   * Get balances for multiple customers from the ledger
   * @param {Array<String>} customerIds - Array of customer IDs
   * @returns {Promise<Map>} Map of customerId to balance
   */
  static async getBulkCustomerBalances(customerIds) {
    try {
      const ids = customerIds.map(id => new mongoose.Types.ObjectId(id));
      const results = await Transaction.aggregate([
        {
          $match: {
            'customer.id': { $in: ids },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$customer.id',
            totalDebit: { $sum: '$debitAmount' },
            totalCredit: { $sum: '$creditAmount' }
          }
        }
      ]);

      const balanceMap = new Map();
      results.forEach(r => {
        balanceMap.set(r._id.toString(), r.totalDebit - r.totalCredit);
      });
      return balanceMap;
    } catch (error) {
      console.error('Error in getBulkCustomerBalances:', error);
      return new Map();
    }
  }

  /**
   * Get balances for multiple suppliers from the ledger
   * @param {Array<String>} supplierIds - Array of supplier IDs
   * @returns {Promise<Map>} Map of supplierId to balance
   */
  static async getBulkSupplierBalances(supplierIds) {
    try {
      const ids = supplierIds.map(id => new mongoose.Types.ObjectId(id));
      const results = await Transaction.aggregate([
        {
          $match: {
            supplier: { $in: ids },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$supplier',
            totalDebit: { $sum: '$debitAmount' },
            totalCredit: { $sum: '$creditAmount' }
          }
        }
      ]);

      const balanceMap = new Map();
      results.forEach(r => {
        balanceMap.set(r._id.toString(), r.totalCredit - r.totalDebit); // AP is Credit - Debit
      });
      return balanceMap;
    } catch (error) {
      console.error('Error in getBulkSupplierBalances:', error);
      return new Map();
    }
  }

  /**
   * Get trial balance for all accounts
   * @param {Date} asOfDate - Date to calculate trial balance as of
   * @returns {Promise<Array>} Trial balance data
   */
  static async getTrialBalance(asOfDate = new Date()) {
    try {
      // Step 1: Get all active accounts to ensure we include those with $0 ledger balance but non-zero opening balance
      const accounts = await ChartOfAccounts.find({ isActive: true }).lean();

      // Step 2: Aggregate all transactions up to asOfDate
      const ledgerBalances = await Transaction.aggregate([
        {
          $match: {
            createdAt: { $lte: asOfDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$accountCode',
            totalDebit: { $sum: '$debitAmount' },
            totalCredit: { $sum: '$creditAmount' }
          }
        }
      ]);

      const balanceMap = new Map(ledgerBalances.map(lb => [lb._id, lb]));
      const trialBalance = [];

      for (const account of accounts) {
        const lb = balanceMap.get(account.accountCode) || { totalDebit: 0, totalCredit: 0 };
        let balance = account.openingBalance || 0;

        const isCreditNormal = account.normalBalance === 'credit' ||
          ['liability', 'equity', 'revenue'].includes(account.accountType);

        if (isCreditNormal) {
          balance = balance + lb.totalCredit - lb.totalDebit;
        } else {
          balance = balance + lb.totalDebit - lb.totalCredit;
        }

        if (Math.abs(balance) > 0.001) {
          trialBalance.push({
            accountCode: account.accountCode,
            accountName: account.accountName,
            accountType: account.accountType,
            debitBalance: balance > 0 ? balance : 0,
            creditBalance: balance < 0 ? Math.abs(balance) : 0
          });
        }
      }

      return trialBalance;
    } catch (error) {
      console.error('Error generating trial balance:', error);
      throw error;
    }
  }

  /**
   * Create accounting entries for sales orders
   * @param {Object} order - Sales order data
   * @returns {Promise<Array>} Created transactions
   */
  static async recordSale(order) {
    const session = await mongoose.startSession();
    try {
      let transactions = [];
      await session.withTransaction(async () => {
        const orderTotal = order.pricing?.total;
        if (orderTotal === undefined || orderTotal === null) {
          throw new Error(`Order ${order._id || order.orderNumber} missing required pricing.total`);
        }
        const amountPaid = order.payment?.amountPaid || 0;
        const unpaidAmount = orderTotal - amountPaid;
        const accountCodes = await this.getDefaultAccountCodes();

        // Handle payment method and partial payments
        // For partial payments, debit both Cash and AR
        if (amountPaid > 0) {
          // Debit Cash for amount paid (even if partial)
          const cashTransaction = await this.createTransaction({
            transactionId: `SO-CASH-${order._id}`,
            orderId: order._id,
            paymentId: order._id,
            paymentMethod: order.payment.method || 'cash',
            type: 'sale',
            amount: amountPaid,
            currency: 'USD',
            status: 'completed',
            description: `Sale Payment: ${order.orderNumber}${unpaidAmount > 0 ? ` (Partial: $${amountPaid})` : ''}`,
            accountCode: accountCodes.cash,
            debitAmount: amountPaid,
            creditAmount: 0,
            reference: order.orderNumber,
            customer: order.customer,
            createdBy: order.createdBy
          }, { session });
          transactions.push(cashTransaction);
        }

        // Debit AR for unpaid amount (if any)
        if (unpaidAmount > 0) {
          // Determine Accounts Receivable account (General vs Specific)
          let arAccountCode = accountCodes.accountsReceivable;

          if (order.customer) {
            try {
              // Lazy load Customer model to avoid circular dependencies
              const Customer = require('../models/Customer');
              const customerId = order.customer._id || order.customer;
              const customerDoc = await Customer.findById(customerId).session(session);

              if (customerDoc && customerDoc.ledgerAccount) {
                const specificAccount = await ChartOfAccountsRepository.findById(customerDoc.ledgerAccount, { session });
                if (specificAccount) {
                  arAccountCode = specificAccount.accountCode;
                  console.log(`Using specific ledger account ${arAccountCode} for customer ${customerDoc.name || customerDoc.businessName}`);
                }
              }
            } catch (err) {
              console.warn('Error fetching customer ledger account:', err);
            }
          }

          const arTransaction = await this.createTransaction({
            transactionId: `SO-AR-${order._id}`,
            orderId: order._id,
            paymentId: order._id,
            paymentMethod: order.payment.method || 'account',
            type: 'sale',
            amount: unpaidAmount,
            currency: 'USD',
            status: 'completed',
            description: `Credit Sale: ${order.orderNumber}${amountPaid > 0 ? ` (Unpaid: $${unpaidAmount.toFixed(2)})` : ''}`,
            accountCode: arAccountCode,
            debitAmount: unpaidAmount,
            creditAmount: 0,
            reference: order.orderNumber,
            customer: order.customer,
            createdBy: order.createdBy
          }, { session });
          transactions.push(arTransaction);
        }

        // Credit: Sales Revenue (full order amount)
        const revenueTransaction = await this.createTransaction({
          transactionId: `SO-REV-${order._id}`,
          orderId: order._id,
          paymentId: order._id,
          paymentMethod: order.payment.method || 'cash',
          type: 'sale',
          amount: orderTotal,
          currency: 'USD',
          status: 'completed',
          description: `Sales Revenue: ${order.orderNumber}`,
          accountCode: accountCodes.salesRevenue,
          debitAmount: 0,
          creditAmount: orderTotal,
          reference: order.orderNumber,
          customer: order.customer,
          createdBy: order.createdBy
        }, { session });
        transactions.push(revenueTransaction);

        // Debit: Cost of Goods Sold (COGS)
        let totalCOGS = 0;
        const Product = require('../models/Product');

        // Collect all product IDs to avoid N+1 queries
        const productIds = order.items
          ? order.items.map(item => item.product).filter(Boolean)
          : [];

        // Fetch all products in one batch query
        // Using session for read consistency if needed, though product reads might be fine without
        const products = productIds.length > 0
          ? await Product.find({ _id: { $in: productIds } }).session(session)
          : [];
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        // Calculate COGS using pre-fetched products
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            if (item.product) {
              const product = productMap.get(item.product.toString());
              if (product) {
                const productCost = product.pricing?.cost;
                if (productCost === undefined || productCost === null) {
                  console.warn(`Product ${product._id} missing pricing.cost for order ${order.orderNumber}`);
                }
                const cost = productCost || 0;
                totalCOGS += item.quantity * cost;
              }
            }
          }
        }

        if (totalCOGS > 0) {
          const cogsTransaction = await this.createTransaction({
            transactionId: `SO-COGS-${order._id}`,
            orderId: order._id,
            paymentId: order._id,
            paymentMethod: order.payment.method || 'cash',
            type: 'sale',
            amount: totalCOGS,
            currency: 'USD',
            status: 'completed',
            description: `Cost of Goods Sold: ${order.orderNumber}`,
            accountCode: accountCodes.costOfGoodsSold,
            debitAmount: totalCOGS,
            creditAmount: 0,
            reference: order.orderNumber,
            customer: order.customer,
            createdBy: order.createdBy
          }, { session });
          transactions.push(cogsTransaction);

          // Credit: Inventory (reduce inventory value)
          const inventoryTransaction = await this.createTransaction({
            transactionId: `SO-INV-${order._id}`,
            orderId: order._id,
            paymentId: order._id,
            paymentMethod: order.payment.method || 'cash',
            type: 'sale',
            amount: totalCOGS,
            currency: 'USD',
            status: 'completed',
            description: `Inventory Reduction: ${order.orderNumber}`,
            accountCode: accountCodes.inventory,
            debitAmount: 0,
            creditAmount: totalCOGS,
            reference: order.orderNumber,
            customer: order.customer,
            createdBy: order.createdBy
          }, { session });
          transactions.push(inventoryTransaction);
        }

        // Validate double-entry balance
        await this.validateBalance(transactions, `sales order ${order.orderNumber}`, { session });
      });

      // Calculate balance for logging purposes after commit
      const totalDebits = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
      const totalCredits = transactions.reduce((sum, t) => sum + (t.creditAmount || 0), 0);
      console.log(`Created ${transactions.length} accounting entries for sales order ${order.orderNumber} (Debits: ${totalDebits.toFixed(2)} = Credits: ${totalCredits.toFixed(2)})`);

      return transactions;
    } catch (error) {
      console.error('Error creating accounting entries for sales order:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Create accounting entries for purchase orders (when confirmed)
   * @param {Object} purchaseOrder - Purchase order data
   * @returns {Promise<Array>} Created transactions
   */
  static async recordPurchase(purchaseOrder) {
    const session = await mongoose.startSession();
    try {
      let transactions = [];
      await session.withTransaction(async () => {
        const accountCodes = await this.getDefaultAccountCodes();

        // Determine Accounts Payable account (General vs Specific)
        let apAccountCode = accountCodes.accountsPayable;

        if (purchaseOrder.supplier) {
          try {
            // Lazy load Supplier model to avoid circular dependencies
            const Supplier = require('../models/Supplier');
            const supplierId = purchaseOrder.supplier._id || purchaseOrder.supplier;
            const supplierDoc = await Supplier.findById(supplierId).session(session);

            if (supplierDoc && supplierDoc.ledgerAccount) {
              const specificAccount = await ChartOfAccountsRepository.findById(supplierDoc.ledgerAccount, { session });
              if (specificAccount) {
                apAccountCode = specificAccount.accountCode;
                console.log(`Using specific ledger account ${apAccountCode} for supplier ${supplierDoc.companyName}`);
              }
            }
          } catch (err) {
            console.warn('Error fetching supplier ledger account:', err);
          }
        }

        // Validate purchase order has total (PurchaseOrder model uses root-level total, but we handle pricing.total for compatibility)
        const purchaseTotal = purchaseOrder.total !== undefined ? purchaseOrder.total : purchaseOrder.pricing?.total;
        if (purchaseTotal === undefined || purchaseTotal === null) {
          throw new Error(`Purchase order ${purchaseOrder._id || purchaseOrder.poNumber} missing required total`);
        }

        // Debit: Inventory (increase inventory value)
        const inventoryTransaction = await this.createTransaction({
          transactionId: `PO-INV-${purchaseOrder._id}`,
          orderId: purchaseOrder._id,
          paymentId: purchaseOrder._id,
          paymentMethod: 'account',
          type: 'purchase',
          amount: purchaseTotal,
          currency: 'USD',
          status: 'completed',
          description: `Inventory Purchase: ${purchaseOrder.poNumber}`,
          accountCode: accountCodes.inventory,
          debitAmount: purchaseTotal,
          creditAmount: 0,
          reference: purchaseOrder.poNumber,
          supplier: purchaseOrder.supplier,
          createdBy: purchaseOrder.createdBy
        }, { session });
        transactions.push(inventoryTransaction);

        // Credit: Accounts Payable (General or Specific)
        const apTransaction = await this.createTransaction({
          transactionId: `PO-AP-${purchaseOrder._id}`,
          orderId: purchaseOrder._id,
          paymentId: purchaseOrder._id,
          paymentMethod: 'account',
          type: 'purchase',
          amount: purchaseTotal,
          currency: 'USD',
          status: 'completed',
          description: `Purchase on Credit: ${purchaseOrder.poNumber}`,
          accountCode: apAccountCode,
          debitAmount: 0,
          creditAmount: purchaseTotal,
          reference: purchaseOrder.poNumber,
          supplier: purchaseOrder.supplier,
          createdBy: purchaseOrder.createdBy
        }, { session });
        transactions.push(apTransaction);

        // Validate double-entry balance
        await this.validateBalance(transactions, `purchase order ${purchaseOrder.poNumber}`, { session });
      });

      // Calculate balance for logging purposes after commit
      const totalDebits = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
      const totalCredits = transactions.reduce((sum, t) => sum + (t.creditAmount || 0), 0);
      console.log(`Created ${transactions.length} accounting entries for purchase order ${purchaseOrder.poNumber} (Debits: ${totalDebits.toFixed(2)} = Credits: ${totalCredits.toFixed(2)})`);

      return transactions;
    } catch (error) {
      console.error('Error creating accounting entries for purchase order:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Create accounting entries for purchase invoices
   * @param {Object} purchaseInvoice - Purchase invoice data
   * @returns {Promise<Array>} Created transactions
   */
  static async recordPurchaseInvoice(purchaseInvoice) {
    const session = await mongoose.startSession();
    try {
      let transactions = [];
      await session.withTransaction(async () => {
        const accountCodes = await this.getDefaultAccountCodes();

        // Determine Accounts Payable account (General vs Specific)
        let apAccountCode = accountCodes.accountsPayable;

        if (purchaseInvoice.supplier) {
          try {
            // Lazy load Supplier model to avoid circular dependencies if any
            const Supplier = require('../models/Supplier');
            const supplier = await Supplier.findById(purchaseInvoice.supplier).session(session);

            if (supplier && supplier.ledgerAccount) {
              const specificAccount = await ChartOfAccountsRepository.findById(supplier.ledgerAccount, { session });
              if (specificAccount) {
                apAccountCode = specificAccount.accountCode;
                console.log(`Using specific ledger account ${apAccountCode} for supplier ${supplier.companyName}`);
              }
            }
          } catch (err) {
            console.warn('Error fetching supplier ledger account:', err);
          }
        }

        const invoiceTotal = purchaseInvoice.pricing?.total;
        if (invoiceTotal === undefined || invoiceTotal === null) {
          throw new Error(`Purchase invoice ${purchaseInvoice._id || purchaseInvoice.invoiceNumber} missing required pricing.total`);
        }

        // Debit: Inventory (increase inventory value)
        const inventoryTransaction = await this.createTransaction({
          transactionId: `PI-INV-${purchaseInvoice._id}`,
          orderId: purchaseInvoice._id, // Use invoice ID as order ID since PI is the source
          paymentId: purchaseInvoice._id,
          paymentMethod: 'account',
          type: 'purchase',
          amount: invoiceTotal,
          currency: 'USD',
          status: 'completed',
          description: `Inventory Purchase Invoice: ${purchaseInvoice.invoiceNumber}`,
          accountCode: accountCodes.inventory,
          debitAmount: invoiceTotal,
          creditAmount: 0,
          reference: purchaseInvoice.invoiceNumber,
          supplier: purchaseInvoice.supplier,
          createdBy: purchaseInvoice.createdBy
        }, { session });
        transactions.push(inventoryTransaction);

        // Credit: Accounts Payable (General or Specific)
        const apTransaction = await this.createTransaction({
          transactionId: `PI-AP-${purchaseInvoice._id}`,
          orderId: purchaseInvoice._id,
          paymentId: purchaseInvoice._id,
          paymentMethod: 'account',
          type: 'purchase',
          amount: invoiceTotal,
          currency: 'USD',
          status: 'completed',
          description: `Purchase Invoice Credit: ${purchaseInvoice.invoiceNumber}`,
          accountCode: apAccountCode,
          debitAmount: 0,
          creditAmount: invoiceTotal,
          reference: purchaseInvoice.invoiceNumber,
          supplier: purchaseInvoice.supplier,
          createdBy: purchaseInvoice.createdBy
        }, { session });
        transactions.push(apTransaction);

        // Validate double-entry balance
        await this.validateBalance(transactions, `purchase invoice ${purchaseInvoice.invoiceNumber}`, { session });
      });

      // Calculate balance for logging purposes after commit
      const totalDebits = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
      const totalCredits = transactions.reduce((sum, t) => sum + (t.creditAmount || 0), 0);
      console.log(`Created ${transactions.length} accounting entries for purchase invoice ${purchaseInvoice.invoiceNumber} (Debits: ${totalDebits.toFixed(2)} = Credits: ${totalCredits.toFixed(2)})`);

      return transactions;
    } catch (error) {
      console.error('Error creating accounting entries for purchase invoice:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Record opening balance for an account
   * @param {String} targetAccountCode - Account to receive the balance
   * @param {Number} amount - Amount of the balance
   * @param {String} description - Description for the transaction
   * @param {String} userId - User ID recording the balance
   * @returns {Promise<Array>} Created transactions
   */
  static async recordOpeningBalance(targetAccountCode, amount, description, userId) {
    const session = await mongoose.startSession();
    try {
      let transactions = [];
      await session.withTransaction(async () => {
        const accountCodes = await this.getDefaultAccountCodes();
        const targetAccount = await this.validateAccount(targetAccountCode, { session });

        let equityAccountCode = accountCodes.equity;
        if (!equityAccountCode) {
          equityAccountCode = '3001'; // Fallback to common code if resolution fails
        }

        const isDebit = targetAccount.normalBalance === 'debit';

        // Generate a common paymentId for the transaction pair
        const paymentId = new mongoose.Types.ObjectId();

        // Transaction Pair
        // 1. Target Account (usually Asset)
        transactions.push(await this.createTransaction({
          transactionId: `OB-${targetAccountCode}-${Date.now()}`,
          paymentId: paymentId,
          paymentMethod: 'other',
          type: 'opening_balance',
          amount: amount,
          currency: 'USD',
          status: 'completed',
          description: description || `Opening Balance for ${targetAccount.accountName}`,
          accountCode: targetAccountCode,
          debitAmount: isDebit ? amount : 0,
          creditAmount: isDebit ? 0 : amount,
          createdBy: userId
        }, { session }));

        // 2. Offsetting Equity Account
        transactions.push(await this.createTransaction({
          transactionId: `OB-EQ-${targetAccountCode}-${Date.now()}`,
          paymentId: paymentId,
          paymentMethod: 'other',
          type: 'opening_balance',
          amount: amount,
          currency: 'USD',
          status: 'completed',
          description: `Offset for ${targetAccount.accountName} Opening Balance`,
          accountCode: equityAccountCode,
          debitAmount: isDebit ? 0 : amount,
          creditAmount: isDebit ? amount : 0,
          createdBy: userId
        }, { session }));

        // Validate double-entry balance
        await this.validateBalance(transactions, `opening balance ${targetAccount.accountName}`, { session });
      });

      console.log(`Recorded opening balance of ${amount} for ${targetAccountCode}`);
      return transactions;
    } catch (error) {
      console.error('Error recording opening balance:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Update balance sheet with current account balances
   * @param {Date} statementDate - Statement date
   * @returns {Promise<Object>} Updated balance sheet
   */
  static async updateBalanceSheet(statementDate = new Date()) {
    try {
      // Get account codes dynamically instead of hardcoding
      const accountCodes = await this.getDefaultAccountCodes();

      // Get current balances for key accounts using dynamic account codes
      const cashBalance = await this.getAccountBalance(accountCodes.cash, statementDate);
      const bankBalance = await this.getAccountBalance(accountCodes.bank, statementDate);
      const accountsReceivable = await this.getAccountBalance(accountCodes.accountsReceivable, statementDate);
      const inventoryBalance = await this.getAccountBalance(accountCodes.inventory, statementDate);
      const accountsPayable = await this.getAccountBalance(accountCodes.accountsPayable, statementDate);

      // Create or update balance sheet
      const statementNumber = `BS-${statementDate.getFullYear()}-${String(statementDate.getMonth() + 1).padStart(2, '0')}`;

      const balanceSheetData = {
        statementNumber,
        statementDate,
        periodType: 'monthly',
        status: 'draft',
        assets: {
          currentAssets: {
            cashAndCashEquivalents: {
              cashOnHand: cashBalance,
              bankAccounts: bankBalance,
              pettyCash: 0,
              total: cashBalance + bankBalance
            },
            accountsReceivable: {
              tradeReceivables: accountsReceivable,
              otherReceivables: 0,
              allowanceForDoubtfulAccounts: 0,
              netReceivables: accountsReceivable
            },
            inventory: {
              rawMaterials: 0,
              workInProgress: 0,
              finishedGoods: inventoryBalance,
              total: inventoryBalance
            },
            prepaidExpenses: 0,
            otherCurrentAssets: 0,
            totalCurrentAssets: cashBalance + bankBalance + accountsReceivable + inventoryBalance
          }
        },
        liabilities: {
          currentLiabilities: {
            accountsPayable: {
              tradePayables: accountsPayable,
              otherPayables: 0,
              total: accountsPayable
            },
            accruedExpenses: 0,
            shortTermDebt: 0,
            otherCurrentLiabilities: 0,
            totalCurrentLiabilities: accountsPayable
          }
        }
      };

      // Calculate totals
      balanceSheetData.assets.totalAssets = balanceSheetData.assets.currentAssets.totalCurrentAssets;
      balanceSheetData.liabilities.totalLiabilities = balanceSheetData.liabilities.currentLiabilities.totalCurrentLiabilities;
      balanceSheetData.equity = {
        ownerEquity: balanceSheetData.assets.totalAssets - balanceSheetData.liabilities.totalLiabilities,
        retainedEarnings: 0,
        totalEquity: balanceSheetData.assets.totalAssets - balanceSheetData.liabilities.totalLiabilities
      };
      balanceSheetData.totalLiabilitiesAndEquity = balanceSheetData.liabilities.totalLiabilities + balanceSheetData.equity.totalEquity;

      // Save or update balance sheet
      const balanceSheet = await BalanceSheet.findOneAndUpdate(
        { statementNumber },
        balanceSheetData,
        { upsert: true, new: true }
      );

      console.log(`Updated balance sheet ${statementNumber} with current balances`);
      return balanceSheet;
    } catch (error) {
      console.error('Error updating balance sheet:', error);
      throw error;
    }
  }
}

module.exports = AccountingService;
