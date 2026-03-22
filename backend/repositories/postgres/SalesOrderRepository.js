const { query } = require('../../config/postgres');
const {
  ensureItemConfirmationStatus,
  computeOrderConfirmationStatus,
  recalculateTotalsFromItems,
  getSalesOrderLineTotal
} = require('../../utils/orderConfirmationUtils');

class SalesOrderRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM sales_orders WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM sales_orders WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;

    if (filters.customer || filters.customerId) {
      sql += ` AND customer_id = $${paramCount++}`;
      params.push(filters.customer || filters.customerId);
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.searchTerm) {
      const term = `%${filters.searchTerm}%`;
      sql += ` AND (so_number ILIKE $${paramCount} OR notes ILIKE $${paramCount}`;
      params.push(term);
      paramCount++;
      if (filters.searchCustomerIds && filters.searchCustomerIds.length > 0) {
        sql += ` OR customer_id = ANY($${paramCount++}::uuid[])`;
        params.push(filters.searchCustomerIds);
      }
      sql += ')';
    }
    if (filters.soNumberIlike) {
      sql += ` AND so_number ILIKE $${paramCount++}`;
      params.push(`%${filters.soNumberIlike}%`);
    }
    if (filters.notesIlike && !filters.searchTerm) {
      sql += ` AND notes ILIKE $${paramCount++}`;
      params.push(`%${filters.notesIlike}%`);
    }
    if (filters.customerIds && filters.customerIds.length > 0 && !filters.searchTerm) {
      sql += ` AND customer_id = ANY($${paramCount++}::uuid[])`;
      params.push(filters.customerIds);
    }
    if (filters.createdAtFrom) {
      sql += ` AND created_at >= $${paramCount++}`;
      params.push(filters.createdAtFrom);
    }
    if (filters.createdAtTo) {
      sql += ` AND created_at <= $${paramCount++}`;
      params.push(filters.createdAtTo);
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
    if (filters.soNumber) {
      const result = await query(
        'SELECT * FROM sales_orders WHERE so_number = $1 AND deleted_at IS NULL LIMIT 1',
        [(filters.soNumber || '').toUpperCase()]
      );
      return result.rows[0] || null;
    }
    if (filters._id || filters.id) return this.findById(filters._id || filters.id);
    return null;
  }

  async findBySONumber(soNumber, options = {}) {
    return this.findOne({ soNumber: (soNumber || '').toUpperCase() });
  }

  async findByCustomer(customerId, options = {}) {
    return this.findAll({ customer: customerId, customerId }, options);
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const getAll = options.getAll === true;

    let countSql = 'SELECT COUNT(*) FROM sales_orders WHERE deleted_at IS NULL';
    const countParams = [];
    let paramCount = 1;
    if (filter.customerId || filter.customer) {
      countSql += ` AND customer_id = $${paramCount++}`;
      countParams.push(filter.customerId || filter.customer);
    }
    if (filter.status) {
      countSql += ` AND status = $${paramCount++}`;
      countParams.push(filter.status);
    }
    if (filter.searchTerm) {
      const term = `%${filter.searchTerm}%`;
      countSql += ` AND (so_number ILIKE $${paramCount} OR notes ILIKE $${paramCount}`;
      countParams.push(term);
      paramCount++;
      if (filter.searchCustomerIds && filter.searchCustomerIds.length > 0) {
        countSql += ` OR customer_id = ANY($${paramCount++}::uuid[])`;
        countParams.push(filter.searchCustomerIds);
      }
      countSql += ')';
    }
    if (filter.soNumberIlike) {
      countSql += ` AND so_number ILIKE $${paramCount++}`;
      countParams.push(`%${filter.soNumberIlike}%`);
    }
    if (filter.notesIlike && !filter.searchTerm) {
      countSql += ` AND notes ILIKE $${paramCount++}`;
      countParams.push(`%${filter.notesIlike}%`);
    }
    if (filter.customerIds && filter.customerIds.length > 0 && !filter.searchTerm) {
      countSql += ` AND customer_id = ANY($${paramCount++}::uuid[])`;
      countParams.push(filter.customerIds);
    }
    if (filter.createdAtFrom) {
      countSql += ` AND created_at >= $${paramCount++}`;
      countParams.push(filter.createdAtFrom);
    }
    if (filter.createdAtTo) {
      countSql += ` AND created_at <= $${paramCount++}`;
      countParams.push(filter.createdAtTo);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const salesOrders = await this.findAll(filter, {
      limit: getAll ? total : limit,
      offset: getAll ? 0 : offset
    });

    return {
      salesOrders,
      total,
      pagination: getAll
        ? { current: 1, pages: 1, total, hasNext: false, hasPrev: false }
        : { current: page, pages: Math.ceil(total / limit), total, hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 }
    };
  }

  async findByStatus(status, options = {}) {
    return this.findAll({ status }, options);
  }

  /** Generate unique SO number (SO-YYYYMMDD-XXXX) */
  generateSONumber() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const t = String(now.getTime()).slice(-4);
    return `SO-${y}${m}${d}-${t}`;
  }

  async create(data) {
    const rawItems = data.items || [];
    const items = ensureItemConfirmationStatus(rawItems);
    const tax = data.tax ?? 0;
    const { subtotal, total } = recalculateTotalsFromItems(items, getSalesOrderLineTotal, tax);
    const computedSubtotal = data.subtotal ?? subtotal;
    const computedTotal = data.total ?? total;
    const confirmationStatus = computeOrderConfirmationStatus(items);

    const result = await query(
      `INSERT INTO sales_orders (
        so_number, customer_id, items, subtotal, tax, is_tax_exempt, total, status, confirmation_status,
        order_date, expected_delivery, confirmed_date, last_invoiced_date, notes, terms,
        conversions, ledger_posted, auto_posted, posted_at, ledger_reference_id, invoice_id, auto_converted,
        created_by, last_modified_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        (data.soNumber || data.so_number || '').toUpperCase(),
        data.customer || data.customerId,
        JSON.stringify(items),
        computedSubtotal,
        tax,
        data.isTaxExempt !== false,
        computedTotal,
        data.status || 'draft',
        confirmationStatus,
        data.orderDate || data.order_date || new Date(),
        data.expectedDelivery || data.expected_delivery || null,
        data.confirmedDate || data.confirmed_date || null,
        data.lastInvoicedDate || data.last_invoiced_date || null,
        data.notes || null,
        data.terms || null,
        data.conversions ? JSON.stringify(data.conversions) : '[]',
        data.ledgerPosted === true,
        data.autoPosted === true,
        data.postedAt || data.posted_at || null,
        data.ledgerReferenceId || data.ledger_reference_id || null,
        data.invoiceId || data.invoice_id || null,
        data.autoConverted === true,
        data.createdBy || data.created_by,
        data.lastModifiedBy || data.last_modified_by || null
      ]
    );
    return result.rows[0];
  }

  async update(id, data, options = {}) {
    return this.updateById(id, data);
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      customer: 'customer_id', customerId: 'customer_id',
      items: 'items', subtotal: 'subtotal', tax: 'tax', isTaxExempt: 'is_tax_exempt', total: 'total',
      status: 'status', confirmationStatus: 'confirmation_status',
      orderDate: 'order_date', expectedDelivery: 'expected_delivery',
      confirmedDate: 'confirmed_date', lastInvoicedDate: 'last_invoiced_date', notes: 'notes', terms: 'terms',
      conversions: 'conversions', ledgerPosted: 'ledger_posted', autoPosted: 'auto_posted',
      postedAt: 'posted_at', ledgerReferenceId: 'ledger_reference_id', invoiceId: 'invoice_id',
      lastModifiedBy: 'last_modified_by'
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
      `UPDATE sales_orders SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      'UPDATE sales_orders SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    return this.softDelete(id);
  }
}

module.exports = new SalesOrderRepository();
