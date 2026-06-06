const { query } = require('../../config/postgres');

function q(client) {
  return client ? client.query.bind(client) : query;
}

class StockTransferRepository {
  async findById(id, client = null) {
    const result = await q(client)(
      `SELECT st.*,
              w.name AS warehouse_name, w.code AS warehouse_code,
              s.name AS shop_name, s.code AS shop_code
       FROM stock_transfers st
       JOIN warehouses w ON w.id = st.from_warehouse_id
       JOIN shops s ON s.id = st.to_shop_id
       WHERE st.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findLinesByTransferId(transferId, client = null) {
    const result = await q(client)(
      `SELECT stl.*, p.name AS product_name, p.sku AS product_sku
       FROM stock_transfer_lines stl
       JOIN products p ON p.id = stl.product_id
       WHERE stl.transfer_id = $1
       ORDER BY p.name ASC`,
      [transferId]
    );
    return result.rows;
  }

  async createHeader(data, client = null) {
    const result = await q(client)(
      `INSERT INTO stock_transfers (
         transfer_number, from_warehouse_id, to_shop_id, status, notes, transferred_by, transferred_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.transferNumber,
        data.fromWarehouseId,
        data.toShopId,
        data.status || 'completed',
        data.notes || null,
        data.transferredBy || null,
        data.transferredAt || null,
      ]
    );
    return result.rows[0];
  }

  async createLine(data, client = null) {
    const result = await q(client)(
      `INSERT INTO stock_transfer_lines (transfer_id, product_id, quantity, unit_cost)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.transferId, data.productId, data.quantity, data.unitCost ?? null]
    );
    return result.rows[0];
  }

  async findAll(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    let sql = `
      SELECT st.*,
             w.name AS warehouse_name, w.code AS warehouse_code,
             s.name AS shop_name, s.code AS shop_code
      FROM stock_transfers st
      JOIN warehouses w ON w.id = st.from_warehouse_id
      JOIN shops s ON s.id = st.to_shop_id
      WHERE 1=1`;
    const params = [];
    let n = 1;
    if (filters.warehouseId) {
      sql += ` AND st.from_warehouse_id = $${n++}`;
      params.push(filters.warehouseId);
    }
    if (filters.shopId) {
      sql += ` AND st.to_shop_id = $${n++}`;
      params.push(filters.shopId);
    }
    if (filters.status) {
      sql += ` AND st.status = $${n++}`;
      params.push(filters.status);
    }
    sql += ` ORDER BY st.transferred_at DESC LIMIT $${n++} OFFSET $${n}`;
    params.push(limit, offset);
    const result = await query(sql, params);
    return result.rows;
  }

  async count(filters = {}) {
    let sql = 'SELECT COUNT(*)::int AS c FROM stock_transfers st WHERE 1=1';
    const params = [];
    let n = 1;
    if (filters.warehouseId) {
      sql += ` AND st.from_warehouse_id = $${n++}`;
      params.push(filters.warehouseId);
    }
    if (filters.shopId) {
      sql += ` AND st.to_shop_id = $${n++}`;
      params.push(filters.shopId);
    }
    if (filters.status) {
      sql += ` AND st.status = $${n++}`;
      params.push(filters.status);
    }
    const result = await query(sql, params);
    return result.rows[0]?.c || 0;
  }

  async nextTransferNumber(client = null) {
    const prefix = `TRF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
    const result = await q(client)(
      `SELECT transfer_number FROM stock_transfers
       WHERE transfer_number LIKE $1
       ORDER BY transfer_number DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let seq = 1;
    if (result.rows[0]) {
      const parts = result.rows[0].transfer_number.split('-');
      const last = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(last)) seq = last + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}

module.exports = new StockTransferRepository();
