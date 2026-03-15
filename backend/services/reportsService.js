const salesRepository = require('../repositories/SalesRepository');
const productRepository = require('../repositories/ProductRepository');
const ReturnRepository = require('../repositories/ReturnRepository');

class ReportsService {
  /**
   * Format date based on grouping type
   * @param {Date} date - Date to format
   * @param {string} groupBy - Grouping type (day, week, month, year)
   * @returns {string} - Formatted date string
   */
  formatDate(date, groupBy) {
    switch (groupBy) {
      case 'day':
        return date.toISOString().split('T')[0];
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'year':
        return date.getFullYear().toString();
      default:
        return date.toISOString().split('T')[0];
    }
  }

  /**
   * Get sales report
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getSalesReport(queryParams) {
    const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');
    
    // Use Pakistan timezone for date filtering
    let dateFrom, dateTo;
    if (queryParams.dateFrom) {
      dateFrom = getStartOfDayPakistan(queryParams.dateFrom);
    } else {
      // Default to 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFrom = getStartOfDayPakistan(thirtyDaysAgo.toISOString().split('T')[0]);
    }
    
    if (queryParams.dateTo) {
      dateTo = getEndOfDayPakistan(queryParams.dateTo);
    } else {
      dateTo = getEndOfDayPakistan(new Date().toISOString().split('T')[0]);
    }
    
    const groupBy = queryParams.groupBy || 'day';
    const orderType = queryParams.orderType;

    // Build filter
    const filter = {
      createdAt: { $gte: dateFrom, $lte: dateTo },
      status: { $nin: ['cancelled'] }
    };

    if (orderType) {
      filter.orderType = orderType;
    }

    const orders = await salesRepository.findAll(filter, {
      populate: [{ path: 'items.product', select: 'name description' }],
      sort: { createdAt: 1 }
    });

    // Group data by time period
    const groupedData = {};

    orders.forEach(order => {
      const key = this.formatDate(order.createdAt, groupBy);
      if (!groupedData[key]) {
        groupedData[key] = {
          date: key,
          totalRevenue: 0,
          totalOrders: 0,
          totalItems: 0,
          averageOrderValue: 0
        };
      }

      groupedData[key].totalRevenue += order.pricing.total;
      groupedData[key].totalOrders += 1;
      groupedData[key].totalItems += order.items.reduce((sum, item) => sum + item.quantity, 0);
    });

    // Calculate averages
    Object.values(groupedData).forEach(period => {
      period.averageOrderValue = period.totalOrders > 0 ?
        period.totalRevenue / period.totalOrders : 0;
    });

    // Get sales returns for the same period (using Pakistan timezone dates)
    const salesReturns = await ReturnRepository.findAll({
      origin: 'sales',
      returnDate: { 
        $gte: dateFrom, 
        $lte: dateTo 
      },
      status: { $in: ['completed', 'received', 'approved', 'refunded', 'processing'] }
    }, { lean: true });

    // Calculate total returns amount
    const totalReturns = salesReturns.reduce((sum, ret) => {
      return sum + (ret.netRefundAmount || ret.totalRefundAmount || 0);
    }, 0);

    // Group returns by time period
    const returnsGroupedData = {};
    salesReturns.forEach(returnItem => {
      const returnDate = returnItem.returnDate || returnItem.createdAt;
      const key = this.formatDate(returnDate, groupBy);
      if (!returnsGroupedData[key]) {
        returnsGroupedData[key] = {
          date: key,
          totalReturns: 0,
          returnCount: 0
        };
      }
      const returnAmount = returnItem.netRefundAmount || returnItem.totalRefundAmount || 0;
      returnsGroupedData[key].totalReturns += returnAmount;
      returnsGroupedData[key].returnCount += 1;
    });

    // Merge returns into grouped data and calculate net sales
    Object.keys(groupedData).forEach(key => {
      const returnsForPeriod = returnsGroupedData[key] || { totalReturns: 0, returnCount: 0 };
      groupedData[key].totalReturns = returnsForPeriod.totalReturns;
      groupedData[key].returnCount = returnsForPeriod.returnCount;
      groupedData[key].netRevenue = groupedData[key].totalRevenue - returnsForPeriod.totalReturns;
    });

    // Also add periods that only have returns (no sales)
    Object.keys(returnsGroupedData).forEach(key => {
      if (!groupedData[key]) {
        groupedData[key] = {
          date: key,
          totalRevenue: 0,
          totalOrders: 0,
          totalItems: 0,
          averageOrderValue: 0,
          totalReturns: returnsGroupedData[key].totalReturns,
          returnCount: returnsGroupedData[key].returnCount,
          netRevenue: -returnsGroupedData[key].totalReturns
        };
      }
    });

    const reportData = Object.values(groupedData).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate summary
    const totalRevenue = orders.reduce((sum, order) => sum + order.pricing.total, 0);
    const summary = {
      totalRevenue,
      totalReturns,
      netRevenue: totalRevenue - totalReturns,
      totalOrders: orders.length,
      totalReturnsCount: salesReturns.length,
      totalItems: orders.reduce((sum, order) =>
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
      averageOrderValue: orders.length > 0 ?
        totalRevenue / orders.length : 0,
      dateRange: {
        from: dateFrom,
        to: dateTo
      }
    };

    return {
      summary,
      data: reportData,
      groupBy,
      filters: {
        dateFrom,
        dateTo,
        orderType
      }
    };
  }

  /**
   * Get product performance report
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getProductReport(queryParams) {
    const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');
    
    // Use Pakistan timezone for date filtering
    let dateFrom, dateTo;
    if (queryParams.dateFrom) {
      dateFrom = getStartOfDayPakistan(queryParams.dateFrom);
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFrom = getStartOfDayPakistan(thirtyDaysAgo.toISOString().split('T')[0]);
    }
    
    if (queryParams.dateTo) {
      dateTo = getEndOfDayPakistan(queryParams.dateTo);
    } else {
      dateTo = getEndOfDayPakistan(new Date().toISOString().split('T')[0]);
    }
    
    const limit = parseInt(queryParams.limit) || 20;

    const orders = await salesRepository.findAll({
      createdAt: { $gte: dateFrom, $lte: dateTo },
      status: { $nin: ['cancelled'] }
    }, {
      populate: [{ path: 'items.product', select: 'name description pricing' }],
      sort: { createdAt: 1 }
    });

    // Aggregate product sales
    const productSales = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        if (!item.product) return;
        const productId = item.product._id.toString();
        if (!productSales[productId]) {
          productSales[productId] = {
            product: item.product,
            totalQuantity: 0,
            totalRevenue: 0,
            totalOrders: 0,
            averagePrice: 0
          };
        }

        productSales[productId].totalQuantity += item.quantity;
        productSales[productId].totalRevenue += item.total;
        productSales[productId].totalOrders += 1;
      });
    });

    // Calculate averages and sort
    const productReport = Object.values(productSales)
      .map(item => ({
        ...item,
        averagePrice: item.totalQuantity > 0 ? item.totalRevenue / item.totalQuantity : 0
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return {
      products: productReport,
      dateRange: {
        from: dateFrom,
        to: dateTo
      },
      total: Object.keys(productSales).length
    };
  }

  /**
   * Get customer performance report
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getCustomerReport(queryParams) {
    const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');
    
    // Use Pakistan timezone for date filtering
    let dateFrom, dateTo;
    if (queryParams.dateFrom) {
      dateFrom = getStartOfDayPakistan(queryParams.dateFrom);
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFrom = getStartOfDayPakistan(thirtyDaysAgo.toISOString().split('T')[0]);
    }
    
    if (queryParams.dateTo) {
      dateTo = getEndOfDayPakistan(queryParams.dateTo);
    } else {
      dateTo = getEndOfDayPakistan(new Date().toISOString().split('T')[0]);
    }
    
    const limit = parseInt(queryParams.limit) || 20;
    const businessType = queryParams.businessType;

    const filter = {
      createdAt: { $gte: dateFrom, $lte: dateTo },
      status: { $nin: ['cancelled'] },
      customer: { $exists: true, $ne: null }
    };

    const orders = await salesRepository.findAll(filter, {
      populate: [{ path: 'customer', select: 'firstName lastName businessName businessType customerTier' }],
      sort: { createdAt: 1 }
    });

    // Aggregate customer sales
    const customerSales = {};

    orders.forEach(order => {
      if (!order.customer) return;

      const customerId = order.customer._id.toString();
      if (!customerSales[customerId]) {
        customerSales[customerId] = {
          customer: order.customer,
          totalOrders: 0,
          totalRevenue: 0,
          totalItems: 0,
          averageOrderValue: 0,
          lastOrderDate: null
        };
      }

      customerSales[customerId].totalOrders += 1;
      customerSales[customerId].totalRevenue += order.pricing.total;
      customerSales[customerId].totalItems += order.items.reduce((sum, item) => sum + item.quantity, 0);

      if (!customerSales[customerId].lastOrderDate || order.createdAt > customerSales[customerId].lastOrderDate) {
        customerSales[customerId].lastOrderDate = order.createdAt;
      }
    });

    // Filter by business type if specified
    let filteredCustomers = Object.values(customerSales);
    if (businessType) {
      filteredCustomers = filteredCustomers.filter(item =>
        item.customer.businessType === businessType
      );
    }

    // Calculate averages and sort
    const customerReport = filteredCustomers
      .map(item => ({
        ...item,
        averageOrderValue: item.totalOrders > 0 ? item.totalRevenue / item.totalOrders : 0
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return {
      customers: customerReport,
      dateRange: {
        from: dateFrom,
        to: dateTo
      },
      total: filteredCustomers.length,
      filters: {
        businessType
      }
    };
  }

  /**
   * Get inventory report
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getInventoryReport(queryParams) {
    const filter = { status: 'active' };

    if (queryParams.lowStock === 'true') {
      filter.$expr = {
        $lte: ['$inventory.currentStock', '$inventory.reorderPoint']
      };
    }

    if (queryParams.category) {
      filter.category = queryParams.category;
    }

    const products = await productRepository.findAll(filter, {
      populate: [{ path: 'category', select: 'name' }],
      select: 'name description inventory pricing category',
      sort: { 'inventory.currentStock': 1 }
    });

    const summary = {
      totalProducts: products.length,
      totalValue: products.reduce((sum, product) =>
        sum + (product.inventory.currentStock * product.pricing.cost), 0),
      lowStockItems: products.filter(p => {
        // Check if product has isLowStock method, otherwise calculate manually
        if (typeof p.isLowStock === 'function') {
          return p.isLowStock();
        }
        return p.inventory.currentStock <= p.inventory.reorderPoint;
      }).length,
      outOfStockItems: products.filter(p => p.inventory.currentStock === 0).length,
      highValueItems: products.filter(p =>
        (p.inventory.currentStock * p.pricing.cost) > 1000
      ).length
    };

    return {
      products,
      summary,
      filters: {
        lowStock: queryParams.lowStock,
        category: queryParams.category
      }
    };
  }
}

module.exports = new ReportsService();

