const { query } = require('../../config/postgres');

function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class AccountingPeriodRepository {
  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM accounting_periods WHERE 1=1';
    const params = [];
    let n = 1;
    if (filters.status) {
      sql += ` AND status = $${n++}`;
      params.push(filters.status);
    }
    if (filters.statusIn && Array.isArray(filters.statusIn) && filters.statusIn.length) {
      sql += ` AND status = ANY($${n++}::text[])`;
      params.push(filters.statusIn);
    }
    if (filters.periodEndGte != null) {
      sql += ` AND period_end >= $${n++}`;
      params.push(filters.periodEndGte);
    }
    if (filters.periodEndLte != null) {
      sql += ` AND period_end <= $${n++}`;
      params.push(filters.periodEndLte);
    }
    sql += ' ORDER BY period_start DESC';
    if (options.limit) { sql += ` LIMIT $${n++}`; params.push(options.limit); }
    const result = await query(sql, params);
    return result.rows.map(toCamel);
  }

  async findPeriodForDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    const result = await query(
      'SELECT * FROM accounting_periods WHERE $1::date >= period_start AND $1::date <= period_end AND status != $2 LIMIT 1',
      [d.toISOString().slice(0, 10), 'closed']
    );
    return toCamel(result.rows[0] || null);
  }

  async findById(id) {
    const result = await query('SELECT * FROM accounting_periods WHERE id = $1', [id]);
    return toCamel(result.rows[0] || null);
  }

  async create(data) {
    const result = await query(
      `INSERT INTO accounting_periods (period_start, period_end, status, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        data.periodStart ?? data.period_start,
        data.periodEnd ?? data.period_end,
        data.status ?? 'open',
        data.createdBy ?? data.created_by ?? null
      ]
    );
    return toCamel(result.rows[0]);
  }
}

module.exports = new AccountingPeriodRepository();
