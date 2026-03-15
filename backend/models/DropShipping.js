const mongoose = require('mongoose');

// Item schema for drop shipping transactions
const dropShippingItemSchema = new mongoose.Schema({
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
  supplierRate: {
    type: Number,
    required: true,
    min: 0
  },
  supplierAmount: {
    type: Number,
    required: true,
    min: 0
  },
  customerRate: {
    type: Number,
    required: true,
    min: 0
  },
  customerAmount: {
    type: Number,
    required: true,
    min: 0
  },
  profitAmount: {
    type: Number,
    required: true,
    min: 0
  },
  profitMargin: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  }
}, { _id: true });

// Main drop shipping transaction schema
const dropShippingSchema = new mongoose.Schema({
  // Transaction Identification
  transactionNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Supplier Information
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  supplierInfo: {
    companyName: String,
    contactPerson: String,
    email: String,
    phone: String
  },
  billNumber: {
    type: String,
    trim: true
  },
  supplierDescription: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Customer Information
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerInfo: {
    displayName: String,
    businessName: String,
    email: String,
    phone: String,
    businessType: String
  },
  customerDescription: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  rateType: {
    type: String,
    enum: ['retail', 'wholesale', 'custom'],
    default: 'wholesale'
  },
  
  // Transaction Details
  items: [dropShippingItemSchema],
  
  // Financial Summary
  supplierTotal: {
    type: Number,
    required: true,
    min: 0
  },
  customerTotal: {
    type: Number,
    required: true,
    min: 0
  },
  totalProfit: {
    type: Number,
    required: true,
    min: 0
  },
  averageMargin: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  // Payment Information
  supplierPayment: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    method: {
      type: String,
      enum: ['cash', 'account', 'credit_card', 'debit_card', 'check'],
      default: 'account'
    },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid'
    }
  },
  customerPayment: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    method: {
      type: String,
      enum: ['cash', 'account', 'credit_card', 'debit_card', 'check'],
      default: 'account'
    },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid'
    }
  },
  
  // Dates
  transactionDate: {
    type: Date,
    default: Date.now
  },
  expectedDelivery: {
    type: Date
  },
  actualDelivery: {
    type: Date
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'completed'],
    default: 'pending'
  },
  
  // Shipping Information
  shippingAddress: {
    type: {
      type: String,
      enum: ['supplier', 'customer_direct', 'warehouse'],
      default: 'customer_direct'
    },
    recipient: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    phone: String
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  carrier: {
    type: String,
    trim: true
  },
  
  // Additional Information
  notes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  // Invoice Generation
  printInvoice: {
    type: Boolean,
    default: true
  },
  supplierInvoiceNumber: {
    type: String,
    trim: true
  },
  customerInvoiceNumber: {
    type: String,
    trim: true
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

// Indexes
// Note: transactionNumber already has an index from unique: true, so we don't need to add it again
dropShippingSchema.index({ supplier: 1, status: 1 });
dropShippingSchema.index({ customer: 1, status: 1 });
dropShippingSchema.index({ transactionDate: -1 });
dropShippingSchema.index({ status: 1 });

// Virtual for calculated profit margin
dropShippingSchema.virtual('profitPercentage').get(function() {
  if (this.customerTotal === 0) return 0;
  return ((this.totalProfit / this.customerTotal) * 100).toFixed(2);
});

// Pre-save middleware to generate transaction number and calculate profits
dropShippingSchema.pre('save', async function(next) {
  // Generate transaction number if new
  if (this.isNew && !this.transactionNumber) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // Get count of transactions today
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const count = await this.constructor.countDocuments({
      transactionDate: { $gte: startOfDay, $lt: endOfDay }
    });
    
    this.transactionNumber = `DS-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
  }
  
  // Calculate profit for each item
  if (this.isModified('items')) {
    this.items.forEach(item => {
      item.supplierAmount = item.quantity * item.supplierRate;
      item.customerAmount = item.quantity * item.customerRate;
      item.profitAmount = item.customerAmount - item.supplierAmount;
      item.profitMargin = item.customerRate > 0 
        ? ((item.profitAmount / item.customerAmount) * 100) 
        : 0;
    });
    
    // Calculate totals
    this.supplierTotal = this.items.reduce((sum, item) => sum + item.supplierAmount, 0);
    this.customerTotal = this.items.reduce((sum, item) => sum + item.customerAmount, 0);
    this.totalProfit = this.items.reduce((sum, item) => sum + item.profitAmount, 0);
    this.averageMargin = this.items.length > 0
      ? this.items.reduce((sum, item) => sum + item.profitMargin, 0) / this.items.length
      : 0;
  }
  
  next();
});

// Method to update payment status
dropShippingSchema.methods.updatePaymentStatus = function(type) {
  const payment = type === 'supplier' ? this.supplierPayment : this.customerPayment;
  const total = type === 'supplier' ? this.supplierTotal : this.customerTotal;
  
  if (payment.amount <= 0) {
    payment.status = 'unpaid';
  } else if (payment.amount >= total) {
    payment.status = 'paid';
  } else {
    payment.status = 'partial';
  }
};

// Method to mark as completed
dropShippingSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.actualDelivery = new Date();
};

module.exports = mongoose.model('DropShipping', dropShippingSchema);

