const StockMovementRepository = require('../repositories/StockMovementRepository');
const InventoryRepository = require('../repositories/InventoryRepository');
const { resolveStockEntity, getEntityCurrentStock } = require('../utils/stockEntityResolver');

const STOCK_IN_TYPES = new Set([
  'purchase', 'return_in', 'adjustment_in', 'transfer_in', 'production', 'initial_stock',
]);
const STOCK_OUT_TYPES = new Set([
  'sale', 'return_out', 'adjustment_out', 'transfer_out', 'damage', 'expiry', 'theft', 'consumption',
]);

function mapLegacyFlowToMovement({ type, referenceModel, reference }) {
  const ref = String(reference || '');
  if (type === 'in') {
    if (referenceModel === 'PurchaseInvoice' || referenceModel === 'PurchaseOrder' || ref.includes('Purchase')) {
      return { movementType: 'purchase', referenceType: 'purchase_order' };
    }
    return { movementType: 'return_in', referenceType: 'return' };
  }
  if (type === 'return') {
    return { movementType: 'return_in', referenceType: 'return' };
  }
  if (type === 'out') {
    if (referenceModel === 'Sale' || referenceModel === 'SalesOrder' || ref.includes('Sales') || ref === 'Sales Invoice') {
      return { movementType: 'sale', referenceType: 'sales_order' };
    }
    return { movementType: 'adjustment_out', referenceType: 'adjustment' };
  }
  if (type === 'adjustment') {
    return { movementType: 'adjustment_in', referenceType: 'adjustment' };
  }
  if (type === 'damage' || type === 'theft') {
    return { movementType: type, referenceType: 'write_off' };
  }
  return { movementType: 'adjustment_out', referenceType: 'adjustment' };
}

class StockMovementService {
  /**
   * Create a stock movement record (supports base products and variants).
   */
  static async createMovement(movementData, user) {
    try {
      const {
        productId,
        movementType,
        quantity,
        unitCost,
        referenceType,
        referenceId,
        referenceNumber,
        location = 'main_warehouse',
        reason,
        notes,
        batchNumber,
        expiryDate,
        supplier,
        customer,
        fromLocation,
        toLocation,
        previousStock: providedPreviousStock,
        newStock: providedNewStock,
        skipInventoryUpdate = false,
        productModel: providedProductModel,
        productName: providedProductName,
        productSku: providedProductSku,
      } = movementData;

      if (typeof productId === 'string' && productId.startsWith('manual_')) {
        return null;
      }

      const entity = await resolveStockEntity(productId);
      if (!entity) {
        throw new Error('Product or variant not found');
      }

      const productModel = providedProductModel || entity.productModel;
      const currentStock =
        typeof providedPreviousStock === 'number'
          ? providedPreviousStock
          : await getEntityCurrentStock(entity.id, productModel);

      const resolvedUnitCost =
        typeof unitCost === 'number' && !Number.isNaN(unitCost) ? unitCost : entity.unitCost;
      const totalValue = quantity * resolvedUnitCost;

      const isStockIn = STOCK_IN_TYPES.has(movementType);
      const isStockOut = STOCK_OUT_TYPES.has(movementType);

      let previousStock = typeof providedPreviousStock === 'number' ? providedPreviousStock : undefined;
      let newStock = typeof providedNewStock === 'number' ? providedNewStock : undefined;

      if (typeof newStock !== 'number') {
        if (skipInventoryUpdate) {
          newStock = currentStock;
        } else if (isStockIn) {
          newStock = currentStock + quantity;
        } else if (isStockOut) {
          newStock = currentStock - quantity;
          if (newStock < 0) {
            throw new Error('Insufficient stock for this operation');
          }
        } else {
          newStock = currentStock;
        }
      }

      if (typeof previousStock !== 'number') {
        if (skipInventoryUpdate) {
          if (isStockIn) {
            previousStock = Math.max(newStock - quantity, 0);
          } else if (isStockOut) {
            previousStock = newStock + quantity;
          } else {
            previousStock = currentStock;
          }
        } else {
          previousStock = currentStock;
        }
      }

      const userId = user?.id ?? user?._id;
      const userName =
        user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.email || 'System';

      const stockMovementRecord = {
        productId: entity.id,
        product: entity.id,
        productModel,
        productName: providedProductName || entity.name,
        productSku: providedProductSku ?? entity.sku,
        movementType,
        quantity,
        unitCost: resolvedUnitCost,
        totalValue,
        previousStock,
        newStock,
        referenceType,
        referenceId,
        referenceNumber,
        location,
        warehouseId: movementData.warehouseId || null,
        shopId: movementData.shopId || null,
        fromLocation,
        toLocation,
        userId,
        user: userId,
        userName,
        reason,
        notes,
        batchNumber,
        expiryDate,
        supplier,
        customer,
        status: 'completed',
        systemGenerated: true,
      };

      const movement = await StockMovementRepository.create(stockMovementRecord);

      if (!skipInventoryUpdate) {
        try {
          await InventoryRepository.updateByProductId(entity.id, { currentStock: newStock });
        } catch (invErr) {
          console.error('Error updating Inventory record for stock movement:', invErr);
        }
      }

      return movement;
    } catch (error) {
      console.error('Error creating stock movement:', error);
      throw error;
    }
  }

  /** Log movement after legacy inventory update (warehouse feature off). */
  static async logLegacyInventoryMovement(flowParams, stockResult, user) {
    const { productId, type, quantity, cost, reason, reference, referenceId, referenceModel, notes } =
      flowParams;
    if (!productId || typeof productId === 'string' && productId.startsWith('manual_')) return null;

    const entity = await resolveStockEntity(productId);
    if (!entity) return null;

    const { movementType, referenceType } = mapLegacyFlowToMovement({
      type,
      referenceModel,
      reference,
    });

    const previousStock = Number(
      stockResult?.previousQuantity ??
      stockResult?.previousStock ??
      (Number(stockResult?.current_stock ?? stockResult?.currentStock ?? 0) -
        (['in', 'return'].includes(type) ? quantity : -quantity))
    );
    const newStock = Number(
      stockResult?.newQuantity ??
      stockResult?.newStock ??
      stockResult?.current_stock ??
      stockResult?.currentStock ??
      0
    );

    return StockMovementRepository.create({
      productId: entity.id,
      product: entity.id,
      productModel: entity.productModel,
      productName: entity.name,
      productSku: entity.sku,
      movementType,
      quantity,
      unitCost: cost != null ? Number(cost) : entity.unitCost,
      totalValue: quantity * (cost != null ? Number(cost) : entity.unitCost),
      previousStock: Number.isFinite(previousStock) ? previousStock : Math.max(newStock - quantity, 0),
      newStock,
      referenceType,
      referenceId: referenceId || entity.id,
      referenceNumber: reference || null,
      location: 'main_warehouse',
      userId: user?.id ?? user?._id,
      userName:
        user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.email || 'System',
      reason: reason || `Inventory ${type}`,
      notes,
      status: 'completed',
      systemGenerated: true,
    });
  }

  static async trackPurchaseOrder(purchaseOrder, user) {
    try {
      for (const item of purchaseOrder.items) {
        await this.createMovement(
          {
            productId: item.product,
            movementType: 'purchase',
            quantity: item.quantity,
            unitCost: item.unitCost,
            referenceType: 'purchase_order',
            referenceId: purchaseOrder._id,
            referenceNumber: purchaseOrder.poNumber,
            location: purchaseOrder.deliveryLocation || 'main_warehouse',
            reason: 'Purchase order received',
            notes: `PO: ${purchaseOrder.poNumber}`,
            supplier: purchaseOrder.supplier,
          },
          user
        );
      }
    } catch (error) {
      console.error('Error tracking purchase order:', error);
      throw error;
    }
  }

  static async trackSalesOrder(salesOrder, user) {
    try {
      const referenceNumber = salesOrder.soNumber || salesOrder.orderNumber || 'N/A';
      const location = salesOrder.shippingLocation || salesOrder.location || 'main_warehouse';

      for (const item of salesOrder.items) {
        if (
          item.isManual === true ||
          (typeof item.product === 'string' && item.product.startsWith('manual_'))
        ) {
          continue;
        }

        await this.createMovement(
          {
            productId: item.product,
            movementType: 'sale',
            quantity: item.quantity,
            unitCost: item.unitCost || 0,
            referenceType: 'sales_order',
            referenceId: salesOrder._id || salesOrder.id,
            referenceNumber,
            location,
            reason: 'Sales invoice/order fulfilled',
            notes: salesOrder.soNumber ? `SO: ${referenceNumber}` : `Invoice: ${referenceNumber}`,
            customer: salesOrder.customer,
            skipInventoryUpdate: true,
          },
          user
        );
      }
    } catch (error) {
      console.error('Error tracking sales order:', error);
      throw error;
    }
  }

  static async trackReturn(returnData, user) {
    try {
      const movementType = returnData.type === 'customer_return' ? 'return_in' : 'return_out';

      for (const item of returnData.items) {
        await this.createMovement(
          {
            productId: item.product,
            movementType,
            quantity: item.quantity,
            unitCost: item.unitCost,
            referenceType: 'return',
            referenceId: returnData._id,
            referenceNumber: returnData.returnNumber,
            location: returnData.location || 'main_warehouse',
            reason: returnData.reason,
            notes: `Return: ${returnData.returnNumber}`,
            customer: returnData.customer,
            supplier: returnData.supplier,
          },
          user
        );
      }
    } catch (error) {
      console.error('Error tracking return:', error);
      throw error;
    }
  }

  static async trackAdjustment(adjustmentData, user) {
    try {
      return await this.createMovement(
        {
          productId: adjustmentData.productId,
          movementType: adjustmentData.movementType,
          quantity: adjustmentData.quantity,
          unitCost: adjustmentData.unitCost,
          referenceType: 'adjustment',
          referenceId: adjustmentData.productId,
          referenceNumber: adjustmentData.referenceNumber,
          location: adjustmentData.location,
          reason: adjustmentData.reason,
          notes: adjustmentData.notes,
        },
        user
      );
    } catch (error) {
      console.error('Error tracking adjustment:', error);
      throw error;
    }
  }

  static async trackTransfer(transferData, user) {
    try {
      await this.createMovement(
        {
          productId: transferData.productId,
          movementType: 'transfer_out',
          quantity: transferData.quantity,
          unitCost: transferData.unitCost,
          referenceType: 'transfer',
          referenceId: transferData._id,
          referenceNumber: transferData.transferNumber,
          location: transferData.fromLocation,
          fromLocation: transferData.fromLocation,
          toLocation: transferData.toLocation,
          reason: 'Stock transfer out',
          notes: `Transfer: ${transferData.transferNumber}`,
        },
        user
      );

      await this.createMovement(
        {
          productId: transferData.productId,
          movementType: 'transfer_in',
          quantity: transferData.quantity,
          unitCost: transferData.unitCost,
          referenceType: 'transfer',
          referenceId: transferData._id,
          referenceNumber: transferData.transferNumber,
          location: transferData.toLocation,
          fromLocation: transferData.fromLocation,
          toLocation: transferData.toLocation,
          reason: 'Stock transfer in',
          notes: `Transfer: ${transferData.transferNumber}`,
        },
        user
      );
    } catch (error) {
      console.error('Error tracking transfer:', error);
      throw error;
    }
  }

  static async trackWriteOff(writeOffData, user) {
    try {
      return await this.createMovement(
        {
          productId: writeOffData.productId,
          movementType: writeOffData.writeOffType,
          quantity: writeOffData.quantity,
          unitCost: writeOffData.unitCost,
          referenceType: 'write_off',
          referenceId: writeOffData._id,
          referenceNumber: writeOffData.referenceNumber,
          location: writeOffData.location,
          reason: writeOffData.reason,
          notes: writeOffData.notes,
        },
        user
      );
    } catch (error) {
      console.error('Error tracking write-off:', error);
      throw error;
    }
  }

  static async getProductMovements(productId, options = {}) {
    return StockMovementRepository.getProductMovements(productId, options);
  }

  static async getProductSummary(productId, options = {}) {
    const summary = await StockMovementRepository.getStockSummary(productId, options.date);
    return (
      summary[0] || {
        totalIn: 0,
        totalOut: 0,
        totalValueIn: 0,
        totalValueOut: 0,
      }
    );
  }
}

module.exports = StockMovementService;
