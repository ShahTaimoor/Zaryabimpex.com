const { query } = require('../../config/postgres');

class PaymentRepository {
  async findById(id) {
    const result = await query('SELECT * FROM payments WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM payments WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.orderId) { sql += ` AND order_id = $${paramCount++}`; params.push(filters.orderId); }
    if (filters.status) { sql += ` AND status = $${paramCount++}`; params.push(filters.status); }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async findByOrderId(orderId, options = {}) {
    return this.findAll({ orderId }, { ...options, sort: 'created_at DESC' });
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    let countSql = 'SELECT COUNT(*) FROM payments WHERE 1=1';
    const countParams = [];
    let p = 1;
    if (filter.orderId) { countSql += ` AND order_id = $${p++}`; countParams.push(filter.orderId); }
    if (filter.status) { countSql += ` AND status = $${p++}`; countParams.push(filter.status); }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);
    const payments = await this.findAll(filter, { limit, offset });
    return { payments, total, pagination: { page, limit, pages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 } };
  }

  async create(data) {
    const result = await query(
      `INSERT INTO payments (payment_id, order_id, payment_method, amount, currency, status, transaction_id, gateway, processing, refunds, fees, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.paymentId || data.payment_id || `PAY-${Date.now()}`,
        data.orderId || data.order_id,
        data.paymentMethod || data.payment_method,
        data.amount,
        (data.currency || 'USD').toUpperCase(),
        data.status || 'pending',
        data.transactionId || data.transaction_id || null,
        data.gateway ? JSON.stringify(data.gateway) : '{}',
        data.processing ? JSON.stringify(data.processing) : '{}',
        data.refunds ? JSON.stringify(data.refunds) : '[]',
        data.fees ? JSON.stringify(data.fees) : '{}',
        data.metadata ? JSON.stringify(data.metadata) : '{}'
      ]
    );
    return result.rows[0];
  }

  async calculateTotalPaid(orderId) {
    const result = await query(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE order_id = $1 AND status = $2',
      [orderId, 'completed']
    );
    return parseFloat(result.rows[0]?.total || 0, 10);
  }

  async getPaymentStats(startDate, endDate) {
    let sql = 'SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM payments WHERE 1=1';
    const params = [];
    let p = 1;
    if (startDate) { sql += ` AND created_at >= $${p++}`; params.push(startDate); }
    if (endDate) { sql += ` AND created_at <= $${p++}`; params.push(endDate); }
    sql += ' GROUP BY status';
    const result = await query(sql, params);
    const byStatus = {};
    let totalAmount = 0;
    let totalCount = 0;
    for (const row of result.rows) {
      byStatus[row.status] = { count: parseInt(row.count, 10), total: parseFloat(row.total, 10) };
      totalAmount += parseFloat(row.total, 10);
      totalCount += parseInt(row.count, 10);
    }
    return { totalTransactions: totalCount, totalAmount, byStatus };
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = { status: 'status', refunds: 'refunds', processing: 'processing' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(`UPDATE payments SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, params);
    return result.rows[0] || null;
  }
}

module.exports = new PaymentRepository();
