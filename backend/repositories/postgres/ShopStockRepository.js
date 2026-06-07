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
    const { search, page = 1, limit = 50, allProducts = false } = options;
    const offset = (page - 1) * limit;
    const params = [shopId];
    let n = 2;

    let sql;
    if (allProducts) {
      sql = `
        SELECT
          p.id AS product_id,
          p.name AS product_name,
          p.sku AS product_sku,
          COALESCE(ss.quantity, 0) AS quantity,
          COALESCE(ss.reserved_quantity, 0) AS reserved_quantity
        FROM products p
        LEFT JOIN shop_stock ss
          ON ss.product_id = p.id AND ss.shop_id = $1
        WHERE p.is_deleted = FALSE`;
    } else {
      sql = `
        SELECT ss.*, p.name AS product_name, p.sku AS product_sku
        FROM shop_stock ss
        JOIN products p ON p.id = ss.product_id
        WHERE ss.shop_id = $1 AND p.is_deleted = FALSE`;
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

  async countByShop(shopId, search, allProducts = false) {
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
      params = [shopId];
      sql = `
        SELECT COUNT(*)::int AS c
        FROM shop_stock ss
        JOIN products p ON p.id = ss.product_id
        WHERE ss.shop_id = $1 AND p.is_deleted = FALSE`;
      if (search) {
        sql += ' AND (p.name ILIKE $2 OR p.sku ILIKE $2)';
        params.push(`%${search}%`);
      }
    }

    const result = await query(sql, params);
    return result.rows[0]?.c || 0;
  }
}

module.exports = new ShopStockRepository();
