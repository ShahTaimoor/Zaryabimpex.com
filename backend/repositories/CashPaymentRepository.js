const BaseRepository = require('./BaseRepository');
const CashPayment = require('../models/CashPayment');

class CashPaymentRepository extends BaseRepository {
  constructor() {
    super(CashPayment);
  }

  /**
   * Find cash payments by date range
   * @param {Date} dateFrom - Start date
   * @param {Date} dateTo - End date
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByDateRange(dateFrom, dateTo, options = {}) {
    const filter = {
      createdAt: {
        $gte: dateFrom,
        $lte: dateTo
      }
    };
    return await this.findAll(filter, options);
  }

  /**
   * Find cash payments with pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{cashPayments: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      sort = { date: -1, createdAt: -1 },
      populate = [
        { path: 'order', model: 'Sales', select: 'orderNumber' },
        { path: 'supplier', select: 'name businessName' },
        { path: 'customer', select: 'name businessName' },
        { path: 'createdBy', select: 'firstName lastName' }
      ],
      getAll = false
    } = options;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 999999 : limit;

    const finalQuery = this.Model.schema.paths.isDeleted 
      ? { ...filter, isDeleted: { $ne: true } } 
      : filter;

    let queryBuilder = this.Model.find(finalQuery);
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => {
        if (pop.model) {
          queryBuilder = queryBuilder.populate({ path: pop.path, model: pop.model, select: pop.select });
        } else {
          queryBuilder = queryBuilder.populate(pop);
        }
      });
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

    const [cashPayments, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      cashPayments,
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
   * Get cash payment summary/aggregation
   * @param {object} filter - Filter query
   * @returns {Promise<Array>}
   */
  async getSummary(filter = {}) {
    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          averageAmount: { $avg: '$amount' },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' }
        }
      }
    ];
    return await this.Model.aggregate(pipeline);
  }
}

module.exports = new CashPaymentRepository();

