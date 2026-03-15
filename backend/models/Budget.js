const mongoose = require('mongoose');

const budgetItemSchema = new mongoose.Schema({
  accountCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  expenseType: {
    type: String,
    enum: ['selling', 'administrative', 'other'],
    required: true
  },
  budgetedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  }
});

const budgetSchema = new mongoose.Schema({
  budgetId: {
    type: String,
    unique: true,
    required: false
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  period: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'custom'],
      required: true,
      default: 'monthly'
    }
  },
  budgetType: {
    type: String,
    enum: ['expense', 'revenue', 'full'],
    default: 'expense'
  },
  items: [budgetItemSchema],
  
  // Summary totals
  totals: {
    sellingExpenses: {
      type: Number,
      default: 0
    },
    administrativeExpenses: {
      type: Number,
      default: 0
    },
    totalExpenses: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    }
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'approved', 'active', 'archived'],
    default: 'draft'
  },
  
  // Approval
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Version tracking
  version: {
    type: Number,
    default: 1
  },
  parentBudget: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Budget'
  },
  
  // Metadata
  metadata: {
    currency: {
      type: String,
      default: 'USD'
    },
    notes: String,
    tags: [String]
  }
}, {
  timestamps: true
});

// Pre-save middleware to generate budget ID
budgetSchema.pre('save', async function(next) {
  if (this.isNew && !this.budgetId) {
    const year = this.period.startDate.getFullYear();
    const month = String(this.period.startDate.getMonth() + 1).padStart(2, '0');
    const count = await this.constructor.countDocuments({
      'period.startDate': {
        $gte: new Date(year, this.period.startDate.getMonth(), 1),
        $lt: new Date(year, this.period.startDate.getMonth() + 1, 1)
      }
    });
    this.budgetId = `BUD-${year}${month}-${String(count + 1).padStart(3, '0')}`;
  }
  
  // Calculate totals
  this.totals.sellingExpenses = this.items
    .filter(item => item.expenseType === 'selling')
    .reduce((sum, item) => sum + item.budgetedAmount, 0);
  
  this.totals.administrativeExpenses = this.items
    .filter(item => item.expenseType === 'administrative')
    .reduce((sum, item) => sum + item.budgetedAmount, 0);
  
  this.totals.totalExpenses = this.totals.sellingExpenses + this.totals.administrativeExpenses;
  
  next();
});

// Indexes
budgetSchema.index({ 'period.startDate': 1, 'period.endDate': 1 });
budgetSchema.index({ status: 1 });
budgetSchema.index({ budgetType: 1 });
budgetSchema.index({ createdBy: 1 });

// Static method to find budget for period
budgetSchema.statics.findBudgetForPeriod = function(startDate, endDate, budgetType = 'expense') {
  return this.findOne({
    budgetType,
    status: { $in: ['approved', 'active'] },
    'period.startDate': { $lte: endDate },
    'period.endDate': { $gte: startDate }
  }).sort({ 'period.startDate': -1 });
};

// Method to get budget amount for account/category
budgetSchema.methods.getBudgetForAccount = function(accountCode, category = null) {
  const item = this.items.find(item => {
    if (category) {
      return item.accountCode === accountCode && item.category === category;
    }
    return item.accountCode === accountCode;
  });
  return item ? item.budgetedAmount : 0;
};

// Method to get budget for category
budgetSchema.methods.getBudgetForCategory = function(category, expenseType = null) {
  const filtered = this.items.filter(item => {
    if (expenseType) {
      return item.category === category && item.expenseType === expenseType;
    }
    return item.category === category;
  });
  return filtered.reduce((sum, item) => sum + item.budgetedAmount, 0);
};

module.exports = mongoose.model('Budget', budgetSchema);

