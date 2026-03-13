const { query } = require('../../config/postgres');

class CityRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM cities WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findOne(filters = {}) {
    let sql = 'SELECT * FROM cities WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.name) {
      sql += ` AND name ILIKE $${paramCount++}`;
      params.push(filters.name.trim());
    }
    if (filters.id) {
      sql += ` AND id = $${paramCount++}`;
      params.push(filters.id);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM cities WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }
    if (filters.state) {
      sql += ` AND state ILIKE $${paramCount++}`;
      params.push(`%${filters.state}%`);
    }
    if (filters.search) {
      sql += ` AND (name ILIKE $${paramCount} OR state ILIKE $${paramCount} OR country ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    const { toSortString } = require('../../utils/sortParam');
    const sortStr = toSortString(options.sort, 'name ASC');
    const [field, direction] = sortStr.split(' ');
    sql += ` ORDER BY ${field || 'name'} ${direction || 'ASC'}`;
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

  async findByName(name, options = {}) {
    if (!name) return null;
    const result = await query(
      'SELECT * FROM cities WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
      [name]
    );
    return result.rows[0] || null;
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    const getAll = options.getAll === true;

    let countSql = 'SELECT COUNT(*) FROM cities WHERE 1=1';
    const countParams = [];
    let paramCount = 1;
    if (filter.isActive !== undefined) {
      countSql += ` AND is_active = $${paramCount++}`;
      countParams.push(filter.isActive);
    }
    if (filter.search) {
      countSql += ` AND (name ILIKE $${paramCount} OR state ILIKE $${paramCount} OR country ILIKE $${paramCount})`;
      countParams.push(`%${filter.search}%`);
      paramCount++;
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const cities = await this.findAll(filter, {
      ...options,
      limit: getAll ? total : limit,
      offset: getAll ? 0 : offset
    });

    return {
      cities,
      total,
      pagination: {
        page: getAll ? 1 : page,
        limit: getAll ? total : limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    };
  }

  async findActive(options = {}) {
    return this.findAll({ isActive: true }, { ...options, sort: 'name ASC' });
  }

  async findByState(state, options = {}) {
    return this.findAll({ state }, options);
  }

  async nameExists(name, excludeId = null) {
    if (!name) return false;
    let sql = 'SELECT 1 FROM cities WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))';
    const params = [name.trim()];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async create(data) {
    const result = await query(
      `INSERT INTO cities (name, state, country, is_active, description, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.name,
        data.state || null,
        data.country || 'US',
        data.isActive !== false,
        data.description || null,
        data.createdBy || data.created_by
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = { name: 'name', state: 'state', country: 'country', isActive: 'is_active', description: 'description', updatedBy: 'updated_by' };
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
      `UPDATE cities SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
}

module.exports = new CityRepository();
