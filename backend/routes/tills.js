const express = require('express');
const { body, query, param } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const tillService = require('../services/tillService');

const router = express.Router();
const adminOnly = [auth, requireRole('admin')];

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    cashierName: row.cashier_name,
    storeId: row.store_id,
    deviceId: row.device_id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openedBy: row.opened_by,
    closedBy: row.closed_by,
    openedByName: row.opened_by_name,
    closedByName: row.closed_by_name,
    openingAmount: Number(row.opening_amount ?? row.openingAmount ?? 0),
    closingDeclaredAmount: row.closing_declared_amount != null ? Number(row.closing_declared_amount) : null,
    expectedAmount: row.expected_amount != null ? Number(row.expected_amount) : (row.expectedCash ?? null),
    varianceAmount: row.variance_amount != null ? Number(row.variance_amount) : null,
    varianceType: row.variance_type,
    cashIn: row.cashIn ?? null,
    cashOut: row.cashOut ?? null,
    expectedCash: row.expectedCash ?? null,
    movementCount: row.movementCount ?? null,
    breakdown: row.breakdown ?? null,
    notesOpen: row.notes_open,
    notesClose: row.notes_close,
    status: row.status,
    movements: row.movements,
  };
}

function handleTillError(err, res) {
  if (['NO_OPEN_TILL', 'TILL_ALREADY_OPEN', 'TILL_ALREADY_CLOSED'].includes(err.code)) {
    return res.status(400).json({ success: false, message: err.message, code: err.code });
  }
  console.error('Till route error:', err);
  return res.status(500).json({ success: false, message: err.message || 'Server error' });
}

/** Active shop till — any authenticated user (read-only status for POS). */
router.get('/current', auth, async (req, res) => {
  try {
    const session = await tillService.getActiveShopTill();
    res.json({ success: true, data: mapSession(session) });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.post('/open', [
  ...adminOnly,
  body('openingAmount').isFloat({ min: 0 }).withMessage('openingAmount must be >= 0'),
  body('storeId').optional().isString(),
  body('deviceId').optional().isString(),
  body('notesOpen').optional().isString(),
], async (req, res) => {
  try {
    const session = await tillService.openTill({
      openingAmount: req.body.openingAmount,
      storeId: req.body.storeId,
      deviceId: req.body.deviceId,
      notesOpen: req.body.notesOpen,
    }, req.user._id || req.user.id);
    res.json({ success: true, data: mapSession(session) });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.post('/close', [
  ...adminOnly,
  body('closingDeclaredAmount').isFloat({ min: 0 }).withMessage('closingDeclaredAmount must be >= 0'),
  body('notesClose').optional().isString(),
], async (req, res) => {
  try {
    const session = await tillService.closeTill({
      closingDeclaredAmount: req.body.closingDeclaredAmount,
      notesClose: req.body.notesClose,
    }, req.user._id || req.user.id);
    res.json({ success: true, data: mapSession(session) });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.post('/withdraw', [
  ...adminOnly,
  body('amount').isFloat({ min: 0.01 }).withMessage('amount must be > 0'),
  body('description').optional().isString(),
], async (req, res) => {
  try {
    const movement = await tillService.recordWithdrawal(req.user._id || req.user.id, {
      amount: req.body.amount,
      description: req.body.description,
    });
    const session = await tillService.getActiveShopTill();
    res.json({ success: true, data: { movement, session: mapSession(session) } });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.get('/sessions', [
  ...adminOnly,
  query('status').optional().isIn(['open', 'closed']),
  query('userId').optional().isUUID(),
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('offset').optional().isInt({ min: 0 }),
], async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      userId: req.query.userId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      limit: parseInt(req.query.limit || '50', 10),
      offset: parseInt(req.query.offset || '0', 10),
    };
    const sessions = await tillService.listSessions(filters);
    res.json({ success: true, data: sessions.map(mapSession) });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.get('/sessions/:id', [
  ...adminOnly,
  param('id').isUUID(),
], async (req, res) => {
  try {
    const session = await tillService.getSessionById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: mapSession(session) });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.get('/reports/daily-summary', [
  ...adminOnly,
  query('fromDate').isISO8601(),
  query('toDate').isISO8601(),
], async (req, res) => {
  try {
    const data = await tillService.getDailySummary({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });
    res.json({ success: true, data });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.get('/reports/cashier-summary', [
  ...adminOnly,
  query('fromDate').isISO8601(),
  query('toDate').isISO8601(),
], async (req, res) => {
  try {
    const data = await tillService.getCashierSummary({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });
    res.json({ success: true, data });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.get('/reports/movements', [
  ...adminOnly,
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
  query('userId').optional().isUUID(),
  query('tillSessionId').optional().isUUID(),
  query('movementType').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
], async (req, res) => {
  try {
    const data = await tillService.getMovementReport({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      userId: req.query.userId,
      tillSessionId: req.query.tillSessionId,
      movementType: req.query.movementType,
      limit: parseInt(req.query.limit || '200', 10),
    });
    res.json({ success: true, data });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.get('/reports/variance', [
  ...adminOnly,
  query('fromDate').isISO8601(),
  query('toDate').isISO8601(),
  query('varianceType').optional().isIn(['over', 'short']),
], async (req, res) => {
  try {
    const data = await tillService.getVarianceReport({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      varianceType: req.query.varianceType,
    });
    res.json({ success: true, data: data.map(mapSession) });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.get('/dashboard', [
  ...adminOnly,
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
], async (req, res) => {
  try {
    const stats = await tillService.getDashboardStats({
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });
    const current = await tillService.getActiveShopTill();
    res.json({
      success: true,
      data: {
        ...stats,
        currentSession: mapSession(current),
      },
    });
  } catch (err) {
    handleTillError(err, res);
  }
});

router.get('/variance', [
  ...adminOnly,
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const sessions = await tillService.listSessions({ limit });
    res.json({ success: true, data: sessions.map(mapSession) });
  } catch (err) {
    handleTillError(err, res);
  }
});

module.exports = router;
