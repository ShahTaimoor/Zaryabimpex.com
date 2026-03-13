const { body, param, query, validationResult } = require('express-validator');
const { sanitizeInput, sanitizeObject } = require('../utils/sanitization');
const logger = require('../utils/logger');

// Sanitization middleware
const sanitizeRequest = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize params
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: errors.array()
    });
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Product validation rules
const validateProduct = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Product name must be between 2 and 100 characters'),
  
  body('sku')
    .trim()
    .matches(/^[A-Z0-9\-_]{3,20}$/)
    .withMessage('SKU must be 3-20 characters, letters, numbers, hyphens, and underscores only'),
  
  body('barcode')
    .optional()
    .matches(/^[0-9]{8,14}$/)
    .withMessage('Barcode must be 8-14 digits'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('pricing.cost')
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Cost must be a valid currency amount between 0 and 999,999.99'),
  
  body('pricing.retail')
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Retail price must be a valid currency amount between 0 and 999,999.99'),
  
  body('pricing.wholesale')
    .optional()
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Wholesale price must be a valid currency amount between 0 and 999,999.99'),
  
  body('inventory.currentStock')
    .isInt({ min: 0, max: 999999 })
    .withMessage('Current stock must be a positive integer'),
  
  body('inventory.reorderPoint')
    .optional()
    .isInt({ min: 0, max: 999999 })
    .withMessage('Reorder point must be a positive integer'),
  
  body('category')
    .optional()
    .isUUID(4)
    .withMessage('Category must be a valid UUID'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'discontinued'])
    .withMessage('Status must be active, inactive, or discontinued'),
  
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be a valid date')
    .custom((value) => {
      if (value) {
        const expiryDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Allow past dates (for expired products) and future dates
        return true;
      }
      return true;
    })
];

// Customer validation rules
const validateCustomer = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('businessName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Business name must be between 2 and 100 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  
  body('customerTier')
    .optional()
    .isIn(['bronze', 'silver', 'gold', 'platinum'])
    .withMessage('Customer tier must be bronze, silver, gold, or platinum'),
  
  body('businessType')
    .optional()
    .isIn(['individual', 'wholesale', 'distributor', 'retailer'])
    .withMessage('Business type must be individual, wholesale, distributor, or retailer')
];

// Sales Order validation rules
const validateSalesOrder = [
  body('customer')
    .isUUID(4)
    .withMessage('Customer must be a valid UUID'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  
  body('items.*.product')
    .isUUID(4)
    .withMessage('Each item must have a valid product UUID'),
  
  body('items.*.quantity')
    .isInt({ min: 1, max: 999999 })
    .withMessage('Quantity must be a positive integer'),
  
  body('items.*.unitPrice')
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Unit price must be a valid currency amount'),
  
  body('expectedDelivery')
    .optional()
    .isISO8601()
    .withMessage('Expected delivery must be a valid date'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must be less than 2000 characters'),
  
  body('terms')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Terms must be less than 500 characters')
];

// Purchase Order validation rules
const validatePurchaseOrder = [
  body('supplier')
    .isUUID(4)
    .withMessage('Supplier must be a valid UUID'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  
  body('items.*.product')
    .isUUID(4)
    .withMessage('Each item must have a valid product UUID'),
  
  body('items.*.quantity')
    .isInt({ min: 1, max: 999999 })
    .withMessage('Quantity must be a positive integer'),
  
  body('items.*.unitCost')
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Unit cost must be a valid currency amount'),
  
  body('expectedDelivery')
    .optional()
    .isISO8601()
    .withMessage('Expected delivery must be a valid date'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes must be less than 2000 characters')
];

// Supplier validation rules
const validateSupplier = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Supplier name must be between 2 and 100 characters'),
  
  body('contactName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Contact name must be between 2 and 100 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  
  body('website')
    .optional()
    .isURL()
    .withMessage('Website must be a valid URL')
];

// User validation rules
const validateUser = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
  
  body('role')
    .isIn(['admin', 'manager', 'cashier', 'inventory'])
    .withMessage('Role must be admin, manager, cashier, or inventory')
];

// Login validation rules
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// ID parameter validation (PostgreSQL UUID)
const validateId = [
  param('id')
    .isUUID(4)
    .withMessage('Invalid ID format (UUID required)')
];

/** Returns middleware that validates a route param as UUID (e.g. validateUuidParam('id')) */
function validateUuidParam(paramName) {
  return param(paramName)
    .isUUID(4)
    .withMessage('Invalid ID format (UUID required)');
}

// Search query validation
const validateSearch = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must be less than 100 characters'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      message: 'No file uploaded'
    });
  }
  
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      message: 'Invalid file type. Only CSV and Excel files are allowed'
    });
  }
  
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      message: 'File size must be less than 10MB'
    });
  }
  
  next();
};

// Account Category validation
const validateAccountCategory = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2 and 100 characters'),
  
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Category code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Category code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Category code must contain only uppercase letters, numbers, and underscores'),
  
  body('accountType')
    .isIn(['asset', 'liability', 'equity', 'revenue', 'expense'])
    .withMessage('Invalid account type'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color code'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
  
  sanitizeRequest,
  handleValidationErrors
];

module.exports = {
  sanitizeRequest,
  handleValidationErrors,
  validateProduct,
  validateCustomer,
  validateSalesOrder,
  validatePurchaseOrder,
  validateSupplier,
  validateUser,
  validateLogin,
  validateId,
  validateUuidParam,
  validateSearch,
  validateFileUpload,
  validateAccountCategory
};
