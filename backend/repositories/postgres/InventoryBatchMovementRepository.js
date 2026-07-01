const { query } = require('../../config/postgres');

function rowToMovement(row) {
  if (!row) return null;
  return {
    id: row.id,
    productId: row.product_id,
    inventoryBatchId: row.inventory_batch_id,
    movementType: row.movement_type,
    quantityIn: parseFloat(row.quantity_in) || 0,
    quantityOut: parseFloat(row.quantity_out) || 0,
    remainingQuantity: row.remaining_quantity != null ? parseFloat(row.remaining_quantity) : null,
    unitCost: parseFloat(row.unit_cost) || 0,
    totalCost: parseFloat(row.total_cost) || 0,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    referenceNumber: row.reference_number,
    userId: row.user_id,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

class InventoryBatchMovementRepository {
  _q(client) {
    return client ? client.query.bind(client) : query;
  }

  async create(data, client = null) {
    const q = this._q(client);
    const qtyIn = Number(data.quantityIn ?? data.quantity_in ?? 0);
    const qtyOut = Number(data.quantityOut ?? data.quantity_out ?? 0);
    const unitCost = Number(data.unitCost ?? data.unit_cost ?? 0);
    const result = await q(
      `INSERT INTO inventory_movements (
        product_id, inventory_batch_id, movement_type,
        quantity_in, quantity_out, remaining_quantity, unit_cost, total_cost,
        reference_type, reference_id, reference_number, user_id, notes, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        data.productId ?? data.product_id,
        data.inventoryBatchId ?? data.inventory_batch_id ?? null,
        data.movementType ?? data.movement_type,
        qtyIn,
        qtyOut,
        data.remainingQuantity ?? data.remaining_quantity ?? null,
        unitCost,
        data.totalCost ?? data.total_cost ?? Math.round((qtyIn + qtyOut) * unitCost * 100) / 100,
        data.referenceType ?? data.reference_type ?? null,
        data.referenceId ?? data.reference_id ?? null,
        data.referenceNumber ?? data.reference_number ?? null,
        data.userId ?? data.user_id ?? null,
        data.notes ?? null,
      ]
    );
    return rowToMovement(result.rows[0]);
  }

  async findByProduct(productId, options = {}, client = null) {
    const q = this._q(client);
    const limit = options.limit || 500;
    const result = await q(
      `SELECT * FROM inventory_movements
       WHERE product_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [productId, limit]
    );
    return result.rows.map(rowToMovement);
  }

  async findByReference(referenceType, referenceId, client = null) {
    const q = this._q(client);
    const result = await q(
      `SELECT * FROM inventory_movements
       WHERE reference_type = $1 AND reference_id = $2
       ORDER BY created_at`,
      [referenceType, referenceId]
    );
    return result.rows.map(rowToMovement);
  }
}

module.exports = new InventoryBatchMovementRepository();
