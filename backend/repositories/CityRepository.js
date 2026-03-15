const BaseRepository = require('./BaseRepository');
const City = require('../models/City');

class CityRepository extends BaseRepository {
  constructor() {
    super(City);
  }

  /**
   * Find city by name
   * @param {string} name - City name
   * @param {object} options - Query options
   * @returns {Promise<City|null>}
   */
  async findByName(name, options = {}) {
    if (!name) return null;
    return await this.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } }, options);
  }

  /**
   * Find cities with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{cities: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      sort = { name: 1 },
      populate = [
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'updatedBy', select: 'firstName lastName' }
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

    const [cities, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      cities,
      total,
      pagination: getAll ? {
        page: 1,
        limit: total,
        total,
        pages: 1
      } : {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Find active cities
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    return await this.findAll({ isActive: true }, {
      ...options,
      sort: { name: 1 },
      select: 'name state country'
    });
  }

  /**
   * Find cities by state
   * @param {string} state - State name
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByState(state, options = {}) {
    return await this.findAll({ state: { $regex: state, $options: 'i' } }, options);
  }

  /**
   * Check if city name exists
   * @param {string} name - City name to check
   * @param {string} excludeId - City ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async nameExists(name, excludeId = null) {
    if (!name) return false;
    const query = { name: { $regex: `^${name.trim()}$`, $options: 'i' } };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const count = await this.Model.countDocuments(query);
    return count > 0;
  }
}

module.exports = new CityRepository();

