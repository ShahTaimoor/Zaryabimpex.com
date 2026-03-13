const { query } = require('../../config/postgres');

function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    voucherNumber: row.voucher_number,
    status: row.status,
    totalDebit: parseFloat(row.total_debit) || 0,
    totalCredit: parseFloat(row.total_credit) || 0,
    approvalWorkflow: row.approval_workflow || {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class JournalVoucherRepository {
  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM journal_vouchers WHERE 1=1';
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
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${n++}`; params.push(options.limit); }
    if (options.skip != null) { sql += ` OFFSET $${n++}`; params.push(options.skip); }
    const result = await query(sql, params);
    return result.rows.map(toCamel);
  }

  async findById(id) {
    const result = await query('SELECT * FROM journal_vouchers WHERE id = $1', [id]);
    return toCamel(result.rows[0] || null);
  }

  async create(data) {
    const result = await query(
      `INSERT INTO journal_vouchers (voucher_number, status, total_debit, total_credit, approval_workflow, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.voucherNumber ?? data.voucher_number ?? null,
        data.status ?? 'draft',
        data.totalDebit ?? data.total_debit ?? 0,
        data.totalCredit ?? data.total_credit ?? 0,
        data.approvalWorkflow ? JSON.stringify(data.approvalWorkflow) : '{}',
        data.createdBy ?? data.created_by ?? null
      ]
    );
    return toCamel(result.rows[0]);
  }
}

module.exports = new JournalVoucherRepository();
