const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  // Account Identification
  accountCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  accountName: {
    type: String,
    required: true,
    trim: true
  },

  // Account Classification
  accountType: {
    type: String,
    required: true,
    enum: ['asset', 'liability', 'equity', 'revenue', 'expense']
  },
  accountCategory: {
    type: String,
    required: true,
    enum: [
      // Assets
      'current_assets', 'fixed_assets', 'other_assets',
      // Liabilities
      'current_liabilities', 'long_term_liabilities',
      // Equity
      'owner_equity', 'retained_earnings',
      // Revenue
      'sales_revenue', 'other_revenue',
      // Expenses
      'cost_of_goods_sold', 'operating_expenses', 'other_expenses',
      // Additional Categories
      'inventory', 'prepaid_expenses', 'accrued_expenses', 'deferred_revenue',
      'manufacturing_overhead', 'service_delivery', 'quality_control',
      'warehouse_operations', 'shipping_handling', 'security_loss_prevention'
    ]
  },

  // Account Hierarchy
  parentAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts',
    default: null
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },

  // Account Properties
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemAccount: {
    type: Boolean,
    default: false // System accounts cannot be deleted
  },
  allowDirectPosting: {
    type: Boolean,
    default: true // Can transactions be posted directly to this account?
  },

  // Balance Information
  normalBalance: {
    type: String,
    required: true,
    enum: ['debit', 'credit']
  },
  currentBalance: {
    type: Number,
    default: 0
    // @deprecated - Use AccountingService.getAccountBalance() which calculates from ledger
  },
  openingBalance: {
    type: Number,
    default: 0
  },

  // Additional Information
  description: {
    type: String,
    trim: true
  },
  currency: {
    type: String,
    default: 'USD'
  },

  // Tax Information
  isTaxable: {
    type: Boolean,
    default: false
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Reconciliation
  requiresReconciliation: {
    type: Boolean,
    default: false
  },
  lastReconciliationDate: {
    type: Date
  },
  // Reconciliation Locking (CRITICAL: Prevents changes during reconciliation)
  reconciliationStatus: {
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'reconciled', 'discrepancy'],
      default: 'not_started'
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reconciledAt: Date,
    lastReconciliationDate: Date,
    nextReconciliationDate: Date,
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lockedAt: Date,
    lockExpiresAt: Date,
    discrepancyAmount: Number,
    discrepancyReason: String
  },

  // Metadata
  notes: {
    type: String
  },
  tags: [{
    type: String,
    trim: true
  }],

  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes are defined in the schema fields above using 'unique: true' and 'index: true'
// No need for additional index definitions here to avoid duplicate warnings

// Virtual for full account path
accountSchema.virtual('fullAccountPath').get(function () {
  return this.parentAccount
    ? `${this.parentAccount.accountCode} > ${this.accountCode}`
    : this.accountCode;
});

// Method to get account hierarchy
accountSchema.statics.getAccountHierarchy = async function () {
  const accounts = await this.find({ isActive: true })
    .sort({ accountCode: 1 })
    .populate('parentAccount', 'accountCode accountName');

  // Build tree structure
  const accountMap = {};
  const rootAccounts = [];

  accounts.forEach(account => {
    accountMap[account._id] = {
      ...account.toObject(),
      children: []
    };
  });

  accounts.forEach(account => {
    if (account.parentAccount) {
      const parent = accountMap[account.parentAccount._id];
      if (parent) {
        parent.children.push(accountMap[account._id]);
      }
    } else {
      rootAccounts.push(accountMap[account._id]);
    }
  });

  return rootAccounts;
};

// @deprecated - Use AccountingService.getAccountBalance() which calculates from ledger
accountSchema.methods.updateBalance = function (amount, isDebit) {
  // CRITICAL: Prevent modifications during reconciliation
  if (this.reconciliationStatus &&
    this.reconciliationStatus.status === 'in_progress' &&
    this.reconciliationStatus.lockedBy &&
    this.reconciliationStatus.lockExpiresAt &&
    this.reconciliationStatus.lockExpiresAt > new Date()) {
    throw new Error(
      `Cannot modify account ${this.accountCode} during reconciliation. ` +
      `Account is locked by another user until ${this.reconciliationStatus.lockExpiresAt.toISOString()}`
    );
  }

  if (this.normalBalance === 'debit') {
    this.currentBalance += isDebit ? amount : -amount;
  } else {
    this.currentBalance += isDebit ? -amount : amount;
  }
  return this.save();
};

// Method to lock account for reconciliation
accountSchema.methods.lockForReconciliation = function (userId, durationMinutes = 30) {
  if (this.reconciliationStatus.lockedBy &&
    this.reconciliationStatus.lockExpiresAt > new Date()) {
    throw new Error('Account is already locked for reconciliation by another user');
  }

  this.reconciliationStatus.status = 'in_progress';
  this.reconciliationStatus.lockedBy = userId;
  this.reconciliationStatus.lockedAt = new Date();
  this.reconciliationStatus.lockExpiresAt = new Date(Date.now() + durationMinutes * 60000);

  return this.save();
};

// Method to unlock account after reconciliation
accountSchema.methods.unlockAfterReconciliation = function (userId, reconciled = true, discrepancyAmount = null, discrepancyReason = null) {
  if (this.reconciliationStatus.lockedBy &&
    this.reconciliationStatus.lockedBy.toString() !== userId.toString()) {
    throw new Error('Only the user who locked the account can unlock it');
  }

  this.reconciliationStatus.status = reconciled ? 'reconciled' : 'discrepancy';
  this.reconciliationStatus.reconciledBy = userId;
  this.reconciliationStatus.reconciledAt = new Date();
  this.reconciliationStatus.lastReconciliationDate = new Date();
  this.reconciliationStatus.lockedBy = null;
  this.reconciliationStatus.lockedAt = null;
  this.reconciliationStatus.lockExpiresAt = null;

  if (discrepancyAmount !== null) {
    this.reconciliationStatus.discrepancyAmount = discrepancyAmount;
    this.reconciliationStatus.discrepancyReason = discrepancyReason;
  }

  return this.save();
};

const ChartOfAccounts = mongoose.model('ChartOfAccounts', accountSchema);

module.exports = ChartOfAccounts;

