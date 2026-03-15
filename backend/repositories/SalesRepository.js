const BaseRepository = require('./BaseRepository');
const Sales = require('../models/Sales');

class SalesRepository extends BaseRepository {
  constructor() {
    super(Sales);
  }

  /**
   * Find sales by order number
   * @param {string} orderNumber - Order number
   * @param {object} options - Query options
   * @returns {Promise<Sales|null>}
   */
  async findByOrderNumber(orderNumber, options = {}) {
    return await this.findOne({ orderNumber }, options);
  }

  /**
   * Find sales by customer ID
   * @param {string} customerId - Customer ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByCustomer(customerId, options = {}) {
    return await this.findAll({ customer: customerId }, options);
  }

  /**
   * Find sales with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{orders: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      populate = [
        { path: 'customer', select: 'name businessName email phone' },
        { path: 'items.product', select: 'name description pricing' }
      ],
      getAll = false
    } = options;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 999999 : limit;

    const finalQuery = this.Model.schema.paths.isDeleted 
      ? { ...filter, isDeleted: { $ne: true } } 
      : filter;

    let queryBuilder = this.Model.find(finalQuery);
    
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(pop => queryBuilder = queryBuilder.populate(pop));
      } else {
        queryBuilder = queryBuilder.populate(populate);
      }
    }
    
    if (sort) {
      queryBuilder = queryBuilder.sort(sort);
    }
    
    if (skip !== undefined) {
      queryBuilder = queryBuilder.skip(skip);
    }
    
    if (finalLimit > 0) {
      queryBuilder = queryBuilder.limit(finalLimit);
    }

    const [orders, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      orders,
      total,
      pagination: getAll ? {
        current: 1,
        pages: 1,
        total,
        hasNext: false,
        hasPrev: false
      } : {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Find sales by status
   * @param {string} status - Order status
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByStatus(status, options = {}) {
    return await this.findAll({ status }, options);
  }

  /**
   * Find sales by payment status
   * @param {string} paymentStatus - Payment status
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByPaymentStatus(paymentStatus, options = {}) {
    return await this.findAll({ 'payment.status': paymentStatus }, options);
  }

  /**
   * Find sales by order type
   * @param {string} orderType - Order type
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByOrderType(orderType, options = {}) {
    return await this.findAll({ orderType }, options);
  }

  /**
   * Find sales by date range
   * @param {Date} dateFrom - Start date
   * @param {Date} dateTo - End date
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByDateRange(dateFrom, dateTo, options = {}) {
    const filter = {
      createdAt: {
        $gte: dateFrom,
        $lt: dateTo
      }
    };
    return await this.findAll(filter, options);
  }

  /**
   * Find sales by product IDs
   * @param {Array} productIds - Array of product IDs
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByProducts(productIds, options = {}) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return [];
    }
    return await this.findAll({ 'items.product': { $in: productIds } }, options);
  }

  /**
   * Get sales summary/statistics
   * @param {object} filter - Filter query
   * @returns {Promise<object>}
   */
  async getSalesSummary(filter = {}) {
    const pipeline = [
      { $match: { ...filter, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.total' },
          totalItems: { $sum: { $size: '$items' } },
          averageOrderValue: { $avg: '$pricing.total' }
        }
      }
    ];

    const result = await this.aggregate(pipeline);
    return result[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalItems: 0,
      averageOrderValue: 0
    };
  }

  /**
   * Get sales by date grouping
   * @param {Date} dateFrom - Start date
   * @param {Date} dateTo - End date
   * @param {string} groupBy - Group by period ('day', 'week', 'month', 'year')
   * @returns {Promise<Array>}
   */
  async getSalesByDateGroup(dateFrom, dateTo, groupBy = 'day') {
    let dateFormat;
    switch (groupBy) {
      case 'year':
        dateFormat = { $year: '$createdAt' };
        break;
      case 'month':
        dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      case 'week':
        dateFormat = { $dateToString: { format: '%Y-W%V', date: '$createdAt' } };
        break;
      case 'day':
      default:
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    }

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: dateFrom, $lte: dateTo },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: dateFormat,
          totalRevenue: { $sum: '$pricing.total' },
          totalOrders: { $sum: 1 },
          totalItems: { $sum: { $size: '$items' } }
        }
      },
      { $sort: { _id: 1 } }
    ];

    return await this.Model.aggregate(pipeline);
  }

  /**
   * Run aggregation pipeline on sales
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>}
   */
  async aggregate(pipeline) {
    return await this.Model.aggregate(pipeline);
  }
}

module.exports = new SalesRepository();

