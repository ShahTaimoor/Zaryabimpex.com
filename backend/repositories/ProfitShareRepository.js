const BaseRepository = require('./BaseRepository');
const ProfitShare = require('../models/ProfitShare');

class ProfitShareRepository extends BaseRepository {
  constructor() {
    super(ProfitShare);
  }

  /**
   * Find profit shares by order ID
   * @param {string} orderId - Order ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByOrder(orderId, options = {}) {
    const { populate = [
      { path: 'product', select: 'name' },
      { path: 'investor', select: 'name email' },
      { path: 'investors.investor', select: 'name email' }
    ], sort = { createdAt: -1 } } = options;
    
    return await this.findAll({ order: orderId }, { populate, sort });
  }

  /**
   * Find profit shares by investor ID
   * @param {string} investorId - Investor ID
   * @param {object} options - Query options with optional startDate and endDate
   * @returns {Promise<Array>}
   */
  async findByInvestor(investorId, options = {}) {
    const { 
      startDate, 
      endDate,
      populate = [
        { path: 'order', select: 'orderNumber' },
        { path: 'product', select: 'name' },
        { path: 'investor', select: 'name email' }
      ],
      sort = { orderDate: -1 }
    } = options;

    const query = { 
      $or: [
        { investor: investorId },
        { 'investors.investor': investorId }
      ]
    };

    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate);
      if (endDate) query.orderDate.$lte = new Date(endDate);
    }

    return await this.findAll(query, { populate, sort });
  }

  /**
   * Find profit shares by date range
   * @param {object} options - Query options with startDate and endDate
   * @returns {Promise<Array>}
   */
  async findByDateRange(options = {}) {
    const { startDate, endDate, ...otherOptions } = options;
    
    const query = {};
    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate);
      if (endDate) query.orderDate.$lte = new Date(endDate);
    }

    return await this.findAll(query, otherOptions);
  }
}

module.exports = new ProfitShareRepository();

