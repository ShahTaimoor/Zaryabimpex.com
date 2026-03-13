const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../middleware/auth');
const { query } = require('express-validator');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const auditReportingService = require('../services/auditReportingService');

/**
 * Audit & Reporting API Routes
 * Provides dashboards and reports for audit compliance
 */

// @route   GET /api/audit-reporting/dashboard
// @desc    Get audit dashboard summary
// @access  Private (requires 'view_reports' permission)
router.get('/dashboard', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest
], async (req, res) => {
  try {
    const dashboard = await auditReportingService.getAuditDashboard();

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error getting audit dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting audit dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/audit-reporting/pending-approvals
// @desc    Get pending approvals
// @access  Private (requires 'view_reports' permission)
router.get('/pending-approvals', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest
], async (req, res) => {
  try {
    const pendingApprovals = await auditReportingService.getPendingApprovals();

    res.json({
      success: true,
      data: pendingApprovals
    });
  } catch (error) {
    console.error('Error getting pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting pending approvals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/audit-reporting/reconciliation-discrepancies
// @desc    Get reconciliation discrepancies
// @access  Private (requires 'view_reports' permission)
router.get('/reconciliation-discrepancies', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest
], async (req, res) => {
  try {
    const discrepancies = await auditReportingService.getReconciliationDiscrepancies();

    res.json({
      success: true,
      data: discrepancies
    });
  } catch (error) {
    console.error('Error getting reconciliation discrepancies:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting reconciliation discrepancies',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/audit-reporting/failed-trial-balance
// @desc    Get failed trial balance validations
// @access  Private (requires 'view_reports' permission)
router.get('/failed-trial-balance', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('startDate').optional().isISO8601().toDate().withMessage('Valid start date required'),
  query('endDate').optional().isISO8601().toDate().withMessage('Valid end date required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default: last 90 days
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const failed = await auditReportingService.getFailedTrialBalanceValidations(startDate, endDate);

    res.json({
      success: true,
      data: failed
    });
  } catch (error) {
    console.error('Error getting failed trial balance validations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting failed trial balance validations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/audit-reporting/export-audit
// @desc    Get export audit report
// @access  Private (requires 'view_reports' permission)
router.get('/export-audit', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('startDate').optional().isISO8601().toDate().withMessage('Valid start date required'),
  query('endDate').optional().isISO8601().toDate().withMessage('Valid end date required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const report = await auditReportingService.getExportAuditReport(startDate, endDate);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error getting export audit report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting export audit report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

