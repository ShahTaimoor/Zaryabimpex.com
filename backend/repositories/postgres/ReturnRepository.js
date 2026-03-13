const { query } = require('../../config/postgres');

class ReturnRepository {
  /**
   * Find return by ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM returns WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all returns with filters
   */
  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM returns WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;

    if (filters.customerId) {
      sql += ` AND customer_id = $${paramCount++}`;
      params.push(filters.customerId);
    }

    if (filters.supplierId) {
      sql += ` AND supplier_id = $${paramCount++}`;
      params.push(filters.supplierId);
    }

    if (filters.returnType) {
      sql += ` AND return_type = $${paramCount++}`;
      params.push(filters.returnType);
    }

    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }

    if (filters.referenceId) {
      sql += ` AND reference_id = $${paramCount++}`;
      params.push(filters.referenceId);
    }

    if (filters.returnNumber) {
      sql += ` AND return_number ILIKE $${paramCount++}`;
      params.push(`%${filters.returnNumber}%`);
    }

    if (filters.dateFrom) {
      sql += ` AND return_date >= $${paramCount++}`;
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ` AND return_date <= $${paramCount++}`;
      params.push(filters.dateTo);
    }

    const { toSortString } = require('../../utils/sortParam');
    const sortStr = toSortString(options.sort, 'created_at DESC');
    const [field, direction] = sortStr.split(' ');
    sql += ` ORDER BY ${field} ${direction || 'DESC'}`;

    if (options.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ` OFFSET $${paramCount++}`;
      params.push(options.offset);
    }

    const result = await query(sql, params);
    const rows = result.rows;
    // Parse JSONB items
    rows.forEach(row => {
      if (row.items && typeof row.items === 'string') {
        row.items = JSON.parse(row.items);
      }
    });
    return rows;
  }

  /**
   * Find returns with pagination
   */
  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    // Get total count
    let countSql = 'SELECT COUNT(*) FROM returns WHERE deleted_at IS NULL';
    const countParams = [];
    let paramCount = 1;

    if (filters.customerId) {
      countSql += ` AND customer_id = $${paramCount++}`;
      countParams.push(filters.customerId);
    }

    if (filters.supplierId) {
      countSql += ` AND supplier_id = $${paramCount++}`;
      countParams.push(filters.supplierId);
    }

    if (filters.returnType) {
      countSql += ` AND return_type = $${paramCount++}`;
      countParams.push(filters.returnType);
    }

    if (filters.status) {
      countSql += ` AND status = $${paramCount++}`;
      countParams.push(filters.status);
    }

    if (filters.dateFrom) {
      countSql += ` AND return_date >= $${paramCount++}`;
      countParams.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      countSql += ` AND return_date <= $${paramCount++}`;
      countParams.push(filters.dateTo);
    }

    if (filters.returnNumber) {
      countSql += ` AND return_number ILIKE $${paramCount++}`;
      countParams.push(`%${filters.returnNumber}%`);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const returns = await this.findAll(filters, {
      ...options,
      limit,
      offset
    });

    return {
      returns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Generate next return number: RET-YYYYMMDD-NNNN
   * @param {Object} [client] - Optional pg client for use inside a transaction
   */
  async getNextReturnNumber(client = null) {
    const q = client ? client.query.bind(client) : query;
    const prefix = `RET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
    const result = await q(
      `SELECT return_number FROM returns WHERE return_number LIKE $1 ORDER BY return_number DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let seq = 1;
    if (result.rows.length > 0) {
      const last = result.rows[0].return_number;
      const num = parseInt(last.slice(prefix.length), 10);
      if (!isNaN(num)) seq = num + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Create a new return
   * @param {Object} returnData - Return payload
   * @param {Object} [client] - Optional pg client for use inside a transaction
   */
  async create(returnData, client = null) {
    const {
      returnNumber,
      returnType,
      referenceId,
      customerId,
      supplierId,
      returnDate,
      items,
      totalAmount,
      reason,
      status,
      createdBy,
      refundDetails
    } = returnData;

    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `INSERT INTO returns (
        return_number, return_type, reference_id, customer_id, supplier_id, return_date, items,
        total_amount, reason, status, created_by, refund_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        returnNumber,
        returnType,
        referenceId,
        customerId || null,
        supplierId || null,
        returnDate || new Date(),
        JSON.stringify(items || []),
        totalAmount || 0,
        reason || null,
        status || 'pending',
        createdBy,
        refundDetails ? JSON.stringify(refundDetails) : null
      ]
    );

    const returnRecord = result.rows[0];
    // Parse JSONB items
    if (returnRecord.items && typeof returnRecord.items === 'string') {
      returnRecord.items = JSON.parse(returnRecord.items);
    }
    return returnRecord;
  }

  /**
   * Update a return
   * @param {string} id - Return id
   * @param {Object} updateData - Fields to update
   * @param {Object} [client] - Optional pg client for use inside a transaction
   */
  async update(id, updateData, client = null) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updateData.customerId !== undefined) {
      fields.push(`customer_id = $${paramCount++}`);
      values.push(updateData.customerId);
    }

    if (updateData.supplierId !== undefined) {
      fields.push(`supplier_id = $${paramCount++}`);
      values.push(updateData.supplierId);
    }

    if (updateData.returnDate !== undefined) {
      fields.push(`return_date = $${paramCount++}`);
      values.push(updateData.returnDate);
    }

    if (updateData.items !== undefined) {
      fields.push(`items = $${paramCount++}`);
      values.push(JSON.stringify(updateData.items));
    }

    if (updateData.totalAmount !== undefined) {
      fields.push(`total_amount = $${paramCount++}`);
      values.push(updateData.totalAmount);
    }

    if (updateData.reason !== undefined) {
      fields.push(`reason = $${paramCount++}`);
      values.push(updateData.reason);
    }

    if (updateData.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(updateData.status);
    }

    if (updateData.inspection !== undefined) {
      fields.push(`inspection = $${paramCount++}`);
      values.push(JSON.stringify(updateData.inspection));
    }

    if (updateData.refundDetails !== undefined) {
      fields.push(`refund_details = $${paramCount++}`);
      values.push(JSON.stringify(updateData.refundDetails));
    }

    if (updateData.updatedBy !== undefined) {
      fields.push(`updated_by = $${paramCount++}`);
      values.push(updateData.updatedBy);
    }

    if (fields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE returns 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const q = client ? client.query.bind(client) : query;
    const result = await q(sql, values);
    const returnRecord = result.rows[0];
    if (returnRecord && returnRecord.items && typeof returnRecord.items === 'string') {
      returnRecord.items = JSON.parse(returnRecord.items);
    }
    return returnRecord;
  }

  /**
   * Soft delete a return
   */
  async delete(id) {
    const result = await query(
      'UPDATE returns SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find returns by customer ID
   */
  async findByCustomer(customerId, options = {}) {
    return await this.findAll({ customerId }, options);
  }

  /**
   * Find returns by supplier ID
   */
  async findBySupplier(supplierId, options = {}) {
    return await this.findAll({ supplierId }, options);
  }

  /**
   * Find returns by reference ID (sales or purchase ID)
   */
  async findByReference(referenceId, options = {}) {
    return await this.findAll({ referenceId }, options);
  }

  /**
   * Count returns matching filters (supports MongoDB-style returnDate or dateFrom/dateTo)
   */
  async count(filters = {}) {
    let sql = 'SELECT COUNT(*) FROM returns WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;

    if (filters.dateFrom) {
      sql += ` AND return_date >= $${paramCount++}`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      sql += ` AND return_date <= $${paramCount++}`;
      params.push(filters.dateTo);
    }
    if (filters.returnDate && typeof filters.returnDate === 'object') {
      if (filters.returnDate.$gte) {
        sql += ` AND return_date >= $${paramCount++}`;
        params.push(filters.returnDate.$gte);
      }
      if (filters.returnDate.$lte) {
        sql += ` AND return_date <= $${paramCount++}`;
        params.push(filters.returnDate.$lte);
      }
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.returnType) {
      sql += ` AND return_type = $${paramCount++}`;
      params.push(filters.returnType);
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get return statistics for a period (for returnManagementService.getReturnStats)
   */
  async getStats(period = {}) {
    const startDate = period.startDate || null;
    const endDate = period.endDate || null;
    const returnType = period.origin === 'sales' ? 'sale_return' : (period.origin === 'purchase' ? 'purchase_return' : null);
    const filters = {};
    if (startDate) filters.dateFrom = startDate;
    if (endDate) filters.dateTo = endDate;
    if (returnType) filters.returnType = returnType;

    const summaryRows = await this.getSummary(filters);
    let totalRefundAmount = 0;
    let totalRestockingFee = 0;
    const byStatus = [];
    const byType = [];

    for (const row of summaryRows) {
      const amount = parseFloat(row.total_amount) || 0;
      totalRefundAmount += amount;
      if (row.status) byStatus.push(row.status);
      if (row.return_type) byType.push(row.return_type);
    }

    return {
      totalRefundAmount,
      totalRestockingFee,
      netRefundAmount: totalRefundAmount - totalRestockingFee,
      byStatus: [...new Set(byStatus)],
      byType: [...new Set(byType)]
    };
  }

  /**
   * Get returns summary statistics
   */
  async getSummary(filters = {}) {
    let sql = `
      SELECT 
        COUNT(*) as total_returns,
        COALESCE(SUM(total_amount), 0) as total_amount,
        return_type,
        status
      FROM returns
      WHERE deleted_at IS NULL
    `;
    const params = [];
    let paramCount = 1;

    if (filters.dateFrom) {
      sql += ` AND return_date >= $${paramCount++}`;
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ` AND return_date <= $${paramCount++}`;
      params.push(filters.dateTo);
    }

    if (filters.returnType) {
      sql += ` AND return_type = $${paramCount++}`;
      params.push(filters.returnType);
    }

    sql += ' GROUP BY return_type, status';

    const result = await query(sql, params);
    return result.rows;
  }
}

module.exports = new ReturnRepository();
