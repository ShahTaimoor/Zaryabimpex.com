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
  query('groupBy').optional().isIn(['daily', 'monthly', 'product', 'category', 'city', 'invoice']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await reportsService.getSalesReport(req.query);
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

// @route   GET /api/reports/inventory-reconciliation
// @desc    Get inventory reconciliation report (Opening, Purchases, Sales, Returns, Closing, Valuation)
// @access  Private
router.get('/inventory-reconciliation', [
  auth,
  requirePermission('view_reports'),
  query('dateFrom').optional().isDate(),
  query('dateTo').optional().isDate(),
  query('categoryId').optional(),
  query('productId').optional(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await reportsService.getInventoryReconciliationReport(req.query);
    res.json(report);
  } catch (error) {
    console.error('Inventory reconciliation report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/inventory
// @desc    Get inventory report (summary, low-stock, valuation, stock-summary)
// @access  Private
router.get('/inventory', [
  auth,
  requirePermission('view_reports'),
  query('lowStock').optional().isBoolean(),
  query('category').optional(),
  query('search').optional().trim(),
  query('type').optional().isIn(['summary', 'low-stock', 'valuation', 'stock-summary']),
  query('dateFrom').optional().isDate(),
  query('dateTo').optional().isDate(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await reportsService.getInventoryReport(req.query);
    res.json(report);
  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/summary-cards
// @desc    Get summary cards for dashboard
// @access  Private
router.get('/summary-cards', [
  auth,
  requirePermission('view_reports'),
  ...validateDateParams,
  handleValidationErrors,
], async (req, res) => {
  try {
    const filters = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      city: req.query.city
    };
    const summary = await reportsService.getSummaryCards(filters);
    res.json(summary);
  } catch (error) {
    console.error('Summary cards error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/party-balance
// @desc    Get party balance report
// @access  Private
router.get('/party-balance', [
  auth,
  requirePermission('view_reports'),
  query('partyType').optional().isIn(['customer', 'supplier']),
  query('city').optional().isString(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await reportsService.getPartyBalanceReport(req.query);
    res.json(report);
  } catch (error) {
    console.error('Party balance report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/financial
// @desc    Get financial report (Trial Balance, P&L, Balance Sheet)
// @access  Private
router.get('/financial', [
  auth,
  requirePermission('view_reports'),
  ...validateDateParams,
  query('type').optional().isIn(['trial-balance', 'pl-statement', 'balance-sheet']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await reportsService.getFinancialReport(req.query);
    res.json(report);
  } catch (error) {
    console.error('Financial report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/purchase-by-supplier
// @desc    Products purchased by supplier - quantity per product per supplier
// @access  Private
router.get('/purchase-by-supplier', [
  auth,
  requirePermission('view_reports'),
  query('supplier').optional().isUUID(),
  query('supplierId').optional().isUUID(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await reportsService.getPurchaseBySupplierReport(req.query);
    res.json(report);
  } catch (error) {
    console.error('Purchase by supplier report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/bank-cash-summary
// @desc    Get bank and cash summary report
// @access  Private
router.get('/bank-cash-summary', [
  auth,
  requirePermission('view_reports'),
  ...validateDateParams,
  query('month').optional().matches(/^\d{4}-\d{2}$/),
  query('bankIds').optional().isString(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await reportsService.getBankCashSummary(req.query);
    res.json(report);
  } catch (error) {
    console.error('Bank/Cash summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
