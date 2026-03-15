const BaseRepository = require('./BaseRepository');
const BalanceSheet = require('../models/BalanceSheet');

class BalanceSheetRepository extends BaseRepository {
  constructor() {
    super(BalanceSheet);
  }

  /**
   * Find balance sheet by statement number
   * @param {string} statementNumber - Statement number
   * @param {object} options - Query options
   * @returns {Promise<BalanceSheet|null>}
   */
  async findByStatementNumber(statementNumber, options = {}) {
    return await this.findOne({ statementNumber }, options);
  }

  /**
   * Find balance sheets with pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{balanceSheets: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { statementDate: -1 },
      populate = [],
      getAll = false
    } = options;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 999999 : limit;

    // Exclude soft-deleted so deleted balance sheets don't show in list
    const listFilter = { ...filter, isDeleted: { $ne: true } };
    let queryBuilder = this.Model.find(listFilter);
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => queryBuilder = queryBuilder.populate(pop));
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

    const [balanceSheets, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(listFilter)
    ]);

    return {
      balanceSheets,
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
   * Find balance sheet by period type (latest)
   * @param {string} periodType - Period type
   * @param {object} options - Query options
   * @returns {Promise<BalanceSheet|null>}
   */
  async findLatestByPeriodType(periodType, options = {}) {
    return await this.findOne({ periodType }, {
      ...options,
      sort: { statementDate: -1 }
    });
  }
}

module.exports = new BalanceSheetRepository();

