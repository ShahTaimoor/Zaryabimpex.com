/**
 * FIFO inventory engine — single source of truth for batch creation, consumption, and restoration.
 */
const inventoryBatchRepository = require('../repositories/postgres/InventoryBatchRepository');
const saleBatchAllocationRepository = require('../repositories/postgres/SaleBatchAllocationRepository');
const inventoryBatchMovementRepository = require('../repositories/postgres/InventoryBatchMovementRepository');
const productRepository = require('../repositories/postgres/ProductRepository');
const { query: pgQuery } = require('../config/postgres');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function toUuid(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return UUID_REGEX.test(s) ? s : null;
}

function mapReferenceType(referenceModel) {
  const m = String(referenceModel || '').toLowerCase();
  if (m.includes('purchaseinvoice')) return 'purchase_invoice';
  if (m.includes('purchaseorder')) return 'purchase_order';
  if (m === 'sale') return 'sale';
  if (m.includes('return')) return 'return';
  if (m.includes('adjustment')) return 'adjustment';
  return referenceModel ? String(referenceModel).toLowerCase() : 'stock_in';
}

class FIFOService {
  /**
   * Create a FIFO batch when stock is received (purchase, adjustment in, opening balance).
   */
  async receiveStock(
    {
      productId,
      quantity,
      unitCost,
      purchaseDate,
      purchaseId,
      supplierId,
      warehouseId,
      shopId,
      referenceModel,
      referenceId,
      referenceNumber,
      userId,
      notes,
      movementType = 'purchase_in',
    },
    client = null
  ) {
    const qty = Number(quantity);
    const cost = Number(unitCost ?? 0);
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      throw new Error('Invalid FIFO stock receipt');
    }

    const batch = await inventoryBatchRepository.create(
      {
        productId,
        purchaseId: purchaseId || referenceId || null,
        purchaseDate: purchaseDate || new Date(),
        supplierId,
        warehouseId,
        shopId,
        purchasedQuantity: qty,
        remainingQuantity: qty,
        unitCost: cost,
        totalCost: roundMoney(qty * cost),
        referenceType: mapReferenceType(referenceModel),
        referenceId,
        referenceNumber,
      },
      client
    );

    await inventoryBatchMovementRepository.create(
      {
        productId,
        inventoryBatchId: batch.id,
        movementType,
        quantityIn: qty,
        quantityOut: 0,
        remainingQuantity: qty,
        unitCost: cost,
        totalCost: roundMoney(qty * cost),
        referenceType: mapReferenceType(referenceModel),
        referenceId,
        referenceNumber,
        userId: toUuid(userId),
        notes,
      },
      client
    );

    await this.syncProductCostPrice(productId, client);
    return batch;
  }

  /**
   * Preview FIFO cost without mutating batches (for estimates).
   */
  async calculateFIFOCost(productId, quantity, client = null) {
    const batches = await inventoryBatchRepository.findAvailableForProduct(productId, client, false);
    return this._allocateFromBatches(batches, quantity, { preview: true });
  }

  /**
   * Consume oldest batches for a stock-out event. Persists sale allocations when saleId is provided.
   */
  async consumeStock(
    {
      productId,
      quantity,
      saleId = null,
      saleItemIndex = 0,
      referenceModel,
      referenceId,
      referenceNumber,
      userId,
      notes,
      movementType = 'sale_out',
    },
    client = null
  ) {
    const qty = Number(quantity);
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      throw new Error('Invalid FIFO consumption quantity');
    }

    await this.ensureFifoCoverage(productId, client);

    const batches = await inventoryBatchRepository.findAvailableForProduct(productId, client, true);
    const allocation = this._allocateFromBatches(batches, qty, { preview: false });

    if (allocation.remainingQty > 0) {
      throw new Error(
        `Insufficient FIFO inventory for product. Required: ${qty}, available: ${qty - allocation.remainingQty}`
      );
    }

    const persistedAllocations = [];

    for (const used of allocation.batchesUsed) {
      const batch = batches.find((b) => b.id === used.batchId);
      if (!batch) continue;

      const newRemaining = roundMoney(batch.remainingQuantity - used.quantity);
      await inventoryBatchRepository.updateRemaining(
        batch.id,
        Math.max(0, newRemaining),
        newRemaining <= 0 ? 'depleted' : 'active',
        client
      );

      await inventoryBatchMovementRepository.create(
        {
          productId,
          inventoryBatchId: batch.id,
          movementType,
          quantityIn: 0,
          quantityOut: used.quantity,
          remainingQuantity: Math.max(0, newRemaining),
          unitCost: used.unitCost,
          totalCost: used.totalCost,
          referenceType: mapReferenceType(referenceModel),
          referenceId,
          referenceNumber,
          userId: toUuid(userId),
          notes,
        },
        client
      );

      persistedAllocations.push({
        saleId,
        saleItemIndex,
        productId,
        inventoryBatchId: batch.id,
        quantityConsumed: used.quantity,
        unitCost: used.unitCost,
        totalCost: used.totalCost,
      });
    }

    if (saleId && persistedAllocations.length > 0) {
      await saleBatchAllocationRepository.createMany(persistedAllocations, client);
    }

    await this.syncProductCostPrice(productId, client);

    return {
      unitCost: allocation.unitCost,
      totalCost: allocation.totalCost,
      batches: allocation.batchesUsed,
      method: 'FIFO',
    };
  }

  /**
   * Restore inventory to original FIFO batches consumed by a sale (sales return).
   */
  async restoreFromSaleAllocations(
    { saleId, productId, quantity, saleItemIndex = null, returnId, referenceNumber, userId, notes },
    client = null
  ) {
    const qtyToRestore = Number(quantity);
    if (!saleId || !productId || !Number.isFinite(qtyToRestore) || qtyToRestore <= 0) {
      throw new Error('Invalid sale return FIFO restoration');
    }

    const allocations = await saleBatchAllocationRepository.findBySaleAndProduct(
      saleId,
      productId,
      saleItemIndex,
      client
    );

    let remaining = qtyToRestore;
    let totalRestoredCost = 0;

    for (const alloc of allocations) {
      if (remaining <= 0) break;
      const restorable = alloc.quantityConsumed - alloc.quantityRestored;
      if (restorable <= 0) continue;

      const restoreQty = Math.min(remaining, restorable);
      await inventoryBatchRepository.addRemaining(alloc.inventoryBatchId, restoreQty, client);
      await saleBatchAllocationRepository.recordRestore(alloc.id, restoreQty, client);

      const restoreCost = roundMoney(restoreQty * alloc.unitCost);
      totalRestoredCost += restoreCost;

      const batch = await inventoryBatchRepository.findById(alloc.inventoryBatchId, client);
      await inventoryBatchMovementRepository.create(
        {
          productId,
          inventoryBatchId: alloc.inventoryBatchId,
          movementType: 'sale_return_in',
          quantityIn: restoreQty,
          quantityOut: 0,
          remainingQuantity: batch?.remainingQuantity ?? null,
          unitCost: alloc.unitCost,
          totalCost: restoreCost,
          referenceType: 'return',
          referenceId: returnId,
          referenceNumber,
          userId: toUuid(userId),
          notes: notes || 'FIFO batch restored from sale return',
        },
        client
      );

      remaining -= restoreQty;
    }

    if (remaining > 0) {
      const cost = await this._fallbackUnitCost(productId, client);
      await this.receiveStock(
        {
          productId,
          quantity: remaining,
          unitCost: cost,
          referenceModel: 'Return',
          referenceId: returnId,
          referenceNumber,
          userId,
          notes: 'FIFO fallback batch for sale return without allocation history',
          movementType: 'sale_return_in',
        },
        client
      );
      totalRestoredCost += roundMoney(remaining * cost);
    }

    await this.syncProductCostPrice(productId, client);

    return {
      quantityRestored: qtyToRestore,
      totalCost: roundMoney(totalRestoredCost),
      unitCost: qtyToRestore > 0 ? roundMoney(totalRestoredCost / qtyToRestore) : 0,
    };
  }

  /**
   * Reduce stock from purchase-specific batches (purchase return).
   */
  async reduceFromPurchaseBatches(
    {
      productId,
      quantity,
      purchaseReferenceType,
      purchaseReferenceId,
      returnId,
      referenceNumber,
      userId,
      notes,
    },
    client = null
  ) {
    const qty = Number(quantity);
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      throw new Error('Invalid purchase return FIFO reduction');
    }

    const refType = purchaseReferenceType || 'purchase_invoice';
    const batches = await inventoryBatchRepository.findByPurchaseReference(
      refType,
      purchaseReferenceId,
      productId,
      client
    );

    let remaining = qty;
    let totalCost = 0;
    const batchesUsed = [];

    for (const batch of batches) {
      if (remaining <= 0) break;
      if (batch.remainingQuantity <= 0) continue;

      const take = Math.min(remaining, batch.remainingQuantity);
      const newRemaining = roundMoney(batch.remainingQuantity - take);
      await inventoryBatchRepository.updateRemaining(
        batch.id,
        Math.max(0, newRemaining),
        newRemaining <= 0 ? 'depleted' : 'active',
        client
      );

      const lineCost = roundMoney(take * batch.unitCost);
      totalCost += lineCost;
      batchesUsed.push({ batchId: batch.id, quantity: take, unitCost: batch.unitCost, totalCost: lineCost });

      await inventoryBatchMovementRepository.create(
        {
          productId,
          inventoryBatchId: batch.id,
          movementType: 'purchase_return_out',
          quantityIn: 0,
          quantityOut: take,
          remainingQuantity: Math.max(0, newRemaining),
          unitCost: batch.unitCost,
          totalCost: lineCost,
          referenceType: 'return',
          referenceId: returnId,
          referenceNumber,
          userId: toUuid(userId),
          notes: notes || 'FIFO batch reduced for purchase return',
        },
        client
      );

      remaining -= take;
    }

    if (remaining > 0) {
      const generic = await this.consumeStock(
        {
          productId,
          quantity: remaining,
          referenceModel: 'Return',
          referenceId: returnId,
          referenceNumber,
          userId,
          notes: 'FIFO generic consume for purchase return shortfall on purchase batch',
          movementType: 'purchase_return_out',
        },
        client
      );
      totalCost += generic.totalCost;
      batchesUsed.push(...(generic.batches || []));
      remaining = 0;
    }

    await this.syncProductCostPrice(productId, client);

    return {
      unitCost: qty > 0 ? roundMoney(totalCost / qty) : 0,
      totalCost: roundMoney(totalCost),
      batches: batchesUsed,
      method: 'FIFO',
    };
  }

  async getProductValuation(productId, client = null) {
    return inventoryBatchRepository.getValuationByProduct(productId, client);
  }

  /**
   * Physical on-hand quantity (inventory_balance > inventory > products.stock_quantity).
   */
  async getPhysicalQuantity(productId, client = null) {
    const q = client ? client.query.bind(client) : pgQuery;
    const result = await q(
      `SELECT GREATEST(
         COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0), 0
       )::numeric AS physical_qty
       FROM products p
       LEFT JOIN inventory i ON i.product_id = p.id AND i.deleted_at IS NULL
       LEFT JOIN (
         SELECT product_id, SUM(quantity) AS quantity
         FROM inventory_balance
         GROUP BY product_id
       ) ib ON ib.product_id = p.id
       WHERE p.id = $1`,
      [productId]
    );
    return Number(result.rows[0]?.physical_qty) || 0;
  }

  /**
   * Create opening-balance FIFO batches when physical stock exceeds batch layers
   * (post-migration gap, manual stock adds, or products created after deploy).
   */
  async ensureFifoCoverage(productId, client = null) {
    const valuation = await inventoryBatchRepository.getValuationByProduct(productId, client);
    const batchQty = valuation.totalQty;
    const physicalQty = await this.getPhysicalQuantity(productId, client);
    const gap = roundMoney(physicalQty - batchQty);
    if (gap <= 0) {
      return { synced: 0, physicalQty, batchQty };
    }

    const unitCost = await this._fallbackUnitCost(productId, client);
    await this.receiveStock(
      {
        productId,
        quantity: gap,
        unitCost,
        referenceModel: 'opening_balance',
        notes: 'FIFO layer sync from on-hand physical stock',
        movementType: 'opening_balance_in',
      },
      client
    );

    return { synced: gap, physicalQty, batchQty: batchQty + gap };
  }

  async getValuationMap(productIds = null, client = null) {
    const rows = await inventoryBatchRepository.getValuationSummary(productIds, client);
    const map = new Map();
    for (const row of rows) {
      map.set(row.productId, row);
    }
    return map;
  }

  /**
   * Sync products.cost_price from remaining FIFO batch value (inventory valuation per unit).
   * Note: this is the blended unit value of all remaining layers — used for reports/GL fallback.
   * POS/sales UI uses the oldest batch cost via attachFifoUnitCosts (next FIFO layer).
   */
  async syncProductCostPrice(productId, client = null) {
    const valuation = await inventoryBatchRepository.getValuationByProduct(productId, client);
    if (valuation.totalQty <= 0) return valuation;
    await productRepository.update(productId, { costPrice: valuation.unitValue }, client);
    return valuation;
  }

  _allocateFromBatches(batches, quantity, { preview = false } = {}) {
    let remainingQty = Number(quantity);
    let totalCost = 0;
    const batchesUsed = [];

    for (const batch of batches) {
      if (remainingQty <= 0) break;
      const available = Number(batch.remainingQuantity) || 0;
      if (available <= 0) continue;

      const qtyToUse = Math.min(remainingQty, available);
      const lineCost = roundMoney(qtyToUse * batch.unitCost);
      totalCost += lineCost;
      batchesUsed.push({
        batchId: batch.id,
        quantity: qtyToUse,
        unitCost: batch.unitCost,
        totalCost: lineCost,
        purchaseDate: batch.purchaseDate,
      });
      remainingQty -= qtyToUse;
    }

    const consumedQty = Number(quantity) - remainingQty;
    return {
      unitCost: consumedQty > 0 ? roundMoney(totalCost / consumedQty) : 0,
      totalCost: roundMoney(totalCost),
      batchesUsed,
      remainingQty,
    };
  }

  async _fallbackUnitCost(productId, client) {
    const valuation = await inventoryBatchRepository.getValuationByProduct(productId, client);
    if (valuation.unitValue > 0) return valuation.unitValue;
    const product = await productRepository.findById(productId);
    return parseFloat(product?.cost_price ?? product?.costPrice ?? 0) || 0;
  }
}

module.exports = new FIFOService();
