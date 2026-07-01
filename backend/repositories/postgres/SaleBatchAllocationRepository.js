const { query } = require('../../config/postgres');

function rowToAllocation(row) {
  if (!row) return null;
  return {
    id: row.id,
    saleId: row.sale_id,
    saleItemIndex: row.sale_item_index,
    productId: row.product_id,
    inventoryBatchId: row.inventory_batch_id,
    quantityConsumed: parseFloat(row.quantity_consumed ?? row.quantity) || 0,
    quantityRestored: parseFloat(row.quantity_restored) || 0,
    unitCost: parseFloat(row.unit_cost) || 0,
    totalCost: parseFloat(row.total_cost) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SaleBatchAllocationRepository {
  _q(client) {
    return client ? client.query.bind(client) : query;
  }

  async createMany(allocations, client = null) {
    if (!allocations || allocations.length === 0) return [];
    const q = this._q(client);
    const created = [];
    for (const a of allocations) {
      const qty = a.quantityConsumed ?? a.quantity_consumed ?? a.quantity;
      const result = await q(
        `INSERT INTO sale_batch_allocations (
          sale_id, sale_item_index, product_id, inventory_batch_id,
          quantity, unit_cost, total_cost, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          a.saleId ?? a.sale_id,
          a.saleItemIndex ?? a.sale_item_index ?? 0,
          a.productId ?? a.product_id,
          a.inventoryBatchId ?? a.inventory_batch_id,
          qty,
          a.unitCost ?? a.unit_cost,
          a.totalCost ?? a.total_cost,
        ]
      );
      created.push(rowToAllocation(result.rows[0]));
    }
    return created;
  }

  async findBySale(saleId, client = null) {
    const q = this._q(client);
    const result = await q(
      `SELECT * FROM sale_batch_allocations WHERE sale_id = $1 ORDER BY sale_item_index, created_at`,
      [saleId]
    );
    return result.rows.map(rowToAllocation);
  }

  async findBySaleAndProduct(saleId, productId, saleItemIndex = null, client = null) {
    const q = this._q(client);
    const params = [saleId, productId];
    let sql = `SELECT * FROM sale_batch_allocations WHERE sale_id = $1 AND product_id = $2`;
    if (saleItemIndex != null) {
      params.push(saleItemIndex);
      sql += ' AND sale_item_index = $3';
    }
    sql += ' ORDER BY created_at';
    const result = await q(sql, params);
    return result.rows.map(rowToAllocation);
  }

  async recordRestore(allocationId, quantityRestored, client = null) {
    const q = this._q(client);
    const result = await q(
      `UPDATE sale_batch_allocations
       SET quantity_restored = COALESCE(quantity_restored, 0) + $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [allocationId, quantityRestored]
    );
    return rowToAllocation(result.rows[0]);
  }
}

module.exports = new SaleBatchAllocationRepository();
