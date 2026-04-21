const { query, transaction } = require('../../config/postgres');

function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    voucherNumber: row.voucher_number,
    voucherDate: row.voucher_date,
    description: row.description,
    totalDebit: parseFloat(row.total_debit) || 0,
    totalCredit: parseFloat(row.total_credit) || 0,
    status: row.status,
    isReversed: row.is_reversed,
    reversedDate: row.reversed_date,
    reversedBy: row.reversed_by,
    reversalOfJvId: row.reversal_of_jv_id,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

function entryCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    journalVoucherId: row.journal_voucher_id,
    lineNumber: row.line_number,
    accountCode: row.account_code,
    accountName: row.account_name,
    particulars: row.particulars,
    debitAmount: parseFloat(row.debit_amount) || 0,
    creditAmount: parseFloat(row.credit_amount) || 0,
    description: row.description,
    customerId: row.customer_id,
    supplierId: row.supplier_id,
    customerName: row.customer_name,
    supplierName: row.supplier_name,
    createdAt: row.created_at
  };
}

class JournalVoucherRepository {
  /**
   * Find all journal vouchers with filtering and pagination
   */
  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM journal_vouchers WHERE deleted_at IS NULL';
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
    if (filters.voucherNumber) {
      sql += ` AND voucher_number ILIKE $${n++}`;
      params.push(`%${filters.voucherNumber}%`);
    }
    if (filters.createdBy) {
      sql += ` AND created_by = $${n++}`;
      params.push(filters.createdBy);
    }
    if (filters.dateFrom) {
      sql += ` AND voucher_date >= $${n++}`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      sql += ` AND voucher_date <= $${n++}`;
      params.push(filters.dateTo);
    }

    sql += ' ORDER BY voucher_date DESC, created_at DESC';
    
    if (options.limit) { 
      sql += ` LIMIT $${n++}`; 
      params.push(options.limit); 
    }
    if (options.skip != null) { 
      sql += ` OFFSET $${n++}`; 
      params.push(options.skip); 
    }

    const result = await query(sql, params);
    return result.rows.map(toCamel);
  }

  /**
   * Get total count with filters
   */
  async count(filters = {}) {
    let sql = 'SELECT COUNT(*) as total FROM journal_vouchers WHERE deleted_at IS NULL';
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
    if (filters.voucherNumber) {
      sql += ` AND voucher_number ILIKE $${n++}`;
      params.push(`%${filters.voucherNumber}%`);
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0]?.total || 0);
  }

  /**
   * Find journal voucher by ID with entries
   */
  async findById(id) {
    const jvResult = await query(
      'SELECT * FROM journal_vouchers WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (!jvResult.rows[0]) return null;

    const jv = toCamel(jvResult.rows[0]);

    // Get entries with party names
    const entriesResult = await query(
      `SELECT e.*, 
              c.name as customer_name,
              COALESCE(s.business_name, s.name) as supplier_name
       FROM journal_voucher_entries e
       LEFT JOIN customers c ON e.customer_id = c.id
       LEFT JOIN suppliers s ON e.supplier_id = s.id
       WHERE e.journal_voucher_id = $1 
       ORDER BY e.line_number`,
      [id]
    );
    jv.entries = entriesResult.rows.map(entryCamel);

    return jv;
  }

  /**
   * Find journal voucher by voucher number
   */
  async findByVoucherNumber(voucherNumber) {
    const result = await query(
      'SELECT * FROM journal_vouchers WHERE voucher_number = $1 AND deleted_at IS NULL',
      [voucherNumber]
    );
    return toCamel(result.rows[0] || null);
  }

  /**
   * Create a new journal voucher with entries
   */
  async create(data, client = null) {
    const executeCreate = async (clientToUse) => {
      // Insert journal voucher header
      const jvResult = await clientToUse.query(
        `INSERT INTO journal_vouchers 
         (voucher_number, voucher_date, description, total_debit, total_credit, status, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          data.voucherNumber || `JV-${Date.now()}`,
          data.voucherDate || new Date().toISOString().split('T')[0],
          data.description || '',
          data.totalDebit || 0,
          data.totalCredit || 0,
          'draft',
          data.notes || '',
          data.createdBy || null
        ]
      );

      const jvId = jvResult.rows[0].id;
      const jv = toCamel(jvResult.rows[0]);

      // Insert entries if provided
      const entries = [];
      if (Array.isArray(data.entries) && data.entries.length > 0) {
        for (let i = 0; i < data.entries.length; i++) {
          const entry = data.entries[i];
          const entryResult = await clientToUse.query(
            `INSERT INTO journal_voucher_entries 
             (journal_voucher_id, line_number, account_code, account_name, particulars, debit_amount, credit_amount, description, customer_id, supplier_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
              jvId,
              i + 1,
              entry.accountCode || entry.account_code,
              entry.accountName || entry.account_name || '',
              entry.particulars || '',
              parseFloat(entry.debitAmount || entry.debit_amount || 0),
              parseFloat(entry.creditAmount || entry.credit_amount || 0),
              entry.description || '',
              entry.customerId || entry.customer_id || null,
              entry.supplierId || entry.supplier_id || null
            ]
          );
          entries.push(entryCamel(entryResult.rows[0]));
        }
      }

      jv.entries = entries;
      return jv;
    };

    if (client) {
      return await executeCreate(client);
    } else {
      return await transaction(async (newClient) => {
        return await executeCreate(newClient);
      });
    }
  }

  /**
   * Update journal voucher (only if draft)
   */
  async update(id, data, client = null) {
    const executeUpdate = async (clientToUse) => {
      // Check current status
      const statusResult = await clientToUse.query(
        'SELECT status FROM journal_vouchers WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );
      if (!statusResult.rows[0]) throw new Error('Journal Voucher not found');
      if (statusResult.rows[0].status !== 'draft') {
        throw new Error('Can only update draft journal vouchers');
      }

      // Delete old entries
      await clientToUse.query(
        'DELETE FROM journal_voucher_entries WHERE journal_voucher_id = $1',
        [id]
      );

      // Update header
      const result = await clientToUse.query(
        `UPDATE journal_vouchers 
         SET description = $1, 
             voucher_date = $2, 
             notes = $3,
             total_debit = $4,
             total_credit = $5,
             updated_by = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 AND deleted_at IS NULL
         RETURNING *`,
        [
          data.description || '',
          data.voucherDate || new Date().toISOString().split('T')[0],
          data.notes || '',
          data.totalDebit || 0,
          data.totalCredit || 0,
          data.updatedBy || null,
          id
        ]
      );

      if (!result.rows[0]) throw new Error('Failed to update journal voucher');

      const jv = toCamel(result.rows[0]);

      // Insert new entries
      const entries = [];
      if (Array.isArray(data.entries) && data.entries.length > 0) {
        for (let i = 0; i < data.entries.length; i++) {
          const entry = data.entries[i];
          const entryResult = await clientToUse.query(
            `INSERT INTO journal_voucher_entries 
             (journal_voucher_id, line_number, account_code, account_name, particulars, debit_amount, credit_amount, description, customer_id, supplier_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
              id,
              i + 1,
              entry.accountCode || entry.account_code,
              entry.accountName || entry.account_name || '',
              entry.particulars || '',
              parseFloat(entry.debitAmount || entry.debit_amount || 0),
              parseFloat(entry.creditAmount || entry.credit_amount || 0),
              entry.description || '',
              entry.customerId || entry.customer_id || null,
              entry.supplierId || entry.supplier_id || null
            ]
          );
          entries.push(entryCamel(entryResult.rows[0]));
        }
      }

      jv.entries = entries;
      return jv;
    };

    if (client) {
      return await executeUpdate(client);
    } else {
      return await transaction(async (newClient) => {
        return await executeUpdate(newClient);
      });
    }
  }

  /**
   * Update journal voucher status
   */
  async updateStatus(id, status, updatedBy = null, client = null) {
    const executeStatusUpdate = async (clientToUse) => {
      const result = await clientToUse.query(
        `UPDATE journal_vouchers 
         SET status = $1, 
             updated_at = CURRENT_TIMESTAMP,
             updated_by = $2
         WHERE id = $3 AND deleted_at IS NULL
         RETURNING *`,
        [status, updatedBy, id]
      );
      return toCamel(result.rows[0] || null);
    };

    if (client) {
      return await executeStatusUpdate(client);
    } else {
      return await transaction(async (newClient) => {
        return await executeStatusUpdate(newClient);
      });
    }
  }

  /**
   * Delete journal voucher (soft delete)
   */
  async delete(id, deletedBy = null) {
    const result = await query(
      `UPDATE journal_vouchers 
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_by = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [deletedBy, id]
    );
    return toCamel(result.rows[0] || null);
  }

  /**
   * Get journal voucher entries
   */
  async getEntries(journalVoucherId) {
    const result = await query(
      'SELECT * FROM journal_voucher_entries WHERE journal_voucher_id = $1 ORDER BY line_number',
      [journalVoucherId]
    );
    return result.rows.map(entryCamel);
  }

  /**
   * Log audit trail
   */
  async logAuditTrail(journalVoucherId, action, changedBy, changeDetails = null, client = null) {
    const sql = `INSERT INTO journal_voucher_audit_log 
       (journal_voucher_id, action, changed_by, change_details)
       VALUES ($1, $2, $3, $4)`;
    const params = [
      journalVoucherId,
      action,
      changedBy,
      changeDetails ? JSON.stringify(changeDetails) : null
    ];
    
    if (client) {
      await client.query(sql, params);
    } else {
      await query(sql, params);
    }
  }

  /**
   * Get audit trail for a JV
   */
  async getAuditTrail(journalVoucherId) {
    const result = await query(
      `SELECT * FROM journal_voucher_audit_log 
       WHERE journal_voucher_id = $1 
       ORDER BY changed_at DESC`,
      [journalVoucherId]
    );
    return result.rows.map(row => ({
      id: row.id,
      action: row.action,
      changedBy: row.changed_by,
      changeDetails: row.change_details ? JSON.parse(row.change_details) : null,
      changedAt: row.changed_at
    }));
  }
}

module.exports = new JournalVoucherRepository();
