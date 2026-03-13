const InventoryReportRepository = require('../repositories/postgres/InventoryReportRepository');
const ProductRepository = require('../repositories/postgres/ProductRepository');
const SalesRepository = require('../repositories/SalesRepository');
const CategoryRepository = require('../repositories/postgres/CategoryRepository');
const SupplierRepository = require('../repositories/postgres/SupplierRepository');
const PurchaseOrderRepository = require('../repositories/PurchaseOrderRepository');
const PurchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');

async function getSalesGroupedByProduct(dateFrom, dateTo, status = 'completed') {
  const sales = await SalesRepository.findAll(
    { dateFrom, dateTo, status },
    { limit: 5000 }
  );
  const byProduct = {};
  for (const sale of sales) {
    const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
    for (const it of items) {
      const pid = it.product || it.product_id;
      if (pid == null) continue;
      const id = typeof pid === 'object' ? (pid.id || pid._id) : pid;
      const key = String(id);
      if (!byProduct[key]) byProduct[key] = { _id: id, totalSold: 0 };
      byProduct[key].totalSold += Number(it.quantity) || 0;
    }
  }
  return Object.values(byProduct);
}

async function getProductsForReport(filters = {}) {
  const { categories } = filters;
  if (categories && categories.length > 0) {
    const all = [];
    for (const catId of categories) {
      const rows = await ProductRepository.findAll({ categoryId: catId }, { limit: 2000 });
      all.push(...rows);
    }
    const seen = new Set();
    return all.filter((p) => {
      const id = String(p.id || p._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  return ProductRepository.findAll({ isActive: true }, { limit: 2000 });
}

class InventoryReportService {
  constructor() {
    this.reportTypes = {
      STOCK_LEVELS: 'stock_levels',
      TURNOVER_RATES: 'turnover_rates',
      AGING_ANALYSIS: 'aging_analysis',
      COMPREHENSIVE: 'comprehensive'
    };

    this.periodTypes = {
      DAILY: 'daily',
      WEEKLY: 'weekly',
      MONTHLY: 'monthly',
      QUARTERLY: 'quarterly',
      YEARLY: 'yearly',
      CUSTOM: 'custom'
    };
  }

  // Generate comprehensive inventory report
  async generateInventoryReport(config, generatedBy) {
    try {
      const {
        reportType = 'comprehensive',
        periodType = 'monthly',
        startDate,
        endDate,
        includeMetrics = {},
        filters = {},
        thresholds = {}
      } = config;

      // Validate and set date range
      const dateRange = this.getDateRange(periodType, startDate, endDate);
      
      const reportId = await this.generateReportId();
      const reportName = this.generateReportName(reportType, periodType, dateRange);
      const created = await InventoryReportRepository.create({
        reportId,
        reportName,
        reportType,
        periodType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        config: { includeMetrics, filters, thresholds, status: 'generating', generatedBy },
        stockLevels: []
      });
      const report = {
        id: created.id,
        reportId,
        reportName,
        reportType,
        periodType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        config: { includeMetrics, filters, thresholds, status: 'generating', generatedBy },
        stockLevels: [],
        status: 'generating'
      };

      try {
        switch (reportType) {
          case 'stock_levels':
            await this.generateStockLevelsData(report);
            break;
          case 'turnover_rates':
            await this.generateTurnoverRatesData(report);
            break;
          case 'aging_analysis':
            await this.generateAgingAnalysisData(report);
            break;
          case 'comprehensive':
            await this.generateComprehensiveData(report);
            break;
          default:
            throw new Error('Invalid report type');
        }
        await this.generateSummaryData(report);
        await this.generateComparisonData(report);
        await this.generateInsights(report);
        report.status = 'completed';
        report.config = report.config || {};
        report.config.status = 'completed';
        await InventoryReportRepository.updateById(report.id, { config: report.config, stockLevels: report.stockLevels || report.stock_levels });
        return { ...created, ...report };
      } catch (error) {
        report.status = 'failed';
        report.config = report.config || {};
        report.config.status = 'failed';
        try { await InventoryReportRepository.updateById(report.id, { config: report.config }); } catch (_) {}
        throw error;
      }
    } catch (error) {
      console.error('Error generating inventory report:', error);
      throw error;
    }
  }

  // Generate stock levels data
  async generateStockLevelsData(report) {
    try {
      const { startDate, endDate, config } = report;
      const { filters, thresholds } = config;

      // Build match criteria
      const matchCriteria = {};

      // Apply filters
      if (filters.categories && filters.categories.length > 0) {
        matchCriteria.category = { $in: filters.categories };
      }

      // Supplier filtering - filter by products that have any of the selected suppliers
      if (filters.suppliers && filters.suppliers.length > 0) {
        matchCriteria.$or = matchCriteria.$or || [];
        matchCriteria.$or.push(
          { suppliers: { $in: filters.suppliers } },
          { primarySupplier: { $in: filters.suppliers } }
        );
        // If there are other $or conditions, we need to combine them properly
        if (matchCriteria.$or.length > 2) {
          // Keep existing $or conditions and add supplier conditions
          const existingOr = matchCriteria.$or.filter((_, idx) => idx < matchCriteria.$or.length - 2);
          matchCriteria.$and = [
            ...(matchCriteria.$and || []),
            { $or: existingOr },
            { $or: matchCriteria.$or.slice(-2) }
          ];
          delete matchCriteria.$or;
        }
      }

      const products = await getProductsForReport(report.config?.filters || {});
      products.sort((a, b) => (Number(b.stock_quantity ?? b.stockQuantity ?? 0) - Number(a.stock_quantity ?? a.stockQuantity ?? 0)));

      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousStockLevels = await this.getPreviousStockLevels(previousPeriod.startDate, previousPeriod.endDate, products.map(p => p.id || p._id));

      const stockLevels = await Promise.all(products.map(async (product, index) => {
        const pid = product.id || product._id;
        const previousStock = previousStockLevels.find(p => String(p._id || p.id) === String(pid));
        const currentStock = Number(product.stock_quantity ?? product.stockQuantity ?? product.inventory?.currentStock ?? 0);
        const reorderPoint = Number(product.min_stock_level ?? product.minStockLevel ?? product.inventory?.reorderPoint ?? 0);
        const minStock = reorderPoint;
        const maxStock = Number(product.inventory?.maxStock ?? reorderPoint * 3);
        const cost = Number(product.cost_price ?? product.costPrice ?? product.pricing?.cost ?? 0);
        const stockValue = currentStock * cost;

        // Determine stock status
        let stockStatus = 'in_stock';
        if (currentStock === 0) {
          stockStatus = 'out_of_stock';
        } else if (currentStock <= reorderPoint) {
          stockStatus = 'low_stock';
        } else if (currentStock > (maxStock || reorderPoint * 3)) {
          stockStatus = 'overstocked';
        }

        return {
          product: pid,
          metrics: {
            currentStock,
            minStock,
            maxStock,
            reorderPoint,
            reorderQuantity: reorderPoint * 2,
            stockValue,
            stockStatus
          },
          trend: {
            previousStock: previousStock?.currentStock || 0,
            stockChange: currentStock - (previousStock?.currentStock || 0),
            stockChangePercentage: this.calculatePercentageChange(currentStock, previousStock?.currentStock || 0),
            daysInStock: await this.getDaysInStock(pid, endDate)
          },
          rank: index + 1
        };
      }));

      report.stockLevels = stockLevels;
      // Don't save here - will be saved at the end
    } catch (error) {
      console.error('Error generating stock levels data:', error);
      throw error;
    }
  }

  // Generate turnover rates data
  async generateTurnoverRatesData(report) {
    try {
      const { startDate, endDate, config } = report;
      const { filters, thresholds } = config;

      // Build match criteria for products
      const productMatchCriteria = {};
      if (filters.categories && filters.categories.length > 0) {
        productMatchCriteria.category = { $in: filters.categories };
      }
      if (filters.suppliers && filters.suppliers.length > 0) {
        productMatchCriteria.supplier = { $in: filters.suppliers };
      }

      const products = await getProductsForReport(filters);
      const salesData = await getSalesGroupedByProduct(startDate, endDate, 'completed');
      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousSalesData = await getSalesGroupedByProduct(previousPeriod.startDate, previousPeriod.endDate, 'completed');

      // Calculate turnover rates
      const turnoverRates = [];
      const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const periodYears = periodDays / 365;

      for (const product of products) {
        const pid = product.id || product._id;
        const salesDataForProduct = salesData.find(s => String(s._id) === String(pid));
        const previousSalesDataForProduct = previousSalesData.find(s => String(s._id) === String(pid));
        const totalSold = salesDataForProduct?.totalSold || 0;
        const averageStock = Number(product.stock_quantity ?? product.stockQuantity ?? product.inventory?.currentStock ?? 0);
        const turnoverRate = averageStock > 0 ? (totalSold / periodYears) / averageStock : 0;
        const daysToSell = turnoverRate > 0 ? 365 / turnoverRate : 999;

        // Categorize turnover rate
        let turnoverCategory = 'medium';
        if (turnoverRate >= (thresholds.fastTurnoverThreshold || 12)) {
          turnoverCategory = 'fast';
        } else if (turnoverRate <= (thresholds.slowTurnoverThreshold || 4)) {
          turnoverCategory = 'slow';
        } else if (turnoverRate === 0) {
          turnoverCategory = 'dead';
        }

        const previousTurnoverRate = previousSalesDataForProduct ? 
          (previousSalesDataForProduct.totalSold / periodYears) / averageStock : 0;

        turnoverRates.push({
          product: pid,
          metrics: {
            turnoverRate,
            totalSold,
            averageStock,
            daysToSell,
            turnoverCategory
          },
          trend: {
            previousTurnoverRate,
            turnoverChange: turnoverRate - previousTurnoverRate,
            turnoverChangePercentage: this.calculatePercentageChange(turnoverRate, previousTurnoverRate)
          },
          rank: 0 // Will be set after sorting
        });
      }

      // Sort by turnover rate and assign ranks
      turnoverRates.sort((a, b) => b.metrics.turnoverRate - a.metrics.turnoverRate);
      turnoverRates.forEach((item, index) => {
        item.rank = index + 1;
      });

      report.turnoverRates = turnoverRates;
      // Don't save here - will be saved at the end
    } catch (error) {
      console.error('Error generating turnover rates data:', error);
      throw error;
    }
  }

  // Generate aging analysis data
  async generateAgingAnalysisData(report) {
    try {
      const { startDate, endDate, config } = report;
      const { filters, thresholds } = config;

      // Build match criteria
      const matchCriteria = {};
      if (filters.categories && filters.categories.length > 0) {
        matchCriteria.category = { $in: filters.categories };
      }
      // Supplier filtering - filter by products that have any of the selected suppliers
      if (filters.suppliers && filters.suppliers.length > 0) {
        matchCriteria.$or = matchCriteria.$or || [];
        matchCriteria.$or.push(
          { suppliers: { $in: filters.suppliers } },
          { primarySupplier: { $in: filters.suppliers } }
        );
      }

      const products = await getProductsForReport(filters);

      const productIds = products.map(p => p.id || p._id);
      const lastSoldDatesRaw = await SalesRepository.findAll({ status: 'completed' }, { limit: 5000 });
      const lastSoldMap = {};
      for (const sale of lastSoldDatesRaw) {
        const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
        const saleDate = sale.sale_date || sale.saleDate || sale.created_at || sale.createdAt;
        for (const it of items) {
          const pid = it.product?.id ?? it.product?._id ?? it.product ?? it.product_id;
          if (!pid || !productIds.includes(pid)) continue;
          const key = String(pid);
          if (!lastSoldMap[key] || new Date(saleDate) > new Date(lastSoldMap[key].lastSold)) {
            lastSoldMap[key] = { _id: pid, lastSold: saleDate };
          }
        }
      }
      const lastSoldDates = Object.values(lastSoldMap);

      const agingAnalysis = [];
      const currentDate = new Date();

      for (const product of products) {
        const pid = product.id || product._id;
        const lastSoldData = lastSoldDates.find(l => String(l._id) === String(pid));
        const lastSoldDate = lastSoldData?.lastSold ? new Date(lastSoldData.lastSold) : (product.created_at ? new Date(product.created_at) : currentDate);
        const daysInStock = Math.ceil((currentDate - lastSoldDate) / (1000 * 60 * 60 * 24));
        const stockValue = Number(product.stock_quantity ?? product.stockQuantity ?? 0) * Number(product.cost_price ?? product.costPrice ?? 0);
        
        // Calculate potential loss (simplified - could be more sophisticated)
        let potentialLoss = 0;
        if (daysInStock > (thresholds.veryOldThreshold || 365)) {
          potentialLoss = stockValue * 0.5; // 50% loss for very old stock
        } else if (daysInStock > (thresholds.oldThreshold || 180)) {
          potentialLoss = stockValue * 0.2; // 20% loss for old stock
        }

        // Categorize aging
        let agingCategory = 'new';
        if (daysInStock > (thresholds.veryOldThreshold || 365)) {
          agingCategory = 'very_old';
        } else if (daysInStock > (thresholds.oldThreshold || 180)) {
          agingCategory = 'old';
        } else if (daysInStock > (thresholds.agingThreshold || 90)) {
          agingCategory = 'aging';
        }

        agingAnalysis.push({
          product: pid,
          metrics: {
            daysInStock,
            lastSoldDate,
            agingCategory,
            stockValue,
            potentialLoss
          },
          trend: {
            previousDaysInStock: 0, // Would need historical data
            agingChange: 0,
            agingChangePercentage: 0
          },
          rank: 0 // Will be set after sorting
        });
      }

      // Sort by days in stock and assign ranks
      agingAnalysis.sort((a, b) => b.metrics.daysInStock - a.metrics.daysInStock);
      agingAnalysis.forEach((item, index) => {
        item.rank = index + 1;
      });

      report.agingAnalysis = agingAnalysis;
      // Don't save here - will be saved at the end
    } catch (error) {
      console.error('Error generating aging analysis data:', error);
      throw error;
    }
  }

  // Generate comprehensive data (all types)
  async generateComprehensiveData(report) {
    // Run methods sequentially to avoid parallel save conflicts
    await this.generateStockLevelsData(report);
    await this.generateTurnoverRatesData(report);
    await this.generateAgingAnalysisData(report);
    await this.generateCategoryPerformanceData(report);
    await this.generateSupplierPerformanceData(report);
  }

  // Generate category performance data
  async generateCategoryPerformanceData(report) {
    try {
      const { startDate, endDate } = report;
      const products = await ProductRepository.findAll({ isActive: true }, { limit: 5000 });
      const byCategory = {};
      for (const p of products) {
        const cid = (p.category_id || p.category || p._id)?.toString?.() ?? 'none';
        if (!byCategory[cid]) {
          byCategory[cid] = { _id: cid, totalProducts: 0, totalStockValue: 0, lowStockProducts: 0, outOfStockProducts: 0, overstockedProducts: 0, averageTurnoverRate: 0 };
        }
        const row = byCategory[cid];
        row.totalProducts++;
        const stock = Number(p.stock_quantity ?? p.stockQuantity ?? 0);
        const cost = Number(p.cost_price ?? p.costPrice ?? 0);
        row.totalStockValue += stock * cost;
        const reorder = Number(p.min_stock_level ?? p.minStockLevel ?? 0);
        if (stock <= reorder) row.lowStockProducts++;
        if (stock === 0) row.outOfStockProducts++;
        if (reorder > 0 && stock > reorder * 3) row.overstockedProducts++;
      }
      const categoryPerformance = Object.values(byCategory).sort((a, b) => b.totalStockValue - a.totalStockValue);

      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousCategoryPerformance = await this.getPreviousCategoryPerformance(previousPeriod.startDate, previousPeriod.endDate, categoryPerformance.map(c => c._id));

      // Format and rank categories
      const categoryPerformanceData = categoryPerformance.map((category, index) => {
        const previousData = previousCategoryPerformance.find(c => c._id.toString() === category._id.toString());
        
        return {
          category: category._id,
          metrics: {
            totalProducts: category.totalProducts,
            totalStockValue: category.totalStockValue,
            averageTurnoverRate: category.averageTurnoverRate,
            lowStockProducts: category.lowStockProducts,
            outOfStockProducts: category.outOfStockProducts,
            overstockedProducts: category.overstockedProducts
          },
          trend: {
            previousStockValue: previousData?.totalStockValue || 0,
            stockValueChange: category.totalStockValue - (previousData?.totalStockValue || 0),
            stockValueChangePercentage: this.calculatePercentageChange(category.totalStockValue, previousData?.totalStockValue || 0)
          },
          rank: index + 1
        };
      });

      report.categoryPerformance = categoryPerformanceData;
      // Don't save here - will be saved at the end
    } catch (error) {
      console.error('Error generating category performance data:', error);
      throw error;
    }
  }

  // Generate supplier performance data
  async generateSupplierPerformanceData(report) {
    try {
      const { startDate, endDate } = report;

      const poStatuses = ['confirmed', 'partially_received', 'fully_received'];
      const piStatuses = ['confirmed', 'received', 'paid'];
      let purchaseOrders = await PurchaseOrderRepository.findAll({ dateFrom: startDate, dateTo: endDate }, { limit: 2000 });
      let purchaseInvoices = await PurchaseInvoiceRepository.findAll({ dateFrom: startDate, dateTo: endDate }, { limit: 2000 });
      purchaseOrders = purchaseOrders.filter(po => poStatuses.includes(po.status));
      purchaseInvoices = purchaseInvoices.filter(inv => piStatuses.includes(inv.status));

      // Calculate performance metrics per supplier
      const supplierPerformance = new Map();
      
      const supplierIds = new Set();
      purchaseOrders.forEach(po => {
        const supplierId = (po.supplier_id || po.supplier?.id || po.supplier?._id)?.toString?.();
        if (!supplierId) return;
        supplierIds.add(supplierId);
        if (!supplierPerformance.has(supplierId)) {
          supplierPerformance.set(supplierId, {
            supplierId,
            supplierName: 'Unknown',
            totalOrders: 0,
            totalInvoices: 0,
            totalValue: 0,
            averageOrderValue: 0,
            onTimeDelivery: 0,
            totalDeliveries: 0
          });
        }
        const perf = supplierPerformance.get(supplierId);
        perf.totalOrders++;
        perf.totalValue += Number(po?.total ?? po?.grand_total ?? 0);
      });
      purchaseInvoices.forEach(inv => {
        const supplierId = (inv.supplier_id || inv.supplier?.id || inv.supplier?._id)?.toString?.();
        if (!supplierId) return;
        supplierIds.add(supplierId);
        if (!supplierPerformance.has(supplierId)) {
          supplierPerformance.set(supplierId, {
            supplierId,
            supplierName: 'Unknown',
            totalOrders: 0,
            totalInvoices: 0,
            totalValue: 0,
            averageOrderValue: 0,
            onTimeDelivery: 0,
            totalDeliveries: 0
          });
        }
        const perf = supplierPerformance.get(supplierId);
        perf.totalInvoices++;
        perf.totalValue += Number(inv?.total ?? inv?.pricing?.total ?? 0);
        if (inv.actual_delivery && inv.expected_delivery) {
          perf.totalDeliveries++;
          if (new Date(inv.actual_delivery) <= new Date(inv.expected_delivery)) perf.onTimeDelivery++;
        }
      });
      for (const sid of supplierIds) {
        try {
          const sup = await SupplierRepository.findById(sid);
          if (sup && supplierPerformance.has(sid)) supplierPerformance.get(sid).supplierName = sup.company_name || sup.name || 'Unknown';
        } catch (_) {}
      }

      // Calculate averages and convert to array
      const performanceArray = Array.from(supplierPerformance.values()).map(perf => {
        perf.averageOrderValue = perf.totalOrders > 0 ? perf.totalValue / perf.totalOrders : 0;
        perf.onTimeDeliveryRate = perf.totalDeliveries > 0 
          ? (perf.onTimeDelivery / perf.totalDeliveries) * 100 
          : 0;
        return perf;
      });

      report.supplierPerformance = performanceArray;
      // Don't save here - will be saved at the end
    } catch (error) {
      console.error('Error generating supplier performance data:', error);
      throw error;
    }
  }

  // Generate summary data
  async generateSummaryData(report) {
    try {
      const { startDate, endDate, config } = report;
      const { thresholds } = config;

      const products = await ProductRepository.findAll({ isActive: true }, { limit: 10000 });
      const summaryData = products.reduce(
        (acc, p) => {
          acc.totalProducts++;
          const stock = Number(p.stock_quantity ?? p.stockQuantity ?? 0);
          const cost = Number(p.cost_price ?? p.costPrice ?? 0);
          acc.totalStockValue += stock * cost;
          const reorder = Number(p.min_stock_level ?? p.minStockLevel ?? 0);
          if (stock <= reorder) acc.lowStockProducts++;
          if (stock === 0) acc.outOfStockProducts++;
          if (reorder > 0 && stock > reorder * 3) acc.overstockedProducts++;
          return acc;
        },
        { totalProducts: 0, totalStockValue: 0, lowStockProducts: 0, outOfStockProducts: 0, overstockedProducts: 0 }
      );

      // Calculate turnover categories
      const fastMovingProducts = report.turnoverRates?.filter(p => p.metrics.turnoverCategory === 'fast').length || 0;
      const slowMovingProducts = report.turnoverRates?.filter(p => p.metrics.turnoverCategory === 'slow').length || 0;
      const deadStockProducts = report.turnoverRates?.filter(p => p.metrics.turnoverCategory === 'dead').length || 0;

      // Calculate aging categories
      const agingProducts = report.agingAnalysis?.filter(p => p.metrics.agingCategory === 'aging').length || 0;
      const oldProducts = report.agingAnalysis?.filter(p => p.metrics.agingCategory === 'old').length || 0;
      const veryOldProducts = report.agingAnalysis?.filter(p => p.metrics.agingCategory === 'very_old').length || 0;

      // Calculate total potential loss
      const totalPotentialLoss = report.agingAnalysis?.reduce((sum, p) => sum + p.metrics.potentialLoss, 0) || 0;

      // Calculate average turnover rate
      const averageTurnoverRate = report.turnoverRates?.length > 0 ? 
        report.turnoverRates.reduce((sum, p) => sum + p.metrics.turnoverRate, 0) / report.turnoverRates.length : 0;

      report.summary = {
        totalProducts: summaryData.totalProducts,
        totalStockValue: summaryData.totalStockValue,
        averageTurnoverRate,
        lowStockProducts: summaryData.lowStockProducts,
        outOfStockProducts: summaryData.outOfStockProducts,
        overstockedProducts: summaryData.overstockedProducts,
        fastMovingProducts,
        slowMovingProducts,
        deadStockProducts,
        agingProducts,
        oldProducts,
        veryOldProducts,
        totalPotentialLoss
      };

      // Don't save here - will be saved at the end
    } catch (error) {
      console.error('Error generating summary data:', error);
      throw error;
    }
  }

  // Generate comparison data with previous period
  async generateComparisonData(report) {
    try {
      const { startDate, endDate, periodType } = report;
      const previousPeriod = this.getPreviousPeriod(startDate, endDate, periodType);

      const prevProducts = await ProductRepository.findAll({ isActive: true }, { limit: 10000 });
      const previousData = prevProducts.reduce(
        (acc, p) => {
          acc.totalProducts++;
          const stock = Number(p.stock_quantity ?? p.stockQuantity ?? 0);
          const cost = Number(p.cost_price ?? p.costPrice ?? 0);
          acc.totalStockValue += stock * cost;
          const reorder = Number(p.min_stock_level ?? p.minStockLevel ?? 0);
          if (stock <= reorder) acc.lowStockProducts++;
          if (stock === 0) acc.outOfStockProducts++;
          return acc;
        },
        { totalProducts: 0, totalStockValue: 0, lowStockProducts: 0, outOfStockProducts: 0 }
      ) || {
        totalProducts: 0,
        totalStockValue: 0,
        lowStockProducts: 0,
        outOfStockProducts: 0
      };

      report.comparison = {
        previousPeriod: {
          startDate: previousPeriod.startDate,
          endDate: previousPeriod.endDate,
          totalProducts: previousData.totalProducts,
          totalStockValue: previousData.totalStockValue,
          averageTurnoverRate: 0, // Would need to calculate
          lowStockProducts: previousData.lowStockProducts,
          outOfStockProducts: previousData.outOfStockProducts
        },
        changes: {
          productChange: report.summary.totalProducts - previousData.totalProducts,
          productChangePercentage: this.calculatePercentageChange(report.summary.totalProducts, previousData.totalProducts),
          stockValueChange: report.summary.totalStockValue - previousData.totalStockValue,
          stockValueChangePercentage: this.calculatePercentageChange(report.summary.totalStockValue, previousData.totalStockValue),
          turnoverChange: 0, // Would need to calculate
          turnoverChangePercentage: 0,
          lowStockChange: report.summary.lowStockProducts - previousData.lowStockProducts,
          lowStockChangePercentage: this.calculatePercentageChange(report.summary.lowStockProducts, previousData.lowStockProducts),
          outOfStockChange: report.summary.outOfStockProducts - previousData.outOfStockProducts,
          outOfStockChangePercentage: this.calculatePercentageChange(report.summary.outOfStockProducts, previousData.outOfStockProducts)
        }
      };

      // Don't save here - will be saved at the end
    } catch (error) {
      console.error('Error generating comparison data:', error);
      throw error;
    }
  }

  // Generate insights and recommendations (report is plain object; no Mongoose doc method)
  async generateInsights(report) {
    try {
      const insights = report.insights || [];
      report.insights = insights;
      // Don't save here - will be saved at the end
    } catch (error) {
      console.error('Error generating insights:', error);
      throw error;
    }
  }

  // Helper methods
  getDateRange(periodType, startDate, endDate) {
    if (startDate && endDate) {
      return { startDate: new Date(startDate), endDate: new Date(endDate) };
    }

    const now = new Date();
    let start, end;

    switch (periodType) {
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        start = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
        break;
      case 'yearly':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return { startDate: start, endDate: end };
  }

  getPreviousPeriod(startDate, endDate, periodType) {
    const duration = endDate - startDate;
    
    return {
      startDate: new Date(startDate.getTime() - duration),
      endDate: new Date(endDate.getTime() - duration)
    };
  }

  calculatePercentageChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  async generateReportId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `INR-${timestamp}-${random}`;
  }

  generateReportName(reportType, periodType, dateRange) {
    const typeNames = {
      stock_levels: 'Stock Levels',
      turnover_rates: 'Turnover Rates',
      aging_analysis: 'Aging Analysis',
      comprehensive: 'Comprehensive'
    };

    const periodNames = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly'
    };

    return `${typeNames[reportType]} Report - ${periodNames[periodType]} (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  }

  // Additional helper methods for data retrieval
  async getPreviousStockLevels(startDate, endDate, productIds) {
    // This would need to be implemented with historical data
    // For now, return empty array
    return [];
  }

  async getPreviousCategoryPerformance(startDate, endDate, categoryIds) {
    // This would need to be implemented with historical data
    // For now, return empty array
    return [];
  }

  async getPreviousSupplierPerformance(startDate, endDate, supplierIds) {
    // This would need to be implemented with historical data
    // For now, return empty array
    return [];
  }

  async getDaysInStock(productId, endDate) {
    // This would need to be implemented with historical data
    // For now, return a default value
    return 30;
  }

  // Get all inventory reports
  async getInventoryReports(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        reportType,
        status,
        generatedBy,
        startDate,
        endDate,
        sortBy = 'generatedAt',
        sortOrder = 'desc'
      } = filters;

      const skip = (page - 1) * limit;
      const query = {};

      // Apply filters
      if (reportType) query.reportType = reportType;
      if (status) query.status = status;
      if (generatedBy) query.generatedBy = generatedBy;

      // Date range filter - use Pakistan timezone if dates are strings
      if (startDate || endDate) {
        const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');
        query.generatedAt = {};
        if (startDate) {
          query.generatedAt.$gte = typeof startDate === 'string' 
            ? getStartOfDayPakistan(startDate) 
            : startDate;
        }
        if (endDate) {
          query.generatedAt.$lte = typeof endDate === 'string'
            ? getEndOfDayPakistan(endDate)
            : endDate;
        }
      }

      const dbFilters = {};
      if (reportType) dbFilters.reportType = reportType;
      if (startDate) dbFilters.dateFrom = startDate;
      if (endDate) dbFilters.dateTo = endDate;
      const total = await InventoryReportRepository.count(dbFilters);
      const reports = await InventoryReportRepository.findAll(dbFilters, { limit, offset: skip });
      const sortMult = sortOrder === 'desc' ? -1 : 1;
      const key = sortBy === 'generatedAt' ? 'created_at' : sortBy;
      reports.sort((a, b) => {
        const va = a[key] != null ? a[key] : '';
        const vb = b[key] != null ? b[key] : '';
        return (va < vb ? -1 : va > vb ? 1 : 0) * sortMult;
      });
      return {
        reports,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching inventory reports:', error);
      throw error;
    }
  }

  // Get inventory report by ID
  async getInventoryReportById(reportId) {
    try {
      const report = await InventoryReportRepository.findOne({ reportId });
      if (!report) throw new Error('Inventory report not found');
      return report;
    } catch (error) {
      console.error('Error fetching inventory report:', error);
      throw error;
    }
  }

  // Delete inventory report
  async deleteInventoryReport(reportId, deletedBy) {
    try {
      const report = await InventoryReportRepository.findOne({ reportId });
      if (!report) throw new Error('Inventory report not found');
      await InventoryReportRepository.deleteByReportId(reportId);
      return { message: 'Inventory report deleted successfully' };
    } catch (error) {
      console.error('Error deleting inventory report:', error);
      throw error;
    }
  }
}

module.exports = new InventoryReportService();
