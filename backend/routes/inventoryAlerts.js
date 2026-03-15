const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const InventoryAlertService = require('../services/inventoryAlertService');
const AutoPurchaseOrderService = require('../services/autoPurchaseOrderService');

// @route   GET /api/inventory-alerts
// @desc    Get low stock alerts
// @access  Private
router.get('/', [
  auth,
  requirePermission('view_inventory'),
  query('includeOutOfStock').optional().isIn(['true', 'false']),
  query('includeCritical').optional().isIn(['true', 'false']),
  query('includeWarning').optional().isIn(['true', 'false']),
  query('search').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 5000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      includeOutOfStock: req.query.includeOutOfStock !== 'false',
      includeCritical: req.query.includeCritical !== 'false',
      includeWarning: req.query.includeWarning !== 'false'
    };

    let allAlerts = await InventoryAlertService.getLowStockAlerts(options);

    // Filter by search (product name or SKU)
    const searchTerm = (req.query.search || '').trim().toLowerCase();
    if (searchTerm) {
      allAlerts = allAlerts.filter(alert => {
        const name = (alert.product?.name || '').toLowerCase();
        const sku = (alert.product?.sku || '').toLowerCase();
        return name.includes(searchTerm) || sku.includes(searchTerm);
      });
    }

    const total = allAlerts.length;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const pages = Math.ceil(total / limit) || 1;
    const alerts = allAlerts.slice(offset, offset + limit);

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Get inventory alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/inventory-alerts/summary
// @desc    Get alert summary statistics
// @access  Private
router.get('/summary', [
  auth,
  requirePermission('view_inventory')
], async (req, res) => {
  try {
    const summary = await InventoryAlertService.getAlertSummary();

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get alert summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/inventory-alerts/products-needing-reorder
// @desc    Get products that need reordering (for manual review)
// @access  Private
router.get('/products-needing-reorder', [
  auth,
  requirePermission('view_inventory')
], async (req, res) => {
  try {
    const products = await AutoPurchaseOrderService.getProductsNeedingReorder();

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products needing reorder error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/inventory-alerts/generate-purchase-orders
// @desc    Auto-generate purchase orders based on low stock
// @access  Private
router.post('/generate-purchase-orders', [
  auth,
  requirePermission('create_purchase_orders'),
  query('autoConfirm').optional().isIn(['true', 'false']),
  query('supplierPreference').optional().isIn(['primary', 'cheapest', 'fastest']),
  query('groupBySupplier').optional().isIn(['true', 'false']),
  query('minOrderValue').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      autoConfirm: req.query.autoConfirm === 'true',
      supplierPreference: req.query.supplierPreference || 'primary',
      groupBySupplier: req.query.groupBySupplier !== 'false',
      minOrderValue: parseFloat(req.query.minOrderValue) || 0
    };

    const result = await AutoPurchaseOrderService.generatePurchaseOrders(
      options,
      req.user
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Generate purchase orders error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;

