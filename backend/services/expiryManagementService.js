const BatchRepository = require('../repositories/BatchRepository');
const ProductRepository = require('../repositories/ProductRepository');
const InventoryRepository = require('../repositories/InventoryRepository');
const StockMovementRepository = require('../repositories/StockMovementRepository');
const auditLogService = require('./auditLogService');

function toId(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v && typeof v.toString === 'function') return v.toString();
  return String(v);
}

function isExpired(batch) {
  const exp = batch.expiryDate ?? batch.expiry_date;
  return exp && new Date(exp) < new Date();
}

function canBeUsed(batch) {
  return batch.status === 'active' &&
    (parseFloat(batch.currentQuantity ?? batch.current_quantity) || 0) > 0 &&
    !isExpired(batch);
}

class ExpiryManagementService {
  async getExpiringSoon(days = 30) {
    const expiryEnd = new Date();
    expiryEnd.setDate(expiryEnd.getDate() + days);
    const now = new Date();

    const expiringBatches = await BatchRepository.findAll({
      status: 'active',
      expiryGte: now,
      expiryLte: expiryEnd,
      currentQuantityGt: 0
    }, { limit: 500 });

    const productIds = [...new Set(expiringBatches.map(b => toId(b.productId ?? b.product)))];
    const productMap = {};
    for (const id of productIds) {
      const p = await ProductRepository.findById(id);
      if (p) productMap[id] = { id: p.id, name: p.name, sku: p.sku };
    }
    const batchesWithProduct = expiringBatches.map(b => ({
      ...b,
      product: productMap[toId(b.productId ?? b.product)] || null
    }));

    return {
      batches: batchesWithProduct,
      products: [],
      totalItems: batchesWithProduct.length
    };
  }

  async getExpired() {
    const now = new Date();

    const expiredBatches = await BatchRepository.findAll({
      statusIn: ['active', 'expired'],
      expiryLte: now,
      currentQuantityGt: 0
    }, { limit: 500 });

    const productIds = [...new Set(expiredBatches.map(b => toId(b.productId ?? b.product)))];
    const productMap = {};
    for (const id of productIds) {
      const p = await ProductRepository.findById(id);
      if (p) productMap[id] = { id: p.id, name: p.name, sku: p.sku };
    }
    const batchesWithProduct = expiredBatches.map(b => ({
      ...b,
      product: productMap[toId(b.productId ?? b.product)] || null
    }));

    return {
      batches: batchesWithProduct,
      products: [],
      totalItems: batchesWithProduct.length
    };
  }

  async writeOffExpired(batchId = null, userId, req = null) {
    const now = new Date();
    let batchesToWriteOff = [];

    if (batchId) {
      const batch = await BatchRepository.findById(batchId);
      if (!batch) throw new Error('Batch not found');
      if (batch.expiryDate && new Date(batch.expiryDate) >= now) {
        throw new Error('Batch is not expired yet');
      }
      batchesToWriteOff = [batch];
    } else {
      batchesToWriteOff = await BatchRepository.findAll({
        statusIn: ['active', 'expired'],
        expiryLte: now,
        currentQuantityGt: 0
      }, { limit: 500 });
    }

    const results = { batchesProcessed: 0, totalQuantity: 0, totalValue: 0, errors: [] };

    for (const batch of batchesToWriteOff) {
      try {
        const quantity = parseFloat(batch.currentQuantity ?? batch.current_quantity) || 0;
        const unitCost = parseFloat(batch.unitCost ?? batch.unit_cost) || 0;
        const value = quantity * unitCost;
        const productId = toId(batch.productId ?? batch.product);

        const product = await ProductRepository.findById(productId);
        const inv = await InventoryRepository.findOne({ productId });
        const previousStock = inv ? (parseFloat(inv.current_stock ?? inv.currentStock) || 0) : 0;
        const newStock = Math.max(0, previousStock - quantity);

        await StockMovementRepository.create({
          productId,
          productName: product?.name ?? '',
          productSku: product?.sku ?? null,
          movementType: 'expiry',
          quantity,
          unitCost,
          totalValue: value,
          previousStock,
          newStock,
          referenceType: 'system_generated',
          referenceId: batch.id,
          referenceNumber: `EXP-${batch.batchNumber ?? batch.batch_number}`,
          reason: 'Expired inventory write-off',
          user: userId,
          userName: req?.user?.firstName ?? req?.user?.name ?? 'System',
          batchNumber: batch.batchNumber ?? batch.batch_number,
          expiryDate: batch.expiryDate ?? batch.expiry_date,
          status: 'completed'
        });

        if (inv) {
          await InventoryRepository.updateByProductId(productId, {
            currentStock: newStock
          });
        }

        await BatchRepository.updateById(batch.id, { status: 'expired', currentQuantity: 0 });

        results.batchesProcessed++;
        results.totalQuantity += quantity;
        results.totalValue += value;

        if (req) {
          await auditLogService.createAuditLog({
            entityType: 'Product',
            entityId: productId,
            action: 'STOCK_ADJUSTMENT',
            changes: {
              before: { batchQuantity: quantity },
              after: { batchQuantity: 0 },
              fieldsChanged: ['inventory.currentStock']
            },
            user: userId,
            ipAddress: req?.ip,
            userAgent: req?.headers?.['user-agent'],
            reason: `Expired batch write-off: ${batch.batchNumber ?? batch.batch_number}`,
            metadata: {
              batchNumber: batch.batchNumber ?? batch.batch_number,
              quantity,
              value
            }
          });
        }
      } catch (error) {
        results.errors.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber ?? batch.batch_number,
          error: error.message
        });
      }
    }

    return results;
  }

  async getFEFOBatches(productId, quantity) {
    const batches = await BatchRepository.findFEFOBatches(productId, quantity);
    let remainingQty = quantity;
    const batchesToUse = [];

    for (const batch of batches) {
      if (remainingQty <= 0) break;
      if (!canBeUsed(batch)) continue;

      const qty = parseFloat(batch.currentQuantity ?? batch.current_quantity) || 0;
      const qtyToUse = Math.min(remainingQty, qty);
      batchesToUse.push({ batch, quantity: qtyToUse });
      remainingQty -= qtyToUse;
    }

    if (remainingQty > 0) {
      throw new Error(`Insufficient stock in valid batches. Need ${quantity}, available ${quantity - remainingQty}`);
    }

    return batchesToUse;
  }

  async sendExpiryAlerts(days = [30, 15, 7]) {
    const alerts = {
      expiring30Days: [],
      expiring15Days: [],
      expiring7Days: [],
      expired: []
    };

    for (const day of days) {
      const expiring = await this.getExpiringSoon(day);
      if (day === 30) alerts.expiring30Days = expiring;
      if (day === 15) alerts.expiring15Days = expiring;
      if (day === 7) alerts.expiring7Days = expiring;
    }

    alerts.expired = await this.getExpired();
    return alerts;
  }
}

module.exports = new ExpiryManagementService();
