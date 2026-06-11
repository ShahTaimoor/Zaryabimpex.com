const { query } = require('../../config/postgres');
const { userDisplayNameSql } = require('../../utils/userDisplaySql');

const CASHIER_NAME = userDisplayNameSql('u');
const OPENED_BY_NAME = userDisplayNameSql('ob');
const CLOSED_BY_NAME = userDisplayNameSql('cb');

function getClient(client) {
  return client && typeof client.query === 'function' ? client : null;
}

async function runQuery(sql, params, client) {
  const c = getClient(client);
  if (c) {
    const result = await c.query(sql, params);
    return result.rows;
  }
  const result = await query(sql, params);
  return result.rows;
}

class TillSessionRepository {
  async findById(id) {
    const result = await query(
      `SELECT ts.*, ${CASHIER_NAME} AS cashier_name, ${OPENED_BY_NAME} AS opened_by_name, ${CLOSED_BY_NAME} AS closed_by_name
       FROM till_sessions ts
       LEFT JOIN users u ON u.id = ts.user_id
       LEFT JOIN users ob ON ob.id = ts.opened_by
       LEFT JOIN users cb ON cb.id = ts.closed_by
       WHERE ts.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = `
      SELECT ts.*, ${CASHIER_NAME} AS cashier_name, ${OPENED_BY_NAME} AS opened_by_name, ${CLOSED_BY_NAME} AS closed_by_name
      FROM till_sessions ts
      LEFT JOIN users u ON u.id = ts.user_id
      LEFT JOIN users ob ON ob.id = ts.opened_by
      LEFT JOIN users cb ON cb.id = ts.closed_by
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.userId || filters.user) {
      sql += ` AND ts.user_id = $${paramCount++}`;
      params.push(filters.userId || filters.user);
    }
    if (filters.status) {
      sql += ` AND ts.status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.fromDate) {
      sql += ` AND ts.opened_at >= $${paramCount++}`;
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      sql += ` AND ts.opened_at <= $${paramCount++}`;
      params.push(filters.toDate);
    }

    sql += ' ORDER BY ts.created_at DESC';
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

  async findOpenSessionByUser(userId) {
    return this.findOne({ user: userId, userId, status: 'open' });
  }

  async findAnyOpenSession(client = null) {
    const sql = `SELECT ts.*, ${CASHIER_NAME} AS cashier_name, ${OPENED_BY_NAME} AS opened_by_name, ${CLOSED_BY_NAME} AS closed_by_name
       FROM till_sessions ts
       LEFT JOIN users u ON u.id = ts.user_id
       LEFT JOIN users ob ON ob.id = ts.opened_by
       LEFT JOIN users cb ON cb.id = ts.closed_by
       WHERE ts.status = 'open'
       ORDER BY ts.opened_at DESC
       LIMIT 1`;
    const rows = await runQuery(sql, [], client);
    return rows[0] || null;
  }

  async findSessionsByUser(userId, options = {}) {
    const limit = options.limit || 20;
    return this.findAll({ user: userId, userId }, { ...options, limit });
  }

  async create(data, client = null) {
    const sql = `
      INSERT INTO till_sessions (
        user_id, opened_by, store_id, device_id, opened_at, closed_at,
        opening_amount, closing_declared_amount, expected_amount,
        variance_amount, variance_type, notes_open, notes_close, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const params = [
      data.user || data.userId,
      data.openedBy || data.opened_by || data.user || data.userId,
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
      data.status || 'open',
    ];
    const rows = await runQuery(sql, params, client);
    return rows[0];
  }

  async updateById(id, data, client = null) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      closedAt: 'closed_at',
      closedBy: 'closed_by',
      closingDeclaredAmount: 'closing_declared_amount',
      expectedAmount: 'expected_amount',
      varianceAmount: 'variance_amount',
      varianceType: 'variance_type',
      notesClose: 'notes_close',
      status: 'status',
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
    const sql = `UPDATE till_sessions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const rows = await runQuery(sql, params, client);
    return rows[0] || null;
  }

  async getDailySummary(fromDate, toDate) {
    const result = await query(
      `SELECT DATE(ts.opened_at) AS session_date,
              COUNT(*) AS session_count,
              COUNT(*) FILTER (WHERE ts.status = 'open') AS open_count,
              COUNT(*) FILTER (WHERE ts.status = 'closed') AS closed_count,
              COALESCE(SUM(ts.opening_amount), 0) AS total_opening,
              COALESCE(SUM(ts.expected_amount), 0) AS total_expected,
              COALESCE(SUM(ts.closing_declared_amount), 0) AS total_actual,
              COALESCE(SUM(ts.variance_amount) FILTER (WHERE ts.variance_type = 'short'), 0) AS total_shortage,
              COALESCE(SUM(ts.variance_amount) FILTER (WHERE ts.variance_type = 'over'), 0) AS total_overage
       FROM till_sessions ts
       WHERE ts.opened_at >= $1 AND ts.opened_at <= $2
       GROUP BY DATE(ts.opened_at)
       ORDER BY session_date DESC`,
      [fromDate, toDate]
    );
    return result.rows;
  }

  async getCashierSummary(fromDate, toDate) {
    const result = await query(
      `SELECT ts.user_id,
              ${CASHIER_NAME} AS cashier_name,
              COUNT(*) AS session_count,
              COALESCE(SUM(ts.opening_amount), 0) AS total_opening,
              COALESCE(SUM(ts.expected_amount), 0) AS total_expected,
              COALESCE(SUM(ts.closing_declared_amount), 0) AS total_actual,
              COALESCE(SUM(ts.variance_amount) FILTER (WHERE ts.variance_type = 'short'), 0) AS total_shortage,
              COALESCE(SUM(ts.variance_amount) FILTER (WHERE ts.variance_type = 'over'), 0) AS total_overage
       FROM till_sessions ts
       LEFT JOIN users u ON u.id = ts.user_id
       WHERE ts.opened_at >= $1 AND ts.opened_at <= $2
       GROUP BY ts.user_id, u.first_name, u.last_name, u.email
       ORDER BY cashier_name NULLS LAST`,
      [fromDate, toDate]
    );
    return result.rows;
  }

  async getVarianceReport(fromDate, toDate, varianceType = null) {
    let sql = `
      SELECT ts.*, ${CASHIER_NAME} AS cashier_name
      FROM till_sessions ts
      LEFT JOIN users u ON u.id = ts.user_id
      WHERE ts.status = 'closed'
        AND ts.opened_at >= $1
        AND ts.opened_at <= $2
        AND ts.variance_type IS NOT NULL
        AND ts.variance_type != 'exact'
    `;
    const params = [fromDate, toDate];
    if (varianceType) {
      sql += ' AND ts.variance_type = $3';
      params.push(varianceType);
    }
    sql += ' ORDER BY ts.closed_at DESC NULLS LAST';
    const result = await query(sql, params);
    return result.rows;
  }

  async getDashboardStats(fromDate = null, toDate = null) {
    let sql = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') AS open_sessions,
        COUNT(*) FILTER (WHERE status = 'closed') AS closed_sessions,
        COUNT(*) AS total_sessions
      FROM till_sessions
      WHERE 1=1
    `;
    const params = [];
    if (fromDate) {
      params.push(fromDate);
      sql += ` AND opened_at >= $${params.length}`;
    }
    if (toDate) {
      params.push(toDate);
      sql += ` AND opened_at <= $${params.length}`;
    }
    const result = await query(sql, params);
    return result.rows[0] || { open_sessions: 0, closed_sessions: 0, total_sessions: 0 };
  }
}

module.exports = new TillSessionRepository();
