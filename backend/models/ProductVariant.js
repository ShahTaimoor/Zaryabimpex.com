const mongoose = require('mongoose');

const productVariantSchema = new mongoose.Schema({
  // Base Product Reference
  baseProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  
  // Variant Information
  variantName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  variantType: {
    type: String,
    required: true,
    enum: ['color', 'warranty', 'size', 'finish', 'custom'],
    index: true
  },
  variantValue: {
    type: String,
    required: true,
    trim: true
    // e.g., "Red", "With Warranty", "Large", "Matte Finish"
  },
  
  // Display Information
  displayName: {
    type: String,
    required: true,
    trim: true
    // e.g., "Spoiler - Red", "Spoiler - With Warranty"
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Pricing (can differ from base product)
  pricing: {
    cost: {
      type: Number,
      required: true,
      min: 0
      // Base cost + transformation cost
    },
    retail: {
      type: Number,
      required: true,
      min: 0
    },
    wholesale: {
      type: Number,
      required: true,
      min: 0
    },
    distributor: {
      type: Number,
      min: 0
    }
  },
  
  // Transformation Cost (cost to convert base to this variant)
  transformationCost: {
    type: Number,
    required: true,
    min: 0,
    default: 0
    // e.g., coloring cost per unit
  },
  
  // Inventory
  inventory: {
    currentStock: {
      type: Number,
      default: 0,
      min: 0
    },
    minStock: {
      type: Number,
      default: 0,
      min: 0
    },
    maxStock: {
      type: Number,
      min: 0
    }
  },
  
  // SKU (optional, auto-generated if not provided)
  sku: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
productVariantSchema.index({ baseProduct: 1, variantType: 1, variantValue: 1 }, { unique: true });
productVariantSchema.index({ baseProduct: 1, status: 1 });
productVariantSchema.index({ variantName: 'text', displayName: 'text' });

// Virtual for profit margin
productVariantSchema.virtual('profitMargin').get(function() {
  return ((this.pricing.retail - this.pricing.cost) / this.pricing.retail * 100).toFixed(2);
});

// Method to check if stock is low
productVariantSchema.methods.isLowStock = function() {
  return this.inventory.currentStock <= this.inventory.minStock;
};

module.exports = mongoose.model('ProductVariant', productVariantSchema);

