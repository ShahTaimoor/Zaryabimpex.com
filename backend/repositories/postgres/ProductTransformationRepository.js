const { query } = require('../../config/postgres');

class ProductTransformationRepository {
  async findById(id) {
    const result = await query('SELECT * FROM product_transformations WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM product_transformations WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.baseProductId || filters.baseProduct) {
      sql += ` AND base_product_id = $${paramCount++}`;
      params.push(filters.baseProductId || filters.baseProduct);
    }
    if (filters.targetVariantId || filters.targetVariant) {
      sql += ` AND target_variant_id = $${paramCount++}`;
      params.push(filters.targetVariantId || filters.targetVariant);
    }
    if (filters.status) { sql += ` AND status = $${paramCount++}`; params.push(filters.status); }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async findWithFilter(filter = {}, options = {}) {
    let sql = 'SELECT * FROM product_transformations WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filter.baseProduct) {
      sql += ` AND base_product_id = $${paramCount++}`;
      params.push(filter.baseProduct);
    }
    if (filter.targetVariant) {
      sql += ` AND target_variant_id = $${paramCount++}`;
      params.push(filter.targetVariant);
    }
    if (filter.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filter.status);
    }
    if (filter.transformationType) {
      sql += ` AND transformation_type = $${paramCount++}`;
      params.push(filter.transformationType);
    }
    if (filter.transformationDate && (filter.transformationDate.$gte || filter.transformationDate.$lte)) {
      if (filter.transformationDate.$gte) {
        sql += ` AND created_at >= $${paramCount++}`;
        params.push(filter.transformationDate.$gte);
      }
      if (filter.transformationDate.$lte) {
        sql += ` AND created_at <= $${paramCount++}`;
        params.push(filter.transformationDate.$lte);
      }
    }
    if (filter.search && typeof filter.search === 'string') {
      const like = `%${filter.search}%`;
      sql += ` AND (transformation_number ILIKE $${paramCount} OR base_product_name ILIKE $${paramCount} OR target_variant_name ILIKE $${paramCount})`;
      params.push(like);
      paramCount++;
    }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async create(data) {
    const result = await query(
      `INSERT INTO product_transformations (transformation_number, base_product_id, base_product_name, target_variant_id, target_variant_name, quantity, unit_transformation_cost, total_transformation_cost, base_product_stock_before, base_product_stock_after, variant_stock_before, variant_stock_after, transformation_type, notes, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.transformationNumber || data.transformation_number || null,
        data.baseProduct || data.baseProductId,
        data.baseProductName || data.base_product_name,
        data.targetVariant || data.targetVariantId,
        data.targetVariantName || data.target_variant_name,
        data.quantity,
        data.unitTransformationCost ?? data.unit_transformation_cost ?? 0,
        data.totalTransformationCost ?? data.total_transformation_cost ?? 0,
        data.baseProductStockBefore ?? 0,
        data.baseProductStockAfter ?? 0,
        data.variantStockBefore ?? 0,
        data.variantStockAfter ?? 0,
        data.transformationType || data.transformation_type,
        data.notes || null,
        data.status || 'completed',
        data.createdBy || data.created_by || null
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = { status: 'status', notes: 'notes' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(`UPDATE product_transformations SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, params);
    return result.rows[0] || null;
  }
}

module.exports = new ProductTransformationRepository();
