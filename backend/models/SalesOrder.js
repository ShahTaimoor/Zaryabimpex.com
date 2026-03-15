const mongoose = require('mongoose');

const salesOrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  invoicedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingQuantity: {
    type: Number,
    required: true,
    min: 0
  }
});

const salesOrderSchema = new mongoose.Schema({
  // Basic Information
  soNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },

  // Order Details
  items: [salesOrderItemSchema],

  // Financial Information
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  isTaxExempt: {
    type: Boolean,
    default: true
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },

  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'confirmed', 'partially_invoiced', 'fully_invoiced', 'cancelled', 'closed'],
    default: 'draft'
  },

  // Dates
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDelivery: {
    type: Date
  },
  confirmedDate: {
    type: Date
  },
  lastInvoicedDate: {
    type: Date
  },

  // Additional Information
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  terms: {
    type: String,
    trim: true
  },

  // Conversion Tracking
  conversions: [{
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sales'
    },
    convertedDate: {
      type: Date,
      default: Date.now
    },
    convertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    items: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      quantity: Number,
      unitPrice: Number
    }]
  }],

  // Automation and Ledger Tracking
  ledgerPosted: {
    type: Boolean,
    default: false,
    index: true
  },
  autoPosted: {
    type: Boolean,
    default: false
  },
  postedAt: {
    type: Date
  },
  ledgerReferenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales'
  },
  autoConverted: {
    type: Boolean,
    default: false
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
// soNumber index removed - already has unique: true in field definition
salesOrderSchema.index({ customer: 1, status: 1 });
salesOrderSchema.index({ status: 1, orderDate: -1 });
salesOrderSchema.index({ createdBy: 1 });
salesOrderSchema.index({ createdAt: -1 }); // For date range queries
salesOrderSchema.index({ customer: 1, createdAt: -1 }); // For customer order history
salesOrderSchema.index({ status: 1, createdAt: -1 }); // For status-based queries
salesOrderSchema.index({ total: -1 }); // For sorting by total

// Virtual for progress percentage
salesOrderSchema.virtual('progressPercentage').get(function () {
  if (this.items.length === 0) return 0;

  const totalOrdered = this.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalInvoiced = this.items.reduce((sum, item) => sum + item.invoicedQuantity, 0);

  return Math.round((totalInvoiced / totalOrdered) * 100);
});

// Virtual for remaining items count
salesOrderSchema.virtual('remainingItemsCount').get(function () {
  return this.items.filter(item => item.remainingQuantity > 0).length;
});

// Virtual for total remaining value
salesOrderSchema.virtual('remainingValue').get(function () {
  return this.items.reduce((sum, item) =>
    sum + (item.remainingQuantity * item.unitPrice), 0);
});

// Method to check if SO is fully invoiced
salesOrderSchema.methods.isFullyInvoiced = function () {
  return this.items.every(item => item.remainingQuantity === 0);
};

// Method to check if SO is partially invoiced
salesOrderSchema.methods.isPartiallyInvoiced = function () {
  const hasInvoiced = this.items.some(item => item.invoicedQuantity > 0);
  const hasRemaining = this.items.some(item => item.remainingQuantity > 0);
  return hasInvoiced && hasRemaining;
};

// Method to update item quantities after invoicing
salesOrderSchema.methods.updateInvoicedQuantities = function (invoicedItems) {
  invoicedItems.forEach(invoicedItem => {
    const soItem = this.items.id(invoicedItem.productId);
    if (soItem) {
      const newInvoicedQty = soItem.invoicedQuantity + invoicedItem.quantity;
      soItem.invoicedQuantity = Math.min(newInvoicedQty, soItem.quantity);
      soItem.remainingQuantity = soItem.quantity - soItem.invoicedQuantity;
    }
  });

  // Update status based on invoiced quantities
  if (this.isFullyInvoiced()) {
    this.status = 'fully_invoiced';
  } else if (this.isPartiallyInvoiced()) {
    this.status = 'partially_invoiced';
  }

  this.lastInvoicedDate = new Date();
  return this.save();
};

// Pre-save middleware to calculate totals
salesOrderSchema.pre('save', function (next) {
  // Calculate item totals
  this.items.forEach(item => {
    item.totalPrice = item.quantity * item.unitPrice;
    item.remainingQuantity = item.quantity - item.invoicedQuantity;
  });

  // Calculate order totals
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.total = this.subtotal + this.tax;

  next();
});

// Static method to generate SO number
salesOrderSchema.statics.generateSONumber = function () {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-4);

  return `SO-${year}${month}${day}-${time}`;
};

module.exports = mongoose.model('SalesOrder', salesOrderSchema);
