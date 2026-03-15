const mongoose = require('mongoose');

const StockAdjustmentSchema = new mongoose.Schema({
  adjustmentNumber: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    enum: ['physical_count', 'damage', 'theft', 'transfer', 'correction', 'return', 'write_off'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending',
  },
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  adjustments: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    currentStock: {
      type: Number,
      required: true,
    },
    adjustedStock: {
      type: Number,
      required: true,
    },
    variance: {
      type: Number,
      required: true,
    },
    cost: {
      type: Number,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  }],
  totalVariance: {
    type: Number,
    default: 0,
  },
  totalCostImpact: {
    type: Number,
    default: 0,
  },
  warehouse: {
    type: String,
    trim: true,
    default: 'Main Warehouse',
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  requestedDate: {
    type: Date,
    default: Date.now,
  },
  approvedDate: {
    type: Date,
  },
  completedDate: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, { timestamps: true });

// Indexes
// adjustmentNumber index removed - already has unique: true in field definition
StockAdjustmentSchema.index({ status: 1 });
StockAdjustmentSchema.index({ type: 1 });
StockAdjustmentSchema.index({ requestedBy: 1 });
StockAdjustmentSchema.index({ requestedDate: -1 });

// Pre-save middleware to generate adjustment number
StockAdjustmentSchema.pre('save', async function(next) {
  if (!this.adjustmentNumber) {
    const count = await this.constructor.countDocuments();
    this.adjustmentNumber = `ADJ-${String(count + 1).padStart(6, '0')}`;
  }
  
  // Calculate totals
  this.totalVariance = this.adjustments.reduce((sum, adj) => sum + adj.variance, 0);
  this.totalCostImpact = this.adjustments.reduce((sum, adj) => sum + (adj.variance * (adj.cost || 0)), 0);
  
  next();
});

// Static method to approve adjustment
StockAdjustmentSchema.statics.approveAdjustment = async function(adjustmentId, approvedBy) {
  const adjustment = await this.findById(adjustmentId);
  
  if (!adjustment) {
    throw new Error('Adjustment not found');
  }
  
  if (adjustment.status !== 'pending') {
    throw new Error('Adjustment is not pending approval');
  }
  
  adjustment.status = 'approved';
  adjustment.approvedBy = approvedBy;
  adjustment.approvedDate = new Date();
  
  return await adjustment.save();
};

// Static method to complete adjustment
StockAdjustmentSchema.statics.completeAdjustment = async function(adjustmentId, completedBy) {
  const adjustment = await this.findById(adjustmentId);
  
  if (!adjustment) {
    throw new Error('Adjustment not found');
  }
  
  if (adjustment.status !== 'approved') {
    throw new Error('Adjustment must be approved before completion');
  }
  
  // Update inventory for each adjustment
  const Inventory = mongoose.model('Inventory');
  
  for (const adj of adjustment.adjustments) {
    await Inventory.updateStock(adj.product, {
      type: 'adjustment',
      quantity: adj.adjustedStock,
      reason: adjustment.reason,
      reference: adjustment.adjustmentNumber,
      referenceId: adjustment._id,
      referenceModel: 'StockAdjustment',
      cost: adj.cost,
      performedBy: completedBy,
      notes: adj.notes,
    });
  }
  
  adjustment.status = 'completed';
  adjustment.completedBy = completedBy;
  adjustment.completedDate = new Date();
  
  return await adjustment.save();
};

module.exports = mongoose.model('StockAdjustment', StockAdjustmentSchema);
