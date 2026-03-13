const { query } = require('../../config/postgres');

// Coerce values for numeric columns so we never send "" to Postgres (invalid input syntax for type numeric)
function toNumericOptional(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function toNumericDefault(v, def = 0) {
  if (v === '' || v === undefined || v === null) return def;
  const n = Number(v);
  return Number.isNaN(n) ? def : n;
}

class DiscountRepository {
  async findById(id) {
    const result = await query('SELECT * FROM discounts WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM discounts WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async findOne(filters = {}) {
    if (filters.code) {
      const result = await query('SELECT * FROM discounts WHERE code = $1 LIMIT 1', [(filters.code || '').toUpperCase()]);
      return result.rows[0] || null;
    }
    if (filters.id || filters._id) return this.findById(filters.id || filters._id);
    return null;
  }

  async findByCode(code) {
    return this.findOne({ code: (code || '').toUpperCase() });
  }

  async codeExists(code, excludeId = null) {
    const c = (code || '').toUpperCase();
    if (!c) return false;
    let sql = 'SELECT 1 FROM discounts WHERE code = $1';
    const params = [c];
    if (excludeId) { sql += ' AND id != $2'; params.push(excludeId); }
    const result = await query(sql + ' LIMIT 1', params);
    return result.rows.length > 0;
  }

  async getDiscountStats(period = {}) {
    let sql = 'SELECT COUNT(*)::int AS total, COALESCE(SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END), 0)::int AS active FROM discounts WHERE 1=1';
    const params = [];
    let p = 1;
    if (period.startDate) { sql += ` AND created_at >= $${p++}`; params.push(period.startDate); }
    if (period.endDate) { sql += ` AND created_at <= $${p++}`; params.push(period.endDate); }
    const result = await query(sql, params);
    const row = result.rows[0];

    // Total usage: sum of current_usage across all discounts (optionally filtered by period)
    let usageSql = 'SELECT COALESCE(SUM(current_usage), 0)::int AS total_usage FROM discounts WHERE 1=1';
    const usageParams = [];
    let up = 1;
    if (period.startDate) { usageSql += ` AND created_at >= $${up++}`; usageParams.push(period.startDate); }
    if (period.endDate) { usageSql += ` AND created_at <= $${up++}`; usageParams.push(period.endDate); }
    const usageResult = await query(usageSql, usageParams);
    const totalUsage = parseInt(usageResult.rows[0]?.total_usage || 0, 10);

    // Total customer savings: sum of discount amounts from sales (optionally filtered by period)
    let salesSql = 'SELECT COALESCE(SUM(discount), 0)::decimal AS total_discount FROM sales WHERE deleted_at IS NULL AND (discount IS NOT NULL AND discount > 0)';
    const salesParams = [];
    let sp = 1;
    if (period.startDate) { salesSql += ` AND created_at >= $${sp++}`; salesParams.push(period.startDate); }
    if (period.endDate) { salesSql += ` AND created_at <= $${sp++}`; salesParams.push(period.endDate); }
    const salesResult = await query(salesSql, salesParams);
    const totalDiscountAmount = parseFloat(salesResult.rows[0]?.total_discount || 0, 10);

    return {
      total: parseInt(row?.total || 0, 10),
      active: parseInt(row?.active || 0, 10),
      byStatus: { active: parseInt(row?.active || 0, 10), inactive: Math.max(0, parseInt(row?.total || 0, 10) - parseInt(row?.active || 0, 10)) },
      totalUsage,
      totalDiscountAmount,
    };
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    let countSql = 'SELECT COUNT(*) FROM discounts WHERE 1=1';
    const countParams = [];
    if (filter.isActive !== undefined) { countSql += ' AND is_active = $1'; countParams.push(filter.isActive); }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);
    const discounts = await this.findAll(filter, { limit, offset });
    return { discounts, total, pagination: { page, limit, pages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 } };
  }

  async create(data) {
    const result = await query(
      `INSERT INTO discounts (name, description, code, type, value, maximum_discount, minimum_order_amount, applicable_to, valid_from, valid_until, is_active, created_by, conditions, analytics, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.name, data.description || null, (data.code || '').toUpperCase(), data.type, toNumericDefault(data.value),
        toNumericOptional(data.maximumDiscount ?? data.maximum_discount),
        toNumericDefault(data.minimumOrderAmount ?? data.minimum_order_amount, 0),
        data.applicableTo || data.applicable_to || 'all', data.validFrom || data.valid_from, data.validUntil || data.valid_until,
        data.isActive !== false, data.createdBy || data.created_by, data.conditions ? JSON.stringify(data.conditions) : '{}'
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const numericOptional = new Set(['maximum_discount', 'current_usage']);
    const numericDefault = new Set(['minimum_order_amount', 'value']);
    const map = { name: 'name', description: 'description', code: 'code', type: 'type', value: 'value', maximumDiscount: 'maximum_discount', minimumOrderAmount: 'minimum_order_amount', applicableTo: 'applicable_to', validFrom: 'valid_from', validUntil: 'valid_until', isActive: 'is_active', currentUsage: 'current_usage', analytics: 'analytics', lastModifiedBy: 'last_modified_by' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        let val = typeof data[k] === 'object' ? JSON.stringify(data[k]) : (k === 'code' ? (data[k] || '').toUpperCase() : data[k]);
        if (numericOptional.has(col)) val = toNumericOptional(val);
        else if (numericDefault.has(col)) val = toNumericDefault(val);
        params.push(val);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(`UPDATE discounts SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, params);
    return result.rows[0] || null;
  }
}

module.exports = new DiscountRepository();
