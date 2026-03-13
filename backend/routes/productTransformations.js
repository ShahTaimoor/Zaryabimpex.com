const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const productTransformationRepository = require('../repositories/ProductTransformationRepository');
const productVariantRepository = require('../repositories/ProductVariantRepository');
const productRepository = require('../repositories/ProductRepository');
const inventoryRepository = require('../repositories/InventoryRepository');
const stockMovementRepository = require('../repositories/StockMovementRepository');

// @route   GET /api/product-transformations
// @desc    Get all product transformations with filters
// @access  Private
const userRepository = require('../repositories/UserRepository');

router.get('/', [
  auth,
  requirePermission('view_inventory'),
  query('baseProduct').optional().isUUID(4),
  query('targetVariant').optional().isUUID(4),
  query('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
  query('transformationType').optional().isIn(['color', 'warranty', 'size', 'finish', 'custom']),
  query('search').optional().isString().trim(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { baseProduct, targetVariant, status, transformationType, search, startDate, endDate } = req.query;
    const filter = {};
    if (baseProduct) filter.baseProduct = baseProduct;
    if (targetVariant) filter.targetVariant = targetVariant;
    if (status) filter.status = status;
    if (transformationType) filter.transformationType = transformationType;
    if (search) filter.search = search;
    if (startDate || endDate) {
      filter.transformationDate = {};
      if (startDate) filter.transformationDate.$gte = new Date(startDate);
      if (endDate) filter.transformationDate.$lte = new Date(endDate);
    }

    const transformations = await productTransformationRepository.findWithFilter(filter, {
      sort: { transformationDate: -1 }
    });

    const createdByIds = [...new Set(transformations.map(t => t.created_by).filter(Boolean))];
    const usersMap = {};
    for (const uid of createdByIds) {
      const user = await userRepository.findById(uid);
      if (user) usersMap[uid] = { firstName: user.firstName, lastName: user.lastName };
    }

    const transformed = transformations.map(t => ({
      ...t,
      performedBy: t.created_by ? (usersMap[t.created_by] || null) : null
    }));

    res.json({
      success: true,
      count: transformed.length,
      transformations: transformed
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
  param('id').isUUID(4)
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
  body('baseProduct').isUUID(4).withMessage('Valid base product ID is required'),
  body('targetVariant').isUUID(4).withMessage('Valid target variant ID is required'),
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
    const userId = req.user?.id ?? req.user?._id;
    const userName = (req.user?.firstName && req.user?.lastName)
      ? `${req.user.firstName} ${req.user.lastName}`
      : (req.user?.email || 'System User');

    const baseProductDoc = await productRepository.findById(baseProduct);
    if (!baseProductDoc) {
      return res.status(404).json({ message: 'Base product not found' });
    }

    const variantDoc = await productVariantRepository.findById(targetVariant);
    if (!variantDoc) {
      return res.status(404).json({ message: 'Target variant not found' });
    }

    const variantBaseProductId = variantDoc.base_product_id || variantDoc.baseProductId;
    if (variantBaseProductId !== baseProduct) {
      return res.status(400).json({
        message: 'Target variant does not belong to the specified base product'
      });
    }

    const baseInventory = await inventoryRepository.findByProduct(baseProduct);
    const baseStockCurrent = baseInventory ? Number(baseInventory.current_stock ?? baseInventory.currentStock ?? 0) : 0;
    if (baseStockCurrent < quantity) {
      return res.status(400).json({
        message: `Insufficient stock. Available: ${baseStockCurrent}, Required: ${quantity}`
      });
    }

    let variantInventory = await inventoryRepository.findByProduct(targetVariant);
    if (!variantInventory) {
      variantInventory = await inventoryRepository.create({
        productId: targetVariant,
        product: targetVariant,
        productModel: 'ProductVariant',
        currentStock: 0,
        reorderPoint: (variantDoc.inventory_data && variantDoc.inventory_data.minStock) || 10,
        reorderQuantity: 50,
        status: 'active'
      });
    }

    const baseStockBefore = baseStockCurrent;
    const baseStockAfter = baseStockBefore - quantity;
    const variantStockBefore = Number(variantInventory.current_stock ?? variantInventory.currentStock ?? 0);
    const variantStockAfter = variantStockBefore + quantity;

    const transformationCost = unitTransformationCost !== undefined
      ? unitTransformationCost
      : Number(variantDoc.transformation_cost ?? variantDoc.transformationCost ?? 0);
    const totalCost = quantity * transformationCost;

    const baseProductName = baseProductDoc.name || baseProductDoc.productName || 'Base Product';
    const targetVariantName = variantDoc.display_name || variantDoc.displayName || variantDoc.variant_name || 'Variant';

    const transformationNumber = `PT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;

    const transformation = await productTransformationRepository.create({
      transformationNumber,
      baseProduct,
      baseProductName,
      targetVariant,
      targetVariantName,
      quantity,
      unitTransformationCost: transformationCost,
      totalTransformationCost: totalCost,
      baseProductStockBefore: baseStockBefore,
      baseProductStockAfter: baseStockAfter,
      variantStockBefore: variantStockBefore,
      variantStockAfter: variantStockAfter,
      transformationType: variantDoc.variant_type || variantDoc.variantType,
      notes: notes || null,
      status: 'completed',
      createdBy: userId
    });

    await inventoryRepository.updateByProductId(baseProduct, {
      currentStock: baseStockAfter
    });

    const productStockQty = Number(baseProductDoc.stock_quantity ?? baseProductDoc.stockQuantity ?? 0);
    if (productStockQty !== baseStockAfter) {
      await productRepository.update(baseProduct, { stockQuantity: baseStockAfter });
    }

    await inventoryRepository.updateByProductId(targetVariant, {
      currentStock: variantStockAfter
    });

    const existingInventoryData = variantDoc.inventory_data && typeof variantDoc.inventory_data === 'object'
      ? variantDoc.inventory_data
      : {};
    await productVariantRepository.updateById(targetVariant, {
      inventory: { ...existingInventoryData, currentStock: variantStockAfter }
    });

    const unitCost = Number(baseProductDoc.cost_price ?? baseProductDoc.costPrice ?? (baseProductDoc.pricing && baseProductDoc.pricing.cost) ?? 0);
    await stockMovementRepository.create({
      productId: baseProduct,
      product: baseProduct,
      productName: baseProductName,
      movementType: 'consumption',
      quantity,
      unitCost,
      totalValue: quantity * unitCost,
      previousStock: baseStockBefore,
      newStock: baseStockAfter,
      referenceType: 'production',
      referenceId: transformation.id || transformation._id,
      referenceNumber: transformation.transformation_number || transformation.transformationNumber,
      notes: notes || `Transformed to ${targetVariantName}`,
      userId,
      userName
    });

    res.status(201).json({
      success: true,
      message: 'Product transformation completed successfully',
      transformation
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
  param('id').isUUID(4)
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

    const status = transformation.status;
    if (status === 'completed') {
      return res.status(400).json({
        message: 'Cannot cancel a completed transformation. Please create a reverse transformation instead.'
      });
    }

    const updated = await productTransformationRepository.updateById(req.params.id, { status: 'cancelled' });

    res.json({
      success: true,
      message: 'Product transformation cancelled successfully',
      transformation: updated
    });
  } catch (error) {
    console.error('Error cancelling product transformation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
