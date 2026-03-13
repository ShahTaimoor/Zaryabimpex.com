const { query, transaction } = require('../../config/postgres');

/** Generate next PO number (e.g. PO-20250211-1234). */
function generatePONumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-4);
  return `PO-${year}${month}${day}-${time}`;
}

class PurchaseRepository {
  /**
   * Find purchase by ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM purchases WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all purchases with filters
   */
  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM purchases WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;

    if (filters.supplierId) {
      sql += ` AND supplier_id = $${paramCount++}`;
      params.push(filters.supplierId);
    }

    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }

    if (filters.paymentStatus) {
      sql += ` AND payment_status = $${paramCount++}`;
      params.push(filters.paymentStatus);
    }

    if (filters.purchaseOrderNumber) {
      sql += ` AND purchase_order_number ILIKE $${paramCount++}`;
      params.push(`%${filters.purchaseOrderNumber}%`);
    }

    if (filters.dateFrom) {
      sql += ` AND purchase_date::date >= $${paramCount++}::date`;
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ` AND purchase_date::date <= $${paramCount++}::date`;
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
    return result.rows;
  }

  /**
   * Find purchases with pagination
   */
  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    // Get total count
    let countSql = 'SELECT COUNT(*) FROM purchases WHERE deleted_at IS NULL';
    const countParams = [];
    let paramCount = 1;

    if (filters.supplierId) {
      countSql += ` AND supplier_id = $${paramCount++}`;
      countParams.push(filters.supplierId);
    }

    if (filters.status) {
      countSql += ` AND status = $${paramCount++}`;
      countParams.push(filters.status);
    }

    if (filters.paymentStatus) {
      countSql += ` AND payment_status = $${paramCount++}`;
      countParams.push(filters.paymentStatus);
    }
    if (filters.dateFrom) {
      countSql += ` AND purchase_date::date >= $${paramCount++}::date`;
      countParams.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      countSql += ` AND purchase_date::date <= $${paramCount++}::date`;
      countParams.push(filters.dateTo);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const purchases = await this.findAll(filters, {
      ...options,
      limit,
      offset
    });

    return {
      purchases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create a new purchase
   */
  async create(purchaseData) {
    const {
      purchaseOrderNumber,
      supplierId,
      purchaseDate,
      items,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      paymentStatus,
      status,
      notes,
      createdBy
    } = purchaseData;

    const result = await query(
      `INSERT INTO purchases (
        purchase_order_number, supplier_id, purchase_date, items, subtotal, discount, tax, total,
        payment_method, payment_status, status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        purchaseOrderNumber,
        supplierId || null,
        purchaseDate || new Date(),
        JSON.stringify(items || []),
        subtotal || 0,
        discount || 0,
        tax || 0,
        total || 0,
        paymentMethod || null,
        paymentStatus || 'pending',
        status || 'pending',
        notes || null,
        createdBy
      ]
    );

    const purchase = result.rows[0];
    // Parse JSONB items
    if (purchase.items && typeof purchase.items === 'string') {
      purchase.items = JSON.parse(purchase.items);
    }
    return purchase;
  }

  /**
   * Update a purchase
   */
  async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updateData.supplierId !== undefined) {
      fields.push(`supplier_id = $${paramCount++}`);
      values.push(updateData.supplierId);
    }

    if (updateData.purchaseDate !== undefined) {
      fields.push(`purchase_date = $${paramCount++}`);
      values.push(updateData.purchaseDate);
    }

    if (updateData.items !== undefined) {
      fields.push(`items = $${paramCount++}`);
      values.push(JSON.stringify(updateData.items));
    }

    if (updateData.subtotal !== undefined) {
      fields.push(`subtotal = $${paramCount++}`);
      values.push(updateData.subtotal);
    }

    if (updateData.discount !== undefined) {
      fields.push(`discount = $${paramCount++}`);
      values.push(updateData.discount);
    }

    if (updateData.tax !== undefined) {
      fields.push(`tax = $${paramCount++}`);
      values.push(updateData.tax);
    }

    if (updateData.total !== undefined) {
      fields.push(`total = $${paramCount++}`);
      values.push(updateData.total);
    }

    if (updateData.paymentMethod !== undefined) {
      fields.push(`payment_method = $${paramCount++}`);
      values.push(updateData.paymentMethod);
    }

    if (updateData.paymentStatus !== undefined) {
      fields.push(`payment_status = $${paramCount++}`);
      values.push(updateData.paymentStatus);
    }

    if (updateData.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(updateData.status);
    }

    if (updateData.notes !== undefined) {
      fields.push(`notes = $${paramCount++}`);
      values.push(updateData.notes);
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
      UPDATE purchases 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await query(sql, values);
    const purchase = result.rows[0];
    if (purchase && purchase.items && typeof purchase.items === 'string') {
      purchase.items = JSON.parse(purchase.items);
    }
    return purchase;
  }

  /**
   * Soft delete a purchase (alias: softDelete)
   */
  async delete(id) {
    const result = await query(
      'UPDATE purchases SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    return this.delete(id);
  }

  /**
   * Find purchases by supplier ID
   */
  async findBySupplier(supplierId, options = {}) {
    return await this.findAll({ supplierId }, options);
  }

  /**
   * Find purchases by date range
   */
  async findByDateRange(dateFrom, dateTo, options = {}) {
    return await this.findAll({ dateFrom, dateTo }, options);
  }

  /**
   * Get purchases summary statistics
   */
  async getSummary(filters = {}) {
    let sql = `
      SELECT 
        COUNT(*) as total_purchases,
        COALESCE(SUM(total), 0) as total_amount,
        COALESCE(SUM(discount), 0) as total_discounts,
        COALESCE(SUM(tax), 0) as total_tax
      FROM purchases
      WHERE deleted_at IS NULL
    `;
    const params = [];
    let paramCount = 1;

    if (filters.dateFrom) {
      sql += ` AND purchase_date::date >= $${paramCount++}::date`;
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ` AND purchase_date::date <= $${paramCount++}::date`;
      params.push(filters.dateTo);
    }

    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }

    const result = await query(sql, params);
    return result.rows[0];
  }
}

const repo = new PurchaseRepository();
repo.generatePONumber = generatePONumber;
module.exports = repo;
