const { query } = require('../../config/postgres');

class ProductVariantRepository {
  async findById(id) {
    const result = await query('SELECT * FROM product_variants WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM product_variants WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;
    if (filters.baseProductId || filters.baseProduct) {
      sql += ` AND base_product_id = $${paramCount++}`;
      params.push(filters.baseProductId || filters.baseProduct);
    }
    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async findByBaseProduct(baseProductId, options = {}) {
    return this.findAll({ baseProductId, baseProduct: baseProductId }, options);
  }

  async findOne(filters = {}) {
    if (filters.baseProduct != null && filters.variantType != null && filters.variantValue != null) {
      const result = await query(
        'SELECT * FROM product_variants WHERE base_product_id = $1 AND variant_type = $2 AND variant_value = $3 AND deleted_at IS NULL LIMIT 1',
        [filters.baseProduct, filters.variantType, filters.variantValue]
      );
      return result.rows[0] || null;
    }
    if (filters.id || filters._id) return this.findById(filters.id || filters._id);
    return null;
  }

  async findWithFilter(filter = {}, options = {}) {
    let sql = 'SELECT * FROM product_variants WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;
    if (filter.baseProduct) {
      sql += ` AND base_product_id = $${paramCount++}`;
      params.push(filter.baseProduct);
    }
    if (filter.variantType) {
      sql += ` AND variant_type = $${paramCount++}`;
      params.push(filter.variantType);
    }
    if (filter.status !== undefined) {
      if (filter.status === 'active') sql += ' AND is_active = TRUE';
      else if (filter.status === 'inactive') sql += ' AND is_active = FALSE';
    }
    if (filter.search || (filter.$or && filter.$or.length)) {
      const term = filter.search || (filter.$or && filter.$or[0] && (filter.$or[0].variantName || filter.$or[0].displayName || filter.$or[0].variantValue));
      if (term && typeof term === 'string') {
        const like = `%${term}%`;
        sql += ` AND (variant_name ILIKE $${paramCount} OR display_name ILIKE $${paramCount} OR variant_value ILIKE $${paramCount})`;
        params.push(like);
        paramCount++;
      }
    }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async create(data) {
    const result = await query(
      `INSERT INTO product_variants (base_product_id, variant_name, variant_type, variant_value, display_name, description, pricing, transformation_cost, inventory_data, sku, barcode, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.baseProduct || data.baseProductId,
        data.variantName || data.variant_name,
        data.variantType || data.variant_type,
        data.variantValue || data.variant_value,
        data.displayName || data.display_name,
        data.description || null,
        data.pricing ? JSON.stringify(data.pricing) : '{}',
        data.transformationCost ?? data.transformation_cost ?? 0,
        data.inventory ? JSON.stringify(data.inventory) : '{}',
        data.sku || null,
        data.barcode || null,
        data.isActive !== false
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = { variantName: 'variant_name', variantType: 'variant_type', variantValue: 'variant_value', displayName: 'display_name', description: 'description', pricing: 'pricing', transformationCost: 'transformation_cost', inventory: 'inventory_data', inventoryData: 'inventory_data', sku: 'sku', barcode: 'barcode', isActive: 'is_active' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(`UPDATE product_variants SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`, params);
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query('UPDATE product_variants SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }

  async hardDelete(id) {
    const result = await query('DELETE FROM product_variants WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  }
}

module.exports = new ProductVariantRepository();
