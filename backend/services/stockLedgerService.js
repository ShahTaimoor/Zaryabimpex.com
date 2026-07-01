const { query } = require('../config/postgres');

function shortBatchId(id) {
  if (!id) return '';
  const s = String(id);
  return s.length > 8 ? s.slice(0, 8) : s;
}

function mapAllocationRow(row) {
  return {
    saleId: row.sale_id,
    productId: row.product_id,
    inventoryBatchId: row.inventory_batch_id,
    quantity: parseFloat(row.quantity) || 0,
    unitCost: parseFloat(row.unit_cost) || 0,
    totalCost: parseFloat(row.total_cost) || 0,
    purchaseDate: row.purchase_date,
    sourceType: row.source_type,
  };
}

function mapBatchRow(row) {
  return {
    id: row.id,
    productId: row.product_id,
    sourceId: row.source_id,
    sourceType: row.source_type,
    quantity: parseFloat(row.quantity_received) || 0,
    remainingQuantity: parseFloat(row.quantity_remaining) || 0,
    unitCost: parseFloat(row.unit_cost) || 0,
    purchaseDate: row.purchase_date,
  };
}

class StockLedgerService {
  async getSaleAllocationsBySaleIds(saleIds) {
    if (!saleIds || saleIds.length === 0) return new Map();
    const result = await query(
      `SELECT sba.*, ib.purchase_date, ib.source_type
       FROM sale_batch_allocations sba
       LEFT JOIN inventory_batches ib ON ib.id = sba.inventory_batch_id
       WHERE sba.sale_id = ANY($1::uuid[])
       ORDER BY sba.created_at`,
      [saleIds]
    );
    const map = new Map();
    for (const row of result.rows) {
      const alloc = mapAllocationRow(row);
      const key = `${alloc.saleId}:${alloc.productId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(alloc);
    }
    return map;
  }

  async getPurchaseBatchesByInvoiceIds(invoiceIds) {
    if (!invoiceIds || invoiceIds.length === 0) return new Map();
    const result = await query(
      `SELECT * FROM inventory_batches
       WHERE source_id = ANY($1::uuid[])
       ORDER BY purchase_date ASC NULLS LAST, created_at ASC`,
      [invoiceIds]
    );
    const map = new Map();
    for (const row of result.rows) {
      const batch = mapBatchRow(row);
      const key = `${batch.sourceId}:${batch.productId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(batch);
    }
    return map;
  }

  formatFifoBatchLabel(batches = []) {
    if (!batches || batches.length === 0) return null;
    return batches
      .map((b) => {
        const id = shortBatchId(b.inventoryBatchId ?? b.id);
        const qty = b.quantity ?? b.quantity_received ?? b.remainingQuantity;
        return `${id} @ ${Number(b.unitCost).toFixed(2)} × ${qty}`;
      })
      .join('; ');
  }

  attachSaleFifoFields(entry, allocations, item) {
    const unitCost = parseFloat(item?.unit_cost ?? item?.unitCost ?? 0) || 0;
    const qty = Math.abs(Number(item?.quantity ?? entry.quantity ?? 0));
    const effectiveAllocs = allocations && allocations.length > 0 ? allocations : null;
    const fifoUnitCost =
      effectiveAllocs
        ? effectiveAllocs.reduce((s, a) => s + a.totalCost, 0) / Math.max(1, effectiveAllocs.reduce((s, a) => s + a.quantity, 0))
        : unitCost;

    return {
      ...entry,
      unitCost: Math.round(fifoUnitCost * 100) / 100,
      costAmount: -Math.round(qty * fifoUnitCost * 100) / 100,
      fifoBatches: (effectiveAllocs || []).map((a) => ({
        batchId: a.inventoryBatchId,
        quantity: a.quantity,
        unitCost: a.unitCost,
        totalCost: a.totalCost,
      })),
      fifoBatchLabel: this.formatFifoBatchLabel(effectiveAllocs) || (unitCost > 0 ? 'Line cost (no batch detail)' : null),
    };
  }

  attachPurchaseFifoFields(entry, batches, item) {
    const unitCost = parseFloat(item?.unit_cost ?? item?.unitCost ?? 0) || 0;
    const qty = Math.abs(Number(item?.quantity ?? entry.quantity ?? 0));
    const matching = batches && batches.length > 0 ? batches : null;
    const fifoUnitCost = matching
      ? matching.reduce((s, b) => s + b.quantity * b.unitCost, 0) / Math.max(1, matching.reduce((s, b) => s + b.quantity, 0))
      : unitCost;

    return {
      ...entry,
      unitCost: Math.round(fifoUnitCost * 100) / 100,
      costAmount: Math.round(qty * fifoUnitCost * 100) / 100,
      fifoBatches: (matching || []).map((b) => ({
        batchId: b.id,
        quantity: b.quantity,
        unitCost: b.unitCost,
        totalCost: Math.round(b.quantity * b.unitCost * 100) / 100,
      })),
      fifoBatchLabel: this.formatFifoBatchLabel(
        matching?.map((b) => ({ id: b.id, quantity: b.quantity, unitCost: b.unitCost }))
      ) || (unitCost > 0 ? 'Line cost (no batch detail)' : null),
    };
  }
}

module.exports = new StockLedgerService();
