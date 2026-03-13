const { query } = require('../../config/postgres');

class ProfitShareRepository {
  async findById(id) {
    const result = await query('SELECT * FROM profit_shares WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM profit_shares WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.orderId) { sql += ` AND order_id = $${paramCount++}`; params.push(filters.orderId); }
    if (filters.productId) { sql += ` AND product_id = $${paramCount++}`; params.push(filters.productId); }
    if (filters.investorId) { sql += ` AND investor_id = $${paramCount++}`; params.push(filters.investorId); }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async findByOrderId(orderId) {
    return this.findAll({ orderId });
  }

  async findByOrder(orderId) {
    return this.findByOrderId(orderId);
  }

  async findByInvestor(investorId) {
    return this.findAll({ investorId });
  }

  async findByDateRange(filters = {}) {
    const { startDate, endDate } = filters;
    if (!startDate || !endDate) return [];
    const result = await query(
      'SELECT * FROM profit_shares WHERE order_date >= $1 AND order_date <= $2 ORDER BY order_date DESC',
      [startDate, endDate]
    );
    return result.rows;
  }

  async deleteByOrderId(orderId) {
    const result = await query('DELETE FROM profit_shares WHERE order_id = $1 RETURNING *', [orderId]);
    return result.rows;
  }

  async create(data) {
    const result = await query(
      `INSERT INTO profit_shares (order_id, order_number, order_date, product_id, product_name, quantity, sale_amount, total_cost, total_profit, investor_share, company_share, investor_share_percentage, company_share_percentage, investor_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.order || data.orderId, data.orderNumber || data.order_number, data.orderDate || data.order_date,
        data.product || data.productId, data.productName || data.product_name, data.quantity,
        data.saleAmount ?? 0, data.totalCost ?? 0, data.totalProfit ?? 0,
        data.investorShare ?? 0, data.companyShare ?? 0, data.investorSharePercentage ?? 30, data.companySharePercentage ?? 70,
        data.investor || data.investorId || null
      ]
    );
    return result.rows[0];
  }
}

module.exports = new ProfitShareRepository();
