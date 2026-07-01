const { query } = require('../../config/postgres');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function rowToBatch(row) {
  if (!row) return null;
  const purchased =
    row.purchased_quantity ?? row.quantity_received ?? row.purchasedQuantity;
  const remaining =
    row.remaining_quantity ?? row.quantity_remaining ?? row.remainingQuantity;
  const status = row.batch_status ?? row.status ?? 'active';
  const refType = row.reference_type ?? row.source_type ?? null;
  const refId = row.reference_id ?? row.source_id ?? row.purchase_id ?? null;
  const totalCost = row.total_cost ?? row.total_cost_received ?? 0;

  return {
    id: row.id,
    productId: row.product_id,
    purchaseId: row.purchase_id ?? row.source_id ?? null,
    purchaseDate: row.purchase_date,
    supplierId: row.supplier_id,
    warehouseId: row.warehouse_id,
    shopId: row.shop_id,
    purchasedQuantity: num(purchased),
    remainingQuantity: num(remaining),
    unitCost: num(row.unit_cost),
    totalCost: num(totalCost),
    batchStatus: status,
    referenceType: refType,
    referenceId: refId,
    referenceNumber: row.reference_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REMAINING_EXPR = 'COALESCE(quantity_remaining, 0)';
const STATUS_EXPR = "COALESCE(status, 'active')";

class InventoryBatchRepository {
  _q(client) {
    return client ? client.query.bind(client) : query;
  }

  async create(data, client = null) {
    const q = this._q(client);
    const purchasedQty = Number(data.purchasedQuantity ?? data.purchased_quantity ?? data.quantity);
    const unitCost = Number(data.unitCost ?? data.unit_cost ?? 0);
    const remainingQty = Number(data.remainingQuantity ?? data.remaining_quantity ?? purchasedQty);
    const totalCost = Number(data.totalCost ?? data.total_cost ?? Math.round(purchasedQty * unitCost * 100) / 100);
    const refType = data.referenceType ?? data.reference_type ?? data.sourceType ?? null;
    const refId = data.referenceId ?? data.reference_id ?? data.purchaseId ?? data.purchase_id ?? null;

    const result = await q(
      `INSERT INTO inventory_batches (
        product_id, warehouse_id, shop_id, source_type, source_id, supplier_id, purchase_date,
        unit_cost, quantity_received, quantity_remaining, status, notes,
        reference_number, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        data.productId ?? data.product_id,
        data.warehouseId ?? data.warehouse_id ?? null,
        data.shopId ?? data.shop_id ?? null,
        refType,
        refId,
        data.supplierId ?? data.supplier_id ?? null,
        data.purchaseDate ?? data.purchase_date ?? new Date(),
        unitCost,
        purchasedQty,
        remainingQty,
        data.batchStatus ?? data.batch_status ?? data.status ?? 'active',
        data.notes ?? null,
        data.referenceNumber ?? data.reference_number ?? null,
      ]
    );
    return rowToBatch(result.rows[0]);
  }

  async findById(id, client = null, forUpdate = false) {
    const q = this._q(client);
    const lock = forUpdate ? ' FOR UPDATE' : '';
    const result = await q(`SELECT * FROM inventory_batches WHERE id = $1${lock}`, [id]);
    return rowToBatch(result.rows[0]);
  }

  async findAvailableForProduct(productId, client = null, forUpdate = true) {
    const q = this._q(client);
    const lock = forUpdate ? ' FOR UPDATE' : '';
    const result = await q(
      `SELECT * FROM inventory_batches
       WHERE product_id = $1
         AND ${REMAINING_EXPR} > 0
         AND ${STATUS_EXPR} = 'active'
       ORDER BY purchase_date ASC NULLS LAST, created_at ASC${lock}`,
      [productId]
    );
    return result.rows.map(rowToBatch);
  }

  async findByPurchaseReference(referenceType, referenceId, productId = null, client = null) {
    const q = this._q(client);
    const params = [referenceType, referenceId];
    let sql = `SELECT * FROM inventory_batches
               WHERE source_type = $1 AND source_id = $2 AND ${STATUS_EXPR} = 'active'`;
    if (productId) {
      params.push(productId);
      sql += ' AND product_id = $3';
    }
    sql += ' ORDER BY created_at ASC';
    const result = await q(sql, params);
    return result.rows.map(rowToBatch);
  }

  async updateRemaining(id, remainingQuantity, batchStatus = null, client = null) {
    const q = this._q(client);
    const status = batchStatus ?? (remainingQuantity <= 0 ? 'depleted' : 'active');
    const result = await q(
      `UPDATE inventory_batches
       SET quantity_remaining = $2, status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, remainingQuantity, status]
    );
    return rowToBatch(result.rows[0]);
  }

  async addRemaining(id, quantityToAdd, client = null) {
    const q = this._q(client);
    const result = await q(
      `UPDATE inventory_batches
       SET quantity_remaining = quantity_remaining + $2,
           status = CASE WHEN quantity_remaining + $2 > 0 THEN 'active' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, quantityToAdd]
    );
    return rowToBatch(result.rows[0]);
  }

  async getValuationByProduct(productId, client = null) {
    const q = this._q(client);
    const result = await q(
      `SELECT
         COALESCE(SUM(${REMAINING_EXPR}), 0) AS total_qty,
         COALESCE(SUM((${REMAINING_EXPR}) * unit_cost), 0) AS total_value
       FROM inventory_batches
       WHERE product_id = $1 AND ${STATUS_EXPR} = 'active' AND ${REMAINING_EXPR} > 0`,
      [productId]
    );
    const row = result.rows[0] || {};
    const totalQty = num(row.total_qty);
    const totalValue = num(row.total_value);
    return {
      totalQty,
      totalValue,
      unitValue: totalQty > 0 ? Math.round((totalValue / totalQty) * 100) / 100 : 0,
    };
  }

  /** Oldest active batch unit_cost per product (next FIFO layer for POS / sale preview). */
  async findNextFifoUnitCostsByProductIds(productIds, client = null) {
    if (!productIds || productIds.length === 0) return new Map();
    const q = this._q(client);
    const result = await q(
      `SELECT DISTINCT ON (product_id)
         product_id,
         unit_cost
       FROM inventory_batches
       WHERE product_id = ANY($1::uuid[])
         AND ${REMAINING_EXPR} > 0
         AND ${STATUS_EXPR} = 'active'
       ORDER BY product_id, purchase_date ASC NULLS LAST, created_at ASC`,
      [productIds]
    );
    const map = new Map();
    for (const row of result.rows) {
      map.set(String(row.product_id), num(row.unit_cost));
    }
    return map;
  }

  async getValuationSummary(productIds = null, client = null) {
    const q = this._q(client);
    let sql = `SELECT
      product_id,
      COALESCE(SUM(${REMAINING_EXPR}), 0) AS total_qty,
      COALESCE(SUM((${REMAINING_EXPR}) * unit_cost), 0) AS total_value
    FROM inventory_batches
    WHERE ${STATUS_EXPR} = 'active' AND ${REMAINING_EXPR} > 0`;
    const params = [];
    if (productIds && productIds.length > 0) {
      params.push(productIds);
      sql += ' AND product_id = ANY($1::uuid[])';
    }
    sql += ' GROUP BY product_id';
    const result = await q(sql, params);
    return result.rows.map((row) => ({
      productId: row.product_id,
      totalQty: num(row.total_qty),
      totalValue: num(row.total_value),
      unitValue:
        num(row.total_qty) > 0
          ? Math.round((num(row.total_value) / num(row.total_qty)) * 100) / 100
          : 0,
    }));
  }
}

module.exports = new InventoryBatchRepository();
