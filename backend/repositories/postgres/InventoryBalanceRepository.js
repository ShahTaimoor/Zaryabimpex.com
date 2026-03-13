const { query } = require('../../config/postgres');

/**
 * inventory_balance: one row per product, updated on every stock-affecting transaction (fast POS).
 * Use from within a transaction (pass client) so balance stays in sync with stock_movements and inventory.
 */
class InventoryBalanceRepository {
  /**
   * Apply quantity deltas and optionally set last movement. Creates row if not exists.
   * @param {string} productId - UUID
   * @param {number} quantityDelta - Change in sellable quantity (positive = in, negative = out)
   * @param {number} [quarantineDelta=0] - Change in quarantine quantity (e.g. non-resellable returns)
   * @param {string} [lastMovementId] - Optional movement id for audit
   * @param {Object} [client] - Optional pg client (required when used inside transaction)
   */
  async upsertDelta(productId, quantityDelta, quarantineDelta = 0, lastMovementId = null, client = null) {
    const q = client ? client.query.bind(client) : query;
    await q(
      `INSERT INTO inventory_balance (product_id, quantity, quantity_reserved, quantity_quarantine, last_movement_id, last_movement_at, updated_at)
       VALUES ($1, GREATEST(0, ($2)::decimal), 0, GREATEST(0, ($3)::decimal), $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (product_id) DO UPDATE SET
         quantity = GREATEST(0, inventory_balance.quantity + ($2)::decimal),
         quantity_quarantine = GREATEST(0, inventory_balance.quantity_quarantine + ($3)::decimal),
         last_movement_id = COALESCE($4, inventory_balance.last_movement_id),
         last_movement_at = CASE WHEN $4 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE inventory_balance.last_movement_at END,
         updated_at = CURRENT_TIMESTAMP`,
      [productId, quantityDelta, quarantineDelta, lastMovementId]
    );
  }

  async findByProduct(productId, client = null) {
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      'SELECT * FROM inventory_balance WHERE product_id = $1',
      [productId]
    );
    return result.rows[0] || null;
  }
}

module.exports = new InventoryBalanceRepository();
