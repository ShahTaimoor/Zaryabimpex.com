const { query } = require('../../config/postgres');

class BankRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM banks WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    return this.findWithFilters(filters, options);
  }

  async findWithFilters(filter = {}, options = {}) {
    let sql = 'SELECT * FROM banks WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;

    if (filter.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filter.isActive);
    }

    const { toSortString } = require('../../utils/sortParam');
    const sortStr = toSortString(options.sort, 'bank_name ASC');
    const [field, direction] = sortStr.split(' ');
    const sortColMap = { bankName: 'bank_name', accountNumber: 'account_number', accountName: 'account_name', branchName: 'branch_name' };
    const col = sortColMap[field] || field || 'bank_name';
    sql += ` ORDER BY ${col} ${direction || 'ASC'}`;

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

  async findByAccountNumber(accountNumber, options = {}) {
    const result = await query(
      'SELECT * FROM banks WHERE account_number = $1 AND deleted_at IS NULL',
      [accountNumber]
    );
    return result.rows[0] || null;
  }

  async findActive(options = {}) {
    return this.findWithFilters({ isActive: true }, options);
  }

  async create(data) {
    const result = await query(
      `INSERT INTO banks (
        account_name, account_number, bank_name, branch_name, branch_address,
        account_type, routing_number, swift_code, iban, opening_balance, current_balance,
        is_active, notes, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        data.accountName || data.account_name,
        data.accountNumber || data.account_number,
        data.bankName || data.bank_name,
        data.branchName || data.branch_name || null,
        data.branchAddress ? JSON.stringify(data.branchAddress) : (data.branch_address ? JSON.stringify(data.branch_address) : null),
        data.accountType || data.account_type || 'checking',
        data.routingNumber || data.routing_number || null,
        data.swiftCode || data.swift_code || null,
        data.iban || null,
        data.openingBalance ?? data.opening_balance ?? 0,
        data.currentBalance ?? data.current_balance ?? 0,
        data.isActive !== false,
        data.notes || null,
        data.createdBy || data.created_by
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      accountName: 'account_name',
      accountNumber: 'account_number',
      bankName: 'bank_name',
      branchName: 'branch_name',
      branchAddress: 'branch_address',
      accountType: 'account_type',
      routingNumber: 'routing_number',
      swiftCode: 'swift_code',
      iban: 'iban',
      openingBalance: 'opening_balance',
      currentBalance: 'current_balance',
      isActive: 'is_active',
      notes: 'notes',
      updatedBy: 'updated_by'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(typeof data[k] === 'object' && col.includes('address') ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE banks SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      'UPDATE banks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = new BankRepository();
