const BaseRepository = require('./BaseRepository');
const StockAdjustment = require('../models/StockAdjustment');

class StockAdjustmentRepository extends BaseRepository {
  constructor() {
    super(StockAdjustment);
  }

  /**
   * Find stock adjustments with pagination and filters
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{adjustments: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      populate = [
        { path: 'product', select: 'name description' },
        { path: 'adjustedBy', select: 'firstName lastName email' },
        { path: 'warehouse', select: 'name code' }
      ],
      getAll = false
    } = options;

    const query = { ...filter };

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 0 : limit;

    const [adjustments, total] = await Promise.all([
      this.model.find(query)
        .populate(populate)
        .sort(sort)
        .skip(skip)
        .limit(finalLimit),
      this.model.countDocuments(query)
    ]);

    return {
      adjustments,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Find adjustments by product ID
   * @param {string} productId - Product ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByProductId(productId, options = {}) {
    return this.findAll({ product: productId }, options);
  }

  /**
   * Find adjustments by warehouse
   * @param {string} warehouseId - Warehouse ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByWarehouse(warehouseId, options = {}) {
    return this.findAll({ warehouse: warehouseId }, options);
  }

  /**
   * Approve a stock adjustment (uses model static method)
   * @param {string} adjustmentId - Adjustment ID
   * @param {string} approvedBy - User ID who approved
   * @returns {Promise<object>}
   */
  async approveAdjustment(adjustmentId, approvedBy) {
    return this.model.approveAdjustment(adjustmentId, approvedBy);
  }

  /**
   * Complete a stock adjustment (uses model static method)
   * @param {string} adjustmentId - Adjustment ID
   * @param {string} completedBy - User ID who completed
   * @returns {Promise<object>}
   */
  async completeAdjustment(adjustmentId, completedBy) {
    return this.model.completeAdjustment(adjustmentId, completedBy);
  }
}

module.exports = new StockAdjustmentRepository();

