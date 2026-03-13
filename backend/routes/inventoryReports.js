const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const inventoryReportService = require('../services/inventoryReportService');
const inventoryReportRepository = require('../repositories/postgres/InventoryReportRepository');
const productRepository = require('../repositories/postgres/ProductRepository');
const salesRepository = require('../repositories/postgres/SalesRepository');

const router = express.Router();

// @route   POST /api/inventory-reports/generate
// @desc    Generate a new inventory report
// @access  Private (requires 'view_reports' permission)
router.post('/generate', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  body('reportType')
    .optional()
    .isIn(['stock_levels', 'turnover_rates', 'aging_analysis', 'comprehensive'])
    .withMessage('Invalid report type. Must be one of: stock_levels, turnover_rates, aging_analysis, comprehensive'),
  body('periodType')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
    .withMessage('Invalid period type. Must be one of: daily, weekly, monthly, quarterly, yearly, custom'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  body('includeMetrics')
    .optional()
    .isObject()
    .withMessage('includeMetrics must be an object'),
  body('filters')
    .optional()
    .isObject()
    .withMessage('filters must be an object'),
  body('thresholds')
    .optional()
    .isObject()
    .withMessage('thresholds must be an object'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await inventoryReportService.generateInventoryReport(
      req.body,
      req.user._id
    );
    
    res.status(201).json({
      message: 'Inventory report generated successfully',
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
    console.error('Error generating inventory report:', error);
    res.status(500).json({ 
      message: 'Server error generating inventory report', 
      error: error.message 
    });
  }
});

// @route   GET /api/inventory-reports
// @desc    Get list of inventory reports
// @access  Private (requires 'view_reports' permission)
router.get('/', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('reportType').optional({ checkFalsy: true }).isIn(['stock_levels', 'turnover_rates', 'aging_analysis', 'comprehensive', 'custom']),
  query('status').optional({ checkFalsy: true }).isIn(['generating', 'completed', 'failed', 'archived']),
  query('generatedBy').optional({ checkFalsy: true }).isUUID(4),
  query('startDate').optional({ checkFalsy: true }).isISO8601(),
  query('endDate').optional({ checkFalsy: true }).isISO8601(),
  query('sortBy').optional({ checkFalsy: true }).isIn(['generatedAt', 'reportName', 'status', 'viewCount']),
  query('sortOrder').optional({ checkFalsy: true }).isIn(['asc', 'desc']),
  handleValidationErrors,
], async (req, res) => {
  try {
    // Merge date filter from middleware if present (for Pakistan timezone)
    const queryParams = { ...req.query };
    if (req.dateRange) {
      queryParams.startDate = req.dateRange.startDate || undefined;
      queryParams.endDate = req.dateRange.endDate || undefined;
    }
    
    const result = await inventoryReportService.getInventoryReports(queryParams);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching inventory reports:', error);
    res.status(500).json({ 
      message: 'Server error fetching inventory reports', 
      error: error.message 
    });
  }
});

// @route   GET /api/inventory-reports/:reportId
// @desc    Get detailed inventory report
// @access  Private (requires 'view_reports' permission)
router.get('/:reportId', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('reportId').isLength({ min: 1 }).withMessage('Report ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const report = await inventoryReportService.getInventoryReportById(req.params.reportId);
    
    // Mark as viewed
    await report.markAsViewed();
    
    res.json(report);
  } catch (error) {
    console.error('Error fetching inventory report:', error);
    if (error.message === 'Inventory report not found') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ 
        message: 'Server error fetching inventory report', 
        error: error.message 
      });
    }
  }
});

// @route   DELETE /api/inventory-reports/:reportId
// @desc    Delete inventory report
// @access  Private (requires 'manage_reports' permission)
router.delete('/:reportId', [
  auth,
  requirePermission('manage_reports'),
  sanitizeRequest,
  param('reportId').isLength({ min: 1 }).withMessage('Report ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const result = await inventoryReportService.deleteInventoryReport(
      req.params.reportId,
      req.user._id
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting inventory report:', error);
    if (error.message === 'Inventory report not found') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ 
        message: 'Server error deleting inventory report', 
        error: error.message 
      });
    }
  }
});

// @route   PUT /api/inventory-reports/:reportId/favorite
// @desc    Toggle favorite status of inventory report
// @access  Private (requires 'view_reports' permission)
router.put('/:reportId/favorite', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  param('reportId').isLength({ min: 1 }).withMessage('Report ID is required'),
  body('isFavorite').isBoolean().withMessage('isFavorite must be a boolean'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { reportId } = req.params;
    const { isFavorite } = req.body;

    const report = await inventoryReportRepository.findByReportId(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Inventory report not found' });
    }

    report.isFavorite = isFavorite;
    await report.save();

    res.json({
      message: 'Favorite status updated successfully',
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

// @route   POST /api/inventory-reports/:reportId/export
// @desc    Export inventory report
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

    const report = await inventoryReportRepository.findByReportId(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Inventory report not found' });
    }

    // Add export record
    await report.addExport(format, req.user._id);
    await report.save();

    res.json({
      message: `Export initiated for ${format.toUpperCase()} format`,
      exportId: `${reportId}-${format}-${Date.now()}`,
      format,
      status: 'processing'
    });
  } catch (error) {
    console.error('Error exporting inventory report:', error);
    res.status(500).json({ 
      message: 'Server error exporting inventory report', 
      error: error.message 
    });
  }
});

// @route   GET /api/inventory-reports/quick/stock-levels
// @desc    Get quick stock levels data
// @access  Private (requires 'view_reports' permission)
router.get('/quick/stock-levels', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['in_stock', 'low_stock', 'out_of_stock', 'overstocked']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { limit = 10, status } = req.query;
    const filters = {};
    if (status === 'out_of_stock') filters.stockStatus = 'outOfStock';
    else if (status === 'low_stock') filters.lowStock = true;
    else if (status === 'in_stock') filters.stockStatus = 'inStock';

    const products = await productRepository.findAll(filters, {
      limit: parseInt(limit, 10) || 10
    });

    const currentStock = (p) => p.stock_quantity ?? p.inventory?.currentStock ?? 0;
    const minStock = (p) => p.min_stock_level ?? p.inventory?.minStock ?? 0;
    const reorderPoint = (p) => p.min_stock_level ?? p.inventory?.reorderPoint ?? 0;
    const costPrice = (p) => p.cost_price ?? p.pricing?.cost ?? 0;
    const stockLevels = products.map((product, index) => {
      const cur = currentStock(product);
      const min = minStock(product);
      const reorder = reorderPoint(product);
      const cost = costPrice(product);
      const stockStatus = cur === 0 ? 'out_of_stock' : (cur <= reorder ? 'low_stock' : 'in_stock');
      return {
        product: {
          _id: product.id,
          name: product.name,
          description: product.description,
          category: product.category_id || product.category
        },
        metrics: {
          currentStock: cur,
          minStock: min,
          reorderPoint: reorder,
          stockValue: cur * cost,
          stockStatus
        },
        rank: index + 1
      };
    });

    res.json({
      stockLevels,
      summary: {
        totalProducts: products.length,
        totalStockValue: stockLevels.reduce((sum, item) => sum + item.metrics.stockValue, 0),
        lowStockCount: stockLevels.filter(item => item.metrics.stockStatus === 'low_stock').length,
        outOfStockCount: stockLevels.filter(item => item.metrics.stockStatus === 'out_of_stock').length
      }
    });
  } catch (error) {
    console.error('Error fetching quick stock levels:', error);
    res.status(500).json({ 
      message: 'Server error fetching quick stock levels', 
      error: error.message 
    });
  }
});

// @route   GET /api/inventory-reports/quick/turnover-rates
// @desc    Get quick turnover rates data
// @access  Private (requires 'view_reports' permission)
router.get('/quick/turnover-rates', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('period').optional().isIn(['7d', '30d', '90d', '1y']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { limit = 10, period = '30d' } = req.query;
    
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

    // Get sales data for the period
    const salesData = await salesRepository.getProductTurnoverStats(startDate, endDate, limit);

    // Get product details
    const productIds = salesData.map(s => s.productId);
    const products = await productRepository.findAll({ ids: productIds });

    const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const periodYears = periodDays / 365;

    const turnoverRates = salesData.map((sale, index) => {
      const product = products.find(p => p.id === sale.productId);
      const currentStock = parseFloat(product?.stock_quantity || 0);
      const turnoverRate = product && currentStock > 0 ? 
        (sale.totalSold / periodYears) / currentStock : 0;
      const daysToSell = turnoverRate > 0 ? 365 / turnoverRate : 999;

      return {
        product: {
          _id: product?.id,
          name: product?.name,
          description: product?.description,
          category: product?.category_name || product?.category_id
        },
        metrics: {
          turnoverRate,
          totalSold: sale.totalSold,
          averageStock: currentStock,
          daysToSell,
          turnoverCategory: turnoverRate >= 12 ? 'fast' : 
                           turnoverRate <= 4 ? 'slow' : 
                           turnoverRate === 0 ? 'dead' : 'medium'
        },
        rank: index + 1
      };
    });

    res.json({
      turnoverRates,
      period: { startDate, endDate },
      summary: {
        totalProducts: turnoverRates.length,
        fastMoving: turnoverRates.filter(item => item.metrics.turnoverCategory === 'fast').length,
        slowMoving: turnoverRates.filter(item => item.metrics.turnoverCategory === 'slow').length,
        deadStock: turnoverRates.filter(item => item.metrics.turnoverCategory === 'dead').length
      }
    });
  } catch (error) {
    console.error('Error fetching quick turnover rates:', error);
    res.status(500).json({ 
      message: 'Server error fetching quick turnover rates', 
      error: error.message 
    });
  }
});

// @route   GET /api/inventory-reports/quick/aging-analysis
// @desc    Get quick aging analysis data
// @access  Private (requires 'view_reports' permission)
router.get('/quick/aging-analysis', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('threshold').optional().isInt({ min: 1 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { limit = 10, threshold = 90 } = req.query;
    
    // Get products with stock
    const products = await productRepository.findAll({ isActive: true });
    const productsWithStock = products.filter(p => parseFloat(p.stock_quantity) > 0).slice(0, parseInt(limit) * 2);

    // Get last sold dates for products
    const productIds = productsWithStock.map(p => p.id);
    const lastSoldDates = await salesRepository.getLastSoldDates(productIds);

    const currentDate = new Date();
    const agingAnalysis = [];

    for (const product of productsWithStock) {
      const lastSoldData = lastSoldDates.find(l => l.productId === product.id);
      const lastSoldDate = lastSoldData?.lastSoldDate || product.created_at;
      const daysInStock = Math.ceil((currentDate - new Date(lastSoldDate)) / (1000 * 60 * 60 * 24));
      
      if (daysInStock >= parseInt(threshold)) {
        const stockValue = (parseFloat(product.stock_quantity) || 0) * (parseFloat(product.cost_price) || 0);
        const potentialLoss = daysInStock > 365 ? stockValue * 0.5 : 
                             daysInStock > 180 ? stockValue * 0.2 : 0;

        agingAnalysis.push({
          product: {
            _id: product.id,
            name: product.name,
            description: product.description,
            category: product.category_name || product.category_id
          },
          metrics: {
            daysInStock,
            lastSoldDate,
            agingCategory: daysInStock > 365 ? 'very_old' : 
                          daysInStock > 180 ? 'old' : 
                          daysInStock > 90 ? 'aging' : 'new',
            stockValue,
            potentialLoss
          },
          rank: 0 // Will be set after sorting
        });
      }
    }

    // Sort by days in stock and limit results
    agingAnalysis.sort((a, b) => b.metrics.daysInStock - a.metrics.daysInStock);
    agingAnalysis.forEach((item, index) => {
      item.rank = index + 1;
    });

    const limitedResults = agingAnalysis.slice(0, parseInt(limit));

    res.json({
      agingAnalysis: limitedResults,
      summary: {
        totalProducts: limitedResults.length,
        totalPotentialLoss: limitedResults.reduce((sum, item) => sum + item.metrics.potentialLoss, 0),
        veryOldProducts: limitedResults.filter(item => item.metrics.agingCategory === 'very_old').length,
        oldProducts: limitedResults.filter(item => item.metrics.agingCategory === 'old').length,
        agingProducts: limitedResults.filter(item => item.metrics.agingCategory === 'aging').length
      }
    });
  } catch (error) {
    console.error('Error fetching quick aging analysis:', error);
    res.status(500).json({ 
      message: 'Server error fetching quick aging analysis', 
      error: error.message 
    });
  }
});

// @route   GET /api/inventory-reports/quick/summary
// @desc    Get quick inventory summary
// @access  Private (requires 'view_reports' permission)
router.get('/quick/summary', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
], async (req, res) => {
  try {
    const totalProductsCount = await productRepository.count({});
    
    const activeProductsCount = await productRepository.count({ isActive: true });

    // Get overall inventory summary
    const products = await productRepository.findAll({ isActive: true });
    const summaryData = {
      totalProducts: products.length,
      totalStockValue: products.reduce((sum, p) => sum + (parseFloat(p.stock_quantity) || 0) * (parseFloat(p.cost_price) || 0), 0),
      lowStockProducts: products.filter(p => (parseFloat(p.stock_quantity) || 0) <= (parseFloat(p.min_stock_level) || 0)).length,
      outOfStockProducts: products.filter(p => (parseFloat(p.stock_quantity) || 0) === 0).length,
      overstockedProducts: products.filter(p => (parseFloat(p.stock_quantity) || 0) > (parseFloat(p.min_stock_level) || 0) * 3).length
    };

    res.json({
      summary: summaryData,
      alerts: {
        lowStock: summaryData.lowStockProducts,
        outOfStock: summaryData.outOfStockProducts,
        overstocked: summaryData.overstockedProducts
      }
    });
  } catch (error) {
    console.error('Error fetching quick inventory summary:', error);
    res.status(500).json({ 
      message: 'Server error fetching quick inventory summary', 
      error: error.message 
    });
  }
});

// @route   GET /api/inventory-reports/stats
// @desc    Get inventory report statistics
// @access  Private (requires 'view_reports' permission)
router.get('/stats', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const period = {};
    if (req.query.startDate) period.startDate = new Date(req.query.startDate);
    if (req.query.endDate) period.endDate = new Date(req.query.endDate);

    const stats = await inventoryReportRepository.getReportStats(period);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching inventory report stats:', error);
    res.status(500).json({ 
      message: 'Server error fetching inventory report stats', 
      error: error.message 
    });
  }
});

module.exports = router;
