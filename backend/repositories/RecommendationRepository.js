const BaseRepository = require('./BaseRepository');
const Recommendation = require('../models/Recommendation');

class RecommendationRepository extends BaseRepository {
  constructor() {
    super(Recommendation);
  }

  /**
   * Find recommendations with filtering
   * @param {object} filter - Filter query
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findWithFilter(filter = {}, options = {}) {
    const {
      sort = { createdAt: -1 },
      populate = [
        { path: 'recommendations.product' }
      ],
      limit
    } = options;

    let queryBuilder = this.model.find(filter);
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => {
        queryBuilder = queryBuilder.populate(pop);
      });
    }
    
    if (sort) {
      queryBuilder = queryBuilder.sort(sort);
    }
    
    if (limit) {
      queryBuilder = queryBuilder.limit(limit);
    }

    return await queryBuilder;
  }
}

module.exports = new RecommendationRepository();

