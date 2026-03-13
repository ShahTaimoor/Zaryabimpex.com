const { query } = require('../../config/postgres');

class DropShippingRepository {
  async findById(id) {
    const result = await query('SELECT * FROM drop_shipping WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM drop_shipping WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;
    if (filters.supplierId || filters.supplier) { sql += ` AND supplier_id = $${paramCount++}`; params.push(filters.supplierId || filters.supplier); }
    if (filters.customerId || filters.customer) { sql += ` AND customer_id = $${paramCount++}`; params.push(filters.customerId || filters.customer); }
    if (filters.status) { sql += ` AND status = $${paramCount++}`; params.push(filters.status); }
    if (filters.transactionDateFrom || (filters.transactionDate && filters.transactionDate.$gte)) {
      sql += ` AND order_date >= $${paramCount++}`;
      params.push(filters.transactionDateFrom || filters.transactionDate.$gte);
    }
    if (filters.transactionDateTo || (filters.transactionDate && filters.transactionDate.$lte)) {
      sql += ` AND order_date <= $${paramCount++}`;
      params.push(filters.transactionDateTo || filters.transactionDate.$lte);
    }
    if (filters.searchIlike) {
      sql += ` AND (transaction_number ILIKE $${paramCount} OR supplier_info::text ILIKE $${paramCount} OR customer_info::text ILIKE $${paramCount})`;
      params.push(`%${filters.searchIlike}%`);
      paramCount++;
    }
    sql += ' ORDER BY order_date DESC, created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    const countParams = [];
    let countSql = 'SELECT COUNT(*) FROM drop_shipping WHERE deleted_at IS NULL';
    let paramCount = 1;
    if (filter.supplierId || filter.supplier) { countSql += ` AND supplier_id = $${paramCount++}`; countParams.push(filter.supplierId || filter.supplier); }
    if (filter.customerId || filter.customer) { countSql += ` AND customer_id = $${paramCount++}`; countParams.push(filter.customerId || filter.customer); }
    if (filter.status) { countSql += ` AND status = $${paramCount++}`; countParams.push(filter.status); }
    if (filter.transactionDateFrom || (filter.transactionDate && filter.transactionDate.$gte)) {
      countSql += ` AND order_date >= $${paramCount++}`;
      countParams.push(filter.transactionDateFrom || filter.transactionDate.$gte);
    }
    if (filter.transactionDateTo || (filter.transactionDate && filter.transactionDate.$lte)) {
      countSql += ` AND order_date <= $${paramCount++}`;
      countParams.push(filter.transactionDateTo || filter.transactionDate.$lte);
    }
    if (filter.searchIlike) {
      countSql += ` AND (transaction_number ILIKE $${paramCount} OR supplier_info::text ILIKE $${paramCount} OR customer_info::text ILIKE $${paramCount})`;
      countParams.push(`%${filter.searchIlike}%`);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);
    const listFilter = { ...filter };
    const transactions = await this.findAll(listFilter, { limit, offset });
    return {
      transactions,
      total,
      pagination: { current: page, pages: Math.ceil(total / limit) || 1, total, limit }
    };
  }

  async getStats(filter = {}) {
    let sql = `SELECT COUNT(*)::int AS total_transactions,
      COALESCE(SUM(total), 0)::decimal AS total_customer_amount,
      COALESCE(SUM(supplier_total), 0)::decimal AS total_supplier_amount,
      COALESCE(SUM(profit_amount), 0)::decimal AS total_profit
      FROM drop_shipping WHERE deleted_at IS NULL`;
    const params = [];
    let n = 1;
    if (filter.transactionDateFrom || (filter.transactionDate && filter.transactionDate.$gte)) {
      sql += ` AND order_date >= $${n++}`;
      params.push(filter.transactionDateFrom || filter.transactionDate.$gte);
    }
    if (filter.transactionDateTo || (filter.transactionDate && filter.transactionDate.$lte)) {
      sql += ` AND order_date <= $${n++}`;
      params.push(filter.transactionDateTo || filter.transactionDate.$lte);
    }
    const result = await query(sql, params);
    const row = result.rows[0] || {};
    return [{
      totalTransactions: parseInt(row.total_transactions, 10) || 0,
      totalCustomerAmount: parseFloat(row.total_customer_amount) || 0,
      totalSupplierAmount: parseFloat(row.total_supplier_amount) || 0,
      totalProfit: parseFloat(row.total_profit) || 0,
      avgMargin: 0
    }];
  }

  async getStatusBreakdown(filter = {}) {
    let sql = 'SELECT status, COUNT(*)::int AS count FROM drop_shipping WHERE deleted_at IS NULL';
    const params = [];
    let n = 1;
    if (filter.transactionDateFrom || (filter.transactionDate && filter.transactionDate.$gte)) {
      sql += ` AND order_date >= $${n++}`;
      params.push(filter.transactionDateFrom || filter.transactionDate.$gte);
    }
    if (filter.transactionDateTo || (filter.transactionDate && filter.transactionDate.$lte)) {
      sql += ` AND order_date <= $${n++}`;
      params.push(filter.transactionDateTo || filter.transactionDate.$lte);
    }
    sql += ' GROUP BY status';
    const result = await query(sql, params);
    return result.rows;
  }

  async findOne(filters = {}) {
    if (filters.transactionNumber) {
      const result = await query('SELECT * FROM drop_shipping WHERE transaction_number = $1 AND deleted_at IS NULL LIMIT 1', [(filters.transactionNumber || '').toUpperCase()]);
      return result.rows[0] || null;
    }
    if (filters.id || filters._id) return this.findById(filters.id || filters._id);
    return null;
  }

  async create(data) {
    const items = data.items || [];
    const subtotal = data.subtotal ?? items.reduce((s, i) => s + (i.customerAmount || i.customer_amount || 0), 0);
    const result = await query(
      `INSERT INTO drop_shipping (transaction_number, supplier_id, supplier_info, bill_number, supplier_description, customer_id, customer_info, items, subtotal, tax, total, supplier_total, profit_amount, status, order_date, notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        (data.transactionNumber || data.transaction_number || '').toUpperCase(),
        data.supplier || data.supplierId,
        data.supplierInfo ? JSON.stringify(data.supplierInfo) : null,
        data.billNumber || data.bill_number || null,
        data.supplierDescription || data.supplier_description || null,
        data.customer || data.customerId || null,
        data.customerInfo ? JSON.stringify(data.customerInfo) : null,
        JSON.stringify(items),
        data.subtotal ?? subtotal,
        data.tax ?? 0,
        data.total ?? subtotal + (data.tax || 0),
        data.supplierTotal ?? data.supplier_total ?? 0,
        data.profitAmount ?? data.profit_amount ?? 0,
        data.status || 'pending',
        data.orderDate || data.order_date || new Date(),
        data.notes || null,
        data.createdBy || data.created_by || null
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = { status: 'status', items: 'items', total: 'total', notes: 'notes', supplierId: 'supplier_id', supplierInfo: 'supplier_info', customerId: 'customer_id', customerInfo: 'customer_info' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(`UPDATE drop_shipping SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`, params);
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query('UPDATE drop_shipping SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }
}

module.exports = new DropShippingRepository();
