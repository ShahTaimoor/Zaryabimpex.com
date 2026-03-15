const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  // Product Information
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  
  // Batch Identifiers
  batchNumber: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  lotNumber: {
    type: String,
    trim: true,
    index: true
  },
  
  // Quantity Information
  initialQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  currentQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: function() {
      return this.initialQuantity;
    }
  },
  
  // Cost Information
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Date Information
  manufactureDate: {
    type: Date
  },
  expiryDate: {
    type: Date,
    index: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  
  // Supplier Information
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  purchaseInvoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseInvoice'
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder'
  },
  
  // Location Information
  location: {
    warehouse: {
      type: String,
      default: 'Main Warehouse'
    },
    aisle: String,
    shelf: String,
    bin: String
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'quarantined', 'recalled', 'expired', 'depleted'],
    default: 'active',
    index: true
  },
  
  // Quality Information
  qualityCheck: {
    passed: {
      type: Boolean,
      default: false
    },
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    checkedDate: Date,
    notes: String
  },
  
  // Recall Information
  recall: {
    isRecalled: {
      type: Boolean,
      default: false
    },
    recallDate: Date,
    recallReason: String,
    recallBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    affectedSales: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sales'
    }]
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Compound indexes
batchSchema.index({ product: 1, batchNumber: 1 }, { unique: true });
batchSchema.index({ product: 1, expiryDate: 1 });
batchSchema.index({ status: 1, expiryDate: 1 });
batchSchema.index({ expiryDate: 1 }); // For expiry queries

// Virtual for days until expiry
batchSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiryDate) return null;
  const today = new Date();
  const expiry = new Date(this.expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for isExpired
batchSchema.virtual('isExpired').get(function() {
  if (!this.expiryDate) return false;
  return new Date() > new Date(this.expiryDate);
});

// Virtual for isExpiringSoon (within 30 days)
batchSchema.virtual('isExpiringSoon').get(function() {
  if (!this.expiryDate) return false;
  const daysUntilExpiry = this.daysUntilExpiry;
  return daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
});

// Method to check if batch can be used
batchSchema.methods.canBeUsed = function() {
  return this.status === 'active' && 
         this.currentQuantity > 0 && 
         !this.isExpired &&
         (!this.recall || !this.recall.isRecalled);
};

// Method to consume quantity from batch
batchSchema.methods.consume = function(quantity) {
  if (this.currentQuantity < quantity) {
    throw new Error(`Insufficient quantity in batch. Available: ${this.currentQuantity}, Requested: ${quantity}`);
  }
  
  this.currentQuantity -= quantity;
  
  if (this.currentQuantity === 0) {
    this.status = 'depleted';
  }
  
  return this.save();
};

// Static method to find batches for FEFO (First Expired First Out)
batchSchema.statics.findFEFOBatches = function(productId, quantity) {
  return this.find({
    product: productId,
    status: 'active',
    currentQuantity: { $gt: 0 }
  })
  .sort({ expiryDate: 1, purchaseDate: 1 }) // Oldest expiry first, then oldest purchase
  .limit(100); // Reasonable limit
};

// Pre-save hook to update status based on expiry
batchSchema.pre('save', function(next) {
  if (this.expiryDate && new Date() > new Date(this.expiryDate) && this.status === 'active') {
    this.status = 'expired';
  }
  next();
});

module.exports = mongoose.model('Batch', batchSchema);

