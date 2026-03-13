const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const returnManagementService = require('../services/returnManagementService');
const ReturnRepository = require('../repositories/postgres/ReturnRepository');
const PurchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');

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
  body('originalOrder').isUUID(4).withMessage('Valid original purchase invoice/order ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one return item is required'),
  body('items.*.product').isUUID(4).withMessage('Valid product ID is required'),
  body('items.*.originalOrderItem').notEmpty().withMessage('Valid order item ID is required'),
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
  body('deferProcess').optional().isBoolean().withMessage('deferProcess must be boolean'),
  handleValidationErrors,
], async (req, res) => {
  try {
    // Ensure origin is set to 'purchase'
    const userId = req.user?.id || req.user?._id;
    const returnData = {
      ...req.body,
      origin: 'purchase',
      requestedBy: userId
    };

    const returnRequest = await returnManagementService.createReturn(returnData, userId);

    if (typeof returnRequest.populate === 'function') {
      await returnRequest.populate([
        { path: 'originalOrder', populate: { path: 'supplier' } },
        { path: 'supplier' },
        { path: 'items.product' },
        { path: 'requestedBy' }
      ]);
    }
    if (returnRequest.supplier) returnRequest.supplier = transformSupplierToUppercase(returnRequest.supplier);
    if (returnRequest.items && Array.isArray(returnRequest.items)) {
      returnRequest.items.forEach(item => {
        if (item.product) item.product = transformProductToUppercase(item.product);
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
  query('status').optional().isIn(['pending', 'inspected', 'approved', 'rejected', 'processing', 'received', 'completed', 'processed', 'cancelled']),
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
  param('id').isUUID(4).withMessage('Valid return ID is required'),
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
  param('supplierId').isUUID(4).withMessage('Valid supplier ID is required'),
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
  param('supplierId').isUUID(4).withMessage('Valid supplier ID is required'),
  query('search').optional().trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { search } = req.query;
    const ProductRepository = require('../repositories/postgres/ProductRepository');

    const invoices = await PurchaseInvoiceRepository.findAll(
      { supplierId, supplier: supplierId },
      { limit: 500, sort: 'created_at DESC' }
    );

    const productMap = new Map();
    for (const invoice of invoices || []) {
      let items = invoice.items;
      if (typeof items === 'string') items = JSON.parse(items);
      if (!items || items.length === 0) continue;
      const invoiceId = invoice.id || invoice._id;
      const existingReturns = await ReturnRepository.findAll({ referenceId: invoiceId, returnType: 'purchase_return' });

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const productId = item.product || item.product_id;
        if (!productId) continue;
        const id = typeof productId === 'object' ? (productId.id || productId._id) : productId;
        const product = await ProductRepository.findById(id);
        const productName = product?.name || '';
        const productSku = product?.sku || '';
        const productBarcode = product?.barcode || '';

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

        const itemId = item.id || item._id || `${invoiceId}-${idx}`;
        let returnedQuantity = 0;
        for (const returnDoc of existingReturns || []) {
          if (['cancelled', 'rejected'].includes(returnDoc.status)) continue;
          const docItems = returnDoc.items && (typeof returnDoc.items === 'string' ? JSON.parse(returnDoc.items) : returnDoc.items) || [];
          for (const returnItem of docItems) {
            if (String(returnItem.originalOrderItem) === String(itemId)) returnedQuantity += returnItem.quantity || 0;
          }
        }

        const remainingQuantity = (item.quantity || 0) - returnedQuantity;
        if (remainingQuantity <= 0) continue;

        if (!productMap.has(id)) productMap.set(id, { product, purchases: [] });
        const productData = productMap.get(id);
        productData.purchases.push({
          invoiceId,
          invoiceNumber: invoice.invoice_number || invoice.invoiceNumber,
          invoiceItemId: itemId,
          quantityPurchased: item.quantity || 0,
          price: item.unit_cost || item.unitCost || item.price || 0,
          date: invoice.created_at || invoice.createdAt,
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
  param('id').isUUID(4).withMessage('Valid return ID is required'),
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
  param('id').isUUID(4).withMessage('Valid return ID is required'),
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
  param('id').isUUID(4).withMessage('Valid return ID is required'),
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
  query('startDate').optional().custom((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v)).withMessage('startDate must be YYYY-MM-DD'),
  query('endDate').optional().custom((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v)).withMessage('endDate must be YYYY-MM-DD'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');
    const period = {};
    if (req.query.startDate) period.startDate = getStartOfDayPakistan(req.query.startDate);
    if (req.query.endDate) period.endDate = getEndOfDayPakistan(req.query.endDate);
    period.origin = 'purchase'; // Only purchase returns

    const stats = await returnManagementService.getReturnStats(period);

    res.json({
      success: true,
      data: { ...stats, origin: 'purchase' }
    });
  } catch (error) {
    console.error('Error fetching purchase return stats:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;