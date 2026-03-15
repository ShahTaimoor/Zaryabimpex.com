const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const salesPerformanceService = require('../services/salesPerformanceService');
const salesPerformanceRepository = require('../repositories/postgres/SalesPerformanceRepository');
const salesRepository = require('../repositories/postgres/SalesRepository');

const router = express.Router();

// @route   POST /api/sales-performance/generate
// @desc    Generate a new sales performance report
// @access  Private (requires 'view_reports' permission)
router.post('/generate', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  body('reportType')
    .isIn(['top_products', 'top_customers', 'top_sales_reps', 'comprehensive'])
    .withMessage('Invalid report type'),
  body('periodType')
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
    .withMessage('Invalid period type'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  body('config.filters.orderTypes')
    .optional()
    .isArray()
    .withMessage('Order types filter must be an array'),
  body('config.filters.customerTiers')
    .optional()
    .isArray()
    .withMessage('Customer tiers filter must be an array'),
  body('config.filters.businessTypes')
    .optional()
    .isArray()
    .withMessage('Business types filter must be an array'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await salesPerformanceService.generateSalesPerformanceReport(
      req.body,
      req.user._id
    );

    res.status(201).json({
      message: 'Sales performance report generation started',
      report: {
        reportId: report.reportId,
        reportName: report.reportName,
        reportType: report.reportType,
        periodType: report.periodType,
        startDate: report.startDate,
        endDate: report.endDate,
        status: report.status,
        generatedAt: report.generatedAt
      }
    });
  } catch (error) {
    console.error('Error generating sales performance report:', error);
    res.status(500).json({ 
      message: 'Server error generating sales performance report', 
      error: error.message 
    });
  }
});

// @route   GET /api/sales-performance
// @desc    Get list of sales performance reports
// @access  Private (requires 'view_reports' permission)
router.get('/', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('page').optional({ checkFalsy: true }).isInt({ min: 1 }),
  query('limit').optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }),
  query('reportType').optional({ checkFalsy: true }).isIn(['top_products', 'top_customers', 'top_sales_reps', 'comprehensive']),
  query('status').optional({ checkFalsy: true }).isIn(['generating', 'completed', 'failed', 'archived']),
  query('generatedBy').optional({ checkFalsy: true }).isUUID(4),
  ...validateDateParams,
  query('sortBy').optional({ checkFalsy: true }).isIn(['generatedAt', 'reportName', 'status', 'viewCount']),
  query('sortOrder').optional({ checkFalsy: true }).isIn(['asc', 'desc']),
  handleValidationErrors,
  processDateFilter('generatedAt'),
], async (req, res) => {
  try {
    // Merge date filter from middleware if present (for Pakistan timezone)
    const queryParams = { ...req.query };
    if (req.dateRange) {
      queryParams.startDate = req.dateRange.startDate || undefined;
      queryParams.endDate = req.dateRange.endDate || undefined;
    }
    
    const result = await salesPerformanceService.getSalesPerformanceReports(queryParams);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching sales performance reports:', error);
    res.status(500).json({ 
      message: 'Server error fetching sales performance reports', 
      error: error.message 
    });
  }
});

// @route   GET /api/sales-performance/:reportId
// @desc    Get detailed sales performance report
// @access  Private (requires 'view_reports' permission)
router.get('/:reportId', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('reportId').isLength({ min: 1 }).withMessage('Report ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await salesPerformanceService.getSalesPerformanceReportById(req.params.reportId);
    
    // Mark as viewed
    await report.markAsViewed();
    
    res.json(report);
  } catch (error) {
    console.error('Error fetching sales performance report:', error);
    if (error.message === 'Sales performance report not found') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ 
        message: 'Server error fetching sales performance report', 
        error: error.message 
      });
    }
  }
});

// @route   DELETE /api/sales-performance/:reportId
// @desc    Delete sales performance report
// @access  Private (requires 'manage_reports' permission)
router.delete('/:reportId', [
  auth,
  requirePermission('manage_reports'),
  sanitizeRequest,
  param('reportId').isLength({ min: 1 }).withMessage('Report ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const result = await salesPerformanceService.deleteSalesPerformanceReport(
      req.params.reportId,
      req.user._id
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting sales performance report:', error);
    if (error.message === 'Sales performance report not found') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ 
        message: 'Server error deleting sales performance report', 
        error: error.message 
      });
    }
  }
});

// @route   PUT /api/sales-performance/:reportId/favorite
// @desc    Toggle favorite status of sales performance report
// @access  Private (requires 'view_reports' permission)
router.put('/:reportId/favorite', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('reportId').isLength({ min: 1 }).withMessage('Report ID is required'),
  body('isFavorite').isBoolean().withMessage('Favorite status must be a boolean'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { reportId } = req.params;
    const { isFavorite } = req.body;

    const report = await salesPerformanceRepository.findByReportId(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Sales performance report not found' });
    }

    report.isFavorite = isFavorite;
    await report.save();

    res.json({
      message: `Report ${isFavorite ? 'added to' : 'removed from'} favorites`,
      isFavorite: report.isFavorite
    });
  } catch (error) {
    console.error('Error updating favorite status:', error);
    res.status(500).json({ 
      message: 'Server error updating favorite status', 
      error: error.message 
    });
  }
});

// @route   PUT /api/sales-performance/:reportId/tags
// @desc    Update tags for sales performance report
// @access  Private (requires 'view_reports' permission)
router.put('/:reportId/tags', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('reportId').isLength({ min: 1 }).withMessage('Report ID is required'),
  body('tags').isArray().withMessage('Tags must be an array'),
  body('tags.*').isString().isLength({ max: 50 }).withMessage('Each tag must be a string with max 50 characters'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { reportId } = req.params;
    const { tags } = req.body;

    const report = await salesPerformanceRepository.findByReportId(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Sales performance report not found' });
    }

    report.tags = tags;
    await report.save();

    res.json({
      message: 'Tags updated successfully',
      tags: report.tags
    });
  } catch (error) {
    console.error('Error updating tags:', error);
    res.status(500).json({ 
      message: 'Server error updating tags', 
      error: error.message 
    });
  }
});

// @route   PUT /api/sales-performance/:reportId/notes
// @desc    Update notes for sales performance report
// @access  Private (requires 'view_reports' permission)
router.put('/:reportId/notes', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('reportId').isLength({ min: 1 }).withMessage('Report ID is required'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes must be a string with max 1000 characters'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { reportId } = req.params;
    const { notes } = req.body;

    const report = await salesPerformanceRepository.findByReportId(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Sales performance report not found' });
    }

    report.notes = notes;
    await report.save();

    res.json({
      message: 'Notes updated successfully',
      notes: report.notes
    });
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ 
      message: 'Server error updating notes', 
      error: error.message 
    });
  }
});

// @route   POST /api/sales-performance/:reportId/export
// @desc    Export sales performance report
// @access  Private (requires 'view_reports' permission)
router.post('/:reportId/export', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('reportId').isLength({ min: 1 }).withMessage('Report ID is required'),
  body('format').isIn(['pdf', 'excel', 'csv', 'json']).withMessage('Invalid export format'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { reportId } = req.params;
    const { format } = req.body;

    const report = await salesPerformanceRepository.findByReportId(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Sales performance report not found' });
    }

    // Add export record
    await report.addExport(format, req.user._id);

    // For now, return success message. In a real implementation,
    // you would generate and return the actual file
    res.json({
      message: 'Export request received',
      format,
      reportId: report.reportId,
      reportName: report.reportName
    });
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ 
      message: 'Server error exporting report', 
      error: error.message 
    });
  }
});

// @route   GET /api/sales-performance/stats/overview
// @desc    Get sales performance report statistics
// @access  Private (requires 'view_reports' permission)
router.get('/stats/overview', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const stats = await salesPerformanceRepository.getReportStats(req.query);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching report stats:', error);
    res.status(500).json({ 
      message: 'Server error fetching report stats', 
      error: error.message 
    });
  }
});

// @route   GET /api/sales-performance/quick/top-products
// @desc    Get quick top products data
// @access  Private (requires 'view_reports' permission)
router.get('/quick/top-products', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('limit').optional().isInt({ min: 1, max: 20 }),
  query('period').optional().isIn(['7d', '30d', '90d', '1y']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { limit = 5, period = '30d' } = req.query;
    
    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Get quick data without generating full report
    const productPerformance = await salesRepository.getTopProductsPerformance(startDate, endDate, limit);

    // Get product details
    const productIds = productPerformance.map(p => p.productId);
    const products = await productRepository.findAll({ ids: productIds });

    const topProducts = productPerformance.map((perf, index) => {
      const product = products.find(p => p.id === perf.productId);
      return {
        product: product || { id: perf.productId, name: 'Unknown Product' },
        metrics: {
          totalRevenue: perf.totalRevenue,
          totalQuantity: perf.totalQuantity,
          totalOrders: perf.totalOrders
        },
        rank: index + 1
      };
    });

    res.json({
      topProducts,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error fetching quick top products:', error);
    res.status(500).json({ 
      message: 'Server error fetching quick top products', 
      error: error.message 
    });
  }
});

// @route   GET /api/sales-performance/quick/top-customers
// @desc    Get quick top customers data
// @access  Private (requires 'view_reports' permission)
router.get('/quick/top-customers', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('limit').optional().isInt({ min: 1, max: 20 }),
  query('period').optional().isIn(['7d', '30d', '90d', '1y']),
  query('metric').optional().isIn(['revenue', 'profit']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { limit = 5, period = '30d', metric = 'revenue' } = req.query;
    const sortMetric = metric === 'profit' ? 'totalProfit' : 'totalRevenue';
    
    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Get quick data without generating full report
    const customerPerformance = await salesRepository.getTopCustomersPerformance(startDate, endDate, limit);

    // Get customer details
    const customerIds = customerPerformance.map(c => c.customerId);
    const customerRepository = require('../repositories/CustomerRepository');
    const customers = await customerRepository.findAll({ ids: customerIds });

    const topCustomers = customerPerformance.map((perf, index) => {
      const customer = customers.find(c => c.id === perf.customerId);
      return {
        customer: customer || { id: perf.customerId, name: 'Unknown Customer' },
        metrics: {
          totalRevenue: perf.totalRevenue,
          totalOrders: perf.totalOrders,
          averageOrderValue: perf.totalOrders > 0 ? perf.totalRevenue / perf.totalOrders : 0
        },
        rank: index + 1
      };
    });

    res.json({
      topCustomers,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error fetching quick top customers:', error);
    res.status(500).json({ 
      message: 'Server error fetching quick top customers', 
      error: error.message 
    });
  }
});

// @route   GET /api/sales-performance/quick/top-sales-reps
// @desc    Get quick top sales reps data
// @access  Private (requires 'view_reports' permission)
router.get('/quick/top-sales-reps', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('limit').optional().isInt({ min: 1, max: 20 }),
  query('period').optional().isIn(['7d', '30d', '90d', '1y']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { limit = 5, period = '30d' } = req.query;
    
    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Generate quick report
    const report = await salesPerformanceService.generateSalesPerformanceReport({
      reportType: 'top_sales_reps',
      periodType: 'custom',
      startDate,
      endDate,
      limit: parseInt(limit)
    }, req.user._id);

    res.json({
      reportId: report.reportId,
      topSalesReps: report.topSalesReps,
      summary: report.summary,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error fetching quick top sales reps:', error);
    res.status(500).json({ 
      message: 'Server error fetching quick top sales reps', 
      error: error.message 
    });
  }
});

// @route   GET /api/sales-performance/quick/summary
// @desc    Get quick sales performance summary
// @access  Private (requires 'view_reports' permission)
router.get('/quick/summary', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('period').optional().isIn(['7d', '30d', '90d', '1y']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Get quick summary data without generating full report
    // Get current period summary
    const summary = await salesRepository.getSalesPerformanceSummary(startDate, endDate);

    // Get previous period for comparison
    const previousStartDate = new Date(startDate.getTime() - (endDate - startDate));
    const previousData = await salesRepository.getSalesPerformanceSummary(previousStartDate, startDate);

    // Calculate changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const comparison = {
      previousPeriod: {
        startDate: previousStartDate,
        endDate: startDate,
        totalRevenue: previousData.totalRevenue,
        totalOrders: previousData.totalOrders,
        totalCustomers: previousData.totalCustomers,
        averageOrderValue: previousData.averageOrderValue
      },
      changes: {
        revenueChange: summary.totalRevenue - previousData.totalRevenue,
        revenueChangePercentage: calculatePercentageChange(summary.totalRevenue, previousData.totalRevenue),
        orderChange: summary.totalOrders - previousData.totalOrders,
        orderChangePercentage: calculatePercentageChange(summary.totalOrders, previousData.totalOrders),
        customerChange: summary.totalCustomers - previousData.totalCustomers,
        customerChangePercentage: calculatePercentageChange(summary.totalCustomers, previousData.totalCustomers),
        aovChange: summary.averageOrderValue - previousData.averageOrderValue,
        aovChangePercentage: calculatePercentageChange(summary.averageOrderValue, previousData.averageOrderValue)
      }
    };

    res.json({
      summary,
      comparison,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Error fetching quick summary:', error);
    res.status(500).json({ 
      message: 'Server error fetching quick summary', 
      error: error.message 
    });
  }
});

module.exports = router;
