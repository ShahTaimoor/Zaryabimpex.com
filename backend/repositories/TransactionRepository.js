const BaseRepository = require('./BaseRepository');
const Transaction = require('../models/Transaction');

class TransactionRepository extends BaseRepository {
  constructor() {
    super(Transaction);
  }

  /**
   * Find transactions with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{transactions: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 100,
      sort = { createdAt: 1 },
      populate = [],
      getAll = false
    } = options;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 999999 : limit;

    let queryBuilder = this.Model.find(filter);
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => {
        queryBuilder = queryBuilder.populate(pop);
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

    const [transactions, total] = await Promise.all([
      queryBuilder.lean(),
      this.Model.countDocuments(filter)
    ]);

    return {
      transactions,
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
   * Find transactions by account code
   * @param {string} accountCode - Account code
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByAccountCode(accountCode, options = {}) {
    return await this.findAll({ accountCode }, options);
  }

  /**
   * Find transactions by date range
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
   * Get transaction summary/aggregation
   * @param {object} filter - Filter query
   * @param {string|object} groupBy - Group by field (string) or fields (object)
   * @returns {Promise<Array>}
   */
  async getSummary(filter = {}, groupBy = '$accountCode') {
    const groupId = typeof groupBy === 'string' ? groupBy : groupBy;
    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: groupId,
          totalDebits: { $sum: { $ifNull: ['$debitAmount', 0] } },
          totalCredits: { $sum: { $ifNull: ['$creditAmount', 0] } },
          count: { $sum: 1 },
          lastActivity: { $max: '$createdAt' }
        }
      }
    ];
    return await this.Model.aggregate(pipeline);
  }
}

module.exports = new TransactionRepository();

