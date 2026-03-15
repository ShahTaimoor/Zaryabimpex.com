const BaseRepository = require('./BaseRepository');
const TillSession = require('../models/TillSession');

class TillSessionRepository extends BaseRepository {
  constructor() {
    super(TillSession);
  }

  /**
   * Find open session for a user
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<TillSession|null>}
   */
  async findOpenSessionByUser(userId, options = {}) {
    const query = { user: userId, status: 'open' };
    if (this.hasSoftDelete) query.isDeleted = false;
    return this.model.findOne(query, null, options);
  }

  /**
   * Find sessions by user
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findSessionsByUser(userId, options = {}) {
    const { limit = 20, sort = { createdAt: -1 }, populate = [] } = options;
    const query = this.hasSoftDelete ? { user: userId, isDeleted: false } : { user: userId };
    
    let queryBuilder = this.model.find(query);
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => queryBuilder = queryBuilder.populate(pop));
    }
    
    if (sort) {
      queryBuilder = queryBuilder.sort(sort);
    }
    
    if (limit) {
      queryBuilder = queryBuilder.limit(limit);
    }

    return queryBuilder;
  }
}

module.exports = new TillSessionRepository();

