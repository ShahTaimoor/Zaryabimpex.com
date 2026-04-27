const express = require('express');
const { body, param, validationResult, query } = require('express-validator');
const fs = require('fs');
const path = require('path');
const { auth, requirePermission, maskSensitiveData } = require('../middleware/auth');
const { sanitizeRequest, handleValidationErrors } = require('../middleware/validation');
const productService = require('../services/productServicePostgres');
const auditLogService = require('../services/auditLogService');
const expiryManagementService = require('../services/expiryManagementService');
const costingService = require('../services/costingService');

const router = express.Router();

// Import: parse price cells — empty / invalid / text → null; numbers clamped to >= 0
const coerceImportPrice = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  const s = String(value).trim().replace(/,/g, '').replace(/^\s*(?:[$€£]|Rs\.?)\s*/i, '');
  if (s === '' || s === '-' || /^n\/?a$/i.test(s)) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
};

// Import text normalizer:
// keep symbols like "&" as-is, and decode common HTML entities
const normalizeImportText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&#x2f;|&#47;/gi, '/')
    .trim();
};

// Helper function to transform product names to uppercase
const transformProductToUppercase = (product) => {
  if (!product) return product;
  if (product.toObject) product = product.toObject();
  if (product.name) product.name = product.name.toUpperCase();
  if (product.description) product.description = product.description.toUpperCase();
  if (product.category && product.category.name) product.category.name = product.category.name.toUpperCase();
  return product;
};




// @route   GET /api/products
// @desc    Get all products with filtering and pagination
// @access  Private
router.get('/', [
  sanitizeRequest,
  auth,
  query('page').optional({ checkFalsy: true }).isInt({ min: 1 }),
  query('limit').optional({ checkFalsy: true }).isInt({ min: 1, max: 10000 }),
  query('all').optional({ checkFalsy: true }).isBoolean(),
  query('search').optional({ checkFalsy: true }).trim(),
  query('code').optional({ checkFalsy: true }).trim(),
  query('category').optional({ checkFalsy: true }).isUUID().withMessage('Category must be a valid UUID'),
  query('categories').optional({ checkFalsy: true }).custom((value) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed);
      } catch {
        return false;
      }
    }
    return true;
  }),
  query('status').optional({ checkFalsy: true }).isIn(['active', 'inactive', 'discontinued']),
  query('statuses').optional({ checkFalsy: true }).custom((value) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed);
      } catch {
        return false;
      }
    }
    return true;
  }),
  query('lowStock').optional({ checkFalsy: true }).isBoolean(),
  query('stockStatus').optional({ checkFalsy: true }).isIn(['lowStock', 'outOfStock', 'inStock']),
  query('minPrice').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  query('maxPrice').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  query('priceField').optional({ checkFalsy: true }).isIn(['retail', 'wholesale', 'cost']),
  query('minStock').optional({ checkFalsy: true }).isInt({ min: 0 }),
  query('maxStock').optional({ checkFalsy: true }).isInt({ min: 0 }),
  query('dateFrom').optional({ checkFalsy: true }).isISO8601(),
  query('dateTo').optional({ checkFalsy: true }).isISO8601(),
  query('dateField').optional({ checkFalsy: true }).isIn(['createdAt', 'updatedAt']),
  query('brand').optional({ checkFalsy: true }).trim(),
  query('searchFields').optional({ checkFalsy: true }).custom((value) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed);
      } catch {
        return false;
      }
    }
    return true;
  }),
  query('listMode').optional({ checkFalsy: true }).isIn(['full', 'minimal']),
  query('cursor').optional({ checkFalsy: true }).isString().trim(),
  maskSensitiveData('view_product_costs', 'pricing.cost')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg || `${err.param}: ${err.msg}`);
      return res.status(400).json({ 
        message: 'Invalid request. Please check your input.',
        errors: errors.array(),
        details: errorMessages
      });
    }
    
    // Call service to get products
    const result = await productService.getProducts(req.query);
    
    res.json({
      products: result.products,
      pagination: result.pagination
    });
  } catch (error) {
    return next(error);
  }
});

// @route   GET /api/products/:id/last-purchase-price
// @desc    Get last purchase price for a product
// @access  Private
router.get('/:id/last-purchase-price', auth, maskSensitiveData('view_product_costs', 'lastPurchasePrice'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const priceInfo = await productService.getLastPurchasePrice(id);
    
    if (!priceInfo) {
      return res.json({
        success: true,
        message: 'No purchase history found for this product',
        lastPurchasePrice: null
      });
    }
    
    res.json({
      success: true,
      message: 'Last purchase price retrieved successfully',
      lastPurchasePrice: priceInfo.lastPurchasePrice,
      invoiceNumber: priceInfo.invoiceNumber,
      purchaseDate: priceInfo.purchaseDate
    });
  } catch (error) {
    return next(error);
  }
});

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Private
router.get('/:id', auth, maskSensitiveData('view_product_costs', 'pricing.cost'), async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.json({ product });
  } catch (error) {
    if (error.message === 'Product not found') {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (error.message === 'Invalid product id') {
      return res.status(400).json({ message: 'Invalid product id' });
    }
    return next(error);
  }
});

// @route   POST /api/products
// @desc    Create new product
// @access  Private
router.post('/', [
  sanitizeRequest,
  auth,
  requirePermission('create_products'),
  body('name').trim().isLength({ min: 1 }).withMessage('Product name is required'),
  body('unit').optional().isIn(['PCS', 'U', 'KG', 'G', 'L', 'ML', 'MTR', 'SQFT', 'BOX', 'CTN', 'SET', 'PAIR']).withMessage('Invalid unit of measurement'),
  body('countryOfOrigin').optional().trim().isLength({ max: 120 }).withMessage('Country of origin is too long'),
  body('netWeightKg').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Net weight must be a non-negative number'),
  body('grossWeightKg').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Gross weight must be a non-negative number'),
  body('importRefNo').optional().trim().isLength({ max: 120 }).withMessage('Import reference is too long'),
  body('gdNumber').optional().trim().isLength({ max: 120 }).withMessage('GD number is too long'),
  body('invoiceRef').optional().trim().isLength({ max: 120 }).withMessage('Invoice reference is too long'),
  body('pricing.cost').isFloat({ min: 0 }).withMessage('Cost must be a positive number'),
  body('pricing.retail').isFloat({ min: 0 }).withMessage('Retail price must be a positive number'),
  body('pricing.wholesale').isFloat({ min: 0 }).withMessage('Wholesale price must be a positive number')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Call service to create product (pass req for audit logging)
    const result = await productService.createProduct(req.body, req.user?.id || req.user?._id, req);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Create product error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    if (error.code === 11000) {
      
      
      return res.status(400).json({ 
        message: 'A product with this name already exists. Please choose a different name.',
        code: 'DUPLICATE_PRODUCT_NAME',
        attemptedName: req.body.name
      });
    }

    // Postgres unique violation (e.g. duplicate SKU)
    if (error.code === '23505') {
      const msg = String(error.message || '');
      if (msg.includes('products_sku_key') || msg.toLowerCase().includes('sku')) {
        return res.status(400).json({
          message: 'A product with this SKU already exists.',
          code: 'DUPLICATE_PRODUCT_SKU',
          attemptedSku: req.body?.sku
        });
      }
      if (msg.includes('products_name_key') || msg.toLowerCase().includes('name')) {
        return res.status(400).json({
          message: 'A product with this name already exists. Please choose a different name.',
          code: 'DUPLICATE_PRODUCT_NAME',
          attemptedName: req.body?.name
        });
      }

      return res.status(400).json({
        message: 'Duplicate unique field value.',
        code: 'DUPLICATE_PRODUCT_KEY'
      });
    }
    
    return next(error);
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('edit_products'),
  body('name').optional().trim().isLength({ min: 1 }),
  body('unit').optional().isIn(['PCS', 'U', 'KG', 'G', 'L', 'ML', 'MTR', 'SQFT', 'BOX', 'CTN', 'SET', 'PAIR']).withMessage('Invalid unit of measurement'),
  body('countryOfOrigin').optional().trim().isLength({ max: 120 }).withMessage('Country of origin is too long'),
  body('netWeightKg').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Net weight must be a non-negative number'),
  body('grossWeightKg').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Gross weight must be a non-negative number'),
  body('importRefNo').optional().trim().isLength({ max: 120 }).withMessage('Import reference is too long'),
  body('gdNumber').optional().trim().isLength({ max: 120 }).withMessage('GD number is too long'),
  body('invoiceRef').optional().trim().isLength({ max: 120 }).withMessage('Invoice reference is too long'),
  body('pricing.cost').optional().isFloat({ min: 0 }),
  body('pricing.retail').optional().isFloat({ min: 0 }),
  body('pricing.wholesale').optional().isFloat({ min: 0 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Call service to update product (pass req for audit logging and optimistic locking)
    const result = await productService.updateProduct(req.params.id, req.body, req.user?.id || req.user?._id, req);
    
    res.json(result);
  } catch (error) {
    console.error('Update product error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'A product with this name already exists. Please choose a different name.',
        code: 'DUPLICATE_PRODUCT_NAME' 
      });
    }

    if (error.code === '23505') {
      const msg = String(error.message || '');
      if (msg.includes('products_sku_key') || msg.toLowerCase().includes('sku')) {
        return res.status(400).json({
          message: 'A product with this SKU already exists.',
          code: 'DUPLICATE_PRODUCT_SKU',
          attemptedSku: req.body?.sku
        });
      }
      if (msg.includes('products_name_key') || msg.toLowerCase().includes('name')) {
        return res.status(400).json({
          message: 'A product with this name already exists. Please choose a different name.',
          code: 'DUPLICATE_PRODUCT_NAME'
        });
      }

      return res.status(400).json({
        message: 'Duplicate unique field value.',
        code: 'DUPLICATE_PRODUCT_KEY'
      });
    }
    return next(error);
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete product (soft delete)
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_products')
], async (req, res, next) => {
  try {
    // Call service to delete product (soft delete, pass req for audit logging)
    const result = await productService.deleteProduct(req.params.id, req);
    res.json(result);
  } catch (error) {
    // Return appropriate status code based on error type
    const statusCode = error.message && error.message.includes('Cannot delete') ? 400 : 500;
    if (statusCode === 400) {
      return res.status(400).json({ message: error.message || 'Cannot delete product' });
    }
    return next(error);
  }
});

// @route   POST /api/products/:id/restore
// @desc    Restore soft-deleted product
// @access  Private
router.post('/:id/restore', [
  auth,
  requirePermission('delete_products')
], async (req, res, next) => {
  try {
    const result = await productService.restoreProduct(req.params.id);
    res.json(result);
  } catch (error) {
    if (error.message === 'Deleted product not found') {
      return res.status(404).json({ message: 'Deleted product not found' });
    }
    return next(error);
  }
});

// @route   GET /api/products/deleted
// @desc    Get all deleted products
// @access  Private
router.get('/deleted', [
  auth,
  requirePermission('delete_products'),
  maskSensitiveData('view_product_costs', 'pricing.cost')
], async (req, res, next) => {
  try {
    const deletedProducts = await productService.getDeletedProducts();
    res.json(deletedProducts);
  } catch (error) {
    return next(error);
  }
});

// @route   GET /api/products/search/:query
// @desc    Search products by name
// @access  Private
router.get('/search/:query', auth, maskSensitiveData('view_product_costs', 'pricing.cost'), async (req, res, next) => {
  try {
    const query = req.params.query;
    const products = await productService.searchProducts(query, 10);
    res.json({ products });
  } catch (error) {
    return next(error);
  }
});

// @route   PUT /api/products/bulk
// @desc    Bulk update products
// @access  Private
router.put('/bulk', [
  auth,
  requirePermission('update_products'),
  body('productIds').isArray().withMessage('Product IDs array is required'),
  body('updates').isObject().withMessage('Updates object is required')
], async (req, res, next) => {
  try {
    const { productIds, updates } = req.body;
    
    // Call service to bulk update products
    const result = await productService.bulkUpdateProductsAdvanced(productIds, updates);
    
    res.json(result);
  } catch (error) {
    return next(error);
  }
});

// @route   DELETE /api/products/bulk
// @desc    Bulk delete products
// @access  Private
router.delete('/bulk', [
  auth,
  requirePermission('delete_products'),
  body('productIds').isArray().withMessage('Product IDs array is required')
], async (req, res, next) => {
  try {
    const { productIds } = req.body;
    
    // Call service to bulk delete products
    const result = await productService.bulkDeleteProducts(productIds);
    
    res.json(result);
  } catch (error) {
    // Return appropriate status code based on error type
    const statusCode = error.message && error.message.includes('Cannot delete') ? 400 : 500;
    if (statusCode === 400) {
      return res.status(400).json({ message: error.message || 'Cannot delete selected products' });
    }
    return next(error);
  }
});

// @route   GET /api/products/low-stock
// @desc    Get products with low stock
// @access  Private
router.get('/low-stock', auth, async (req, res, next) => {
  try {
    const products = await productService.getLowStockProducts();
    res.json({ products });
  } catch (error) {
    return next(error);
  }
});

// @route   POST /api/products/:id/price-check
// @desc    Get price for specific customer type and quantity
// @access  Private
router.post('/:id/price-check', [
  auth,
  body('customerType').isIn(['retail', 'wholesale', 'distributor', 'individual']).withMessage('Invalid customer type'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { customerType, quantity } = req.body;
    const result = await productService.getPriceForCustomerType(req.params.id, customerType, quantity);
    res.json(result);
  } catch (error) {
    return next(error);
  }
});












// Link investors to product
router.post('/:id/investors', [
  auth,
  requirePermission('edit_products'),
  param('id').isUUID(4).withMessage('Invalid product ID'),
  body('investors').isArray().withMessage('Investors must be an array'),
  body('investors.*.investor').isUUID(4).withMessage('Invalid investor ID'),
  body('investors.*.sharePercentage').optional().isFloat({ min: 0, max: 100 }),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const product = await productService.updateProductInvestors(req.params.id, req.body.investors);

    res.json({
      success: true,
      message: 'Investors linked to product successfully',
      data: product
    });
  } catch (error) {
    return next(error);
  }
});

// Remove investor from product
router.delete('/:id/investors/:investorId', [
  auth,
  requirePermission('edit_products')
], async (req, res, next) => {
  try {
    const product = await productService.removeProductInvestor(req.params.id, req.params.investorId);

    res.json({
      success: true,
      message: 'Investor removed from product successfully',
      data: product
    });
  } catch (error) {
    if (error.message === 'Product not found') {
      return res.status(404).json({ message: error.message });
    }
    return next(error);
  }
});

// @route   POST /api/products/get-last-purchase-prices
// @desc    Get last purchase prices for multiple products
// @access  Private
router.post('/get-last-purchase-prices', auth, async (req, res, next) => {
  try {
    const { productIds } = req.body;
    
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Product IDs array is required' });
    }
    
    const prices = await productService.getLastPurchasePrices(productIds);
    
    res.json({
      success: true,
      message: 'Last purchase prices retrieved successfully',
      prices: prices
    });
  } catch (error) {
    return next(error);
  }
});

// @route   GET /api/products/:id/audit-logs
// @desc    Get audit logs for a product
// @access  Private
router.get('/:id/audit-logs', [
  auth,
  requirePermission('view_products')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 50, skip = 0, action, startDate, endDate } = req.query;
    
    const logs = await auditLogService.getProductAuditLogs(id, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      action,
      startDate,
      endDate
    });
    
    res.json({
      success: true,
      logs,
      count: logs.length
    });
  } catch (error) {
    return next(error);
  }
});

// @route   GET /api/products/expiring-soon
// @desc    Get products expiring soon
// @access  Private
router.get('/expiring-soon', [
  auth,
  requirePermission('view_products')
], async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await expiryManagementService.getExpiringSoon(days);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    return next(error);
  }
});

// @route   GET /api/products/expired
// @desc    Get expired products
// @access  Private
router.get('/expired', [
  auth,
  requirePermission('view_products')
], async (req, res, next) => {
  try {
    const result = await expiryManagementService.getExpired();
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    return next(error);
  }
});

// @route   POST /api/products/:id/write-off-expired
// @desc    Write off expired inventory
// @access  Private
router.post('/:id/write-off-expired', [
  auth,
  requirePermission('edit_products')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await expiryManagementService.writeOffExpired(id, req.user?.id ?? req.user?._id, req);
    
    res.json({
      success: true,
      message: 'Expired inventory written off successfully',
      ...result
    });
  } catch (error) {
    return next(error);
  }
});

// @route   POST /api/products/:id/calculate-cost
// @desc    Calculate product cost using costing method
// @access  Private
router.post('/:id/calculate-cost', [
  auth,
  requirePermission('view_products'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    const { quantity } = req.body;
    
    const costInfo = await costingService.calculateCost(id, quantity);
    
    res.json({
      success: true,
      productId: id,
      quantity,
      ...costInfo
    });
  } catch (error) {
    return next(error);
  }
});

// @route   POST /api/products/bulk-create
// @desc    Bulk create products from import
// @access  Private
router.post('/bulk-create', [
  auth,
  requirePermission('create_products'),
  body('products').isArray().withMessage('Products array is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const result = await productService.bulkCreateProducts(
      req.body.products,
      req.user?.id || req.user?._id,
      req,
      { autoCreateCategories: req.body.autoCreateCategories !== false }
    );
    res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
