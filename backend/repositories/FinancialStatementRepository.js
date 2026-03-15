const BaseRepository = require('./BaseRepository');
const FinancialStatement = require('../models/FinancialStatement');

class FinancialStatementRepository extends BaseRepository {
  constructor() {
    super(FinancialStatement);
  }

  /**
   * Find financial statement by statement ID
   * @param {string} statementId - Statement ID
   * @param {object} options - Query options
   * @returns {Promise<FinancialStatement|null>}
   */
  async findByStatementId(statementId, options = {}) {
    return await this.findOne({ statementId }, options);
  }

  /**
   * Find financial statements by type
   * @param {string} type - Statement type
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByType(type, options = {}) {
    return await this.findAll({ type }, options);
  }

  /**
   * Find financial statements by period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByPeriod(startDate, endDate, options = {}) {
    const filter = {
      'period.startDate': startDate,
      'period.endDate': endDate
    };
    return await this.findAll(filter, options);
  }

  /**
   * Find financial statements with pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{statements: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { 'period.startDate': -1 },
      populate = [],
      getAll = false
    } = options;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 999999 : limit;

    let queryBuilder = this.Model.find(filter);
    
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

    const [statements, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(filter)
    ]);

    return {
      statements,
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
   * Check if statement exists for period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} type - Statement type
   * @returns {Promise<FinancialStatement|null>}
   */
  async findExistingStatement(startDate, endDate, type = 'profit_loss') {
    return await this.findOne({
      type,
      'period.startDate': startDate,
      'period.endDate': endDate
    });
  }

  /**
   * Get latest statement by type and period type
   * @param {string} type - Statement type
   * @param {string} periodType - Period type
   * @returns {Promise<FinancialStatement|null>}
   */
  async getLatestStatement(type, periodType) {
    return await this.Model.getLatestStatement(type, periodType);
  }

  /**
   * Get statement comparison
   * @param {string} statementId - Statement ID
   * @param {string} type - Comparison type
   * @returns {Promise<object>}
   */
  async getStatementComparison(statementId, type) {
    return await this.Model.getStatementComparison(statementId, type);
  }
}

module.exports = new FinancialStatementRepository();

