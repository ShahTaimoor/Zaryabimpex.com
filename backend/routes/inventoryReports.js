const express = require('express');
const { body, param, query } = require('express-validator');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const inventoryReportService = require('../services/inventoryReportService');
const inventoryReportRepository = require('../repositories/postgres/InventoryReportRepository');
const productRepository = require('../repositories/postgres/ProductRepository');
const salesRepository = require('../repositories/postgres/SalesRepository');
const { query: pgQuery } = require('../config/postgres');

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
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .optional({ checkFalsy: true })
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

// Backward-compatible alias:
// Some clients call POST /api/inventory-reports (without "/generate").
// Keep this route so generation doesn't break with "Route not found".
router.post('/', [
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
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .optional({ checkFalsy: true })
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
    console.error('Error generating inventory report (alias route):', error);
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

    // Persist view tracking in config JSONB for Postgres implementation.
    if (report?.id) {
      const nowIso = new Date().toISOString();
      const nextViewCount = Number(report.viewCount || 0) + 1;
      const nextConfig = {
        ...(report.config || {}),
        lastViewedAt: nowIso,
        viewCount: nextViewCount
      };
      await inventoryReportRepository.updateById(report.id, { config: nextConfig });
      return res.json({
        ...report,
        config: nextConfig,
        lastViewedAt: nowIso,
        viewCount: nextViewCount
      });
    }

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

    const report = await inventoryReportService.getInventoryReportById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Inventory report not found' });
    }

    const safeDate = new Date().toISOString().slice(0, 10);
    const baseName = `inventory_report_${reportId}_${safeDate}`;
    const stockRows = Array.isArray(report.stockLevels) ? report.stockLevels : [];
    const productIds = Array.from(
      new Set(
        stockRows
          .map((item) => {
            const pid =
              typeof item?.product === 'object'
                ? (item.product?.id || item.product?._id)
                : item?.product;
            return pid != null ? String(pid) : null;
          })
          .filter(Boolean)
      )
    );
    const productIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const validUuidIds = productIds.filter((id) => productIdRegex.test(id));
    const nameById = new Map();
    if (validUuidIds.length > 0) {
      const nameRows = await pgQuery(
        'SELECT id, name FROM products WHERE id = ANY($1::uuid[])',
        [validUuidIds]
      );
      for (const row of nameRows.rows || []) {
        nameById.set(String(row.id), row.name || '');
      }
    }

    const resolveProductName = (item) => {
      if (item?.product?.name) return item.product.name;
      if (item?.productName) return item.productName;
      if (item?.product_name) return item.product_name;
      const pid =
        typeof item?.product === 'object'
          ? (item.product?.id || item.product?._id)
          : item?.product;
      if (pid != null) {
        const mapped = nameById.get(String(pid));
        if (mapped) return mapped;
      }
      return 'Unknown Product';
    };

    if (format === 'json') {
      const filename = `${baseName}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(JSON.stringify(report, null, 2));
    }

    if (format === 'csv') {
      const header = ['Product', 'Current Stock', 'Reorder Point', 'Stock Value', 'Retail Value', 'Status'];
      const csvLines = [header.join(',')];
      for (const item of stockRows) {
        const name = resolveProductName(item);
        const currentStock = Number(item?.metrics?.currentStock || 0);
        const reorderPoint = Number(item?.metrics?.reorderPoint || 0);
        const stockValue = Number(item?.metrics?.stockValue || 0);
        const retailValue = Number(item?.metrics?.retailValue || 0);
        const status = String(item?.metrics?.stockStatus || '');
        const escapedName = `"${String(name).replace(/"/g, '""')}"`;
        csvLines.push([escapedName, currentStock, reorderPoint, stockValue, retailValue, status].join(','));
      }
      const filename = `${baseName}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvLines.join('\n'));
    }

    if (format === 'excel') {
      const data = stockRows.map((item) => ({
        Product: resolveProductName(item),
        'Current Stock': Number(item?.metrics?.currentStock || 0),
        'Reorder Point': Number(item?.metrics?.reorderPoint || 0),
        'Stock Value': Number(item?.metrics?.stockValue || 0),
        'Retail Value': Number(item?.metrics?.retailValue || 0),
        Status: String(item?.metrics?.stockStatus || '')
      }));
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Levels');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const filename = `${baseName}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    }

    // PDF export (default path when format === 'pdf')
    const filename = `${baseName}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    doc.pipe(res);
    doc.fontSize(16).text('Inventory Report', { align: 'left' });
    doc.moveDown(0.4);
    doc.fontSize(10).text(`Report: ${report.reportName || report.reportId || 'N/A'}`);
    doc.text(`Type: ${String(report.reportType || 'N/A').toUpperCase()}`);
    doc.text(`Period: ${String(report.periodType || 'N/A').toUpperCase()}`);
    doc.text(`Generated: ${report.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'N/A'}`);
    doc.moveDown(0.6);

    const summary = report.summary || {};
    doc.fontSize(12).text('Summary');
    doc.fontSize(10).text(`Total Products: ${Number(summary.totalProducts || 0)}`);
    doc.text(`Total Stock Value: ${Number(summary.totalStockValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    doc.text(`Total Retail Value: ${Number(summary.totalRetailValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    doc.moveDown(0.6);

    doc.moveDown(0.2);
    doc.fontSize(12).text('Top Stock Items (Table)');
    doc.moveDown(0.3);

    const tableRows = stockRows.slice(0, 50).map((item, idx) => ({
      no: idx + 1,
      product: String(resolveProductName(item) || 'Unknown Product'),
      stock: Number(item?.metrics?.currentStock || 0).toLocaleString(),
      value: Number(item?.metrics?.stockValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      status: String(item?.metrics?.stockStatus || '').replace(/_/g, ' ')
    }));

    const startX = doc.page.margins.left;
    const pageUsableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidths = {
      no: 28,
      product: 250,
      stock: 80,
      value: 120,
      status: Math.max(70, pageUsableWidth - (28 + 250 + 80 + 120))
    };
    // Must be tall enough to avoid text drawing over the next row.
    const rowHeight = 20;
    const drawHeader = () => {
      const y = doc.y;
      doc.rect(startX, y, pageUsableWidth, rowHeight).fill('#f3f4f6');
      doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold');
      let x = startX + 4;
      doc.text('No', x, y + 5, { width: colWidths.no - 8, height: rowHeight - 6, align: 'left', lineBreak: false });
      x += colWidths.no;
      doc.text('Product', x + 4, y + 5, { width: colWidths.product - 8, height: rowHeight - 6, align: 'left', ellipsis: true, lineBreak: false });
      x += colWidths.product;
      doc.text('Stock', x + 4, y + 5, { width: colWidths.stock - 8, height: rowHeight - 6, align: 'right', lineBreak: false });
      x += colWidths.stock;
      doc.text('Value', x + 4, y + 5, { width: colWidths.value - 8, height: rowHeight - 6, align: 'right', lineBreak: false });
      x += colWidths.value;
      doc.text('Status', x + 4, y + 5, { width: colWidths.status - 8, height: rowHeight - 6, align: 'left', ellipsis: true, lineBreak: false });
      doc.moveDown(0);
      doc.y = y + rowHeight;
      doc.fillColor('black').font('Helvetica');
    };

    drawHeader();
    for (const row of tableRows) {
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      doc.rect(startX, y, pageUsableWidth, rowHeight).stroke('#e5e7eb');
      let x = startX + 4;
      doc.fontSize(9).text(String(row.no), x, y + 5, { width: colWidths.no - 8, height: rowHeight - 6, align: 'left', lineBreak: false });
      x += colWidths.no;
      doc.text(row.product, x + 4, y + 5, { width: colWidths.product - 8, height: rowHeight - 6, align: 'left', ellipsis: true, lineBreak: false });
      x += colWidths.product;
      doc.text(row.stock, x + 4, y + 5, { width: colWidths.stock - 8, height: rowHeight - 6, align: 'right', lineBreak: false });
      x += colWidths.stock;
      doc.text(row.value, x + 4, y + 5, { width: colWidths.value - 8, height: rowHeight - 6, align: 'right', lineBreak: false });
      x += colWidths.value;
      doc.text(row.status, x + 4, y + 5, { width: colWidths.status - 8, height: rowHeight - 6, align: 'left', ellipsis: true, lineBreak: false });
      doc.y = y + rowHeight;
    }

    doc.end();
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
    // Use the same stock source priority as inventory reports:
    // inventory_balance.quantity -> inventory.current_stock -> products.stock_quantity
    const summarySql = `
      SELECT
        COUNT(*) as "totalProducts",
        SUM(COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) * COALESCE(p.cost_price, 0)) as "totalStockValue",
        SUM(
          COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) *
          COALESCE(p.wholesale_price, p.selling_price, 0)
        ) as "totalWholesaleValue",
        SUM(
          COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) *
          COALESCE(p.selling_price, p.wholesale_price, 0)
        ) as "totalRetailValue",
        COUNT(*) FILTER (
          WHERE COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) > 0
            AND COALESCE(p.min_stock_level, 0) > 0
            AND COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) <= COALESCE(p.min_stock_level, 0)
        ) as "lowStockProducts",
        COUNT(*) FILTER (WHERE COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) = 0) as "outOfStockProducts",
        COUNT(*) FILTER (
          WHERE COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) >
            (COALESCE(p.min_stock_level, 0) * 3)
        ) as "overstockedProducts"
      FROM products p
      LEFT JOIN inventory_balance ib ON ib.product_id = p.id
      LEFT JOIN inventory i ON i.product_id = p.id AND i.deleted_at IS NULL
      WHERE p.is_deleted = FALSE AND p.is_active = TRUE
    `;
    const summaryResult = await pgQuery(summarySql);
    const row = summaryResult.rows[0] || {};

    const summaryData = {
      totalProducts: parseInt(row.totalProducts || 0, 10),
      totalStockValue: parseFloat(row.totalStockValue || 0),
      totalWholesaleValue: parseFloat(row.totalWholesaleValue || 0),
      totalRetailValue: parseFloat(row.totalRetailValue || 0),
      lowStockProducts: parseInt(row.lowStockProducts || 0, 10),
      outOfStockProducts: parseInt(row.outOfStockProducts || 0, 10),
      overstockedProducts: parseInt(row.overstockedProducts || 0, 10)
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
