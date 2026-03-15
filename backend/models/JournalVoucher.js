const mongoose = require('mongoose');
const Counter = require('./Counter');

const journalVoucherEntrySchema = new mongoose.Schema({
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts',
    required: true
  },
  accountCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  particulars: {
    type: String,
    trim: true,
    maxlength: 500
  },
  debit: {
    type: Number,
    default: 0,
    min: 0
  },
  credit: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const journalVoucherSchema = new mongoose.Schema({
  voucherNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  voucherDate: {
    type: Date,
    required: true
  },
  reference: {
    type: String,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  entries: {
    type: [journalVoucherEntrySchema],
    validate: [
      {
        validator(value) {
          return Array.isArray(value) && value.length >= 2;
        },
        message: 'At least two entries are required for a journal voucher.'
      },
      {
        validator(value) {
          return value.every(entry => !(entry.debit > 0 && entry.credit > 0));
        },
        message: 'An entry cannot have both debit and credit amounts.'
      }
    ]
  },
  totalDebit: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCredit: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'posted'],
    default: 'draft'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Approval Workflow (CRITICAL: SOX Compliance)
  requiresApproval: {
    type: Boolean,
    default: false
  },
  approvalThreshold: {
    type: Number,
    default: 10000 // Amount requiring approval (configurable)
  },
  approvalWorkflow: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvers: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      role: {
        type: String,
        enum: ['accountant', 'controller', 'cfo', 'manager']
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      approvedAt: Date,
      notes: String
    }],
    currentApproverIndex: {
      type: Number,
      default: 0
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

journalVoucherSchema.pre('validate', function(next) {
  if (Array.isArray(this.entries)) {
    let debit = 0;
    let credit = 0;

    this.entries.forEach(entry => {
      debit += entry.debit || 0;
      credit += entry.credit || 0;
    });

    this.totalDebit = Math.round((debit + Number.EPSILON) * 100) / 100;
    this.totalCredit = Math.round((credit + Number.EPSILON) * 100) / 100;

    if (this.totalDebit <= 0 || this.totalCredit <= 0) {
      return next(new Error('Total debit and credit must be greater than zero.'));
    }

    if (Math.abs(this.totalDebit - this.totalCredit) > 0.0001) {
      return next(new Error('Total debit and credit must be equal.'));
    }
  }

  next();
});

// voucherNumber index removed - already has unique: true in field definition
journalVoucherSchema.index({ voucherDate: -1 });
journalVoucherSchema.index({ status: 1, voucherDate: -1 });
journalVoucherSchema.index({ 'approvalWorkflow.status': 1 });
journalVoucherSchema.index({ requiresApproval: 1, 'approvalWorkflow.status': 1 });

// Instance method to check if approval is required
journalVoucherSchema.methods.requiresApprovalCheck = function(threshold = 10000) {
  return this.totalDebit >= threshold;
};

// Instance method to check if can be approved by user
journalVoucherSchema.methods.canBeApprovedBy = function(userId) {
  // Cannot approve own work (segregation of duties)
  if (this.createdBy && this.createdBy.toString() === userId.toString()) {
    return { allowed: false, reason: 'Cannot approve own journal entry (segregation of duties)' };
  }
  
  // Check if already approved
  if (this.approvalWorkflow.status === 'approved') {
    return { allowed: false, reason: 'Journal entry already approved' };
  }
  
  // Check if rejected
  if (this.approvalWorkflow.status === 'rejected') {
    return { allowed: false, reason: 'Journal entry was rejected' };
  }
  
  // Check if current approver
  if (this.approvalWorkflow.approvers && this.approvalWorkflow.approvers.length > 0) {
    const currentApprover = this.approvalWorkflow.approvers[this.approvalWorkflow.currentApproverIndex];
    if (currentApprover && currentApprover.user.toString() !== userId.toString()) {
      return { allowed: false, reason: 'Not the current approver for this journal entry' };
    }
  }
  
  return { allowed: true };
};

journalVoucherSchema.pre('save', async function(next) {
  if (!this.voucherNumber) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: 'journalVoucherNumber' },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );
      this.voucherNumber = `JV-${String(counter.seq).padStart(6, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('JournalVoucher', journalVoucherSchema);

