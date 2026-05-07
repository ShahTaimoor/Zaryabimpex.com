const express = require('express');
const multer = require('multer');
const { body, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const marketPriceService = require('../services/marketPriceService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/history', [
  auth,
  requirePermission('view_market_prices'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const result = await marketPriceService.getHistory({ page, limit });
    res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/manual', [
  auth,
  requirePermission('manage_market_prices'),
  body('productId').isUUID(4),
  body('purchasePrice').isFloat({ min: 0 }),
  body('effectiveDate').optional().isISO8601(),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const created = await marketPriceService.setManualPrice({
      productId: req.body.productId,
      purchasePrice: req.body.purchasePrice,
      effectiveDate: req.body.effectiveDate,
      userId: req.user?.id || req.user?._id
    });
    res.status(201).json({ message: 'Market purchase price updated', entry: created });
  } catch (error) {
    return next(error);
  }
});

router.get('/template', [auth, requirePermission('import_market_prices')], async (req, res, next) => {
  try {
    const workbook = await marketPriceService.createTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=market-price-template.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    return next(error);
  }
});

router.post('/import/preview', [
  auth,
  requirePermission('import_market_prices'),
  upload.single('file')
], async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Excel file is required' });
    const mapping = JSON.parse(req.body.mapping || '{}');
    const preview = await marketPriceService.previewExcelImport({
      buffer: req.file.buffer,
      mapping
    });
    res.json(preview);
  } catch (error) {
    return next(error);
  }
});

router.post('/import/apply', [
  auth,
  requirePermission('import_market_prices'),
  upload.single('file')
], async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Excel file is required' });
    const mapping = JSON.parse(req.body.mapping || '{}');
    const result = await marketPriceService.applyExcelImport({
      buffer: req.file.buffer,
      mapping,
      userId: req.user?.id || req.user?._id,
      fileName: req.file.originalname
    });
    res.json({ message: 'Market prices imported', ...result });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
