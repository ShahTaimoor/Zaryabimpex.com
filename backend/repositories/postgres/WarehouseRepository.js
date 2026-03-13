const { query } = require('../../config/postgres');

class WarehouseRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM warehouses WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM warehouses WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;

    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }

    sql += ' ORDER BY is_primary DESC, name ASC';
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

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const getAll = options.getAll === true;

    let countSql = 'SELECT COUNT(*) FROM warehouses WHERE deleted_at IS NULL';
    const countParams = [];
    let paramCount = 1;
    if (filter.isActive !== undefined) {
      countSql += ` AND is_active = $${paramCount++}`;
      countParams.push(filter.isActive);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const warehouses = await this.findAll(filter, {
      limit: getAll ? total : limit,
      offset: getAll ? 0 : offset
    });

    return {
      warehouses,
      total,
      pagination: {
        page: getAll ? 1 : page,
        limit: getAll ? total : limit,
        pages: Math.ceil(total / limit) || 1,
        hasNext: !getAll && page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async findByCode(code, options = {}) {
    const result = await query(
      'SELECT * FROM warehouses WHERE code = $1 AND deleted_at IS NULL LIMIT 1',
      [(code || '').toUpperCase()]
    );
    return result.rows[0] || null;
  }

  async findPrimary(options = {}) {
    const result = await query(
      'SELECT * FROM warehouses WHERE is_primary = TRUE AND deleted_at IS NULL LIMIT 1',
      []
    );
    return result.rows[0] || null;
  }

  async unsetAllPrimary(session = null) {
    await query('UPDATE warehouses SET is_primary = FALSE WHERE deleted_at IS NULL');
    return { modifiedCount: 1 };
  }

  async codeExists(code, excludeId = null) {
    let sql = 'SELECT 1 FROM warehouses WHERE UPPER(code) = UPPER($1) AND deleted_at IS NULL';
    const params = [code];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async create(data) {
    if (data.isPrimary) {
      await this.unsetAllPrimary();
    }
    const result = await query(
      `INSERT INTO warehouses (name, code, description, address, contact, notes, capacity, is_primary, is_active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.name,
        (data.code || '').toUpperCase(),
        data.description || null,
        data.address ? JSON.stringify(data.address) : null,
        data.contact ? JSON.stringify(data.contact) : null,
        data.notes || null,
        data.capacity ?? null,
        data.isPrimary === true,
        data.isActive !== false,
        data.createdBy || data.created_by || null
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    if (data.isPrimary === true) {
      await this.unsetAllPrimary();
    }
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      name: 'name', code: 'code', description: 'description', address: 'address', contact: 'contact',
      notes: 'notes', capacity: 'capacity', isPrimary: 'is_primary', isActive: 'is_active', updatedBy: 'updated_by'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(typeof data[k] === 'object' && (col === 'address' || col === 'contact') ? JSON.stringify(data[k]) : (k === 'code' ? (data[k] || '').toUpperCase() : data[k]));
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE warehouses SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      'UPDATE warehouses SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = new WarehouseRepository();
