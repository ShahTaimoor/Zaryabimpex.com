const BaseRepository = require('./BaseRepository');
const DropShipping = require('../models/DropShipping');

class DropShippingRepository extends BaseRepository {
  constructor() {
    super(DropShipping);
  }

  /**
   * Find drop shipping transactions with pagination and filtering
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{transactions: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      sort = { transactionDate: -1 },
      populate = [
        { path: 'supplier', select: 'companyName contactPerson email phone businessType' },
        { path: 'customer', select: 'displayName firstName lastName email phone businessType' },
        { path: 'items.product', select: 'name description pricing inventory' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'lastModifiedBy', select: 'firstName lastName email' }
      ]
    } = options;

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.model.find(filter)
        .populate(populate)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      this.model.countDocuments(filter)
    ]);

    return {
      transactions,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new DropShippingRepository();

