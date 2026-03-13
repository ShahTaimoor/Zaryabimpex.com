const { query } = require('../../config/postgres');

class RecommendationRepository {
  async findById(id) {
    const result = await query('SELECT * FROM recommendations WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM recommendations WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.sessionId) { sql += ` AND session_id = $${paramCount++}`; params.push(filters.sessionId); }
    if (filters.customerId) { sql += ` AND customer_id = $${paramCount++}`; params.push(filters.customerId); }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    const result = await query(sql, params);
    return result.rows;
  }

  async create(data) {
    const result = await query(
      `INSERT INTO recommendations (user_id, customer_id, session_id, algorithm, context, recommendations, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.user || data.userId || null,
        data.customer || data.customerId || null,
        data.sessionId || data.session_id,
        data.algorithm,
        data.context ? JSON.stringify(data.context) : '{}',
        data.recommendations ? JSON.stringify(data.recommendations) : '[]'
      ]
    );
    return result.rows[0];
  }
}

module.exports = new RecommendationRepository();
