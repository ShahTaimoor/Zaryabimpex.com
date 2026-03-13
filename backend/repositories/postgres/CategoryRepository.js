const { query } = require('../../config/postgres');

class CategoryRepository {
  async findByName(name) {
    if (!name) return null;
    const result = await query(
      'SELECT * FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (is_deleted = FALSE OR is_deleted IS NULL)',
      [name]
    );
    return result.rows[0] || null;
  }

  async findById(id) {
    const result = await query(
      'SELECT * FROM categories WHERE id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM categories WHERE (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [];
    let n = 1;

    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${n++}`;
      params.push(filters.isActive);
    }
    if (filters.search) {
      sql += ` AND (name ILIKE $${n} OR description ILIKE $${n})`;
      params.push(`%${filters.search}%`);
      n++;
    }
    if (filters.parentCategoryId !== undefined && filters.parentCategoryId !== null) {
      sql += ` AND parent_category_id = $${n++}`;
      params.push(filters.parentCategoryId);
    } else if (filters.rootOnly) {
      sql += ' AND parent_category_id IS NULL';
    }

    sql += ' ORDER BY sort_order ASC, name ASC';
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

  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    let countSql = 'SELECT COUNT(*) FROM categories WHERE (is_deleted = FALSE OR is_deleted IS NULL)';
    const countParams = [];
    let cn = 1;
    if (filters.isActive !== undefined) {
      countSql += ` AND is_active = $${cn++}`;
      countParams.push(filters.isActive);
    }
    if (filters.search) {
      countSql += ` AND (name ILIKE $${cn} OR description ILIKE $${cn})`;
      countParams.push(`%${filters.search}%`);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const categories = await this.findAll(filters, { ...options, limit, offset });
    return {
      categories,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  async getCategoryTree() {
    const rows = await query(
      'SELECT * FROM categories WHERE (is_deleted = FALSE OR is_deleted IS NULL) ORDER BY sort_order ASC, name ASC'
    );
    const list = rows.rows;
    const byId = new Map(list.map(c => [c.id, { ...c, subcategories: [] }]));
    const roots = [];
    for (const c of byId.values()) {
      if (!c.parent_category_id) {
        roots.push(c);
      } else {
        const parent = byId.get(c.parent_category_id);
        if (parent) parent.subcategories.push(c);
        else roots.push(c);
      }
    }
    return roots;
  }

  async nameExists(name, excludeId = null) {
    let sql = 'SELECT 1 FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [name];
    if (excludeId) {
      sql += ` AND id != $2`;
      params.push(excludeId);
    }
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async create(data) {
    const result = await query(
      `INSERT INTO categories (name, description, parent_category_id, is_active, sort_order, image)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.description || null,
        data.parentCategoryId || data.parentCategory || null,
        data.isActive !== false,
        data.sortOrder ?? data.sort_order ?? 0,
        data.image || null
      ]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let n = 1;
    const map = {
      name: 'name',
      description: 'description',
      parentCategoryId: 'parent_category_id',
      parentCategory: 'parent_category_id',
      isActive: 'is_active',
      sortOrder: 'sort_order',
      image: 'image'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        fields.push(`${col} = $${n++}`);
        values.push(data[k]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const result = await query(
      `UPDATE categories SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${n} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(
      'UPDATE categories SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async countSubcategories(categoryId) {
    const result = await query(
      'SELECT COUNT(*) FROM categories WHERE parent_category_id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)',
      [categoryId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getStats() {
    const result = await query(
      `SELECT
        COUNT(*) AS total_categories,
        COUNT(*) FILTER (WHERE is_active = TRUE) AS active_categories,
        COUNT(*) FILTER (WHERE is_active = FALSE) AS inactive_categories
       FROM categories
       WHERE (is_deleted = FALSE OR is_deleted IS NULL)`
    );
    const row = result.rows[0];
    return {
      totalCategories: parseInt(row.total_categories, 10),
      activeCategories: parseInt(row.active_categories, 10),
      inactiveCategories: parseInt(row.inactive_categories, 10)
    };
  }
}

module.exports = new CategoryRepository();
