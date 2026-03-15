const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const returnManagementService = require('../services/returnManagementService');
const ReturnRepository = require('../repositories/ReturnRepository');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const PurchaseOrder = require('../models/PurchaseOrder');

const router = express.Router();

// Helper functions to transform names to uppercase
const transformSupplierToUppercase = (supplier) => {
  if (!supplier) return supplier;
  if (supplier.toObject) supplier = supplier.toObject();
  if (supplier.name) supplier.name = supplier.name.toUpperCase();
  if (supplier.businessName) supplier.businessName = supplier.businessName.toUpperCase();
  if (supplier.companyName) supplier.companyName = supplier.companyName.toUpperCase();
  return supplier;
};

const transformProductToUppercase = (product) => {
  if (!product) return product;
  if (product.toObject) product = product.toObject();
  if (product.name) product.name = product.name.toUpperCase();
  if (product.description) product.description = product.description.toUpperCase();
  return product;
};

// @route   POST /api/purchase-returns
// @desc    Create a new purchase return request
// @access  Private (requires 'create_orders' permission)
router.post('/', [
  auth,
  requirePermission('create_orders'),
  sanitizeRequest,
  body('originalOrder').isMongoId().withMessage('Valid original purchase invoice/order ID is required'),
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
    // Ensure origin is set to 'purchase'
    const returnData = {
      ...req.body,
      origin: 'purchase',
      requestedBy: req.user._id
    };

    const returnRequest = await returnManagementService.createReturn(returnData, req.user._id);
    
    // Populate the return with related data
    await returnRequest.populate([
      { path: 'originalOrder', populate: { path: 'supplier' } },
      { path: 'supplier', select: 'name businessName email phone companyName contactPerson' },
      { path: 'items.product' },
      { path: 'requestedBy', select: 'firstName lastName email' }
    ]);

    // Transform names to uppercase
    if (returnRequest.supplier) {
      returnRequest.supplier = transformSupplierToUppercase(returnRequest.supplier);
    }
    if (returnRequest.items && Array.isArray(returnRequest.items)) {
      returnRequest.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }
    if (returnRequest.originalOrder && returnRequest.originalOrder.supplier) {
      returnRequest.originalOrder.supplier = transformSupplierToUppercase(returnRequest.originalOrder.supplier);
    }

    res.status(201).json({
      message: 'Purchase return request created successfully',
      return: returnRequest
    });
  } catch (error) {
    console.error('Error creating purchase return:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/purchase-returns
// @desc    Get all purchase returns with filters
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
      origin: 'purchase' // Filter only purchase returns
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
    console.error('Error fetching purchase returns:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/purchase-returns/:id
// @desc    Get single purchase return by ID
// @access  Private
router.get('/:id', [
  auth,
  param('id').isMongoId().withMessage('Valid return ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const returnRequest = await returnManagementService.getReturnById(req.params.id);
    
    if (returnRequest.origin !== 'purchase') {
      return res.status(404).json({ message: 'Purchase return not found' });
    }

    res.json({
      success: true,
      data: returnRequest
    });
  } catch (error) {
    console.error('Error fetching purchase return:', error);
    res.status(404).json({ message: error.message });
  }
});

// @route   GET /api/purchase-returns/supplier/:supplierId/invoices
// @desc    Get supplier's purchase invoices eligible for return
// @access  Private
router.get('/supplier/:supplierId/invoices', [
  auth,
  param('supplierId').isMongoId().withMessage('Valid supplier ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { limit = 50 } = req.query;

    // Get recent purchase invoices for the supplier
    const invoices = await PurchaseInvoice.find({ supplier: supplierId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('items.product', 'name description')
      .select('invoiceNumber createdAt items pricing.total supplierInfo');

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('Error fetching supplier invoices:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/purchase-returns/supplier/:supplierId/products
// @desc    Search products purchased from supplier by name/SKU/barcode
// @access  Private
router.get('/supplier/:supplierId/products', [
  auth,
  param('supplierId').isMongoId().withMessage('Valid supplier ID is required'),
  query('search').optional().trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { search } = req.query;
    const Return = require('../models/Return');
    const Product = require('../models/Product');

    // Get all purchase invoices for this supplier
    const invoices = await PurchaseInvoice.find({ supplier: supplierId })
      .populate('items.product', 'name sku barcode')
      .select('invoiceNumber createdAt items')
      .sort({ createdAt: -1 })
      .lean();

    // Collect all product items from invoices
    const productMap = new Map();

    for (const invoice of invoices) {
      if (!invoice.items || invoice.items.length === 0) continue;

      for (const item of invoice.items) {
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

        // Get existing returns for this invoice item
        const existingReturns = await Return.find({
          origin: 'purchase',
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

        // Group by product, keeping track of all purchases
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product: item.product,
            purchases: []
          });
        }

        const productData = productMap.get(productId);
        productData.purchases.push({
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceItemId: item._id,
          quantityPurchased: item.quantity || 0,
          price: item.unitCost || item.price || 0,
          date: invoice.createdAt,
          returnedQuantity,
          remainingQuantity
        });
      }
    }

    // Convert map to array and format response
    const products = Array.from(productMap.values()).map(productData => {
      // Calculate totals across all purchases
      const totalPurchased = productData.purchases.reduce((sum, p) => sum + p.quantityPurchased, 0);
      const totalReturned = productData.purchases.reduce((sum, p) => sum + p.returnedQuantity, 0);
      const totalRemaining = productData.purchases.reduce((sum, p) => sum + p.remainingQuantity, 0);
      const latestPurchase = productData.purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      return {
        product: productData.product,
        totalQuantityPurchased: totalPurchased,
        totalReturnedQuantity: totalReturned,
        remainingReturnableQuantity: totalRemaining,
        previousPrice: latestPurchase.price,
        latestPurchaseDate: latestPurchase.date,
        purchases: productData.purchases
      };
    });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error searching supplier products:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/purchase-returns/:id/approve
// @desc    Approve purchase return request
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

    if (returnRequest.origin !== 'purchase') {
      return res.status(400).json({ message: 'This is not a purchase return' });
    }

    res.json({
      success: true,
      message: 'Purchase return approved successfully',
      data: returnRequest
    });
  } catch (error) {
    console.error('Error approving purchase return:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/purchase-returns/:id/reject
// @desc    Reject purchase return request
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

    if (returnRequest.origin !== 'purchase') {
      return res.status(400).json({ message: 'This is not a purchase return' });
    }

    res.json({
      success: true,
      message: 'Purchase return rejected successfully',
      data: returnRequest
    });
  } catch (error) {
    console.error('Error rejecting purchase return:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/purchase-returns/:id/process
// @desc    Process received purchase return (complete with accounting)
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

    if (returnRequest.origin !== 'purchase') {
      return res.status(400).json({ message: 'This is not a purchase return' });
    }

    res.json({
      success: true,
      message: 'Purchase return processed successfully with accounting entries',
      data: returnRequest
    });
  } catch (error) {
    console.error('Error processing purchase return:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/purchase-returns/stats/summary
// @desc    Get purchase return statistics
// @access  Private
router.get('/stats/summary', [
  auth,
  ...validateDateParams,
  handleValidationErrors,
  processDateFilter('createdAt'),
], async (req, res) => {
  try {
    const period = {};
    if (req.dateRange.startDate) period.startDate = req.dateRange.startDate;
    if (req.dateRange.endDate) period.endDate = req.dateRange.endDate;

    const stats = await returnManagementService.getReturnStats(period);
    
    // Filter to only purchase returns
    const purchaseReturnStats = {
      ...stats,
      origin: 'purchase'
    };

    res.json({
      success: true,
      data: purchaseReturnStats
    });
  } catch (error) {
    console.error('Error fetching purchase return stats:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;