const BaseRepository = require('./BaseRepository');
const Discount = require('../models/Discount');

class DiscountRepository extends BaseRepository {
  constructor() {
    super(Discount);
  }

  /**
   * Find discounts with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{discounts: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { createdAt: -1 },
      populate = [],
      getAll = false
    } = options;

    const query = this.hasSoftDelete ? { ...filter, isDeleted: false } : filter;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 0 : limit;

    const [discounts, total] = await Promise.all([
      this.Model.find(query)
        .populate(populate)
        .sort(sort)
        .skip(skip)
        .limit(finalLimit),
      this.Model.countDocuments(query)
    ]);

    return {
      discounts,
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
   * Find discount by code
   * @param {string} code - Discount code
   * @param {object} options - Query options
   * @returns {Promise<Discount|null>}
   */
  async findByCode(code, options = {}) {
    const query = this.hasSoftDelete ? { code, isDeleted: false } : { code };
    return this.Model.findOne(query, null, options);
  }

  /**
   * Find active discounts (currently valid)
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    const { select = 'name code type value description validFrom validUntil applicableTo conditions', sort = { priority: -1, createdAt: -1 } } = options;
    
    const query = {
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    };

    if (this.hasSoftDelete) {
      query.isDeleted = false;
    }

    return this.Model.find(query)
      .select(select)
      .sort(sort);
  }

  /**
   * Find discounts by status
   * @param {string} status - Discount status
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByStatus(status, options = {}) {
    const query = this.hasSoftDelete ? { status, isDeleted: false } : { status };
    return this.Model.find(query, null, options);
  }

  /**
   * Find discounts by type
   * @param {string} type - Discount type (percentage, fixed_amount)
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByType(type, options = {}) {
    const query = this.hasSoftDelete ? { type, isDeleted: false } : { type };
    return this.Model.find(query, null, options);
  }

  /**
   * Check if discount code exists
   * @param {string} code - Discount code
   * @param {string} excludeId - ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async codeExists(code, excludeId = null) {
    const query = { code };
    if (excludeId) query._id = { $ne: excludeId };
    if (this.hasSoftDelete) query.isDeleted = false;
    return this.Model.exists(query);
  }
}

module.exports = new DiscountRepository();

