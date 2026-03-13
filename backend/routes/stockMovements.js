const express = require('express');
const { body, query, param } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const stockMovementRepository = require('../repositories/postgres/StockMovementRepository');
const productRepository = require('../repositories/postgres/ProductRepository');

const router = express.Router();

const toStartOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const toEndOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const decodeHtmlEntities = (str) => {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
};

// Get all stock movements with filtering and pagination
router.get('/', [
  auth, 
  requirePermission('view_inventory'),
  query('page').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional({ checkFalsy: true }).trim(),
  query('product').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid product ID'),
  query('movementType').optional({ checkFalsy: true }).isIn([
    'purchase', 'sale', 'return_in', 'return_out', 'adjustment_in', 'adjustment_out',
    'transfer_in', 'transfer_out', 'damage', 'expiry', 'theft', 'production', 'consumption', 'initial_stock'
  ]).withMessage('Invalid movement type'),
  ...validateDateParams,
  query('location').optional({ checkFalsy: true }).isString().trim(),
  query('status').optional({ checkFalsy: true }).isIn(['pending', 'completed', 'cancelled', 'reversed']).withMessage('Invalid status'),
  handleValidationErrors,
  processDateFilter(['movementDate', 'createdAt']),
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      product,
      movementType,
      location,
      status,
      search
    } = req.query;
    const decodedSearch = decodeHtmlEntities(search);

    const filter = {};
    if (product) filter.product = product;
    if (movementType) filter.movementType = movementType;
    if (location) filter.location = location;
    if (status) filter.status = status;

    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      const df = req.dateFilter;
      if (df.movementDate) {
        if (df.movementDate.$gte) filter.dateFrom = df.movementDate.$gte;
        if (df.movementDate.$lte) filter.dateTo = df.movementDate.$lte;
      }
      if (df.createdAt) {
        if (df.createdAt.$gte) filter.dateFrom = filter.dateFrom || df.createdAt.$gte;
        if (df.createdAt.$lte) filter.dateTo = filter.dateTo || df.createdAt.$lte;
      }
      if (df.$or) {
        df.$or.forEach((cond) => {
          const c = cond.movementDate || cond.createdAt;
          if (c && c.$gte) filter.dateFrom = filter.dateFrom || c.$gte;
          if (c && c.$lte) filter.dateTo = filter.dateTo || c.$lte;
        });
      }
    }

    if (decodedSearch) {
      filter.searchIlike = decodedSearch;
      try {
        const matchingProducts = await productRepository.search(decodedSearch, { limit: 500 });
        if (matchingProducts.length > 0) {
          filter.productIds = matchingProducts.map(p => p.id || p._id).filter(Boolean);
        }
      } catch (productLookupError) {
        console.error('Error matching products for stock movement search:', productLookupError);
      }
    }

    const result = await stockMovementRepository.findWithPagination(filter, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    const movements = result.movements;
    const total = result.total;

    const summary = await stockMovementRepository.getSummary(filter);

    res.json({
      success: true,
      data: {
        movements,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        },
        summary: summary || {
          totalMovements: 0,
          totalValue: 0,
          stockIn: 0,
          stockOut: 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get stock movements for a specific product
router.get('/product/:productId', [
  auth, 
  requirePermission('view_inventory'),
  param('productId').isUUID(4).withMessage('Invalid product ID'),
  query('dateFrom').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date format'),
  query('dateTo').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date format'),
  query('movementType').optional({ checkFalsy: true }).isIn([
    'purchase', 'sale', 'return_in', 'return_out', 'adjustment_in', 'adjustment_out',
    'transfer_in', 'transfer_out', 'damage', 'expiry', 'theft', 'production', 'consumption', 'initial_stock'
  ]).withMessage('Invalid movement type')
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { dateFrom, dateTo, movementType } = req.query;

    const options = {};
    if (dateFrom) options.dateFrom = dateFrom;
    if (dateTo) options.dateTo = dateTo;
    if (movementType) options.movementType = movementType;

    const movements = await stockMovementRepository.getProductMovements(productId, options);
    const summary = await stockMovementRepository.getStockSummary(productId);
    const product = await productRepository.findById(productId);

    res.json({
      success: true,
      data: {
        movements,
        summary: summary[0] || {
          totalIn: 0,
          totalOut: 0,
          totalValueIn: 0,
          totalValueOut: 0
        },
        currentStock: product?.stock_quantity ?? product?.inventory?.currentStock ?? 0
      }
    });
  } catch (error) {
    console.error('Error fetching product stock movements:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get stock movement by ID
router.get('/:id', [
  auth, 
  requirePermission('view_inventory'),
  param('id').isUUID(4).withMessage('Invalid movement ID')
], async (req, res) => {
  try {
    const movement = await stockMovementRepository.findById(req.params.id);

    if (!movement) {
      return res.status(404).json({
        success: false,
        message: 'Stock movement not found'
      });
    }

    res.json({
      success: true,
      data: movement
    });
  } catch (error) {
    console.error('Error fetching stock movement:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create manual stock adjustment
router.post('/adjustment', [
  auth, 
  requirePermission('update_inventory'),
  body('productId').isUUID(4).withMessage('Invalid product ID'),
  body('movementType').isIn(['adjustment_in', 'adjustment_out']).withMessage('Invalid adjustment type'),
  body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be greater than 0'),
  body('unitCost').isFloat({ min: 0 }).withMessage('Unit cost must be non-negative'),
  body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Reason too long'),
  body('notes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Notes too long'),
  body('location').optional().isString().trim()
], async (req, res) => {
  try {
    const {
      productId,
      movementType,
      quantity,
      unitCost,
      reason,
      notes,
      location = 'main_warehouse'
    } = req.body;

    const product = await productRepository.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const currentStock = product.stock_quantity ?? product.inventory?.currentStock ?? 0;
    const newStock = movementType === 'adjustment_in'
      ? currentStock + quantity
      : currentStock - quantity;

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock for adjustment'
      });
    }

    const movement = await stockMovementRepository.create({
      product: productId,
      productId,
      productName: product.name,
      productSku: product.sku,
      movementType,
      quantity,
      unitCost,
      totalValue: quantity * unitCost,
      previousStock: currentStock,
      newStock,
      referenceType: 'adjustment',
      referenceId: productId,
      referenceNumber: `ADJ-${Date.now()}`,
      location,
      user: req.user.id || req.user._id,
      userId: req.user.id || req.user._id,
      userName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
      reason,
      notes,
      status: 'completed'
    });

    await productRepository.update(productId, { stockQuantity: newStock });

    res.status(201).json({
      success: true,
      message: 'Stock adjustment created successfully',
      data: movement
    });
  } catch (error) {
    console.error('Error creating stock adjustment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reverse a stock movement
router.post('/:id/reverse', [
  auth,
  requirePermission('update_inventory'),
  param('id').isUUID(4).withMessage('Invalid movement ID'),
  body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Reason too long')
], async (req, res) => {
  try {
    const movement = await stockMovementRepository.findById(req.params.id);
    if (!movement) {
      return res.status(404).json({
        success: false,
        message: 'Stock movement not found'
      });
    }

    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
    const reversedMovement = await stockMovementRepository.reverse(
      req.params.id,
      req.user.id || req.user._id,
      userName,
      req.body.reason
    );

    await productRepository.update(movement.product_id || movement.product, {
      stockQuantity: reversedMovement.new_stock ?? reversedMovement.newStock
    });
    await stockMovementRepository.updateStatus(req.params.id, 'reversed');

    res.json({
      success: true,
      message: 'Stock movement reversed successfully',
      data: reversedMovement
    });
  } catch (error) {
    console.error('Error reversing stock movement:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get stock movement statistics
router.get('/stats/overview', [
  auth,
  requirePermission('view_inventory'),
  query('dateFrom').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date format'),
  query('dateTo').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = {};
    if (dateFrom) filter.dateFrom = toStartOfDay(dateFrom);
    if (dateTo) filter.dateTo = toEndOfDay(dateTo);

    const [overview] = await stockMovementRepository.getStatsOverview(filter);
    const topProducts = await stockMovementRepository.getTopProducts(filter, 10);

    res.json({
      success: true,
      data: {
        overview: overview || { movements: [], totalMovements: 0, totalValue: 0 },
        topProducts
      }
    });
  } catch (error) {
    console.error('Error fetching stock movement stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
