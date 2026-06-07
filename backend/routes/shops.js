const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { requireWarehouseInventoryEnabled } = require('../utils/warehouseInventory');
const shopService = require('../services/shopService');

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

router.get('/', [
  auth,
  requirePermission('view_inventory'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('isActive').optional().isBoolean(),
], handleValidation, async (req, res, next) => {
  try {
    const result = await shopService.getShops(req.query);
    res.json({ success: true, data: { shops: result.shops }, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
});

router.get('/:shopId', [
  auth,
  requirePermission('view_inventory'),
  param('shopId').isUUID(4),
], handleValidation, async (req, res, next) => {
  try {
    const shop = await shopService.getShopById(req.params.shopId);
    res.json({ success: true, data: { shop } });
  } catch (err) {
    if (err.message === 'Shop not found') return res.status(404).json({ message: err.message });
    next(err);
  }
});

router.get('/:shopId/stock', [
  auth,
  requireWarehouseInventoryEnabled,
  requirePermission('view_inventory'),
  param('shopId').isUUID(4),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('search').optional().isString().trim(),
  query('allProducts').optional().isIn(['true', 'false', '1', '0']),
], handleValidation, async (req, res, next) => {
  try {
    const result = await shopService.getShopStock(req.params.shopId, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/:shopId/products', [
  auth,
  requirePermission('view_inventory'),
  param('shopId').isUUID(4),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('search').optional().isString().trim(),
], handleValidation, async (req, res, next) => {
  try {
    const result = await shopService.getShopProducts(req.params.shopId, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/', [
  auth,
  requirePermission('manage_inventory'),
  body('name').trim().isLength({ min: 2, max: 150 }),
  body('code').trim().isLength({ min: 2, max: 50 }),
  body('isPrimary').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
], handleValidation, async (req, res, next) => {
  try {
    const shop = await shopService.createShop(req.body, req.user?.id || req.user?._id);
    res.status(201).json({ success: true, data: { shop } });
  } catch (err) {
    if (err.message?.includes('already exists')) return res.status(400).json({ message: err.message });
    next(err);
  }
});

router.put('/:shopId', [
  auth,
  requirePermission('manage_inventory'),
  param('shopId').isUUID(4),
  body('name').optional().trim().isLength({ min: 2, max: 150 }),
  body('code').optional().trim().isLength({ min: 2, max: 50 }),
  body('isPrimary').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
], handleValidation, async (req, res, next) => {
  try {
    const shop = await shopService.updateShop(req.params.shopId, req.body, req.user?.id || req.user?._id);
    res.json({ success: true, data: { shop } });
  } catch (err) {
    if (err.message === 'Shop not found') return res.status(404).json({ message: err.message });
    if (err.message?.includes('already exists')) return res.status(400).json({ message: err.message });
    next(err);
  }
});

router.delete('/:shopId', [
  auth,
  requirePermission('manage_inventory'),
  param('shopId').isUUID(4),
], handleValidation, async (req, res, next) => {
  try {
    const result = await shopService.deleteShop(req.params.shopId);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.message === 'Shop not found') return res.status(404).json({ message: err.message });
    if (err.message?.includes('primary')) return res.status(400).json({ message: err.message });
    next(err);
  }
});

module.exports = router;
