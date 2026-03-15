const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'productModel',
    required: true,
  },
  productModel: {
    type: String,
    required: true,
    enum: ['Product', 'ProductVariant'],
    default: 'Product'
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  reservedStock: {
    type: Number,
    default: 0,
    min: 0,
  },
  availableStock: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Stock Reservations with expiration
  reservations: [{
    reservationId: {
      type: String,
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    reservedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    referenceType: {
      type: String,
      enum: ['cart', 'sales_order', 'manual', 'system'],
      default: 'cart'
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  reorderPoint: {
    type: Number,
    required: true,
    min: 0,
    default: 10,
  },
  reorderQuantity: {
    type: Number,
    required: true,
    min: 1,
    default: 50,
  },
  maxStock: {
    type: Number,
    min: 0,
  },
  location: {
    warehouse: {
      type: String,
      trim: true,
      default: 'Main Warehouse',
    },
    aisle: {
      type: String,
      trim: true,
    },
    shelf: {
      type: String,
      trim: true,
    },
    bin: {
      type: String,
      trim: true,
    },
  },
  cost: {
    average: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastPurchase: {
      type: Number,
      min: 0,
      default: 0,
    },
    fifo: [{
      quantity: Number,
      cost: Number,
      date: Date,
      purchaseOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
      },
    }],
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued', 'out_of_stock'],
    default: 'active',
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  lastCount: {
    date: Date,
    count: Number,
    variance: Number,
    countedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  movements: [{
    type: {
      type: String,
      enum: ['in', 'out', 'adjustment', 'transfer', 'return', 'damage', 'theft'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    reference: {
      type: String,
      trim: true, // Order number, adjustment ID, etc.
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'movements.referenceModel',
    },
    referenceModel: {
      type: String,
      enum: ['SalesOrder', 'PurchaseOrder', 'PurchaseInvoice', 'StockAdjustment', 'Transfer', 'Return', 'Sales', 'ProductTransformation'],
    },
    cost: {
      type: Number,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
      trim: true,
    },
  }],

  // Soft Delete Fields
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
// Unique constraint on product field ensures one inventory record per product ID
// Since MongoDB ObjectIds are globally unique across collections, a unique index
// on 'product' alone is sufficient even with polymorphic references (refPath).
// This prevents duplicate inventory tracking regardless of productModel value.
// Note: If separate inventory tracking is needed for Product vs ProductVariant
// of the same underlying product, use compound unique index: { product: 1, productModel: 1 }
InventorySchema.index({ product: 1 }, { unique: true });
InventorySchema.index({ currentStock: 1 });
InventorySchema.index({ status: 1 });
InventorySchema.index({ 'location.warehouse': 1 });
InventorySchema.index({ 'movements.date': -1 });
InventorySchema.index({ status: 1, currentStock: 1 }); // For low stock queries
InventorySchema.index({ reorderPoint: 1, currentStock: 1 }); // For reorder point queries
InventorySchema.index({ lastUpdated: -1 }); // For recently updated inventory
InventorySchema.index({ 'location.warehouse': 1, status: 1 }); // For warehouse-specific queries

// Virtual for available stock calculation
InventorySchema.virtual('calculatedAvailableStock').get(function () {
  return Math.max(0, this.currentStock - this.reservedStock);
});

// Pre-save middleware to update available stock
InventorySchema.pre('save', function (next) {
  this.availableStock = this.calculatedAvailableStock;

  // Update status based on stock levels
  if (this.currentStock === 0) {
    this.status = 'out_of_stock';
  } else if (this.currentStock <= this.reorderPoint && this.status !== 'inactive') {
    this.status = 'active'; // Keep as active but low stock
  }

  this.lastUpdated = new Date();
  next();
});

// Static method to update stock using atomic operations
InventorySchema.statics.updateStock = async function (productId, movement) {
  const { retryMongoOperation } = require('../utils/retry');

  return retryMongoOperation(async () => {
    // Determine quantity change based on movement type
    let quantityChange = 0;
    switch (movement.type) {
      case 'in':
      case 'return':
        quantityChange = movement.quantity;
        break;
      case 'out':
      case 'damage':
      case 'theft':
        quantityChange = -movement.quantity;
        break;
      case 'adjustment':
        // For adjustments, we need to set exact value, not increment
        // First get current stock, then calculate difference
        const current = await this.findOne({ product: productId });
        const currentStock = current ? current.currentStock : 0;
        quantityChange = movement.quantity - currentStock;
        break;
      default:
        throw new Error(`Invalid movement type: ${movement.type}`);
    }

    // Build update operations
    const updateOps = {
      $inc: { currentStock: quantityChange },
      $push: { movements: movement },
      $set: { lastUpdated: new Date() }
    };

    // For adjustments, use $set instead of $inc
    if (movement.type === 'adjustment') {
      delete updateOps.$inc;
      updateOps.$set.currentStock = movement.quantity;
    }

    // Use findOneAndUpdate with atomic operations
    const filter = { product: productId };
    const options = {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true
    };

    // If upserting, set default values
    if (!(await this.findOne(filter))) {
      updateOps.$setOnInsert = {
        product: productId,
        productModel: 'Product',
        reorderPoint: 10,
        reorderQuantity: 50,
        status: 'active',
        reservedStock: 0,
        availableStock: 0
      };
    }

    // Check stock availability before updating (for out movements)
    if (movement.type !== 'adjustment' && quantityChange < 0) {
      const current = await this.findOne(filter);
      if (!current) {
        throw new Error('Inventory record not found and cannot create with negative stock');
      }
      if (current.currentStock + quantityChange < 0) {
        throw new Error(`Insufficient stock. Available: ${current.currentStock}, Requested: ${Math.abs(quantityChange)}`);
      }
    }

    const updated = await this.findOneAndUpdate(filter, updateOps, options);

    // Update available stock
    updated.availableStock = Math.max(0, updated.currentStock - updated.reservedStock);

    // Update status based on stock
    if (updated.currentStock === 0) {
      updated.status = 'out_of_stock';
    } else if (updated.status === 'out_of_stock') {
      updated.status = 'active';
    }

    // Update cost if provided in movement (for stock in/return)
    if (movement.cost !== undefined && movement.cost !== null && (movement.type === 'in' || movement.type === 'return')) {
      const costingService = require('../services/costingService');

      // Update average cost (this will update inventory.cost.average and save)
      const newAverageCost = await costingService.updateAverageCost(productId, movement.quantity, movement.cost);

      // Reload inventory to get updated cost and set lastPurchase
      const inventoryWithCost = await this.findOne({ product: productId });

      if (inventoryWithCost) {
        // Update last purchase cost
        if (!inventoryWithCost.cost) {
          inventoryWithCost.cost = {};
        }
        inventoryWithCost.cost.lastPurchase = movement.cost;
        await inventoryWithCost.save();

        // Sync cost to Product model
        const Product = require('../models/Product');
        const product = await Product.findById(productId);
        if (product) {
          // Update product pricing.cost with average cost from inventory
          if (!product.pricing) {
            product.pricing = {};
          }
          product.pricing.cost = newAverageCost;
          await product.save();
        }
      }
    }

    await updated.save();

    return updated;
  });
};

// Static method to reserve stock using atomic operations
InventorySchema.statics.reserveStock = async function (productId, quantity) {
  const { retryMongoOperation } = require('../utils/retry');

  return retryMongoOperation(async () => {
    // First check if sufficient stock is available
    const inventory = await this.findOne({ product: productId });
    if (!inventory) {
      throw new Error('Inventory record not found for product');
    }

    const availableStock = inventory.currentStock - inventory.reservedStock;
    if (availableStock < quantity) {
      throw new Error(`Insufficient available stock. Available: ${availableStock}, Requested: ${quantity}`);
    }

    // Atomically increment reserved stock
    const updated = await this.findOneAndUpdate(
      { product: productId },
      {
        $inc: { reservedStock: quantity },
        $set: { lastUpdated: new Date() }
      },
      { new: true }
    );

    // Update available stock
    updated.availableStock = Math.max(0, updated.currentStock - updated.reservedStock);
    await updated.save();

    return updated;
  });
};

// Static method to release reserved stock using atomic operations
InventorySchema.statics.releaseStock = async function (productId, quantity) {
  const { retryMongoOperation } = require('../utils/retry');

  return retryMongoOperation(async () => {
    // Atomically decrement reserved stock (ensure it doesn't go below 0)
    const updated = await this.findOneAndUpdate(
      { product: productId },
      {
        $inc: { reservedStock: -quantity },
        $set: { lastUpdated: new Date() }
      },
      { new: true }
    );

    if (!updated) {
      throw new Error('Inventory record not found for product');
    }

    // Ensure reservedStock doesn't go negative (shouldn't happen, but safety check)
    if (updated.reservedStock < 0) {
      updated.reservedStock = 0;
    }

    // Update available stock
    updated.availableStock = Math.max(0, updated.currentStock - updated.reservedStock);
    await updated.save();

    return updated;
  });
};

// Instance method to add stock movement
InventorySchema.methods.addStockMovement = async function (movementData) {
  const movement = {
    type: movementData.type || 'adjustment',
    quantity: movementData.quantity || 0,
    cost: movementData.cost || 0,
    reference: movementData.reference || '',
    reason: movementData.reason || movementData.notes || '',
    notes: movementData.notes || '',
    date: movementData.date || new Date(),
    performedBy: movementData.performedBy || null
  };

  // Set referenceModel and referenceId if provided
  if (movementData.referenceModel) {
    movement.referenceModel = movementData.referenceModel;
  }
  if (movementData.referenceId) {
    movement.referenceId = movementData.referenceId;
  }

  // Add movement to array
  this.movements.push(movement);

  // Update stock based on movement type
  if (movement.type === 'in' || movement.type === 'return') {
    this.currentStock += movement.quantity;
  } else if (movement.type === 'out' || movement.type === 'damage' || movement.type === 'theft') {
    this.currentStock -= movement.quantity;
    if (this.currentStock < 0) {
      throw new Error('Insufficient stock for this movement');
    }
  }

  // Update available stock
  this.availableStock = Math.max(0, this.currentStock - this.reservedStock);
  this.lastUpdated = new Date();

  // Update status
  if (this.currentStock === 0) {
    this.status = 'out_of_stock';
  } else if (this.status === 'out_of_stock') {
    this.status = 'active';
  }

  await this.save();
  return this;
};

// Static method to get low stock items
InventorySchema.statics.getLowStockItems = async function () {
  // Use aggregation pipeline for field comparison
  // Handle polymorphic references: product can reference either 'products' or 'productvariants' collections
  return await this.aggregate([
    {
      $match: {
        status: 'active'
      }
    },
    {
      $addFields: {
        isLowStock: {
          $lte: ['$currentStock', '$reorderPoint']
        }
      }
    },
    {
      $match: {
        isLowStock: true
      }
    },
    // Lookup from products collection
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'productDataFromProducts'
      }
    },
    // Lookup from productvariants collection
    {
      $lookup: {
        from: 'productvariants',
        localField: 'product',
        foreignField: '_id',
        as: 'productDataFromVariants'
      }
    },
    // Combine both lookups - one will be empty, the other will have data
    {
      $addFields: {
        productData: {
          $cond: {
            if: { $gt: [{ $size: '$productDataFromProducts' }, 0] },
            then: { $arrayElemAt: ['$productDataFromProducts', 0] },
            else: { $arrayElemAt: ['$productDataFromVariants', 0] }
          }
        }
      }
    },
    {
      $project: {
        _id: 1,
        product: 1,
        productModel: 1,
        currentStock: 1,
        reorderPoint: 1,
        status: 1,
        'productData.name': 1,
        'productData.description': 1,
        'productData.pricing': 1
      }
    }
  ]);
};

module.exports = mongoose.model('Inventory', InventorySchema);
