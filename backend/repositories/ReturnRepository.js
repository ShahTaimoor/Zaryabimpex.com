const BaseRepository = require('./BaseRepository');
const Return = require('../models/Return');

class ReturnRepository extends BaseRepository {
  constructor() {
    super(Return);
  }

  /**
   * Find returns with pagination and filtering
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{returns: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { returnDate: -1 },
      populate = [
        { path: 'originalOrder', select: 'orderNumber soNumber invoiceNumber poNumber createdAt orderDate invoiceDate' },
        { path: 'customer', select: 'name businessName email phone firstName lastName' },
        { path: 'supplier', select: 'name businessName email phone companyName contactPerson' },
        { path: 'items.product', select: 'name description' },
        { path: 'requestedBy', select: 'name businessName firstName lastName' },
        { path: 'approvedBy', select: 'name businessName firstName lastName' },
        { path: 'processedBy', select: 'name businessName firstName lastName' }
      ],
      getAll = false
    } = options;

    const query = this.hasSoftDelete ? { ...filter, isDeleted: false } : filter;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 999999 : limit;

    let queryBuilder = this.Model.find(query);
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => queryBuilder = queryBuilder.populate(pop));
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

    const [returns, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(query)
    ]);

    return {
      returns,
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
   * Find return by return number
   * @param {string} returnNumber - Return number
   * @param {object} options - Query options
   * @returns {Promise<Return|null>}
   */
  async findByReturnNumber(returnNumber, options = {}) {
    return await this.findOne({ returnNumber }, options);
  }

  /**
   * Get return statistics
   * @param {object} period - Date range
   * @returns {Promise<object>}
   */
  async getStats(period = {}) {
    const match = {};
    if (period.startDate && period.endDate) {
      match.createdAt = {
        $gte: period.startDate,
        $lte: period.endDate
      };
    }

    const stats = await this.Model.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalReturns: { $sum: 1 },
          totalRefundAmount: { $sum: '$totalRefundAmount' },
          totalRestockingFee: { $sum: '$totalRestockingFee' },
          netRefundAmount: { $sum: '$netRefundAmount' },
          pendingReturns: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          byStatus: { $push: '$status' },
          byType: { $push: '$returnType' }
        }
      }
    ]);

    return stats[0] || {
      totalReturns: 0,
      totalRefundAmount: 0,
      totalRestockingFee: 0,
      netRefundAmount: 0,
      pendingReturns: 0,
      byStatus: {},
      byType: {}
    };
  }

  /**
   * Get return trends over time
   * @param {number} periods - Number of periods
   * @returns {Promise<Array>}
   */
  async getTrends(periods = 12) {
    const trends = await this.Model.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$returnDate' },
            month: { $month: '$returnDate' }
          },
          count: { $sum: 1 },
          totalRefundAmount: { $sum: '$totalRefundAmount' },
          averageRefundAmount: { $avg: '$totalRefundAmount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: periods }
    ]);

    return trends;
  }
}

module.exports = new ReturnRepository();

