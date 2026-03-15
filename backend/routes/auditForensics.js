const express = require('express');
const router = express.Router();
const { param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const comprehensiveAuditService = require('../services/comprehensiveAuditService');
const ImmutableAuditLog = require('../models/ImmutableAuditLog');
const { handleValidationErrors } = require('../middleware/validation');

/**
 * @route   GET /api/audit-forensics/user/:userId
 * @desc    Investigate user activity
 * @access  Private (requires 'view_audit_logs' permission)
 */
router.get('/user/:userId', [
  auth,
  requirePermission('view_audit_logs'),
  param('userId').isMongoId().withMessage('Valid user ID is required'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { userId } = req.params;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    const activity = await comprehensiveAuditService.investigateUserActivity(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: {
        userId,
        startDate,
        endDate,
        activity,
        totalActions: activity.length
      }
    });
  } catch (error) {
    console.error('User activity investigation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error investigating user activity',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/audit-forensics/entity/:entityType/:entityId
 * @desc    Investigate entity changes
 * @access  Private
 */
router.get('/entity/:entityType/:entityId', [
  auth,
  requirePermission('view_audit_logs'),
  param('entityType').notEmpty().withMessage('Entity type is required'),
  param('entityId').isMongoId().withMessage('Valid entity ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    const changes = await comprehensiveAuditService.investigateEntityChanges(entityType, entityId);
    
    res.json({
      success: true,
      data: {
        entityType,
        entityId,
        changes,
        totalChanges: changes.length
      }
    });
  } catch (error) {
    console.error('Entity investigation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error investigating entity changes',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/audit-forensics/financial/:accountCode
 * @desc    Investigate financial changes for account
 * @access  Private
 */
router.get('/financial/:accountCode', [
  auth,
  requirePermission('view_audit_logs'),
  param('accountCode').notEmpty().withMessage('Account code is required'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { accountCode } = req.params;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    const changes = await comprehensiveAuditService.investigateFinancialChanges(accountCode, startDate, endDate);
    
    res.json({
      success: true,
      data: {
        accountCode,
        startDate,
        endDate,
        changes,
        totalChanges: changes.length
      }
    });
  } catch (error) {
    console.error('Financial investigation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error investigating financial changes',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/audit-forensics/transaction/:transactionId
 * @desc    Get audit trail for specific transaction
 * @access  Private
 */
router.get('/transaction/:transactionId', [
  auth,
  requirePermission('view_audit_logs'),
  param('transactionId').notEmpty().withMessage('Transaction ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const auditTrail = await comprehensiveAuditService.getTransactionAuditTrail(transactionId);
    
    res.json({
      success: true,
      data: {
        transactionId,
        auditTrail,
        totalEntries: auditTrail.length
      }
    });
  } catch (error) {
    console.error('Transaction audit trail error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving transaction audit trail',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/audit-forensics/verify-integrity
 * @desc    Verify audit log integrity
 * @access  Private (requires 'manage_audit_logs' permission)
 */
router.get('/verify-integrity', [
  auth,
  requirePermission('manage_audit_logs'),
  handleValidationErrors
], async (req, res) => {
  try {
    const result = await comprehensiveAuditService.verifyAuditLogIntegrity();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Audit log integrity verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying audit log integrity',
      error: error.message
    });
  }
});

module.exports = router;

