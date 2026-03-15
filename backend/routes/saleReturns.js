const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const returnManagementService = require('../services/returnManagementService');
const ReturnRepository = require('../repositories/ReturnRepository');
const Sales = require('../models/Sales');
const SalesOrder = require('../models/SalesOrder');

const router = express.Router();

// Helper functions to transform names to uppercase
const transformCustomerToUppercase = (customer) => {
  if (!customer) return customer;
  if (customer.toObject) customer = customer.toObject();
  if (customer.name) customer.name = customer.name.toUpperCase();
  if (customer.businessName) customer.businessName = customer.businessName.toUpperCase();
  if (customer.firstName) customer.firstName = customer.firstName.toUpperCase();
  if (customer.lastName) customer.lastName = customer.lastName.toUpperCase();
  return customer;
};

const transformProductToUppercase = (product) => {
  if (!product) return product;
  if (product.toObject) product = product.toObject();
  if (product.name) product.name = product.name.toUpperCase();
  if (product.description) product.description = product.description.toUpperCase();
  return product;
};

// @route   POST /api/sale-returns
// @desc    Create a new sale return request
// @access  Private (requires 'create_orders' permission)
router.post('/', [
  auth,
  requirePermission('create_orders'),
  sanitizeRequest,
  body('originalOrder').isMongoId().withMessage('Valid original order ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one return item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product ID is required'),
  body('items.*.originalOrderItem').isMongoId().withMessage('Valid order item ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required'),
  body('items.*.returnReason').isIn([
    'defective', 'wrong_item', 'not_as_described', 'damaged_shipping',
    'changed_mind', 'duplicate_order', 'size_issue', 'quality_issue',
    'late_delivery', 'other'
  ]).withMessage('Valid return reason is required'),
  body('items.*.condition').isIn(['new', 'like_new', 'good', 'fair', 'poor', 'damaged']).withMessage('Valid condition is required'),
  body('items.*.action').isIn(['refund', 'exchange', 'store_credit', 'repair', 'replace']).withMessage('Valid action is required'),
  body('refundMethod').optional().isIn(['original_payment', 'store_credit', 'cash', 'check', 'bank_transfer']),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  handleValidationErrors,
], async (req, res) => {
  try {
    // Ensure origin is set to 'sales'
    const returnData = {
      ...req.body,
      origin: 'sales',
      requestedBy: req.user._id
    };

    const returnRequest = await returnManagementService.createReturn(returnData, req.user._id);
    
    // Populate the return with related data
    await returnRequest.populate([
      { path: 'originalOrder', populate: { path: 'customer' } },
      { path: 'customer', select: 'name businessName email phone firstName lastName' },
      { path: 'items.product' },
      { path: 'requestedBy', select: 'firstName lastName email' }
    ]);

    // Transform names to uppercase
    if (returnRequest.customer) {
      returnRequest.customer = transformCustomerToUppercase(returnRequest.customer);
    }
    if (returnRequest.items && Array.isArray(returnRequest.items)) {
      returnRequest.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }
    if (returnRequest.originalOrder && returnRequest.originalOrder.customer) {
      returnRequest.originalOrder.customer = transformCustomerToUppercase(returnRequest.originalOrder.customer);
    }

    res.status(201).json({
      message: 'Sale return request created successfully',
      return: returnRequest
    });
  } catch (error) {
    console.error('Error creating sale return:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/sale-returns
// @desc    Get all sale returns with filters
// @access  Private
router.get('/', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'processing', 'received', 'completed', 'cancelled']),
  query('returnType').optional().isIn(['return', 'exchange', 'warranty', 'recall']),
  query('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  ...validateDateParams,
  handleValidationErrors,
  processDateFilter('returnDate'),
], async (req, res) => {
  try {
    const queryParams = {
      ...req.query,
      origin: 'sales' // Filter only sale returns
    };
    
    // Merge date filter from middleware if present (for Pakistan timezone)
    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      queryParams.dateFilter = req.dateFilter;
    }

    const result = await returnManagementService.getReturns(queryParams);

    res.json({
      success: true,
      data: result.returns,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching sale returns:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/sale-returns/:id
// @desc    Get single sale return by ID
// @access  Private
router.get('/:id', [
  auth,
  param('id').isMongoId().withMessage('Valid return ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const returnRequest = await returnManagementService.getReturnById(req.params.id);
    
    if (returnRequest.origin !== 'sales') {
      return res.status(404).json({ message: 'Sale return not found' });
    }

    res.json({
      success: true,
      data: returnRequest
    });
  } catch (error) {
    console.error('Error fetching sale return:', error);
    res.status(404).json({ message: error.message });
  }
});

// @route   GET /api/sale-returns/customer/:customerId/invoices
// @desc    Get customer's sales invoices eligible for return
// @access  Private
router.get('/customer/:customerId/invoices', [
  auth,
  param('customerId').isMongoId().withMessage('Valid customer ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { customerId } = req.params;
    const { limit = 50 } = req.query;

    // Get recent sales invoices for the customer
    const sales = await Sales.find({ customer: customerId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('items.product', 'name description')
      .select('orderNumber createdAt items pricing.total customerInfo');

    res.json({
      success: true,
      data: sales
    });
  } catch (error) {
    console.error('Error fetching customer invoices:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/sale-returns/customer/:customerId/products
// @desc    Search products sold to customer by name/SKU/barcode
// @access  Private
router.get('/customer/:customerId/products', [
  auth,
  param('customerId').isMongoId().withMessage('Valid customer ID is required'),
  query('search').optional().trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { customerId } = req.params;
    const { search } = req.query;
    const Return = require('../models/Return');
    const Product = require('../models/Product');

    // Get all sales for this customer
    const sales = await Sales.find({ customer: customerId })
      .populate('items.product', 'name sku barcode')
      .select('orderNumber createdAt items')
      .sort({ createdAt: -1 })
      .lean();

    // Collect all product items from sales
    const productMap = new Map();

    for (const sale of sales) {
      if (!sale.items || sale.items.length === 0) continue;

      for (const item of sale.items) {
        if (!item.product) continue;

        const productId = item.product._id.toString();
        const productName = item.product.name || '';
        const productSku = item.product.sku || '';
        const productBarcode = item.product.barcode || '';

        // Filter by search term if provided
        if (search) {
          const searchLower = search.toLowerCase();
          const matchesName = productName.toLowerCase().includes(searchLower);
          const matchesSku = productSku.toLowerCase().includes(searchLower);
          const matchesBarcode = productBarcode.toLowerCase().includes(searchLower);
          
          if (!matchesName && !matchesSku && !matchesBarcode) {
            continue;
          }
        }

        // Get existing returns for this order item
        const existingReturns = await Return.find({
          origin: 'sales',
          'items.originalOrderItem': item._id,
          status: { $nin: ['cancelled', 'rejected'] }
        }).lean();

        // Calculate returned quantity
        let returnedQuantity = 0;
        for (const returnDoc of existingReturns) {
          for (const returnItem of returnDoc.items || []) {
            if (returnItem.originalOrderItem && returnItem.originalOrderItem.toString() === item._id.toString()) {
              returnedQuantity += returnItem.quantity || 0;
            }
          }
        }

        const remainingQuantity = (item.quantity || 0) - returnedQuantity;

        if (remainingQuantity <= 0) continue;

        // Group by product, keeping track of all sales
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product: item.product,
            sales: []
          });
        }

        const productData = productMap.get(productId);
        productData.sales.push({
          orderId: sale._id,
          orderNumber: sale.orderNumber,
          orderItemId: item._id,
          quantitySold: item.quantity || 0,
          price: item.unitPrice || item.price || 0,
          date: sale.createdAt,
          returnedQuantity,
          remainingQuantity
        });
      }
    }

    // Convert map to array and format response
    const products = Array.from(productMap.values()).map(productData => {
      // Calculate totals across all sales
      const totalSold = productData.sales.reduce((sum, s) => sum + s.quantitySold, 0);
      const totalReturned = productData.sales.reduce((sum, s) => sum + s.returnedQuantity, 0);
      const totalRemaining = productData.sales.reduce((sum, s) => sum + s.remainingQuantity, 0);
      const latestSale = productData.sales.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      return {
        product: productData.product,
        totalQuantitySold: totalSold,
        totalReturnedQuantity: totalReturned,
        remainingReturnableQuantity: totalRemaining,
        previousPrice: latestSale.price,
        latestSaleDate: latestSale.date,
        sales: productData.sales
      };
    });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error searching customer products:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/sale-returns/:id/approve
// @desc    Approve sale return request
// @access  Private (requires 'approve_returns' permission)
router.put('/:id/approve', [
  auth,
  requirePermission('approve_returns'),
  param('id').isMongoId().withMessage('Valid return ID is required'),
  body('notes').optional().isString().isLength({ max: 1000 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const returnRequest = await returnManagementService.approveReturn(
      req.params.id,
      req.user._id,
      req.body.notes
    );

    if (returnRequest.origin !== 'sales') {
      return res.status(400).json({ message: 'This is not a sale return' });
    }

    res.json({
      success: true,
      message: 'Sale return approved successfully',
      data: returnRequest
    });
  } catch (error) {
    console.error('Error approving sale return:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/sale-returns/:id/reject
// @desc    Reject sale return request
// @access  Private (requires 'approve_returns' permission)
router.put('/:id/reject', [
  auth,
  requirePermission('approve_returns'),
  param('id').isMongoId().withMessage('Valid return ID is required'),
  body('reason').isString().isLength({ min: 1, max: 500 }).withMessage('Rejection reason is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const returnRequest = await returnManagementService.rejectReturn(
      req.params.id,
      req.user._id,
      req.body.reason
    );

    if (returnRequest.origin !== 'sales') {
      return res.status(400).json({ message: 'This is not a sale return' });
    }

    res.json({
      success: true,
      message: 'Sale return rejected successfully',
      data: returnRequest
    });
  } catch (error) {
    console.error('Error rejecting sale return:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/sale-returns/:id/process
// @desc    Process received sale return (complete with accounting)
// @access  Private (requires 'process_returns' permission)
router.put('/:id/process', [
  auth,
  requirePermission('process_returns'),
  param('id').isMongoId().withMessage('Valid return ID is required'),
  body('inspection').optional().isObject(),
  body('inspection.resellable').optional().isBoolean(),
  body('inspection.conditionVerified').optional().isBoolean(),
  body('inspection.inspectionNotes').optional().isString(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const returnRequest = await returnManagementService.processReceivedReturn(
      req.params.id,
      req.user._id,
      req.body.inspection || {}
    );

    if (returnRequest.origin !== 'sales') {
      return res.status(400).json({ message: 'This is not a sale return' });
    }

    res.json({
      success: true,
      message: 'Sale return processed successfully with accounting entries',
      data: returnRequest
    });
  } catch (error) {
    console.error('Error processing sale return:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/sale-returns/stats/summary
// @desc    Get sale return statistics
// @access  Private
router.get('/stats/summary', [
  auth,
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const period = {};
    if (req.query.startDate) period.startDate = new Date(req.query.startDate);
    if (req.query.endDate) period.endDate = new Date(req.query.endDate);

    const stats = await returnManagementService.getReturnStats(period);
    
    // Filter to only sale returns
    const saleReturnStats = {
      ...stats,
      origin: 'sales'
    };

    res.json({
      success: true,
      data: saleReturnStats
    });
  } catch (error) {
    console.error('Error fetching sale return stats:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
