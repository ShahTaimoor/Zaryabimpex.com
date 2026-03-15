const BaseRepository = require('./BaseRepository');
const JournalVoucher = require('../models/JournalVoucher');

class JournalVoucherRepository extends BaseRepository {
  constructor() {
    super(JournalVoucher);
  }

  /**
   * Find journal vouchers with pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{vouchers: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { voucherDate: -1, createdAt: -1 },
      populate = [
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'approvedBy', select: 'firstName lastName email' }
      ],
      getAll = false,
      lean = false
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

    if (lean) {
      queryBuilder = queryBuilder.lean();
    }

    const [vouchers, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      vouchers,
      total,
      pagination: getAll ? {
        currentPage: 1,
        itemsPerPage: total,
        totalItems: total,
        totalPages: 1
      } : {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 0
      }
    };
  }

  /**
   * Find journal voucher by ID with session support (for transactions)
   * @param {string} id - Journal voucher ID
   * @param {object} options - Query options including session
   * @returns {Promise<JournalVoucher|null>}
   */
  async findByIdWithSession(id, options = {}) {
    const { session, populate } = options;
    let queryBuilder = this.Model.findById(id);
    
    if (session) {
      queryBuilder = queryBuilder.session(session);
    }
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => {
        queryBuilder = queryBuilder.populate(pop);
      });
    }
    
    return await queryBuilder;
  }
}

module.exports = new JournalVoucherRepository();

