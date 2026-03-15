const mongoose = require('mongoose');

const cashPaymentSchema = new mongoose.Schema({
  // Payment Information
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  voucherCode: {
    type: String,
    required: false,  // Auto-generated in pre-save middleware
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  particular: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500,
    default: 'Cash Payment'
  },

  // Reference Information
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales',
    required: false
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: false
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false
  },

  // Payment Method
  paymentMethod: {
    type: String,
    enum: ['cash', 'check', 'other'],
    default: 'cash'
  },
  expenseAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts'
  },

  // Additional Information
  notes: {
    type: String,
    trim: true,
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

  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Generate voucher code before saving
const { generateDateBasedVoucherCode } = require('../utils/voucherCodeGenerator');
cashPaymentSchema.pre('save', async function (next) {
  if (this.isNew && !this.voucherCode) {
    try {
      this.voucherCode = await generateDateBasedVoucherCode({
        prefix: 'CP',
        Model: this.constructor
      });
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Index for better query performance
cashPaymentSchema.index({ date: -1 });
cashPaymentSchema.index({ voucherCode: 1 }, { unique: true, sparse: true }); // Sparse allows multiple null values
cashPaymentSchema.index({ createdBy: 1 });

module.exports = mongoose.model('CashPayment', cashPaymentSchema);
