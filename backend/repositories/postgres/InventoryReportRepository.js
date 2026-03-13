const { query } = require('../../config/postgres');

class InventoryReportRepository {
  async findById(id) {
    const result = await query('SELECT * FROM inventory_reports WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM inventory_reports WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.reportType) { sql += ` AND report_type = $${paramCount++}`; params.push(filters.reportType); }
    if (filters.dateFrom) { sql += ` AND created_at >= $${paramCount++}`; params.push(filters.dateFrom); }
    if (filters.dateTo) { sql += ` AND created_at <= $${paramCount++}`; params.push(filters.dateTo); }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async count(filters = {}) {
    let sql = 'SELECT COUNT(*)::int AS c FROM inventory_reports WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.reportType) { sql += ` AND report_type = $${paramCount++}`; params.push(filters.reportType); }
    if (filters.dateFrom) { sql += ` AND created_at >= $${paramCount++}`; params.push(filters.dateFrom); }
    if (filters.dateTo) { sql += ` AND created_at <= $${paramCount++}`; params.push(filters.dateTo); }
    const result = await query(sql, params);
    return parseInt(result.rows[0]?.c || 0, 10);
  }

  async findOne(filters = {}) {
    if (filters.reportId) {
      const result = await query('SELECT * FROM inventory_reports WHERE report_id = $1 LIMIT 1', [filters.reportId]);
      return result.rows[0] || null;
    }
    if (filters.id || filters._id) return this.findById(filters.id || filters._id);
    return null;
  }

  async create(data) {
    const result = await query(
      `INSERT INTO inventory_reports (report_id, report_name, report_type, period_type, start_date, end_date, config, stock_levels, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.reportId || data.report_id || `IR-${Date.now()}`,
        data.reportName || data.report_name,
        data.reportType || data.report_type,
        data.periodType || data.period_type,
        data.startDate || data.start_date,
        data.endDate || data.end_date,
        data.config ? JSON.stringify(data.config) : '{}',
        data.stockLevels ? JSON.stringify(data.stockLevels) : '[]'
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    if (data.config !== undefined) { updates.push(`config = $${paramCount++}`); params.push(JSON.stringify(data.config)); }
    if (data.stockLevels !== undefined) { updates.push(`stock_levels = $${paramCount++}`); params.push(JSON.stringify(data.stockLevels)); }
    if (data.status !== undefined) { updates.push(`config = jsonb_set(COALESCE(config, '{}'::jsonb), '{status}', $${paramCount++}::jsonb)`); params.push(JSON.stringify(data.status)); }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(`UPDATE inventory_reports SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, params);
    return result.rows[0] || null;
  }

  async deleteByReportId(reportId) {
    const result = await query('DELETE FROM inventory_reports WHERE report_id = $1 RETURNING id', [reportId]);
    return (result.rowCount || 0) > 0;
  }

  async getReportStats(period = {}) {
    let sql = 'SELECT report_type, period_type, COUNT(*)::int AS cnt FROM inventory_reports WHERE 1=1';
    const params = [];
    let n = 1;
    if (period.startDate && period.endDate) {
      sql += ` AND created_at >= $${n++} AND created_at <= $${n++}`;
      params.push(period.startDate, period.endDate);
    }
    sql += ' GROUP BY report_type, period_type';
    const result = await query(sql, params);
    const typeBreakdown = {};
    const periodBreakdown = {};
    let totalReports = 0;
    result.rows.forEach(r => {
      const c = parseInt(r.cnt, 10) || 0;
      totalReports += c;
      typeBreakdown[r.report_type] = (typeBreakdown[r.report_type] || 0) + c;
      periodBreakdown[r.period_type] = (periodBreakdown[r.period_type] || 0) + c;
    });
    return {
      totalReports,
      completedReports: totalReports,
      totalViews: 0,
      typeBreakdown,
      periodBreakdown
    };
  }
}

module.exports = new InventoryReportRepository();
