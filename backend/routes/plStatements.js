const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../middleware/auth');
const { query } = require('express-validator');
const plService = require('../services/plCalculationService');

const plView = [auth, requirePermission('view_reports')];

function parseDateRange(req) {
  const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
  const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
  return { startDate, endDate };
}

/**
 * @route   GET /api/pl-statements
 * @desc    Generate Profit & Loss statement (list/generate)
 * @access  Private
 */
router.get('/', [
  ...plView,
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format')
], async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const plStatement = await plService.generatePLStatement(startDate, endDate);
    res.json({
      success: true,
      data: plStatement
    });
  } catch (error) {
    console.error('Error generating P&L statement:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating P&L statement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/pl-statements/summary
 * @desc    P&L summary for date range (used by PLStatements page)
 * @access  Private
 */
router.get('/summary', [
  ...plView,
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format')
], async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const plStatement = await plService.generatePLStatement(startDate, endDate);
    res.json({
      success: true,
      data: plStatement
    });
  } catch (error) {
    console.error('Error fetching P&L summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching P&L summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/pl-statements/trends
 * @desc    P&L trends (returns same shape as summary for now)
 * @access  Private
 */
router.get('/trends', [
  ...plView,
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const plStatement = await plService.generatePLStatement(startDate, endDate);
    res.json({ success: true, data: plStatement });
  } catch (error) {
    console.error('Error fetching P&L trends:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/pl-statements/latest
 * @desc    Latest P&L (current month summary)
 * @access  Private
 */
router.get('/latest', plView, async (req, res) => {
  try {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    const plStatement = await plService.generatePLStatement(start, end);
    res.json({ success: true, data: plStatement });
  } catch (error) {
    console.error('Error fetching latest P&L:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/pl-statements/generate
 * @desc    Generate P&L statement (POST with body startDate/endDate)
 * @access  Private
 */
router.post('/generate', [
  ...plView
], async (req, res) => {
  try {
    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.body.endDate ? new Date(req.body.endDate) : new Date();
    const plStatement = await plService.generatePLStatement(startDate, endDate);
    res.json({ success: true, data: plStatement });
  } catch (error) {
    console.error('Error generating P&L statement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
