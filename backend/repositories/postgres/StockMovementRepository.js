const { query } = require('../../config/postgres');

function rowToMovement(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    movementType: row.movement_type,
    quantity: parseFloat(row.quantity) || 0,
    unitCost: parseFloat(row.unit_cost) || 0,
    totalValue: parseFloat(row.total_value) || 0,
    previousStock: parseFloat(row.previous_stock) || 0,
    newStock: parseFloat(row.new_stock) || 0,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    referenceNumber: row.reference_number,
    location: row.location,
    fromLocation: row.from_location,
    toLocation: row.to_location,
    userId: row.user_id,
    userName: row.user_name,
    reason: row.reason,
    notes: row.notes,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    supplierId: row.supplier_id,
    customerId: row.customer_id,
    status: row.status,
    isReversal: row.is_reversal,
    originalMovementId: row.original_movement_id,
    reversedBy: row.reversed_by,
    reversedAt: row.reversed_at,
    systemGenerated: row.system_generated,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class StockMovementRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM stock_movements WHERE id = $1',
      [id]
    );
    return rowToMovement(result.rows[0]);
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM stock_movements WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.productId || filters.product) {
      sql += ` AND product_id = $${paramCount++}`;
      params.push(filters.productId || filters.product);
    }
    if (filters.productIds && filters.productIds.length > 0) {
      sql += ` AND product_id = ANY($${paramCount++}::uuid[])`;
      params.push(filters.productIds);
    }
    if (filters.movementType) {
      sql += ` AND movement_type = $${paramCount++}`;
      params.push(filters.movementType);
    }
    if (filters.referenceType) {
      sql += ` AND reference_type = $${paramCount++}`;
      params.push(filters.referenceType);
    }
    if (filters.referenceId) {
      sql += ` AND reference_id = $${paramCount++}`;
      params.push(filters.referenceId);
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.userId || filters.user) {
      sql += ` AND user_id = $${paramCount++}`;
      params.push(filters.userId || filters.user);
    }
    if (filters.location) {
      sql += ` AND location = $${paramCount++}`;
      params.push(filters.location);
    }
    if (filters.searchIlike) {
      const term = `%${filters.searchIlike}%`;
      sql += ` AND (product_name ILIKE $${paramCount} OR product_sku ILIKE $${paramCount} OR reference_number ILIKE $${paramCount} OR user_name ILIKE $${paramCount} OR notes ILIKE $${paramCount})`;
      params.push(term);
      paramCount++;
    }
    if (filters.dateFrom) {
      sql += ` AND created_at >= $${paramCount++}`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      sql += ` AND created_at <= $${paramCount++}`;
      params.push(filters.dateTo);
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
    return result.rows.map(rowToMovement);
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const getAll = options.getAll === true;

    let countSql = 'SELECT COUNT(*) FROM stock_movements WHERE 1=1';
    const countParams = [];
    let paramCount = 1;
    if (filter.productId || filter.product) {
      countSql += ` AND product_id = $${paramCount++}`;
      countParams.push(filter.productId || filter.product);
    }
    if (filter.productIds && filter.productIds.length > 0) {
      countSql += ` AND product_id = ANY($${paramCount++}::uuid[])`;
      countParams.push(filter.productIds);
    }
    if (filter.movementType) {
      countSql += ` AND movement_type = $${paramCount++}`;
      countParams.push(filter.movementType);
    }
    if (filter.status) {
      countSql += ` AND status = $${paramCount++}`;
      countParams.push(filter.status);
    }
    if (filter.location) {
      countSql += ` AND location = $${paramCount++}`;
      countParams.push(filter.location);
    }
    if (filter.searchIlike) {
      const term = `%${filter.searchIlike}%`;
      countSql += ` AND (product_name ILIKE $${paramCount} OR product_sku ILIKE $${paramCount} OR reference_number ILIKE $${paramCount} OR user_name ILIKE $${paramCount} OR notes ILIKE $${paramCount})`;
      countParams.push(term);
      paramCount++;
    }
    if (filter.dateFrom) {
      countSql += ` AND created_at >= $${paramCount++}`;
      countParams.push(filter.dateFrom);
    }
    if (filter.dateTo) {
      countSql += ` AND created_at <= $${paramCount++}`;
      countParams.push(filter.dateTo);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const movements = await this.findAll(filter, {
      limit: getAll ? total : limit,
      offset: getAll ? 0 : offset
    });

    return {
      movements,
      total,
      pagination: getAll
        ? { current: 1, pages: 1, total, hasNext: false, hasPrev: false }
        : { current: page, pages: Math.ceil(total / limit), total, hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 }
    };
  }

  async findByProduct(productId, options = {}) {
    return this.findAll({ product: productId, productId }, options);
  }

  async findByMovementType(movementType, options = {}) {
    return this.findAll({ movementType }, options);
  }

  async getSummary(filter = {}) {
    let sql = `SELECT
      COUNT(*)::int AS total_movements,
      COALESCE(SUM(total_value), 0)::decimal AS total_value,
      COALESCE(SUM(CASE WHEN movement_type IN ('purchase', 'return_in', 'adjustment_in', 'transfer_in', 'production', 'initial_stock') THEN quantity ELSE 0 END), 0)::decimal AS stock_in,
      COALESCE(SUM(CASE WHEN movement_type IN ('sale', 'return_out', 'adjustment_out', 'transfer_out', 'damage', 'expiry', 'theft', 'consumption') THEN quantity ELSE 0 END), 0)::decimal AS stock_out,
      COALESCE(SUM(CASE WHEN movement_type IN ('purchase', 'return_in', 'adjustment_in', 'transfer_in', 'production', 'initial_stock') THEN total_value ELSE 0 END), 0)::decimal AS total_value_in,
      COALESCE(SUM(CASE WHEN movement_type IN ('sale', 'return_out', 'adjustment_out', 'transfer_out', 'damage', 'expiry', 'theft', 'consumption') THEN total_value ELSE 0 END), 0)::decimal AS total_value_out
      FROM stock_movements WHERE 1=1`;
    const params = [];
    let paramCount = 1;
    if (filter.productId || filter.product) {
      sql += ` AND product_id = $${paramCount++}`;
      params.push(filter.productId || filter.product);
    }
    if (filter.productIds && filter.productIds.length > 0) {
      sql += ` AND product_id = ANY($${paramCount++}::uuid[])`;
      params.push(filter.productIds);
    }
    if (filter.movementType) {
      sql += ` AND movement_type = $${paramCount++}`;
      params.push(filter.movementType);
    }
    if (filter.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filter.status);
    }
    if (filter.location) {
      sql += ` AND location = $${paramCount++}`;
      params.push(filter.location);
    }
    if (filter.searchIlike) {
      const term = `%${filter.searchIlike}%`;
      sql += ` AND (product_name ILIKE $${paramCount} OR product_sku ILIKE $${paramCount} OR reference_number ILIKE $${paramCount} OR user_name ILIKE $${paramCount} OR notes ILIKE $${paramCount})`;
      params.push(term);
      paramCount++;
    }
    if (filter.dateFrom) {
      sql += ` AND created_at >= $${paramCount++}`;
      params.push(filter.dateFrom);
    }
    if (filter.dateTo) {
      sql += ` AND created_at <= $${paramCount++}`;
      params.push(filter.dateTo);
    }
    const result = await query(sql, params);
    const row = result.rows[0] || {};
    return {
      totalMovements: parseInt(row.total_movements, 10) || 0,
      totalValue: parseFloat(row.total_value) || 0,
      stockIn: parseFloat(row.stock_in) || 0,
      stockOut: parseFloat(row.stock_out) || 0,
      totalValueIn: parseFloat(row.total_value_in) || 0,
      totalValueOut: parseFloat(row.total_value_out) || 0
    };
  }

  /**
   * @param {Object} data - Movement data
   * @param {Object} [client] - Optional pg client for use inside a transaction
   */
  async create(data, client = null) {
    const totalValue = (data.quantity || 0) * (data.unitCost ?? data.unit_cost ?? 0);
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `INSERT INTO stock_movements (
        product_id, product_name, product_sku, movement_type, quantity, unit_cost, total_value,
        previous_stock, new_stock, reference_type, reference_id, reference_number, location,
        from_location, to_location, user_id, user_name, reason, notes, batch_number, expiry_date,
        supplier_id, customer_id, status, is_reversal, original_movement_id, reversed_by, reversed_at,
        system_generated, ip_address, user_agent, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        data.product || data.productId,
        data.productName || data.product_name,
        data.productSku || data.product_sku || null,
        data.movementType || data.movement_type,
        data.quantity,
        data.unitCost ?? data.unit_cost ?? 0,
        data.totalValue ?? data.total_value ?? totalValue,
        data.previousStock ?? data.previous_stock ?? 0,
        data.newStock ?? data.new_stock ?? 0,
        data.referenceType || data.reference_type,
        data.referenceId || data.reference_id,
        data.referenceNumber || data.reference_number || null,
        data.location || 'main_warehouse',
        data.fromLocation || data.from_location || null,
        data.toLocation || data.to_location || null,
        data.user || data.userId,
        data.userName || data.user_name || (data.user || data.userId ? String(data.user || data.userId) : 'System'),
        data.reason || null,
        data.notes || null,
        data.batchNumber || data.batch_number || null,
        data.expiryDate || data.expiry_date || null,
        data.supplier || data.supplierId || null,
        data.customer || data.customerId || null,
        data.status || 'completed',
        data.isReversal === true,
        data.originalMovement || data.original_movement_id || null,
        data.reversedBy || data.reversed_by || null,
        data.reversedAt || data.reversed_at || null,
        data.systemGenerated === true,
        data.ipAddress || data.ip_address || null,
        data.userAgent || data.user_agent || null
      ]
    );
    return result.rows[0];
  }

  async updateStatus(id, status) {
    const result = await query(
      'UPDATE stock_movements SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0] || null;
  }

  /** Get movements for a product (replaces StockMovement.getProductMovements). */
  async getProductMovements(productId, options = {}) {
    const filter = { productId, product: productId };
    if (options.dateFrom) filter.dateFrom = options.dateFrom;
    if (options.dateTo) filter.dateTo = options.dateTo;
    if (options.movementType) filter.movementType = options.movementType;
    if (options.location) filter.location = options.location;
    return this.findAll(filter, { limit: options.limit || 500 });
  }

  /** Get stock summary for a product up to date (replaces StockMovement.getStockSummary). */
  async getStockSummary(productId, date = new Date()) {
    const summary = await this.getSummary({
      productId,
      product: productId,
      dateTo: date,
      status: 'completed'
    });
    return [{
      totalIn: summary.stockIn || 0,
      totalOut: summary.stockOut || 0,
      totalValueIn: summary.totalValueIn || 0,
      totalValueOut: summary.totalValueOut || 0
    }];
  }

  /** Create a reversal movement and return it (replaces movement.reverse()). */
  async reverse(movementId, userId, userName, reason) {
    const movement = await this.findById(movementId);
    if (!movement) throw new Error('Movement not found');
    if (movement.isReversal || movement.is_reversal) throw new Error('Cannot reverse a reversal movement');
    if (movement.status !== 'completed') throw new Error('Can only reverse completed movements');
    const productId = movement.productId ?? movement.product_id;
    if (!productId) throw new Error('Original movement has no product_id; cannot reverse');
    const reversed = await this.create({
      product: productId,
      productId,
      productName: movement.productName ?? movement.product_name,
      productSku: movement.productSku ?? movement.product_sku,
      movementType: movement.movementType ?? movement.movement_type,
      quantity: movement.quantity,
      unitCost: movement.unitCost ?? movement.unit_cost,
      totalValue: movement.totalValue ?? movement.total_value,
      previousStock: movement.newStock ?? movement.new_stock,
      newStock: movement.previousStock ?? movement.previous_stock,
      referenceType: movement.referenceType ?? movement.reference_type,
      referenceId: movement.referenceId ?? movement.reference_id,
      referenceNumber: movement.referenceNumber ?? movement.reference_number,
      location: movement.location,
      fromLocation: movement.toLocation ?? movement.to_location,
      toLocation: movement.fromLocation ?? movement.from_location,
      user: userId,
      userId,
      userName: userName || movement.userName || movement.user_name,
      reason: reason || 'Reversal of movement',
      notes: `Reversal of movement ${movementId}`,
      batchNumber: movement.batchNumber ?? movement.batch_number,
      expiryDate: movement.expiryDate ?? movement.expiry_date,
      supplier: movement.supplierId ?? movement.supplier_id,
      customer: movement.customerId ?? movement.customer_id,
      status: 'completed',
      isReversal: true,
      originalMovement: movementId,
      originalMovementId: movementId
    });
    return reversed;
  }

  /** Overview stats by movement type (replaces aggregate for stats). */
  async getStatsOverview(filter = {}) {
    let sql = `SELECT movement_type AS type, COUNT(*)::int AS count,
      COALESCE(SUM(quantity), 0)::decimal AS "totalQuantity",
      COALESCE(SUM(total_value), 0)::decimal AS "totalValue"
      FROM stock_movements WHERE 1=1`;
    const params = [];
    let n = 1;
    if (filter.dateFrom) { sql += ` AND created_at >= $${n++}`; params.push(filter.dateFrom); }
    if (filter.dateTo) { sql += ` AND created_at <= $${n++}`; params.push(filter.dateTo); }
    sql += ' GROUP BY movement_type';
    const result = await query(sql, params);
    const movements = result.rows.map(r => ({
      type: r.type,
      count: parseInt(r.count, 10) || 0,
      totalQuantity: parseFloat(r.totalQuantity) || 0,
      totalValue: parseFloat(r.totalValue) || 0
    }));
    const totalMovements = movements.reduce((s, r) => s + r.count, 0);
    const totalValue = movements.reduce((s, r) => s + r.totalValue, 0);
    return [{ movements, totalMovements, totalValue }];
  }

  /** Top products by movement count (replaces aggregate). */
  async getTopProducts(filter = {}, limit = 10) {
    let sql = `SELECT product_id AS "productId", product_name AS "productName",
      COUNT(*)::int AS "totalMovements",
      COALESCE(SUM(quantity), 0)::decimal AS "totalQuantity",
      COALESCE(SUM(total_value), 0)::decimal AS "totalValue"
      FROM stock_movements WHERE 1=1`;
    const params = [];
    let n = 1;
    if (filter.dateFrom) { sql += ` AND created_at >= $${n++}`; params.push(filter.dateFrom); }
    if (filter.dateTo) { sql += ` AND created_at <= $${n++}`; params.push(filter.dateTo); }
    sql += ` GROUP BY product_id, product_name ORDER BY "totalMovements" DESC LIMIT $${n}`;
    params.push(limit);
    const result = await query(sql, params);
    return result.rows.map(r => ({
      ...r,
      _id: r.productId,
      totalMovements: parseInt(r.totalMovements, 10) || 0,
      totalQuantity: parseFloat(r.totalQuantity) || 0,
      totalValue: parseFloat(r.totalValue) || 0
    }));
  }
}

module.exports = new StockMovementRepository();
