const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../middleware/auth');
const { query, param, body } = require('express-validator');
const balanceSheetService = require('../services/balanceSheetCalculationService');

function wrapForList(sheet, id = null) {
  const date = sheet.statementDate || sheet.generatedAt || new Date();
  const idStr = id || `bs-${date.toISOString().slice(0, 10)}`;
  const assets = sheet.assets || {};
  const equity = sheet.equity || {};
  return {
    _id: idStr,
    id: idStr,
    statementNumber: `BS-${date.toISOString().slice(0, 10)}`,
    statementDate: date,
    periodType: 'monthly',
    status: 'draft',
    metadata: { generatedAt: sheet.generatedAt || date },
    ...sheet,
    assets: { ...assets, totalAssets: assets.total ?? assets.totalAssets ?? 0 },
    equity: { ...equity, totalEquity: equity.total ?? equity.totalEquity ?? 0 },
    liabilities: {
      ...(sheet.liabilities || {}),
      total: sheet.liabilities?.total ?? 0,
      totalLiabilities: sheet.liabilities?.totalLiabilities ?? sheet.liabilities?.total ?? 0
    }
  };
}

/**
 * @route   GET /api/balance-sheets/stats
 * @desc    Balance sheet statistics
 * @access  Private
 */
router.get('/stats', auth, requirePermission('view_reports'), async (req, res) => {
  try {
    const sheet = await balanceSheetService.generateBalanceSheet(new Date());
    res.json({
      total: 1,
      byStatus: { draft: 1, approved: 0, final: 0 },
      latestStatementDate: sheet.statementDate || new Date()
    });
  } catch (error) {
    res.json({ total: 0, byStatus: {}, latestStatementDate: null });
  }
});

/**
 * @route   GET /api/balance-sheets/latest
 * @desc    Get latest balance sheet
 * @access  Private
 */
router.get('/latest', [
  auth,
  requirePermission('view_reports'),
  query('asOfDate').optional().isISO8601()
], async (req, res) => {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
    const sheet = await balanceSheetService.generateBalanceSheet(asOfDate);
    res.json(wrapForList(sheet));
  } catch (error) {
    console.error('Error generating latest balance sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating balance sheet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/balance-sheets/generate
 * @desc    Generate balance sheet (POST)
 * @access  Private
 */
router.post('/generate', [
  auth,
  requirePermission('view_reports'),
  body('asOfDate').optional().isISO8601(),
  body('statementDate').optional().isISO8601(),
  body('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const asOfDate = req.body.asOfDate || req.body.statementDate || req.body.endDate || new Date();
    const date = asOfDate ? new Date(asOfDate) : new Date();
    const balanceSheet = await balanceSheetService.generateBalanceSheet(date);
    res.json({
      success: true,
      data: wrapForList(balanceSheet)
    });
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating balance sheet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/balance-sheets
 * @desc    List balance sheets (returns generated sheet as single-item list)
 * @access  Private
 */
router.get('/', [
  auth,
  requirePermission('view_reports'),
  query('asOfDate').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
    const balanceSheet = await balanceSheetService.generateBalanceSheet(asOfDate);
    const wrapped = wrapForList(balanceSheet);
    res.json({
      balanceSheets: [wrapped],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
    });
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating balance sheet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/balance-sheets/:id
 * @desc    Get balance sheet by id (generates for date if id looks like date)
 * @access  Private
 */
router.get('/:id', [
  auth,
  requirePermission('view_reports'),
  param('id').notEmpty()
], async (req, res) => {
  try {
    let date = new Date();
    const id = req.params.id;
    if (id.startsWith('bs-') && id.length >= 12) {
      const dateStr = id.slice(3, 13);
      if (!isNaN(Date.parse(dateStr))) date = new Date(dateStr);
    }
    const balanceSheet = await balanceSheetService.generateBalanceSheet(date);
    res.json(wrapForList(balanceSheet, id));
  } catch (error) {
    console.error('Error fetching balance sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching balance sheet',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/balance-sheets/:id
 * @desc    Update balance sheet (stub - no persistence)
 * @access  Private
 */
router.put('/:id', auth, requirePermission('view_reports'), (req, res) => {
  res.json({ success: true, data: { _id: req.params.id, ...req.body } });
});

/**
 * @route   PUT /api/balance-sheets/:id/status
 * @desc    Update balance sheet status (stub)
 * @access  Private
 */
router.put('/:id/status', auth, requirePermission('view_reports'), (req, res) => {
  res.json({ success: true, data: { id: req.params.id, status: req.body.status || 'draft' } });
});

/**
 * @route   DELETE /api/balance-sheets/:id
 * @desc    Delete balance sheet (stub - no persistence)
 * @access  Private
 */
router.delete('/:id', auth, requirePermission('view_reports'), (req, res) => {
  res.json({ success: true, message: 'Deleted' });
});

/**
 * @route   GET /api/balance-sheets/:id/comparison
 * @desc    Get balance sheet comparison (stub)
 * @access  Private
 */
router.get('/:id/comparison', [
  auth,
  requirePermission('view_reports'),
  query('type').optional().isIn(['previous', 'year-over-year'])
], async (req, res) => {
  try {
    const id = req.params.id;
    let date = new Date();
    if (id.startsWith('bs-') && id.length >= 12) {
      const dateStr = id.slice(3, 13);
      if (!isNaN(Date.parse(dateStr))) date = new Date(dateStr);
    }
    const current = await balanceSheetService.generateBalanceSheet(date);
    const prevDate = new Date(date);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const previous = await balanceSheetService.generateBalanceSheet(prevDate);
    res.json({
      current: wrapForList(current),
      previous: wrapForList(previous),
      type: req.query.type || 'previous'
    });
  } catch (error) {
    res.json({ current: null, previous: null, type: req.query.type || 'previous' });
  }
});

/**
 * @route   POST /api/balance-sheets/:id/audit
 * @desc    Add audit entry (stub)
 * @access  Private
 */
router.post('/:id/audit', auth, requirePermission('view_reports'), (req, res) => {
  res.json({ success: true, data: { id: req.params.id, ...req.body } });
});

module.exports = router;
