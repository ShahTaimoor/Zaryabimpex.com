const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const inventoryService = require('../services/inventoryService');
const inventoryRepository = require('../repositories/InventoryRepository');
const productRepository = require('../repositories/ProductRepository');
const productService = require('../services/productServicePostgres');
const stockAdjustmentRepository = require('../repositories/StockAdjustmentRepository');

const router = express.Router();

// Helper function to transform product names to uppercase
const transformProductToUppercase = (product) => {
  if (!product) return product;
  if (product.toObject) product = product.toObject();
  if (product.name) product.name = product.name.toUpperCase();
  if (product.description) product.description = product.description.toUpperCase();
  return product;
};

// @route   GET /api/inventory
// @desc    Get inventory list with filters and pagination
// @access  Private (requires 'view_inventory' permission)
router.get('/', [
  auth,
  requirePermission('view_inventory'),
  sanitizeRequest,
  query('page').optional().custom((value) => {
    const page = parseInt(value);
    if (isNaN(page) || page < 1) {
      throw new Error('Page must be a positive integer');
    }
    return true;
  }),
  query('limit').optional().custom((value) => {
    const limit = parseInt(value);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    return true;
  }),
  query('search').optional().custom((value) => {
    if (!value || value === '') return true; // Allow empty values
    if (typeof value === 'string') {
      return true;
    }
    throw new Error('Search must be a string');
  }),
  query('status').optional().custom((value) => {
    if (!value || value === '') return true; // Allow empty values
    const validStatuses = ['active', 'inactive', 'out_of_stock'];
    if (validStatuses.includes(value)) {
      return true;
    }
    throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
  }),
  query('lowStock').optional().custom((value) => {
    if (value === 'true' || value === 'false' || value === true || value === false) {
      return true;
    }
    throw new Error('lowStock must be a boolean value');
  }),
  query('warehouse').optional().custom((value) => {
    if (!value || value === '') return true; // Allow empty values
    if (typeof value === 'string' && value.trim().length > 0) {
      return true;
    }
    throw new Error('Warehouse must be a non-empty string');
  }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, lowStock, warehouse } = req.query;
    const skip = (page - 1) * limit;

    // Get API-shaped products (all products so inventory page shows full catalog; filter by status in UI if needed)
    const productResult = await productService.getProducts({
      search: search || undefined,
      limit: 9999,
      all: 'true'
    });
    const allProducts = productResult.products || [];

    // Get existing inventory records (PostgreSQL)
    const invFilters = {};
    if (status) invFilters.status = status;
    if (warehouse) invFilters.warehouse = warehouse;
    const existingInventoryRows = await inventoryRepository.findAll(invFilters, { limit: 10000 });

    // Map product_id -> inventory row (with product attached from allProducts)
    const productById = new Map(allProducts.map(p => [(p.id || p._id).toString(), p]));
    const inventoryMap = new Map();
    existingInventoryRows.forEach(invRow => {
      const product = productById.get((invRow.product_id || invRow.productId || '').toString());
      if (product) {
        const location = (typeof invRow.location === 'string' ? (invRow.location ? JSON.parse(invRow.location) : {}) : invRow.location) || {};
        inventoryMap.set((invRow.product_id || invRow.productId).toString(), {
          _id: invRow.id,
          id: invRow.id,
          product: transformProductToUppercase(product),
          currentStock: invRow.current_stock ?? invRow.currentStock ?? 0,
          reorderPoint: invRow.reorder_point ?? invRow.reorderPoint ?? 0,
          reorderQuantity: invRow.reorder_quantity ?? invRow.reorderQuantity ?? 0,
          status: invRow.status || 'active',
          movements: (typeof invRow.movements === 'string' ? (invRow.movements ? JSON.parse(invRow.movements) : []) : invRow.movements) || [],
          location,
          createdAt: invRow.created_at ?? invRow.createdAt,
          updatedAt: invRow.updated_at ?? invRow.updatedAt
        });
      }
    });

    // Combine products with their inventory records (or synthetic)
    const combinedResults = allProducts.map(product => {
      const pid = (product.id || product._id).toString();
      const existingInv = inventoryMap.get(pid);
      if (existingInv) return existingInv;
      const transformedProduct = transformProductToUppercase(product);
      return {
        _id: `temp_${pid}`,
        product: transformedProduct,
        currentStock: product.inventory?.currentStock ?? 0,
        reorderPoint: product.inventory?.reorderPoint ?? product.inventory?.minStock ?? 0,
        reorderQuantity: product.inventory?.reorderQuantity ?? 0,
        status: 'active',
        movements: [],
        location: { warehouse: 'Main Warehouse' },
        createdAt: product.createdAt ?? product.created_at,
        updatedAt: product.updatedAt ?? product.updated_at
      };
    });
    
    // Apply additional filters
    let filteredResults = combinedResults;
    
    if (status) {
      filteredResults = filteredResults.filter(item => item.status === status);
    }
    
    if (warehouse) {
      filteredResults = filteredResults.filter(item => 
        item.location?.warehouse?.toLowerCase().includes(warehouse.toLowerCase())
      );
    }
    
    if (lowStock === 'true') {
      filteredResults = filteredResults.filter(item => 
        item.currentStock <= item.reorderPoint
      );
    }
    
    // Apply pagination
    const startIndex = skip;
    const endIndex = skip + parseInt(limit);
    const paginatedResults = filteredResults.slice(startIndex, endIndex);
    
    
    res.json({
      inventory: paginatedResults,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(filteredResults.length / limit),
        total: filteredResults.length,
        hasNext: endIndex < filteredResults.length,
        hasPrev: page > 1,
      },
    });
    return;
  } catch (error) {
    console.error('Error fetching inventory:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
    res.status(500).json({ message: 'Server error fetching inventory', error: error.message });
  }
});

// @route   GET /api/inventory/summary
// @desc    Get inventory summary statistics
// @access  Private (requires 'view_inventory' permission)
router.get('/summary', [
  auth,
  requirePermission('view_inventory'),
  sanitizeRequest,
  handleValidationErrors,
], async (req, res) => {
  try {
    const summary = await inventoryService.getInventorySummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    res.status(500).json({ message: 'Server error fetching inventory summary', error: error.message });
  }
});

// @route   GET /api/inventory/low-stock
// @desc    Get low stock items
// @access  Private (requires 'view_inventory' permission)
router.get('/low-stock', [
  auth,
  requirePermission('view_inventory'),
  sanitizeRequest,
  handleValidationErrors,
], async (req, res) => {
  try {
    const lowStockItems = await inventoryService.getLowStockItems();
    res.json({ items: lowStockItems });
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ message: 'Server error fetching low stock items', error: error.message });
  }
});

// @route   GET /api/inventory/:productId
// @desc    Get inventory details for a specific product
// @access  Private (requires 'view_inventory' permission)
router.get('/:productId', [
  auth,
  requirePermission('view_inventory'),
  sanitizeRequest,
  param('productId').isUUID(4).withMessage('Valid Product ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { productId } = req.params;
    const inventory = await inventoryService.getInventoryStatus(productId);
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory details:', error);
    res.status(500).json({ message: 'Server error fetching inventory details', error: error.message });
  }
});

// @route   GET /api/inventory/:productId/history
// @desc    Get inventory movement history for a product
// @access  Private (requires 'view_inventory' permission)
router.get('/:productId/history', [
  auth,
  requirePermission('view_inventory'),
  sanitizeRequest,
  param('productId').isUUID(4).withMessage('Valid Product ID is required'),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('type').optional().isIn(['in', 'out', 'adjustment', 'transfer', 'return', 'damage', 'theft']),
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 50, offset = 0, type, startDate, endDate } = req.query;
    
    const history = await inventoryService.getInventoryHistory({
      productId,
      limit: parseInt(limit),
      offset: parseInt(offset),
      type,
      startDate,
      endDate,
    });
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching inventory history:', error);
    res.status(500).json({ message: 'Server error fetching inventory history', error: error.message });
  }
});

// @route   POST /api/inventory/update-stock
// @desc    Update stock levels for a product
// @access  Private (requires 'update_inventory' permission)
router.post('/update-stock', [
  auth,
  requirePermission('update_inventory'),
  sanitizeRequest,
  body('productId').isUUID(4).withMessage('Valid Product ID is required'),
  body('type').isIn(['in', 'out', 'adjustment', 'transfer', 'return', 'damage', 'theft']).withMessage('Invalid movement type'),
  body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('reference').optional().trim(),
  body('referenceId').optional().isUUID(4),
  body('referenceModel').optional().isIn(['SalesOrder', 'PurchaseOrder', 'StockAdjustment', 'Transfer']),
  body('cost').optional().isFloat({ min: 0 }),
  body('notes').optional().trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const {
      productId,
      type,
      quantity,
      reason,
      reference,
      referenceId,
      referenceModel,
      cost,
      notes,
    } = req.body;

    const updatedInventory = await inventoryService.updateStock({
      productId,
      type,
      quantity,
      reason,
      reference,
      referenceId,
      referenceModel,
      cost,
      performedBy: req.user.id,
      notes,
    });

    res.json({
      message: 'Stock updated successfully',
      inventory: updatedInventory,
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ message: 'Server error updating stock', error: error.message });
  }
});

// @route   POST /api/inventory/bulk-update
// @desc    Bulk update stock levels for multiple products
// @access  Private (requires 'update_inventory' permission)
router.post('/bulk-update', [
  auth,
  requirePermission('update_inventory'),
  sanitizeRequest,
  body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
  body('updates.*.productId').isUUID(4).withMessage('Valid Product ID is required'),
  body('updates.*.type').isIn(['in', 'out', 'adjustment', 'transfer', 'return', 'damage', 'theft']).withMessage('Invalid movement type'),
  body('updates.*.quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('updates.*.reason').trim().notEmpty().withMessage('Reason is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { updates } = req.body;

    // Add performedBy to each update
    const updatesWithUser = updates.map(update => ({
      ...update,
      performedBy: req.user.id,
    }));

    const results = await inventoryService.bulkUpdateStock(updatesWithUser);
    
    res.json({
      message: 'Bulk stock update completed',
      results,
    });
  } catch (error) {
    console.error('Error in bulk stock update:', error);
    res.status(500).json({ message: 'Server error in bulk stock update', error: error.message });
  }
});

// @route   POST /api/inventory/reserve-stock
// @desc    Reserve stock for an order
// @access  Private (requires 'update_inventory' permission)
router.post('/reserve-stock', [
  auth,
  requirePermission('update_inventory'),
  sanitizeRequest,
  body('productId').isUUID(4).withMessage('Valid Product ID is required'),
  body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const inventory = await inventoryService.reserveStock({ productId, quantity });
    
    res.json({
      message: 'Stock reserved successfully',
      inventory,
    });
  } catch (error) {
    console.error('Error reserving stock:', error);
    res.status(500).json({ message: 'Server error reserving stock', error: error.message });
  }
});

// @route   POST /api/inventory/release-stock
// @desc    Release reserved stock
// @access  Private (requires 'update_inventory' permission)
router.post('/release-stock', [
  auth,
  requirePermission('update_inventory'),
  sanitizeRequest,
  body('productId').isUUID(4).withMessage('Valid Product ID is required'),
  body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const inventory = await inventoryService.releaseStock({ productId, quantity });
    
    res.json({
      message: 'Stock released successfully',
      inventory,
    });
  } catch (error) {
    console.error('Error releasing stock:', error);
    res.status(500).json({ message: 'Server error releasing stock', error: error.message });
  }
});

// @route   POST /api/inventory/adjustments
// @desc    Create a stock adjustment request
// @access  Private (requires 'create_inventory_adjustments' permission)
router.post('/adjustments', [
  auth,
  requirePermission('create_inventory_adjustments'),
  sanitizeRequest,
  body('type').isIn(['physical_count', 'damage', 'theft', 'transfer', 'correction', 'return', 'write_off']).withMessage('Invalid adjustment type'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('adjustments').isArray({ min: 1 }).withMessage('Adjustments array is required'),
  body('adjustments.*.product').isUUID(4).withMessage('Valid Product ID is required'),
  body('adjustments.*.currentStock').isFloat({ min: 0 }).withMessage('Current stock must be a non-negative number'),
  body('adjustments.*.adjustedStock').isFloat({ min: 0 }).withMessage('Adjusted stock must be a non-negative number'),
  body('warehouse').optional().trim(),
  body('notes').optional().trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { type, reason, adjustments, warehouse, notes } = req.body;

    // Calculate variances
    const adjustmentsWithVariance = adjustments.map(adj => ({
      ...adj,
      variance: adj.adjustedStock - adj.currentStock,
    }));

    const adjustment = await inventoryService.processStockAdjustment({
      adjustments: adjustmentsWithVariance,
      type,
      reason,
      requestedBy: req.user.id,
      warehouse,
      notes,
    });

    res.status(201).json({
      message: 'Stock adjustment request created successfully',
      adjustment,
    });
  } catch (error) {
    console.error('Error creating stock adjustment:', error);
    res.status(500).json({ message: 'Server error creating stock adjustment', error: error.message });
  }
});

// @route   GET /api/inventory/adjustments
// @desc    Get stock adjustment requests
// @access  Private (requires 'view_inventory_adjustments' permission)
router.get('/adjustments', [
  auth,
  requirePermission('view_inventory_adjustments'),
  sanitizeRequest,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'completed']),
  query('type').optional().isIn(['physical_count', 'damage', 'theft', 'transfer', 'correction', 'return', 'write_off']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const { adjustments, total, pagination } = await stockAdjustmentRepository.findWithPagination(filter, {
      page,
      limit,
      sort: { requestedDate: -1 },
      populate: [
        { path: 'requestedBy', select: 'firstName lastName' },
        { path: 'approvedBy', select: 'firstName lastName' },
        { path: 'completedBy', select: 'firstName lastName' },
        { path: 'adjustments.product', select: 'name description' }
      ]
    });

    res.json({
      adjustments,
      pagination
    });
  } catch (error) {
    console.error('Error fetching stock adjustments:', error);
    res.status(500).json({ message: 'Server error fetching stock adjustments', error: error.message });
  }
});

// @route   PUT /api/inventory/adjustments/:adjustmentId/approve
// @desc    Approve a stock adjustment request
// @access  Private (requires 'approve_inventory_adjustments' permission)
router.put('/adjustments/:adjustmentId/approve', [
  auth,
  requirePermission('approve_inventory_adjustments'),
  sanitizeRequest,
  param('adjustmentId').isUUID(4).withMessage('Valid Adjustment ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { adjustmentId } = req.params;

    const adjustment = await stockAdjustmentRepository.approveAdjustment(adjustmentId, req.user.id);
    
    res.json({
      message: 'Stock adjustment approved successfully',
      adjustment,
    });
  } catch (error) {
    console.error('Error approving stock adjustment:', error);
    res.status(500).json({ message: 'Server error approving stock adjustment', error: error.message });
  }
});

// @route   PUT /api/inventory/adjustments/:adjustmentId/complete
// @desc    Complete a stock adjustment
// @access  Private (requires 'complete_inventory_adjustments' permission)
router.put('/adjustments/:adjustmentId/complete', [
  auth,
  requirePermission('complete_inventory_adjustments'),
  sanitizeRequest,
  param('adjustmentId').isUUID(4).withMessage('Valid Adjustment ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { adjustmentId } = req.params;

    const adjustment = await stockAdjustmentRepository.completeAdjustment(adjustmentId, req.user.id);
    
    res.json({
      message: 'Stock adjustment completed successfully',
      adjustment,
    });
  } catch (error) {
    console.error('Error completing stock adjustment:', error);
    res.status(500).json({ message: 'Server error completing stock adjustment', error: error.message });
  }
});

module.exports = router;