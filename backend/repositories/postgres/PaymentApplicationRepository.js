const { query } = require('../../config/postgres');

function run(q, params, client) {
  return client ? client.query(q, params) : query(q, params);
}

class PaymentApplicationRepository {
  async create(data) {
    const applications = data.applications || [];
    const result = await query(
      `INSERT INTO payment_applications (
        payment_id, customer_id, applications, unapplied_amount, total_payment_amount,
        status, is_reversed, created_by, applied_by, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        data.payment || data.paymentId,
        data.customer || data.customerId,
        JSON.stringify(applications),
        data.unappliedAmount ?? data.unapplied_amount ?? 0,
        data.totalPaymentAmount ?? data.total_payment_amount ?? 0,
        data.status || 'applied',
        data.isReversed === true,
        data.createdBy || data.created_by,
        data.appliedBy || data.applied_by || null,
        data.notes || null
      ]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await query(
      'SELECT * FROM payment_applications WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByPayment(paymentId) {
    const result = await query(
      'SELECT * FROM payment_applications WHERE payment_id = $1 ORDER BY created_at DESC',
      [paymentId]
    );
    return result.rows;
  }

  async findByCustomer(customerId, options = {}) {
    let sql = 'SELECT * FROM payment_applications WHERE customer_id = $1';
    const params = [customerId];
    if (options.status) {
      sql += ' AND status = $2';
      params.push(options.status);
    }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }
    const result = await query(sql, params);
    return result.rows;
  }

  async updateCustomerId(sourceCustomerId, targetCustomerId, client = null) {
    const result = await run(
      'UPDATE payment_applications SET customer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE customer_id = $2 RETURNING id',
      [targetCustomerId, sourceCustomerId],
      client
    );
    return result.rowCount || 0;
  }
}

module.exports = new PaymentApplicationRepository();
