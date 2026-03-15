const mongoose = require('mongoose');

const balanceSheetSchema = new mongoose.Schema({
  statementNumber: {
    type: String,
    unique: true,
    required: true
  },
  statementDate: {
    type: Date,
    required: true
  },
  periodType: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    required: true,
    default: 'monthly'
  },
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'final'],
    default: 'draft'
  },
  
  // ASSETS
  assets: {
    currentAssets: {
      cashAndCashEquivalents: {
        cashOnHand: { type: Number, default: 0 },
        bankAccounts: { type: Number, default: 0 },
        pettyCash: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
      },
      accountsReceivable: {
        tradeReceivables: { type: Number, default: 0 },
        otherReceivables: { type: Number, default: 0 },
        allowanceForDoubtfulAccounts: { type: Number, default: 0 },
        netReceivables: { type: Number, default: 0 }
      },
      inventory: {
        rawMaterials: { type: Number, default: 0 },
        workInProgress: { type: Number, default: 0 },
        finishedGoods: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
      },
      prepaidExpenses: { type: Number, default: 0 },
      otherCurrentAssets: { type: Number, default: 0 },
      totalCurrentAssets: { type: Number, default: 0 }
    },
    fixedAssets: {
      propertyPlantEquipment: {
        land: { type: Number, default: 0 },
        buildings: { type: Number, default: 0 },
        equipment: { type: Number, default: 0 },
        vehicles: { type: Number, default: 0 },
        furnitureAndFixtures: { type: Number, default: 0 },
        computerEquipment: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
      },
      accumulatedDepreciation: { type: Number, default: 0 },
      netPropertyPlantEquipment: { type: Number, default: 0 },
      intangibleAssets: {
        goodwill: { type: Number, default: 0 },
        patents: { type: Number, default: 0 },
        trademarks: { type: Number, default: 0 },
        software: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
      },
      longTermInvestments: { type: Number, default: 0 },
      otherAssets: { type: Number, default: 0 },
      totalFixedAssets: { type: Number, default: 0 }
    },
    totalAssets: { type: Number, default: 0 }
  },

  // LIABILITIES
  liabilities: {
    currentLiabilities: {
      accountsPayable: {
        tradePayables: { type: Number, default: 0 },
        otherPayables: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
      },
      accruedExpenses: {
        salariesPayable: { type: Number, default: 0 },
        utilitiesPayable: { type: Number, default: 0 },
        rentPayable: { type: Number, default: 0 },
        taxesPayable: { type: Number, default: 0 },
        interestPayable: { type: Number, default: 0 },
        otherAccruedExpenses: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
      },
      shortTermDebt: {
        creditLines: { type: Number, default: 0 },
        shortTermLoans: { type: Number, default: 0 },
        creditCardDebt: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
      },
      deferredRevenue: { type: Number, default: 0 },
      otherCurrentLiabilities: { type: Number, default: 0 },
      totalCurrentLiabilities: { type: Number, default: 0 }
    },
    longTermLiabilities: {
      longTermDebt: {
        mortgages: { type: Number, default: 0 },
        longTermLoans: { type: Number, default: 0 },
        bondsPayable: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
      },
      deferredTaxLiabilities: { type: Number, default: 0 },
      pensionLiabilities: { type: Number, default: 0 },
      otherLongTermLiabilities: { type: Number, default: 0 },
      totalLongTermLiabilities: { type: Number, default: 0 }
    },
    totalLiabilities: { type: Number, default: 0 }
  },

  // EQUITY
  equity: {
    contributedCapital: {
      commonStock: { type: Number, default: 0 },
      preferredStock: { type: Number, default: 0 },
      additionalPaidInCapital: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    retainedEarnings: {
      beginningRetainedEarnings: { type: Number, default: 0 },
      currentPeriodEarnings: { type: Number, default: 0 },
      dividendsPaid: { type: Number, default: 0 },
      endingRetainedEarnings: { type: Number, default: 0 }
    },
    otherEquity: {
      treasuryStock: { type: Number, default: 0 },
      accumulatedOtherComprehensiveIncome: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    totalEquity: { type: Number, default: 0 }
  },

  // Key Ratios and Metrics
  financialRatios: {
    liquidity: {
      currentRatio: { type: Number, default: 0 },
      quickRatio: { type: Number, default: 0 },
      cashRatio: { type: Number, default: 0 }
    },
    leverage: {
      debtToEquityRatio: { type: Number, default: 0 },
      debtToAssetRatio: { type: Number, default: 0 },
      equityRatio: { type: Number, default: 0 }
    },
    efficiency: {
      inventoryTurnover: { type: Number, default: 0 },
      receivablesTurnover: { type: Number, default: 0 },
      assetTurnover: { type: Number, default: 0 }
    }
  },

  // Metadata
  metadata: {
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    generatedAt: {
      type: Date,
      default: Date.now
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    notes: String,
    version: {
      type: Number,
      default: 1
    },
    previousVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BalanceSheet'
    },
    tags: [String],
    isComparative: {
      type: Boolean,
      default: false
    },
    comparativeData: {
      previousPeriod: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BalanceSheet'
      },
      percentageChange: mongoose.Schema.Types.Mixed
    }
  },

  // Audit Trail
  auditTrail: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'approved', 'rejected', 'exported', 'viewed']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: String,
    changes: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
balanceSheetSchema.index({ statementDate: -1 });
balanceSheetSchema.index({ statementNumber: 1 });
balanceSheetSchema.index({ status: 1 });
balanceSheetSchema.index({ periodType: 1 });
balanceSheetSchema.index({ 'metadata.generatedBy': 1 });

// Virtual for statement age
balanceSheetSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for total assets = total liabilities + total equity
balanceSheetSchema.virtual('isBalanced').get(function() {
  const tolerance = 0.01; // Allow for small rounding differences
  const difference = Math.abs(this.assets.totalAssets - (this.liabilities.totalLiabilities + this.equity.totalEquity));
  return difference <= tolerance;
});

// Pre-save middleware to calculate totals and ratios
balanceSheetSchema.pre('save', function(next) {
  // Skip all calculations since they are already done in the service
  // This prevents validation errors from the pre-save middleware
  next();
});
    if (this.assets.currentAssets.cashAndCashEquivalents) {
      this.assets.currentAssets.cashAndCashEquivalents.total = 
        (this.assets.currentAssets.cashAndCashEquivalents.cashOnHand || 0) +
        (this.assets.currentAssets.cashAndCashEquivalents.bankAccounts || 0) +
        (this.assets.currentAssets.cashAndCashEquivalents.pettyCash || 0);
    }

    if (this.assets.currentAssets.accountsReceivable) {
      this.assets.currentAssets.accountsReceivable.netReceivables = 
        (this.assets.currentAssets.accountsReceivable.tradeReceivables || 0) +
        (this.assets.currentAssets.accountsReceivable.otherReceivables || 0) -
        (this.assets.currentAssets.accountsReceivable.allowanceForDoubtfulAccounts || 0);
    }

    if (this.assets.currentAssets.inventory) {
      this.assets.currentAssets.inventory.total = 
        (this.assets.currentAssets.inventory.rawMaterials || 0) +
        (this.assets.currentAssets.inventory.workInProgress || 0) +
        (this.assets.currentAssets.inventory.finishedGoods || 0);
    }

    this.assets.currentAssets.totalCurrentAssets = 
      (this.assets.currentAssets.cashAndCashEquivalents?.total || 0) +
      (this.assets.currentAssets.accountsReceivable?.netReceivables || 0) +
      (this.assets.currentAssets.inventory?.total || 0) +
      (this.assets.currentAssets.prepaidExpenses || 0) +
      (this.assets.currentAssets.otherCurrentAssets || 0);

  // Calculate fixed assets totals
  this.assets.fixedAssets.propertyPlantEquipment.total = 
    this.assets.fixedAssets.propertyPlantEquipment.land +
    this.assets.fixedAssets.propertyPlantEquipment.buildings +
    this.assets.fixedAssets.propertyPlantEquipment.equipment +
    this.assets.fixedAssets.propertyPlantEquipment.vehicles +
    this.assets.fixedAssets.propertyPlantEquipment.furnitureAndFixtures +
    this.assets.fixedAssets.propertyPlantEquipment.computerEquipment;

  this.assets.fixedAssets.netPropertyPlantEquipment = 
    this.assets.fixedAssets.propertyPlantEquipment.total -
    this.assets.fixedAssets.accumulatedDepreciation;

  this.assets.fixedAssets.intangibleAssets.total = 
    this.assets.fixedAssets.intangibleAssets.goodwill +
    this.assets.fixedAssets.intangibleAssets.patents +
    this.assets.fixedAssets.intangibleAssets.trademarks +
    this.assets.fixedAssets.intangibleAssets.software;

  this.assets.fixedAssets.totalFixedAssets = 
    this.assets.fixedAssets.netPropertyPlantEquipment +
    this.assets.fixedAssets.intangibleAssets.total +
    this.assets.fixedAssets.longTermInvestments +
    this.assets.fixedAssets.otherAssets;

  // Calculate total assets
  this.assets.totalAssets = 
    this.assets.currentAssets.totalCurrentAssets +
    this.assets.fixedAssets.totalFixedAssets;

  // Calculate current liabilities totals
  this.liabilities.currentLiabilities.accountsPayable.total = 
    this.liabilities.currentLiabilities.accountsPayable.tradePayables +
    this.liabilities.currentLiabilities.accountsPayable.otherPayables;

  this.liabilities.currentLiabilities.accruedExpenses.total = 
    this.liabilities.currentLiabilities.accruedExpenses.salariesPayable +
    this.liabilities.currentLiabilities.accruedExpenses.utilitiesPayable +
    this.liabilities.currentLiabilities.accruedExpenses.rentPayable +
    this.liabilities.currentLiabilities.accruedExpenses.taxesPayable +
    this.liabilities.currentLiabilities.accruedExpenses.interestPayable +
    this.liabilities.currentLiabilities.accruedExpenses.otherAccruedExpenses;

  this.liabilities.currentLiabilities.shortTermDebt.total = 
    this.liabilities.currentLiabilities.shortTermDebt.creditLines +
    this.liabilities.currentLiabilities.shortTermDebt.shortTermLoans +
    this.liabilities.currentLiabilities.shortTermDebt.creditCardDebt;

  this.liabilities.currentLiabilities.totalCurrentLiabilities = 
    this.liabilities.currentLiabilities.accountsPayable.total +
    this.liabilities.currentLiabilities.accruedExpenses.total +
    this.liabilities.currentLiabilities.shortTermDebt.total +
    this.liabilities.currentLiabilities.deferredRevenue +
    this.liabilities.currentLiabilities.otherCurrentLiabilities;

  // Calculate long-term liabilities totals
  this.liabilities.longTermLiabilities.longTermDebt.total = 
    this.liabilities.longTermLiabilities.longTermDebt.mortgages +
    this.liabilities.longTermLiabilities.longTermDebt.longTermLoans +
    this.liabilities.longTermLiabilities.longTermDebt.bondsPayable;

  this.liabilities.longTermLiabilities.totalLongTermLiabilities = 
    this.liabilities.longTermLiabilities.longTermDebt.total +
    this.liabilities.longTermLiabilities.deferredTaxLiabilities +
    this.liabilities.longTermLiabilities.pensionLiabilities +
    this.liabilities.longTermLiabilities.otherLongTermLiabilities;

  // Calculate total liabilities
  this.liabilities.totalLiabilities = 
    this.liabilities.currentLiabilities.totalCurrentLiabilities +
    this.liabilities.longTermLiabilities.totalLongTermLiabilities;

  // Calculate equity totals
  this.equity.contributedCapital.total = 
    this.equity.contributedCapital.commonStock +
    this.equity.contributedCapital.preferredStock +
    this.equity.contributedCapital.additionalPaidInCapital;

  this.equity.retainedEarnings.endingRetainedEarnings = 
    this.equity.retainedEarnings.beginningRetainedEarnings +
    this.equity.retainedEarnings.currentPeriodEarnings -
    this.equity.retainedEarnings.dividendsPaid;

  this.equity.otherEquity.total = 
    this.equity.otherEquity.treasuryStock +
    this.equity.otherEquity.accumulatedOtherComprehensiveIncome;

  this.equity.totalEquity = 
    this.equity.contributedCapital.total +
    this.equity.retainedEarnings.endingRetainedEarnings +
    this.equity.otherEquity.total;

  // Calculate financial ratios
  if (this.liabilities.currentLiabilities.totalCurrentLiabilities > 0) {
    this.financialRatios.liquidity.currentRatio = 
      this.assets.currentAssets.totalCurrentAssets / this.liabilities.currentLiabilities.totalCurrentLiabilities;
    
    const quickAssets = this.assets.currentAssets.totalCurrentAssets - this.assets.currentAssets.inventory.total;
    this.financialRatios.liquidity.quickRatio = 
      quickAssets / this.liabilities.currentLiabilities.totalCurrentLiabilities;
    
    this.financialRatios.liquidity.cashRatio = 
      this.assets.currentAssets.cashAndCashEquivalents.total / this.liabilities.currentLiabilities.totalCurrentLiabilities;
  }

  if (this.equity.totalEquity > 0) {
    this.financialRatios.leverage.debtToEquityRatio = 
      this.liabilities.totalLiabilities / this.equity.totalEquity;
  }

  if (this.assets.totalAssets > 0) {
    this.financialRatios.leverage.debtToAssetRatio = 
      this.liabilities.totalLiabilities / this.assets.totalAssets;
    
    this.financialRatios.leverage.equityRatio = 
      this.equity.totalEquity / this.assets.totalAssets;
  }

  next();
});

// Method to add audit trail entry
balanceSheetSchema.methods.addAuditEntry = function(action, performedBy, details = '', changes = null) {
  this.auditTrail.push({
    action,
    performedBy,
    details,
    changes,
    performedAt: new Date()
  });
  return this.save();
};

// Static method to get balance sheet statistics
balanceSheetSchema.statics.getBalanceSheetStats = async function(period = {}) {
  const match = {};
  
  if (period.startDate && period.endDate) {
    match.statementDate = {
      $gte: period.startDate,
      $lte: period.endDate
    };
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalStatements: { $sum: 1 },
        averageTotalAssets: { $avg: '$assets.totalAssets' },
        averageTotalLiabilities: { $avg: '$liabilities.totalLiabilities' },
        averageTotalEquity: { $avg: '$equity.totalEquity' },
        byStatus: { $push: '$status' },
        byPeriodType: { $push: '$periodType' }
      }
    },
    {
      $project: {
        totalStatements: 1,
        averageTotalAssets: { $round: ['$averageTotalAssets', 2] },
        averageTotalLiabilities: { $round: ['$averageTotalLiabilities', 2] },
        averageTotalEquity: { $round: ['$averageTotalEquity', 2] },
        statusBreakdown: {
          $reduce: {
            input: '$byStatus',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $let: {
                    vars: { status: '$$this' },
                    in: { $arrayToObject: [{ k: '$$status', v: { $add: [{ $ifNull: [{ $getField: { field: '$$status', input: '$$value' } }, 0] }, 1] } }] }
                  }
                }
              ]
            }
          }
        },
        periodTypeBreakdown: {
          $reduce: {
            input: '$byPeriodType',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $let: {
                    vars: { type: '$$this' },
                    in: { $arrayToObject: [{ k: '$$type', v: { $add: [{ $ifNull: [{ $getField: { field: '$$type', input: '$$value' } }, 0] }, 1] } }] }
                  }
                }
              ]
            }
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalStatements: 0,
    averageTotalAssets: 0,
    averageTotalLiabilities: 0,
    averageTotalEquity: 0,
    statusBreakdown: {},
    periodTypeBreakdown: {}
  };
};

module.exports = mongoose.model('BalanceSheet', balanceSheetSchema);
