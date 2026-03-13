const { query } = require('../../config/postgres');

class AccountCategoryRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM account_categories WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM account_categories WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.accountType) {
      sql += ` AND account_type = $${paramCount++}`;
      params.push(filters.accountType);
    }
    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }

    sql += ' ORDER BY account_type ASC, display_order ASC, name ASC';
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

  async findActive(options = {}) {
    return this.findAll({ isActive: true }, { ...options, sort: { accountType: 1, displayOrder: 1, name: 1 } });
  }

  async getCategoriesByType(accountType) {
    return this.findAll(
      { accountType, isActive: true },
      { sort: 'display_order ASC' }
    );
  }

  async getAllCategoriesGrouped() {
    const rows = await this.findAll({ isActive: true }, { sort: 'account_type ASC, display_order ASC, name ASC' });
    const grouped = { asset: [], liability: [], equity: [], revenue: [], expense: [] };
    for (const row of rows) {
      const type = row.account_type;
      if (grouped[type]) grouped[type].push(row);
    }
    return grouped;
  }

  async create(data) {
    const result = await query(
      `INSERT INTO account_categories (name, code, account_type, description, is_active, is_system_category, display_order, color, notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.name,
        (data.code || '').toUpperCase(),
        data.accountType || data.account_type,
        data.description || null,
        data.isActive !== false,
        data.isSystemCategory === true,
        data.displayOrder ?? data.display_order ?? 0,
        data.color || '#6B7280',
        data.notes || null,
        data.createdBy || data.created_by || null
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      name: 'name', code: 'code', accountType: 'account_type', description: 'description',
      isActive: 'is_active', isSystemCategory: 'is_system_category', displayOrder: 'display_order',
      color: 'color', notes: 'notes', updatedBy: 'updated_by'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(k === 'code' ? (data[k] || '').toUpperCase() : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE account_categories SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async hardDelete(id) {
    const result = await query('DELETE FROM account_categories WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  }
}

module.exports = new AccountCategoryRepository();
