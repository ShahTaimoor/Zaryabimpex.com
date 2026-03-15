const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const ProductTransformation = require('../models/ProductTransformation'); // Still needed for new ProductTransformation()
const ProductVariant = require('../models/ProductVariant'); // Still needed for model reference
const Product = require('../models/Product'); // Still needed for model reference
const Inventory = require('../models/Inventory'); // Still needed for new Inventory()
const StockMovement = require('../models/StockMovement'); // Still needed for new StockMovement()
const { auth, requirePermission } = require('../middleware/auth');
const productTransformationRepository = require('../repositories/ProductTransformationRepository');
const productVariantRepository = require('../repositories/ProductVariantRepository');
const productRepository = require('../repositories/ProductRepository');
const inventoryRepository = require('../repositories/InventoryRepository');
const stockMovementRepository = require('../repositories/StockMovementRepository');

// @route   GET /api/product-transformations
// @desc    Get all product transformations with filters
// @access  Private
router.get('/', [
  auth,
  requirePermission('view_inventory'),
  query('baseProduct').optional().isMongoId(),
  query('targetVariant').optional().isMongoId(),
  query('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
  query('transformationType').optional().isIn(['color', 'warranty', 'size', 'finish', 'custom']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { baseProduct, targetVariant, status, transformationType, startDate, endDate } = req.query;
    const filter = {};

    if (baseProduct) filter.baseProduct = baseProduct;
    if (targetVariant) filter.targetVariant = targetVariant;
    if (status) filter.status = status;
    if (transformationType) filter.transformationType = transformationType;
    if (startDate || endDate) {
      filter.transformationDate = {};
      if (startDate) filter.transformationDate.$gte = new Date(startDate);
      if (endDate) filter.transformationDate.$lte = new Date(endDate);
    }

    const transformations = await productTransformationRepository.findWithFilter(filter, {
      sort: { transformationDate: -1 },
      populate: [
        { path: 'baseProduct', select: 'name description pricing' },
        { path: 'targetVariant', select: 'variantName displayName pricing transformationCost' },
        { path: 'performedBy', select: 'firstName lastName' }
      ]
    });

    res.json({
      success: true,
      count: transformations.length,
      transformations
    });
  } catch (error) {
    console.error('Error fetching product transformations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/product-transformations/:id
// @desc    Get single product transformation
// @access  Private
router.get('/:id', [
  auth,
  requirePermission('view_inventory'),
  param('id').isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transformation = await productTransformationRepository.findById(req.params.id, {
      populate: [
        { path: 'baseProduct', select: 'name description pricing inventory' },
        { path: 'targetVariant', select: 'variantName displayName pricing transformationCost inventory' },
        { path: 'performedBy', select: 'firstName lastName email' }
      ]
    });

    if (!transformation) {
      return res.status(404).json({ message: 'Product transformation not found' });
    }

    res.json({
      success: true,
      transformation
    });
  } catch (error) {
    console.error('Error fetching product transformation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/product-transformations
// @desc    Create and execute product transformation
// @access  Private
router.post('/', [
  auth,
  requirePermission('update_inventory'),
  body('baseProduct').isMongoId().withMessage('Valid base product ID is required'),
  body('targetVariant').isMongoId().withMessage('Valid target variant ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('unitTransformationCost').optional().isFloat({ min: 0 }),
  body('notes').optional().isString().trim().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { baseProduct, targetVariant, quantity, unitTransformationCost, notes } = req.body;

    // Get base product
    const baseProductDoc = await productRepository.findById(baseProduct);
    if (!baseProductDoc) {
      return res.status(404).json({ message: 'Base product not found' });
    }

    // Get target variant
    const variantDoc = await productVariantRepository.findById(targetVariant, {
      populate: [{ path: 'baseProduct' }]
    });
    
    if (!variantDoc) {
      return res.status(404).json({ message: 'Target variant not found' });
    }

    // Verify variant belongs to base product
    if (variantDoc.baseProduct._id.toString() !== baseProduct.toString()) {
      return res.status(400).json({ 
        message: 'Target variant does not belong to the specified base product' 
      });
    }

    // Check base product stock
    const baseInventory = await inventoryRepository.findByProduct(baseProduct);
    if (!baseInventory || baseInventory.currentStock < quantity) {
      return res.status(400).json({ 
        message: `Insufficient stock. Available: ${baseInventory?.currentStock || 0}, Required: ${quantity}` 
      });
    }

    // Get or create variant inventory
    let variantInventory = await inventoryRepository.findByProduct(targetVariant);
    if (!variantInventory) {
      variantInventory = new Inventory({
        product: targetVariant,
        currentStock: 0,
        reorderPoint: variantDoc.inventory.minStock || 10,
        reorderQuantity: 50,
        status: 'active'
      });
      await variantInventory.save();
    }

    // Record stock levels before transformation
    const baseStockBefore = baseInventory.currentStock;
    const baseStockAfter = baseStockBefore - quantity;
    const variantStockBefore = variantInventory.currentStock;
    const variantStockAfter = variantStockBefore + quantity;

    // Use provided cost or variant's default transformation cost
    const transformationCost = unitTransformationCost !== undefined 
      ? unitTransformationCost 
      : variantDoc.transformationCost;
    const totalCost = quantity * transformationCost;

    // Create transformation record
    const transformation = new ProductTransformation({
      baseProduct,
      baseProductName: baseProductDoc.name,
      targetVariant,
      targetVariantName: variantDoc.displayName,
      quantity,
      unitTransformationCost: transformationCost,
      totalTransformationCost: totalCost,
      baseProductStockBefore: baseStockBefore,
      baseProductStockAfter: baseStockAfter,
      variantStockBefore: variantStockBefore,
      variantStockAfter: variantStockAfter,
      transformationType: variantDoc.variantType,
      notes,
      status: 'completed',
      performedBy: req.user._id,
      transformationDate: new Date(),
      completedAt: new Date()
    });

    await transformation.save();

    // Update base product stock (decrease)
    baseInventory.currentStock = baseStockAfter;
    baseInventory.movements.push({
      type: 'out',
      quantity: quantity,
      reason: `Transformed to variant: ${variantDoc.displayName}`,
      reference: transformation.transformationNumber,
      referenceId: transformation._id,
      referenceModel: 'ProductTransformation',
      cost: baseProductDoc.pricing.cost,
      date: new Date(),
      performedBy: req.user._id,
      notes: `Product transformation: ${transformation.transformationNumber}`
    });
    await baseInventory.save();

    // Update base product document
    baseProductDoc.inventory.currentStock = baseStockAfter;
    await baseProductDoc.save();

    // Update variant stock (increase)
    variantInventory.currentStock = variantStockAfter;
    variantInventory.movements.push({
      type: 'in',
      quantity: quantity,
      reason: `Transformed from base product: ${baseProductDoc.name}`,
      reference: transformation.transformationNumber,
      referenceId: transformation._id,
      referenceModel: 'ProductTransformation',
      cost: baseProductDoc.pricing.cost + transformationCost,
      date: new Date(),
      performedBy: req.user._id,
      notes: `Product transformation: ${transformation.transformationNumber}`
    });
    await variantInventory.save();

    // Update variant document
    variantDoc.inventory.currentStock = variantStockAfter;
    await variantDoc.save();

    // Get user name for StockMovement
    const userName = req.user.firstName && req.user.lastName 
      ? `${req.user.firstName} ${req.user.lastName}`
      : req.user.email || 'System User';

    // Create stock movement records
    const baseMovement = new StockMovement({
      product: baseProduct,
      productName: baseProductDoc.name,
      movementType: 'consumption',
      quantity: quantity,
      unitCost: baseProductDoc.pricing.cost,
      totalValue: quantity * baseProductDoc.pricing.cost,
      previousStock: baseStockBefore,
      newStock: baseStockAfter,
      referenceType: 'production',
      referenceId: transformation._id,
      referenceNumber: transformation.transformationNumber,
      notes: `Transformed to ${variantDoc.displayName}`,
      user: req.user._id,
      userName: userName
    });
    await baseMovement.save();

    const variantMovement = new StockMovement({
      product: targetVariant,
      productName: variantDoc.displayName,
      movementType: 'production',
      quantity: quantity,
      unitCost: baseProductDoc.pricing.cost + transformationCost,
      totalValue: quantity * (baseProductDoc.pricing.cost + transformationCost),
      previousStock: variantStockBefore,
      newStock: variantStockAfter,
      referenceType: 'production',
      referenceId: transformation._id,
      referenceNumber: transformation.transformationNumber,
      notes: `Transformed from ${baseProductDoc.name}`,
      user: req.user._id,
      userName: userName
    });
    await variantMovement.save();

    const populatedTransformation = await productTransformationRepository.findById(transformation._id, {
      populate: [
        { path: 'baseProduct', select: 'name description pricing' },
        { path: 'targetVariant', select: 'variantName displayName pricing' },
        { path: 'performedBy', select: 'firstName lastName' }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Product transformation completed successfully',
      transformation: populatedTransformation
    });
  } catch (error) {
    console.error('Error creating product transformation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/product-transformations/:id/cancel
// @desc    Cancel a pending transformation
// @access  Private
router.put('/:id/cancel', [
  auth,
  requirePermission('update_inventory'),
  param('id').isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transformation = await productTransformationRepository.findById(req.params.id);
    if (!transformation) {
      return res.status(404).json({ message: 'Product transformation not found' });
    }

    if (transformation.status === 'completed') {
      return res.status(400).json({ 
        message: 'Cannot cancel a completed transformation. Please create a reverse transformation instead.' 
      });
    }

    transformation.status = 'cancelled';
    await transformation.save();

    res.json({
      success: true,
      message: 'Product transformation cancelled successfully',
      transformation
    });
  } catch (error) {
    console.error('Error cancelling product transformation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

