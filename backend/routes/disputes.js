const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../middleware/auth');
const disputeManagementService = require('../services/disputeManagementService');
const { body, param, query } = require('express-validator');

// @route   POST /api/disputes
// @desc    Create a dispute
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_disputes'),
  body('transactionId').isMongoId().withMessage('Valid transaction ID is required'),
  body('customerId').isMongoId().withMessage('Valid customer ID is required'),
  body('disputeType').isIn(['chargeback', 'refund_request', 'billing_error', 'duplicate_charge', 'unauthorized', 'other']).withMessage('Valid dispute type is required'),
  body('disputedAmount').isFloat({ min: 0.01 }).withMessage('Disputed amount must be positive'),
  body('reason').trim().isLength({ min: 1 }).withMessage('Reason is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], async (req, res) => {
  try {
    const dispute = await disputeManagementService.createDispute(req.body, req.user);
    res.status(201).json({ success: true, data: dispute });
  } catch (error) {
    console.error('Create dispute error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/disputes/:id/resolve
// @desc    Resolve a dispute
// @access  Private
router.post('/:id/resolve', [
  auth,
  requirePermission('resolve_disputes'),
  param('id').isMongoId().withMessage('Valid dispute ID is required'),
  body('resolution').isIn(['refund_full', 'refund_partial', 'credit_note', 'adjustment', 'rejected', 'other']).withMessage('Valid resolution is required'),
  body('resolutionAmount').optional().isFloat({ min: 0 }).withMessage('Resolution amount must be positive'),
  body('resolutionNotes').optional().trim().isLength({ max: 2000 })
], async (req, res) => {
  try {
    const result = await disputeManagementService.resolveDispute(
      req.params.id,
      req.body,
      req.user
    );
    res.json({ success: true, data: result, message: 'Dispute resolved successfully' });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/disputes/customers/:customerId
// @desc    Get disputes for a customer
// @access  Private
router.get('/customers/:customerId', [
  auth,
  requirePermission('view_disputes'),
  param('customerId').isMongoId().withMessage('Valid customer ID is required'),
  query('status').optional().isIn(['open', 'under_review', 'resolved', 'rejected', 'escalated']),
  query('disputeType').optional()
], async (req, res) => {
  try {
    const result = await disputeManagementService.getCustomerDisputes(
      req.params.customerId,
      {
        status: req.query.status,
        disputeType: req.query.disputeType,
        limit: parseInt(req.query.limit) || 50,
        skip: parseInt(req.query.skip) || 0
      }
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get customer disputes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/disputes/open
// @desc    Get all open disputes
// @access  Private
router.get('/open', [
  auth,
  requirePermission('view_disputes'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  query('assignedTo').optional().isMongoId(),
  query('overdue').optional().isBoolean()
], async (req, res) => {
  try {
    const disputes = await disputeManagementService.getOpenDisputes({
      priority: req.query.priority,
      assignedTo: req.query.assignedTo,
      overdue: req.query.overdue === 'true'
    });
    res.json({ success: true, data: disputes, count: disputes.length });
  } catch (error) {
    console.error('Get open disputes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

