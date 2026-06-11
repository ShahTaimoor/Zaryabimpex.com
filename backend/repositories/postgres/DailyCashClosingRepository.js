const { query } = require('../../config/postgres');
const { userDisplayNameSql } = require('../../utils/userDisplaySql');

const CLOSED_BY_NAME = userDisplayNameSql('u');

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

class DailyCashClosingRepository {
  async findByBusinessDate(businessDate, client = null) {
    const rows = await runQuery(
      `SELECT dcc.*, ${CLOSED_BY_NAME} AS closed_by_name
       FROM daily_cash_closings dcc
       LEFT JOIN users u ON u.id = dcc.closed_by
       WHERE dcc.business_date = $1`,
      [businessDate],
      client
    );
    return rows[0] || null;
  }

  async findById(id, client = null) {
    const rows = await runQuery(
      `SELECT dcc.*, ${CLOSED_BY_NAME} AS closed_by_name
       FROM daily_cash_closings dcc
       LEFT JOIN users u ON u.id = dcc.closed_by
       WHERE dcc.id = $1`,
      [id],
      client
    );
    return rows[0] || null;
  }

  async findLatestClosedBefore(businessDate, client = null) {
    const rows = await runQuery(
      `SELECT * FROM daily_cash_closings
       WHERE business_date < $1 AND status = 'closed'
       ORDER BY business_date DESC
       LIMIT 1`,
      [businessDate],
      client
    );
    return rows[0] || null;
  }

  async upsertOpenDay(data, client = null) {
    const sql = `
      INSERT INTO daily_cash_closings (
        business_date, opening_cash, status, created_at, updated_at
      ) VALUES ($1, $2, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (business_date) DO UPDATE SET
        opening_cash = CASE
          WHEN daily_cash_closings.status = 'closed' THEN daily_cash_closings.opening_cash
          ELSE EXCLUDED.opening_cash
        END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const rows = await runQuery(sql, [data.businessDate, data.openingCash ?? 0], client);
    return rows[0];
  }

  async closeDay(id, data, client = null) {
    const sql = `
      UPDATE daily_cash_closings SET
        cash_in = $2,
        cash_out = $3,
        expected_cash = $4,
        actual_cash = $5,
        difference = $6,
        variance_type = $7,
        notes = COALESCE($8, notes),
        closed_by = $9,
        closed_at = COALESCE($10, CURRENT_TIMESTAMP),
        status = 'closed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'open'
      RETURNING *
    `;
    const rows = await runQuery(sql, [
      id,
      data.cashIn,
      data.cashOut,
      data.expectedCash,
      data.actualCash,
      data.difference,
      data.varianceType,
      data.notes || '',
      data.closedBy,
      data.closedAt || null,
    ], client);
    return rows[0] || null;
  }

  async findForReport({ fromDate, toDate, status, varianceType, limit = 100, offset = 0 } = {}) {
    let sql = `
      SELECT dcc.*, ${CLOSED_BY_NAME} AS closed_by_name
      FROM daily_cash_closings dcc
      LEFT JOIN users u ON u.id = dcc.closed_by
      WHERE 1=1
    `;
    const params = [];
    let n = 1;

    if (fromDate) {
      sql += ` AND dcc.business_date >= $${n++}`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND dcc.business_date <= $${n++}`;
      params.push(toDate);
    }
    if (status) {
      sql += ` AND dcc.status = $${n++}`;
      params.push(status);
    }
    if (varianceType) {
      sql += ` AND dcc.variance_type = $${n++}`;
      params.push(varianceType);
    }

    sql += ` ORDER BY dcc.business_date DESC LIMIT $${n++} OFFSET $${n++}`;
    params.push(limit, offset);

    return runQuery(sql, params);
  }

  async getVarianceReport(fromDate, toDate, varianceType = null) {
    let sql = `
      SELECT dcc.*, ${CLOSED_BY_NAME} AS closed_by_name
      FROM daily_cash_closings dcc
      LEFT JOIN users u ON u.id = dcc.closed_by
      WHERE dcc.status = 'closed'
        AND dcc.variance_type IS NOT NULL
        AND dcc.variance_type != 'exact'
    `;
    const params = [];
    let n = 1;

    if (fromDate) {
      sql += ` AND dcc.business_date >= $${n++}`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND dcc.business_date <= $${n++}`;
      params.push(toDate);
    }
    if (varianceType) {
      sql += ` AND dcc.variance_type = $${n++}`;
      params.push(varianceType);
    }

    sql += ' ORDER BY dcc.business_date DESC';
    return runQuery(sql, params);
  }

  async getDashboardStats({ fromDate, toDate } = {}) {
    let sql = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_days,
        COUNT(*) FILTER (WHERE status = 'open')::int AS open_days,
        COALESCE(SUM(cash_in) FILTER (WHERE status = 'closed'), 0) AS total_cash_in,
        COALESCE(SUM(cash_out) FILTER (WHERE status = 'closed'), 0) AS total_cash_out,
        COALESCE(SUM(ABS(difference)) FILTER (WHERE variance_type IN ('over', 'short')), 0) AS total_variance
      FROM daily_cash_closings
      WHERE 1=1
    `;
    const params = [];
    let n = 1;

    if (fromDate) {
      sql += ` AND business_date >= $${n++}`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND business_date <= $${n++}`;
      params.push(toDate);
    }

    const rows = await runQuery(sql, params);
    return rows[0] || {};
  }
}

module.exports = new DailyCashClosingRepository();
