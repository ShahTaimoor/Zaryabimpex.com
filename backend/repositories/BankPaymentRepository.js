const BaseRepository = require('./BaseRepository');
const BankPayment = require('../models/BankPayment');

class BankPaymentRepository extends BaseRepository {
  constructor() {
    super(BankPayment);
  }

  /**
   * Find bank payments by date range
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
   * Find bank payments with pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{bankPayments: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      sort = { date: -1, createdAt: -1 },
      populate = [
        { path: 'bank', select: 'accountName accountNumber bankName' },
        { path: 'order', model: 'Sales', select: 'orderNumber' },
        { path: 'supplier', select: 'name businessName' },
        { path: 'customer', select: 'name email' },
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'expenseAccount', select: 'accountName accountCode' }
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

    const [bankPayments, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      bankPayments,
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
   * Get bank payment summary/aggregation
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

module.exports = new BankPaymentRepository();

