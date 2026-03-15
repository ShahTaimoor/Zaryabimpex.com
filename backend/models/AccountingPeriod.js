const mongoose = require('mongoose');

const accountingPeriodSchema = new mongoose.Schema({
  // Period Identification
  periodName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  periodType: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    required: true,
    index: true
  },
  periodStart: {
    type: Date,
    required: true,
    index: true
  },
  periodEnd: {
    type: Date,
    required: true,
    index: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['open', 'closing', 'closed', 'locked'],
    default: 'open',
    index: true
  },
  
  // Closing Information
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  closedAt: Date,
  closingNotes: {
    type: String,
    maxlength: 1000
  },
  
  // Locking Information
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lockedAt: Date,
  lockReason: {
    type: String,
    maxlength: 500
  },
  
  // Reconciliation Status
  reconciled: {
    type: Boolean,
    default: false
  },
  reconciledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reconciledAt: Date,
  
  // Statistics
  transactionCount: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  totalReceivables: {
    type: Number,
    default: 0
  },
  
  // Validation
  validationErrors: [{
    type: {
      type: String,
      enum: ['unposted_transaction', 'unreconciled_balance', 'missing_entry', 'other']
    },
    description: String,
    count: Number
  }],
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    maxlength: 2000
  }
}, {
  timestamps: true
});

// Indexes
accountingPeriodSchema.index({ periodStart: 1, periodEnd: 1 });
accountingPeriodSchema.index({ status: 1, periodEnd: -1 });
accountingPeriodSchema.index({ periodType: 1, periodStart: -1 });

// Virtual for period duration in days
accountingPeriodSchema.virtual('durationDays').get(function() {
  return Math.ceil((this.periodEnd - this.periodStart) / (1000 * 60 * 60 * 24));
});

// Method to check if date is in period
accountingPeriodSchema.methods.containsDate = function(date) {
  return date >= this.periodStart && date <= this.periodEnd;
};

// Method to check if period can be closed
accountingPeriodSchema.methods.canBeClosed = async function() {
  if (this.status === 'closed' || this.status === 'locked') {
    return { canClose: false, reason: `Period is already ${this.status}` };
  }

  // Check for unposted transactions
  const CustomerTransaction = require('./CustomerTransaction');
  const unpostedCount = await CustomerTransaction.countDocuments({
    transactionDate: {
      $gte: this.periodStart,
      $lte: this.periodEnd
    },
    status: { $nin: ['posted', 'paid', 'cancelled'] }
  });

  if (unpostedCount > 0) {
    return { 
      canClose: false, 
      reason: `${unpostedCount} unposted transactions found`,
      unpostedCount
    };
  }

  return { canClose: true };
};

// Static method to get current period
accountingPeriodSchema.statics.getCurrentPeriod = async function(periodType = 'monthly') {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  let periodStart, periodEnd, periodName;

  switch (periodType) {
    case 'monthly':
      periodStart = new Date(year, month, 1);
      periodEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      periodName = `${year}-${String(month + 1).padStart(2, '0')}`;
      break;
    case 'quarterly':
      const quarter = Math.floor(month / 3);
      periodStart = new Date(year, quarter * 3, 1);
      periodEnd = new Date(year, (quarter + 1) * 3, 0, 23, 59, 59, 999);
      periodName = `Q${quarter + 1}-${year}`;
      break;
    case 'yearly':
      periodStart = new Date(year, 0, 1);
      periodEnd = new Date(year, 11, 31, 23, 59, 59, 999);
      periodName = `${year}`;
      break;
  }

  let period = await this.findOne({
    periodStart: periodStart,
    periodEnd: periodEnd,
    periodType: periodType
  });

  if (!period) {
    // Create period if it doesn't exist
    period = await this.create({
      periodName,
      periodType,
      periodStart,
      periodEnd,
      status: 'open',
      createdBy: null // System created
    });
  }

  return period;
};

// Static method to find period for a date
accountingPeriodSchema.statics.findPeriodForDate = async function(date, periodType = 'monthly') {
  return await this.findOne({
    periodStart: { $lte: date },
    periodEnd: { $gte: date },
    periodType: periodType
  });
};

module.exports = mongoose.model('AccountingPeriod', accountingPeriodSchema);

