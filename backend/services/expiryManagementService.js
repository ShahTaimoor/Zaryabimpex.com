const Batch = require('../models/Batch');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const auditLogService = require('./auditLogService');

class ExpiryManagementService {
  /**
   * Get products/batches expiring soon
   * @param {number} days - Number of days ahead to check (default: 30)
   * @returns {Promise<Array>}
   */
  async getExpiringSoon(days = 30) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    // Get batches expiring soon
    const expiringBatches = await Batch.find({
      status: 'active',
      expiryDate: { $lte: expiryDate, $gte: new Date() },
      currentQuantity: { $gt: 0 }
    })
    .populate('product', 'name sku')
    .sort({ expiryDate: 1 });

    // Get products with expiry dates (non-batch tracking)
    const expiringProducts = await Product.find({
      expiryDate: { $lte: expiryDate, $gte: new Date() },
      status: 'active',
      'inventory.currentStock': { $gt: 0 }
    })
    .select('name sku expiryDate inventory.currentStock')
    .sort({ expiryDate: 1 });

    return {
      batches: expiringBatches,
      products: expiringProducts,
      totalItems: expiringBatches.length + expiringProducts.length
    };
  }

  /**
   * Get expired products/batches
   * @returns {Promise<Array>}
   */
  async getExpired() {
    const now = new Date();

    // Get expired batches
    const expiredBatches = await Batch.find({
      status: { $in: ['active', 'expired'] },
      expiryDate: { $lt: now },
      currentQuantity: { $gt: 0 }
    })
    .populate('product', 'name sku')
    .sort({ expiryDate: 1 });

    // Get expired products
    const expiredProducts = await Product.find({
      expiryDate: { $lt: now },
      status: 'active',
      'inventory.currentStock': { $gt: 0 }
    })
    .select('name sku expiryDate inventory.currentStock')
    .sort({ expiryDate: 1 });

    return {
      batches: expiredBatches,
      products: expiredProducts,
      totalItems: expiredBatches.length + expiredProducts.length
    };
  }

  /**
   * Write off expired inventory
   * @param {string} batchId - Batch ID (optional, if null, processes all expired)
   * @param {string} userId - User ID performing write-off
   * @param {object} req - Express request object
   * @returns {Promise<Object>}
   */
  async writeOffExpired(batchId = null, userId, req = null) {
    const now = new Date();
    let batchesToWriteOff = [];

    if (batchId) {
      const batch = await Batch.findById(batchId);
      if (!batch) {
        throw new Error('Batch not found');
      }
      if (batch.expiryDate && new Date(batch.expiryDate) >= now) {
        throw new Error('Batch is not expired yet');
      }
      batchesToWriteOff = [batch];
    } else {
      // Get all expired batches
      batchesToWriteOff = await Batch.find({
        status: { $in: ['active', 'expired'] },
        expiryDate: { $lt: now },
        currentQuantity: { $gt: 0 }
      });
    }

    const results = {
      batchesProcessed: 0,
      totalQuantity: 0,
      totalValue: 0,
      errors: []
    };

    for (const batch of batchesToWriteOff) {
      try {
        const quantity = batch.currentQuantity;
        const value = quantity * batch.unitCost;

        // Create stock movement for expiry write-off
        await StockMovement.create({
          product: batch.product,
          productName: (await Product.findById(batch.product)).name,
          movementType: 'expiry',
          quantity,
          unitCost: batch.unitCost,
          totalValue: value,
          previousStock: (await Inventory.findOne({ product: batch.product }))?.currentStock || 0,
          newStock: ((await Inventory.findOne({ product: batch.product }))?.currentStock || 0) - quantity,
          referenceType: 'system_generated',
          referenceId: batch._id,
          referenceNumber: `EXP-${batch.batchNumber}`,
          reason: 'Expired inventory write-off',
          user: userId,
          userName: req?.user?.firstName || 'System',
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          status: 'completed'
        });

        // Update inventory
        const inventory = await Inventory.findOne({ product: batch.product });
        if (inventory) {
          await Inventory.updateStock(batch.product, {
            type: 'expiry',
            quantity,
            reason: 'Expired inventory write-off',
            reference: `Batch ${batch.batchNumber}`,
            date: new Date(),
            performedBy: userId
          });
        }

        // Update batch status
        batch.status = 'expired';
        batch.currentQuantity = 0;
        await batch.save();

        results.batchesProcessed++;
        results.totalQuantity += quantity;
        results.totalValue += value;

        // Log audit
        if (req) {
          await auditLogService.createAuditLog({
            entityType: 'Product',
            entityId: batch.product,
            action: 'STOCK_ADJUSTMENT',
            changes: {
              before: { batchQuantity: quantity },
              after: { batchQuantity: 0 },
              fieldsChanged: ['inventory.currentStock']
            },
            user: userId,
            ipAddress: req?.ip,
            userAgent: req?.headers['user-agent'],
            reason: `Expired batch write-off: ${batch.batchNumber}`,
            metadata: {
              batchNumber: batch.batchNumber,
              quantity: quantity,
              value: value
            }
          });
        }
      } catch (error) {
        results.errors.push({
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get FEFO batches for a product (First Expired First Out)
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity needed
   * @returns {Promise<Array>} Array of batches to use
   */
  async getFEFOBatches(productId, quantity) {
    const batches = await Batch.findFEFOBatches(productId, quantity);
    
    let remainingQty = quantity;
    const batchesToUse = [];

    for (const batch of batches) {
      if (remainingQty <= 0) break;
      if (!batch.canBeUsed()) continue;

      const qtyToUse = Math.min(remainingQty, batch.currentQuantity);
      batchesToUse.push({
        batch: batch,
        quantity: qtyToUse
      });

      remainingQty -= qtyToUse;
    }

    if (remainingQty > 0) {
      throw new Error(`Insufficient stock in valid batches. Need ${quantity}, available ${quantity - remainingQty}`);
    }

    return batchesToUse;
  }

  /**
   * Send expiry alerts
   * @param {number} days - Days before expiry to alert (default: 30, 15, 7)
   * @returns {Promise<Object>}
   */
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

    const expired = await this.getExpired();
    alerts.expired = expired;

    // TODO: Send notifications (email, SMS, etc.)
    // await notificationService.sendExpiryAlerts(alerts);

    return alerts;
  }
}

module.exports = new ExpiryManagementService();

