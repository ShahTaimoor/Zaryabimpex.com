const express = require('express');
const { body, query, param } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const dailyCashService = require('../services/dailyCashService');
const { isDailyCashClosingEnabled } = require('../utils/dailyCashSettings');

const router = express.Router();
const adminOnly = [auth, requireRole('admin')];

router.use(async (req, res, next) => {
  try {
    if (!(await isDailyCashClosingEnabled())) {
      return res.status(403).json({
        success: false,
        message: 'Daily Cash Closing is disabled. Enable it in Settings → Advanced.',
        code: 'DAILY_CASH_DISABLED',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
});

function mapSummary(row) {
  if (!row) return null;
  return {
    businessDate: row.businessDate || row.business_date,
    openingCash: Number(row.openingCash ?? row.opening_cash ?? 0),
    cashIn: Number(row.cashIn ?? row.cash_in ?? 0),
    cashOut: Number(row.cashOut ?? row.cash_out ?? 0),
    expectedCash: Number(row.expectedCash ?? row.expected_cash ?? 0),
    actualCash: row.actualCash != null ? Number(row.actualCash) : (row.actual_cash != null ? Number(row.actual_cash) : null),
    difference: row.difference != null ? Number(row.difference) : null,
    varianceType: row.varianceType || row.variance_type,
    status: row.status,
    closedAt: row.closedAt || row.closed_at,
    closedBy: row.closedBy || row.closed_by,
    closedByName: row.closedByName || row.closed_by_name,
    notes: row.notes || '',
    movementCount: row.movementCount ?? null,
    breakdown: row.breakdown ?? null,
    movements: row.movements,
  };
}

function mapClosing(row) {
  if (!row) return null;
  return {
    id: row.id,
    ...mapSummary(row),
  };
}

function handleCashError(err, res) {
  if (['DAY_ALREADY_CLOSED'].includes(err.code)) {
    return res.status(400).json({ success: false, message: err.message, code: err.code });
  }
  console.error('Daily cash route error:', err);
  return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Server error', code: err.code });
}

router.get('/today', auth, async (req, res) => {
  try {
    const date = req.query.date || undefined;
    const summary = date
      ? await dailyCashService.buildDailySummary(date)
      : await dailyCashService.getTodaySummary();
    res.json({ success: true, data: mapSummary(summary) });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.post('/opening', [
  ...adminOnly,
  body('businessDate').optional().isISO8601({ strict: true, strictSeparator: true }),
  body('openingCash').isFloat({ min: 0 }).withMessage('openingCash must be >= 0'),
], async (req, res) => {
  try {
    const summary = await dailyCashService.setOpeningCash(
      req.body.businessDate,
      req.body.openingCash,
      req.user._id || req.user.id
    );
    res.json({ success: true, data: mapSummary(summary) });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.post('/close', [
  ...adminOnly,
  body('businessDate').optional().isISO8601({ strict: true, strictSeparator: true }),
  body('actualCash').isFloat({ min: 0 }).withMessage('actualCash must be >= 0'),
  body('openingCash').optional().isFloat({ min: 0 }),
  body('notes').optional().isString(),
], async (req, res) => {
  try {
    const result = await dailyCashService.closeDay({
      businessDate: req.body.businessDate,
      actualCash: req.body.actualCash,
      openingCash: req.body.openingCash,
      notes: req.body.notes,
    }, req.user._id || req.user.id);
    res.json({ success: true, data: mapClosing(result) });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.post('/withdraw', [
  ...adminOnly,
  body('amount').isFloat({ min: 0.01 }).withMessage('amount must be > 0'),
  body('description').optional().isString(),
  body('businessDate').optional().isISO8601({ strict: true, strictSeparator: true }),
], async (req, res) => {
  try {
    const movement = await dailyCashService.recordWithdrawal(req.user._id || req.user.id, {
      amount: req.body.amount,
      description: req.body.description,
      businessDate: req.body.businessDate,
    });
    const summary = await dailyCashService.getTodaySummary();
    res.json({ success: true, data: { movement, summary: mapSummary(summary) } });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.post('/adjustment', [
  ...adminOnly,
  body('amount').isFloat({ min: 0.01 }).withMessage('amount must be > 0'),
  body('direction').isIn(['in', 'out']).withMessage('direction must be in or out'),
  body('description').optional().isString(),
  body('businessDate').optional().isISO8601({ strict: true, strictSeparator: true }),
], async (req, res) => {
  try {
    const movement = await dailyCashService.recordAdjustment(req.user._id || req.user.id, {
      amount: req.body.amount,
      direction: req.body.direction,
      description: req.body.description,
      businessDate: req.body.businessDate,
    });
    const summary = await dailyCashService.buildDailySummary(req.body.businessDate);
    res.json({ success: true, data: { movement, summary: mapSummary(summary) } });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.post('/movements/:id/cancel', [
  ...adminOnly,
  param('id').isUUID(),
  body('reason').optional().isString(),
], async (req, res) => {
  try {
    const movement = await dailyCashService.cancelMovement(
      req.params.id,
      req.user._id || req.user.id,
      req.body.reason
    );
    res.json({ success: true, data: movement });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.get('/reports/summary', [
  ...adminOnly,
  query('fromDate').isISO8601(),
  query('toDate').isISO8601(),
], async (req, res) => {
  try {
    const data = await dailyCashService.getDailySummaryReport({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });
    res.json({ success: true, data: data.map(mapClosing) });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.get('/reports/closings', [
  ...adminOnly,
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
  query('status').optional().isIn(['open', 'closed']),
  query('limit').optional().isInt({ min: 1, max: 500 }),
], async (req, res) => {
  try {
    const data = await dailyCashService.getClosingReport({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      status: req.query.status,
      limit: parseInt(req.query.limit || '100', 10),
    });
    res.json({ success: true, data: data.map(mapClosing) });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.get('/reports/movements', [
  ...adminOnly,
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
  query('businessDate').optional().isISO8601({ strict: true, strictSeparator: true }),
  query('userId').optional().isUUID(),
  query('movementType').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
], async (req, res) => {
  try {
    const data = await dailyCashService.getMovementReport({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      businessDate: req.query.businessDate,
      userId: req.query.userId,
      movementType: req.query.movementType,
      limit: parseInt(req.query.limit || '200', 10),
    });
    res.json({ success: true, data });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.get('/reports/variance', [
  ...adminOnly,
  query('fromDate').isISO8601(),
  query('toDate').isISO8601(),
  query('varianceType').optional().isIn(['over', 'short']),
], async (req, res) => {
  try {
    const data = await dailyCashService.getVarianceReport({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      varianceType: req.query.varianceType,
    });
    res.json({ success: true, data: data.map(mapClosing) });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.get('/reports/user-activity', [
  ...adminOnly,
  query('fromDate').isISO8601(),
  query('toDate').isISO8601(),
], async (req, res) => {
  try {
    const data = await dailyCashService.getUserActivityReport({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });
    res.json({ success: true, data });
  } catch (err) {
    handleCashError(err, res);
  }
});

router.get('/dashboard', [
  ...adminOnly,
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
], async (req, res) => {
  try {
    const data = await dailyCashService.getDashboardStats({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });
    res.json({
      success: true,
      data: {
        ...data,
        today: mapSummary(data.today),
      },
    });
  } catch (err) {
    handleCashError(err, res);
  }
});

module.exports = router;
