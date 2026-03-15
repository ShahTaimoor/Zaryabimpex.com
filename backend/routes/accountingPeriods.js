const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../middleware/auth');
const accountingPeriodService = require('../services/accountingPeriodService');
const { body, param, query } = require('express-validator');

// @route   POST /api/accounting-periods
// @desc    Create a new accounting period
// @access  Private
router.post('/', [
  auth,
  requirePermission('manage_accounting_periods'),
  body('periodName').trim().isLength({ min: 1 }).withMessage('Period name is required'),
  body('periodType').isIn(['monthly', 'quarterly', 'yearly']).withMessage('Valid period type is required'),
  body('periodStart').isISO8601().withMessage('Valid start date is required'),
  body('periodEnd').isISO8601().withMessage('Valid end date is required')
], async (req, res) => {
  try {
    const period = await accountingPeriodService.createPeriod(req.body, req.user);
    res.status(201).json({ success: true, data: period });
  } catch (error) {
    console.error('Create accounting period error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/accounting-periods/current
// @desc    Get current accounting period
// @access  Private
router.get('/current', [
  auth,
  requirePermission('view_accounting_periods'),
  query('periodType').optional().isIn(['monthly', 'quarterly', 'yearly'])
], async (req, res) => {
  try {
    const period = await accountingPeriodService.getCurrentPeriod(req.query.periodType || 'monthly');
    res.json({ success: true, data: period });
  } catch (error) {
    console.error('Get current period error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/accounting-periods/:id/close
// @desc    Close an accounting period
// @access  Private
router.post('/:id/close', [
  auth,
  requirePermission('close_accounting_periods'),
  param('id').isMongoId().withMessage('Valid period ID is required'),
  body('notes').optional().trim().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const period = await accountingPeriodService.closePeriod(
      req.params.id,
      req.user,
      req.body.notes || ''
    );
    res.json({ success: true, data: period, message: 'Period closed successfully' });
  } catch (error) {
    console.error('Close period error:', error);
    if (error.message.includes('Cannot close period')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/accounting-periods/:id/lock
// @desc    Lock an accounting period
// @access  Private
router.post('/:id/lock', [
  auth,
  requirePermission('lock_accounting_periods'),
  param('id').isMongoId().withMessage('Valid period ID is required'),
  body('reason').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const period = await accountingPeriodService.lockPeriod(
      req.params.id,
      req.user,
      req.body.reason || ''
    );
    res.json({ success: true, data: period, message: 'Period locked successfully' });
  } catch (error) {
    console.error('Lock period error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/accounting-periods/:id/unlock
// @desc    Unlock an accounting period
// @access  Private
router.post('/:id/unlock', [
  auth,
  requirePermission('lock_accounting_periods'),
  param('id').isMongoId().withMessage('Valid period ID is required')
], async (req, res) => {
  try {
    const period = await accountingPeriodService.unlockPeriod(req.params.id, req.user);
    res.json({ success: true, data: period, message: 'Period unlocked successfully' });
  } catch (error) {
    console.error('Unlock period error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/accounting-periods
// @desc    Get all accounting periods
// @access  Private
router.get('/', [
  auth,
  requirePermission('view_accounting_periods'),
  query('status').optional().isIn(['open', 'closing', 'closed', 'locked']),
  query('periodType').optional().isIn(['monthly', 'quarterly', 'yearly'])
], async (req, res) => {
  try {
    const AccountingPeriod = require('../models/AccountingPeriod');
    const filter = {};
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.periodType) {
      filter.periodType = req.query.periodType;
    }

    const periods = await AccountingPeriod.find(filter)
      .populate('createdBy', 'firstName lastName')
      .populate('closedBy', 'firstName lastName')
      .populate('lockedBy', 'firstName lastName')
      .sort({ periodStart: -1 });

    res.json({ success: true, data: periods });
  } catch (error) {
    console.error('Get accounting periods error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/accounting-periods/:id/generate-closing-entries
// @desc    Generate closing entries for a period
// @access  Private (requires 'close_accounting_periods' permission)
router.post('/:id/generate-closing-entries', [
  auth,
  requirePermission('close_accounting_periods'),
  param('id').isMongoId().withMessage('Valid period ID is required')
], async (req, res) => {
  try {
    const closingEntriesService = require('../services/closingEntriesService');
    const result = await closingEntriesService.generateClosingEntries(req.params.id, req.user._id);

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error generating closing entries:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error generating closing entries',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/accounting-periods/:id/closing-entries-status
// @desc    Check if closing entries are required for a period
// @access  Private (requires 'view_accounting_periods' permission)
router.get('/:id/closing-entries-status', [
  auth,
  requirePermission('view_accounting_periods'),
  param('id').isMongoId().withMessage('Valid period ID is required')
], async (req, res) => {
  try {
    const closingEntriesService = require('../services/closingEntriesService');
    const required = await closingEntriesService.areClosingEntriesRequired(req.params.id);

    res.json({
      success: true,
      data: {
        periodId: req.params.id,
        closingEntriesRequired: required,
        message: required 
          ? 'Closing entries are required for this period' 
          : 'No closing entries required (all revenue/expense accounts are zero)'
      }
    });
  } catch (error) {
    console.error('Error checking closing entries status:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error checking closing entries status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/accounting-periods/:id/closing-entries
// @desc    Get closing entries for a period
// @access  Private (requires 'view_accounting_periods' permission)
router.get('/:id/closing-entries', [
  auth,
  requirePermission('view_accounting_periods'),
  param('id').isMongoId().withMessage('Valid period ID is required')
], async (req, res) => {
  try {
    const JournalVoucher = require('../models/JournalVoucher');
    const closingEntries = await JournalVoucher.find({
      'metadata.periodId': req.params.id,
      'metadata.isClosingEntry': true
    })
      .populate('createdBy', 'firstName lastName email')
      .sort({ voucherDate: -1 });

    res.json({
      success: true,
      data: closingEntries,
      count: closingEntries.length
    });
  } catch (error) {
    console.error('Error getting closing entries:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting closing entries',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

