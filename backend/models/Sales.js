const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
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
  unitCost: {
    type: Number,
    default: 0,
    min: 0
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  // Calculated fields
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  }
});

const orderSchema = new mongoose.Schema({
  // Order Information
  salesOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesOrder'
  },
  orderNumber: {
    type: String,
    required: false,
    unique: true
  },
  orderType: {
    type: String,
    enum: ['retail', 'wholesale', 'return', 'exchange'],
    default: 'retail'
  },

  // Customer Information
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  customerInfo: {
    name: String,
    email: String,
    phone: String,
    businessName: String,
    address: String,
    currentBalance: Number,
    pendingBalance: Number,
    advanceBalance: Number
  },

  // Order Items
  items: [orderItemSchema],

  // Pricing Summary
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    isTaxExempt: {
      type: Boolean,
      default: false
    },
    shippingAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },

  // Payment Information
  payment: {
    method: {
      type: String,
      enum: ['cash', 'credit_card', 'debit_card', 'check', 'account', 'split'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'refunded'],
      default: 'pending'
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    remainingBalance: {
      type: Number,
      default: 0
      // Note: Negative values indicate overpayment (customer advance)
    },
    isPartialPayment: {
      type: Boolean,
      default: false
    },
    isAdvancePayment: {
      type: Boolean,
      default: false
    },
    advanceAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    transactions: [{
      method: String,
      amount: Number,
      reference: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Order Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },

  // Shipping Information
  shipping: {
    method: String,
    trackingNumber: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    estimatedDelivery: Date,
    actualDelivery: Date
  },

  // Notes
  notes: {
    type: String,
    maxlength: 1000
  },
  internalNotes: {
    type: String,
    maxlength: 1000
  },

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

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  processedBy: {
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

  // CCTV Timestamp Fields
  billStartTime: {
    type: Date,
    default: null,
    index: true
  },
  billEndTime: {
    type: Date,
    default: null,
    index: true
  },

  // Editable Bill Date (for backdating/postdating)
  billDate: {
    type: Date,
    default: null,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
// orderNumber index removed - already has unique: true in field definition
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ createdAt: -1 }); // For date range queries
orderSchema.index({ orderType: 1, status: 1, createdAt: -1 }); // Compound index for common filters
orderSchema.index({ createdBy: 1, createdAt: -1 }); // For user-specific queries
orderSchema.index({ 'pricing.total': -1 }); // For sorting by total
orderSchema.index({ status: 1, 'payment.status': 1 }); // For payment status filtering

// Pre-save middleware to generate order number using atomic Counter
orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    try {
      const Counter = mongoose.model('Counter');

      // Use billDate if provided (for backdating), otherwise use current date
      const dateToUse = this.billDate ? new Date(this.billDate) : new Date();
      const year = dateToUse.getFullYear();
      const month = String(dateToUse.getMonth() + 1).padStart(2, '0');
      const day = String(dateToUse.getDate()).padStart(2, '0');

      // Use atomic counter for date-based order numbers
      // Counter key format: orderNumber_YYYYMMDD
      const counterKey = `orderNumber_${year}${month}${day}`;

      // Atomically increment counter using findOneAndUpdate
      const counter = await Counter.findOneAndUpdate(
        { _id: counterKey },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );

      this.orderNumber = `SI-${year}${month}${day}-${String(counter.seq).padStart(4, '0')}`;
    } catch (err) {
      console.error('Error generating order number:', err);
      return next(err);
    }
  }
  next();
});

// Method to calculate totals
orderSchema.methods.calculateTotals = function () {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  this.items.forEach(item => {
    const itemSubtotal = item.quantity * item.unitPrice;
    const itemDiscount = itemSubtotal * (item.discountPercent / 100);
    const itemTaxable = itemSubtotal - itemDiscount;
    const itemTax = itemTaxable * item.taxRate;

    item.subtotal = itemSubtotal;
    item.discountAmount = itemDiscount;
    item.taxAmount = itemTax;
    item.total = itemSubtotal - itemDiscount + itemTax;

    subtotal += itemSubtotal;
    totalDiscount += itemDiscount;
    totalTax += itemTax;
  });

  this.pricing.subtotal = subtotal;
  this.pricing.discountAmount = totalDiscount;
  this.pricing.taxAmount = totalTax;
  this.pricing.total = subtotal - totalDiscount + totalTax + this.pricing.shippingAmount;

  return this.pricing;
};

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function () {
  return ['pending', 'confirmed'].includes(this.status);
};

// Method to check if order can be returned
orderSchema.methods.canBeReturned = function () {
  return ['delivered', 'shipped'].includes(this.status) &&
    this.payment.status === 'paid';
};

// Export as 'Sales' model but keep collection name as 'orders' for database compatibility
module.exports = mongoose.model('Sales', orderSchema, 'orders');
