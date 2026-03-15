const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const discountService = require('../services/discountService');

const router = express.Router();

// @route   POST /api/discounts
// @desc    Create a new discount
// @access  Private (requires 'manage_discounts' permission)
router.post('/', [
  auth,
  requirePermission('manage_discounts'),
  sanitizeRequest,
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be 1-100 characters'),
  body('code').trim().isLength({ min: 1, max: 20 }).matches(/^[A-Z0-9-_]+$/).withMessage('Valid code is required (uppercase letters, numbers, hyphens, underscores)'),
  body('type').isIn(['percentage', 'fixed_amount']).withMessage('Type must be percentage or fixed_amount'),
  body('value').isFloat({ min: 0 }).withMessage('Value must be a positive number'),
  body('validFrom').isISO8601().toDate().withMessage('Valid from date is required'),
  body('validUntil').isISO8601().toDate().withMessage('Valid until date is required'),
  body('applicableTo').optional().isIn(['all', 'products', 'categories', 'customers']).withMessage('Invalid applicable to value'),
  body('usageLimit').optional().isInt({ min: 1 }).withMessage('Usage limit must be a positive integer'),
  body('usageLimitPerCustomer').optional().isInt({ min: 1 }).withMessage('Per-customer usage limit must be a positive integer'),
  body('minimumOrderAmount').optional().isFloat({ min: 0 }).withMessage('Minimum order amount must be non-negative'),
  body('maximumDiscount').optional().isFloat({ min: 0 }).withMessage('Maximum discount must be non-negative'),
  body('priority').optional().isInt({ min: 0 }).withMessage('Priority must be a non-negative integer'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const discount = await discountService.createDiscount(req.body, req.user._id);
    
    res.status(201).json({
      message: 'Discount created successfully',
      discount
    });
  } catch (error) {
    console.error('Error creating discount:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/discounts
// @desc    Get list of discounts with filters
// @access  Private (requires 'view_discounts' permission)
router.get('/', [
  auth,
  requirePermission('view_discounts'),
  sanitizeRequest,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional({ checkFalsy: true }).trim(),
  query('type').optional({ checkFalsy: true }).isIn(['percentage', 'fixed_amount']),
  query('status').optional({ checkFalsy: true }).isIn(['active', 'inactive', 'scheduled', 'expired', 'exhausted']),
  query('isActive').optional({ checkFalsy: true }).isBoolean(),
  query('validFrom').optional({ checkFalsy: true }).isISO8601().toDate(),
  query('validUntil').optional({ checkFalsy: true }).isISO8601().toDate(),
  query('sortBy').optional({ checkFalsy: true }).isIn(['name', 'code', 'type', 'value', 'priority', 'createdAt', 'validFrom', 'validUntil']),
  query('sortOrder').optional({ checkFalsy: true }).isIn(['asc', 'desc']),
  ...validateDateParams,
  handleValidationErrors,
  processDateFilter('createdAt'),
], async (req, res) => {
  try {
    // Filter out empty string values
    const cleanedQuery = Object.keys(req.query).reduce((acc, key) => {
      if (req.query[key] !== '' && req.query[key] != null) {
        acc[key] = req.query[key];
      }
      return acc;
    }, {});
    
    // Merge date filter from middleware if present (for Pakistan timezone)
    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      cleanedQuery.dateFilter = req.dateFilter;
    }

    const result = await discountService.getDiscounts(cleanedQuery);
    
    res.json({
      discounts: result.discounts,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching discounts:', error);
    res.status(500).json({ message: 'Server error fetching discounts', error: error.message });
  }
});

// @route   GET /api/discounts/:discountId
// @desc    Get detailed discount information
// @access  Private (requires 'view_discounts' permission)
router.get('/:discountId', [
  auth,
  requirePermission('view_discounts'),
  sanitizeRequest,
  param('discountId').isMongoId().withMessage('Valid Discount ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { discountId } = req.params;
    
    const discount = await discountService.getDiscountById(discountId);
    res.json(discount);
  } catch (error) {
    console.error('Error fetching discount:', error);
    if (error.message === 'Discount not found') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Server error fetching discount', error: error.message });
    }
  }
});

// @route   PUT /api/discounts/:discountId
// @desc    Update discount
// @access  Private (requires 'manage_discounts' permission)
router.put('/:discountId', [
  auth,
  requirePermission('manage_discounts'),
  sanitizeRequest,
  param('discountId').isMongoId().withMessage('Valid Discount ID is required'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('code').optional().trim().isLength({ min: 1, max: 20 }).matches(/^[A-Z0-9-_]+$/).withMessage('Valid code is required'),
  body('type').optional().isIn(['percentage', 'fixed_amount']).withMessage('Type must be percentage or fixed_amount'),
  body('value').optional().isFloat({ min: 0 }).withMessage('Value must be a positive number'),
  body('validFrom').optional().isISO8601().toDate().withMessage('Valid from date is required'),
  body('validUntil').optional().isISO8601().toDate().withMessage('Valid until date is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { discountId } = req.params;
    
    const discount = await discountService.updateDiscount(discountId, req.body, req.user._id);
    
    res.json({
      message: 'Discount updated successfully',
      discount
    });
  } catch (error) {
    console.error('Error updating discount:', error);
    if (error.message === 'Discount not found') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// @route   DELETE /api/discounts/:discountId
// @desc    Delete discount
// @access  Private (requires 'manage_discounts' permission)
router.delete('/:discountId', [
  auth,
  requirePermission('manage_discounts'),
  sanitizeRequest,
  param('discountId').isMongoId().withMessage('Valid Discount ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { discountId } = req.params;
    
    const result = await discountService.deleteDiscount(discountId, req.user._id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting discount:', error);
    if (error.message === 'Discount not found') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// @route   PUT /api/discounts/:discountId/toggle-status
// @desc    Toggle discount active status
// @access  Private (requires 'manage_discounts' permission)
router.put('/:discountId/toggle-status', [
  auth,
  requirePermission('manage_discounts'),
  sanitizeRequest,
  param('discountId').isMongoId().withMessage('Valid Discount ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { discountId } = req.params;
    
    const discount = await discountService.toggleDiscountStatus(discountId, req.user._id);
    
    res.json({
      message: `Discount ${discount.isActive ? 'activated' : 'deactivated'} successfully`,
      discount
    });
  } catch (error) {
    console.error('Error toggling discount status:', error);
    if (error.message === 'Discount not found') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Server error toggling discount status', error: error.message });
    }
  }
});

// @route   POST /api/discounts/apply
// @desc    Apply discount to an order
// @access  Private (requires 'view_discounts' permission)
router.post('/apply', [
  auth,
  requirePermission('view_discounts'),
  sanitizeRequest,
  body('orderId').isMongoId().withMessage('Valid Order ID is required'),
  body('discountCode').trim().isLength({ min: 1 }).withMessage('Discount code is required'),
  body('customerId').optional().isMongoId().withMessage('Valid Customer ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { orderId, discountCode, customerId } = req.body;
    
    const result = await discountService.applyDiscountToOrder(orderId, discountCode, customerId);
    
    res.json({
      message: 'Discount applied successfully',
      ...result
    });
  } catch (error) {
    console.error('Error applying discount:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   POST /api/discounts/remove
// @desc    Remove discount from an order
// @access  Private (requires 'view_discounts' permission)
router.post('/remove', [
  auth,
  requirePermission('view_discounts'),
  sanitizeRequest,
  body('orderId').isMongoId().withMessage('Valid Order ID is required'),
  body('discountCode').trim().isLength({ min: 1 }).withMessage('Discount code is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { orderId, discountCode } = req.body;
    
    const result = await discountService.removeDiscountFromOrder(orderId, discountCode);
    
    res.json({
      message: 'Discount removed successfully',
      ...result
    });
  } catch (error) {
    console.error('Error removing discount:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   POST /api/discounts/check-applicable
// @desc    Check applicable discounts for an order
// @access  Private (requires 'view_discounts' permission)
router.post('/check-applicable', [
  auth,
  requirePermission('view_discounts'),
  sanitizeRequest,
  body('orderData').custom((value) => {
    if (!value || typeof value !== 'object') {
      throw new Error('Order data is required and must be an object');
    }
    if (!value.total || typeof value.total !== 'number' || value.total <= 0) {
      throw new Error('Order data must have a valid total amount');
    }
    return true;
  }),
  body('customerData').optional().custom((value) => {
    if (value && typeof value !== 'object') {
      throw new Error('Customer data must be an object');
    }
    return true;
  }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { orderData, customerData } = req.body;
    
    const applicableDiscounts = await discountService.getApplicableDiscounts(orderData, customerData);
    
    res.json({
      applicableDiscounts: applicableDiscounts.map(item => ({
        discount: item.discount,
        reason: item.reason,
        calculatedAmount: item.discount.calculateDiscountAmount ? 
          item.discount.calculateDiscountAmount(orderData.total) : 
          (item.discount.type === 'percentage' ? 
            (orderData.total * item.discount.value) / 100 : 
            Math.min(item.discount.value, orderData.total))
      }))
    });
  } catch (error) {
    console.error('Error checking applicable discounts:', error);
    res.status(500).json({ message: 'Server error checking applicable discounts', error: error.message });
  }
});

// @route   GET /api/discounts/code/:code
// @desc    Get discount by code
// @access  Private (requires 'view_discounts' permission)
router.get('/code/:code', [
  auth,
  requirePermission('view_discounts'),
  sanitizeRequest,
  param('code').trim().isLength({ min: 1, max: 20 }).withMessage('Valid discount code is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { code } = req.params;
    
    const discount = await discountService.getDiscountByCode(code);
    if (!discount) {
      return res.status(404).json({ message: 'Discount not found' });
    }
    
    res.json(discount);
  } catch (error) {
    console.error('Error fetching discount by code:', error);
    res.status(500).json({ message: 'Server error fetching discount', error: error.message });
  }
});

// @route   GET /api/discounts/code/:code/availability
// @desc    Check if discount code is available
// @access  Private (requires 'view_discounts' permission)
router.get('/code/:code/availability', [
  auth,
  requirePermission('view_discounts'),
  sanitizeRequest,
  param('code').trim().isLength({ min: 1, max: 20 }).withMessage('Valid discount code is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { code } = req.params;
    
    const isAvailable = await discountService.isDiscountCodeAvailable(code);
    
    res.json({
      code: code.toUpperCase(),
      available: isAvailable
    });
  } catch (error) {
    console.error('Error checking discount code availability:', error);
    res.status(500).json({ message: 'Server error checking code availability', error: error.message });
  }
});

// @route   POST /api/discounts/generate-code-suggestions
// @desc    Generate discount code suggestions
// @access  Private (requires 'view_discounts' permission)
router.post('/generate-code-suggestions', [
  auth,
  requirePermission('view_discounts'),
  sanitizeRequest,
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('type').isIn(['percentage', 'fixed_amount']).withMessage('Valid type is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { name, type } = req.body;
    
    const suggestions = discountService.generateDiscountCodeSuggestions(name, type);
    
    res.json({
      suggestions
    });
  } catch (error) {
    console.error('Error generating code suggestions:', error);
    res.status(500).json({ message: 'Server error generating suggestions', error: error.message });
  }
});

// @route   GET /api/discounts/stats
// @desc    Get discount statistics
// @access  Private (requires 'view_discounts' permission)
router.get('/stats', [
  auth,
  requirePermission('view_discounts'),
  sanitizeRequest,
  query('startDate').optional({ checkFalsy: true }).isISO8601().toDate(),
  query('endDate').optional({ checkFalsy: true }).isISO8601().toDate(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const period = startDate && endDate ? { startDate, endDate } : {};
    const stats = await discountService.getDiscountStats(period);
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching discount stats:', error);
    res.status(500).json({ message: 'Server error fetching discount stats', error: error.message });
  }
});

// @route   GET /api/discounts/active
// @desc    Get all active discounts
// @access  Private (requires 'view_discounts' permission)
router.get('/active', [
  auth,
  requirePermission('view_discounts'),
  sanitizeRequest,
], async (req, res) => {
  try {
    const discounts = await discountService.getActiveDiscounts();
    
    res.json(discounts);
  } catch (error) {
    console.error('Error fetching active discounts:', error);
    res.status(500).json({ message: 'Server error fetching active discounts', error: error.message });
  }
});

module.exports = router;
