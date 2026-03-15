const cashReceiptRepository = require('../repositories/postgres/CashReceiptRepository');
const { query } = require('../config/postgres');

/**
 * Cash Receipt Service - PostgreSQL Implementation
 */
class CashReceiptService {
  /**
   * Get cash receipts with filters
   */
  async getCashReceipts(options = {}) {
    const filter = {};
    
    if (options.fromDate || options.dateFrom) {
      filter.startDate = new Date(options.fromDate || options.dateFrom);
    }
    if (options.toDate || options.dateTo) {
      filter.endDate = new Date(options.toDate || options.dateTo);
    }

    const receipts = await cashReceiptRepository.findAll(filter, {
      limit: options.limit || 50,
      offset: ((options.page || 1) - 1) * (options.limit || 50),
      sort: 'date DESC'
    });

    const countResult = await query('SELECT COUNT(*) FROM cash_receipts WHERE deleted_at IS NULL', []);
    const total = parseInt(countResult.rows[0].count);

    return {
      cashReceipts: receipts,
      pagination: {
        page: options.page || 1,
        limit: options.limit || 50,
        total,
        pages: Math.ceil(total / (options.limit || 50))
      }
    };
  }

  /**
   * Get cash receipt by ID
   */
  async getCashReceiptById(id) {
    return await cashReceiptRepository.findById(id);
  }

  /**
   * Get summary for date range
   */
  async getSummary(fromDate, toDate) {
    const result = await query(
      `SELECT 
        COUNT(*) AS total_receipts,
        COALESCE(SUM(amount), 0) AS total_amount
       FROM cash_receipts
       WHERE deleted_at IS NULL
         AND date >= $1
         AND date <= $2`,
      [fromDate, toDate]
    );

    return result.rows[0] || { total_receipts: 0, total_amount: 0 };
  }

  /**
   * Get customers by IDs
   */
  async getCustomersByIds(customerIds) {
    if (!customerIds || customerIds.length === 0) return [];
    
    const result = await query(
      'SELECT id, name, business_name FROM customers WHERE id = ANY($1) AND is_deleted = FALSE',
      [customerIds]
    );
    
    return result.rows;
  }
}

module.exports = new CashReceiptService();
