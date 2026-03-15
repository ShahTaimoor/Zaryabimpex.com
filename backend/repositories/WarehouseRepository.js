const BaseRepository = require('./BaseRepository');
const Warehouse = require('../models/Warehouse');

class WarehouseRepository extends BaseRepository {
  constructor() {
    super(Warehouse);
  }

  /**
   * Find warehouses with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{warehouses: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { isPrimary: -1, name: 1 },
      populate = [],
      getAll = false
    } = options;

    const query = this.hasSoftDelete ? { ...filter, isDeleted: false } : filter;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 0 : limit;

    const [warehouses, total] = await Promise.all([
      this.Model.find(query)
        .populate(populate)
        .sort(sort)
        .skip(skip)
        .limit(finalLimit),
      this.Model.countDocuments(query)
    ]);

    return {
      warehouses,
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
   * Find warehouse by code
   * @param {string} code - Warehouse code
   * @param {object} options - Query options
   * @returns {Promise<Warehouse|null>}
   */
  async findByCode(code, options = {}) {
    const query = this.hasSoftDelete ? { code, isDeleted: false } : { code };
    return this.Model.findOne(query, null, options);
  }

  /**
   * Find primary warehouse
   * @param {object} options - Query options
   * @returns {Promise<Warehouse|null>}
   */
  async findPrimary(options = {}) {
    const query = this.hasSoftDelete ? { isPrimary: true, isDeleted: false } : { isPrimary: true };
    return this.Model.findOne(query, null, options);
  }

  /**
   * Set all warehouses as non-primary
   * @param {object} session - MongoDB session (optional, for transactions)
   * @returns {Promise<object>}
   */
  async unsetAllPrimary(session = null) {
    const options = session ? { session } : {};
    return this.Model.updateMany({}, { $set: { isPrimary: false } }, options);
  }

  /**
   * Check if warehouse code exists
   * @param {string} code - Warehouse code
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

module.exports = new WarehouseRepository();

