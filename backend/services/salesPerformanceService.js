const SalesPerformance = require('../models/SalesPerformance');
const Sales = require('../models/Sales');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Category = require('../models/Category');

class SalesPerformanceService {
  constructor() {
    this.reportTypes = {
      TOP_PRODUCTS: 'top_products',
      TOP_CUSTOMERS: 'top_customers',
      TOP_SALES_REPS: 'top_sales_reps',
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

  // Generate comprehensive sales performance report
  async generateSalesPerformanceReport(config, generatedBy) {
    try {
      const {
        reportType = 'comprehensive',
        periodType = 'monthly',
        startDate,
        endDate,
        limit = 10,
        includeMetrics = {},
        filters = {},
        groupBy = 'product',
        rankBy = 'revenue'
      } = config;

      // Validate and set date range
      const dateRange = this.getDateRange(periodType, startDate, endDate);
      
      // Generate report ID
      const reportId = await this.generateReportId();

      // Create report document
      const report = new SalesPerformance({
        reportId,
        reportName: this.generateReportName(reportType, periodType, dateRange),
        reportType,
        periodType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        config: {
          limit,
          includeMetrics,
          filters,
          groupBy,
          rankBy
        },
        status: 'generating',
        generatedBy
      });

      await report.save();

      try {
        // Generate report data based on type
        switch (reportType) {
          case 'top_products':
            await this.generateTopProductsData(report);
            break;
          case 'top_customers':
            await this.generateTopCustomersData(report);
            break;
          case 'top_sales_reps':
            await this.generateTopSalesRepsData(report);
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
        await this.generateTimeSeriesData(report);
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
      console.error('Error generating sales performance report:', error);
      throw error;
    }
  }

  // Generate top products data
  async generateTopProductsData(report) {
    try {
      const { startDate, endDate, config } = report;
      const { filters, limit } = config;

      // Build match criteria
      const matchCriteria = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      };

      // Apply filters
      if (filters.orderTypes && filters.orderTypes.length > 0) {
        matchCriteria.orderType = { $in: filters.orderTypes };
      }

      // Aggregate product performance
      const productPerformance = await Sales.aggregate([
        { $match: matchCriteria },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        {
          $group: {
            _id: '$items.product',
            product: { $first: '$productInfo' },
            totalRevenue: {
              $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] }
            },
            totalQuantity: { $sum: '$items.quantity' },
            totalOrders: { $sum: 1 },
            costOfGoodsSold: {
              $sum: { $multiply: ['$productInfo.cost', '$items.quantity'] }
            }
          }
        },
        {
          $addFields: {
            profit: { $subtract: ['$totalRevenue', '$costOfGoodsSold'] },
            margin: {
              $cond: [
                { $eq: ['$totalRevenue', 0] },
                0,
                {
                  $multiply: [
                    { $divide: [{ $subtract: ['$totalRevenue', '$costOfGoodsSold'] }, '$totalRevenue'] },
                    100
                  ]
                }
              ]
            },
            averageOrderValue: { $divide: ['$totalRevenue', '$totalOrders'] }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: limit }
      ]);

      // Get previous period data for comparison
      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousProductPerformance = await this.getProductPerformanceForPeriod(
        previousPeriod.startDate,
        previousPeriod.endDate,
        productPerformance.map(p => p._id)
      );

      // Format and rank products
      const topProducts = productPerformance.map((product, index) => {
        const previousData = previousProductPerformance.find(p => p._id.toString() === product._id.toString());
        
        return {
          product: product._id,
          metrics: {
            totalRevenue: product.totalRevenue,
            totalQuantity: product.totalQuantity,
            totalOrders: product.totalOrders,
            averageOrderValue: product.averageOrderValue,
            profit: product.profit,
            margin: product.margin,
            costOfGoodsSold: product.costOfGoodsSold
          },
          trend: {
            previousPeriodRevenue: previousData?.totalRevenue || 0,
            revenueChange: product.totalRevenue - (previousData?.totalRevenue || 0),
            revenueChangePercentage: this.calculatePercentageChange(
              product.totalRevenue,
              previousData?.totalRevenue || 0
            ),
            quantityChange: product.totalQuantity - (previousData?.totalQuantity || 0),
            quantityChangePercentage: this.calculatePercentageChange(
              product.totalQuantity,
              previousData?.totalQuantity || 0
            )
          },
          rank: index + 1
        };
      });

      report.topProducts = topProducts;
      await report.save();
    } catch (error) {
      console.error('Error generating top products data:', error);
      throw error;
    }
  }

  // Generate top customers data
  async generateTopCustomersData(report) {
    try {
      const { startDate, endDate, config } = report;
      const { filters = {}, limit, rankBy = 'revenue' } = config;
      const MS_PER_DAY = 1000 * 60 * 60 * 24;

      // Build match criteria
      const matchCriteria = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed',
        customer: { $exists: true, $ne: null }
      };

      // Apply filters
      if (filters.orderTypes && filters.orderTypes.length > 0) {
        matchCriteria.orderType = { $in: filters.orderTypes };
      }

      // Aggregate customer performance
      const customerPerformance = await Sales.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'customers',
            localField: 'customer',
            foreignField: '_id',
            as: 'customerInfo'
          }
        },
        { $unwind: '$customerInfo' },
        ...(filters.customerTiers && filters.customerTiers.length > 0
          ? [{ $match: { 'customerInfo.customerTier': { $in: filters.customerTiers } } }]
          : []),
        ...(filters.businessTypes && filters.businessTypes.length > 0
          ? [{ $match: { 'customerInfo.businessType': { $in: filters.businessTypes } } }]
          : []),
        {
          $addFields: {
            orderRevenue: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: {
                    $multiply: ['$$item.unitPrice', '$$item.quantity']
                  }
                }
              }
            },
            orderCost: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: {
                    $multiply: [
                      { $ifNull: ['$$item.unitCost', 0] },
                      '$$item.quantity'
                    ]
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: '$customer',
            customer: { $first: '$customerInfo' },
            totalRevenue: { $sum: '$orderRevenue' },
            totalCost: { $sum: '$orderCost' },
            totalOrders: { $sum: 1 },
            lastOrderDate: { $max: '$createdAt' },
            firstOrderDate: { $min: '$createdAt' }
          }
        },
        {
          $addFields: {
            averageOrderValue: { $divide: ['$totalRevenue', '$totalOrders'] },
            averageOrderFrequency: {
              $divide: [
                { $cond: [{ $lte: ['$totalOrders', 1] }, null, { $subtract: ['$lastOrderDate', '$firstOrderDate'] }] },
                {
                  $cond: [
                    { $lte: ['$totalOrders', 1] },
                    1,
                    { $multiply: [MS_PER_DAY, { $subtract: ['$totalOrders', 1] }] }
                  ]
                }
              ]
            },
            totalProfit: { $subtract: ['$totalRevenue', '$totalCost'] },
            margin: {
              $cond: [
                { $eq: ['$totalRevenue', 0] },
                0,
                {
                  $multiply: [
                    { $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalRevenue'] },
                    100
                  ]
                }
              ]
            }
          }
        },
        {
          $sort: {
            [rankBy === 'profit' ? 'totalProfit' : 'totalRevenue']: -1,
            totalRevenue: -1
          }
        },
        { $limit: limit }
      ]);

      // Get previous period data for comparison
      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousCustomerPerformance = await this.getCustomerPerformanceForPeriod(
        previousPeriod.startDate,
        previousPeriod.endDate,
        customerPerformance.map(c => c._id)
      );

      // Format and rank customers
      const topCustomers = customerPerformance.map((customer, index) => {
        const previousData = previousCustomerPerformance.find(c => c._id.toString() === customer._id.toString());
        
        return {
          customer: customer._id,
          metrics: {
            totalRevenue: customer.totalRevenue,
            totalOrders: customer.totalOrders,
            averageOrderValue: customer.averageOrderValue,
            lastOrderDate: customer.lastOrderDate,
            firstOrderDate: customer.firstOrderDate,
            averageOrderFrequency: customer.averageOrderFrequency || 0,
            totalProfit: customer.totalProfit,
            margin: customer.margin
          },
          trend: {
            previousPeriodRevenue: previousData?.totalRevenue || 0,
            revenueChange: customer.totalRevenue - (previousData?.totalRevenue || 0),
            revenueChangePercentage: this.calculatePercentageChange(
              customer.totalRevenue,
              previousData?.totalRevenue || 0
            ),
            orderCountChange: customer.totalOrders - (previousData?.totalOrders || 0),
            orderCountChangePercentage: this.calculatePercentageChange(
              customer.totalOrders,
              previousData?.totalOrders || 0
            ),
            previousPeriodProfit: previousData?.totalProfit || 0,
            profitChange: customer.totalProfit - (previousData?.totalProfit || 0),
            profitChangePercentage: this.calculatePercentageChange(
              customer.totalProfit,
              previousData?.totalProfit || 0
            )
          },
          rank: index + 1
        };
      });

      report.topCustomers = topCustomers;
      await report.save();
    } catch (error) {
      console.error('Error generating top customers data:', error);
      throw error;
    }
  }

  // Generate top sales reps data
  async generateTopSalesRepsData(report) {
    try {
      const { startDate, endDate, config } = report;
      const { filters, limit } = config;

      // Build match criteria
      const matchCriteria = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed',
        salesRep: { $exists: true, $ne: null }
      };

      // Apply filters
      if (filters.orderTypes && filters.orderTypes.length > 0) {
        matchCriteria.orderType = { $in: filters.orderTypes };
      }

      // Aggregate sales rep performance
      const salesRepPerformance = await Sales.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'users',
            localField: 'salesRep',
            foreignField: '_id',
            as: 'salesRepInfo'
          }
        },
        { $unwind: '$salesRepInfo' },
        {
          $group: {
            _id: '$salesRep',
            salesRep: { $first: '$salesRepInfo' },
            totalRevenue: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            totalCustomers: { $addToSet: '$customer' },
            totalUniqueCustomers: { $sum: 1 }
          }
        },
        {
          $addFields: {
            totalCustomers: { $size: '$totalCustomers' },
            averageOrderValue: { $divide: ['$totalRevenue', '$totalOrders'] },
            conversionRate: { $divide: ['$totalOrders', '$totalUniqueCustomers'] }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: limit }
      ]);

      // Get previous period data for comparison
      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousSalesRepPerformance = await this.getSalesRepPerformanceForPeriod(
        previousPeriod.startDate,
        previousPeriod.endDate,
        salesRepPerformance.map(s => s._id)
      );

      // Format and rank sales reps
      const topSalesReps = salesRepPerformance.map((salesRep, index) => {
        const previousData = previousSalesRepPerformance.find(s => s._id.toString() === salesRep._id.toString());
        
        return {
          salesRep: salesRep._id,
          metrics: {
            totalRevenue: salesRep.totalRevenue,
            totalOrders: salesRep.totalOrders,
            averageOrderValue: salesRep.averageOrderValue,
            totalCustomers: salesRep.totalCustomers,
            newCustomers: 0, // This would need to be calculated based on customer creation date
            conversionRate: salesRep.conversionRate
          },
          trend: {
            previousPeriodRevenue: previousData?.totalRevenue || 0,
            revenueChange: salesRep.totalRevenue - (previousData?.totalRevenue || 0),
            revenueChangePercentage: this.calculatePercentageChange(
              salesRep.totalRevenue,
              previousData?.totalRevenue || 0
            ),
            orderCountChange: salesRep.totalOrders - (previousData?.totalOrders || 0),
            orderCountChangePercentage: this.calculatePercentageChange(
              salesRep.totalOrders,
              previousData?.totalOrders || 0
            )
          },
          rank: index + 1
        };
      });

      report.topSalesReps = topSalesReps;
      await report.save();
    } catch (error) {
      console.error('Error generating top sales reps data:', error);
      throw error;
    }
  }

  // Generate comprehensive data (all types)
  async generateComprehensiveData(report) {
    await Promise.all([
      this.generateTopProductsData(report),
      this.generateTopCustomersData(report),
      this.generateTopSalesRepsData(report),
      this.generateCategoryPerformanceData(report)
    ]);
  }

  // Generate category performance data
  async generateCategoryPerformanceData(report) {
    try {
      const { startDate, endDate, config } = report;
      const { limit } = config;

      // Aggregate category performance
      const categoryPerformance = await Sales.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed'
          }
        },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        {
          $lookup: {
            from: 'categories',
            localField: 'productInfo.category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        { $unwind: '$categoryInfo' },
        {
          $group: {
            _id: '$productInfo.category',
            category: { $first: '$categoryInfo' },
            totalRevenue: {
              $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] }
            },
            totalQuantity: { $sum: '$items.quantity' },
            totalOrders: { $sum: 1 },
            costOfGoodsSold: {
              $sum: { $multiply: ['$productInfo.cost', '$items.quantity'] }
            }
          }
        },
        {
          $addFields: {
            profit: { $subtract: ['$totalRevenue', '$costOfGoodsSold'] },
            margin: {
              $cond: [
                { $eq: ['$totalRevenue', 0] },
                0,
                {
                  $multiply: [
                    { $divide: [{ $subtract: ['$totalRevenue', '$costOfGoodsSold'] }, '$totalRevenue'] },
                    100
                  ]
                }
              ]
            },
            averageOrderValue: { $divide: ['$totalRevenue', '$totalOrders'] }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: limit }
      ]);

      // Get previous period data for comparison
      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousCategoryPerformance = await this.getCategoryPerformanceForPeriod(
        previousPeriod.startDate,
        previousPeriod.endDate,
        categoryPerformance.map(c => c._id)
      );

      // Format and rank categories
      const categoryPerformanceData = categoryPerformance.map((category, index) => {
        const previousData = previousCategoryPerformance.find(c => c._id.toString() === category._id.toString());
        
        return {
          category: category._id,
          metrics: {
            totalRevenue: category.totalRevenue,
            totalQuantity: category.totalQuantity,
            totalOrders: category.totalOrders,
            averageOrderValue: category.averageOrderValue,
            profit: category.profit,
            margin: category.margin
          },
          trend: {
            previousPeriodRevenue: previousData?.totalRevenue || 0,
            revenueChange: category.totalRevenue - (previousData?.totalRevenue || 0),
            revenueChangePercentage: this.calculatePercentageChange(
              category.totalRevenue,
              previousData?.totalRevenue || 0
            )
          },
          rank: index + 1
        };
      });

      report.categoryPerformance = categoryPerformanceData;
      await report.save();
    } catch (error) {
      console.error('Error generating category performance data:', error);
      throw error;
    }
  }

  // Generate summary data
  async generateSummaryData(report) {
    try {
      const { startDate, endDate } = report;

      // Get overall summary
      const summary = await Sales.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            totalCustomers: { $addToSet: '$customer' },
            newCustomers: { $addToSet: '$customer' }
          }
        },
        {
          $addFields: {
            totalCustomers: { $size: '$totalCustomers' },
            averageOrderValue: { $divide: ['$totalRevenue', '$totalOrders'] }
          }
        }
      ]);

      const summaryData = summary[0] || {
        totalRevenue: 0,
        totalOrders: 0,
        totalCustomers: 0,
        averageOrderValue: 0
      };

      // Calculate profit and margin
      const profitData = await this.calculateTotalProfit(startDate, endDate);
      
      // Get top performers
      const topProductRevenue = report.topProducts.length > 0 ? report.topProducts[0].metrics.totalRevenue : 0;
      const topCustomerRevenue = report.topCustomers.length > 0 ? report.topCustomers[0].metrics.totalRevenue : 0;
      const topCustomerProfit = report.topCustomers.length > 0 ? report.topCustomers[0].metrics.totalProfit : 0;
      const topSalesRepRevenue = report.topSalesReps.length > 0 ? report.topSalesReps[0].metrics.totalRevenue : 0;

      report.summary = {
        totalRevenue: summaryData.totalRevenue,
        totalOrders: summaryData.totalOrders,
        totalQuantity: await this.getTotalQuantity(startDate, endDate),
        averageOrderValue: summaryData.averageOrderValue,
        totalProfit: profitData.totalProfit,
        averageMargin: profitData.averageMargin,
        totalCustomers: summaryData.totalCustomers,
        newCustomers: await this.getNewCustomersCount(startDate, endDate),
        returningCustomers: summaryData.totalCustomers - await this.getNewCustomersCount(startDate, endDate),
        topProductRevenue,
        topCustomerRevenue,
        topCustomerProfit,
        topSalesRepRevenue
      };

      await report.save();
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
      const previousSummary = await Sales.aggregate([
        {
          $match: {
            createdAt: { $gte: previousPeriod.startDate, $lte: previousPeriod.endDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            totalCustomers: { $addToSet: '$customer' }
          }
        },
        {
          $addFields: {
            totalCustomers: { $size: '$totalCustomers' },
            averageOrderValue: { $divide: ['$totalRevenue', '$totalOrders'] }
          }
        }
      ]);

      const previousData = previousSummary[0] || {
        totalRevenue: 0,
        totalOrders: 0,
        totalCustomers: 0,
        averageOrderValue: 0
      };

      const previousProfitData = await this.calculateTotalProfit(previousPeriod.startDate, previousPeriod.endDate);

      report.comparison = {
        previousPeriod: {
          startDate: previousPeriod.startDate,
          endDate: previousPeriod.endDate,
          totalRevenue: previousData.totalRevenue,
          totalOrders: previousData.totalOrders,
          totalQuantity: await this.getTotalQuantity(previousPeriod.startDate, previousPeriod.endDate),
          averageOrderValue: previousData.averageOrderValue,
          totalProfit: previousProfitData.totalProfit,
          totalCustomers: previousData.totalCustomers
        },
        changes: {
          revenueChange: report.summary.totalRevenue - previousData.totalRevenue,
          revenueChangePercentage: this.calculatePercentageChange(report.summary.totalRevenue, previousData.totalRevenue),
          orderChange: report.summary.totalOrders - previousData.totalOrders,
          orderChangePercentage: this.calculatePercentageChange(report.summary.totalOrders, previousData.totalOrders),
          quantityChange: report.summary.totalQuantity - await this.getTotalQuantity(previousPeriod.startDate, previousPeriod.endDate),
          quantityChangePercentage: this.calculatePercentageChange(
            report.summary.totalQuantity,
            await this.getTotalQuantity(previousPeriod.startDate, previousPeriod.endDate)
          ),
          aovChange: report.summary.averageOrderValue - previousData.averageOrderValue,
          aovChangePercentage: this.calculatePercentageChange(report.summary.averageOrderValue, previousData.averageOrderValue),
          profitChange: report.summary.totalProfit - previousProfitData.totalProfit,
          profitChangePercentage: this.calculatePercentageChange(report.summary.totalProfit, previousProfitData.totalProfit),
          customerChange: report.summary.totalCustomers - previousData.totalCustomers,
          customerChangePercentage: this.calculatePercentageChange(report.summary.totalCustomers, previousData.totalCustomers)
        }
      };

      await report.save();
    } catch (error) {
      console.error('Error generating comparison data:', error);
      throw error;
    }
  }

  // Generate time series data
  async generateTimeSeriesData(report) {
    try {
      const { startDate, endDate, periodType } = report;
      
      // Determine grouping interval based on period type
      let groupInterval;
      switch (periodType) {
        case 'daily':
          groupInterval = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
          break;
        case 'weekly':
          groupInterval = { $dateToString: { format: '%Y-W%U', date: '$createdAt' } };
          break;
        case 'monthly':
          groupInterval = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
          break;
        case 'quarterly':
          groupInterval = { $dateToString: { format: '%Y-Q%q', date: '$createdAt' } };
          break;
        case 'yearly':
          groupInterval = { $dateToString: { format: '%Y', date: '$createdAt' } };
          break;
        default:
          groupInterval = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
      }

      const timeSeriesData = await Sales.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: groupInterval,
            date: { $first: '$createdAt' },
            totalRevenue: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            totalQuantity: { $sum: { $sum: '$items.quantity' } },
            totalCustomers: { $addToSet: '$customer' }
          }
        },
        {
          $addFields: {
            averageOrderValue: { $divide: ['$totalRevenue', '$totalOrders'] },
            newCustomers: { $size: '$totalCustomers' },
            returningCustomers: { $size: '$totalCustomers' } // This would need more complex logic
          }
        },
        { $sort: { date: 1 } }
      ]);

      report.timeSeriesData = timeSeriesData.map(item => ({
        date: item.date,
        metrics: {
          totalRevenue: item.totalRevenue,
          totalOrders: item.totalOrders,
          totalQuantity: item.totalQuantity,
          averageOrderValue: item.averageOrderValue,
          newCustomers: item.newCustomers,
          returningCustomers: item.returningCustomers
        }
      }));

      await report.save();
    } catch (error) {
      console.error('Error generating time series data:', error);
      throw error;
    }
  }

  // Generate insights and recommendations
  async generateInsights(report) {
    try {
      const insights = report.generateInsights();
      report.insights = insights;
      await report.save();
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
    return `SPR-${timestamp}-${random}`;
  }

  generateReportName(reportType, periodType, dateRange) {
    const typeNames = {
      top_products: 'Top Products',
      top_customers: 'Top Customers',
      top_sales_reps: 'Top Sales Reps',
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
  async getProductPerformanceForPeriod(startDate, endDate, productIds) {
    return await Sales.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
          'items.product': { $in: productIds }
        }
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.product': { $in: productIds }
        }
      },
      {
        $group: {
          _id: '$items.product',
          totalRevenue: {
            $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] }
          },
          totalQuantity: { $sum: '$items.quantity' }
        }
      }
    ]);
  }

  async getCustomerPerformanceForPeriod(startDate, endDate, customerIds) {
    return await Sales.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
          customer: { $in: customerIds }
        }
      },
      {
        $addFields: {
          orderRevenue: {
            $sum: {
              $map: {
                input: { $ifNull: ['$items', []] },
                as: 'item',
                in: {
                  $multiply: ['$$item.unitPrice', '$$item.quantity']
                }
              }
            }
          },
          orderCost: {
            $sum: {
              $map: {
                input: { $ifNull: ['$items', []] },
                as: 'item',
                in: {
                  $multiply: [
                    { $ifNull: ['$$item.unitCost', 0] },
                    '$$item.quantity'
                  ]
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: '$customer',
          totalRevenue: { $sum: '$orderRevenue' },
          totalOrders: { $sum: 1 },
          totalProfit: { $sum: { $subtract: ['$orderRevenue', '$orderCost'] } }
        }
      }
    ]);
  }

  async getSalesRepPerformanceForPeriod(startDate, endDate, salesRepIds) {
    return await Sales.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
          salesRep: { $in: salesRepIds }
        }
      },
      {
        $group: {
          _id: '$salesRep',
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);
  }

  async getCategoryPerformanceForPeriod(startDate, endDate, categoryIds) {
    return await Sales.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $match: {
          'productInfo.category': { $in: categoryIds }
        }
      },
      {
        $group: {
          _id: '$productInfo.category',
          totalRevenue: {
            $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] }
          }
        }
      }
    ]);
  }

  async calculateTotalProfit(startDate, endDate) {
    const profitData = await Sales.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] }
          },
          totalCost: {
            $sum: { $multiply: ['$productInfo.cost', '$items.quantity'] }
          }
        }
      },
      {
        $addFields: {
          totalProfit: { $subtract: ['$totalRevenue', '$totalCost'] },
          averageMargin: {
            $cond: [
              { $eq: ['$totalRevenue', 0] },
              0,
              {
                $multiply: [
                  { $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalRevenue'] },
                  100
                ]
              }
            ]
          }
        }
      }
    ]);

    return profitData[0] || { totalProfit: 0, averageMargin: 0 };
  }

  async getTotalQuantity(startDate, endDate) {
    const quantityData = await Sales.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$items.quantity' }
        }
      }
    ]);

    return quantityData[0]?.totalQuantity || 0;
  }

  async getNewCustomersCount(startDate, endDate) {
    const newCustomers = await Customer.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    return newCustomers;
  }

  // Get all sales performance reports
  async getSalesPerformanceReports(filters = {}) {
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

      const reports = await SalesPerformance.find(query)
        .populate([
          { path: 'generatedBy', select: 'firstName lastName email' },
          { path: 'topProducts.product', select: 'name description price' },
          { path: 'topCustomers.customer', select: 'displayName email businessType' },
          { path: 'topSalesReps.salesRep', select: 'firstName lastName email' }
        ])
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limit);

      const total = await SalesPerformance.countDocuments(query);

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
      console.error('Error fetching sales performance reports:', error);
      throw error;
    }
  }

  // Get sales performance report by ID
  async getSalesPerformanceReportById(reportId) {
    try {
      const report = await SalesPerformance.findOne({ reportId })
        .populate([
          { path: 'generatedBy', select: 'firstName lastName email' },
          { path: 'topProducts.product', select: 'name description price cost category' },
          { path: 'topCustomers.customer', select: 'displayName email businessType customerTier' },
          { path: 'topSalesReps.salesRep', select: 'firstName lastName email role' },
          { path: 'categoryPerformance.category', select: 'name description' }
        ]);

      if (!report) {
        throw new Error('Sales performance report not found');
      }

      return report;
    } catch (error) {
      console.error('Error fetching sales performance report:', error);
      throw error;
    }
  }

  // Delete sales performance report
  async deleteSalesPerformanceReport(reportId, deletedBy) {
    try {
      const report = await SalesPerformance.findOne({ reportId });
      if (!report) {
        throw new Error('Sales performance report not found');
      }

      await SalesPerformance.findOneAndDelete({ reportId });
      return { message: 'Sales performance report deleted successfully' };
    } catch (error) {
      console.error('Error deleting sales performance report:', error);
      throw error;
    }
  }
}

module.exports = new SalesPerformanceService();
