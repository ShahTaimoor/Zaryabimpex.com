const { query } = require('../../config/postgres');

function q(client) {
  return client ? client.query.bind(client) : query;
}

class WarehouseStockRepository {
  async findByWarehouseAndProduct(warehouseId, productId, client = null, forUpdate = false) {
    const lock = forUpdate ? ' FOR UPDATE' : '';
    const result = await q(client)(
      `SELECT * FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2${lock}`,
      [warehouseId, productId]
    );
    return result.rows[0] || null;
  }

  async ensureRow(warehouseId, productId, client = null) {
    let row = await this.findByWarehouseAndProduct(warehouseId, productId, client, true);
    if (row) return row;
    const result = await q(client)(
      `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, reserved_quantity)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (warehouse_id, product_id) DO NOTHING
       RETURNING *`,
      [warehouseId, productId]
    );
    if (result.rows[0]) return result.rows[0];
    return this.findByWarehouseAndProduct(warehouseId, productId, client, true);
  }

  async adjustQuantity(warehouseId, productId, delta, client = null) {
    const row = await this.ensureRow(warehouseId, productId, client);
    const current = Number(row.quantity);
    const next = current + Number(delta);
    if (next < 0) {
      throw new Error(`Insufficient warehouse stock (available: ${current}, requested: ${Math.abs(delta)})`);
    }
    const result = await q(client)(
      `UPDATE warehouse_stock SET quantity = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [next, row.id]
    );
    return { row: result.rows[0], previousQuantity: current, newQuantity: next };
  }

  async findByWarehouseAndProductIds(warehouseId, productIds) {
    if (!productIds?.length) return [];
    const result = await query(
      'SELECT * FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = ANY($2::uuid[])',
      [warehouseId, productIds]
    );
    return result.rows;
  }

  async listByWarehouse(warehouseId, options = {}) {
    const { search, page = 1, limit = 50, allProducts = false } = options;
    const offset = (page - 1) * limit;
    const params = [warehouseId];
    let n = 2;

    let sql;
    if (allProducts) {
      sql = `
        SELECT
          p.id AS product_id,
          p.name AS product_name,
          p.sku AS product_sku,
          COALESCE(ws.quantity, 0) AS quantity,
          COALESCE(ws.reserved_quantity, 0) AS reserved_quantity
        FROM products p
        LEFT JOIN warehouse_stock ws
          ON ws.product_id = p.id AND ws.warehouse_id = $1
        WHERE p.is_deleted = FALSE`;
    } else {
      sql = `
        SELECT ws.*, p.name AS product_name, p.sku AS product_sku
        FROM warehouse_stock ws
        JOIN products p ON p.id = ws.product_id
        WHERE ws.warehouse_id = $1 AND p.is_deleted = FALSE`;
    }

    if (search) {
      sql += ` AND (p.name ILIKE $${n} OR p.sku ILIKE $${n})`;
      params.push(`%${search}%`);
      n++;
    }
    sql += ` ORDER BY p.name ASC LIMIT $${n++} OFFSET $${n}`;
    params.push(limit, offset);
    const result = await query(sql, params);
    return result.rows;
  }

  async countByWarehouse(warehouseId, search, allProducts = false) {
    let params;
    let sql;

    if (allProducts) {
      params = [];
      sql = `
        SELECT COUNT(*)::int AS c
        FROM products p
        WHERE p.is_deleted = FALSE`;
      if (search) {
        sql += ' AND (p.name ILIKE $1 OR p.sku ILIKE $1)';
        params.push(`%${search}%`);
      }
    } else {
      params = [warehouseId];
      sql = `
        SELECT COUNT(*)::int AS c
        FROM warehouse_stock ws
        JOIN products p ON p.id = ws.product_id
        WHERE ws.warehouse_id = $1 AND p.is_deleted = FALSE`;
      if (search) {
        sql += ' AND (p.name ILIKE $2 OR p.sku ILIKE $2)';
        params.push(`%${search}%`);
      }
    }

    const result = await query(sql, params);
    return result.rows[0]?.c || 0;
  }
}

module.exports = new WarehouseStockRepository();
