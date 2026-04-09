const { query } = require('../../config/postgres');

/**
 * Map DB row (snake_case) to camelCase for compatibility with existing services.
 */
function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountCode: row.account_code,
    accountName: row.account_name,
    accountType: row.account_type,
    accountCategory: row.account_category,
    parentAccountId: row.parent_account_id,
    level: row.level,
    isActive: row.is_active,
    isSystemAccount: row.is_system_account,
    allowDirectPosting: row.allow_direct_posting,
    normalBalance: row.normal_balance,
    currentBalance: row.current_balance != null ? parseFloat(row.current_balance) : 0,
    openingBalance: row.opening_balance != null ? parseFloat(row.opening_balance) : 0,
    description: row.description,
    currency: row.currency,
    isTaxable: row.is_taxable,
    taxRate: row.tax_rate,
    requiresReconciliation: row.requires_reconciliation,
    lastReconciliationDate: row.last_reconciliation_date,
    reconciliationStatus: row.reconciliation_status,
    reconciledBy: row.reconciled_by,
    reconciledAt: row.reconciled_at,
    notes: row.notes,
    tags: row.tags,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

class ChartOfAccountsRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM chart_of_accounts WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return toCamel(result.rows[0] || null);
  }

  async findOne(filters = {}) {
    let sql = 'SELECT * FROM chart_of_accounts WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;
    if (filters.accountCode) {
      sql += ` AND account_code = $${paramCount++}`;
      params.push(filters.accountCode);
    }
    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }
    if (filters.accountName && (typeof filters.accountName === 'object' && filters.accountName.$regex)) {
      const pattern = filters.accountName.$regex.source || filters.accountName;
      sql += ` AND account_name ~* $${paramCount++}`;
      params.push(typeof pattern === 'string' ? pattern.replace(/^\^|\$$/g, '') : '.*');
    } else if (filters.accountName && typeof filters.accountName === 'string') {
      sql += ` AND account_name ILIKE $${paramCount++}`;
      params.push(`%${filters.accountName}%`);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return toCamel(result.rows[0] || null);
  }

  async findByAccountCode(accountCode) {
    const result = await query(
      'SELECT * FROM chart_of_accounts WHERE account_code = $1 AND deleted_at IS NULL LIMIT 1',
      [accountCode]
    );
    return toCamel(result.rows[0] || null);
  }

  /**
   * Find account by customer ID - uses account_code CUST-{id} pattern (metadata optional)
   */
  async findByCustomerId(customerId) {
    if (!customerId) return null;
    return this.findByAccountCode(`CUST-${customerId}`);
  }

  /**
   * Find account by supplier ID - uses account_code SUPP-{id} pattern
   */
  async findBySupplierId(supplierId) {
    if (!supplierId) return null;
    return this.findByAccountCode(`SUPP-${supplierId}`);
  }

  async getAccountCodesByName(accountName) {
    if (!accountName) return [];
    const result = await query(
      'SELECT account_code FROM chart_of_accounts WHERE deleted_at IS NULL AND account_name ILIKE $1',
      [`%${accountName}%`]
    );
    return result.rows.map(r => r.account_code);
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM chart_of_accounts WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;
    if (filters.accountType) {
      sql += ` AND account_type = $${paramCount++}`;
      params.push(filters.accountType);
    }
    if (filters.accountCategory) {
      sql += ` AND account_category = $${paramCount++}`;
      params.push(filters.accountCategory);
    }
    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }
    if (filters.reconciliationStatus != null || filters.reconciliation_status != null) {
      sql += ` AND reconciliation_status = $${paramCount++}`;
      params.push(filters.reconciliationStatus ?? filters.reconciliation_status);
    }
    if (filters.search) {
      sql += ` AND (account_name ILIKE $${paramCount} OR account_code ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }
    sql += ' ORDER BY account_code';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows.map(toCamel);
  }

  async count(filters = {}) {
    let sql = 'SELECT COUNT(*) FROM chart_of_accounts WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;
    
    if (filters.accountCode) {
      sql += ` AND account_code = $${paramCount++}`;
      params.push(filters.accountCode);
    }
    
    if (filters.accountCategory) {
      sql += ` AND account_category = $${paramCount++}`;
      params.push(filters.accountCategory);
    }
    
    if (filters.accountType) {
      sql += ` AND account_type = $${paramCount++}`;
      params.push(filters.accountType);
    }
    
    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }
    
    if (filters.search) {
      sql += ` AND (account_name ILIKE $${paramCount} OR account_code ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }
    
    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  async create(data) {
    const metadata = data.metadata || data.customerId ? { customerId: data.customerId } : data.supplierId ? { supplierId: data.supplierId } : null;
    const metadataJson = metadata ? JSON.stringify(metadata) : '{}';
    const result = await query(
      `INSERT INTO chart_of_accounts (account_code, account_name, account_type, account_category, parent_account_id, level, is_active, is_system_account, allow_direct_posting, normal_balance, current_balance, opening_balance, description, currency, is_taxable, tax_rate, metadata, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.accountCode || data.account_code,
        data.accountName || data.account_name,
        data.accountType || data.account_type,
        data.accountCategory || data.account_category,
        data.parentAccountId || data.parent_account_id || null,
        data.level ?? 0,
        data.isActive !== false,
        data.isSystemAccount === true,
        data.allowDirectPosting !== false,
        data.normalBalance || data.normal_balance,
        data.currentBalance ?? 0,
        data.openingBalance ?? 0,
        data.description || null,
        data.currency || 'PKR',
        data.isTaxable === true,
        data.taxRate ?? 0,
        metadataJson,
        data.createdBy || data.created_by || null
      ]
    );
    return toCamel(result.rows[0]);
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      accountCode: 'account_code', accountName: 'account_name', accountType: 'account_type', accountCategory: 'account_category',
      parentAccountId: 'parent_account_id', level: 'level', isActive: 'is_active', isSystemAccount: 'is_system_account',
      allowDirectPosting: 'allow_direct_posting', normalBalance: 'normal_balance', currentBalance: 'current_balance',
      openingBalance: 'opening_balance', description: 'description', currency: 'currency', isTaxable: 'is_taxable',
      taxRate: 'tax_rate', updatedBy: 'updated_by'
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
      `UPDATE chart_of_accounts SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return toCamel(result.rows[0] || null);
  }

  async softDelete(id) {
    const result = await query(
      'UPDATE chart_of_accounts SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );
    return result.rows[0] ? toCamel(result.rows[0]) : null;
  }
}

module.exports = new ChartOfAccountsRepository();
