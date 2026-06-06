const { query } = require('../../config/postgres');

function q(client) {
  return client ? client.query.bind(client) : query;
}

class ShopStockRepository {
  async findByShopAndProduct(shopId, productId, client = null, forUpdate = false) {
    const lock = forUpdate ? ' FOR UPDATE' : '';
    const result = await q(client)(
      `SELECT * FROM shop_stock WHERE shop_id = $1 AND product_id = $2${lock}`,
      [shopId, productId]
    );
    return result.rows[0] || null;
  }

  async ensureRow(shopId, productId, client = null) {
    let row = await this.findByShopAndProduct(shopId, productId, client, true);
    if (row) return row;
    const result = await q(client)(
      `INSERT INTO shop_stock (shop_id, product_id, quantity, reserved_quantity)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (shop_id, product_id) DO NOTHING
       RETURNING *`,
      [shopId, productId]
    );
    if (result.rows[0]) return result.rows[0];
    return this.findByShopAndProduct(shopId, productId, client, true);
  }

  async adjustQuantity(shopId, productId, delta, client = null) {
    const row = await this.ensureRow(shopId, productId, client);
    const current = Number(row.quantity);
    const reserved = Number(row.reserved_quantity || 0);
    const next = current + Number(delta);
    if (next < 0) {
      throw new Error(`Insufficient shop stock (available: ${current}, reserved: ${reserved}, requested: ${Math.abs(delta)})`);
    }
    const result = await q(client)(
      `UPDATE shop_stock SET quantity = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [next, row.id]
    );
    return { row: result.rows[0], previousQuantity: current, newQuantity: next };
  }

  async findByShopAndProductIds(shopId, productIds) {
    if (!productIds?.length) return [];
    const result = await query(
      'SELECT * FROM shop_stock WHERE shop_id = $1 AND product_id = ANY($2::uuid[])',
      [shopId, productIds]
    );
    return result.rows;
  }

  async listByShop(shopId, options = {}) {
    const { search, page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;
    let sql = `
      SELECT ss.*, p.name AS product_name, p.sku AS product_sku
      FROM shop_stock ss
      JOIN products p ON p.id = ss.product_id
      WHERE ss.shop_id = $1 AND p.is_deleted = FALSE`;
    const params = [shopId];
    let n = 2;
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

  async countByShop(shopId, search) {
    let sql = `
      SELECT COUNT(*)::int AS c
      FROM shop_stock ss
      JOIN products p ON p.id = ss.product_id
      WHERE ss.shop_id = $1 AND p.is_deleted = FALSE`;
    const params = [shopId];
    if (search) {
      sql += ' AND (p.name ILIKE $2 OR p.sku ILIKE $2)';
      params.push(`%${search}%`);
    }
    const result = await query(sql, params);
    return result.rows[0]?.c || 0;
  }
}

module.exports = new ShopStockRepository();
