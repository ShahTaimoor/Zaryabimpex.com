const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const stockTransferService = require('../services/stockTransferService');
const { requireWarehouseInventoryEnabled } = require('../utils/warehouseInventory');

const router = express.Router();

router.use(requireWarehouseInventoryEnabled);

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

router.get('/', [
  auth,
  requirePermission('view_stock_movements'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('warehouseId').optional().isUUID(4),
  query('shopId').optional().isUUID(4),
], handleValidation, async (req, res, next) => {
  try {
    const result = await stockTransferService.getTransfers(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', [
  auth,
  requirePermission('view_stock_movements'),
  param('id').isUUID(4),
], handleValidation, async (req, res, next) => {
  try {
    const result = await stockTransferService.getTransferById(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === 'Transfer not found') return res.status(404).json({ message: err.message });
    next(err);
  }
});

router.post('/', [
  auth,
  requirePermission('manage_inventory'),
  body('fromWarehouseId').optional().isUUID(4),
  body('toShopId').optional().isUUID(4),
  body('notes').optional().isString().trim(),
  body('lines').isArray({ min: 1 }),
  body('lines.*.productId').optional().isUUID(4),
  body('lines.*.product').optional().isUUID(4),
  body('lines.*.quantity').isFloat({ min: 0.001 }),
], handleValidation, async (req, res, next) => {
  try {
    const result = await stockTransferService.createTransfer(
      req.body,
      req.user?.id || req.user?._id
    );
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.message?.includes('Insufficient') || err.message?.includes('required')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
});

module.exports = router;
