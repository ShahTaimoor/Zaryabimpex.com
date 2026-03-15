const Inventory = require('../models/Inventory');
const StockAdjustment = require('../models/StockAdjustment');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');

// Update stock levels
const updateStock = async ({ productId, type, quantity, reason, reference, referenceId, referenceModel, cost, performedBy, notes }) => {
  try {
    const movement = {
      type,
      quantity,
      reason,
      reference,
      referenceId,
      referenceModel,
      cost,
      performedBy,
      notes,
      date: new Date(),
    };

    const updatedInventory = await Inventory.updateStock(productId, movement);
    
    // Update product's or variant's current stock field for quick access
    const productUpdate = {
      'inventory.currentStock': updatedInventory.currentStock,
      'inventory.lastUpdated': new Date(),
    };
    
    // If cost is provided and inventory cost was updated, sync to product pricing.cost
    if (cost !== undefined && cost !== null && (type === 'in' || type === 'return')) {
      // Get updated inventory to check if cost was set
      const inventory = await Inventory.findOne({ product: productId });
      if (inventory && inventory.cost && inventory.cost.average) {
        // Sync average cost to product pricing.cost
        productUpdate['pricing.cost'] = inventory.cost.average;
      }
    }
    
    // Try to update as Product first, if not found, try as ProductVariant
    let product = await Product.findByIdAndUpdate(productId, productUpdate, { new: false });
    if (!product) {
      // If not a Product, try as ProductVariant
      await ProductVariant.findByIdAndUpdate(productId, productUpdate);
    }
    
    return updatedInventory;
  } catch (error) {
    console.error('Error updating stock:', error);
    throw error;
  }
};

// Reserve stock for an order
const reserveStock = async ({ productId, quantity }) => {
  try {
    const inventory = await Inventory.reserveStock(productId, quantity);
    return inventory;
  } catch (error) {
    console.error('Error reserving stock:', error);
    throw error;
  }
};

// Release reserved stock
const releaseStock = async ({ productId, quantity }) => {
  try {
    const inventory = await Inventory.releaseStock(productId, quantity);
    return inventory;
  } catch (error) {
    console.error('Error releasing stock:', error);
    throw error;
  }
};

// Process stock adjustment
const processStockAdjustment = async ({ adjustments, type, reason, requestedBy, warehouse, notes }) => {
  try {
    const adjustment = new StockAdjustment({
      type,
      reason,
      adjustments,
      requestedBy,
      warehouse,
      notes,
    });

    await adjustment.save();
    return adjustment;
  } catch (error) {
    console.error('Error processing stock adjustment:', error);
    throw error;
  }
};

// Get inventory status for a product
const getInventoryStatus = async (productId) => {
  try {
    const inventory = await Inventory.findOne({ product: productId })
      .populate('product', 'name description pricing')
      .populate('movements.performedBy', 'firstName lastName')
      .sort({ 'movements.date': -1 });

    if (!inventory) {
      // Create inventory record if it doesn't exist
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const newInventory = new Inventory({
        product: productId,
        currentStock: product.inventory?.currentStock || 0,
        reorderPoint: product.inventory?.reorderPoint || 10,
        reorderQuantity: product.inventory?.reorderQuantity || 50,
      });

      await newInventory.save();
      return newInventory;
    }

    return inventory;
  } catch (error) {
    console.error('Error getting inventory status:', error);
    throw error;
  }
};

// Get low stock items
const getLowStockItems = async () => {
  try {
    const lowStockItems = await Inventory.getLowStockItems();
    return lowStockItems;
  } catch (error) {
    console.error('Error getting low stock items:', error);
    throw error;
  }
};

// Get inventory movement history
const getInventoryHistory = async ({ productId, limit = 50, offset = 0, type, startDate, endDate }) => {
  try {
    const inventory = await Inventory.findOne({ product: productId });
    
    if (!inventory) {
      return [];
    }

    let movements = inventory.movements;

    // Filter by type
    if (type) {
      movements = movements.filter(movement => movement.type === type);
    }

    // Filter by date range
    if (startDate || endDate) {
      movements = movements.filter(movement => {
        const movementDate = new Date(movement.date);
        if (startDate && movementDate < new Date(startDate)) return false;
        if (endDate && movementDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Sort by date (newest first)
    movements.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Apply pagination
    const paginatedMovements = movements.slice(offset, offset + limit);

    return {
      movements: paginatedMovements,
      total: movements.length,
      hasMore: offset + limit < movements.length,
    };
  } catch (error) {
    console.error('Error getting inventory history:', error);
    throw error;
  }
};

// Get inventory summary
const getInventorySummary = async () => {
  try {
    const totalProducts = await Inventory.countDocuments({ status: 'active' });
    const outOfStock = await Inventory.countDocuments({ status: 'out_of_stock' });
    const lowStock = await Inventory.countDocuments({
      $expr: { $lte: ['$currentStock', '$reorderPoint'] },
      status: 'active',
    });

    const totalValue = await Inventory.aggregate([
      { $match: { status: 'active' } },
      { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$currentStock', '$product.pricing.cost'] } },
        },
      },
    ]);

    return {
      totalProducts,
      outOfStock,
      lowStock,
      totalValue: totalValue.length > 0 ? totalValue[0].totalValue : 0,
    };
  } catch (error) {
    console.error('Error getting inventory summary:', error);
    throw error;
  }
};

// Bulk update stock levels
const bulkUpdateStock = async (updates) => {
  try {
    console.log('Bulk update stock called with:', updates);
    const results = [];
    
    for (const update of updates) {
      try {
        console.log('Processing update for product:', update.productId, 'type:', update.type, 'quantity:', update.quantity);
        const result = await updateStock(update);
        console.log('Update successful, new stock:', result.currentStock);
        results.push({ success: true, productId: update.productId, inventory: result });
      } catch (error) {
        console.error('Update failed for product:', update.productId, 'error:', error.message);
        results.push({ success: false, productId: update.productId, error: error.message });
      }
    }
    
    console.log('Bulk update results:', results);
    return results;
  } catch (error) {
    console.error('Error in bulk update stock:', error);
    throw error;
  }
};

// Create inventory record for new product
const createInventoryRecord = async (productId, initialStock = 0) => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const inventory = new Inventory({
      product: productId,
      currentStock: initialStock,
      reorderPoint: product.inventory?.reorderPoint || 10,
      reorderQuantity: product.inventory?.reorderQuantity || 50,
      cost: {
        average: product.pricing?.cost || 0,
        lastPurchase: product.pricing?.cost || 0,
      },
    });

    await inventory.save();
    return inventory;
  } catch (error) {
    console.error('Error creating inventory record:', error);
    throw error;
  }
};

module.exports = {
  updateStock,
  reserveStock,
  releaseStock,
  processStockAdjustment,
  getInventoryStatus,
  getLowStockItems,
  getInventoryHistory,
  getInventorySummary,
  bulkUpdateStock,
  createInventoryRecord,
};
