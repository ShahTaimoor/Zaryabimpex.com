const { query } = require('../../config/postgres');

function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    statementId: row.statement_id,
    statementType: row.statement_type,
    exportedBy: row.exported_by,
    exportedAt: row.exported_at,
    format: row.format,
    fileSize: row.file_size,
    fileHash: row.file_hash,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at
  };
}

class FinancialStatementExportRepository {
  async create(data) {
    const result = await query(
      `INSERT INTO financial_statement_exports (statement_id, statement_type, exported_by, format, file_size, file_hash, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        data.statementId ?? data.statement_id ?? null,
        data.statementType ?? data.statement_type,
        data.exportedBy ?? data.exported_by,
        data.format ?? 'pdf',
        data.fileSize ?? data.file_size ?? null,
        data.fileHash ?? data.file_hash ?? null,
        data.ipAddress ?? data.ip_address ?? null,
        data.userAgent ?? data.user_agent ?? null
      ]
    );
    return toCamel(result.rows[0]);
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM financial_statement_exports WHERE 1=1';
    const params = [];
    let n = 1;
    if (filters.exportedBy != null) {
      sql += ` AND exported_by = $${n++}`;
      params.push(filters.exportedBy);
    }
    if (filters.exportedAtGte != null) {
      sql += ` AND exported_at >= $${n++}`;
      params.push(filters.exportedAtGte);
    }
    if (filters.exportedAtLte != null) {
      sql += ` AND exported_at <= $${n++}`;
      params.push(filters.exportedAtLte);
    }
    sql += ' ORDER BY exported_at DESC';
    if (options.limit) { sql += ` LIMIT $${n++}`; params.push(options.limit); }
    const result = await query(sql, params);
    return result.rows.map(toCamel);
  }
}

module.exports = new FinancialStatementExportRepository();
