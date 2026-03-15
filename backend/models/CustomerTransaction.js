const mongoose = require('mongoose');
const Counter = require('./Counter');

const customerTransactionSchema = new mongoose.Schema({
  // Customer Reference
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  
  // Transaction Identification
  transactionNumber: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  transactionType: {
    type: String,
    required: true,
    enum: [
      'invoice',
      'payment',
      'refund',
      'credit_note',
      'debit_note',
      'adjustment',
      'write_off',
      'reversal',
      'opening_balance'
    ],
    index: true
  },
  transactionDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  dueDate: {
    type: Date,
    index: true
  },
  
  // Reference Information
  referenceType: {
    type: String,
    enum: [
      'sales_order',
      'payment',
      'refund',
      'adjustment',
      'manual_entry',
      'system_generated',
      'opening_balance'
    ],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  referenceNumber: {
    type: String,
    trim: true,
    index: true
  },
  
  // Amount Details
  grossAmount: {
    type: Number,
    default: 0,
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
  netAmount: {
    type: Number,
    required: true
  },
  
  // Balance Impact
  affectsPendingBalance: {
    type: Boolean,
    default: false
  },
  affectsAdvanceBalance: {
    type: Boolean,
    default: false
  },
  balanceImpact: {
    type: Number,
    required: true
    // Positive = customer owes more, Negative = customer owes less
  },
  
  // Balance Snapshots
  balanceBefore: {
    pendingBalance: {
      type: Number,
      default: 0
    },
    advanceBalance: {
      type: Number,
      default: 0
    },
    currentBalance: {
      type: Number,
      default: 0
    }
  },
  balanceAfter: {
    pendingBalance: {
      type: Number,
      default: 0
    },
    advanceBalance: {
      type: Number,
      default: 0
    },
    currentBalance: {
      type: Number,
      default: 0
    }
  },
  
  // Line Items (for invoices)
  lineItems: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unitPrice: {
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
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // Payment Details (for payments)
  paymentDetails: {
    paymentMethod: {
      type: String,
      enum: ['cash', 'credit_card', 'debit_card', 'check', 'bank_transfer', 'account', 'other']
    },
    paymentReference: String,
    paymentDate: Date,
    bankAccount: String,
    checkNumber: String
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'posted', 'paid', 'partially_paid', 'overdue', 'cancelled', 'reversed', 'written_off'],
    default: 'draft',
    index: true
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Aging Information
  ageInDays: {
    type: Number,
    default: 0
  },
  agingBucket: {
    type: String,
    enum: ['current', '1-30', '31-60', '61-90', '90+'],
    default: 'current',
    index: true
  },
  isOverdue: {
    type: Boolean,
    default: false,
    index: true
  },
  daysOverdue: {
    type: Number,
    default: 0
  },
  
  // Reversal Information
  isReversal: {
    type: Boolean,
    default: false
  },
  reversesTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerTransaction'
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerTransaction'
  },
  reversedAt: Date,
  
  // Accounting Entries
  accountingEntries: [{
    accountCode: {
      type: String,
      required: true
    },
    accountName: String,
    debitAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    creditAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    description: String,
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }
  }],
  
  // Additional Information
  reason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  // Approval Workflow
  requiresApproval: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  approvalNotes: String,
  
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  postedAt: Date
}, {
  timestamps: true
});

// Indexes for performance
customerTransactionSchema.index({ customer: 1, transactionDate: -1 });
customerTransactionSchema.index({ customer: 1, status: 1, dueDate: 1 });
customerTransactionSchema.index({ customer: 1, transactionType: 1 });
customerTransactionSchema.index({ referenceId: 1, referenceType: 1 });
customerTransactionSchema.index({ isOverdue: 1, agingBucket: 1 });
customerTransactionSchema.index({ dueDate: 1, status: 1 });

// Virtual for calculated remaining amount
customerTransactionSchema.virtual('calculatedRemainingAmount').get(function() {
  if (this.transactionType === 'invoice' || this.transactionType === 'debit_note') {
    return Math.max(0, this.netAmount - this.paidAmount);
  }
  return 0;
});

// Method to calculate aging
customerTransactionSchema.methods.calculateAging = function() {
  if (!this.dueDate || this.status === 'paid' || this.status === 'cancelled') {
    return {
      ageInDays: 0,
      agingBucket: 'current',
      isOverdue: false,
      daysOverdue: 0
    };
  }
  
  const today = new Date();
  const dueDate = new Date(this.dueDate);
  const ageInDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
  
  let agingBucket = 'current';
  let isOverdue = false;
  let daysOverdue = 0;
  
  if (ageInDays > 0) {
    isOverdue = true;
    daysOverdue = ageInDays;
    
    if (ageInDays <= 30) {
      agingBucket = '1-30';
    } else if (ageInDays <= 60) {
      agingBucket = '31-60';
    } else if (ageInDays <= 90) {
      agingBucket = '61-90';
    } else {
      agingBucket = '90+';
    }
  }
  
  return {
    ageInDays,
    agingBucket,
    isOverdue,
    daysOverdue
  };
};

// Pre-save hook to update aging and validate period
customerTransactionSchema.pre('save', async function(next) {
  if (this.isModified('dueDate') || this.isModified('status') || this.isNew) {
    const aging = this.calculateAging();
    this.ageInDays = aging.ageInDays;
    this.agingBucket = aging.agingBucket;
    this.isOverdue = aging.isOverdue;
    this.daysOverdue = aging.daysOverdue;
    
    // Update remaining amount
    if (this.isModified('paidAmount') || this.isNew) {
      this.remainingAmount = this.calculatedRemainingAmount;
    }
  }

  // Validate accounting period if transaction date is set/modified
  if ((this.isNew || this.isModified('transactionDate')) && this.transactionDate) {
    try {
      const AccountingPeriod = require('./AccountingPeriod');
      const period = await AccountingPeriod.findPeriodForDate(this.transactionDate);
      
      if (period && (period.status === 'closed' || period.status === 'locked')) {
        return next(new Error(
          `Cannot create transaction in ${period.status} period: ${period.periodName} ` +
          `(${period.periodStart.toISOString().split('T')[0]} to ${period.periodEnd.toISOString().split('T')[0]})`
        ));
      }
    } catch (error) {
      // If period check fails, allow transaction but log warning
      console.warn('Period validation error:', error.message);
    }
  }

  next();
});

// Static method to generate transaction number
customerTransactionSchema.statics.generateTransactionNumber = async function(transactionType, customerId) {
  const prefix = {
    'invoice': 'INV',
    'payment': 'PAY',
    'refund': 'REF',
    'credit_note': 'CN',
    'debit_note': 'DN',
    'adjustment': 'ADJ',
    'write_off': 'WO',
    'reversal': 'REV',
    'opening_balance': 'OB'
  }[transactionType] || 'TXN';
  
  const counter = await Counter.findByIdAndUpdate(
    { _id: `customer_transaction_${prefix}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  
  const year = new Date().getFullYear();
  const seq = String(counter.seq).padStart(6, '0');
  
  return `${prefix}-${year}-${seq}`;
};

// Method to check if can be reversed
customerTransactionSchema.methods.canBeReversed = function() {
  return this.status !== 'reversed' && 
         this.status !== 'cancelled' &&
         !this.isReversal;
};

module.exports = mongoose.model('CustomerTransaction', customerTransactionSchema);

