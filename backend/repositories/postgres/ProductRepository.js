const { query } = require('../../config/postgres');

function rowToProduct(row) {
  if (!row) return null;
  return {
    ...row,
    _id: row.id,
    costPrice: parseFloat(row.cost_price) || 0,
    sellingPrice: parseFloat(row.selling_price) || 0,
    wholesalePrice: row.wholesale_price != null ? parseFloat(row.wholesale_price) : parseFloat(row.selling_price) || 0,
    stockQuantity: parseFloat(row.stock_quantity) || 0,
    minStockLevel: parseFloat(row.min_stock_level) || 0,
    categoryId: row.category_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * PostgreSQL Product repository - use for product data when migrating off MongoDB.
 */
class ProductRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM products WHERE id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)',
      [id]
    );
    return rowToProduct(result.rows[0]);
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM products WHERE (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [];
    let paramCount = 1;

    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }
    if (filters.ids || filters.productIds) {
      sql += ` AND id = ANY($${paramCount++}::uuid[])`;
      params.push(filters.ids || filters.productIds);
    }
    if (filters.categoryId) {
      sql += ` AND category_id = $${paramCount++}`;
      params.push(filters.categoryId);
    }
    if (filters.search) {
      sql += ` AND (name ILIKE $${paramCount} OR sku ILIKE $${paramCount} OR barcode ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }
    if (filters.lowStock) {
      sql += ' AND stock_quantity <= min_stock_level';
    }
    if (filters.stockStatus === 'outOfStock') {
      sql += ' AND stock_quantity = 0';
    }
    if (filters.stockStatus === 'inStock') {
      sql += ' AND stock_quantity > 0';
    }

    sql += ' ORDER BY created_at DESC, name ASC';
    if (options.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ` OFFSET $${paramCount++}`;
      params.push(options.offset);
    }

    const result = await query(sql, params);
    return result.rows.map(rowToProduct);
  }

  async create(data) {
    const result = await query(
      `INSERT INTO products (name, sku, barcode, description, category_id, cost_price, selling_price, wholesale_price,
       stock_quantity, min_stock_level, unit, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        data.name,
        data.sku || null,
        data.barcode || null,
        data.description || null,
        data.categoryId || data.category_id || null,
        data.costPrice ?? data.cost_price ?? 0,
        data.sellingPrice ?? data.selling_price ?? 0,
        data.wholesalePrice ?? data.wholesale_price ?? data.sellingPrice ?? data.selling_price ?? 0,
        data.stockQuantity ?? data.stock_quantity ?? 0,
        data.minStockLevel ?? data.min_stock_level ?? 0,
        data.unit || null,
        data.isActive !== false,
        data.createdBy || data.created_by || null
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
      sku: 'sku',
      barcode: 'barcode',
      description: 'description',
      categoryId: 'category_id',
      costPrice: 'cost_price',
      sellingPrice: 'selling_price',
      wholesalePrice: 'wholesale_price',
      stockQuantity: 'stock_quantity',
      minStockLevel: 'min_stock_level',
      unit: 'unit',
      isActive: 'is_active',
      updatedBy: 'updated_by'
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
      `UPDATE products SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${n} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(
      'UPDATE products SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async findDeletedById(id) {
    const result = await query(
      'SELECT * FROM products WHERE id = $1 AND is_deleted = TRUE',
      [id]
    );
    return result.rows[0] || null;
  }

  async restore(id) {
    const result = await query(
      'UPDATE products SET is_deleted = FALSE, deleted_at = NULL WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async findDeleted(filters = {}, options = {}) {
    let sql = 'SELECT * FROM products WHERE is_deleted = TRUE';
    const params = [];
    let n = 1;
    if (options.limit) {
      sql += ` LIMIT $${n++}`;
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ` OFFSET $${n++}`;
      params.push(options.offset);
    }
    sql += ' ORDER BY deleted_at DESC NULLS LAST';
    const result = await query(sql, params);
    return result.rows;
  }

  async search(term, options = { limit: 50 }) {
    return this.findAll({ search: term }, options);
  }

  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let countSql = 'SELECT COUNT(*) FROM products WHERE (is_deleted = FALSE OR is_deleted IS NULL)';
    const countParams = [];
    let cn = 1;
    if (filters.isActive !== undefined) {
      countSql += ` AND is_active = $${cn++}`;
      countParams.push(filters.isActive);
    }
    if (filters.categoryId) {
      countSql += ` AND category_id = $${cn++}`;
      countParams.push(filters.categoryId);
    }
    if (filters.search) {
      countSql += ` AND (name ILIKE $${cn} OR sku ILIKE $${cn} OR barcode ILIKE $${cn})`;
      countParams.push(`%${filters.search}%`);
    }
    if (filters.lowStock) {
      countSql += ' AND stock_quantity <= min_stock_level';
    }
    if (filters.stockStatus === 'outOfStock') {
      countSql += ' AND stock_quantity = 0';
    }
    if (filters.stockStatus === 'inStock') {
      countSql += ' AND stock_quantity > 0';
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const products = await this.findAll(filters, { limit, offset });
    return {
      products,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit) || 1,
        total,
        limit
      }
    };
  }

  async nameExists(name, excludeId = null) {
    let sql = 'SELECT 1 FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [name];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async findByName(name) {
    const result = await query(
      'SELECT * FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (is_deleted = FALSE OR is_deleted IS NULL)',
      [name]
    );
    return result.rows[0] || null;
  }

  async skuExists(sku, excludeId = null) {
    if (!sku) return false;
    let sql = 'SELECT 1 FROM products WHERE LOWER(TRIM(sku)) = LOWER(TRIM($1)) AND (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [sku];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async barcodeExists(barcode, excludeId = null) {
    if (!barcode) return false;
    let sql = 'SELECT 1 FROM products WHERE LOWER(TRIM(barcode)) = LOWER(TRIM($1)) AND (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [barcode];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async count(filters = {}) {
    let sql = 'SELECT COUNT(*) FROM products WHERE (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [];
    let cn = 1;
    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${cn++}`;
      params.push(filters.isActive);
    }
    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  async countByCategory(categoryId) {
    const result = await query(
      'SELECT COUNT(*) FROM products WHERE category_id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)',
      [categoryId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}

module.exports = new ProductRepository();
