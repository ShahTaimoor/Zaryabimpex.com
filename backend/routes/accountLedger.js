const express = require('express');
const { auth, requirePermission } = require('../middleware/auth');
const { query, param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const exportService = require('../services/exportService');
const accountLedgerService = require('../services/accountLedgerService');
const chartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const transactionRepository = require('../repositories/TransactionRepository');
const cashReceiptRepository = require('../repositories/CashReceiptRepository');
const cashPaymentRepository = require('../repositories/CashPaymentRepository');
const bankReceiptRepository = require('../repositories/BankReceiptRepository');
const bankPaymentRepository = require('../repositories/BankPaymentRepository');
const customerRepository = require('../repositories/CustomerRepository');
const supplierRepository = require('../repositories/SupplierRepository');
const salesRepository = require('../repositories/SalesRepository');
const purchaseOrderRepository = require('../repositories/PurchaseOrderRepository');
const purchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/**
 * @route   GET /api/account-ledger
 * @desc    Get account ledger with all transactions for all accounts
 * @access  Private
 */
router.get('/', [
  auth,
  requirePermission('view_reports'),
  ...validateDateParams,
  query('accountCode').optional().isString().withMessage('Invalid account code'),
  query('accountName').optional().isString().withMessage('Invalid account name'),
  query('search').optional().isString().withMessage('Invalid search text'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1'),
  query('export').optional().isIn(['csv', 'excel', 'xlsx', 'pdf', 'json']).withMessage('Export format must be csv, excel, pdf, or json'),
  handleValidationErrors,
  processDateFilter('createdAt'),
], async (req, res) => {
  try {
    const {
      accountCode,
      accountName,
      search,
      supplierName,
      summary,
      export: exportFormat,
      limit = 100,
      page = 1
    } = req.query;

    // Use dateRange from middleware (Pakistan timezone)
    const queryParams = {
      accountCode,
      accountName,
      search,
      supplierName,
      summary,
      limit,
      page
    };

    if (req.dateRange) {
      queryParams.startDate = req.dateRange.startDate || undefined;
      queryParams.endDate = req.dateRange.endDate || undefined;
    }

    // Get account ledger data from service
    const result = await accountLedgerService.getAccountLedger(queryParams);

    // If export requested, handle it
    if (exportFormat) {
      const { account: accountInfo, entries: ledgerEntries, summary: ledgerSummary } = result.data;
      const { start, end } = accountLedgerService.clampDateRange(
        queryParams.startDate,
        queryParams.endDate
      );

      // Export functionality (CSV, Excel, PDF, JSON)
      try {
        const headers = ['Date', 'Account Code', 'Account Name', 'Description', 'Reference', 'Debit', 'Credit', 'Balance', 'Source'];
        const rows = ledgerEntries.map(e => [
          exportService.formatDate(e.createdAt || e.date, 'datetime'),
          e.accountCode || accountInfo?.accountCode || '',
          e.accountName || accountInfo?.accountName || '',
          e.description || '',
          e.reference || '',
          e.debitAmount || 0,
          e.creditAmount || 0,
          accountInfo ? (e.balance || 0) : '',
          e.source || 'Transaction'
        ]);

        const accountLabel = accountInfo ? `${accountInfo.accountCode}-${accountInfo.accountName}` : 'all-accounts';
        const dateRange = start && end
          ? `${exportService.formatDate(start)}_to_${exportService.formatDate(end)}`
          : 'all-time';

        if (exportFormat === 'csv') {
          const filename = exportService.generateFilename(`account-ledger-${accountLabel}`, 'csv');
          const filepath = await exportService.exportToCSV(rows, headers, filename);

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.sendFile(path.resolve(filepath));

          // Clean up file after sending (optional, or use cron job)
          setTimeout(() => {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          }, 60000); // Delete after 1 minute
          return;
        }

        if (exportFormat === 'excel' || exportFormat === 'xlsx') {
          const filename = exportService.generateFilename(`account-ledger-${accountLabel}`, 'xlsx');
          const title = `Account Ledger - ${accountInfo ? `${accountInfo.accountCode} ${accountInfo.accountName}` : 'All Accounts'}`;
          const subtitle = start && end
            ? `Period: ${exportService.formatDate(start)} to ${exportService.formatDate(end)}`
            : null;

          await exportService.exportToExcel(rows, {
            headers,
            sheetName: 'Account Ledger',
            filename,
            title,
            subtitle
          });

          const filepath = path.join(exportService.exportDir, filename);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.sendFile(path.resolve(filepath));

          setTimeout(() => {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          }, 60000);
          return;
        }

        if (exportFormat === 'pdf') {
          const filename = exportService.generateFilename(`account-ledger-${accountLabel}`, 'pdf');
          const title = `Account Ledger - ${accountInfo ? `${accountInfo.accountCode} ${accountInfo.accountName}` : 'All Accounts'}`;
          const subtitle = start && end
            ? `Period: ${exportService.formatDate(start)} to ${exportService.formatDate(end)}`
            : null;

          await exportService.exportToPDF(rows, {
            headers,
            filename,
            title,
            subtitle
          });

          const filepath = path.join(exportService.exportDir, filename);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.sendFile(path.resolve(filepath));

          setTimeout(() => {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          }, 60000);
          return;
        }

        if (exportFormat === 'json') {
          const exportData = {
            account: accountInfo,
            period: {
              startDate: start,
              endDate: end
            },
            summary: {
              openingBalance: accountInfo ? (accountInfo.openingBalance || 0) : 0,
              closingBalance: accountInfo && runningBalance !== null ? runningBalance : (ledgerEntries.reduce((sum, e) => sum + (e.debitAmount - e.creditAmount), 0)),
              totalDebits: ledgerEntries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0),
              totalCredits: ledgerEntries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0),
              totalEntries: ledgerEntries.length
            },
            entries: ledgerEntries.map(e => ({
              date: e.createdAt || e.date,
              accountCode: e.accountCode || accountInfo?.accountCode,
              accountName: e.accountName || accountInfo?.accountName,
              description: e.description,
              reference: e.reference,
              debitAmount: e.debitAmount || 0,
              creditAmount: e.creditAmount || 0,
              balance: e.balance,
              source: e.source
            }))
          };

          const filename = exportService.generateFilename(`account-ledger-${accountLabel}`, 'json');
          const filepath = await exportService.exportToJSON(exportData, { filename, pretty: true });

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.sendFile(path.resolve(filepath));

          setTimeout(() => {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          }, 60000);
          return;
        }
      } catch (error) {
        console.error('Export error:', error);
        return res.status(500).json({
          success: false,
          message: 'Export failed',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }

    // Return the result from service
    res.json(result);

  } catch (error) {
    console.error('Error fetching account ledger:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/account-ledger/accounts
 * @desc    Get list of all accounts with balances
 * @access  Private
 */
router.get('/accounts', [
  auth,
  requirePermission('view_reports'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter for transactions
    const dateFilter = {};
    if (startDate || endDate) {
      const { start, end } = accountLedgerService.clampDateRange(startDate, endDate);
      if (start || end) {
        dateFilter.createdAt = {};
        if (start) dateFilter.createdAt.$gte = start;
        if (end) dateFilter.createdAt.$lte = end;
      }
    }

    // Get all accounts
    const accounts = await chartOfAccountsRepository.findAll({ isActive: true }, {
      sort: { accountCode: 1 },
      lean: true
    });

    // Use aggregation to get transaction summary for all accounts at once (fixes N+1 problem)
    const transactionFilter = Object.keys(dateFilter).length > 0 ? dateFilter : {};
    const transactionSummary = await transactionRepository.getSummary(transactionFilter, '$accountCode');

    // Create a map for quick lookup
    const summaryMap = {};
    transactionSummary.forEach(summary => {
      summaryMap[summary._id] = {
        totalDebits: summary.totalDebits || 0,
        totalCredits: summary.totalCredits || 0,
        transactionCount: summary.count || 0,
        lastActivity: summary.lastActivity || null
      };
    });

    // Calculate balances for each account
    const accountsWithBalances = accounts.map(account => {
      const summary = summaryMap[account.accountCode] || {
        totalDebits: 0,
        totalCredits: 0,
        transactionCount: 0,
        lastActivity: null
      };

      // Calculate balance based on normal balance type
      let balance = account.openingBalance || 0;
      if (account.normalBalance === 'debit') {
        balance = balance + summary.totalDebits - summary.totalCredits;
      } else {
        balance = balance + summary.totalCredits - summary.totalDebits;
      }

      return {
        ...account,
        currentBalance: balance,
        totalDebits: summary.totalDebits,
        totalCredits: summary.totalCredits,
        transactionCount: summary.transactionCount,
        lastActivity: summary.lastActivity
      };
    });

    // Group by account type
    const groupedAccounts = accountsWithBalances.reduce((acc, account) => {
      if (!acc[account.accountType]) {
        acc[account.accountType] = [];
      }
      acc[account.accountType].push(account);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        accounts: accountsWithBalances,
        groupedAccounts,
        summary: {
          totalAccounts: accountsWithBalances.length,
          assetAccounts: accountsWithBalances.filter(a => a.accountType === 'asset').length,
          liabilityAccounts: accountsWithBalances.filter(a => a.accountType === 'liability').length,
          equityAccounts: accountsWithBalances.filter(a => a.accountType === 'equity').length,
          revenueAccounts: accountsWithBalances.filter(a => a.accountType === 'revenue').length,
          expenseAccounts: accountsWithBalances.filter(a => a.accountType === 'expense').length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/account-ledger/all-entries
 * @desc    Get all accounting entries from all sources (comprehensive ledger)
 * @access  Private
 */
router.get('/all-entries', [
  auth,
  requirePermission('view_reports'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('accountCode').optional().isString().withMessage('Invalid account code'),
  query('accountName').optional().isString().withMessage('Invalid account name'),
  query('export').optional().isIn(['csv', 'excel', 'xlsx', 'pdf', 'json']).withMessage('Export format must be csv, excel, pdf, or json')
], async (req, res) => {
  try {
    const { startDate, endDate, accountCode, accountName, export: exportFormat } = req.query;


    const { start, end } = accountLedgerService.clampDateRange(startDate, endDate);
    const dateFilter = {};
    if (start) dateFilter.$gte = start;
    if (end) dateFilter.$lte = end;

    // Resolve cash/bank codes dynamically
    const { cashCode, bankCode } = await chartOfAccountsRepository.resolveCashBankCodes();

    // Get all entries from different sources
    const allEntries = [];

    // 1. Get Cash Receipts
    const cashReceiptFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};
    const cashReceipts = await cashReceiptRepository.findAll(cashReceiptFilter, {
      populate: [
        { path: 'customer', select: 'firstName lastName' },
        { path: 'createdBy', select: 'firstName lastName' }
      ],
      lean: true
    });

    cashReceipts.forEach(receipt => {
      // Only include if no specific account code requested OR requested code matches cash code
      if (!accountCode || (cashCode && accountCode === cashCode)) {
        const entryDate = receipt.createdAt || receipt.date || new Date();
        allEntries.push({
          date: entryDate,
          datetime: new Date(entryDate).getTime(), // For precise sorting
          accountCode: cashCode || 'UNASSIGNED_CASH',
          accountName: 'Cash',
          description: `Cash Receipt: ${receipt.particular}`,
          reference: receipt.voucherCode,
          debitAmount: receipt.amount,
          creditAmount: 0,
          source: 'Cash Receipt',
          sourceId: receipt._id,
          customer: receipt.customer ? `${receipt.customer.firstName} ${receipt.customer.lastName}` : '',
          createdBy: receipt.createdBy ? `${receipt.createdBy.firstName} ${receipt.createdBy.lastName}` : ''
        });
      }
    });

    // 2. Get Cash Payments
    const cashPayments = await cashPaymentRepository.findAll(cashReceiptFilter, {
      populate: [
        { path: 'supplier', select: 'name' },
        { path: 'createdBy', select: 'firstName lastName' }
      ],
      lean: true
    });

    cashPayments.forEach(payment => {
      if (!accountCode || (cashCode && accountCode === cashCode)) {
        const entryDate = payment.createdAt || payment.date || new Date();
        allEntries.push({
          date: entryDate,
          datetime: new Date(entryDate).getTime(), // For precise sorting
          accountCode: cashCode || 'UNASSIGNED_CASH',
          accountName: 'Cash',
          description: `Cash Payment: ${payment.particular}`,
          reference: payment.voucherCode,
          debitAmount: 0,
          creditAmount: payment.amount,
          source: 'Cash Payment',
          sourceId: payment._id,
          supplier: payment.supplier ? payment.supplier.name : '',
          createdBy: payment.createdBy ? `${payment.createdBy.firstName} ${payment.createdBy.lastName}` : ''
        });
      }
    });

    // 3. Get Bank Receipts
    const bankReceipts = await bankReceiptRepository.findAll(cashReceiptFilter, {
      populate: [
        { path: 'customer', select: 'firstName lastName' },
        { path: 'createdBy', select: 'firstName lastName' }
      ],
      lean: true
    });

    bankReceipts.forEach(receipt => {
      // Only include if no specific account code requested OR requested code matches bank code
      // If bankCode is null, we only include if no specific account code requested
      if (!accountCode || (bankCode && accountCode === bankCode)) {
        const entryDate = receipt.createdAt || receipt.date || new Date();
        allEntries.push({
          date: entryDate,
          datetime: new Date(entryDate).getTime(), // For precise sorting
          accountCode: bankCode || 'UNASSIGNED_BANK',
          accountName: 'Bank',
          description: `Bank Receipt: ${receipt.particular}`,
          reference: receipt.transactionReference,
          debitAmount: receipt.amount,
          creditAmount: 0,
          source: 'Bank Receipt',
          sourceId: receipt._id,
          customer: receipt.customer ? `${receipt.customer.firstName} ${receipt.customer.lastName}` : '',
          createdBy: receipt.createdBy ? `${receipt.createdBy.firstName} ${receipt.createdBy.lastName}` : ''
        });
      }
    });

    // 4. Get Bank Payments
    const bankPayments = await bankPaymentRepository.findAll(cashReceiptFilter, {
      populate: [
        { path: 'supplier', select: 'name' },
        { path: 'createdBy', select: 'firstName lastName' }
      ],
      lean: true
    });

    bankPayments.forEach(payment => {
      if (!accountCode || (bankCode && accountCode === bankCode)) {
        const entryDate = payment.createdAt || payment.date || new Date();
        allEntries.push({
          date: entryDate,
          datetime: new Date(entryDate).getTime(), // For precise sorting
          accountCode: bankCode || 'UNASSIGNED_BANK',
          accountName: 'Bank',
          description: `Bank Payment: ${payment.particular}`,
          reference: payment.transactionReference,
          debitAmount: 0,
          creditAmount: payment.amount,
          source: 'Bank Payment',
          sourceId: payment._id,
          supplier: payment.supplier ? payment.supplier.name : '',
          createdBy: payment.createdBy ? `${payment.createdBy.firstName} ${payment.createdBy.lastName}` : ''
        });
      }
    });

    // 5. Get Transaction model entries (main accounting entries)
    const transactionFilter = {};
    if (Object.keys(dateFilter).length > 0) {
      transactionFilter.createdAt = dateFilter;
    }
    if (accountCode) {
      transactionFilter.accountCode = accountCode;
    }

    const transactions = await transactionRepository.findAll(transactionFilter, {
      populate: [
        { path: 'customer.id', select: 'firstName lastName businessName' },
        { path: 'supplier', select: 'companyName contactPerson' },
        { path: 'createdBy', select: 'firstName lastName' }
      ],
      lean: true
    });

    // Get account names for transaction entries
    const transactionAccountCodes = [...new Set(transactions.map(t => t.accountCode).filter(Boolean))];
    const accountMap = {};
    if (transactionAccountCodes.length > 0) {
      const accounts = await chartOfAccountsRepository.findAll({
        accountCode: { $in: transactionAccountCodes }
      }, {
        select: 'accountCode accountName',
        lean: true
      });
      accounts.forEach(acc => {
        accountMap[acc.accountCode] = acc.accountName;
      });
    }

    transactions.forEach(transaction => {
      if (transaction.accountCode && transaction.debitAmount >= 0 && transaction.creditAmount >= 0) {
        const customerName = transaction.customer?.id
          ? (transaction.customer.id.businessName || `${transaction.customer.id.firstName || ''} ${transaction.customer.id.lastName || ''}`.trim())
          : '';
        const supplierName = transaction.supplier
          ? (transaction.supplier.companyName || transaction.supplier.contactPerson?.name || '')
          : '';
        const createdByName = transaction.createdBy
          ? `${transaction.createdBy.firstName || ''} ${transaction.createdBy.lastName || ''}`.trim()
          : '';

        const entryDate = transaction.createdAt || transaction.date || new Date();
        allEntries.push({
          date: entryDate,
          datetime: new Date(entryDate).getTime(), // For precise sorting
          accountCode: transaction.accountCode,
          accountName: accountMap[transaction.accountCode] || transaction.accountCode,
          description: transaction.description || `${transaction.type || 'Transaction'}: ${transaction.transactionId || ''}`,
          reference: transaction.reference || transaction.transactionId || '',
          debitAmount: transaction.debitAmount || 0,
          creditAmount: transaction.creditAmount || 0,
          source: 'Transaction',
          sourceId: transaction._id,
          customer: customerName,
          supplier: supplierName,
          createdBy: createdByName
        });
      }
    });

    // Add datetime field to all entries that don't have it for consistent sorting
    allEntries.forEach(entry => {
      if (!entry.datetime) {
        entry.datetime = new Date(entry.date).getTime();
      }
    });

    // Sort all entries by datetime (chronological order - step by step)
    allEntries.sort((a, b) => {
      // First sort by datetime (includes time)
      const dateDiff = (a.datetime || new Date(a.date).getTime()) - (b.datetime || new Date(b.date).getTime());
      if (dateDiff !== 0) return dateDiff;
      // If same datetime, sort by source type for consistency
      const sourceOrder = { 'Cash Receipt': 1, 'Bank Receipt': 2, 'Cash Payment': 3, 'Bank Payment': 4, 'Transaction': 5, 'Sale': 6 };
      return (sourceOrder[a.source] || 99) - (sourceOrder[b.source] || 99);
    });

    // Filter entries by account name if provided
    let filteredEntries = allEntries;


    if (accountName) {
      filteredEntries = filteredEntries.filter(entry => {
        const accountMatch = entry.accountName && entry.accountName.toLowerCase().includes(accountName.toLowerCase());
        const customerMatch = entry.customer && entry.customer.toLowerCase().includes(accountName.toLowerCase());
        const supplierMatch = entry.supplier && entry.supplier.toLowerCase().includes(accountName.toLowerCase());
        const descriptionMatch = entry.description && entry.description.toLowerCase().includes(accountName.toLowerCase());

        const matches = accountMatch || customerMatch || supplierMatch || descriptionMatch;
        return matches;
      });
    }

    // Get account info and calculate opening balance if specific account
    let accountInfo = null;
    let openingBalance = 0;

    if (accountCode) {
      accountInfo = await chartOfAccountsRepository.findByAccountCode(accountCode);
      if (accountInfo) {
        openingBalance = accountInfo.openingBalance || 0;

        // Calculate opening balance up to start date if date range is provided
        if (start) {
          const openingTransactions = await transactionRepository.getSummary({
            accountCode: accountCode,
            createdAt: { $lt: start }
          }, null);

          if (openingTransactions.length > 0) {
            const opening = openingTransactions[0];
            if (accountInfo.normalBalance === 'debit') {
              openingBalance = openingBalance + opening.totalDebits - opening.totalCredits;
            } else {
              openingBalance = openingBalance + opening.totalCredits - opening.totalDebits;
            }
          }
        }
      }
    }

    // Calculate running balance based on account normal balance
    let runningBalance = openingBalance;
    const entriesWithBalance = filteredEntries.map(entry => {
      if (accountInfo && accountInfo.normalBalance === 'credit') {
        // Credit normal balance: balance increases with credits, decreases with debits
        runningBalance = runningBalance + entry.creditAmount - entry.debitAmount;
      } else {
        // Debit normal balance (default): balance increases with debits, decreases with credits
        runningBalance = runningBalance + entry.debitAmount - entry.creditAmount;
      }
      return {
        ...entry,
        balance: runningBalance
      };
    });

    // Export functionality (CSV, Excel, PDF, JSON)
    if (exportFormat) {
      try {
        const headers = ['Date', 'Account Code', 'Account Name', 'Description', 'Reference', 'Debit', 'Credit', 'Balance', 'Source', 'Customer', 'Supplier'];
        const rows = entriesWithBalance.map(e => [
          exportService.formatDate(e.date, 'datetime'),
          e.accountCode || '',
          e.accountName || '',
          e.description || '',
          e.reference || '',
          e.debitAmount || 0,
          e.creditAmount || 0,
          e.balance || 0,
          e.source || '',
          e.customer || '',
          e.supplier || ''
        ]);

        const accountLabel = accountInfo ? `${accountInfo.accountCode}-${accountInfo.accountName}` : 'all-accounts';
        const dateLabel = start && end
          ? `${exportService.formatDate(start)}_to_${exportService.formatDate(end)}`
          : 'all-time';

        if (exportFormat === 'csv') {
          const filename = exportService.generateFilename(`account-ledger-${accountLabel}-${dateLabel}`, 'csv');
          const filepath = await exportService.exportToCSV(rows, headers, filename);

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.sendFile(path.resolve(filepath));

          setTimeout(() => {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          }, 60000);
          return;
        }

        if (exportFormat === 'excel' || exportFormat === 'xlsx') {
          const filename = exportService.generateFilename(`account-ledger-${accountLabel}-${dateLabel}`, 'xlsx');
          const title = `Account Ledger - ${accountInfo ? `${accountInfo.accountCode} ${accountInfo.accountName}` : 'All Accounts'}`;
          const subtitle = start && end
            ? `Period: ${exportService.formatDate(start)} to ${exportService.formatDate(end)}`
            : null;

          await exportService.exportToExcel(rows, {
            headers,
            sheetName: 'Account Ledger',
            filename,
            title,
            subtitle
          });

          const filepath = path.join(exportService.exportDir, filename);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.sendFile(path.resolve(filepath));

          setTimeout(() => {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          }, 60000);
          return;
        }

        if (exportFormat === 'pdf') {
          const filename = exportService.generateFilename(`account-ledger-${accountLabel}-${dateLabel}`, 'pdf');
          const title = `Account Ledger - ${accountInfo ? `${accountInfo.accountCode} ${accountInfo.accountName}` : 'All Accounts'}`;
          const subtitle = start && end
            ? `Period: ${exportService.formatDate(start)} to ${exportService.formatDate(end)}`
            : null;

          await exportService.exportToPDF(rows, {
            headers,
            filename,
            title,
            subtitle,
            pageSize: 'A4',
            margin: 30
          });

          const filepath = path.join(exportService.exportDir, filename);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.sendFile(path.resolve(filepath));

          setTimeout(() => {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          }, 60000);
          return;
        }

        if (exportFormat === 'json') {
          const exportData = {
            account: accountInfo,
            period: {
              startDate: start,
              endDate: end
            },
            summary: {
              openingBalance: openingBalance,
              closingBalance: runningBalance,
              totalDebits: entriesWithBalance.reduce((sum, entry) => sum + entry.debitAmount, 0),
              totalCredits: entriesWithBalance.reduce((sum, entry) => sum + entry.creditAmount, 0),
              totalEntries: entriesWithBalance.length
            },
            entries: entriesWithBalance.map(e => ({
              date: e.date,
              accountCode: e.accountCode,
              accountName: e.accountName,
              description: e.description,
              reference: e.reference,
              debitAmount: e.debitAmount || 0,
              creditAmount: e.creditAmount || 0,
              balance: e.balance,
              source: e.source,
              customer: e.customer,
              supplier: e.supplier,
              createdBy: e.createdBy
            }))
          };

          const filename = exportService.generateFilename(`account-ledger-${accountLabel}-${dateLabel}`, 'json');
          const filepath = await exportService.exportToJSON(exportData, { filename, pretty: true });

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.sendFile(path.resolve(filepath));

          setTimeout(() => {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          }, 60000);
          return;
        }
      } catch (error) {
        console.error('Export error:', error);
        return res.status(500).json({
          success: false,
          message: 'Export failed',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }

    res.json({
      success: true,
      data: {
        account: accountInfo,
        entries: entriesWithBalance,
        summary: {
          openingBalance: openingBalance,
          totalEntries: entriesWithBalance.length,
          totalDebits: entriesWithBalance.reduce((sum, entry) => sum + entry.debitAmount, 0),
          totalCredits: entriesWithBalance.reduce((sum, entry) => sum + entry.creditAmount, 0),
          closingBalance: runningBalance
        }
      }
    });

  } catch (error) {
    console.error('Error fetching all ledger entries:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/account-ledger/summary
 * @desc    Get ledger summary for customers and suppliers
 * @access  Private
 */
router.get('/summary', [
  auth,
  requirePermission('view_reports'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('customerId').optional().isMongoId().withMessage('Invalid customer ID'),
  query('supplierId').optional().isMongoId().withMessage('Invalid supplier ID'),
  query('search').optional().isString().withMessage('Invalid search query')
], async (req, res) => {
  try {
    const { startDate, endDate, customerId, supplierId, search } = req.query;

    // Set headers to prevent caching - ensure fresh data on every request
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Call service method to get ledger summary
    const result = await accountLedgerService.getLedgerSummary({
      startDate,
      endDate,
      customerId,
      supplierId,
      search
    });

    res.json(result);
  } catch (error) {
    console.error('Get ledger summary error:', error);
    console.error('Error stack:', error.stack);

    // Provide more detailed error information in production logs
    const errorDetails = {
      message: error.message,
      name: error.name,
      ...(error.code && { code: error.code }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    };

    res.status(500).json({
      success: false,
      message: 'Error loading ledger summary. Please try again or contact support if the issue persists.',
      error: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    });
  }
});

/**
 * @route   GET /api/account-ledger/customer/:customerId/transactions
 * @desc    Get detailed transactions for a customer
 * @access  Private
 */
router.get('/customer/:customerId/transactions', [
  auth,
  requirePermission('view_reports'),
  param('customerId').isMongoId().withMessage('Invalid customer ID'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;

    const { start, end } = accountLedgerService.clampDateRange(startDate, endDate);

    // Get customer
    const customer = await customerRepository.findById(customerId, {
      populate: [{ path: 'ledgerAccount', select: 'accountCode accountName normalBalance' }]
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const accountCode = customer.ledgerAccount?.accountCode;
    if (!accountCode) {
      return res.json({
        success: true,
        data: {
          customer: {
            _id: customer._id,
            name: customer.businessName || customer.name,
            accountCode: ''
          },
          entries: [],
          openingBalance: 0,
          closingBalance: 0
        }
      });
    }

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
      const Return = require('../models/Return');
      const openingReturns = await Return.find({
        customer: customerId,
        origin: 'sales',
        returnDate: { $lt: start },
        status: { $in: ['pending', 'completed', 'received', 'approved', 'refunded', 'processing'] }
      }).lean();

      const openingReturnsTotal = openingReturns.reduce((sum, ret) => {
        return sum + (ret.netRefundAmount || ret.totalRefundAmount || 0);
      }, 0);

      // Adjusted opening balance
      openingBalance = openingBalance + openingSalesTotal + openingCashPaymentsTotal + openingBankPaymentsTotal - openingCashReceiptsTotal - openingBankReceiptsTotal - openingReturnsTotal;
    }

    // Build date filters
    const salesDateFilter = {};
    const receiptDateFilter = {};
    const paymentDateFilter = {};
    const returnDateFilter = {};

    if (start || end) {
      if (start) {
        // Set start to beginning of day
        const startOfDay = new Date(start);
        startOfDay.setHours(0, 0, 0, 0);
        salesDateFilter.createdAt = { $gte: startOfDay };
        receiptDateFilter.date = { $gte: startOfDay };
        paymentDateFilter.date = { $gte: startOfDay };
        returnDateFilter.returnDate = { $gte: startOfDay };
      }
      if (end) {
        // Set end to end of day (add 1 day and set to start, then use $lt)
        const endOfDay = new Date(end);
        endOfDay.setDate(endOfDay.getDate() + 1);
        endOfDay.setHours(0, 0, 0, 0);
        if (salesDateFilter.createdAt) {
          salesDateFilter.createdAt.$lt = endOfDay;
        } else {
          salesDateFilter.createdAt = { $lt: endOfDay };
        }
        if (receiptDateFilter.date) {
          receiptDateFilter.date.$lt = endOfDay;
        } else {
          receiptDateFilter.date = { $lt: endOfDay };
        }
        if (paymentDateFilter.date) {
          paymentDateFilter.date.$lt = endOfDay;
        } else {
          paymentDateFilter.date = { $lt: endOfDay };
        }
        if (returnDateFilter.returnDate) {
          returnDateFilter.returnDate.$lt = endOfDay;
        } else {
          returnDateFilter.returnDate = { $lt: endOfDay };
        }
      }
    }

    // Fetch all transactions in parallel
    const Return = require('../models/Return');
    const [sales, cashReceipts, bankReceipts, cashPayments, bankPayments, returns] = await Promise.all([
      salesRepository.findAll({
        customer: customerId,
        ...salesDateFilter,
        isDeleted: { $ne: true }
      }, { lean: true, sort: { createdAt: 1 } }),
      cashReceiptRepository.findAll({
        customer: customerId,
        ...receiptDateFilter
      }, { lean: true, sort: { date: 1 } }),
      bankReceiptRepository.findAll({
        customer: customerId,
        ...receiptDateFilter
      }, { lean: true, sort: { date: 1 } }),
      cashPaymentRepository.findAll({
        customer: customerId,
        ...paymentDateFilter
      }, { lean: true, sort: { date: 1 } }),
      bankPaymentRepository.findAll({
        customer: customerId,
        ...paymentDateFilter
      }, { lean: true, sort: { date: 1 } }),
      Return.find({
        customer: customerId,
        origin: 'sales',
        status: { $in: ['pending', 'completed', 'received', 'approved', 'refunded', 'processing'] },
        ...returnDateFilter
      }).lean().sort({ returnDate: 1 })
    ]);

    // Combine all transactions into a single array
    const allEntries = [];

    // Add sales (DEBITS - increases receivables)
    sales.forEach(sale => {
      const saleTotal = sale.pricing?.total || sale.total || 0;
      if (saleTotal > 0) { // Only add sales with positive amounts
        // Use createdAt for precise datetime (includes time)
        const entryDate = sale.createdAt || sale.date || new Date();
        allEntries.push({
          date: entryDate,
          datetime: new Date(entryDate).getTime(), // For precise sorting
          voucherNo: sale.orderNumber || '',
          particular: `Sale: ${sale.orderNumber || sale._id}`,
          debitAmount: saleTotal,
          creditAmount: 0,
          source: 'Sale',
          referenceId: sale._id?.toString?.() || sale._id
        });
      }
    });

    // Add cash receipts (CREDITS - decreases receivables)
    cashReceipts.forEach(receipt => {
      // Prefer createdAt for time precision, fallback to date
      const entryDate = receipt.createdAt || receipt.date || new Date();
      allEntries.push({
        date: entryDate,
        datetime: new Date(entryDate).getTime(), // For precise sorting
        voucherNo: receipt.voucherCode || '',
        particular: receipt.particular || `Cash Receipt: ${receipt.voucherCode || receipt._id}`,
        debitAmount: 0,
        creditAmount: receipt.amount || 0,
        source: 'Cash Receipt',
        referenceId: receipt._id?.toString?.() || receipt._id
      });
    });

    // Add bank receipts (CREDITS - decreases receivables)
    bankReceipts.forEach(receipt => {
      // Prefer createdAt for time precision, fallback to date
      const entryDate = receipt.createdAt || receipt.date || new Date();
      allEntries.push({
        date: entryDate,
        datetime: new Date(entryDate).getTime(), // For precise sorting
        voucherNo: receipt.voucherCode || receipt.transactionReference || '',
        particular: receipt.particular || `Bank Receipt: ${receipt.voucherCode || receipt._id}`,
        debitAmount: 0,
        creditAmount: receipt.amount || 0,
        source: 'Bank Receipt',
        referenceId: receipt._id?.toString?.() || receipt._id
      });
    });

    // Add cash payments (DEBITS - increases receivables/advance)
    cashPayments.forEach(payment => {
      // Prefer createdAt for time precision, fallback to date
      const entryDate = payment.createdAt || payment.date || new Date();
      allEntries.push({
        date: entryDate,
        datetime: new Date(entryDate).getTime(), // For precise sorting
        voucherNo: payment.voucherCode || '',
        particular: payment.particular || `Cash Payment: ${payment.voucherCode || payment._id}`,
        debitAmount: payment.amount || 0,
        creditAmount: 0,
        source: 'Cash Payment',
        referenceId: payment._id?.toString?.() || payment._id
      });
    });

    // Add bank payments (DEBITS - increases receivables/advance)
    bankPayments.forEach(payment => {
      // Prefer createdAt for time precision, fallback to date
      const entryDate = payment.createdAt || payment.date || new Date();
      allEntries.push({
        date: entryDate,
        datetime: new Date(entryDate).getTime(), // For precise sorting
        voucherNo: payment.voucherCode || payment.transactionReference || '',
        particular: payment.particular || `Bank Payment: ${payment.voucherCode || payment._id}`,
        debitAmount: payment.amount || 0,
        creditAmount: 0,
        source: 'Bank Payment',
        referenceId: payment._id?.toString?.() || payment._id
      });
    });

    // Add returns (CREDITS - decreases receivables)
    returns.forEach(returnItem => {
      const returnAmount = returnItem.netRefundAmount || returnItem.totalRefundAmount || 0;
      // Include returns even if amount is 0 (for pending returns that haven't calculated amounts yet)
      // Use returnDate for the entry date
      const entryDate = returnItem.returnDate || returnItem.createdAt || new Date();
      allEntries.push({
        date: entryDate,
        datetime: new Date(entryDate).getTime(), // For precise sorting
        voucherNo: returnItem.returnNumber || '',
        particular: `Return: ${returnItem.returnNumber || returnItem._id}${returnItem.status === 'pending' ? ' (Pending)' : ''}`,
        debitAmount: 0,
        creditAmount: returnAmount,
        source: 'Sale Return',
        referenceId: returnItem._id?.toString?.() || returnItem._id
      });
    });

    // Sort all entries by datetime (chronological order - step by step)
    allEntries.sort((a, b) => {
      // First sort by datetime (includes time)
      const dateDiff = (a.datetime || new Date(a.date).getTime()) - (b.datetime || new Date(b.date).getTime());
      if (dateDiff !== 0) return dateDiff;
      // If same datetime, sort by source type for consistency
      const sourceOrder = { 'Cash Receipt': 1, 'Bank Receipt': 2, 'Sale Return': 3, 'Cash Payment': 4, 'Bank Payment': 5, 'Sale': 6 };
      return (sourceOrder[a.source] || 99) - (sourceOrder[b.source] || 99);
    });

    // Calculate running balance
    let runningBalance = openingBalance;
    const entries = allEntries.map(entry => {
      // For customers (receivables), debit increases balance, credit decreases
      runningBalance = runningBalance + entry.debitAmount - entry.creditAmount;

      return {
        date: entry.date,
        voucherNo: entry.voucherNo,
        particular: entry.particular,
        debitAmount: entry.debitAmount,
        creditAmount: entry.creditAmount,
        balance: runningBalance,
        source: entry.source,
        referenceId: entry.referenceId
      };
    });

    res.json({
      success: true,
      data: {
        customer: {
          _id: customer._id,
          name: customer.businessName || customer.name,
          accountCode: accountCode
        },
        entries,
        openingBalance,
        closingBalance: runningBalance
      }
    });
  } catch (error) {
    console.error('Get customer transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/account-ledger/supplier/:supplierId/transactions
 * @desc    Get detailed transactions for a supplier
 * @access  Private
 */
router.get('/supplier/:supplierId/transactions', [
  auth,
  requirePermission('view_reports'),
  param('supplierId').isMongoId().withMessage('Invalid supplier ID'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { startDate, endDate } = req.query;

    const { start, end } = accountLedgerService.clampDateRange(startDate, endDate);

    // Get supplier
    const supplier = await supplierRepository.findById(supplierId, {
      populate: [{ path: 'ledgerAccount', select: 'accountCode accountName normalBalance' }]
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const accountCode = supplier.ledgerAccount?.accountCode;
    if (!accountCode) {
      return res.json({
        success: true,
        data: {
          supplier: {
            _id: supplier._id,
            name: supplier.companyName || supplier.contactPerson?.name,
            accountCode: ''
          },
          entries: [],
          openingBalance: 0,
          closingBalance: 0
        }
      });
    }

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

      // Purchase returns before startDate (decreases payables)
      const Return = require('../models/Return');
      const openingReturns = await Return.find({
        supplier: supplierId,
        origin: 'purchase',
        returnDate: { $lt: start },
        status: { $in: ['pending', 'completed', 'received', 'approved', 'refunded', 'processing'] }
      }).lean();

      const openingReturnsTotal = openingReturns.reduce((sum, ret) => {
        return sum + (ret.netRefundAmount || ret.totalRefundAmount || 0);
      }, 0);

      // Adjusted opening balance
      openingBalance = openingBalance + openingPurchasesTotal - openingCashPaymentsTotal - openingBankPaymentsTotal - openingCashReceiptsTotal - openingBankReceiptsTotal - openingReturnsTotal;
    }

    // Build date filters
    const purchaseDateFilter = {};
    const paymentDateFilter = {};
    const receiptDateFilter = {};
    const returnDateFilter = {};

    if (start || end) {
      if (start) {
        // Set start to beginning of day
        const startOfDay = new Date(start);
        startOfDay.setHours(0, 0, 0, 0);
        purchaseDateFilter.createdAt = { $gte: startOfDay };
        paymentDateFilter.date = { $gte: startOfDay };
        receiptDateFilter.date = { $gte: startOfDay };
        returnDateFilter.returnDate = { $gte: startOfDay };
      }
      if (end) {
        // Set end to end of day (add 1 day and set to start, then use $lt)
        const endOfDay = new Date(end);
        endOfDay.setDate(endOfDay.getDate() + 1);
        endOfDay.setHours(0, 0, 0, 0);
        if (purchaseDateFilter.createdAt) {
          purchaseDateFilter.createdAt.$lt = endOfDay;
        } else {
          purchaseDateFilter.createdAt = { $lt: endOfDay };
        }
        if (paymentDateFilter.date) {
          paymentDateFilter.date.$lt = endOfDay;
        } else {
          paymentDateFilter.date = { $lt: endOfDay };
        }
        if (receiptDateFilter.date) {
          receiptDateFilter.date.$lt = endOfDay;
        } else {
          receiptDateFilter.date = { $lt: endOfDay };
        }
        if (returnDateFilter.returnDate) {
          returnDateFilter.returnDate.$lt = endOfDay;
        } else {
          returnDateFilter.returnDate = { $lt: endOfDay };
        }
      }
    }

    // Fetch all transactions in parallel
    const Return = require('../models/Return');
    const [purchases, cashPayments, bankPayments, cashReceipts, bankReceipts, returns] = await Promise.all([
      purchaseInvoiceRepository.findAll({
        supplier: supplierId,
        ...purchaseDateFilter,
        status: 'confirmed'
      }, { lean: true, sort: { createdAt: 1 } }),
      cashPaymentRepository.findAll({
        supplier: supplierId,
        ...paymentDateFilter
      }, { lean: true, sort: { date: 1 } }),
      bankPaymentRepository.findAll({
        supplier: supplierId,
        ...paymentDateFilter
      }, { lean: true, sort: { date: 1 } }),
      cashReceiptRepository.findAll({
        supplier: supplierId,
        ...receiptDateFilter
      }, { lean: true, sort: { date: 1 } }),
      bankReceiptRepository.findAll({
        supplier: supplierId,
        ...receiptDateFilter
      }, { lean: true, sort: { date: 1 } }),
      Return.find({
        supplier: supplierId,
        origin: 'purchase',
        status: { $in: ['pending', 'completed', 'received', 'approved', 'refunded', 'processing'] },
        ...returnDateFilter
      }).lean().sort({ returnDate: 1 })
    ]);

    // Combine all transactions into a single array
    const allEntries = [];

    // Add purchases (CREDITS - increases payables)
    purchases.forEach(invoice => {
      const invoiceTotal = invoice.pricing?.total || 0;
      if (invoiceTotal > 0) {
        const entryDate = invoice.createdAt || invoice.date || new Date();
        allEntries.push({
          date: entryDate,
          datetime: new Date(entryDate).getTime(),
          voucherNo: invoice.invoiceNumber || '',
          particular: `Purchase: ${invoice.invoiceNumber || invoice._id}`,
          debitAmount: 0,
          creditAmount: invoiceTotal,
          source: 'Purchase',
          referenceId: invoice._id?.toString?.() || invoice._id
        });
      }
    });

    // Add cash payments (DEBITS - decreases payables)
    cashPayments.forEach(payment => {
      // Prefer createdAt for time precision, fallback to date
      const entryDate = payment.createdAt || payment.date || new Date();
      allEntries.push({
        date: entryDate,
        datetime: new Date(entryDate).getTime(), // For precise sorting
        voucherNo: payment.voucherCode || '',
        particular: payment.particular || `Cash Payment: ${payment.voucherCode || payment._id}`,
        debitAmount: payment.amount || 0,
        creditAmount: 0,
        source: 'Cash Payment',
        referenceId: payment._id?.toString?.() || payment._id
      });
    });

    // Add bank payments (DEBITS - decreases payables)
    bankPayments.forEach(payment => {
      // Prefer createdAt for time precision, fallback to date
      const entryDate = payment.createdAt || payment.date || new Date();
      allEntries.push({
        date: entryDate,
        datetime: new Date(entryDate).getTime(), // For precise sorting
        voucherNo: payment.voucherCode || payment.transactionReference || '',
        particular: payment.particular || `Bank Payment: ${payment.voucherCode || payment._id}`,
        debitAmount: payment.amount || 0,
        creditAmount: 0,
        source: 'Bank Payment',
        referenceId: payment._id?.toString?.() || payment._id
      });
    });

    // Add cash receipts (DEBITS - decreases payables for refunds/advances from supplier)
    cashReceipts.forEach(receipt => {
      // Prefer createdAt for time precision, fallback to date
      const entryDate = receipt.createdAt || receipt.date || new Date();
      allEntries.push({
        date: entryDate,
        datetime: new Date(entryDate).getTime(), // For precise sorting
        voucherNo: receipt.voucherCode || '',
        particular: receipt.particular || `Cash Receipt: ${receipt.voucherCode || receipt._id}`,
        debitAmount: receipt.amount || 0,
        creditAmount: 0,
        source: 'Cash Receipt',
        referenceId: receipt._id?.toString?.() || receipt._id
      });
    });

    // Add bank receipts (DEBITS - decreases payables for refunds/advances from supplier)
    bankReceipts.forEach(receipt => {
      // Prefer createdAt for time precision, fallback to date
      const entryDate = receipt.createdAt || receipt.date || new Date();
      allEntries.push({
        date: entryDate,
        datetime: new Date(entryDate).getTime(), // For precise sorting
        voucherNo: receipt.voucherCode || receipt.transactionReference || '',
        particular: receipt.particular || `Bank Receipt: ${receipt.voucherCode || receipt._id}`,
        debitAmount: receipt.amount || 0,
        creditAmount: 0,
        source: 'Bank Receipt',
        referenceId: receipt._id?.toString?.() || receipt._id
      });
    });

    // Add purchase returns (DEBITS - decreases payables)
    returns.forEach(returnItem => {
      const returnAmount = returnItem.netRefundAmount || returnItem.totalRefundAmount || 0;
      // Use returnDate for the entry date
      const entryDate = returnItem.returnDate || returnItem.createdAt || new Date();
      allEntries.push({
        date: entryDate,
        datetime: new Date(entryDate).getTime(), // For precise sorting
        voucherNo: returnItem.returnNumber || '',
        particular: `Purchase Return: ${returnItem.returnNumber || returnItem._id}${returnItem.status === 'pending' ? ' (Pending)' : ''}`,
        debitAmount: returnAmount,
        creditAmount: 0,
        source: 'Purchase Return',
        referenceId: returnItem._id?.toString?.() || returnItem._id
      });
    });

    // Sort all entries by datetime (chronological order - step by step)
    allEntries.sort((a, b) => {
      // First sort by datetime (includes time)
      const dateDiff = (a.datetime || new Date(a.date).getTime()) - (b.datetime || new Date(b.date).getTime());
      if (dateDiff !== 0) return dateDiff;
      // If same datetime, sort by source type for consistency
      const sourceOrder = { 'Cash Payment': 1, 'Bank Payment': 2, 'Cash Receipt': 3, 'Bank Receipt': 4, 'Purchase Return': 5, 'Purchase': 0 };
      return (sourceOrder[a.source] || 99) - (sourceOrder[b.source] || 99);
    });

    // Calculate running balance
    let runningBalance = openingBalance;
    const entries = allEntries.map(entry => {
      // For suppliers (payables), credit increases balance, debit decreases
      runningBalance = runningBalance + entry.creditAmount - entry.debitAmount;

      return {
        date: entry.date,
        voucherNo: entry.voucherNo,
        particular: entry.particular,
        debitAmount: entry.debitAmount,
        creditAmount: entry.creditAmount,
        balance: runningBalance,
        source: entry.source,
        referenceId: entry.referenceId
      };
    });

    res.json({
      success: true,
      data: {
        supplier: {
          _id: supplier._id,
          name: supplier.companyName || supplier.contactPerson?.name,
          accountCode: accountCode
        },
        entries,
        openingBalance,
        closingBalance: runningBalance
      }
    });
  } catch (error) {
    console.error('Get supplier transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

