const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Pricing Structure
  pricing: {
    cost: {
      type: Number,
      required: true,
      min: 0
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
    },
    reorderPoint: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Wholesale Settings
  wholesaleSettings: {
    minOrderQuantity: {
      type: Number,
      default: 1,
      min: 1
    },
    bulkDiscounts: [{
      minQuantity: {
        type: Number,
        required: true,
        min: 1
      },
      discountPercent: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      }
    }]
  },
  
  // Product Details
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  brand: {
    type: String,
    trim: true
  },
  
  // Supplier Information
  // Products can be sourced from multiple suppliers
  suppliers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  }],
  // Primary supplier (optional - for quick reference)
  primarySupplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  barcode: {
    type: String,
    trim: true,
    maxlength: 50,
    sparse: true // Allows multiple null values
  },
  sku: {
    type: String,
    trim: true,
    maxlength: 50,
    sparse: true
  },
  weight: {
    type: Number,
    min: 0
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  
  // Expiry Date
  expiryDate: {
    type: Date,
    default: null
  },
  
  // Media
  images: [{
    url: String,
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  },
  
  // Tax Settings
  taxSettings: {
    taxable: {
      type: Boolean,
      default: true
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    }
  },
  
  // Investor Linking
  investors: [{
    investor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investor',
      required: true
    },
    sharePercentage: {
      type: Number,
      default: 30,
      min: 0,
      max: 100
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  hasInvestors: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Soft Delete Fields
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  
  // Costing Method
  costingMethod: {
    type: String,
    enum: ['fifo', 'lifo', 'average', 'standard'],
    default: 'standard' // Uses pricing.cost directly
  },
  
  // Version for optimistic locking
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  versionKey: '__v', // Enable Mongoose versioning
  optimisticConcurrency: true // Enable optimistic concurrency control
});

// Pre-save validation: Ensure price hierarchy (cost < wholesale < retail)
productSchema.pre('save', function(next) {
  if (this.pricing) {
    const { cost, wholesale, retail } = this.pricing;
    
    // Validate cost <= wholesale <= retail
    if (cost !== undefined && wholesale !== undefined && cost > wholesale) {
      return next(new Error('Cost price cannot be greater than wholesale price'));
    }
    if (wholesale !== undefined && retail !== undefined && wholesale > retail) {
      return next(new Error('Wholesale price cannot be greater than retail price'));
    }
    if (cost !== undefined && retail !== undefined && cost > retail) {
      return next(new Error('Cost price cannot be greater than retail price'));
    }
  }
  next();
});

// Indexes for better performance
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1, createdAt: -1 }); // For active products listing
productSchema.index({ 'inventory.currentStock': 1 }); // For stock level queries
productSchema.index({ 'inventory.reorderPoint': 1, 'inventory.currentStock': 1 }); // For low stock queries
productSchema.index({ brand: 1, status: 1 }); // For brand filtering
productSchema.index({ createdAt: -1 }); // For recent products
productSchema.index({ hasInvestors: 1, status: 1 }); // For investor-linked products

// Virtual for profit margin
productSchema.virtual('profitMargin').get(function() {
  if (!this.pricing || !this.pricing.retail || this.pricing.retail === 0) {
    return '0.00';
  }
  const margin = ((this.pricing.retail - (this.pricing.cost || 0)) / this.pricing.retail * 100);
  return margin.toFixed(2);
});

// Method to get price for customer type
productSchema.methods.getPriceForCustomerType = function(customerType, quantity = 1) {
  let basePrice;
  
  switch(customerType) {
    case 'wholesale':
      basePrice = this.pricing.wholesale;
      break;
    case 'distributor':
      basePrice = this.pricing.distributor || this.pricing.wholesale;
      break;
    case 'individual':
    case 'retail':
    default:
      basePrice = this.pricing.retail;
  }
  
  // Apply bulk discounts
  if (this.wholesaleSettings.bulkDiscounts.length > 0) {
    const applicableDiscount = this.wholesaleSettings.bulkDiscounts
      .filter(discount => quantity >= discount.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];
    
    if (applicableDiscount) {
      basePrice = basePrice * (1 - applicableDiscount.discountPercent / 100);
    }
  }
  
  return Math.round(basePrice * 100) / 100; // Round to 2 decimal places
};

// Method to check if stock is low
productSchema.methods.isLowStock = function() {
  return this.inventory.currentStock <= this.inventory.reorderPoint;
};

module.exports = mongoose.model('Product', productSchema);
