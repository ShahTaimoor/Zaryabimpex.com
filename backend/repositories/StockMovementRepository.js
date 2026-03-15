const BaseRepository = require('./BaseRepository');
const StockMovement = require('../models/StockMovement');

class StockMovementRepository extends BaseRepository {
  constructor() {
    super(StockMovement);
  }

  /**
   * Find stock movements with pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{movements: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      populate = [
        { path: 'product', select: 'name sku barcode inventory' },
        { path: 'createdBy', select: 'firstName lastName email' }
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

    const [movements, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      movements,
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
   * Find stock movements by product ID
   * @param {string} productId - Product ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByProduct(productId, options = {}) {
    return await this.findAll({ product: productId }, options);
  }

  /**
   * Find stock movements by movement type
   * @param {string} movementType - Movement type
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByMovementType(movementType, options = {}) {
    return await this.findAll({ movementType }, options);
  }

  /**
   * Run aggregation pipeline on stock movements
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>}
   */
  async aggregate(pipeline) {
    return await this.Model.aggregate(pipeline);
  }
}

module.exports = new StockMovementRepository();

