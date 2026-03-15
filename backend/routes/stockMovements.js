const express = require('express');
const { body, query, param } = require('express-validator');
const StockMovement = require('../models/StockMovement'); // Still needed for new StockMovement() and static methods
const Product = require('../models/Product'); // Still needed for model reference
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const stockMovementRepository = require('../repositories/StockMovementRepository');
const productRepository = require('../repositories/ProductRepository');

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
  query('product').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid product ID'),
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

    // Build query
    const query = {};
    
    if (product) query.product = product;
    if (movementType) query.movementType = movementType;
    if (location) query.location = location;
    if (status) query.status = status;
    
    // Date range filter - use dateFilter from middleware (Pakistan timezone)
    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      Object.assign(query, req.dateFilter);
    }
    
    if (decodedSearch) {
      const searchVariants = Array.from(new Set([
        decodedSearch,
        search
      ].filter(Boolean)));

      const orConditions = [];

      for (const variant of searchVariants) {
        orConditions.push(
          { productName: { $regex: variant, $options: 'i' } },
          { productSku: { $regex: variant, $options: 'i' } },
          { referenceNumber: { $regex: variant, $options: 'i' } },
          { userName: { $regex: variant, $options: 'i' } },
          { notes: { $regex: variant, $options: 'i' } }
        );
      }

      try {
        const matchingProducts = await productRepository.findAll({
          name: { $regex: decodedSearch, $options: 'i' }
        }, { select: '_id' });

        if (matchingProducts.length > 0) {
          orConditions.push({
            product: { $in: matchingProducts.map(product => product._id) }
          });
        }
      } catch (productLookupError) {
        console.error('Error matching products for stock movement search:', productLookupError);
      }

      if (orConditions.length > 0) {
        query.$or = orConditions;
      }
    }

    // Get movements with pagination
    const result = await stockMovementRepository.findWithPagination(query, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'product', select: 'name sku category' },
        { path: 'user', select: 'firstName lastName email' },
        { path: 'supplier', select: 'name' },
        { path: 'customer', select: 'name businessName' }
      ],
      lean: true
    });
    
    const movements = result.movements;
    const total = result.total;

    // Calculate summary statistics
    const summary = await stockMovementRepository.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalMovements: { $sum: 1 },
          totalValue: { $sum: '$totalValue' },
          stockIn: {
            $sum: {
              $cond: [
                { $in: ['$movementType', ['purchase', 'return_in', 'adjustment_in', 'transfer_in', 'production', 'initial_stock']] },
                '$quantity',
                0
              ]
            }
          },
          stockOut: {
            $sum: {
              $cond: [
                { $in: ['$movementType', ['sale', 'return_out', 'adjustment_out', 'transfer_out', 'damage', 'expiry', 'theft', 'consumption']] },
                '$quantity',
                0
              ]
            }
          }
        }
      }
    ]);

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
        summary: summary[0] || {
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
  param('productId').isMongoId().withMessage('Invalid product ID'),
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

    const movements = await StockMovement.getProductMovements(productId, options);
    
    // Get stock summary
    const summary = await StockMovement.getStockSummary(productId);
    
    // Get current stock from product
    const product = await productRepository.findById(productId, {
      select: 'inventory.currentStock'
    });

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
        currentStock: product?.inventory?.currentStock || 0
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
  param('id').isMongoId().withMessage('Invalid movement ID')
], async (req, res) => {
  try {
    const movement = await stockMovementRepository.findById(req.params.id, {
      populate: [
        { path: 'product', select: 'name sku category' },
        { path: 'user', select: 'firstName lastName email' },
        { path: 'supplier', select: 'name' },
        { path: 'customer', select: 'name businessName' },
        { path: 'originalMovement' },
        { path: 'reversedBy', select: 'firstName lastName' }
      ]
    });

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
  body('productId').isMongoId().withMessage('Invalid product ID'),
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

    // Get product
    const product = await productRepository.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const currentStock = product.inventory.currentStock || 0;
    const newStock = movementType === 'adjustment_in' 
      ? currentStock + quantity 
      : currentStock - quantity;

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock for adjustment'
      });
    }

    // Create stock movement
    const movement = new StockMovement({
      product: productId,
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
      user: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      reason,
      notes,
      status: 'completed'
    });

    await movement.save();

    // Update product stock
    product.inventory.currentStock = newStock;
    await product.save();

    // Populate and return
    await movement.populate([
      { path: 'product', select: 'name sku category' },
      { path: 'user', select: 'firstName lastName email' }
    ]);

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
  param('id').isMongoId().withMessage('Invalid movement ID'),
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

    const reversedMovement = await movement.reverse(req.user._id, req.body.reason);
    
    // Update product stock
    const product = await productRepository.findById(movement.product);
    if (product) {
      product.inventory.currentStock = reversedMovement.newStock;
      await product.save();
    }

    // Mark original movement as reversed
    movement.status = 'reversed';
    await movement.save();

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
    
    const matchStage = {};
    if (dateFrom || dateTo) {
      matchStage.createdAt = {};
      const fromDate = toStartOfDay(dateFrom);
      const toDate = toEndOfDay(dateTo);
      if (fromDate) matchStage.createdAt.$gte = fromDate;
      if (toDate) matchStage.createdAt.$lte = toDate;
      if (Object.keys(matchStage.createdAt).length === 0) {
        delete matchStage.createdAt;
      }
    }

    const stats = await stockMovementRepository.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$movementType',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: '$totalValue' }
        }
      },
      {
        $group: {
          _id: null,
          movements: {
            $push: {
              type: '$_id',
              count: '$count',
              totalQuantity: '$totalQuantity',
              totalValue: '$totalValue'
            }
          },
          totalMovements: { $sum: '$count' },
          totalValue: { $sum: '$totalValue' }
        }
      }
    ]);

    // Get top products by movement
    const topProducts = await stockMovementRepository.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$product',
          productName: { $first: '$productName' },
          totalMovements: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: '$totalValue' }
        }
      },
      { $sort: { totalMovements: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || { movements: [], totalMovements: 0, totalValue: 0 },
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
