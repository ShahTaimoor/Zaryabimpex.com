const { query, transaction } = require('../../config/postgres');
const { decodeCursor, encodeCursor } = require('../../utils/keysetCursor');

function run(q, params, client) {
  return client ? client.query(q, params) : query(q, params);
}

/**
 * Shared WHERE fragment for sales list/count (alias: table alias, e.g. "s").
 * Starts after `... WHERE s.deleted_at IS NULL`
 */
function buildSalesFilterSql(filters, params, startIdx, alias = 's') {
  const col = (name) => `${alias}.${name}`;
  let sql = '';
  let p = startIdx;

  if (filters.customerId) {
    sql += ` AND ${col('customer_id')} = $${p++}`;
    params.push(filters.customerId);
  }

  if (filters.customerIds && filters.customerIds.length > 0) {
    sql += ` AND ${col('customer_id')} = ANY($${p++}::uuid[])`;
    params.push(filters.customerIds);
  }

  if (filters.status) {
    sql += ` AND ${col('status')} = $${p++}`;
    params.push(filters.status);
  }

  if (filters.paymentStatus) {
    sql += ` AND ${col('payment_status')} = $${p++}`;
    params.push(filters.paymentStatus);
  }

  if (filters.orderNumber) {
    sql += ` AND ${col('order_number')} ILIKE $${p++}`;
    params.push(`%${filters.orderNumber}%`);
  }

  if (filters.search) {
    const searchPattern = `%${String(filters.search).trim()}%`;
    if (filters.searchCustomerIds && filters.searchCustomerIds.length > 0) {
      sql += ` AND (${col('order_number')} ILIKE $${p++} OR ${col('notes')} ILIKE $${p++} OR ${col('customer_id')} = ANY($${p++}::uuid[]))`;
      params.push(searchPattern, searchPattern, filters.searchCustomerIds);
    } else {
      sql += ` AND (${col('order_number')} ILIKE $${p++} OR ${col('notes')} ILIKE $${p++})`;
      params.push(searchPattern, searchPattern);
    }
  }

  if (filters.dateFrom) {
    sql += ` AND ${col('sale_date')} >= $${p++}`;
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    sql += ` AND ${col('sale_date')} <= $${p++}`;
    params.push(filters.dateTo);
  }

  if (filters.productIds && filters.productIds.length > 0) {
    if (filters.productIds.includes('__none__')) {
      sql += ' AND 1 = 0';
    } else {
      sql += ` AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(${col('items')}::jsonb, '[]'::jsonb)) AS elem
          WHERE (elem->>'product') = ANY($${p}::text[])
        )`;
      params.push(filters.productIds.map((id) => String(id)));
      p++;
    }
  }

  if (filters.excludeStatuses && filters.excludeStatuses.length > 0) {
    sql += ` AND NOT (${col('status')} = ANY($${p++}::text[]))`;
    params.push(filters.excludeStatuses);
  }

  if (filters.requireCustomerId) {
    sql += ` AND ${col('customer_id')} IS NOT NULL`;
  }

  return { sql, nextIdx: p };
}

class SalesRepository {
  /**
   * Find sale by ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    const sale = result.rows[0] || null;
    if (sale && sale.items && typeof sale.items === 'string') {
      try { sale.items = JSON.parse(sale.items); } catch (_) { sale.items = []; }
    }
    return sale;
  }

  /**
   * Find all sales with filters
   * @param {object} options
   * @param {'full'|'minimal'} [options.listMode] - minimal omits line items JSON (uses line_item_count only)
   * @param {object} [options.cursor] - { t: ISO string, id: uuid } for keyset (requires ORDER BY created_at DESC, id DESC)
   */
  async findAll(filters = {}, options = {}) {
    const listMode = options.listMode === 'minimal' ? 'minimal' : 'full';
    const params = [];
    const alias = 's';
    const baseWhere = `FROM sales ${alias} WHERE ${alias}.deleted_at IS NULL`;
    const { sql: filterSql, nextIdx } = buildSalesFilterSql(filters, params, 1, alias);
    let sql = '';

    if (listMode === 'minimal') {
      sql = `SELECT ${alias}.id, ${alias}.order_number, ${alias}.customer_id, ${alias}.sale_date,
        ${alias}.subtotal, ${alias}.discount, ${alias}.tax, ${alias}.total,
        ${alias}.payment_method, ${alias}.payment_status, ${alias}.status, ${alias}.notes,
        ${alias}.created_by, ${alias}.updated_by, ${alias}.created_at, ${alias}.updated_at,
        ${alias}.amount_paid, ${alias}.applied_discounts, ${alias}.order_type,
        jsonb_array_length(COALESCE(${alias}.items::jsonb, '[]'::jsonb))::int AS line_item_count
        ${baseWhere}`;
    } else {
      sql = `SELECT ${alias}.* ${baseWhere}`;
    }
    sql += filterSql;

    let paramCount = nextIdx;
    const cursorDecoded = options.cursor && typeof options.cursor === 'object' ? options.cursor : null;
    if (cursorDecoded && cursorDecoded.t && cursorDecoded.id) {
      sql += ` AND (${alias}.created_at, ${alias}.id) < ($${paramCount++}::timestamptz, $${paramCount++}::uuid)`;
      params.push(cursorDecoded.t, cursorDecoded.id);
    }

    const { toSortString } = require('../../utils/sortParam');
    const useKeysetOrder = Boolean(cursorDecoded);
    if (useKeysetOrder) {
      sql += ` ORDER BY ${alias}.created_at DESC, ${alias}.id DESC`;
    } else {
      const sortStr = toSortString(options.sort, 'created_at DESC');
      const [field, direction] = sortStr.split(' ');
      const allowed = ['created_at', 'sale_date', 'order_number', 'total', 'status', 'payment_status'];
      const col = allowed.includes(field) ? field : 'created_at';
      const dir = (direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      sql += ` ORDER BY ${alias}.${col} ${dir}, ${alias}.id DESC`;
    }

    if (options.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(options.limit);
    }

    if (!cursorDecoded && options.offset) {
      sql += ` OFFSET $${paramCount++}`;
      params.push(options.offset);
    }

    const result = await query(sql, params);
    const rows = result.rows || [];
    rows.forEach((sale) => {
      if (listMode === 'minimal') {
        const n = sale.line_item_count;
        delete sale.line_item_count;
        sale.lineItemCount = typeof n === 'number' ? n : parseInt(n, 10) || 0;
        sale.items = [];
      } else if (sale && sale.items && typeof sale.items === 'string') {
        try {
          sale.items = JSON.parse(sale.items);
        } catch (_) {
          sale.items = [];
        }
      }
    });
    return rows;
  }

  /**
   * Find sales with pagination (offset) or keyset cursor (cursor string)
   */
  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const listMode = options.listMode === 'minimal' ? 'minimal' : 'full';

    const countParams = [];
    const { sql: countFilterSql } = buildSalesFilterSql(filters, countParams, 1, 's');
    const countSql = `SELECT COUNT(*)::bigint AS c FROM sales s WHERE s.deleted_at IS NULL${countFilterSql}`;
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].c, 10);

    const cursorStr = options.cursor || options.keysetCursor;
    const decoded = typeof cursorStr === 'string' ? decodeCursor(cursorStr) : null;

    if (decoded) {
      const fetchLimit = limit + 1;
      const sales = await this.findAll(filters, {
        ...options,
        listMode,
        cursor: decoded,
        limit: fetchLimit,
        offset: undefined
      });
      const hasMore = sales.length > limit;
      const pageRows = hasMore ? sales.slice(0, limit) : sales;
      let nextCursor = null;
      if (hasMore && pageRows.length > 0) {
        const last = pageRows[pageRows.length - 1];
        const ca = last.created_at || last.createdAt;
        nextCursor = encodeCursor(ca, last.id);
      }
      return {
        sales: pageRows,
        pagination: {
          page: null,
          limit,
          total,
          pages: null,
          mode: 'keyset',
          nextCursor,
          hasMore
        }
      };
    }

    const sales = await this.findAll(filters, {
      ...options,
      listMode,
      limit,
      offset
    });

    return {
      sales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        mode: 'offset',
        nextCursor: null,
        hasMore: page * limit < total
      }
    };
  }

  /**
   * Count sales matching filters
   */
  async count(filters = {}) {
    let sql = 'SELECT COUNT(*)::int AS c FROM sales WHERE deleted_at IS NULL';
    const params = [];
    let p = 1;
    if (filters.customerId) {
      sql += ` AND customer_id = $${p++}`;
      params.push(filters.customerId);
    }
    if (filters.status) { sql += ` AND status = $${p++}`; params.push(filters.status); }
    const result = await query(sql, params);
    return parseInt(result.rows[0]?.c || 0, 10);
  }

  /**
   * Create a new sale (optional client for transaction)
   */
  async create(saleData, client) {
    const {
      orderNumber,
      customerId,
      saleDate,
      items,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      paymentStatus,
      status,
      notes,
      createdBy,
      appliedDiscounts,
      orderType,
      amountPaid
    } = saleData;

    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `INSERT INTO sales (
        order_number, customer_id, sale_date, items, subtotal, discount, tax, total,
        payment_method, payment_status, status, notes, created_by, applied_discounts, order_type, amount_paid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        orderNumber,
        customerId || null,
        saleDate || new Date(),
        JSON.stringify(items || []),
        subtotal || 0,
        discount || 0,
        tax || 0,
        total || 0,
        paymentMethod || null,
        paymentStatus || 'pending',
        status || 'pending',
        notes || null,
        createdBy,
        JSON.stringify(Array.isArray(appliedDiscounts) ? appliedDiscounts : []),
        (orderType || 'retail').toLowerCase(),
        amountPaid || 0
      ]
    );

    const sale = result.rows[0];
    // Parse JSONB items
    if (sale.items && typeof sale.items === 'string') {
      sale.items = JSON.parse(sale.items);
    }
    return sale;
  }

  /**
   * Update a sale
   */
  async update(id, updateData, client = null) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updateData.customerId !== undefined) {
      fields.push(`customer_id = $${paramCount++}`);
      values.push(updateData.customerId);
    }

    if (updateData.saleDate !== undefined) {
      fields.push(`sale_date = $${paramCount++}`);
      values.push(updateData.saleDate);
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

    if (updateData.orderType !== undefined) {
      fields.push(`order_type = $${paramCount++}`);
      values.push(String(updateData.orderType).toLowerCase());
    }

    if (updateData.updatedBy !== undefined) {
      fields.push(`updated_by = $${paramCount++}`);
      values.push(updateData.updatedBy);
    }

    if (updateData.appliedDiscounts !== undefined) {
      fields.push(`applied_discounts = $${paramCount++}`);
      values.push(JSON.stringify(updateData.appliedDiscounts));
    }

    if (updateData.amountPaid !== undefined) {
      fields.push(`amount_paid = $${paramCount++}`);
      values.push(updateData.amountPaid);
    }

    if (fields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE sales 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const q = client ? client.query.bind(client) : query;
    const result = await q(sql, values);
    const sale = result.rows[0];
    if (sale && sale.items && typeof sale.items === 'string') {
      sale.items = JSON.parse(sale.items);
    }
    return sale;
  }

  /**
   * Reassign all sales from source customer to target customer (for merge).
   * @param {string} sourceCustomerId
   * @param {string} targetCustomerId
   * @param {object} [client] - Optional pg client for transaction
   */
  async updateCustomerId(sourceCustomerId, targetCustomerId, client = null) {
    const result = await run(
      'UPDATE sales SET customer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE customer_id = $2 AND deleted_at IS NULL',
      [targetCustomerId, sourceCustomerId],
      client
    );
    return result.rowCount || 0;
  }

  /**
   * Soft delete a sale
   */
  async delete(id) {
    const result = await query(
      'UPDATE sales SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find sales by customer ID
   */
  async findByCustomer(customerId, options = {}) {
    return await this.findAll({ customerId }, options);
  }

  /**
   * Find sales by date range
   */
  async findByDateRange(dateFrom, dateTo, options = {}) {
    return await this.findAll({ dateFrom, dateTo }, options);
  }

  /**
   * Get sales summary statistics
   */
  async getSummary(filters = {}) {
    let sql = `
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total), 0) as total_revenue,
        COALESCE(SUM(discount), 0) as total_discounts,
        COALESCE(SUM(tax), 0) as total_tax
      FROM sales
      WHERE deleted_at IS NULL
    `;
    const params = [];
    let paramCount = 1;

    if (filters.dateFrom) {
      sql += ` AND sale_date >= $${paramCount++}`;
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      sql += ` AND sale_date <= $${paramCount++}`;
      params.push(filters.dateTo);
    }

    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }

    const result = await query(sql, params);
    return result.rows[0];
  }
  /**
   * Get total quantity sold for a product in a date range
   */
  async getProductSalesStats(productId, dateFrom) {
    const sql = `
      SELECT 
        COALESCE(SUM((elem->>'quantity')::numeric), 0) as "totalQuantity",
        COUNT(*) as "saleCount"
      FROM sales s,
      jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(items, '[]')::jsonb) = 'array' THEN items::jsonb ELSE '[]'::jsonb END) AS elem
      WHERE s.created_at >= $1
        AND s.status = 'completed'
        AND s.deleted_at IS NULL
        AND (elem->>'product' = $2 OR elem->>'product_id' = $2)
    `;
    const result = await query(sql, [dateFrom, productId]);
    return result.rows[0];
  }

  /**
   * Get daily sales quantity for a product in a date range
   */
  async getDailyProductSales(productId, dateFrom) {
    const sql = `
      SELECT 
        DATE(s.created_at) as "date",
        COALESCE(SUM((elem->>'quantity')::numeric), 0) as "dailyQuantity"
      FROM sales s,
      jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(items, '[]')::jsonb) = 'array' THEN items::jsonb ELSE '[]'::jsonb END) AS elem
      WHERE s.created_at >= $1
        AND s.status = 'completed'
        AND s.deleted_at IS NULL
        AND (elem->>'product' = $2 OR elem->>'product_id' = $2)
      GROUP BY DATE(s.created_at)
      ORDER BY DATE(s.created_at) ASC
    `;
    const result = await query(sql, [dateFrom, productId]);
    return result.rows.map(r => ({
      ...r,
      dailyQuantity: parseFloat(r.dailyQuantity) || 0
    }));
  }

  /**
   * Get total quantity sold per product in a date range
   */
  async getProductTurnoverStats(dateFrom, dateTo, limit = 10) {
    const sql = `
      SELECT 
        COALESCE(elem->>'product', elem->>'product_id') as "productId",
        SUM((elem->>'quantity')::numeric) as "totalSold"
      FROM sales s,
      jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(items, '[]')::jsonb) = 'array' THEN items::jsonb ELSE '[]'::jsonb END) AS elem
      WHERE s.created_at BETWEEN $1 AND $2
        AND s.status IN ('completed', 'delivered')
        AND s.deleted_at IS NULL
      GROUP BY "productId"
      ORDER BY "totalSold" DESC
      LIMIT $3
    `;
    const result = await query(sql, [dateFrom, dateTo, limit]);
    return result.rows.map(r => ({
      ...r,
      totalSold: parseFloat(r.totalSold) || 0
    }));
  }

  /**
   * Get last sold date for multiple products
   */
  async getLastSoldDates(productIds) {
    if (!productIds || productIds.length === 0) return [];
    const sql = `
      SELECT 
        COALESCE(elem->>'product', elem->>'product_id') as "productId",
        MAX(s.created_at) as "lastSoldDate"
      FROM sales s,
      jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(items, '[]')::jsonb) = 'array' THEN items::jsonb ELSE '[]'::jsonb END) AS elem
      WHERE s.status IN ('completed', 'delivered')
        AND s.deleted_at IS NULL
        AND COALESCE(elem->>'product', elem->>'product_id') = ANY($1::text[])
      GROUP BY "productId"
    `;
    const result = await query(sql, [productIds.map(id => String(id))]);
    return result.rows;
  }

  /**
   * Get top products by revenue/quantity
   */
  async getTopProductsPerformance(dateFrom, dateTo, limit = 10) {
    const sql = `
      SELECT 
        COALESCE(elem->>'product', elem->>'product_id') as "productId",
        SUM((elem->>'quantity')::numeric * (elem->>'unitPrice')::numeric) as "totalRevenue",
        SUM((elem->>'quantity')::numeric) as "totalQuantity",
        COUNT(DISTINCT s.id) as "totalOrders"
      FROM sales s,
      jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(items, '[]')::jsonb) = 'array' THEN items::jsonb ELSE '[]'::jsonb END) AS elem
      WHERE s.created_at BETWEEN $1 AND $2
        AND s.status IN ('completed', 'delivered')
        AND s.deleted_at IS NULL
      GROUP BY "productId"
      ORDER BY "totalRevenue" DESC
      LIMIT $3
    `;
    const result = await query(sql, [dateFrom, dateTo, limit]);
    return result.rows.map(r => ({
      ...r,
      totalRevenue: parseFloat(r.totalRevenue) || 0,
      totalQuantity: parseFloat(r.totalQuantity) || 0,
      totalOrders: parseInt(r.totalOrders, 10) || 0
    }));
  }

  /**
   * Get top customers by revenue
   */
  async getTopCustomersPerformance(dateFrom, dateTo, limit = 10) {
    const sql = `
      SELECT 
        customer_id as "customerId",
        SUM(total) as "totalRevenue",
        COUNT(*) as "totalOrders"
      FROM sales
      WHERE created_at BETWEEN $1 AND $2
        AND status IN ('completed', 'delivered')
        AND deleted_at IS NULL
        AND customer_id IS NOT NULL
      GROUP BY customer_id
      ORDER BY "totalRevenue" DESC
      LIMIT $3
    `;
    const result = await query(sql, [dateFrom, dateTo, limit]);
    return result.rows.map(r => ({
      ...r,
      totalRevenue: parseFloat(r.totalRevenue) || 0,
      totalOrders: parseInt(r.totalOrders, 10) || 0
    }));
  }

  /**
   * Get sales summary for a date range
   */
  async getSalesPerformanceSummary(dateFrom, dateTo) {
    const sql = `
      SELECT 
        COALESCE(SUM(total), 0) as "totalRevenue",
        COUNT(*) as "totalOrders",
        COUNT(DISTINCT customer_id) as "totalCustomers"
      FROM sales
      WHERE created_at BETWEEN $1 AND $2
        AND status IN ('completed', 'delivered')
        AND deleted_at IS NULL
    `;
    const result = await query(sql, [dateFrom, dateTo]);
    const row = result.rows[0];
    return {
      totalRevenue: parseFloat(row.totalRevenue) || 0,
      totalOrders: parseInt(row.totalOrders, 10) || 0,
      totalCustomers: parseInt(row.totalCustomers, 10) || 0,
      averageOrderValue: row.totalOrders > 0 ? parseFloat(row.totalRevenue) / parseInt(row.totalOrders, 10) : 0
    };
  }
}

module.exports = new SalesRepository();
