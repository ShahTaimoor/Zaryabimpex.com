const BaseRepository = require('./BaseRepository');
const Investor = require('../models/Investor');

class InvestorRepository extends BaseRepository {
  constructor() {
    super(Investor);
  }

  /**
   * Find investors with filtering
   * @param {object} filter - Filter query
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findWithFilters(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, populate = [] } = options;

    let queryBuilder = this.Model.find(filter);
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => queryBuilder = queryBuilder.populate(pop));
    }
    
    if (sort) {
      queryBuilder = queryBuilder.sort(sort);
    }

    return queryBuilder;
  }

  /**
   * Find investor by email
   * @param {string} email - Email address
   * @param {object} options - Query options
   * @returns {Promise<Investor|null>}
   */
  async findByEmail(email, options = {}) {
    return await this.findOne({ email: email.toLowerCase() }, options);
  }

  /**
   * Find investor by name
   * @param {string} name - Investor name
   * @param {object} options - Query options
   * @returns {Promise<Investor|null>}
   */
  async findByName(name, options = {}) {
    return await this.findOne({ name }, options);
  }

  /**
   * Check if email exists
   * @param {string} email - Email address
   * @param {string} excludeId - ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async emailExists(email, excludeId) {
    const query = { email: email.toLowerCase() };
    if (excludeId) query._id = { $ne: excludeId };
    return await this.Model.exists(query);
  }
}

module.exports = new InvestorRepository();

