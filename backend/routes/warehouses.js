const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { sanitizeRequest } = require('../middleware/validation');
const warehouseService = require('../services/warehouseService');

const router = express.Router();

const validateWarehouseId = [
  param('id')
    .isUUID(4)
    .withMessage('Valid warehouse ID is required'),
];

const baseFilters = [
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 150 })
    .withMessage('Search must be a string up to 150 characters'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
];

const createWarehouseValidators = ({ allowPartial = false } = {}) => {
  const chain = [];

  const nameValidator = body('name')
    .notEmpty()
    .withMessage('Warehouse name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Name must be between 2 and 150 characters');
  chain.push(allowPartial ? nameValidator.optional({ nullable: true }) : nameValidator);

  const codeValidator = body('code')
    .notEmpty()
    .withMessage('Warehouse code is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Code must be between 2 and 50 characters');
  chain.push(allowPartial ? codeValidator.optional({ nullable: true }) : codeValidator);

  const descriptionValidator = body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 });
  chain.push(descriptionValidator);

  const addressValidator = body('address')
    .optional({ nullable: true, checkFalsy: true })
    .isObject()
    .withMessage('Address must be an object');
  chain.push(addressValidator);

  chain.push(body('address.line1').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 150 }));
  chain.push(body('address.line2').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 150 }));
  chain.push(body('address.city').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }));
  chain.push(body('address.state').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }));
  chain.push(
    body('address.postalCode').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 30 })
  );
  chain.push(body('address.country').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }));

  const contactValidator = body('contact')
    .optional({ nullable: true, checkFalsy: true })
    .isObject()
    .withMessage('Contact must be an object');
  chain.push(contactValidator);

  chain.push(body('contact.name').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 150 }));
  chain.push(body('contact.phone').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 50 }));
  chain.push(
    body('contact.email')
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .trim()
      .isEmail()
      .withMessage('Contact email must be a valid email')
  );

  chain.push(body('notes').optional().isString().trim().isLength({ max: 1000 }));
  chain.push(
    body('capacity')
      .optional({ nullable: true, checkFalsy: true })
      .isFloat({ min: 0 })
      .withMessage('Capacity must be a positive number')
  );
  chain.push(body('isPrimary').optional().isBoolean());
  chain.push(body('isActive').optional().isBoolean());

  return chain;
};

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get(
  '/',
  [
    auth,
    requirePermission('view_inventory'),
    sanitizeRequest,
    ...baseFilters,
    handleValidation,
  ],
  async (req, res) => {
    try {
      const {
        search,
        isActive,
        page = 1,
        limit = 20,
      } = req.query;

      const { warehouses, pagination } = await warehouseService.getWarehouses({
        search,
        isActive,
        page,
        limit
      });

      res.json({
        success: true,
        data: {
          warehouses,
          pagination,
        },
      });
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching warehouses',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

router.get(
  '/:id',
  [
    auth,
    requirePermission('view_inventory'),
    sanitizeRequest,
    ...validateWarehouseId,
    handleValidation,
  ],
  async (req, res) => {
    try {
      const warehouse = await warehouseService.getWarehouseById(req.params.id);

      res.json({
        success: true,
        data: warehouse,
      });
    } catch (error) {
      if (error.message === 'Warehouse not found') {
        return res.status(404).json({
          success: false,
          message: 'Warehouse not found',
        });
      }
      console.error('Error fetching warehouse:', error);
      res.status(500).json({
        success: false,
        message: 'Server error fetching warehouse',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

router.post(
  '/',
  [
    auth,
    requirePermission('update_inventory'),
    sanitizeRequest,
    ...createWarehouseValidators(),
    handleValidation,
  ],
  async (req, res) => {
    try {
      const { name, code } = req.body;
      
      if (!name || !code) {
        return res.status(400).json({
          success: false,
          message: 'Warehouse name and code are required'
        });
      }

      const payload = {
        ...req.body,
        code: String(code).toUpperCase(),
      };

      let warehouse;
      try {
        warehouse = await warehouseService.createWarehouse(payload, req.user.id || req.user._id);
      } catch (err) {
        if (err.message === 'Warehouse code already exists') {
          return res.status(400).json({
            success: false,
            message: 'Warehouse code already exists'
          });
        }
        throw err;
      }
      res.status(201).json({
        success: true,
        message: 'Warehouse created successfully',
        data: warehouse,
      });
    } catch (error) {
      console.error('Error creating warehouse:', error);
      res.status(500).json({
        success: false,
        message: 'Server error creating warehouse',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

router.put(
  '/:id',
  [
    auth,
    requirePermission('update_inventory'),
    sanitizeRequest,
    ...validateWarehouseId,
    ...createWarehouseValidators({ allowPartial: true }),
    handleValidation,
  ],
  async (req, res) => {
    try {
      const updates = { ...req.body };

      if (updates.code) {
        updates.code = String(updates.code).toUpperCase();
      }

      const warehouse = await warehouseService.updateWarehouse(req.params.id, updates, req.user.id || req.user._id);

      res.json({
        success: true,
        message: 'Warehouse updated successfully',
        data: warehouse,
      });
    } catch (error) {
      if (error.message === 'Warehouse not found') {
        return res.status(404).json({
          success: false,
          message: 'Warehouse not found',
        });
      }
      if (error.message === 'Warehouse code already exists') {
        return res.status(409).json({
          success: false,
          message: 'Warehouse code must be unique',
        });
      }
      console.error('Error updating warehouse:', error);
      res.status(500).json({
        success: false,
        message: 'Server error updating warehouse',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

router.delete(
  '/:id',
  [
    auth,
    requirePermission('update_inventory'),
    sanitizeRequest,
    ...validateWarehouseId,
    handleValidation,
  ],
  async (req, res) => {
    try {
      const warehouse = await warehouseService.getWarehouseById(req.params.id);

      if (warehouse.isPrimary) {
        return res.status(400).json({
          success: false,
          message: 'Primary warehouse cannot be deleted. Transfer primary status before deleting.',
        });
      }

      const result = await warehouseService.deleteWarehouse(req.params.id);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      if (error.message === 'Warehouse not found') {
        return res.status(404).json({
          success: false,
          message: 'Warehouse not found',
        });
      }
      if (error.message.includes('Cannot delete warehouse')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      console.error('Error deleting warehouse:', error);
      res.status(500).json({
        success: false,
        message: 'Server error deleting warehouse',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

module.exports = router;

