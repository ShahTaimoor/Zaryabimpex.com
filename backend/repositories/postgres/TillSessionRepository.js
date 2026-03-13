const { query } = require('../../config/postgres');

class TillSessionRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM till_sessions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM till_sessions WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.userId || filters.user) {
      sql += ` AND user_id = $${paramCount++}`;
      params.push(filters.userId || filters.user);
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';
    if (options.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ` OFFSET $${paramCount++}`;
      params.push(options.offset);
    }

    const result = await query(sql, params);
    return result.rows;
  }

  async findOne(filters = {}) {
    let sql = 'SELECT * FROM till_sessions WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.userId || filters.user) {
      sql += ` AND user_id = $${paramCount++}`;
      params.push(filters.userId || filters.user);
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  async findOpenSessionByUser(userId, options = {}) {
    return this.findOne({ user: userId, userId, status: 'open' });
  }

  async findSessionsByUser(userId, options = {}) {
    const limit = options.limit || 20;
    return this.findAll({ user: userId, userId: userId }, { ...options, limit });
  }

  async create(data) {
    const result = await query(
      `INSERT INTO till_sessions (user_id, store_id, device_id, opened_at, closed_at, opening_amount, closing_declared_amount, expected_amount, variance_amount, variance_type, notes_open, notes_close, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.user || data.userId,
        data.storeId || data.store_id || null,
        data.deviceId || data.device_id || null,
        data.openedAt || data.opened_at || new Date(),
        data.closedAt || data.closed_at || null,
        data.openingAmount ?? data.opening_amount ?? 0,
        data.closingDeclaredAmount ?? data.closing_declared_amount ?? null,
        data.expectedAmount ?? data.expected_amount ?? null,
        data.varianceAmount ?? data.variance_amount ?? null,
        data.varianceType || data.variance_type || 'exact',
        data.notesOpen || data.notes_open || '',
        data.notesClose || data.notes_close || '',
        data.status || 'open'
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      closedAt: 'closed_at', closingDeclaredAmount: 'closing_declared_amount',
      expectedAmount: 'expected_amount', varianceAmount: 'variance_amount',
      varianceType: 'variance_type', notesClose: 'notes_close', status: 'status'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE till_sessions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
}

module.exports = new TillSessionRepository();
