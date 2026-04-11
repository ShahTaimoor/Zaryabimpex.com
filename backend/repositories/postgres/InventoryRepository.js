const { query } = require('../../config/postgres');
const inventoryBalanceRepository = require('./InventoryBalanceRepository');


class InventoryRepository {
  async findById(id, includeDeleted = false) {
    const sql = includeDeleted
      ? 'SELECT * FROM inventory WHERE id = $1'
      : 'SELECT * FROM inventory WHERE id = $1 AND deleted_at IS NULL';
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  async findOne(filters = {}, client = null, includeDeleted = false) {
    const q = client ? client.query.bind(client) : query;
    if (filters.product || filters.productId) {
      const sql = includeDeleted
        ? 'SELECT * FROM inventory WHERE product_id = $1 LIMIT 1'
        : 'SELECT * FROM inventory WHERE product_id = $1 AND deleted_at IS NULL LIMIT 1';
      const result = await q(sql, [filters.product || filters.productId]);
      return result.rows[0] || null;
    }
    if (filters._id || filters.id) return this.findById(filters._id || filters.id, includeDeleted);
    return null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM inventory WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.warehouse) {
      sql += ` AND location->>'warehouse' = $${paramCount++}`;
      params.push(filters.warehouse);
    }

    sql += ' ORDER BY last_updated DESC';
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

  async findByProduct(productId, options = {}) {
    return this.findOne({ product: productId, productId }, null, options.includeDeleted);
  }

  async findByProductIds(productIds, options = {}) {
    if (!productIds || productIds.length === 0) return [];
    
    // Filter to only include valid UUIDs to avoid Postgres casting errors (manual items are not in inventory)
    const validUuids = productIds.filter(id => 
      typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    );
    
    if (validUuids.length === 0) return [];

    const result = await query(
      'SELECT * FROM inventory WHERE deleted_at IS NULL AND product_id = ANY($1::uuid[])',
      [validUuids]
    );
    return result.rows;
  }

  async findLowStock(options = {}) {
    const result = await query(
      `SELECT * FROM inventory WHERE deleted_at IS NULL AND status = 'active' AND current_stock <= reorder_point ORDER BY current_stock ASC LIMIT $1`,
      [options.limit || 500]
    );
    return result.rows;
  }

  async findByWarehouse(warehouse, options = {}) {
    return this.findAll({ warehouse }, options);
  }

  async findByStatus(status, options = {}) {
    return this.findAll({ status }, options);
  }

  async create(data, client = null) {
    const availableStock = Math.max(0, (data.currentStock ?? data.current_stock ?? 0) - (data.reservedStock ?? data.reserved_stock ?? 0));
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `INSERT INTO inventory (product_id, product_model, current_stock, reserved_stock, available_stock, reservations, reorder_point, reorder_quantity, max_stock, location, cost, status, last_updated, last_count, movements, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.product || data.productId,
        data.productModel || data.product_model || 'Product',
        data.currentStock ?? data.current_stock ?? 0,
        data.reservedStock ?? data.reserved_stock ?? 0,
        availableStock,
        data.reservations ? JSON.stringify(data.reservations) : '[]',
        data.reorderPoint ?? data.reorder_point ?? 10,
        data.reorderQuantity ?? data.reorder_quantity ?? 50,
        data.maxStock ?? data.max_stock ?? null,
        data.location ? JSON.stringify(data.location) : '{}',
        data.cost ? JSON.stringify(data.cost) : '{}',
        data.status || 'active',
        data.lastCount ? JSON.stringify(data.lastCount) : null,
        data.movements ? JSON.stringify(data.movements) : '[]'
      ]
    );
    const created = result.rows[0];
    if (created) {
      try {
        await inventoryBalanceRepository.syncBalance(
          created.product_id,
          created.current_stock,
          created.reserved_stock,
          0,
          client
        );
      } catch (err) {
        console.error('Error syncing inventory_balance in create:', err);
      }
    }
    return created;
  }

  async updateById(id, data, client = null) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      currentStock: 'current_stock', reservedStock: 'reserved_stock', availableStock: 'available_stock',
      reservations: 'reservations', reorderPoint: 'reorder_point', reorderQuantity: 'reorder_quantity',
      maxStock: 'max_stock', location: 'location', cost: 'cost', status: 'status',
      lastUpdated: 'last_updated', lastCount: 'last_count', movements: 'movements'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('last_updated = CURRENT_TIMESTAMP', 'updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `UPDATE inventory SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
      params
    );
    
    const updated = result.rows[0] || null;
    if (updated && (data.currentStock !== undefined || data.reservedStock !== undefined)) {
      try {
        await inventoryBalanceRepository.syncBalance(
          updated.product_id,
          updated.current_stock,
          updated.reserved_stock,
          0,
          client
        );
      } catch (err) {
        console.error('Error syncing inventory_balance in updateById:', err);
      }
    }
    return updated;
  }

  async updateByProductId(productId, data, client = null) {
    const row = await this.findOne({ productId }, client);
    if (!row) return null;
    return this.updateById(row.id, data, client);
  }

  async softDelete(id) {
    const result = await query(
      'UPDATE inventory SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async hardDelete(id) {
    const result = await query('DELETE FROM inventory WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  }
}

module.exports = new InventoryRepository();
