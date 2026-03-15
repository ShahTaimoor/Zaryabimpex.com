const mongoose = require('mongoose');

const FinancialStatementSchema = new mongoose.Schema({
  statementId: {
    type: String,
    required: false,
    unique: true,
  },
  type: {
    type: String,
    enum: ['profit_loss', 'balance_sheet', 'cash_flow', 'income_statement'],
    required: true,
  },
  period: {
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'custom'],
      required: true,
    },
  },
  company: {
    name: String,
    address: String,
    taxId: String,
  },
  revenue: {
    grossSales: {
      amount: { type: Number, default: 0 },
      details: [{
        category: String,
        amount: Number,
        description: String,
      }],
    },
    salesReturns: {
      amount: { type: Number, default: 0 },
      details: [{
        category: String,
        amount: Number,
        reason: String,
      }],
    },
    salesDiscounts: {
      amount: { type: Number, default: 0 },
      details: [{
        type: String, // bulk, loyalty, promotional
        amount: Number,
        description: String,
      }],
    },
    netSales: {
      amount: { type: Number, default: 0 },
      calculation: String,
    },
    otherRevenue: {
      amount: { type: Number, default: 0 },
      details: [{
        source: String,
        amount: Number,
        description: String,
      }],
    },
    totalRevenue: {
      amount: { type: Number, default: 0 },
      calculation: String,
    },
  },
  costOfGoodsSold: {
    beginningInventory: { type: Number, default: 0 },
    purchases: {
      amount: { type: Number, default: 0 },
      details: [{
        supplier: String,
        amount: Number,
        date: Date,
      }],
    },
    freightIn: { type: Number, default: 0 },
    purchaseReturns: { type: Number, default: 0 },
    purchaseDiscounts: { type: Number, default: 0 },
    endingInventory: { type: Number, default: 0 },
    totalCOGS: {
      amount: { type: Number, default: 0 },
      calculation: String,
      calculationMethod: { type: String, enum: ['transaction', 'inventory_formula'], default: 'transaction' },
    },
    cogsFromInventoryFormula: { type: Number, default: 0 }, // For validation/reference
  },
  grossProfit: {
    amount: { type: Number, default: 0 },
    margin: { type: Number, default: 0 }, // percentage
    calculation: String,
  },
  operatingExpenses: {
    sellingExpenses: {
      total: { type: Number, default: 0 },
      details: [{
        category: String,
        amount: Number,
        description: String,
        subcategories: [{
          name: String,
          amount: Number,
        }],
      }],
    },
    administrativeExpenses: {
      total: { type: Number, default: 0 },
      details: [{
        category: String,
        amount: Number,
        description: String,
        subcategories: [{
          name: String,
          amount: Number,
        }],
      }],
    },
    totalOperatingExpenses: {
      amount: { type: Number, default: 0 },
      calculation: String,
    },
  },
  operatingIncome: {
    amount: { type: Number, default: 0 },
    margin: { type: Number, default: 0 }, // percentage
    calculation: String,
  },
  otherIncome: {
    interestIncome: { type: Number, default: 0 },
    rentalIncome: { type: Number, default: 0 },
    other: {
      amount: { type: Number, default: 0 },
      details: [{
        source: String,
        amount: Number,
        description: String,
      }],
    },
    totalOtherIncome: {
      amount: { type: Number, default: 0 },
      calculation: String,
    },
  },
  otherExpenses: {
    interestExpense: { type: Number, default: 0 },
    depreciation: { type: Number, default: 0 },
    amortization: { type: Number, default: 0 },
    other: {
      amount: { type: Number, default: 0 },
      details: [{
        category: String,
        amount: Number,
        description: String,
      }],
    },
    totalOtherExpenses: {
      amount: { type: Number, default: 0 },
      calculation: String,
    },
  },
  earningsBeforeTax: {
    amount: { type: Number, default: 0 },
    calculation: String,
  },
  incomeTax: {
    current: { type: Number, default: 0 },
    deferred: { type: Number, default: 0 },
    total: {
      amount: { type: Number, default: 0 },
      rate: { type: Number, default: 0 }, // percentage
    },
  },
  netIncome: {
    amount: { type: Number, default: 0 },
    margin: { type: Number, default: 0 }, // percentage
    calculation: String,
  },
  keyMetrics: {
    grossProfitMargin: { type: Number, default: 0 },
    operatingMargin: { type: Number, default: 0 },
    netProfitMargin: { type: Number, default: 0 },
    ebitda: { type: Number, default: 0 },
    inventoryTurnover: { type: Number, default: 0 },
    accountsReceivableTurnover: { type: Number, default: 0 },
  },
  comparison: {
    previousPeriod: {
      period: String,
      netIncome: Number,
      change: Number,
      changePercent: Number,
    },
    budget: {
      period: String,
      netIncome: Number,
      variance: Number,
      variancePercent: Number,
    },
  },
  notes: [{
    section: String,
    note: String,
    amount: Number,
    date: Date,
  }],
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'published'],
    default: 'draft',
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: Date,
  version: {
    type: Number,
    default: 1,
  },
  // Version History (CRITICAL: Audit trail for statement changes)
  previousVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinancialStatement'
  },
  versionHistory: [{
    version: {
      type: Number,
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    changes: [{
      field: {
        type: String,
        required: true
      },
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      reason: String
    }],
    status: {
      type: String,
      enum: ['draft', 'review', 'approved', 'published']
    },
    notes: String
  }],
  isCurrentVersion: {
    type: Boolean,
    default: true
  },
  metadata: {
    calculationMethod: String,
    currency: { type: String, default: 'USD' },
    roundingPrecision: { type: Number, default: 2 },
    dataSource: String,
    lastUpdated: Date,
    generationTime: Number, // milliseconds
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
// statementId index removed - already has unique: true in field definition
FinancialStatementSchema.index({ type: 1 });
FinancialStatementSchema.index({ 'period.startDate': 1, 'period.endDate': 1 });
FinancialStatementSchema.index({ status: 1 });
FinancialStatementSchema.index({ createdAt: -1 });
FinancialStatementSchema.index({ isCurrentVersion: 1, type: 1 });
FinancialStatementSchema.index({ previousVersion: 1 });

// Instance method to detect changes between versions
FinancialStatementSchema.methods.detectChanges = function(oldVersion) {
  const changes = [];
  const fieldsToTrack = [
    'revenue', 'costOfGoodsSold', 'grossProfit', 'operatingExpenses',
    'operatingIncome', 'otherIncome', 'otherExpenses', 'netIncome',
    'status', 'notes'
  ];
  
  fieldsToTrack.forEach(field => {
    const oldValue = this.getNestedValue(oldVersion, field);
    const newValue = this.getNestedValue(this.toObject(), field);
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field,
        oldValue,
        newValue
      });
    }
  });
  
  return changes;
};

// Helper method to get nested value
FinancialStatementSchema.methods.getNestedValue = function(obj, path) {
  return path.split('.').reduce((current, prop) => current && current[prop], obj);
};

// Virtual for period duration
FinancialStatementSchema.virtual('periodDuration').get(function() {
  return Math.ceil((this.period.endDate - this.period.startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for isCurrentPeriod
FinancialStatementSchema.virtual('isCurrentPeriod').get(function() {
  const now = new Date();
  return now >= this.period.startDate && now <= this.period.endDate;
});

// Pre-save middleware to generate statement ID
FinancialStatementSchema.pre('save', async function(next) {
  if (!this.statementId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 6);
    const typePrefix = this.type === 'profit_loss' ? 'PL' : 
                      this.type === 'balance_sheet' ? 'BS' : 
                      this.type === 'cash_flow' ? 'CF' : 'FS';
    this.statementId = `${typePrefix}_${timestamp}_${random}`;
  }
  
  // Update metadata
  this.metadata.lastUpdated = new Date();
  
  next();
});

// Static method to get latest statement
FinancialStatementSchema.statics.getLatestStatement = async function(type = 'profit_loss', periodType = 'monthly') {
  return await this.findOne({
    type,
    'period.type': periodType,
  }).sort({ 'period.endDate': -1 });
};

// Static method to get statements by date range
FinancialStatementSchema.statics.getStatementsByDateRange = async function(startDate, endDate, type = 'profit_loss') {
  return await this.find({
    type,
    'period.startDate': { $gte: startDate },
    'period.endDate': { $lte: endDate },
  }).sort({ 'period.startDate': 1 });
};

// Static method to get statement comparison
FinancialStatementSchema.statics.getStatementComparison = async function(currentStatementId, comparisonType = 'previous') {
  const currentStatement = await this.findById(currentStatementId);
  if (!currentStatement) {
    throw new Error('Statement not found');
  }
  
  let comparisonStatement;
  
  if (comparisonType === 'previous') {
    // Find previous period statement
    comparisonStatement = await this.findOne({
      type: currentStatement.type,
      'period.endDate': { $lt: currentStatement.period.startDate },
    }).sort({ 'period.endDate': -1 });
  } else if (comparisonType === 'budget') {
    // Find budget statement for same period
    comparisonStatement = await this.findOne({
      type: 'budget_' + currentStatement.type,
      'period.startDate': currentStatement.period.startDate,
      'period.endDate': currentStatement.period.endDate,
    });
  }
  
  return {
    current: currentStatement,
    comparison: comparisonStatement,
    variances: comparisonStatement ? this.calculateVariances(currentStatement, comparisonStatement) : null,
  };
};

// Static method to calculate variances
FinancialStatementSchema.statics.calculateVariances = function(current, comparison) {
  const variances = {};
  
  // Calculate key metric variances
  const metrics = ['netIncome', 'grossProfit', 'operatingIncome', 'totalRevenue'];
  
  metrics.forEach(metric => {
    const currentValue = current[metric]?.amount || 0;
    const comparisonValue = comparison[metric]?.amount || 0;
    const variance = currentValue - comparisonValue;
    const variancePercent = comparisonValue !== 0 ? (variance / comparisonValue) * 100 : 0;
    
    variances[metric] = {
      current: currentValue,
      comparison: comparisonValue,
      variance,
      variancePercent,
      isPositive: variance >= 0,
    };
  });
  
  return variances;
};

// Method to calculate all derived values
FinancialStatementSchema.methods.calculateDerivedValues = function() {
  // Net Sales = Gross Sales - Sales Returns - Sales Discounts
  this.revenue.netSales.amount = this.revenue.grossSales.amount - 
    this.revenue.salesReturns.amount - this.revenue.salesDiscounts.amount;
  this.revenue.netSales.calculation = `${this.revenue.grossSales.amount} - ${this.revenue.salesReturns.amount} - ${this.revenue.salesDiscounts.amount}`;
  
  // Total Revenue = Net Sales + Other Revenue
  this.revenue.totalRevenue.amount = this.revenue.netSales.amount + this.revenue.otherRevenue.amount;
  this.revenue.totalRevenue.calculation = `${this.revenue.netSales.amount} + ${this.revenue.otherRevenue.amount}`;
  
  // COGS Calculation: Use transaction-based if available, otherwise use inventory formula
  // Calculate inventory formula COGS for reference/validation
  const inventoryFormulaCOGS = this.costOfGoodsSold.beginningInventory + 
    this.costOfGoodsSold.purchases.amount + this.costOfGoodsSold.freightIn - 
    this.costOfGoodsSold.purchaseReturns - this.costOfGoodsSold.purchaseDiscounts - 
    this.costOfGoodsSold.endingInventory;
  
  // Store inventory formula result for reference
  this.costOfGoodsSold.cogsFromInventoryFormula = inventoryFormulaCOGS;
  
  // Use transaction-based COGS if already set (from populateCOGSData), otherwise use inventory formula
  // Check if transaction-based COGS was set by checking if calculationMethod is 'transaction'
  if (this.costOfGoodsSold.totalCOGS.calculationMethod === 'transaction') {
    // Transaction-based COGS is set, keep it and update calculation string if needed
    if (!this.costOfGoodsSold.totalCOGS.calculation) {
      this.costOfGoodsSold.totalCOGS.calculation = 'Sum of COGS transactions';
    }
    // Keep the transaction-based amount - don't overwrite
  } else {
    // No transaction-based COGS set, use inventory formula
    this.costOfGoodsSold.totalCOGS.amount = inventoryFormulaCOGS;
    this.costOfGoodsSold.totalCOGS.calculation = `${this.costOfGoodsSold.beginningInventory} + ${this.costOfGoodsSold.purchases.amount} + ${this.costOfGoodsSold.freightIn} - ${this.costOfGoodsSold.purchaseReturns} - ${this.costOfGoodsSold.purchaseDiscounts} - ${this.costOfGoodsSold.endingInventory}`;
    this.costOfGoodsSold.totalCOGS.calculationMethod = 'inventory_formula';
  }
  
  // Gross Profit = Total Revenue - COGS
  this.grossProfit.amount = this.revenue.totalRevenue.amount - this.costOfGoodsSold.totalCOGS.amount;
  this.grossProfit.margin = this.revenue.totalRevenue.amount !== 0 ? (this.grossProfit.amount / this.revenue.totalRevenue.amount) * 100 : 0;
  this.grossProfit.calculation = `${this.revenue.totalRevenue.amount} - ${this.costOfGoodsSold.totalCOGS.amount}`;
  
  // Total Operating Expenses = Selling Expenses + Administrative Expenses
  this.operatingExpenses.totalOperatingExpenses.amount = 
    this.operatingExpenses.sellingExpenses.total + this.operatingExpenses.administrativeExpenses.total;
  this.operatingExpenses.totalOperatingExpenses.calculation = 
    `${this.operatingExpenses.sellingExpenses.total} + ${this.operatingExpenses.administrativeExpenses.total}`;
  
  // Operating Income = Gross Profit - Total Operating Expenses
  this.operatingIncome.amount = this.grossProfit.amount - this.operatingExpenses.totalOperatingExpenses.amount;
  this.operatingIncome.margin = this.revenue.totalRevenue.amount !== 0 ? (this.operatingIncome.amount / this.revenue.totalRevenue.amount) * 100 : 0;
  this.operatingIncome.calculation = `${this.grossProfit.amount} - ${this.operatingExpenses.totalOperatingExpenses.amount}`;
  
  // Total Other Income
  this.otherIncome.totalOtherIncome.amount = this.otherIncome.interestIncome + 
    this.otherIncome.rentalIncome + this.otherIncome.other.amount;
  this.otherIncome.totalOtherIncome.calculation = 
    `${this.otherIncome.interestIncome} + ${this.otherIncome.rentalIncome} + ${this.otherIncome.other.amount}`;
  
  // Total Other Expenses
  this.otherExpenses.totalOtherExpenses.amount = this.otherExpenses.interestExpense + 
    this.otherExpenses.depreciation + this.otherExpenses.amortization + this.otherExpenses.other.amount;
  this.otherExpenses.totalOtherExpenses.calculation = 
    `${this.otherExpenses.interestExpense} + ${this.otherExpenses.depreciation} + ${this.otherExpenses.amortization} + ${this.otherExpenses.other.amount}`;
  
  // Earnings Before Tax = Operating Income + Total Other Income - Total Other Expenses
  this.earningsBeforeTax.amount = this.operatingIncome.amount + 
    this.otherIncome.totalOtherIncome.amount - this.otherExpenses.totalOtherExpenses.amount;
  this.earningsBeforeTax.calculation = `${this.operatingIncome.amount} + ${this.otherIncome.totalOtherIncome.amount} - ${this.otherExpenses.totalOtherExpenses.amount}`;
  
  // Total Income Tax
  this.incomeTax.total.amount = this.incomeTax.current + this.incomeTax.deferred;
  this.incomeTax.total.rate = this.earningsBeforeTax.amount !== 0 ? (this.incomeTax.total.amount / this.earningsBeforeTax.amount) * 100 : 0;
  
  // Net Income = Earnings Before Tax - Total Income Tax
  this.netIncome.amount = this.earningsBeforeTax.amount - this.incomeTax.total.amount;
  this.netIncome.margin = this.revenue.totalRevenue.amount !== 0 ? (this.netIncome.amount / this.revenue.totalRevenue.amount) * 100 : 0;
  this.netIncome.calculation = `${this.earningsBeforeTax.amount} - ${this.incomeTax.total.amount}`;
  
  // Key Metrics
  this.keyMetrics.grossProfitMargin = this.grossProfit.margin;
  this.keyMetrics.operatingMargin = this.operatingIncome.margin;
  this.keyMetrics.netProfitMargin = this.netIncome.margin;
  this.keyMetrics.ebitda = this.operatingIncome.amount + this.otherExpenses.depreciation + this.otherExpenses.amortization;
};

module.exports = mongoose.model('FinancialStatement', FinancialStatementSchema);
