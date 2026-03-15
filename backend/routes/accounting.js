const express = require('express');
const { query, param, body } = require('express-validator');
const AccountingService = require('../services/accountingService');
const financialValidationService = require('../services/financialValidationService');
const Transaction = require('../models/Transaction');
const ChartOfAccounts = require('../models/ChartOfAccounts');
const BalanceSheet = require('../models/BalanceSheet');
const transactionRepository = require('../repositories/TransactionRepository');
const chartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const { auth, requirePermission, requireAnyPermission } = require('../middleware/auth');

const router = express.Router();

// Get all transactions with filtering and pagination
router.get('/transactions', [
  auth,
  requireAnyPermission(['view_accounting_transactions', 'view_reports', 'view_general_reports']),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('accountCode').optional().isString().trim(),
  query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
  query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
  query('type').optional().isIn(['sale', 'refund', 'void', 'adjustment', 'tip', 'discount']),
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'declined'])
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      accountCode,
      dateFrom,
      dateTo,
      type,
      status,
      search
    } = req.query;

    // Build query
    const query = {};
    
    if (accountCode) {
      query.accountCode = accountCode;
    }
    
    if (dateFrom || dateTo) {
      query.transactionDate = {};
      if (dateFrom) query.transactionDate.$gte = new Date(dateFrom);
      if (dateTo) query.transactionDate.$lte = new Date(dateTo);
    }
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } }
      ];
    }

    const parsedPage = parseInt(page) || 1;
    const parsedLimit = parseInt(limit) || 50;
    const skip = (parsedPage - 1) * parsedLimit;
    
    const result = await transactionRepository.findWithPagination(query, {
      page: parsedPage,
      limit: parsedLimit,
      sort: { transactionDate: -1 },
      populate: [
        { path: 'orderId', select: 'orderNumber' },
        { path: 'customer', select: 'name businessName' },
        { path: 'supplier', select: 'companyName' },
        { path: 'createdBy', select: 'firstName lastName' }
      ]
    });
    
    const transactions = result.transactions;
    const total = result.total;
    
    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          current: parsedPage,
          pages: Math.ceil(total / parsedLimit),
          total,
          hasNext: parsedPage < Math.ceil(total / parsedLimit),
          hasPrev: parsedPage > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get account balance
router.get('/accounts/:accountCode/balance', [
  auth,
  requireAnyPermission(['view_accounting_accounts', 'view_reports', 'view_general_reports']),
  param('accountCode').isString().trim().withMessage('Account code is required'),
  query('asOfDate').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const { accountCode } = req.params;
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
    
    const balance = await AccountingService.getAccountBalance(accountCode, asOfDate);
    
    res.json({
      success: true,
      data: {
        accountCode,
        balance,
        asOfDate
      }
    });
  } catch (error) {
    console.error('Error getting account balance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Validate double-entry integrity (all transaction groups must have Debits = Credits)
router.get('/ledger-integrity', [
  auth,
  requireAnyPermission(['view_reports', 'view_general_reports', 'view_accounting_transactions']),
  query('asOfDate').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : null;
    const result = await financialValidationService.validateLedgerDoubleEntry(asOfDate);
    res.json({
      success: true,
      data: {
        valid: result.valid,
        message: result.message,
        unbalancedGroups: result.unbalancedGroups || [],
        asOfDate: asOfDate || undefined
      }
    });
  } catch (error) {
    console.error('Error validating ledger integrity:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get trial balance
router.get('/trial-balance', [
  auth,
  requireAnyPermission(['view_trial_balance', 'view_pl_statements', 'view_reports']),
  query('asOfDate').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
    
    const trialBalance = await AccountingService.getTrialBalance(asOfDate);
    
    // Calculate totals
    const totalDebits = trialBalance.reduce((sum, account) => sum + account.debitBalance, 0);
    const totalCredits = trialBalance.reduce((sum, account) => sum + account.creditBalance, 0);
    
    res.json({
      success: true,
      data: {
        trialBalance,
        totals: {
          totalDebits,
          totalCredits,
          difference: totalDebits - totalCredits,
          isBalanced: totalDebits === totalCredits
        },
        asOfDate
      }
    });
  } catch (error) {
    console.error('Error generating trial balance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update balance sheet
router.post('/balance-sheet/update', [
  auth,
  requireAnyPermission(['update_balance_sheet', 'manage_reports']),
  body('statementDate').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const statementDate = req.body.statementDate ? new Date(req.body.statementDate) : new Date();
    
    const balanceSheet = await AccountingService.updateBalanceSheet(statementDate);
    
    res.json({
      success: true,
      message: 'Balance sheet updated successfully',
      data: balanceSheet
    });
  } catch (error) {
    console.error('Error updating balance sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get chart of accounts with balances
router.get('/chart-of-accounts', [
  auth,
  requireAnyPermission(['view_chart_of_accounts', 'view_reports', 'view_general_reports']),
  query('includeBalances').optional().isBoolean(),
  query('asOfDate').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const includeBalances = req.query.includeBalances === 'true';
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
    
    const accounts = await chartOfAccountsRepository.findAll({ isActive: true }, {
      sort: { accountCode: 1 }
    });
    
    let accountsWithBalances = accounts;
    
    if (includeBalances) {
      accountsWithBalances = await Promise.all(
        accounts.map(async (account) => {
          const balance = await AccountingService.getAccountBalance(account.accountCode, asOfDate);
          return {
            ...account.toObject(),
            currentBalance: balance
          };
        })
      );
    }
    
    res.json({
      success: true,
      data: {
        accounts: accountsWithBalances,
        asOfDate,
        includeBalances
      }
    });
  } catch (error) {
    console.error('Error fetching chart of accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get financial summary
router.get('/financial-summary', [
  auth,
  requireAnyPermission(['view_accounting_summary', 'view_reports']),
  query('asOfDate').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
    
    // Get key account balances
    const cashBalance = await AccountingService.getAccountBalance('1001', asOfDate);
    const bankBalance = await AccountingService.getAccountBalance('1002', asOfDate);
    const accountsReceivable = await AccountingService.getAccountBalance('1201', asOfDate);
    const accountsPayable = await AccountingService.getAccountBalance('2001', asOfDate);
    const salesRevenue = await AccountingService.getAccountBalance('4001', asOfDate);
    const expenses = await AccountingService.getAccountBalance('5001', asOfDate);
    
    const summary = {
      assets: {
        cash: cashBalance,
        bank: bankBalance,
        accountsReceivable: accountsReceivable,
        totalCurrentAssets: cashBalance + bankBalance + accountsReceivable
      },
      liabilities: {
        accountsPayable: accountsPayable,
        totalCurrentLiabilities: accountsPayable
      },
      equity: {
        totalEquity: (cashBalance + bankBalance + accountsReceivable) - accountsPayable
      },
      income: {
        salesRevenue: salesRevenue,
        expenses: expenses,
        netIncome: salesRevenue - expenses
      },
      asOfDate
    };
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error generating financial summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
