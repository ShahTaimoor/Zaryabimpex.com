const { query } = require('../config/postgres');
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
const returnRepository = require('../repositories/postgres/ReturnRepository');

class AccountLedgerService {
  async appendBankNameToEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return entries;

    const bankReceiptIds = entries
      .filter(e => (e.referenceType || e.source) === 'bank_receipt' && e.referenceId)
      .map(e => e.referenceId);
    const bankPaymentIds = entries
      .filter(e => (e.referenceType || e.source) === 'bank_payment' && e.referenceId)
      .map(e => e.referenceId);

    const bankNameByReceiptId = new Map();
    const bankNameByPaymentId = new Map();

    if (bankReceiptIds.length > 0) {
      const receiptResult = await query(
        `SELECT br.id, b.bank_name AS "bankName"
         FROM bank_receipts br
         LEFT JOIN banks b ON br.bank_id = b.id
         WHERE br.id = ANY($1::uuid[])`,
        [bankReceiptIds]
      );
      receiptResult.rows.forEach(row => {
        if (row.bankName) bankNameByReceiptId.set(row.id, row.bankName);
      });
    }

    if (bankPaymentIds.length > 0) {
      const paymentResult = await query(
        `SELECT bp.id, b.bank_name AS "bankName"
         FROM bank_payments bp
         LEFT JOIN banks b ON bp.bank_id = b.id
         WHERE bp.id = ANY($1::uuid[])`,
        [bankPaymentIds]
      );
      paymentResult.rows.forEach(row => {
        if (row.bankName) bankNameByPaymentId.set(row.id, row.bankName);
      });
    }

    return entries.map(entry => {
      const bankName =
        (entry.referenceType || entry.source) === 'bank_receipt'
          ? bankNameByReceiptId.get(entry.referenceId)
          : (entry.referenceType || entry.source) === 'bank_payment'
            ? bankNameByPaymentId.get(entry.referenceId)
            : null;
      if (!bankName) return entry;
      const suffix = ` (Bank: ${bankName})`;
      const particular = entry.particular || entry.description || '';
      const description = entry.description || '';
      return {
        ...entry,
        particular: particular.includes(suffix) ? particular : `${particular}${suffix}`,
        description: description ? (description.includes(suffix) ? description : `${description}${suffix}`) : description
      };
    });
  }
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
    let ledgerEntries = result.transactions.map(transaction => {
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

    // Enrich bank receipt/payment entries with bank name in description
    const bankReceiptIds = ledgerEntries
      .filter(e => e.referenceType === 'bank_receipt' && e.referenceId)
      .map(e => e.referenceId);
    const bankPaymentIds = ledgerEntries
      .filter(e => e.referenceType === 'bank_payment' && e.referenceId)
      .map(e => e.referenceId);

    const bankNameByReceiptId = new Map();
    const bankNameByPaymentId = new Map();

    if (bankReceiptIds.length > 0) {
      const receiptResult = await query(
        `SELECT br.id, b.bank_name AS "bankName"
         FROM bank_receipts br
         LEFT JOIN banks b ON br.bank_id = b.id
         WHERE br.id = ANY($1::uuid[])`,
        [bankReceiptIds]
      );
      receiptResult.rows.forEach(row => {
        if (row.bankName) bankNameByReceiptId.set(row.id, row.bankName);
      });
    }

    if (bankPaymentIds.length > 0) {
      const paymentResult = await query(
        `SELECT bp.id, b.bank_name AS "bankName"
         FROM bank_payments bp
         LEFT JOIN banks b ON bp.bank_id = b.id
         WHERE bp.id = ANY($1::uuid[])`,
        [bankPaymentIds]
      );
      paymentResult.rows.forEach(row => {
        if (row.bankName) bankNameByPaymentId.set(row.id, row.bankName);
      });
    }

    if (bankNameByReceiptId.size > 0 || bankNameByPaymentId.size > 0) {
      ledgerEntries = ledgerEntries.map(entry => {
        const bankName =
          entry.referenceType === 'bank_receipt'
            ? bankNameByReceiptId.get(entry.referenceId)
            : entry.referenceType === 'bank_payment'
              ? bankNameByPaymentId.get(entry.referenceId)
              : null;
        if (!bankName) return entry;
        const suffix = ` (Bank: ${bankName})`;
        const desc = entry.description || '';
        return desc.includes(suffix)
          ? entry
          : { ...entry, description: `${desc}${suffix}` };
      });
    }

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
        customerFilter.id = customerId; // PostgreSQL
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
        isActive: true
      };

      if (supplierId) {
        supplierFilter.id = supplierId; // PostgreSQL uses 'id'
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

      // Ensure we never process undefined items (e.g. sparse array or bad repo response)
      customers = customers.filter(Boolean);
      suppliers = suppliers.filter(Boolean);

      // Process customers with error handling for each (support both id and _id for PostgreSQL/MongoDB)
      const customerSummaries = await Promise.all(
        customers.map(async (customer) => {
          try {
            const rawId = customer?.id ?? customer?._id;
            if (rawId == null) return null;
            const customerId = typeof rawId === 'string' ? rawId : (rawId && typeof rawId.toString === 'function' ? rawId.toString() : String(rawId));

            // Get opening balance from customer record (support snake_case from Postgres)
            let openingBalance = parseFloat(customer.opening_balance ?? customer.openingBalance ?? 0) || 0;

            // Calculate adjusted opening balance from ledger entries before startDate
            // SINGLE SOURCE OF TRUTH: Read from account_ledger table only
            // Only AR (1100) entries affect customer receivable balance. Sale Return Cr AR is in 1100.
            if (start) {
              const openingLedgerEntries = await transactionRepository.findAll({
                customerId,
                transactionDate: { $lt: start },
                status: 'completed',
                accountCode: '1100'
              }, { lean: true });

              // For AR accounts: debit increases balance, credit decreases balance
              const openingLedgerBalance = openingLedgerEntries.reduce((sum, entry) => {
                return sum + (entry.debitAmount || 0) - (entry.creditAmount || 0);
              }, 0);

              openingBalance = openingBalance + openingLedgerBalance;
            }

            // Get period transactions from ledger (within date range)
            // SINGLE SOURCE OF TRUTH: Read from account_ledger table only
            // Only AR (1100) entries - Sale Return posts Cr AR to 1100, which correctly reduces balance
            const periodLedgerFilter = {
              customerId,
              status: 'completed',
              accountCode: '1100'
            };
            if (start) periodLedgerFilter.transactionDate = { $gte: start };
            if (end) {
              if (!periodLedgerFilter.transactionDate) periodLedgerFilter.transactionDate = {};
              periodLedgerFilter.transactionDate.$lte = end;
            }

            const periodLedgerEntries = await transactionRepository.findAll(periodLedgerFilter, { lean: true });

            // Calculate totals from ledger entries
            const totalDebits = periodLedgerEntries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0);
            const totalCredits = periodLedgerEntries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0);
            const returnTotal = periodLedgerEntries
              .filter(e => (e.referenceType || e.source) === 'Sale Return')
              .reduce((sum, entry) => sum + (entry.creditAmount || 0), 0);

            // Total debits includes all debit entries (sales, payments to customer, etc.)
            const totalDebitsWithPayments = totalDebits;

            // Calculate closing balance
            const closingBalance = openingBalance + totalDebitsWithPayments - totalCredits;

            // Build particular/description from ledger entries
            // SINGLE SOURCE OF TRUTH: Use reference_number from ledger entries
            const particulars = [];
            periodLedgerEntries.forEach(entry => {
              if (entry.referenceNumber) {
                const refType = entry.referenceType || 'Transaction';
                particulars.push(`${refType}: ${entry.referenceNumber}`);
              } else if (entry.description) {
                particulars.push(entry.description);
              }
            });

            const particular = particulars.join('; ');
            const transactionCount = periodLedgerEntries.length;

            // Build line-item entries for single-customer detail view (DATE, VOUCHER NO, PARTICULAR, DEBITS, CREDITS, BALANCE)
            // SINGLE SOURCE OF TRUTH: Read from account_ledger table only
            let entries = [];
            if (customerId && String(customer?.id ?? customer?._id) === String(customerId)) {
              // Sort entries by transaction date
              const sortedEntries = [...periodLedgerEntries].sort((a, b) => {
                const dateA = new Date(a.transactionDate || a.createdAt || 0);
                const dateB = new Date(b.transactionDate || b.createdAt || 0);
                return dateA - dateB;
              });

              let running = openingBalance;
              entries = sortedEntries.map(entry => {
                running += (entry.debitAmount || 0) - (entry.creditAmount || 0);
                return {
                  date: entry.transactionDate || entry.createdAt,
                  voucherNo: entry.referenceNumber || entry.transactionId || entry.id,
                  particular: entry.description || `${entry.referenceType || 'Transaction'}: ${entry.referenceNumber || entry.id}`,
                  debitAmount: entry.debitAmount || 0,
                  creditAmount: entry.creditAmount || 0,
                  referenceId: entry.referenceId,
                  source: entry.referenceType || 'Ledger',
                  balance: running
                };
              });
              entries = await this.appendBankNameToEntries(entries);
            }

            const displayName = customer.business_name ?? customer.businessName ?? customer.name ?? '';
            return {
              id: customer?.id ?? customer?._id,
              accountCode: customer.ledgerAccount?.accountCode || '',
              name: displayName,
              business_name: customer.business_name,
              businessName: customer.business_name ?? customer.businessName,
              email: customer.email || '',
              phone: customer.phone || '',
              openingBalance,
              totalDebits: totalDebitsWithPayments,
              totalCredits,
              returnTotal,
              closingBalance,
              transactionCount,
              particular,
              entries
            };
          } catch (error) {
            // Log error but don't fail the entire request
            const custId = customer?.id ?? customer?._id ?? 'unknown';
            console.error(`Error processing customer ${custId}:`, error);
            // Return a minimal summary for this customer
            const errDisplayName = customer.business_name ?? customer.businessName ?? customer.name ?? '';
            return {
              id: customer?.id ?? customer?._id,
              accountCode: customer.ledgerAccount?.accountCode || '',
              name: errDisplayName,
              business_name: customer.business_name,
              businessName: customer.business_name ?? customer.businessName,
              email: customer.email || '',
              phone: customer.phone || '',
              openingBalance: parseFloat(customer.opening_balance ?? customer.openingBalance ?? 0) || 0,
              totalDebits: 0,
              totalCredits: 0,
              returnTotal: 0,
              closingBalance: parseFloat(customer.opening_balance ?? customer.openingBalance ?? 0) || 0,
              transactionCount: 0,
              particular: 'Error loading transactions',
              entries: []
            };
          }
        })
      );

      // Process suppliers with error handling for each (support both id and _id for PostgreSQL/MongoDB)
      const supplierSummaries = await Promise.all(
        suppliers.map(async (supplier) => {
          try {
            const rawId = supplier?.id ?? supplier?._id;
            if (rawId == null) return null;
            const supplierId = typeof rawId === 'string' ? rawId : String(rawId);

            // Opening balance from ledger only (supplier opening balance is posted to ledger)
            let openingBalance = 0;
            if (start) {
              const openingLedgerEntries = await transactionRepository.findAll({
                supplierId,
                accountCode: '2000', // Only AP account entries
                transactionDate: { $lt: start },
                status: 'completed'
              }, { lean: true });

              // For AP accounts: credit increases balance, debit decreases balance
              openingBalance = openingLedgerEntries.reduce((sum, entry) => {
                return sum + (entry.creditAmount || 0) - (entry.debitAmount || 0);
              }, 0);
            }

            // Get period transactions from ledger (within date range)
            // SINGLE SOURCE OF TRUTH: Read from account_ledger table only
            // Filter by AP account code (2000) to show only Accounts Payable entries
            const periodLedgerFilter = {
              supplierId,
              accountCode: '2000', // Only AP account entries
              status: 'completed'
            };
            if (start) periodLedgerFilter.transactionDate = { $gte: start };
            if (end) {
              if (!periodLedgerFilter.transactionDate) periodLedgerFilter.transactionDate = {};
              periodLedgerFilter.transactionDate.$lte = end;
            }

            const periodLedgerEntries = await transactionRepository.findAll(periodLedgerFilter, { lean: true });
            
            // Debug logging to help diagnose missing transactions
            if (periodLedgerEntries.length === 0 && supplierId) {
              console.log(`[DEBUG] No transactions found for supplier ${supplierId} with filters:`, {
                supplierId,
                accountCode: '2000',
                status: 'completed',
                dateRange: { start, end }
              });
              
              // Check if transactions exist without date filter
              const allEntriesCheck = await transactionRepository.findAll({
                supplierId,
                accountCode: '2000',
                status: 'completed'
              }, { lean: true });
              
              if (allEntriesCheck.length > 0) {
                console.log(`[DEBUG] Found ${allEntriesCheck.length} transactions without date filter. Sample dates:`, 
                  allEntriesCheck.slice(0, 3).map(e => ({
                    transactionDate: e.transactionDate,
                    createdAt: e.createdAt,
                    referenceNumber: e.referenceNumber
                  }))
                );
              } else {
                console.log(`[DEBUG] No transactions found even without date filter. Checking all entries for supplier...`);
                const allSupplierEntries = await transactionRepository.findAll({
                  supplierId
                }, { lean: true });
                console.log(`[DEBUG] Total entries for supplier (any account): ${allSupplierEntries.length}`);
                if (allSupplierEntries.length > 0) {
                  console.log(`[DEBUG] Sample entries:`, allSupplierEntries.slice(0, 3).map(e => ({
                    accountCode: e.accountCode,
                    status: e.status,
                    transactionDate: e.transactionDate,
                    referenceNumber: e.referenceNumber
                  })));
                }
              }
            }

            // Calculate totals from ledger entries
            // For AP accounts: credits increase payables, debits decrease payables
            const totalCredits = periodLedgerEntries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0);
            const totalDebits = periodLedgerEntries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0);

            // Calculate closing balance
            const closingBalance = openingBalance + totalCredits - totalDebits;

            // Build particular/description from ledger entries
            // SINGLE SOURCE OF TRUTH: Use reference_number from ledger entries
            const particulars = [];
            periodLedgerEntries.forEach(entry => {
              if (entry.referenceNumber) {
                const refType = entry.referenceType || 'Transaction';
                particulars.push(`${refType}: ${entry.referenceNumber}`);
              } else if (entry.description) {
                particulars.push(entry.description);
              }
            });

            const particular = particulars.join('; ');
            const transactionCount = periodLedgerEntries.length;

            // Build line-item entries for single-supplier detail view (DATE, VOUCHER NO, PARTICULAR, DEBITS, CREDITS, BALANCE)
            // SINGLE SOURCE OF TRUTH: Read from account_ledger table only
            let entries = [];
            if (supplierId && String(supplier?.id ?? supplier?._id) === String(supplierId)) {
              // Sort entries by transaction date
              const sortedEntries = [...periodLedgerEntries].sort((a, b) => {
                const dateA = new Date(a.transactionDate || a.createdAt || 0);
                const dateB = new Date(b.transactionDate || b.createdAt || 0);
                return dateA - dateB;
              });

              let running = openingBalance;
              entries = sortedEntries.map(entry => {
                // For AP accounts: credits increase balance, debits decrease balance
                running += (entry.creditAmount || 0) - (entry.debitAmount || 0);
                return {
                  date: entry.transactionDate || entry.createdAt,
                  voucherNo: entry.referenceNumber || entry.transactionId || entry.id,
                  particular: entry.description || `${entry.referenceType || 'Transaction'}: ${entry.referenceNumber || entry.id}`,
                  debitAmount: entry.debitAmount || 0,
                  creditAmount: entry.creditAmount || 0,
                  referenceId: entry.referenceId,
                  source: entry.referenceType || 'Ledger',
                  balance: running
                };
              });
              entries = await this.appendBankNameToEntries(entries);
            }

            return {
              id: supplier?.id ?? supplier?._id,
              accountCode: supplier.ledgerAccount?.accountCode || '',
              name: supplier.companyName || supplier.contactPerson?.name || '',
              email: supplier.email || '',
              phone: supplier.phone || '',
              openingBalance,
              totalDebits,
              totalCredits,
              closingBalance,
              transactionCount,
              particular,
              entries
            };
          } catch (error) {
            // Log error but don't fail the entire request
            console.error(`Error processing supplier ${supplier?.id ?? supplier?._id}:`, error);
            // Return a minimal summary for this supplier
            return {
              id: supplier?.id ?? supplier?._id,
              accountCode: supplier.ledgerAccount?.accountCode || '',
              name: supplier.companyName || supplier.contactPerson?.name || '',
              email: supplier.email || '',
              phone: supplier.phone || '',
              openingBalance: parseFloat(supplier.opening_balance ?? supplier.openingBalance ?? 0) || 0,
              totalDebits: 0,
              totalCredits: 0,
              closingBalance: parseFloat(supplier.opening_balance ?? supplier.openingBalance ?? 0) || 0,
              transactionCount: 0,
              particular: 'Error loading transactions',
              entries: []
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
        returnTotal: filteredCustomerSummaries.reduce((sum, c) => sum + (c.returnTotal || 0), 0),
        closingBalance: filteredCustomerSummaries.reduce((sum, c) => sum + (c.closingBalance || 0), 0)
      };

      const supplierTotals = {
        openingBalance: filteredSupplierSummaries.reduce((sum, s) => sum + (s.openingBalance || 0), 0),
        totalDebits: filteredSupplierSummaries.reduce((sum, s) => sum + (s.totalDebits || 0), 0),
        totalCredits: filteredSupplierSummaries.reduce((sum, s) => sum + (s.totalCredits || 0), 0),
        closingBalance: filteredSupplierSummaries.reduce((sum, s) => sum + (s.closingBalance || 0), 0)
      };

      const data = {
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
      };

      // When a single customer is requested, add the shape the frontend expects for "Customer Receivables" detail view
      if (customerId && filteredCustomerSummaries.length === 1) {
        const one = filteredCustomerSummaries[0];
        data.openingBalance = one.openingBalance ?? 0;
        data.closingBalance = one.closingBalance ?? one.openingBalance ?? 0;
        data.returnTotal = one.returnTotal ?? 0;
        data.customer = {
          id: one.id,
          name: (one.business_name ?? one.businessName ?? one.name) || '',
          accountCode: one.accountCode || ''
        };
        data.entries = Array.isArray(one.entries) ? one.entries : [];
      }

      // When a single supplier is requested, add the shape the frontend expects for supplier detail view
      if (supplierId && filteredSupplierSummaries.length === 1) {
        const one = filteredSupplierSummaries[0];
        data.openingBalance = one.openingBalance ?? 0;
        data.closingBalance = one.closingBalance ?? one.openingBalance ?? 0;
        data.supplier = {
          id: one.id,
          name: one.name || '',
          accountCode: one.accountCode || ''
        };
        data.entries = Array.isArray(one.entries) ? one.entries : [];
      }

      return {
        success: true,
        data
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

