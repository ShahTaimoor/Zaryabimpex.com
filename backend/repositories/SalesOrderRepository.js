const BaseRepository = require('./BaseRepository');
const SalesOrder = require('../models/SalesOrder');

class SalesOrderRepository extends BaseRepository {
  constructor() {
    super(SalesOrder);
  }

  /**
   * Find sales order by SO number
   * @param {string} soNumber - SO number
   * @param {object} options - Query options
   * @returns {Promise<SalesOrder|null>}
   */
  async findBySONumber(soNumber, options = {}) {
    return await this.findOne({ soNumber: soNumber.toUpperCase() }, options);
  }

  /**
   * Find sales orders by customer ID
   * @param {string} customerId - Customer ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByCustomer(customerId, options = {}) {
    return await this.findAll({ customer: customerId }, options);
  }

  /**
   * Find sales orders with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{salesOrders: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      populate = [
        { path: 'customer', select: 'businessName name firstName lastName email phone businessType customerTier paymentTerms currentBalance pendingBalance' },
        { path: 'items.product', select: 'name description pricing inventory' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'lastModifiedBy', select: 'firstName lastName email' }
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

    const [salesOrders, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      salesOrders,
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
   * Find sales orders by date range
   * @param {Date} dateFrom - Start date
   * @param {Date} dateTo - End date
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByDateRange(dateFrom, dateTo, options = {}) {
    const filter = {
      createdAt: { $gte: dateFrom, $lt: dateTo }
    };
    return await this.findAll(filter, options);
  }
}

module.exports = new SalesOrderRepository();

