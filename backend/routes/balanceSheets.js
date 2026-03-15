const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const balanceSheetService = require('../services/balanceSheetService');
const balanceSheetCalculationService = require('../services/balanceSheetCalculationService');

const router = express.Router();

// @route   POST /api/balance-sheets/generate
// @desc    Generate a new balance sheet
// @access  Private (requires 'view_reports' permission)
router.post('/generate', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  body('startDate').optional().isISO8601().toDate().withMessage('Valid start date is required'),
  body('endDate').isISO8601().toDate().withMessage('Valid end date is required'),
  body('statementDate').optional().isISO8601().toDate().withMessage('Valid statement date is required'),
  body('periodType').optional().isIn(['monthly', 'quarterly', 'yearly']).withMessage('Valid period type is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { startDate, endDate, statementDate, periodType = 'monthly' } = req.body;

    // Use endDate as statementDate if statementDate is not provided (backward compatibility)
    const finalStatementDate = statementDate || endDate;
    const finalStartDate = startDate || endDate;

    // Validate date range
    if (finalStartDate && finalStatementDate && new Date(finalStartDate) > new Date(finalStatementDate)) {
      return res.status(400).json({
        message: 'Start date must be before or equal to end date'
      });
    }

    const balanceSheet = await balanceSheetService.generateBalanceSheet(
      finalStatementDate,
      periodType,
      req.user._id,
      {
        startDate: finalStartDate,
        endDate: finalStatementDate
      }
    );

    res.status(201).json({
      message: 'Balance sheet generated successfully',
      balanceSheet
    });
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/balance-sheets
// @desc    Get list of balance sheets with filters
// @access  Private (requires 'view_reports' permission)
router.get('/', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional({ checkFalsy: true }).isIn(['draft', 'review', 'approved', 'final']),
  query('periodType').optional({ checkFalsy: true }).isIn(['monthly', 'quarterly', 'yearly']),
  ...validateDateParams,
  query('search').optional({ checkFalsy: true }).trim(),
  handleValidationErrors,
  processDateFilter('createdAt'),
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      periodType,
      search
    } = req.query;

    // Use dateRange from middleware (Pakistan timezone)
    const queryParams = {
      page,
      limit,
      status,
      periodType,
      search
    };

    if (req.dateRange) {
      queryParams.startDate = req.dateRange.startDate || undefined;
      queryParams.endDate = req.dateRange.endDate || undefined;
    }

    const result = await balanceSheetService.getBalanceSheets(queryParams);

    res.json({
      balanceSheets: result.balanceSheets,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching balance sheets:', error);
    res.status(500).json({ message: 'Server error fetching balance sheets', error: error.message });
  }
});

// @route   GET /api/balance-sheets/:balanceSheetId
// @desc    Get detailed balance sheet information
// @access  Private (requires 'view_reports' permission)
router.get('/:balanceSheetId', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('balanceSheetId').isMongoId().withMessage('Valid Balance Sheet ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { balanceSheetId } = req.params;

    const balanceSheet = await balanceSheetService.getBalanceSheetById(balanceSheetId);

    res.json(balanceSheet);
  } catch (error) {
    if (error.message === 'Balance sheet not found') {
      return res.status(404).json({ message: 'Balance sheet not found' });
    }
    console.error('Error fetching balance sheet:', error);
    res.status(500).json({ message: 'Server error fetching balance sheet', error: error.message });
  }
});

// @route   PUT /api/balance-sheets/:balanceSheetId/status
// @desc    Update balance sheet status
// @access  Private (requires 'view_reports' permission)
router.put('/:balanceSheetId/status', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('balanceSheetId').isMongoId().withMessage('Valid Balance Sheet ID is required'),
  body('status').isIn(['draft', 'review', 'approved', 'final']).withMessage('Valid status is required'),
  body('notes').optional().trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { balanceSheetId } = req.params;
    const { status, notes } = req.body;

    const balanceSheet = await balanceSheetService.updateStatus(balanceSheetId, status, req.user._id, notes);

    res.json({
      message: 'Balance sheet status updated successfully',
      balanceSheet: {
        statementNumber: balanceSheet.statementNumber,
        status: balanceSheet.status,
        approvedBy: balanceSheet.approvedBy,
        approvedAt: balanceSheet.approvedAt
      }
    });
  } catch (error) {
    if (error.message === 'Balance sheet not found') {
      return res.status(404).json({ message: 'Balance sheet not found' });
    }
    console.error('Error updating balance sheet status:', error);
    res.status(500).json({ message: 'Server error updating balance sheet status', error: error.message });
  }
});

// @route   PUT /api/balance-sheets/:balanceSheetId
// @desc    Update balance sheet data
// @access  Private (requires 'view_reports' permission)
router.put('/:balanceSheetId', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('balanceSheetId').isMongoId().withMessage('Valid Balance Sheet ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { balanceSheetId } = req.params;

    const balanceSheet = await balanceSheetService.updateBalanceSheet(balanceSheetId, req.body, req.user._id);

    res.json({
      message: 'Balance sheet updated successfully',
      balanceSheet
    });
  } catch (error) {
    if (error.message === 'Balance sheet not found') {
      return res.status(404).json({ message: 'Balance sheet not found' });
    }
    if (error.message === 'Only draft balance sheets can be updated') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error updating balance sheet:', error);
    res.status(500).json({ message: 'Server error updating balance sheet', error: error.message });
  }
});

// @route   DELETE /api/balance-sheets/:balanceSheetId
// @desc    Delete balance sheet
// @access  Private (requires 'view_reports' permission)
router.delete('/:balanceSheetId', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('balanceSheetId').isMongoId().withMessage('Valid Balance Sheet ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { balanceSheetId } = req.params;

    const result = await balanceSheetService.deleteBalanceSheet(balanceSheetId);

    res.json({ message: result.message });
  } catch (error) {
    if (error.message === 'Balance sheet not found') {
      return res.status(404).json({ message: 'Balance sheet not found' });
    }
    if (error.message === 'Only draft balance sheets can be deleted') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error deleting balance sheet:', error);
    res.status(500).json({ message: 'Server error deleting balance sheet', error: error.message });
  }
});

// @route   GET /api/balance-sheets/:balanceSheetId/comparison
// @desc    Get balance sheet comparison data
// @access  Private (requires 'view_reports' permission)
router.get('/:balanceSheetId/comparison', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('balanceSheetId').isMongoId().withMessage('Valid Balance Sheet ID is required'),
  query('type').optional().isIn(['previous', 'year_ago']).withMessage('Valid comparison type is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { balanceSheetId } = req.params;
    const { type = 'previous' } = req.query;

    const comparisonData = await balanceSheetCalculationService.getComparisonData(
      balanceSheetId,
      type
    );

    if (!comparisonData) {
      return res.status(404).json({
        message: 'No comparison data available for this balance sheet'
      });
    }

    res.json(comparisonData);
  } catch (error) {
    console.error('Error fetching comparison data:', error);
    res.status(500).json({ message: 'Server error fetching comparison data', error: error.message });
  }
});

// @route   GET /api/balance-sheets/stats
// @desc    Get balance sheet statistics
// @access  Private (requires 'view_reports' permission)
router.get('/stats', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const period = startDate && endDate ? { startDate, endDate } : {};
    const stats = await balanceSheetCalculationService.getStats(period);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching balance sheet stats:', error);
    res.status(500).json({ message: 'Server error fetching balance sheet stats', error: error.message });
  }
});

// @route   GET /api/balance-sheets/latest
// @desc    Get latest balance sheet
// @access  Private (requires 'view_reports' permission)
router.get('/latest', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('periodType').optional().isIn(['monthly', 'quarterly', 'yearly']).withMessage('Valid period type is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { periodType = 'monthly' } = req.query;

    const balanceSheet = await balanceSheetService.getLatestByPeriodType(periodType);

    if (!balanceSheet) {
      return res.status(404).json({ message: 'No balance sheet found' });
    }

    res.json(balanceSheet);
  } catch (error) {
    console.error('Error fetching latest balance sheet:', error);
    res.status(500).json({ message: 'Server error fetching latest balance sheet', error: error.message });
  }
});

// @route   POST /api/balance-sheets/:balanceSheetId/audit
// @desc    Add audit trail entry
// @access  Private (requires 'view_reports' permission)
router.post('/:balanceSheetId/audit', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('balanceSheetId').isMongoId().withMessage('Valid Balance Sheet ID is required'),
  body('action').isIn(['created', 'updated', 'approved', 'rejected', 'exported', 'viewed']).withMessage('Valid action is required'),
  body('details').optional().trim(),
  body('changes').optional(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { balanceSheetId } = req.params;
    const { action, details, changes } = req.body;

    const balanceSheet = await balanceSheetService.getBalanceSheetById(balanceSheetId);

    // Use the model's addAuditEntry method (it saves internally)
    await balanceSheet.addAuditEntry(action, req.user._id, details, changes);

    res.json({
      message: 'Audit entry added successfully',
      balanceSheet
    });
  } catch (error) {
    console.error('Error adding audit entry:', error);
    res.status(500).json({ message: 'Server error adding audit entry', error: error.message });
  }
});

// @route   POST /api/balance-sheets/:balanceSheetId/export
// @desc    Export balance sheet with audit trail
// @access  Private (requires 'view_reports' permission)
router.post('/:balanceSheetId/export', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('balanceSheetId').isMongoId().withMessage('Valid Balance Sheet ID is required'),
  body('format').optional().isIn(['pdf', 'excel', 'csv']).withMessage('Valid format required'),
  body('purpose').optional().trim().isLength({ max: 500 }).withMessage('Purpose too long'),
  body('recipient').optional().trim().isLength({ max: 200 }).withMessage('Recipient too long'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { balanceSheetId } = req.params;
    const { format = 'pdf', purpose, recipient } = req.body;

    const balanceSheet = await balanceSheetService.getBalanceSheetById(balanceSheetId);
    if (!balanceSheet) {
      return res.status(404).json({
        success: false,
        message: 'Balance sheet not found'
      });
    }

    // CRITICAL: Create export audit trail record
    const FinancialStatementExport = require('../models/FinancialStatementExport');
    const exportRecord = new FinancialStatementExport({
      statementId: balanceSheet._id,
      statementType: 'balance_sheet',
      exportedBy: req.user._id,
      format: format.toLowerCase(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      purpose: purpose || 'Internal review',
      recipient: recipient || null
    });
    await exportRecord.save();

    // TODO: Implement actual export generation (similar to P&L export)
    // For now, return export record
    exportRecord.downloadUrl = `/api/balance-sheets/${balanceSheetId}/download?format=${format}&exportId=${exportRecord._id}`;
    await exportRecord.save();

    // Log to audit trail
    const auditLogService = require('../services/auditLogService');
    await auditLogService.logActivity(
      req.user._id,
      'BalanceSheet',
      balanceSheetId,
      'export',
      `Exported balance sheet as ${format.toUpperCase()}`,
      null,
      { exportId: exportRecord._id, format: format.toLowerCase(), purpose, recipient },
      req
    );

    res.json({
      success: true,
      message: 'Balance sheet export initiated',
      export: {
        exportId: exportRecord._id,
        format: format.toLowerCase(),
        downloadUrl: exportRecord.downloadUrl,
        exportedAt: exportRecord.exportedAt
      }
    });
  } catch (error) {
    console.error('Error exporting balance sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Server error exporting balance sheet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/balance-sheets/:balanceSheetId/exports
// @desc    Get all exports for a balance sheet
// @access  Private (requires 'view_reports' permission)
router.get('/:balanceSheetId/exports', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('balanceSheetId').isMongoId().withMessage('Valid Balance Sheet ID is required'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const FinancialStatementExport = require('../models/FinancialStatementExport');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const exports = await FinancialStatementExport.find({ statementId: req.params.balanceSheetId })
      .populate('exportedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ exportedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FinancialStatementExport.countDocuments({ statementId: req.params.balanceSheetId });

    res.json({
      success: true,
      data: exports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting exports:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting exports',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/balance-sheets/:balanceSheetId/versions
// @desc    Get version history for a balance sheet
// @access  Private (requires 'view_reports' permission)
router.get('/:balanceSheetId/versions', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('balanceSheetId').isMongoId().withMessage('Valid Balance Sheet ID is required')
], async (req, res) => {
  try {
    const BalanceSheet = require('../models/BalanceSheet');
    const balanceSheet = await BalanceSheet.findById(req.params.balanceSheetId)
      .populate('auditTrail.performedBy', 'firstName lastName email');

    if (!balanceSheet) {
      return res.status(404).json({
        success: false,
        message: 'Balance sheet not found'
      });
    }

    res.json({
      success: true,
      data: {
        balanceSheetId: balanceSheet._id,
        statementNumber: balanceSheet.statementNumber,
        auditTrail: balanceSheet.auditTrail || [],
        version: balanceSheet.version || 1
      }
    });
  } catch (error) {
    console.error('Error getting version history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting version history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
