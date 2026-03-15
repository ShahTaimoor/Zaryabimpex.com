const mongoose = require('mongoose');

const paymentApplicationSchema = new mongoose.Schema({
  // Payment Reference
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerTransaction', // Payment transaction
    required: true,
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  
  // Applications (which invoices are paid)
  applications: [{
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerTransaction', // Invoice transaction
      required: true
    },
    invoiceNumber: {
      type: String,
      required: true
    },
    amountApplied: {
      type: Number,
      required: true,
      min: 0
    },
    discountTaken: {
      type: Number,
      default: 0,
      min: 0
    },
    appliedDate: {
      type: Date,
      default: Date.now
    },
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Unapplied Amount (goes to advanceBalance)
  unappliedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Total payment amount
  totalPaymentAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'applied', 'reversed'],
    default: 'draft',
    index: true
  },
  
  // Reversal
  isReversed: {
    type: Boolean,
    default: false
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentApplication'
  },
  reversedAt: Date,
  
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  appliedBy: {
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

// Indexes
paymentApplicationSchema.index({ customer: 1, createdAt: -1 });
paymentApplicationSchema.index({ payment: 1 });
paymentApplicationSchema.index({ 'applications.invoice': 1 });

// Virtual for total applied amount
paymentApplicationSchema.virtual('totalAppliedAmount').get(function() {
  return this.applications.reduce((sum, app) => sum + app.amountApplied, 0);
});

// Method to validate payment application
paymentApplicationSchema.methods.validateApplication = function() {
  const totalApplied = this.totalAppliedAmount;
  const total = totalApplied + this.unappliedAmount;
  
  if (Math.abs(total - this.totalPaymentAmount) > 0.01) {
    throw new Error(`Payment application total (${total}) does not match payment amount (${this.totalPaymentAmount})`);
  }
  
  // Check each application doesn't exceed invoice remaining amount
  // (This would need to be checked against actual invoice data)
  
  return true;
};

module.exports = mongoose.model('PaymentApplication', paymentApplicationSchema);

