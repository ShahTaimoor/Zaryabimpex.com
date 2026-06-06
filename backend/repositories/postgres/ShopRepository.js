const { query } = require('../../config/postgres');

function q(client) {
  return client ? client.query.bind(client) : query;
}

class ShopRepository {
  async findById(id, client = null) {
    const result = await q(client)(
      'SELECT * FROM shops WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM shops WHERE deleted_at IS NULL';
    const params = [];
    let n = 1;
    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${n++}`;
      params.push(filters.isActive);
    }
    sql += ' ORDER BY is_primary DESC, name ASC';
    if (options.limit) {
      sql += ` LIMIT $${n++}`;
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ` OFFSET $${n++}`;
      params.push(options.offset);
    }
    const result = await query(sql, params);
    return result.rows;
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    let countSql = 'SELECT COUNT(*)::int AS c FROM shops WHERE deleted_at IS NULL';
    const countParams = [];
    let n = 1;
    if (filter.isActive !== undefined) {
      countSql += ` AND is_active = $${n++}`;
      countParams.push(filter.isActive);
    }
    const countResult = await query(countSql, countParams);
    const total = countResult.rows[0]?.c || 0;
    const shops = await this.findAll(filter, { limit, offset });
    return {
      shops,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
        total,
      },
    };
  }

  async findByCode(code) {
    const result = await query(
      'SELECT * FROM shops WHERE UPPER(code) = UPPER($1) AND deleted_at IS NULL LIMIT 1',
      [code]
    );
    return result.rows[0] || null;
  }

  async findPrimary(client = null) {
    const result = await q(client)(
      'SELECT * FROM shops WHERE is_primary = TRUE AND deleted_at IS NULL LIMIT 1',
      []
    );
    return result.rows[0] || null;
  }

  async unsetAllPrimary() {
    await query('UPDATE shops SET is_primary = FALSE WHERE deleted_at IS NULL');
  }

  async create(data, client = null) {
    if (data.isPrimary) await this.unsetAllPrimary();
    const result = await q(client)(
      `INSERT INTO shops (name, code, description, address, contact, notes, is_primary, is_active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.name,
        (data.code || '').toUpperCase(),
        data.description || null,
        data.address ? JSON.stringify(data.address) : null,
        data.contact ? JSON.stringify(data.contact) : null,
        data.notes || null,
        data.isPrimary === true,
        data.isActive !== false,
        data.createdBy || data.created_by || null,
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    if (data.isPrimary === true) await this.unsetAllPrimary();
    const updates = [];
    const params = [];
    let n = 1;
    const map = {
      name: 'name',
      code: 'code',
      description: 'description',
      address: 'address',
      contact: 'contact',
      notes: 'notes',
      isPrimary: 'is_primary',
      isActive: 'is_active',
      updatedBy: 'updated_by',
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${n++}`);
        const val = data[k];
        params.push(
          typeof val === 'object' && val !== null && (col === 'address' || col === 'contact')
            ? JSON.stringify(val)
            : k === 'code'
              ? String(val).toUpperCase()
              : val
        );
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE shops SET ${updates.join(', ')} WHERE id = $${n} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      'UPDATE shops SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = new ShopRepository();
