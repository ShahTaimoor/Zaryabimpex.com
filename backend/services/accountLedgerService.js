const transactionRepository = require('../repositories/TransactionRepository');
const chartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const customerRepository = require('../repositories/CustomerRepository');
const supplierRepository = require('../repositories/SupplierRepository');
const salesRepository = require('../repositories/SalesRepository');
const purchaseOrderRepository = require('../repositories/PurchaseOrderRepository');
const purchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');
const cashReceiptRepository = require('../repositories/CashReceiptRepository');
const bankReceiptRepository = require('../repositories/BankReceiptRepository');
const cashPaymentRepository = require('../repositories/CashPaymentRepository');
const bankPaymentRepository = require('../repositories/BankPaymentRepository');
const returnRepository = require('../repositories/ReturnRepository');

class AccountLedgerService {
  /**
   * Clamp date range to prevent excessive queries
   * @param {Date|string} start - Start date
   * @param {Date|string} end - End date
   * @param {number} maxDays - Maximum days allowed
   * @param {number} defaultDays - Default days if no dates provided
   * @returns {{start: Date, end: Date}}
   */
  clampDateRange(start, end) {
    let s = start ? new Date(start) : null;
    let e = end ? new Date(end) : null;

    // Determine start/end if only one is provided
    if (!s && !e) {
      // Default to "today" if no dates provided (as per previous request)
      const today = new Date();
      s = new Date(today.setHours(0, 0, 0, 0));
      e = new Date(today.setHours(23, 59, 59, 999));
    } else if (s && !e) {
      // If start provided but no end, default to end of today
      e = new Date();
      e.setHours(23, 59, 59, 999);
    } else if (!s && e) {
      // If end provided but no start, default to 30 days before end
      s = new Date(e);
      s.setDate(e.getDate() - 30);
      s.setHours(0, 0, 0, 0);
    }

    // Ensure start is set to beginning of day and end to end of day
    if (s) s.setHours(0, 0, 0, 0);
    if (e) e.setHours(23, 59, 59, 999);

    // No clamping for maxDays anymore - allow unlimited range
    return { start: s, end: e };
  }

  /**
   * Build filter query from request parameters
   * @param {object} queryParams - Request query parameters
   * @returns {Promise<object>} - MongoDB filter object
   */
  async buildFilter(queryParams) {
    const filter = {};

    // Account code filter
    if (queryParams.accountCode) {
      filter.accountCode = queryParams.accountCode;
    }

    // Date range filter
    const { start, end } = this.clampDateRange(queryParams.startDate, queryParams.endDate);
    if (start || end) {
      filter.createdAt = {};
      if (start) filter.createdAt.$gte = start;
      if (end) filter.createdAt.$lte = end;
    }

    // Account name → map to matching account codes
    if (queryParams.accountName && !queryParams.accountCode) {
      const accountCodes = await chartOfAccountsRepository.getAccountCodesByName(queryParams.accountName);
      if (accountCodes.length > 0) {
        filter.accountCode = { $in: accountCodes };
      } else {
        // No accounts match the name; return empty result
        filter._id = { $in: [] }; // Empty result filter
      }
    }

    // Text search across key fields
    if (queryParams.search) {
      filter.$or = [
        { description: { $regex: queryParams.search, $options: 'i' } },
        { reference: { $regex: queryParams.search, $options: 'i' } },
        { transactionId: { $regex: queryParams.search, $options: 'i' } }
      ];
    }

    return filter;
  }

  /**
   * Get account ledger entries with filtering and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getAccountLedger(queryParams) {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 100;
    const summary = queryParams.summary === 'true';

    const filter = await this.buildFilter(queryParams);

    // Check if filter is empty (no matching accounts)
    if (filter._id && filter._id.$in && filter._id.$in.length === 0) {
      return {
        success: true,
        data: {
          account: null,
          entries: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalEntries: 0,
            entriesPerPage: limit
          },
          summary: {
            openingBalance: 0,
            closingBalance: 0,
            totalDebits: 0,
            totalCredits: 0
          }
        }
      };
    }

    // Get transactions
    const populate = summary ? [] : [
      { path: 'customer.id', select: 'firstName lastName email' },
      { path: 'supplier', select: 'companyName' },
      { path: 'createdBy', select: 'firstName lastName' }
    ];

    const result = await transactionRepository.findWithPagination(filter, {
      page,
      limit,
      sort: { createdAt: 1 },
      populate
    });

    // Get account info if specific account
    let accountInfo = null;
    if (queryParams.accountCode) {
      accountInfo = await chartOfAccountsRepository.findByAccountCode(queryParams.accountCode);
    }

    // Calculate running balance only when specific account is selected
    let runningBalance = accountInfo ? accountInfo.openingBalance || 0 : null;
    const ledgerEntries = result.transactions.map(transaction => {
      const debit = transaction.debitAmount || 0;
      const credit = transaction.creditAmount || 0;

      if (accountInfo && runningBalance !== null) {
        if (accountInfo.normalBalance === 'debit') {
          runningBalance = runningBalance + debit - credit;
        } else {
          runningBalance = runningBalance + credit - debit;
        }
      }

      return {
        ...transaction,
        accountCode: transaction.accountCode || accountInfo?.accountCode,
        accountName: accountInfo?.accountName || '',
        debitAmount: debit,
        creditAmount: credit,
        balance: accountInfo && runningBalance !== null ? runningBalance : undefined,
        source: 'Transaction'
      };
    });

    // Optional supplier name filter (case-insensitive) when populated
    let filteredEntries = ledgerEntries;
    if (queryParams.supplierName) {
      const q = String(queryParams.supplierName).toLowerCase();
      filteredEntries = filteredEntries.filter(t =>
        (t.supplier && (t.supplier.companyName || '').toLowerCase().includes(q))
      );
    }

    // Calculate summary
    const totalDebits = filteredEntries.reduce((sum, e) => sum + (e.debitAmount || 0), 0);
    const totalCredits = filteredEntries.reduce((sum, e) => sum + (e.creditAmount || 0), 0);
    const openingBalance = accountInfo ? accountInfo.openingBalance || 0 : 0;
    const closingBalance = accountInfo && runningBalance !== null
      ? runningBalance
      : openingBalance + totalDebits - totalCredits;

    return {
      success: true,
      data: {
        account: accountInfo,
        entries: filteredEntries,
        pagination: {
          currentPage: page,
          totalPages: result.pagination.pages,
          totalEntries: result.total,
          entriesPerPage: limit
        },
        summary: {
          openingBalance,
          closingBalance,
          totalDebits,
          totalCredits
        }
      }
    };
  }

  /**
   * Get ledger summary for customers and suppliers
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getLedgerSummary(queryParams) {
    try {
      const { startDate, endDate, customerId, supplierId, search } = queryParams;

      // Clamp date range
      const { start, end } = this.clampDateRange(startDate, endDate);

      // Build customer filter
      const customerFilter = {
        status: 'active',
        isDeleted: { $ne: true }
      };

      if (customerId) {
        customerFilter._id = customerId;
      }

      if (search) {
        customerFilter.$or = [
          { businessName: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }

      // Build supplier filter
      const supplierFilter = {
        status: 'active',
        isDeleted: { $ne: true }
      };

      if (supplierId) {
        supplierFilter._id = supplierId;
      }

      if (search) {
        supplierFilter.$or = [
          { companyName: { $regex: search, $options: 'i' } },
          { 'contactPerson.name': { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }

      // Fetch customers and suppliers in parallel (with ledgerAccount populated)
      // Add error handling to prevent one failure from breaking everything
      let customers = [];
      let suppliers = [];

      try {
        [customers, suppliers] = await Promise.all([
          customerRepository.findAll(customerFilter, {
            populate: [{ path: 'ledgerAccount', select: 'accountCode accountName' }],
            lean: true
          }).catch(err => {
            console.error('Error fetching customers:', err);
            return [];
          }),
          supplierRepository.findAll(supplierFilter, {
            populate: [{ path: 'ledgerAccount', select: 'accountCode accountName' }],
            lean: true
          }).catch(err => {
            console.error('Error fetching suppliers:', err);
            return [];
          })
        ]);
      } catch (error) {
        console.error('Error fetching customers/suppliers:', error);
        // Return empty arrays to continue processing
        customers = [];
        suppliers = [];
      }

      // Limit the number of customers/suppliers processed to prevent timeout in production
      // Process in batches if there are too many
      const MAX_ITEMS_TO_PROCESS = 500000;
      if (customers.length > MAX_ITEMS_TO_PROCESS) {
        console.warn(`Too many customers (${customers.length}), processing first ${MAX_ITEMS_TO_PROCESS}`);
        customers = customers.slice(0, MAX_ITEMS_TO_PROCESS);
      }
      if (suppliers.length > MAX_ITEMS_TO_PROCESS) {
        console.warn(`Too many suppliers (${suppliers.length}), processing first ${MAX_ITEMS_TO_PROCESS}`);
        suppliers = suppliers.slice(0, MAX_ITEMS_TO_PROCESS);
      }

      // Process customers with error handling for each
      const customerSummaries = await Promise.all(
        customers.map(async (customer) => {
          try {
            const customerId = customer._id.toString();

            // Get opening balance
            let openingBalance = customer.openingBalance || 0;

            // Calculate adjusted opening balance (transactions before startDate)
            if (start) {
              // Sales before startDate (increases receivables)
              const openingSales = await salesRepository.findAll({
                customer: customerId,
                createdAt: { $lt: start },
                isDeleted: { $ne: true }
              }, { lean: true });

              const openingSalesTotal = openingSales.reduce((sum, sale) => {
                return sum + (sale.pricing?.total || 0);
              }, 0);

              // Cash receipts before startDate (decreases receivables)
              const openingCashReceipts = await cashReceiptRepository.findAll({
                customer: customerId,
                date: { $lt: start }
              }, { lean: true });

              const openingCashReceiptsTotal = openingCashReceipts.reduce((sum, receipt) => {
                return sum + (receipt.amount || 0);
              }, 0);

              // Bank receipts before startDate (decreases receivables)
              const openingBankReceipts = await bankReceiptRepository.findAll({
                customer: customerId,
                date: { $lt: start }
              }, { lean: true });

              const openingBankReceiptsTotal = openingBankReceipts.reduce((sum, receipt) => {
                return sum + (receipt.amount || 0);
              }, 0);

              // Cash payments before startDate (increases receivables/advance - DEBIT)
              const openingCashPayments = await cashPaymentRepository.findAll({
                customer: customerId,
                date: { $lt: start }
              }, { lean: true });

              const openingCashPaymentsTotal = openingCashPayments.reduce((sum, payment) => {
                return sum + (payment.amount || 0);
              }, 0);

              // Bank payments before startDate (increases receivables/advance - DEBIT)
              const openingBankPayments = await bankPaymentRepository.findAll({
                customer: customerId,
                date: { $lt: start }
              }, { lean: true });

              const openingBankPaymentsTotal = openingBankPayments.reduce((sum, payment) => {
                return sum + (payment.amount || 0);
              }, 0);

              // Returns before startDate (decreases receivables - CREDIT)
              // Use returnDate field for filtering
              const openingReturns = await returnRepository.findAll({
                customer: customerId,
                origin: 'sales',
                returnDate: { $lt: start },
                status: { $in: ['completed', 'received', 'approved', 'refunded'] }
              }, { lean: true });

              const openingReturnsTotal = openingReturns.reduce((sum, ret) => {
                return sum + (ret.netRefundAmount || ret.totalRefundAmount || 0);
              }, 0);

              // Adjusted opening balance
              openingBalance = openingBalance + openingSalesTotal + openingCashPaymentsTotal + openingBankPaymentsTotal - openingCashReceiptsTotal - openingBankReceiptsTotal - openingReturnsTotal;
            }

            // Get period transactions (within date range)
            const periodFilter = {};
            if (start || end) {
              periodFilter.createdAt = {};
              if (start) periodFilter.createdAt.$gte = start;
              if (end) periodFilter.createdAt.$lte = end;
            }

            // Sales (DEBITS - increases receivables)
            const sales = await salesRepository.findAll({
              customer: customerId,
              ...periodFilter,
              isDeleted: { $ne: true }
            }, { lean: true });

            const totalDebits = sales.reduce((sum, sale) => {
              return sum + (sale.pricing?.total || 0);
            }, 0);

            // Cash receipts (CREDITS - decreases receivables)
            const receiptDateFilter = {};
            if (start || end) {
              receiptDateFilter.date = {};
              if (start) receiptDateFilter.date.$gte = start;
              if (end) receiptDateFilter.date.$lte = end;
            }

            const cashReceipts = await cashReceiptRepository.findAll({
              customer: customerId,
              ...receiptDateFilter
            }, { lean: true });

            const bankReceipts = await bankReceiptRepository.findAll({
              customer: customerId,
              ...receiptDateFilter
            }, { lean: true });

            // Cash payments (DEBITS - increases receivables/advance)
            const cashPayments = await cashPaymentRepository.findAll({
              customer: customerId,
              ...receiptDateFilter
            }, { lean: true });

            // Bank payments (DEBITS - increases receivables/advance)
            const bankPayments = await bankPaymentRepository.findAll({
              customer: customerId,
              ...receiptDateFilter
            }, { lean: true });

            const cashPaymentsTotal = cashPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
            const bankPaymentsTotal = bankPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

            // Returns (CREDITS - decreases receivables)
            // Use returnDate field for filtering (the actual return date, not creation date)
            const returnDateFilter = {};
            if (start || end) {
              returnDateFilter.returnDate = {};
              if (start) {
                const startDate = new Date(start);
                startDate.setHours(0, 0, 0, 0);
                returnDateFilter.returnDate.$gte = startDate;
              }
              if (end) {
                const endDate = new Date(end);
                endDate.setHours(23, 59, 59, 999);
                returnDateFilter.returnDate.$lte = endDate;
              }
            }

            const returns = await returnRepository.findAll({
              customer: customerId,
              origin: 'sales',
              status: { $in: ['completed', 'received', 'approved', 'refunded'] },
              ...returnDateFilter
            }, { lean: true });

            const returnsTotal = returns.reduce((sum, ret) => sum + (ret.netRefundAmount || ret.totalRefundAmount || 0), 0);

            const totalCredits = cashReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0) +
              bankReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0) +
              returnsTotal;

            // Total debits includes sales and payments to customer
            const totalDebitsWithPayments = totalDebits + cashPaymentsTotal + bankPaymentsTotal;

            // Calculate closing balance
            const closingBalance = openingBalance + totalDebitsWithPayments - totalCredits;

            // Build particular/description
            const particulars = [];
            sales.forEach(sale => {
              if (sale.orderNumber) {
                particulars.push(`Sale: ${sale.orderNumber}`);
              }
            });
            cashReceipts.forEach(receipt => {
              if (receipt.voucherCode) {
                particulars.push(`Cash Receipt: ${receipt.voucherCode}`);
              }
            });
            bankReceipts.forEach(receipt => {
              if (receipt.voucherCode) {
                particulars.push(`Bank Receipt: ${receipt.voucherCode}`);
              }
            });
            returns.forEach(ret => {
              if (ret.returnNumber) {
                particulars.push(`Return: ${ret.returnNumber}`);
              }
            });
            cashPayments.forEach(payment => {
              if (payment.voucherCode) {
                particulars.push(`Cash Payment: ${payment.voucherCode}`);
              }
            });
            bankPayments.forEach(payment => {
              if (payment.voucherCode) {
                particulars.push(`Bank Payment: ${payment.voucherCode}`);
              }
            });

            const particular = particulars.join('; ');
            const transactionCount = sales.length + cashReceipts.length + bankReceipts.length + cashPayments.length + bankPayments.length;

            return {
              id: customer._id,
              accountCode: customer.ledgerAccount?.accountCode || '',
              name: customer.businessName || customer.name || '',
              email: customer.email || '',
              phone: customer.phone || '',
              openingBalance,
              totalDebits: totalDebitsWithPayments,
              totalCredits,
              closingBalance,
              transactionCount,
              particular
            };
          } catch (error) {
            // Log error but don't fail the entire request
            console.error(`Error processing customer ${customer._id}:`, error);
            // Return a minimal summary for this customer
            return {
              id: customer._id,
              accountCode: customer.ledgerAccount?.accountCode || '',
              name: customer.businessName || customer.name || '',
              email: customer.email || '',
              phone: customer.phone || '',
              openingBalance: customer.openingBalance || 0,
              totalDebits: 0,
              totalCredits: 0,
              closingBalance: customer.openingBalance || 0,
              transactionCount: 0,
              particular: 'Error loading transactions'
            };
          }
        })
      );

      // Process suppliers with error handling for each
      const supplierSummaries = await Promise.all(
        suppliers.map(async (supplier) => {
          try {
            const supplierId = supplier._id.toString();

            // Get opening balance
            let openingBalance = supplier.openingBalance || 0;

            // Calculate adjusted opening balance (transactions before startDate)
            if (start) {
              // Purchase Invoices before startDate (increases payables)
              const openingPurchases = await purchaseInvoiceRepository.findAll({
                supplier: supplierId,
                createdAt: { $lt: start },
                status: 'confirmed'
              }, { lean: true });

              const openingPurchasesTotal = openingPurchases.reduce((sum, invoice) => {
                return sum + (invoice.pricing?.total || 0);
              }, 0);

              // Cash payments before startDate (decreases payables)
              const openingCashPayments = await cashPaymentRepository.findAll({
                supplier: supplierId,
                date: { $lt: start }
              }, { lean: true });

              const openingCashPaymentsTotal = openingCashPayments.reduce((sum, payment) => {
                return sum + (payment.amount || 0);
              }, 0);

              // Bank payments before startDate (decreases payables)
              const openingBankPayments = await bankPaymentRepository.findAll({
                supplier: supplierId,
                date: { $lt: start }
              }, { lean: true });

              const openingBankPaymentsTotal = openingBankPayments.reduce((sum, payment) => {
                return sum + (payment.amount || 0);
              }, 0);

              // Cash receipts before startDate (decreases payables - for refunds/advances from supplier)
              const openingCashReceipts = await cashReceiptRepository.findAll({
                supplier: supplierId,
                date: { $lt: start }
              }, { lean: true });

              const openingCashReceiptsTotal = openingCashReceipts.reduce((sum, receipt) => {
                return sum + (receipt.amount || 0);
              }, 0);

              // Bank receipts before startDate (decreases payables - for refunds/advances from supplier)
              const openingBankReceipts = await bankReceiptRepository.findAll({
                supplier: supplierId,
                date: { $lt: start }
              }, { lean: true });

              const openingBankReceiptsTotal = openingBankReceipts.reduce((sum, receipt) => {
                return sum + (receipt.amount || 0);
              }, 0);

              // Returns before startDate (decreases payables - DEBIT)
              // Use returnDate field for filtering
              const openingReturns = await returnRepository.findAll({
                supplier: supplierId,
                origin: 'purchase',
                returnDate: { $lt: start },
                status: { $in: ['completed', 'received', 'approved', 'refunded'] }
              }, { lean: true });

              const openingReturnsTotal = openingReturns.reduce((sum, ret) => {
                return sum + (ret.netRefundAmount || ret.totalRefundAmount || 0);
              }, 0);

              // Adjusted opening balance
              openingBalance = openingBalance + openingPurchasesTotal - openingCashPaymentsTotal - openingBankPaymentsTotal - openingCashReceiptsTotal - openingBankReceiptsTotal - openingReturnsTotal;
            }

            // Get period transactions (within date range)
            const periodFilter = {};
            if (start || end) {
              periodFilter.createdAt = {};
              if (start) periodFilter.createdAt.$gte = start;
              if (end) periodFilter.createdAt.$lte = end;
            }

            // Purchase Invoices (CREDITS - increases payables)
            const purchases = await purchaseInvoiceRepository.findAll({
              supplier: supplierId,
              ...periodFilter,
              status: 'confirmed'
            }, { lean: true });

            const totalCredits = purchases.reduce((sum, invoice) => {
              return sum + (invoice.pricing?.total || 0);
            }, 0);

            // Cash payments (DEBITS - decreases payables)
            const paymentDateFilter = {};
            if (start || end) {
              paymentDateFilter.date = {};
              if (start) paymentDateFilter.date.$gte = start;
              if (end) paymentDateFilter.date.$lte = end;
            }

            const cashPayments = await cashPaymentRepository.findAll({
              supplier: supplierId,
              ...paymentDateFilter
            }, { lean: true });

            const bankPayments = await bankPaymentRepository.findAll({
              supplier: supplierId,
              ...paymentDateFilter
            }, { lean: true });

            // Cash receipts (DEBITS - decreases payables for refunds/advances from supplier)
            const cashReceipts = await cashReceiptRepository.findAll({
              supplier: supplierId,
              ...paymentDateFilter
            }, { lean: true });

            // Bank receipts (DEBITS - decreases payables for refunds/advances from supplier)
            const bankReceipts = await bankReceiptRepository.findAll({
              supplier: supplierId,
              ...paymentDateFilter
            }, { lean: true });

            // Returns (DEBITS - decreases payables)
            // Use returnDate field for filtering
            const returnDateFilter = {};
            if (start || end) {
              returnDateFilter.returnDate = {};
              if (start) {
                const startDate = new Date(start);
                startDate.setHours(0, 0, 0, 0);
                returnDateFilter.returnDate.$gte = startDate;
              }
              if (end) {
                const endDate = new Date(end);
                endDate.setHours(23, 59, 59, 999);
                returnDateFilter.returnDate.$lte = endDate;
              }
            }

            const returns = await returnRepository.findAll({
              supplier: supplierId,
              origin: 'purchase',
              status: { $in: ['completed', 'received', 'approved', 'refunded'] },
              ...returnDateFilter
            }, { lean: true });

            const returnsTotal = returns.reduce((sum, ret) => sum + (ret.netRefundAmount || ret.totalRefundAmount || 0), 0);
            const cashReceiptsTotal = cashReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
            const bankReceiptsTotal = bankReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);

            const totalDebits = cashPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0) +
              bankPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0) +
              cashReceiptsTotal +
              bankReceiptsTotal +
              returnsTotal;

            // Calculate closing balance
            const closingBalance = openingBalance + totalCredits - totalDebits;

            // Build particular/description
            const particulars = [];
            // Add Purchases to particulars
            purchases.forEach(invoice => {
              if (invoice.invoiceNumber) {
                particulars.push(`Purchase: ${invoice.invoiceNumber}`);
              }
            });

            cashPayments.forEach(payment => {
              if (payment.voucherCode) {
                particulars.push(`Cash Payment: ${payment.voucherCode}`);
              }
            });
            bankPayments.forEach(payment => {
              if (payment.voucherCode) {
                particulars.push(`Bank Payment: ${payment.voucherCode}`);
              }
            });
            cashReceipts.forEach(receipt => {
              if (receipt.voucherCode) {
                particulars.push(`Cash Receipt: ${receipt.voucherCode}`);
              }
            });
            bankReceipts.forEach(receipt => {
              if (receipt.voucherCode) {
                particulars.push(`Bank Receipt: ${receipt.voucherCode}`);
              }
            });
            returns.forEach(ret => {
              if (ret.returnNumber) {
                particulars.push(`Return: ${ret.returnNumber}`);
              }
            });

            const particular = particulars.join('; ');
            const transactionCount = purchases.length + cashPayments.length + bankPayments.length + cashReceipts.length + bankReceipts.length + returns.length;

            return {
              id: supplier._id,
              accountCode: supplier.ledgerAccount?.accountCode || '',
              name: supplier.companyName || supplier.contactPerson?.name || '',
              email: supplier.email || '',
              phone: supplier.phone || '',
              openingBalance,
              totalDebits,
              totalCredits,
              closingBalance,
              transactionCount,
              particular
            };
          } catch (error) {
            // Log error but don't fail the entire request
            console.error(`Error processing supplier ${supplier._id}:`, error);
            // Return a minimal summary for this supplier
            return {
              id: supplier._id,
              accountCode: supplier.ledgerAccount?.accountCode || '',
              name: supplier.companyName || supplier.contactPerson?.name || '',
              email: supplier.email || '',
              phone: supplier.phone || '',
              openingBalance: supplier.openingBalance || 0,
              totalDebits: 0,
              totalCredits: 0,
              closingBalance: supplier.openingBalance || 0,
              transactionCount: 0,
              particular: 'Error loading transactions'
            };
          }
        })
      );

      // Filter out null entries
      const filteredCustomerSummaries = customerSummaries.filter(c => c !== null);
      const filteredSupplierSummaries = supplierSummaries.filter(s => s !== null);

      // Calculate totals
      const customerTotals = {
        openingBalance: filteredCustomerSummaries.reduce((sum, c) => sum + (c.openingBalance || 0), 0),
        totalDebits: filteredCustomerSummaries.reduce((sum, c) => sum + (c.totalDebits || 0), 0),
        totalCredits: filteredCustomerSummaries.reduce((sum, c) => sum + (c.totalCredits || 0), 0),
        closingBalance: filteredCustomerSummaries.reduce((sum, c) => sum + (c.closingBalance || 0), 0)
      };

      const supplierTotals = {
        openingBalance: filteredSupplierSummaries.reduce((sum, s) => sum + (s.openingBalance || 0), 0),
        totalDebits: filteredSupplierSummaries.reduce((sum, s) => sum + (s.totalDebits || 0), 0),
        totalCredits: filteredSupplierSummaries.reduce((sum, s) => sum + (s.totalCredits || 0), 0),
        closingBalance: filteredSupplierSummaries.reduce((sum, s) => sum + (s.closingBalance || 0), 0)
      };

      return {
        success: true,
        data: {
          period: {
            startDate: start,
            endDate: end
          },
          customers: {
            summary: filteredCustomerSummaries,
            totals: customerTotals,
            count: filteredCustomerSummaries.length
          },
          suppliers: {
            summary: filteredSupplierSummaries,
            totals: supplierTotals,
            count: filteredSupplierSummaries.length
          }
        }
      };
    } catch (error) {
      // Log the full error for debugging
      console.error('Error in getLedgerSummary:', error);
      console.error('Error stack:', error.stack);
      console.error('Query params:', queryParams);

      // Re-throw with more context
      throw new Error(`Failed to load ledger summary: ${error.message}`);
    }
  }
}

module.exports = new AccountLedgerService();

