const { query } = require('../../config/postgres');

function generatePONumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const t = String(now.getTime()).slice(-4);
  return `PO-${y}${m}${d}-${t}`;
}

class PurchaseOrderRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM purchase_orders WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM purchase_orders WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;

    if (filters.supplier || filters.supplierId) {
      sql += ` AND supplier_id = $${paramCount++}`;
      params.push(filters.supplier || filters.supplierId);
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.dateFrom || filters.createdAt?.$gte) {
      sql += ` AND order_date >= $${paramCount++}`;
      params.push(filters.dateFrom || filters.createdAt?.$gte);
    }
    if (filters.dateTo || filters.createdAt?.$lt) {
      sql += ` AND order_date < $${paramCount++}`;
      params.push(filters.dateTo || filters.createdAt?.$lt);
    }

    sql += ' ORDER BY created_at DESC';
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
    if (filters.poNumber) {
      const result = await query(
        'SELECT * FROM purchase_orders WHERE po_number = $1 AND deleted_at IS NULL LIMIT 1',
        [(filters.poNumber || '').toUpperCase()]
      );
      return result.rows[0] || null;
    }
    if (filters._id || filters.id) {
      return this.findById(filters._id || filters.id);
    }
    return null;
  }

  async findByPONumber(poNumber, options = {}) {
    return this.findOne({ poNumber: (poNumber || '').toUpperCase() });
  }

  async findBySupplier(supplierId, options = {}) {
    return this.findAll({ supplier: supplierId, supplierId }, options);
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const getAll = options.getAll === true;

    let countSql = 'SELECT COUNT(*) FROM purchase_orders WHERE deleted_at IS NULL';
    const countParams = [];
    let paramCount = 1;
    if (filter.supplierId || filter.supplier) {
      countSql += ` AND supplier_id = $${paramCount++}`;
      countParams.push(filter.supplierId || filter.supplier);
    }
    if (filter.status) {
      countSql += ` AND status = $${paramCount++}`;
      countParams.push(filter.status);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const purchaseOrders = await this.findAll(filter, {
      limit: getAll ? total : limit,
      offset: getAll ? 0 : offset
    });

    return {
      purchaseOrders,
      total,
      pagination: getAll
        ? { current: 1, pages: 1, total, hasNext: false, hasPrev: false }
        : { current: page, pages: Math.ceil(total / limit), total, hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 }
    };
  }

  async findByStatus(status, options = {}) {
    return this.findAll({ status }, options);
  }

  async findByDateRange(dateFrom, dateTo, options = {}) {
    return this.findAll({ dateFrom, dateTo, createdAt: { $gte: dateFrom, $lt: dateTo } }, options);
  }

  async findByProducts(productIds, options = {}) {
    if (!Array.isArray(productIds) || productIds.length === 0) return [];
    const result = await query(
      `SELECT * FROM purchase_orders WHERE deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(items) AS elem WHERE (elem->>'product')::uuid = ANY($1::uuid[])
      ) ORDER BY created_at DESC LIMIT $2`,
      [productIds, options.limit || 100]
    );
    return result.rows;
  }

  async create(data) {
    const items = data.items || [];
    const subtotal = data.subtotal ?? items.reduce((s, i) => s + (i.quantity * (i.costPerUnit || i.cost_per_unit || 0)), 0);
    const tax = data.tax ?? 0;
    const total = data.total ?? subtotal + tax;
    const result = await query(
      `INSERT INTO purchase_orders (
        po_number, supplier_id, items, subtotal, tax, is_tax_exempt, total, status,
        order_date, expected_delivery, confirmed_date, last_received_date, notes, terms,
        conversions, ledger_posted, auto_posted, posted_at, ledger_reference_id, auto_converted,
        created_by, last_modified_by, is_auto_generated, auto_generated_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        (data.poNumber || data.po_number || '').toUpperCase(),
        data.supplier || data.supplierId,
        JSON.stringify(items),
        subtotal,
        tax,
        data.isTaxExempt !== false,
        total,
        data.status || 'draft',
        data.orderDate || data.order_date || new Date(),
        data.expectedDelivery || data.expected_delivery || null,
        data.confirmedDate || data.confirmed_date || null,
        data.lastReceivedDate || data.last_received_date || null,
        data.notes || null,
        data.terms || null,
        data.conversions ? JSON.stringify(data.conversions) : '[]',
        data.ledgerPosted === true,
        data.autoPosted === true,
        data.postedAt || data.posted_at || null,
        data.ledgerReferenceId || data.ledger_reference_id || null,
        data.autoConverted === true,
        data.createdBy || data.created_by,
        data.lastModifiedBy || data.last_modified_by || null,
        data.isAutoGenerated === true,
        data.autoGeneratedAt || data.auto_generated_at || null
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      items: 'items', subtotal: 'subtotal', tax: 'tax', isTaxExempt: 'is_tax_exempt', total: 'total',
      status: 'status', orderDate: 'order_date', expectedDelivery: 'expected_delivery',
      confirmedDate: 'confirmed_date', lastReceivedDate: 'last_received_date', notes: 'notes', terms: 'terms',
      conversions: 'conversions', ledgerPosted: 'ledger_posted', autoPosted: 'auto_posted',
      postedAt: 'posted_at', ledgerReferenceId: 'ledger_reference_id', lastModifiedBy: 'last_modified_by'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push((typeof data[k] === 'object' || Array.isArray(data[k])) ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      'UPDATE purchase_orders SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }
}

const repo = new PurchaseOrderRepository();
repo.generatePONumber = generatePONumber;
module.exports = repo;
