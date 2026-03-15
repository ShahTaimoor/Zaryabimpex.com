const express = require('express');
const router = express.Router();
const AccountingService = require('../services/accountingService');
const { auth, requirePermission } = require('../middleware/auth');
const ledgerAccountService = require('../services/ledgerAccountService');
const chartOfAccountsService = require('../services/chartOfAccountsService');
const { body, param, query } = require('express-validator');

// @route   GET /api/chart-of-accounts
// @desc    Get all accounts with optional filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { accountType, accountCategory, isActive, search, allowDirectPosting, includePartyAccounts, includeBalances } = req.query;

    if (includePartyAccounts === 'true') {
      await ledgerAccountService.ensureCustomerLedgerAccounts({ userId: req.user?._id });
      await ledgerAccountService.ensureSupplierLedgerAccounts({ userId: req.user?._id });
    }
    
    const accounts = await chartOfAccountsService.getAccounts({
      accountType,
      accountCategory,
      isActive,
      search,
      allowDirectPosting
    });
    
    // Calculate dynamic balances from transactions if requested
    let accountsWithBalances = accounts;
    if (includeBalances === 'true') {
      const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
      accountsWithBalances = await Promise.all(
        accounts.map(async (account) => {
          try {
            const balance = await AccountingService.getAccountBalance(account.accountCode, asOfDate);
            return {
              ...account.toObject(),
              currentBalance: balance
            };
          } catch (error) {
            console.error(`Error calculating balance for account ${account.accountCode}:`, error);
            return {
              ...account.toObject(),
              currentBalance: account.currentBalance || 0
            };
          }
        })
      );
    }
    
    res.json({
      success: true,
      data: accountsWithBalances,
      count: accountsWithBalances.length
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch accounts',
      error: error.message
    });
  }
});

// @route   GET /api/chart-of-accounts/hierarchy
// @desc    Get account hierarchy tree
// @access  Private
router.get('/hierarchy', auth, async (req, res) => {
  try {
    const hierarchy = await chartOfAccountsService.getAccountHierarchy();
    
    res.json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    console.error('Get account hierarchy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account hierarchy',
      error: error.message
    });
  }
});

// @route   GET /api/chart-of-accounts/:id
// @desc    Get account by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const account = await chartOfAccountsService.getAccountById(req.params.id);
    
    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    if (error.message === 'Account not found') {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    console.error('Get account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account',
      error: error.message
    });
  }
});

// @route   POST /api/chart-of-accounts
// @desc    Create new account
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      accountCode,
      accountName,
      accountType,
      accountCategory,
      parentAccount,
      level,
      normalBalance,
      openingBalance,
      description,
      allowDirectPosting,
      isTaxable,
      taxRate,
      requiresReconciliation
    } = req.body;

    const account = await chartOfAccountsService.createAccount(req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: account
    });
  } catch (error) {
    if (error.message === 'Account code, name, type, category, and normal balance are required' || 
        error.message === 'Account code already exists') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    console.error('Create account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: error.message
    });
  }
});

// @route   PUT /api/chart-of-accounts/:id
// @desc    Update account
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const account = await chartOfAccountsService.updateAccount(req.params.id, req.body, req.user.id);

    res.json({
      success: true,
      message: 'Account updated successfully',
      data: account
    });
  } catch (error) {
    if (error.message === 'Account not found') {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    if (error.message === 'Cannot modify system accounts') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify system accounts'
      });
    }
    console.error('Update account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update account',
      error: error.message
    });
  }
});

// @route   DELETE /api/chart-of-accounts/:id
// @desc    Delete account
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await chartOfAccountsService.deleteAccount(req.params.id);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    if (error.message === 'Account not found') {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    if (error.message === 'Cannot delete system accounts') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete system accounts'
      });
    }
    if (error.message.includes('sub-accounts') || error.message.includes('non-zero balance')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
});

// @route   GET /api/chart-of-accounts/stats/summary
// @desc    Get account statistics summary
// @access  Private
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const stats = await chartOfAccountsService.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get account stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account statistics',
      error: error.message
    });
  }
});

// @route   POST /api/chart-of-accounts/:id/lock-reconciliation
// @desc    Lock account for reconciliation
// @access  Private (requires 'reconcile_accounts' permission)
router.post('/:id/lock-reconciliation', [
  auth,
  requirePermission('reconcile_accounts'),
  param('id').isMongoId().withMessage('Valid account ID is required'),
  body('durationMinutes').optional().isInt({ min: 1, max: 480 }).withMessage('Duration must be between 1 and 480 minutes')
], async (req, res) => {
  try {
    const ChartOfAccounts = require('../models/ChartOfAccounts');
    const account = await ChartOfAccounts.findById(req.params.id);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    const durationMinutes = req.body.durationMinutes || 30;
    await account.lockForReconciliation(req.user._id, durationMinutes);

    res.json({
      success: true,
      message: 'Account locked for reconciliation',
      data: {
        accountCode: account.accountCode,
        accountName: account.accountName,
        reconciliationStatus: account.reconciliationStatus,
        lockExpiresAt: account.reconciliationStatus.lockExpiresAt
      }
    });
  } catch (error) {
    console.error('Error locking account for reconciliation:', error);
    if (error.message.includes('already locked')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error locking account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/chart-of-accounts/:id/unlock-reconciliation
// @desc    Unlock account after reconciliation
// @access  Private (requires 'reconcile_accounts' permission)
router.post('/:id/unlock-reconciliation', [
  auth,
  requirePermission('reconcile_accounts'),
  param('id').isMongoId().withMessage('Valid account ID is required'),
  body('reconciled').optional().isBoolean().withMessage('Reconciled must be a boolean'),
  body('discrepancyAmount').optional().isFloat().withMessage('Discrepancy amount must be a number'),
  body('discrepancyReason').optional().isString().trim().isLength({ max: 500 }).withMessage('Discrepancy reason too long')
], async (req, res) => {
  try {
    const ChartOfAccounts = require('../models/ChartOfAccounts');
    const account = await ChartOfAccounts.findById(req.params.id);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    const reconciled = req.body.reconciled !== undefined ? req.body.reconciled : true;
    const discrepancyAmount = req.body.discrepancyAmount || null;
    const discrepancyReason = req.body.discrepancyReason || null;

    await account.unlockAfterReconciliation(
      req.user._id,
      reconciled,
      discrepancyAmount,
      discrepancyReason
    );

    res.json({
      success: true,
      message: reconciled ? 'Account reconciled successfully' : 'Account unlocked with discrepancy',
      data: {
        accountCode: account.accountCode,
        accountName: account.accountName,
        reconciliationStatus: account.reconciliationStatus
      }
    });
  } catch (error) {
    console.error('Error unlocking account:', error);
    if (error.message.includes('Only the user who locked')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error unlocking account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/chart-of-accounts/:id/reconciliation-status
// @desc    Get reconciliation status of an account
// @access  Private (requires 'view_reports' permission)
router.get('/:id/reconciliation-status', [
  auth,
  requirePermission('view_reports'),
  param('id').isMongoId().withMessage('Valid account ID is required')
], async (req, res) => {
  try {
    const ChartOfAccounts = require('../models/ChartOfAccounts');
    const account = await ChartOfAccounts.findById(req.params.id)
      .populate('reconciliationStatus.lockedBy', 'firstName lastName email')
      .populate('reconciliationStatus.reconciledBy', 'firstName lastName email');
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    const isLocked = account.reconciliationStatus.lockedBy && 
                     account.reconciliationStatus.lockExpiresAt &&
                     account.reconciliationStatus.lockExpiresAt > new Date();

    res.json({
      success: true,
      data: {
        accountId: account._id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        reconciliationStatus: account.reconciliationStatus,
        isLocked: isLocked,
        canBeLocked: !isLocked || account.reconciliationStatus.lockedBy.toString() === req.user._id.toString(),
        lockExpiresIn: isLocked && account.reconciliationStatus.lockExpiresAt 
          ? Math.max(0, Math.floor((account.reconciliationStatus.lockExpiresAt - new Date()) / 60000))
          : 0
      }
    });
  } catch (error) {
    console.error('Error getting reconciliation status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting reconciliation status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

