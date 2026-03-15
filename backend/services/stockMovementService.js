const StockMovementRepository = require('../repositories/StockMovementRepository');
const ProductRepository = require('../repositories/ProductRepository');
const InventoryRepository = require('../repositories/InventoryRepository');

class StockMovementService {
  /**
   * Create a stock movement record
   * @param {Object} movementData - Movement data
   * @param {Object} user - User performing the action
   * @returns {Promise<StockMovement>}
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
        skipInventoryUpdate = false
      } = movementData;

      // Get product details
      const product = await ProductRepository.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const inventoryRow = await InventoryRepository.findByProduct(productId);
      const currentStock = inventoryRow
        ? Number(inventoryRow.current_stock ?? inventoryRow.currentStock ?? 0)
        : Number(product.stock_quantity ?? product.stockQuantity ?? 0);
      const resolvedUnitCost = typeof unitCost === 'number' && !Number.isNaN(unitCost)
        ? unitCost
        : (Number(product.cost_price ?? product.costPrice ?? 0) || (product.pricing?.cost ?? 0));
      const totalValue = quantity * resolvedUnitCost;

      const isStockIn = ['purchase', 'return_in', 'adjustment_in', 'transfer_in', 'production', 'initial_stock'].includes(movementType);
      const isStockOut = ['sale', 'return_out', 'adjustment_out', 'transfer_out', 'damage', 'expiry', 'theft', 'consumption'].includes(movementType);

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
      const userName = (user?.firstName && user?.lastName) ? `${user.firstName} ${user.lastName}` : (user?.email || 'System');
      const stockMovementRecord = {
        productId,
        product: productId,
        productName: product.name || product.productName,
        productSku: product.sku || null,
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
        systemGenerated: true
      };

      const movement = await StockMovementRepository.create(stockMovementRecord);

      if (!skipInventoryUpdate) {
        try {
          await InventoryRepository.updateByProductId(productId, { currentStock: newStock });
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

  /**
   * Track purchase order stock movement
   * @param {Object} purchaseOrder - Purchase order data
   * @param {Object} user - User performing the action
   */
  static async trackPurchaseOrder(purchaseOrder, user) {
    try {
      for (const item of purchaseOrder.items) {
        await this.createMovement({
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
          supplier: purchaseOrder.supplier
        }, user);
      }
    } catch (error) {
      console.error('Error tracking purchase order:', error);
      throw error;
    }
  }

  /**
   * Track sales order stock movement
   * @param {Object} salesOrder - Sales order or Sales invoice data
   * @param {Object} user - User performing the action
   */
  static async trackSalesOrder(salesOrder, user) {
    try {
      // Handle both Sales Orders (soNumber) and Sales Invoices (orderNumber)
      const referenceNumber = salesOrder.soNumber || salesOrder.orderNumber || 'N/A';
      const location = salesOrder.shippingLocation || salesOrder.location || 'main_warehouse';
      
      for (const item of salesOrder.items) {
        await this.createMovement({
          productId: item.product,
          movementType: 'sale',
          quantity: item.quantity,
          unitCost: item.unitCost || 0,
          referenceType: 'sales_order',
          referenceId: salesOrder._id,
          referenceNumber: referenceNumber,
          location: location,
          reason: 'Sales invoice/order fulfilled',
          notes: salesOrder.soNumber ? `SO: ${referenceNumber}` : `Invoice: ${referenceNumber}`,
          customer: salesOrder.customer,
          skipInventoryUpdate: true
        }, user);
      }
    } catch (error) {
      console.error('Error tracking sales order:', error);
      throw error;
    }
  }

  /**
   * Track return stock movement
   * @param {Object} returnData - Return data
   * @param {Object} user - User performing the action
   */
  static async trackReturn(returnData, user) {
    try {
      const movementType = returnData.type === 'customer_return' ? 'return_in' : 'return_out';
      
      for (const item of returnData.items) {
        await this.createMovement({
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
          supplier: returnData.supplier
        }, user);
      }
    } catch (error) {
      console.error('Error tracking return:', error);
      throw error;
    }
  }

  /**
   * Track stock adjustment
   * @param {Object} adjustmentData - Adjustment data
   * @param {Object} user - User performing the action
   */
  static async trackAdjustment(adjustmentData, user) {
    try {
      return await this.createMovement({
        productId: adjustmentData.productId,
        movementType: adjustmentData.movementType,
        quantity: adjustmentData.quantity,
        unitCost: adjustmentData.unitCost,
        referenceType: 'adjustment',
        referenceId: adjustmentData.productId,
        referenceNumber: adjustmentData.referenceNumber,
        location: adjustmentData.location,
        reason: adjustmentData.reason,
        notes: adjustmentData.notes
      }, user);
    } catch (error) {
      console.error('Error tracking adjustment:', error);
      throw error;
    }
  }

  /**
   * Track stock transfer
   * @param {Object} transferData - Transfer data
   * @param {Object} user - User performing the action
   */
  static async trackTransfer(transferData, user) {
    try {
      // Create outbound movement
      await this.createMovement({
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
        notes: `Transfer: ${transferData.transferNumber}`
      }, user);

      // Create inbound movement
      await this.createMovement({
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
        notes: `Transfer: ${transferData.transferNumber}`
      }, user);
    } catch (error) {
      console.error('Error tracking transfer:', error);
      throw error;
    }
  }

  /**
   * Track damage/write-off
   * @param {Object} writeOffData - Write-off data
   * @param {Object} user - User performing the action
   */
  static async trackWriteOff(writeOffData, user) {
    try {
      return await this.createMovement({
        productId: writeOffData.productId,
        movementType: writeOffData.writeOffType, // 'damage', 'expiry', 'theft'
        quantity: writeOffData.quantity,
        unitCost: writeOffData.unitCost,
        referenceType: 'write_off',
        referenceId: writeOffData._id,
        referenceNumber: writeOffData.referenceNumber,
        location: writeOffData.location,
        reason: writeOffData.reason,
        notes: writeOffData.notes
      }, user);
    } catch (error) {
      console.error('Error tracking write-off:', error);
      throw error;
    }
  }

  /**
   * Get stock movement summary for a product
   * @param {String} productId - Product ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  static async getProductSummary(productId, options = {}) {
    try {
      const summary = await StockMovement.getStockSummary(productId, options.date);
      return summary[0] || {
        totalIn: 0,
        totalOut: 0,
        totalValueIn: 0,
        totalValueOut: 0
      };
    } catch (error) {
      console.error('Error getting product summary:', error);
      throw error;
    }
  }

  /**
   * Get stock movements for a product
   * @param {String} productId - Product ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  static async getProductMovements(productId, options = {}) {
    try {
      return await StockMovement.getProductMovements(productId, options);
    } catch (error) {
      console.error('Error getting product movements:', error);
      throw error;
    }
  }

  /**
   * Reverse a stock movement
   * @param {String} movementId - Movement ID
   * @param {Object} user - User performing the reversal
   * @param {String} reason - Reason for reversal
   * @returns {Promise<StockMovement>}
   */
  static async reverseMovement(movementId, user, reason) {
    try {
      const movement = await StockMovement.findById(movementId);
      if (!movement) {
        throw new Error('Stock movement not found');
      }

      const reversedMovement = await movement.reverse(user._id, reason);
      
      // Update product stock
      const product = await ProductRepository.findById(movement.product);
      if (product) {
        await ProductRepository.updateById(product._id, {
          'inventory.currentStock': reversedMovement.newStock
        });
      }

      return reversedMovement;
    } catch (error) {
      console.error('Error reversing movement:', error);
      throw error;
    }
  }
}

module.exports = StockMovementService;
