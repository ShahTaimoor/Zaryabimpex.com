const mongoose = require('mongoose');
const Counter = require('./Counter');

const cashReceiptSchema = new mongoose.Schema({
  // Receipt Information
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
    default: 'Cash Receipt'
  },

  // Reference Information
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales',
    required: false
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: false
  },

  // Payment Method
  paymentMethod: {
    type: String,
    enum: ['cash', 'check', 'bank_transfer', 'other'],
    default: 'cash'
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'confirmed'
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

// Pre-save middleware to generate voucher code
cashReceiptSchema.pre('save', async function (next) {
  // Only generate voucher code for new documents to maintain immutability
  if (this.isNew && !this.voucherCode) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: 'cashReceiptVoucherCode' },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );
      this.voucherCode = `CR-${String(counter.seq).padStart(6, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Index for better query performance
cashReceiptSchema.index({ date: -1 });
cashReceiptSchema.index({ voucherCode: 1 }, { unique: true, sparse: true }); // Sparse allows multiple null values
cashReceiptSchema.index({ createdBy: 1 });

module.exports = mongoose.model('CashReceipt', cashReceiptSchema);
