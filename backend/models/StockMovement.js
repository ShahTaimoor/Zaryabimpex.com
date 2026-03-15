const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  // Product Information
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productSku: {
    type: String,
    trim: true
  },
  
  // Movement Details
  movementType: {
    type: String,
    enum: [
      'purchase',           // Stock received from supplier
      'sale',              // Stock sold to customer
      'return_in',         // Customer return (stock in)
      'return_out',        // Return to supplier (stock out)
      'adjustment_in',     // Manual adjustment increase
      'adjustment_out',    // Manual adjustment decrease
      'transfer_in',       // Transfer from another location
      'transfer_out',      // Transfer to another location
      'damage',            // Damaged stock write-off
      'expiry',            // Expired stock write-off
      'theft',             // Theft/loss write-off
      'production',        // Stock produced/manufactured
      'consumption',       // Stock consumed in production
      'initial_stock'      // Initial stock entry
    ],
    required: true,
    index: true
  },
  
  // Quantity Information
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Stock Levels
  previousStock: {
    type: Number,
    required: true,
    min: 0
  },
  newStock: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Reference Information
  referenceType: {
    type: String,
    enum: [
      'purchase_order',
      'sales_order',
      'return',
      'adjustment',
      'transfer',
      'production',
      'manual_entry',
      'system_generated'
    ],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  referenceNumber: {
    type: String,
    trim: true,
    index: true
  },
  
  // Location Information
  location: {
    type: String,
    default: 'main_warehouse',
    trim: true
  },
  fromLocation: {
    type: String,
    trim: true
  },
  toLocation: {
    type: String,
    trim: true
  },
  
  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  
  // Additional Details
  reason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Batch/Lot Information
  batchNumber: {
    type: String,
    trim: true
  },
  expiryDate: {
    type: Date
  },
  
  // Supplier/Customer Information
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'reversed'],
    default: 'completed',
    index: true
  },
  
  // Reversal Information
  isReversal: {
    type: Boolean,
    default: false
  },
  originalMovement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockMovement'
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reversedAt: {
    type: Date
  },
  
  // System Information
  systemGenerated: {
    type: Boolean,
    default: false
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ movementType: 1, createdAt: -1 });
stockMovementSchema.index({ referenceType: 1, referenceId: 1 });
stockMovementSchema.index({ user: 1, createdAt: -1 });
stockMovementSchema.index({ location: 1, createdAt: -1 });
stockMovementSchema.index({ status: 1, createdAt: -1 });
stockMovementSchema.index({ createdAt: -1 }); // For date range queries
stockMovementSchema.index({ product: 1, movementType: 1, createdAt: -1 }); // Compound for product movements
stockMovementSchema.index({ referenceNumber: 1 }); // For reference number lookups
stockMovementSchema.index({ customer: 1, createdAt: -1 }); // For customer-related movements
stockMovementSchema.index({ supplier: 1, createdAt: -1 }); // For supplier-related movements

// Virtual for movement direction
stockMovementSchema.virtual('isStockIn').get(function() {
  return ['purchase', 'return_in', 'adjustment_in', 'transfer_in', 'production', 'initial_stock'].includes(this.movementType);
});

stockMovementSchema.virtual('isStockOut').get(function() {
  return ['sale', 'return_out', 'adjustment_out', 'transfer_out', 'damage', 'expiry', 'theft', 'consumption'].includes(this.movementType);
});

// Virtual for formatted movement type
stockMovementSchema.virtual('formattedMovementType').get(function() {
  const types = {
    'purchase': 'Purchase',
    'sale': 'Sale',
    'return_in': 'Customer Return',
    'return_out': 'Supplier Return',
    'adjustment_in': 'Stock Adjustment (+)',
    'adjustment_out': 'Stock Adjustment (-)',
    'transfer_in': 'Transfer In',
    'transfer_out': 'Transfer Out',
    'damage': 'Damage Write-off',
    'expiry': 'Expiry Write-off',
    'theft': 'Theft/Loss',
    'production': 'Production',
    'consumption': 'Consumption',
    'initial_stock': 'Initial Stock'
  };
  return types[this.movementType] || this.movementType;
});

// Pre-save middleware to calculate total value
stockMovementSchema.pre('save', function(next) {
  if (this.isModified('quantity') || this.isModified('unitCost')) {
    this.totalValue = this.quantity * this.unitCost;
  }
  next();
});

// Static method to get stock movements for a product
stockMovementSchema.statics.getProductMovements = function(productId, options = {}) {
  const query = { product: productId };
  
  if (options.dateFrom) {
    query.createdAt = { ...query.createdAt, $gte: new Date(options.dateFrom) };
  }
  
  if (options.dateTo) {
    query.createdAt = { ...query.createdAt, $lte: new Date(options.dateTo) };
  }
  
  if (options.movementType) {
    query.movementType = options.movementType;
  }
  
  if (options.location) {
    query.location = options.location;
  }
  
  return this.find(query)
    .populate('product', 'name sku')
    .populate('user', 'firstName lastName')
    .populate('supplier', 'name')
    .populate('customer', 'name')
    .sort({ createdAt: -1 });
};

// Static method to get stock summary
stockMovementSchema.statics.getStockSummary = function(productId, date = new Date()) {
  return this.aggregate([
    {
      $match: {
        product: mongoose.Types.ObjectId(productId),
        createdAt: { $lte: date },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalIn: {
          $sum: {
            $cond: [
              { $in: ['$movementType', ['purchase', 'return_in', 'adjustment_in', 'transfer_in', 'production', 'initial_stock']] },
              '$quantity',
              0
            ]
          }
        },
        totalOut: {
          $sum: {
            $cond: [
              { $in: ['$movementType', ['sale', 'return_out', 'adjustment_out', 'transfer_out', 'damage', 'expiry', 'theft', 'consumption']] },
              '$quantity',
              0
            ]
          }
        },
        totalValueIn: {
          $sum: {
            $cond: [
              { $in: ['$movementType', ['purchase', 'return_in', 'adjustment_in', 'transfer_in', 'production', 'initial_stock']] },
              '$totalValue',
              0
            ]
          }
        },
        totalValueOut: {
          $sum: {
            $cond: [
              { $in: ['$movementType', ['sale', 'return_out', 'adjustment_out', 'transfer_out', 'damage', 'expiry', 'theft', 'consumption']] },
              '$totalValue',
              0
            ]
          }
        }
      }
    }
  ]);
};

// Instance method to reverse a movement
stockMovementSchema.methods.reverse = function(userId, reason) {
  if (this.isReversal) {
    throw new Error('Cannot reverse a reversal movement');
  }
  
  if (this.status !== 'completed') {
    throw new Error('Can only reverse completed movements');
  }
  
  const reversedMovement = new this.constructor({
    product: this.product,
    productName: this.productName,
    productSku: this.productSku,
    movementType: this.movementType,
    quantity: this.quantity,
    unitCost: this.unitCost,
    totalValue: this.totalValue,
    previousStock: this.newStock,
    newStock: this.previousStock,
    referenceType: this.referenceType,
    referenceId: this.referenceId,
    referenceNumber: this.referenceNumber,
    location: this.location,
    fromLocation: this.toLocation,
    toLocation: this.fromLocation,
    user: userId,
    userName: this.userName,
    reason: reason || 'Reversal of movement',
    notes: `Reversal of movement ${this._id}`,
    batchNumber: this.batchNumber,
    expiryDate: this.expiryDate,
    supplier: this.supplier,
    customer: this.customer,
    status: 'completed',
    isReversal: true,
    originalMovement: this._id,
    reversedBy: userId,
    reversedAt: new Date(),
    systemGenerated: true
  });
  
  return reversedMovement.save();
};

module.exports = mongoose.model('StockMovement', stockMovementSchema);
