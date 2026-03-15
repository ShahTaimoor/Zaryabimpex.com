const InventoryReport = require('../models/InventoryReport');
const Product = require('../models/Product');
const Sales = require('../models/Sales');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');

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
      
      // Generate report ID
      const reportId = await this.generateReportId();

      // Create report document
      const report = new InventoryReport({
        reportId,
        reportName: this.generateReportName(reportType, periodType, dateRange),
        reportType,
        periodType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        config: {
          includeMetrics,
          filters,
          thresholds
        },
        status: 'generating',
        generatedBy
      });

      await report.save();

      try {
        // Generate report data based on type
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

        // Generate summary and comparison data
        await this.generateSummaryData(report);
        await this.generateComparisonData(report);
        await this.generateInsights(report);

        // Mark as completed
        report.status = 'completed';
        await report.save();

        return report;
      } catch (error) {
        report.status = 'failed';
        await report.save();
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

      // Get all products with current stock levels
      const products = await Product.find(matchCriteria)
        .populate('category', 'name')
        .sort({ 'inventory.currentStock': -1 });

      // Get previous period stock levels for comparison
      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousStockLevels = await this.getPreviousStockLevels(previousPeriod.startDate, previousPeriod.endDate, products.map(p => p._id));

      // Calculate stock levels and categorize
      const stockLevels = await Promise.all(products.map(async (product, index) => {
        const previousStock = previousStockLevels.find(p => p._id.toString() === product._id.toString());
        const currentStock = product.inventory.currentStock;
        const reorderPoint = product.inventory.reorderPoint;
        const minStock = product.inventory.minStock;
        const maxStock = product.inventory.maxStock;
        const stockValue = currentStock * product.pricing.cost;

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
          product: product._id,
          metrics: {
            currentStock,
            minStock,
            maxStock,
            reorderPoint,
            reorderQuantity: product.inventory.reorderPoint * 2, // Default reorder quantity
            stockValue,
            stockStatus
          },
          trend: {
            previousStock: previousStock?.currentStock || 0,
            stockChange: currentStock - (previousStock?.currentStock || 0),
            stockChangePercentage: this.calculatePercentageChange(currentStock, previousStock?.currentStock || 0),
            daysInStock: await this.getDaysInStock(product._id, endDate)
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

      const products = await Product.find(productMatchCriteria);

      // Get sales data for the period
      const salesData = await Sales.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'delivered'
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            totalSold: { $sum: '$items.quantity' }
          }
        }
      ]);

      // Get previous period sales data for comparison
      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousSalesData = await Sales.aggregate([
        {
          $match: {
            createdAt: { $gte: previousPeriod.startDate, $lte: previousPeriod.endDate },
            status: 'delivered'
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            totalSold: { $sum: '$items.quantity' }
          }
        }
      ]);

      // Calculate turnover rates
      const turnoverRates = [];
      const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const periodYears = periodDays / 365;

      for (const product of products) {
        const salesDataForProduct = salesData.find(s => s._id.toString() === product._id.toString());
        const previousSalesDataForProduct = previousSalesData.find(s => s._id.toString() === product._id.toString());
        
        const totalSold = salesDataForProduct?.totalSold || 0;
        const averageStock = product.inventory.currentStock; // Simplified - could be calculated more accurately
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
          product: product._id,
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

      const products = await Product.find(matchCriteria);

      // Get last sold dates for products
      const lastSoldDates = await Sales.aggregate([
        {
          $match: {
            status: 'delivered',
            'items.product': { $in: products.map(p => p._id) }
          }
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            lastSoldDate: { $max: '$createdAt' }
          }
        }
      ]);

      // Calculate aging analysis
      const agingAnalysis = [];
      const currentDate = new Date();

      for (const product of products) {
        const lastSoldData = lastSoldDates.find(l => l._id.toString() === product._id.toString());
        const lastSoldDate = lastSoldData?.lastSoldDate || product.createdAt;
        const daysInStock = Math.ceil((currentDate - lastSoldDate) / (1000 * 60 * 60 * 24));
        const stockValue = product.inventory.currentStock * product.pricing.cost;
        
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
          product: product._id,
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

      // Get category performance
      const categoryPerformance = await Product.aggregate([
        {
          $group: {
            _id: '$category',
            totalProducts: { $sum: 1 },
            totalStockValue: { $sum: { $multiply: ['$inventory.currentStock', '$pricing.cost'] } },
            lowStockProducts: {
              $sum: {
                $cond: [
                  { $lte: ['$inventory.currentStock', '$inventory.reorderPoint'] },
                  1,
                  0
                ]
              }
            },
            outOfStockProducts: {
              $sum: {
                $cond: [
                  { $eq: ['$inventory.currentStock', 0] },
                  1,
                  0
                ]
              }
            },
            overstockedProducts: {
              $sum: {
                $cond: [
                  { $gt: ['$inventory.currentStock', { $multiply: ['$inventory.reorderPoint', 3] }] },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        { $unwind: '$categoryInfo' },
        {
          $addFields: {
            averageTurnoverRate: 0 // Would need to calculate from sales data
          }
        },
        { $sort: { totalStockValue: -1 } }
      ]);

      // Get previous period data for comparison
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
      const PurchaseOrder = require('../models/PurchaseOrder');
      const PurchaseInvoice = require('../models/PurchaseInvoice');
      const Product = require('../models/Product');

      // Get all products with suppliers
      const productsWithSuppliers = await Product.find({
        $or: [
          { suppliers: { $exists: true, $ne: [] } },
          { primarySupplier: { $exists: true } }
        ]
      }).select('_id suppliers primarySupplier').lean();

      // Create a map of supplier to products
      const supplierProductMap = new Map();
      productsWithSuppliers.forEach(product => {
        const suppliers = product.suppliers || [];
        if (product.primarySupplier) {
          suppliers.push(product.primarySupplier);
        }
        const uniqueSuppliers = [...new Set(suppliers.map(s => s.toString()))];
        uniqueSuppliers.forEach(supplierId => {
          if (!supplierProductMap.has(supplierId)) {
            supplierProductMap.set(supplierId, []);
          }
          supplierProductMap.get(supplierId).push(product._id);
        });
      });

      // Get purchase orders and invoices for the period
      const purchaseOrders = await PurchaseOrder.find({
        orderDate: { $gte: startDate, $lte: endDate },
        status: { $in: ['confirmed', 'partially_received', 'fully_received'] }
      }).populate('supplier', 'companyName').lean();

      const purchaseInvoices = await PurchaseInvoice.find({
        createdAt: { $gte: startDate, $lte: endDate },
        invoiceType: 'purchase',
        status: { $in: ['confirmed', 'received', 'paid'] }
      }).populate('supplier', 'companyName').lean();

      // Calculate performance metrics per supplier
      const supplierPerformance = new Map();
      
      // Process purchase orders
      purchaseOrders.forEach(po => {
        if (!po.supplier) return;
        const supplierId = po.supplier._id.toString();
        if (!supplierPerformance.has(supplierId)) {
          supplierPerformance.set(supplierId, {
            supplierId: supplierId,
            supplierName: po.supplier.companyName || 'Unknown',
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
        perf.totalValue += po.total || 0;
      });

      // Process purchase invoices
      purchaseInvoices.forEach(inv => {
        if (!inv.supplier) return;
        const supplierId = inv.supplier._id.toString();
        if (!supplierPerformance.has(supplierId)) {
          supplierPerformance.set(supplierId, {
            supplierId: supplierId,
            supplierName: inv.supplier.companyName || 'Unknown',
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
        perf.totalValue += inv.pricing?.total || 0;
        if (inv.actualDelivery && inv.expectedDelivery) {
          perf.totalDeliveries++;
          if (inv.actualDelivery <= inv.expectedDelivery) {
            perf.onTimeDelivery++;
          }
        }
      });

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

      // Get overall summary
      const summary = await Product.aggregate([
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalStockValue: { $sum: { $multiply: ['$inventory.currentStock', '$pricing.cost'] } },
            lowStockProducts: {
              $sum: {
                $cond: [
                  { $lte: ['$inventory.currentStock', '$inventory.reorderPoint'] },
                  1,
                  0
                ]
              }
            },
            outOfStockProducts: {
              $sum: {
                $cond: [
                  { $eq: ['$inventory.currentStock', 0] },
                  1,
                  0
                ]
              }
            },
            overstockedProducts: {
              $sum: {
                $cond: [
                  { $gt: ['$inventory.currentStock', { $multiply: ['$inventory.reorderPoint', 3] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      const summaryData = summary[0] || {
        totalProducts: 0,
        totalStockValue: 0,
        lowStockProducts: 0,
        outOfStockProducts: 0,
        overstockedProducts: 0
      };

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

      // Get previous period summary
      const previousSummary = await Product.aggregate([
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalStockValue: { $sum: { $multiply: ['$inventory.currentStock', '$pricing.cost'] } },
            lowStockProducts: {
              $sum: {
                $cond: [
                  { $lte: ['$inventory.currentStock', '$inventory.reorderPoint'] },
                  1,
                  0
                ]
              }
            },
            outOfStockProducts: {
              $sum: {
                $cond: [
                  { $eq: ['$inventory.currentStock', 0] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      const previousData = previousSummary[0] || {
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

  // Generate insights and recommendations
  async generateInsights(report) {
    try {
      const insights = report.generateInsights();
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

      const reports = await InventoryReport.find(query)
        .populate([
          { path: 'generatedBy', select: 'firstName lastName email' },
          { path: 'stockLevels.product', select: 'name description pricing inventory' },
          { path: 'turnoverRates.product', select: 'name description pricing inventory' },
          { path: 'agingAnalysis.product', select: 'name description pricing inventory' }
        ])
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limit);

      const total = await InventoryReport.countDocuments(query);

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
      const report = await InventoryReport.findOne({ reportId })
        .populate([
          { path: 'generatedBy', select: 'firstName lastName email' },
          { path: 'stockLevels.product', select: 'name description pricing inventory category supplier' },
          { path: 'turnoverRates.product', select: 'name description pricing inventory category supplier' },
          { path: 'agingAnalysis.product', select: 'name description pricing inventory category supplier' },
          { path: 'categoryPerformance.category', select: 'name description' },
          { path: 'supplierPerformance.supplier', select: 'name contactInfo' }
        ]);

      if (!report) {
        throw new Error('Inventory report not found');
      }

      return report;
    } catch (error) {
      console.error('Error fetching inventory report:', error);
      throw error;
    }
  }

  // Delete inventory report
  async deleteInventoryReport(reportId, deletedBy) {
    try {
      const report = await InventoryReport.findOne({ reportId });
      if (!report) {
        throw new Error('Inventory report not found');
      }

      await InventoryReport.findOneAndDelete({ reportId });
      return { message: 'Inventory report deleted successfully' };
    } catch (error) {
      console.error('Error deleting inventory report:', error);
      throw error;
    }
  }
}

module.exports = new InventoryReportService();
