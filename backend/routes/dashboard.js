const express = require('express');
const { query } = require('express-validator');
const { auth, requireAnyPermission } = require('../middleware/auth');
const { VIEW_DASHBOARD } = require('../config/routePermissions');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams } = require('../middleware/dateFilter');
const dashboardService = require('../services/dashboardService');

const router = express.Router();

router.get(
  '/range-summary',
  [
    auth,
    requireAnyPermission(VIEW_DASHBOARD),
    ...validateDateParams,
    query('dateFrom').notEmpty().withMessage('dateFrom is required'),
    query('dateTo').notEmpty().withMessage('dateTo is required'),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const data = await dashboardService.getRangeSummary(req.query);
      res.json({ success: true, data });
    } catch (e) {
      const status = e.statusCode || 500;
      if (status >= 500) {
        console.error('Dashboard range-summary error:', e);
      }
      res.status(status).json({
        success: false,
        message: e.message || 'Server error',
      });
    }
  }
);

module.exports = router;
