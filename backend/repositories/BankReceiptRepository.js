const BaseRepository = require('./BaseRepository');
const BankReceipt = require('../models/BankReceipt');

class BankReceiptRepository extends BaseRepository {
  constructor() {
    super(BankReceipt);
  }

  /**
   * Find bank receipts with pagination and filtering
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{bankReceipts: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      sort = { date: -1, createdAt: -1 },
      populate = [
        { path: 'bank', select: 'accountName accountNumber bankName' },
        { path: 'order', model: 'Sales', select: 'orderNumber' },
        { path: 'customer', select: 'name businessName' },
        { path: 'supplier', select: 'name businessName' },
        { path: 'createdBy', select: 'firstName lastName' }
      ],
      getAll = false
    } = options;

    const query = this.hasSoftDelete ? { ...filter, isDeleted: false } : filter;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 999999 : limit;

    let queryBuilder = this.Model.find(query);
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => {
        if (pop.model) {
          queryBuilder = queryBuilder.populate({ path: pop.path, model: pop.model, select: pop.select });
        } else {
          queryBuilder = queryBuilder.populate(pop);
        }
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

    const [bankReceipts, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(query)
    ]);

    return {
      bankReceipts,
      total,
      pagination: getAll ? {
        currentPage: 1,
        totalPages: 1,
        totalItems: total,
        itemsPerPage: total
      } : {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    };
  }

  /**
   * Get bank receipt summary by date range
   * @param {Date} fromDate - Start date
   * @param {Date} toDate - End date
   * @returns {Promise<object>}
   */
  async getSummary(fromDate, toDate) {
    const match = {
      date: {
        $gte: fromDate,
        $lt: toDate
      }
    };

    const summary = await this.Model.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalReceipts: { $sum: 1 },
          averageAmount: { $avg: '$amount' },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' }
        }
      }
    ]);

    return summary[0] || {
      totalAmount: 0,
      totalReceipts: 0,
      averageAmount: 0,
      minAmount: 0,
      maxAmount: 0
    };
  }
}

module.exports = new BankReceiptRepository();

