const SalesPerformanceRepository = require('../repositories/postgres/SalesPerformanceRepository');
const SalesRepository = require('../repositories/SalesRepository');
const ProductRepository = require('../repositories/postgres/ProductRepository');
const CustomerRepository = require('../repositories/postgres/CustomerRepository');
const UserRepository = require('../repositories/postgres/UserRepository');
const CategoryRepository = require('../repositories/postgres/CategoryRepository');

async function getSalesProductPerformance(dateFrom, dateTo, limit = 10) {
  const sales = await SalesRepository.findAll({ dateFrom, dateTo, status: 'completed' }, { limit: 5000 });
  const byProduct = {};
  for (const sale of sales) {
    const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
    for (const it of items) {
      const pid = it.product?.id ?? it.product?._id ?? it.product ?? it.product_id;
      if (!pid) continue;
      const key = String(pid);
      if (!byProduct[key]) {
        byProduct[key] = { _id: pid, totalRevenue: 0, totalQuantity: 0, totalOrders: 0, costOfGoodsSold: 0 };
      }
      const rev = (Number(it.unit_price ?? it.unitPrice ?? 0) * Number(it.quantity ?? 0));
      const cost = Number(it.unitCost ?? it.cost ?? it.unit_cost ?? it.cost_price ?? it.costPrice ?? 0) * Number(it.quantity ?? 0);
      byProduct[key].totalRevenue += rev;
      byProduct[key].totalQuantity += Number(it.quantity ?? 0);
      byProduct[key].totalOrders += 1;
      byProduct[key].costOfGoodsSold += cost;
    }
  }
  let list = Object.values(byProduct).map(p => ({
    ...p,
    profit: p.totalRevenue - p.costOfGoodsSold,
    margin: p.totalRevenue ? ((p.totalRevenue - p.costOfGoodsSold) / p.totalRevenue) * 100 : 0,
    averageOrderValue: p.totalOrders ? p.totalRevenue / p.totalOrders : 0
  }));
  list.sort((a, b) => b.totalRevenue - a.totalRevenue);
  return list.slice(0, limit);
}

async function getSalesSummaryForPeriod(startDate, endDate) {
  const sales = await SalesRepository.findAll({ dateFrom: startDate, dateTo: endDate, status: 'completed' }, { limit: 10000 });
  let totalRevenue = 0;
  const customerSet = new Set();
  for (const s of sales) {
    totalRevenue += Number(s?.total ?? 0);
    const cid = s.customer_id || s.customer;
    if (cid) customerSet.add(String(cid));
  }
  const totalOrders = sales.length;
  return {
    totalRevenue,
    totalOrders,
    totalCustomers: customerSet.size,
    averageOrderValue: totalOrders ? totalRevenue / totalOrders : 0
  };
}

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
      
      const reportId = await this.generateReportId();
      const reportName = this.generateReportName(reportType, periodType, dateRange);
      const created = await SalesPerformanceRepository.create({
        reportId,
        reportName,
        reportType,
        periodType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        config: { limit, includeMetrics, filters, groupBy, rankBy, status: 'generating', generatedBy }
      });
      const report = {
        id: created.id,
        reportId,
        reportName,
        reportType,
        periodType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        config: { limit, includeMetrics, filters, groupBy, rankBy, status: 'generating', generatedBy },
        status: 'generating'
      };

      try {
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
        await this.generateSummaryData(report);
        await this.generateComparisonData(report);
        await this.generateTimeSeriesData(report);
        await this.generateInsights(report);
        report.status = 'completed';
        report.config = report.config || {};
        report.config.status = 'completed';
        await SalesPerformanceRepository.updateById(report.id, { config: report.config });
        return { ...created, ...report };
      } catch (error) {
        report.status = 'failed';
        report.config = report.config || {};
        report.config.status = 'failed';
        try { await SalesPerformanceRepository.updateById(report.id, { config: report.config }); } catch (_) {}
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

      const productPerformance = await getSalesProductPerformance(startDate, endDate, limit);
      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousProductPerformance = await getSalesProductPerformance(previousPeriod.startDate, previousPeriod.endDate, limit);

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

      const customerPerformanceRaw = await this.getCustomerPerformanceForPeriod(startDate, endDate, null);
      const customerPerformance = customerPerformanceRaw
        .map(c => ({
          ...c,
          averageOrderValue: c.totalOrders ? c.totalRevenue / c.totalOrders : 0,
          margin: c.totalRevenue ? ((c.totalProfit || 0) / c.totalRevenue) * 100 : 0
        }))
        .sort((a, b) => (rankBy === 'profit' ? (b.totalProfit || 0) - (a.totalProfit || 0) : b.totalRevenue - a.totalRevenue))
        .slice(0, limit);

      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousCustomerPerformance = await this.getCustomerPerformanceForPeriod(previousPeriod.startDate, previousPeriod.endDate, null);

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

      const salesRepPerformanceRaw = await this.getSalesRepPerformanceForPeriod(startDate, endDate, null);
      const salesRepPerformance = salesRepPerformanceRaw
        .map(s => ({ ...s, averageOrderValue: s.totalOrders ? s.totalRevenue / s.totalOrders : 0, totalCustomers: s.totalOrders, conversionRate: 1 }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);
      const previousPeriod = this.getPreviousPeriod(startDate, endDate, report.periodType);
      const previousSalesRepPerformance = await this.getSalesRepPerformanceForPeriod(previousPeriod.startDate, previousPeriod.endDate, salesRepPerformance.map(s => s._id));

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

      const categoryPerformance = await this.getCategoryPerformanceForPeriod(startDate, endDate, null);
      report.categoryPerformance = (categoryPerformance || []).map((cat, index) => ({
        category: cat._id,
        metrics: { totalRevenue: cat.totalRevenue || 0 },
        trend: {},
        rank: index + 1
      }));
    } catch (error) {
      console.error('Error generating category performance data:', error);
      throw error;
    }
  }

  // Generate summary data
  async generateSummaryData(report) {
    try {
      const { startDate, endDate } = report;

      const summaryData = await getSalesSummaryForPeriod(startDate, endDate);
      const _summaryData = summaryData || {
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
        returningCustomers: Math.max(0, summaryData.totalCustomers - await this.getNewCustomersCount(startDate, endDate)),
        topProductRevenue,
        topCustomerRevenue,
        topCustomerProfit,
        topSalesRepRevenue
      };

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

      const previousData = await getSalesSummaryForPeriod(previousPeriod.startDate, previousPeriod.endDate) || {
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

    } catch (error) {
      console.error('Error generating comparison data:', error);
      throw error;
    }
  }

  // Generate time series data
  async generateTimeSeriesData(report) {
    try {
      const { startDate, endDate, periodType } = report;
      
      const sales = await SalesRepository.findAll({ dateFrom: startDate, dateTo: endDate, status: 'completed' }, { limit: 5000 });
      const byDate = {};
      for (const s of sales) {
        const d = new Date(s.sale_date || s.created_at || s.createdAt);
        let key;
        if (periodType === 'monthly') key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        else if (periodType === 'yearly') key = `${d.getFullYear()}`;
        else key = d.toISOString().split('T')[0];
        if (!byDate[key]) byDate[key] = { date: d, totalRevenue: 0, totalOrders: 0, totalQuantity: 0, totalCustomers: new Set() };
        byDate[key].totalRevenue += Number(s.total ?? 0);
        byDate[key].totalOrders += 1;
        const items = typeof s.items === 'string' ? JSON.parse(s.items) : (s.items || []);
        for (const it of items) byDate[key].totalQuantity += Number(it.quantity ?? 0);
        if (s.customer_id || s.customer) byDate[key].totalCustomers.add(String(s.customer_id || s.customer));
      }
      const timeSeriesData = Object.entries(byDate).map(([_, v]) => ({
        date: v.date,
        totalRevenue: v.totalRevenue,
        totalOrders: v.totalOrders,
        totalQuantity: v.totalQuantity,
        averageOrderValue: v.totalOrders ? v.totalRevenue / v.totalOrders : 0,
        newCustomers: v.totalCustomers.size,
        returningCustomers: v.totalCustomers.size
      })).sort((a, b) => new Date(a.date) - new Date(b.date));

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

    } catch (error) {
      console.error('Error generating time series data:', error);
      throw error;
    }
  }

  async generateInsights(report) {
    try {
      report.insights = report.insights || [];
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

  async getProductPerformanceForPeriod(startDate, endDate, productIds) {
    const list = await getSalesProductPerformance(startDate, endDate, 10000);
    if (!productIds || productIds.length === 0) return list;
    const set = new Set(productIds.map(id => String(id)));
    return list.filter(p => set.has(String(p._id)));
  }

  async getCustomerPerformanceForPeriod(startDate, endDate, customerIds) {
    const sales = await SalesRepository.findAll({ dateFrom: startDate, dateTo: endDate, status: 'completed' }, { limit: 5000 });
    const byCustomer = {};
    for (const sale of sales) {
      const cid = (sale.customer_id || sale.customer)?.toString?.();
      if (!cid || (customerIds && customerIds.length && !customerIds.map(String).includes(cid))) continue;
      if (!byCustomer[cid]) byCustomer[cid] = { _id: cid, totalRevenue: 0, totalOrders: 0, totalProfit: 0 };
      const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
      let orderRev = 0, orderCost = 0;
      for (const it of items) {
        orderRev += Number(it.unit_price ?? it.unitPrice ?? 0) * Number(it.quantity ?? 0);
        orderCost += Number(it.unit_cost ?? it.cost ?? 0) * Number(it.quantity ?? 0);
      }
      byCustomer[cid].totalRevenue += orderRev;
      byCustomer[cid].totalOrders += 1;
      byCustomer[cid].totalProfit += orderRev - orderCost;
    }
    return Object.values(byCustomer);
  }

  async getSalesRepPerformanceForPeriod(startDate, endDate, salesRepIds) {
    const sales = await SalesRepository.findAll({ dateFrom: startDate, dateTo: endDate, status: 'completed' }, { limit: 5000 });
    const byRep = {};
    for (const sale of sales) {
      const rid = (sale.created_by || sale.sales_rep || sale.salesRep)?.toString?.();
      if (!rid || (salesRepIds && salesRepIds.length && !salesRepIds.map(String).includes(rid))) continue;
      if (!byRep[rid]) byRep[rid] = { _id: rid, totalRevenue: 0, totalOrders: 0 };
      byRep[rid].totalRevenue += Number(sale?.total ?? 0);
      byRep[rid].totalOrders += 1;
    }
    return Object.values(byRep);
  }

  async getCategoryPerformanceForPeriod(startDate, endDate, categoryIds) {
    const list = await getSalesProductPerformance(startDate, endDate, 10000);
    const products = await ProductRepository.findAll({}, { limit: 5000 });
    const productToCategory = {};
    for (const p of products) productToCategory[String(p.id || p._id)] = p.category_id || p.category;
    const byCategory = {};
    for (const row of list) {
      const catId = productToCategory[String(row._id)]?.toString?.();
      if (!catId || (categoryIds && categoryIds.length && !categoryIds.map(String).includes(catId))) continue;
      if (!byCategory[catId]) byCategory[catId] = { _id: catId, totalRevenue: 0 };
      byCategory[catId].totalRevenue += row.totalRevenue || 0;
    }
    return Object.values(byCategory);
  }

  async calculateTotalProfit(startDate, endDate) {
    const sales = await SalesRepository.findAll({ dateFrom: startDate, dateTo: endDate, status: 'completed' }, { limit: 5000 });
    let totalRevenue = 0, totalCost = 0;
    for (const sale of sales) {
      const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
      for (const it of items) {
        totalRevenue += Number(it.unit_price ?? it.unitPrice ?? 0) * Number(it.quantity ?? 0);
        totalCost += Number(it.unitCost ?? it.cost ?? it.unit_cost ?? it.cost_price ?? it.costPrice ?? 0) * Number(it.quantity ?? 0);
      }
    }
    return { totalProfit: totalRevenue - totalCost, averageMargin: totalRevenue ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0 };
  }

  async getTotalQuantity(startDate, endDate) {
    const sales = await SalesRepository.findAll({ dateFrom: startDate, dateTo: endDate, status: 'completed' }, { limit: 5000 });
    let total = 0;
    for (const sale of sales) {
      const items = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
      for (const it of items) total += Number(it.quantity ?? 0);
    }
    return total;
  }

  async getNewCustomersCount(startDate, endDate) {
    const customers = await CustomerRepository.findAll({}, { limit: 10000 });
    let count = 0;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    for (const c of customers) {
      const t = new Date(c.created_at || c.createdAt || 0).getTime();
      if (t >= start && t <= end) count++;
    }
    return count;
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
      const repoFilters = {};
      if (reportType) repoFilters.reportType = reportType;
      if (startDate) repoFilters.dateFrom = startDate;
      if (endDate) repoFilters.dateTo = endDate;
      const total = await SalesPerformanceRepository.count(repoFilters);
      const reports = await SalesPerformanceRepository.findAll(repoFilters, { limit, offset: skip });

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
      const report = await SalesPerformanceRepository.findOne({ reportId });
      if (!report) throw new Error('Sales performance report not found');
      return report;
    } catch (error) {
      console.error('Error fetching sales performance report:', error);
      throw error;
    }
  }

  // Delete sales performance report
  async deleteSalesPerformanceReport(reportId, deletedBy) {
    try {
      const report = await SalesPerformanceRepository.findOne({ reportId });
      if (!report) throw new Error('Sales performance report not found');
      await SalesPerformanceRepository.deleteByReportId(reportId);
      return { message: 'Sales performance report deleted successfully' };
    } catch (error) {
      console.error('Error deleting sales performance report:', error);
      throw error;
    }
  }
}

module.exports = new SalesPerformanceService();
