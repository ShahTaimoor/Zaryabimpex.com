const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../middleware/auth');
const reconciliationService = require('../services/reconciliationService');
const { param, query } = require('express-validator');

// @route   POST /api/reconciliation/customers/:customerId
// @desc    Reconcile a single customer's balance
// @access  Private
router.post('/customers/:customerId', [
  auth,
  requirePermission('reconcile_balances'),
  param('customerId').isMongoId().withMessage('Valid customer ID is required'),
  query('autoCorrect').optional().isBoolean().withMessage('autoCorrect must be boolean')
], async (req, res) => {
  try {
    const options = {
      autoCorrect: req.query.autoCorrect === 'true',
      alertOnDiscrepancy: req.query.alertOnDiscrepancy !== 'false'
    };

    const reconciliation = await reconciliationService.reconcileCustomerBalance(
      req.params.customerId,
      options
    );

    res.json({
      success: true,
      data: reconciliation
    });
  } catch (error) {
    console.error('Reconcile customer balance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/reconciliation/customers
// @desc    Reconcile all customer balances
// @access  Private
router.post('/customers', [
  auth,
  requirePermission('reconcile_balances'),
  query('autoCorrect').optional().isBoolean().withMessage('autoCorrect must be boolean'),
  query('batchSize').optional().isInt({ min: 1, max: 1000 }).withMessage('batchSize must be between 1 and 1000')
], async (req, res) => {
  try {
    const options = {
      autoCorrect: req.query.autoCorrect === 'true',
      alertOnDiscrepancy: req.query.alertOnDiscrepancy !== 'false',
      batchSize: parseInt(req.query.batchSize) || 100
    };

    const results = await reconciliationService.reconcileAllCustomerBalances(options);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Reconcile all customers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/reconciliation/customers/:customerId/report
// @desc    Get reconciliation report for a customer
// @access  Private
router.get('/customers/:customerId/report', [
  auth,
  requirePermission('view_reconciliation_reports'),
  param('customerId').isMongoId().withMessage('Valid customer ID is required'),
  query('startDate').optional().isISO8601().withMessage('startDate must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be valid ISO date')
], async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
    startDate.setMonth(startDate.getMonth() - 1); // Default to last month

    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const report = await reconciliationService.getReconciliationReport(
      req.params.customerId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get reconciliation report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

