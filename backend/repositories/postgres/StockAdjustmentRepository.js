const { query } = require('../../config/postgres');

class StockAdjustmentRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM stock_adjustments WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM stock_adjustments WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.type) {
      sql += ` AND type = $${paramCount++}`;
      params.push(filters.type);
    }
    if (filters.requestedBy) {
      sql += ` AND requested_by = $${paramCount++}`;
      params.push(filters.requestedBy);
    }
    if (filters.warehouse) {
      sql += ` AND warehouse = $${paramCount++}`;
      params.push(filters.warehouse);
    }

    sql += ' ORDER BY requested_date DESC';
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

  async findOne(filters = {}) {
    if (filters.adjustmentNumber) {
      const result = await query(
        'SELECT * FROM stock_adjustments WHERE adjustment_number = $1 LIMIT 1',
        [filters.adjustmentNumber]
      );
      return result.rows[0] || null;
    }
    if (filters._id || filters.id) return this.findById(filters._id || filters.id);
    return null;
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const getAll = options.getAll === true;

    let countSql = 'SELECT COUNT(*) FROM stock_adjustments WHERE 1=1';
    const countParams = [];
    let paramCount = 1;
    if (filter.status) {
      countSql += ` AND status = $${paramCount++}`;
      countParams.push(filter.status);
    }
    if (filter.type) {
      countSql += ` AND type = $${paramCount++}`;
      countParams.push(filter.type);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const adjustments = await this.findAll(filter, {
      limit: getAll ? total : limit,
      offset: getAll ? 0 : offset
    });

    return {
      adjustments,
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

  async findByProductId(productId, options = {}) {
    const result = await query(
      `SELECT * FROM stock_adjustments WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(adjustments) AS elem WHERE (elem->>'product')::uuid = $1
      ) ORDER BY requested_date DESC LIMIT $2`,
      [productId, options.limit || 100]
    );
    return result.rows;
  }

  async findByWarehouse(warehouseId, options = {}) {
    return this.findAll({ warehouse: warehouseId }, options);
  }

  async approveAdjustment(adjustmentId, approvedBy) {
    const result = await query(
      `UPDATE stock_adjustments SET status = 'approved', approved_by = $2, approved_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'pending' RETURNING *`,
      [adjustmentId, approvedBy]
    );
    if (!result.rows[0]) throw new Error('Adjustment not found or not pending approval');
    return result.rows[0];
  }

  async completeAdjustment(adjustmentId, completedBy) {
    const result = await query(
      `UPDATE stock_adjustments SET status = 'completed', completed_by = $2, completed_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'approved' RETURNING *`,
      [adjustmentId, completedBy]
    );
    if (!result.rows[0]) throw new Error('Adjustment must be approved before completion');
    return result.rows[0];
  }

  async create(data) {
    const adjustments = data.adjustments || [];
    const totalVariance = adjustments.reduce((s, a) => s + (a.variance || 0), 0);
    const totalCostImpact = adjustments.reduce((s, a) => s + (a.variance || 0) * (a.cost || 0), 0);
    const adjNumber = data.adjustmentNumber || data.adjustment_number || `ADJ-${String(Date.now()).slice(-6)}`;
    const result = await query(
      `INSERT INTO stock_adjustments (adjustment_number, type, status, reason, adjustments, total_variance, total_cost_impact, warehouse, requested_by, approved_by, completed_by, requested_date, approved_date, completed_date, notes, attachments, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        adjNumber,
        data.type,
        data.status || 'pending',
        data.reason,
        JSON.stringify(adjustments),
        data.totalVariance ?? data.total_variance ?? totalVariance,
        data.totalCostImpact ?? data.total_cost_impact ?? totalCostImpact,
        data.warehouse || 'Main Warehouse',
        data.requestedBy || data.requested_by,
        data.approvedBy || data.approved_by || null,
        data.completedBy || data.completed_by || null,
        data.requestedDate || data.requested_date || new Date(),
        data.approvedDate || data.approved_date || null,
        data.completedDate || data.completed_date || null,
        data.notes || null,
        data.attachments ? JSON.stringify(data.attachments) : '[]'
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = { status: 'status', reason: 'reason', adjustments: 'adjustments', totalVariance: 'total_variance', totalCostImpact: 'total_cost_impact', warehouse: 'warehouse', approvedBy: 'approved_by', approvedDate: 'approved_date', completedBy: 'completed_by', completedDate: 'completed_date', notes: 'notes', attachments: 'attachments' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE stock_adjustments SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
}

module.exports = new StockAdjustmentRepository();
