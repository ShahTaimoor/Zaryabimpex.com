const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const productVariantRepository = require('../repositories/ProductVariantRepository');
const productRepository = require('../repositories/ProductRepository');
const inventoryRepository = require('../repositories/InventoryRepository');

// @route   GET /api/product-variants
// @desc    Get all product variants with filters
// @access  Private
router.get('/', [
  auth,
  requirePermission('view_products'),
  query('baseProduct').optional().isUUID(4),
  query('variantType').optional().isIn(['color', 'warranty', 'size', 'finish', 'custom']),
  query('status').optional().isIn(['active', 'inactive', 'discontinued']),
  query('search').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { baseProduct, variantType, status, search } = req.query;
    const filter = {};
    if (baseProduct) filter.baseProduct = baseProduct;
    if (variantType) filter.variantType = variantType;
    if (status) filter.status = status;
    if (search) filter.search = search;

    const variants = await productVariantRepository.findWithFilter(filter, {
      sort: { createdAt: -1 }
    });

    res.json({
      success: true,
      count: variants.length,
      variants
    });
  } catch (error) {
    console.error('Error fetching product variants:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/product-variants/:id
// @desc    Get single product variant
// @access  Private
router.get('/:id', [
  auth,
  requirePermission('view_products'),
  param('id').isUUID(4)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const variant = await productVariantRepository.findById(req.params.id);
    if (!variant) {
      return res.status(404).json({ message: 'Product variant not found' });
    }

    res.json({
      success: true,
      variant
    });
  } catch (error) {
    console.error('Error fetching product variant:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/product-variants
// @desc    Create new product variant
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_products'),
  body('baseProduct').isUUID(4).withMessage('Valid base product ID is required'),
  body('variantType').isIn(['color', 'warranty', 'size', 'finish', 'custom']).withMessage('Valid variant type is required'),
  body('variantValue').trim().isLength({ min: 1 }).withMessage('Variant value is required'),
  body('displayName').trim().isLength({ min: 1, max: 200 }).withMessage('Display name is required'),
  body('pricing.cost').isFloat({ min: 0 }).withMessage('Valid cost is required'),
  body('pricing.retail').isFloat({ min: 0 }).withMessage('Valid retail price is required'),
  body('pricing.wholesale').isFloat({ min: 0 }).withMessage('Valid wholesale price is required'),
  body('transformationCost').isFloat({ min: 0 }).withMessage('Valid transformation cost is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let variantName = req.body.variantName;
    const variantValue = req.body.variantValue;
    if (!variantName || (typeof variantName === 'string' && variantName.trim() === '')) {
      variantName = variantValue && typeof variantValue === 'string' ? variantValue.trim() : variantValue;
      if (!variantName) {
        return res.status(400).json({
          errors: [{ type: 'field', value: '', msg: 'Variant name is required.', path: 'variantName', location: 'body' }]
        });
      }
    } else {
      variantName = typeof variantName === 'string' ? variantName.trim() : variantName;
    }
    if (!variantName || variantName.length < 1 || variantName.length > 200) {
      return res.status(400).json({
        errors: [{ type: 'field', value: variantName || '', msg: 'Variant name must be between 1 and 200 characters', path: 'variantName', location: 'body' }]
      });
    }

    const {
      baseProduct,
      variantType,
      displayName,
      description,
      pricing,
      transformationCost,
      sku,
      inventory
    } = req.body;

    const baseProductDoc = await productRepository.findById(baseProduct);
    if (!baseProductDoc) {
      return res.status(404).json({ message: 'Base product not found' });
    }

    const existingVariant = await productVariantRepository.findOne({
      baseProduct,
      variantType,
      variantValue
    });
    if (existingVariant) {
      return res.status(400).json({
        message: 'Variant with this type and value already exists for this product'
      });
    }

    const variant = await productVariantRepository.create({
      baseProduct,
      variantName,
      variantType,
      variantValue,
      displayName,
      description,
      pricing,
      transformationCost,
      sku,
      inventory: inventory || { currentStock: 0, minStock: 0 }
    });

    await inventoryRepository.create({
      productId: variant.id,
      product: variant.id,
      productModel: 'ProductVariant',
      currentStock: (inventory && inventory.currentStock) || 0,
      reorderPoint: (inventory && inventory.minStock) || 10,
      reorderQuantity: 50,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      message: 'Product variant created successfully',
      variant
    });
  } catch (error) {
    console.error('Error creating product variant:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/product-variants/:id
// @desc    Update product variant
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('edit_products'),
  param('id').isUUID(4),
  body('variantName').optional().trim().isLength({ min: 1, max: 200 }),
  body('displayName').optional().trim().isLength({ min: 1, max: 200 }),
  body('pricing.cost').optional().isFloat({ min: 0 }),
  body('pricing.retail').optional().isFloat({ min: 0 }),
  body('pricing.wholesale').optional().isFloat({ min: 0 }),
  body('transformationCost').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const variant = await productVariantRepository.findById(req.params.id);
    if (!variant) {
      return res.status(404).json({ message: 'Product variant not found' });
    }

    const updateData = {};
    const fields = ['variantName', 'displayName', 'description', 'pricing', 'transformationCost', 'sku'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });
    if (req.body.status !== undefined) {
      updateData.isActive = req.body.status === 'active';
    }
    if (Object.keys(updateData).length === 0) {
      return res.json({
        success: true,
        message: 'Product variant updated successfully',
        variant
      });
    }

    const updatedVariant = await productVariantRepository.updateById(req.params.id, updateData);

    res.json({
      success: true,
      message: 'Product variant updated successfully',
      variant: updatedVariant
    });
  } catch (error) {
    console.error('Error updating product variant:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/product-variants/:id
// @desc    Delete product variant
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_products'),
  param('id').isUUID(4)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const variant = await productVariantRepository.findById(req.params.id);
    if (!variant) {
      return res.status(404).json({ message: 'Product variant not found' });
    }

    const inventoryRecord = await inventoryRepository.findOne({ product: variant.id, productId: variant.id });
    if (inventoryRecord) {
      const currentStock = Number(inventoryRecord.current_stock ?? inventoryRecord.currentStock ?? 0);
      if (currentStock > 0) {
        return res.status(400).json({
          message: 'Cannot delete variant with existing stock. Please adjust stock to zero first.'
        });
      }
      await inventoryRepository.hardDelete(inventoryRecord.id);
    }

    await productVariantRepository.hardDelete(req.params.id);

    res.json({
      success: true,
      message: 'Product variant deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product variant:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/product-variants/base-product/:productId
// @desc    Get all variants for a base product
// @access  Private
router.get('/base-product/:productId', [
  auth,
  requirePermission('view_products'),
  param('productId').isUUID(4)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const variants = await productVariantRepository.findByBaseProduct(req.params.productId, {
      sort: { variantType: 1, variantValue: 1 }
    });

    res.json({
      success: true,
      count: variants.length,
      variants
    });
  } catch (error) {
    console.error('Error fetching product variants:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
