const express = require('express');
const { query, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const reportsService = require('../services/reportsService');

const router = express.Router();

// @route   GET /api/reports/sales
// @desc    Get sales report
// @access  Private
router.get('/sales', [
  auth,
  requirePermission('view_reports'),
  ...validateDateParams,
  query('groupBy').optional().isIn(['day', 'week', 'month', 'year']),
  query('orderType').optional().isIn(['retail', 'wholesale', 'return', 'exchange']),
  handleValidationErrors,
  processDateFilter(['billDate', 'createdAt']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Merge date filter from middleware if present (for Pakistan timezone)
    const queryParams = { ...req.query };
    if (req.dateRange) {
      queryParams.dateFrom = req.dateRange.startDate || undefined;
      queryParams.dateTo = req.dateRange.endDate || undefined;
    }
    
    const report = await reportsService.getSalesReport(queryParams);
    
    res.json(report);
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/products
// @desc    Get product performance report
// @access  Private
router.get('/products', [
  auth,
  requirePermission('view_reports'),
  ...validateDateParams,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors,
  processDateFilter('createdAt'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Merge date filter from middleware if present (for Pakistan timezone)
    const queryParams = { ...req.query };
    if (req.dateRange) {
      queryParams.dateFrom = req.dateRange.startDate || undefined;
      queryParams.dateTo = req.dateRange.endDate || undefined;
    }
    
    const report = await reportsService.getProductReport(queryParams);
    
    res.json(report);
  } catch (error) {
    console.error('Product report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/customers
// @desc    Get customer performance report
// @access  Private
router.get('/customers', [
  auth,
  requirePermission('view_reports'),
  ...validateDateParams,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('businessType').optional().isIn(['retail', 'wholesale', 'distributor', 'individual']),
  handleValidationErrors,
  processDateFilter('createdAt'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Merge date filter from middleware if present (for Pakistan timezone)
    const queryParams = { ...req.query };
    if (req.dateRange) {
      queryParams.dateFrom = req.dateRange.startDate || undefined;
      queryParams.dateTo = req.dateRange.endDate || undefined;
    }
    
    const report = await reportsService.getCustomerReport(queryParams);
    
    res.json(report);
  } catch (error) {
    console.error('Customer report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/inventory
// @desc    Get inventory report
// @access  Private
router.get('/inventory', [
  auth,
  requirePermission('view_reports'),
  query('lowStock').optional().isBoolean(),
  query('category').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const report = await reportsService.getInventoryReport(req.query);
    
    res.json(report);
  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
