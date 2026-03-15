const mongoose = require('mongoose');

const inventoryReportSchema = new mongoose.Schema({
  // Report Identification
  reportId: {
    type: String,
    unique: true,
    required: true
  },
  reportName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  reportType: {
    type: String,
    enum: ['stock_levels', 'turnover_rates', 'aging_analysis', 'comprehensive', 'custom'],
    required: true
  },
  
  // Time Period
  periodType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  
  // Report Configuration
  config: {
    includeMetrics: {
      stockLevels: { type: Boolean, default: true },
      turnoverRates: { type: Boolean, default: true },
      agingAnalysis: { type: Boolean, default: true },
      reorderPoints: { type: Boolean, default: true },
      costAnalysis: { type: Boolean, default: true },
      profitMargins: { type: Boolean, default: true }
    },
    filters: {
      categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
      suppliers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }],
      stockStatus: [String], // ['in_stock', 'low_stock', 'out_of_stock', 'overstocked']
      turnoverRanges: [String], // ['fast', 'medium', 'slow', 'dead']
      agingRanges: [String] // ['new', 'aging', 'old', 'very_old']
    },
    thresholds: {
      lowStockThreshold: { type: Number, default: 10 },
      overstockThreshold: { type: Number, default: 100 },
      fastTurnoverThreshold: { type: Number, default: 12 }, // times per year
      slowTurnoverThreshold: { type: Number, default: 4 }, // times per year
      agingThreshold: { type: Number, default: 90 }, // days
      oldThreshold: { type: Number, default: 180 }, // days
      veryOldThreshold: { type: Number, default: 365 } // days
    }
  },

  // Stock Levels Data
  stockLevels: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    metrics: {
      currentStock: { type: Number, default: 0 },
      minStock: { type: Number, default: 0 },
      maxStock: { type: Number, default: 0 },
      reorderPoint: { type: Number, default: 0 },
      reorderQuantity: { type: Number, default: 0 },
      stockValue: { type: Number, default: 0 },
      stockStatus: { type: String, enum: ['in_stock', 'low_stock', 'out_of_stock', 'overstocked'] }
    },
    trend: {
      previousStock: { type: Number, default: 0 },
      stockChange: { type: Number, default: 0 },
      stockChangePercentage: { type: Number, default: 0 },
      daysInStock: { type: Number, default: 0 }
    },
    rank: { type: Number, required: true }
  }],

  // Turnover Rates Data
  turnoverRates: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    metrics: {
      turnoverRate: { type: Number, default: 0 }, // times per year
      totalSold: { type: Number, default: 0 },
      averageStock: { type: Number, default: 0 },
      daysToSell: { type: Number, default: 0 },
      turnoverCategory: { type: String, enum: ['fast', 'medium', 'slow', 'dead'] }
    },
    trend: {
      previousTurnoverRate: { type: Number, default: 0 },
      turnoverChange: { type: Number, default: 0 },
      turnoverChangePercentage: { type: Number, default: 0 }
    },
    rank: { type: Number, required: true }
  }],

  // Aging Analysis Data
  agingAnalysis: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    metrics: {
      daysInStock: { type: Number, default: 0 },
      lastSoldDate: { type: Date },
      agingCategory: { type: String, enum: ['new', 'aging', 'old', 'very_old'] },
      stockValue: { type: Number, default: 0 },
      potentialLoss: { type: Number, default: 0 }
    },
    trend: {
      previousDaysInStock: { type: Number, default: 0 },
      agingChange: { type: Number, default: 0 },
      agingChangePercentage: { type: Number, default: 0 }
    },
    rank: { type: Number, required: true }
  }],

  // Category Performance
  categoryPerformance: [{
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    metrics: {
      totalProducts: { type: Number, default: 0 },
      totalStockValue: { type: Number, default: 0 },
      averageTurnoverRate: { type: Number, default: 0 },
      lowStockProducts: { type: Number, default: 0 },
      outOfStockProducts: { type: Number, default: 0 },
      overstockedProducts: { type: Number, default: 0 }
    },
    trend: {
      previousStockValue: { type: Number, default: 0 },
      stockValueChange: { type: Number, default: 0 },
      stockValueChangePercentage: { type: Number, default: 0 }
    },
    rank: { type: Number, required: true }
  }],

  // Supplier Performance
  supplierPerformance: [{
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true
    },
    metrics: {
      totalProducts: { type: Number, default: 0 },
      totalStockValue: { type: Number, default: 0 },
      averageTurnoverRate: { type: Number, default: 0 },
      lowStockProducts: { type: Number, default: 0 },
      outOfStockProducts: { type: Number, default: 0 },
      averageLeadTime: { type: Number, default: 0 }
    },
    trend: {
      previousStockValue: { type: Number, default: 0 },
      stockValueChange: { type: Number, default: 0 },
      stockValueChangePercentage: { type: Number, default: 0 }
    },
    rank: { type: Number, required: true }
  }],

  // Summary Statistics
  summary: {
    totalProducts: { type: Number, default: 0 },
    totalStockValue: { type: Number, default: 0 },
    averageTurnoverRate: { type: Number, default: 0 },
    lowStockProducts: { type: Number, default: 0 },
    outOfStockProducts: { type: Number, default: 0 },
    overstockedProducts: { type: Number, default: 0 },
    fastMovingProducts: { type: Number, default: 0 },
    slowMovingProducts: { type: Number, default: 0 },
    deadStockProducts: { type: Number, default: 0 },
    agingProducts: { type: Number, default: 0 },
    oldProducts: { type: Number, default: 0 },
    veryOldProducts: { type: Number, default: 0 },
    totalPotentialLoss: { type: Number, default: 0 }
  },

  // Comparison with Previous Period
  comparison: {
    previousPeriod: {
      startDate: { type: Date },
      endDate: { type: Date },
      totalProducts: { type: Number, default: 0 },
      totalStockValue: { type: Number, default: 0 },
      averageTurnoverRate: { type: Number, default: 0 },
      lowStockProducts: { type: Number, default: 0 },
      outOfStockProducts: { type: Number, default: 0 }
    },
    changes: {
      productChange: { type: Number, default: 0 },
      productChangePercentage: { type: Number, default: 0 },
      stockValueChange: { type: Number, default: 0 },
      stockValueChangePercentage: { type: Number, default: 0 },
      turnoverChange: { type: Number, default: 0 },
      turnoverChangePercentage: { type: Number, default: 0 },
      lowStockChange: { type: Number, default: 0 },
      lowStockChangePercentage: { type: Number, default: 0 },
      outOfStockChange: { type: Number, default: 0 },
      outOfStockChangePercentage: { type: Number, default: 0 }
    }
  },

  // Insights and Recommendations
  insights: [{
    type: {
      type: String,
      enum: ['warning', 'opportunity', 'achievement', 'recommendation', 'alert'],
      required: true
    },
    category: {
      type: String,
      enum: ['stock_levels', 'turnover', 'aging', 'category', 'supplier', 'overall'],
      required: true
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    impact: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    actionable: { type: Boolean, default: false },
    suggestedActions: [String],
    affectedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  }],

  // Metadata
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed', 'archived'],
    default: 'generating'
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  lastViewedAt: {
    type: Date,
    default: Date.now
  },
  viewCount: {
    type: Number,
    default: 0
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  tags: [String],
  notes: String,

  // Export Information
  exports: [{
    format: {
      type: String,
      enum: ['pdf', 'excel', 'csv', 'json'],
      required: true
    },
    exportedAt: {
      type: Date,
      default: Date.now
    },
    exportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    fileSize: { type: Number },
    downloadUrl: { type: String }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
// reportId index removed - already has unique: true in field definition
inventoryReportSchema.index({ reportType: 1 });
inventoryReportSchema.index({ startDate: 1, endDate: 1 });
inventoryReportSchema.index({ generatedBy: 1 });
inventoryReportSchema.index({ status: 1 });
inventoryReportSchema.index({ generatedAt: -1 });
inventoryReportSchema.index({ 'stockLevels.product': 1 });
inventoryReportSchema.index({ 'turnoverRates.product': 1 });
inventoryReportSchema.index({ 'agingAnalysis.product': 1 });

// Virtual for report duration
inventoryReportSchema.virtual('duration').get(function() {
  const diffTime = this.endDate - this.startDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for report age
inventoryReportSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.generatedAt) / (1000 * 60 * 60));
});

// Pre-save middleware to generate report ID
inventoryReportSchema.pre('save', function(next) {
  if (this.isNew && !this.reportId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.reportId = `INR-${timestamp}-${random}`;
  }
  next();
});

// Method to mark as viewed
inventoryReportSchema.methods.markAsViewed = function() {
  this.viewCount += 1;
  this.lastViewedAt = new Date();
  return this.save();
};

// Method to add export record
inventoryReportSchema.methods.addExport = function(format, exportedBy, fileSize = null, downloadUrl = null) {
  this.exports.push({
    format,
    exportedBy,
    fileSize,
    downloadUrl,
    exportedAt: new Date()
  });
  return this.save();
};

// Method to generate insights
inventoryReportSchema.methods.generateInsights = function() {
  const insights = [];

  // Stock level insights
  if (this.summary.lowStockProducts > 0) {
    insights.push({
      type: 'warning',
      category: 'stock_levels',
      title: 'Low Stock Alert',
      description: `${this.summary.lowStockProducts} products are below reorder point and need immediate attention.`,
      impact: 'high',
      actionable: true,
      suggestedActions: ['Review reorder points', 'Place purchase orders', 'Check supplier lead times']
    });
  }

  if (this.summary.outOfStockProducts > 0) {
    insights.push({
      type: 'alert',
      category: 'stock_levels',
      title: 'Out of Stock Alert',
      description: `${this.summary.outOfStockProducts} products are completely out of stock.`,
      impact: 'high',
      actionable: true,
      suggestedActions: ['Emergency reorder', 'Check alternative suppliers', 'Update product availability']
    });
  }

  if (this.summary.overstockedProducts > 0) {
    insights.push({
      type: 'warning',
      category: 'stock_levels',
      title: 'Overstocked Products',
      description: `${this.summary.overstockedProducts} products are overstocked and tying up capital.`,
      impact: 'medium',
      actionable: true,
      suggestedActions: ['Run promotions', 'Bundle with other products', 'Review reorder quantities']
    });
  }

  // Turnover insights
  if (this.summary.slowMovingProducts > 0) {
    insights.push({
      type: 'opportunity',
      category: 'turnover',
      title: 'Slow Moving Inventory',
      description: `${this.summary.slowMovingProducts} products have slow turnover rates.`,
      impact: 'medium',
      actionable: true,
      suggestedActions: ['Review pricing strategy', 'Improve product placement', 'Consider bundling']
    });
  }

  if (this.summary.deadStockProducts > 0) {
    insights.push({
      type: 'alert',
      category: 'turnover',
      title: 'Dead Stock Alert',
      description: `${this.summary.deadStockProducts} products have no movement and may be obsolete.`,
      impact: 'high',
      actionable: true,
      suggestedActions: ['Liquidate inventory', 'Donate to charity', 'Write off as loss']
    });
  }

  // Aging insights
  if (this.summary.veryOldProducts > 0) {
    insights.push({
      type: 'alert',
      category: 'aging',
      title: 'Very Old Inventory',
      description: `${this.summary.veryOldProducts} products have been in stock for over a year.`,
      impact: 'high',
      actionable: true,
      suggestedActions: ['Liquidate immediately', 'Check for damage', 'Review supplier terms']
    });
  }

  if (this.summary.totalPotentialLoss > 0) {
    insights.push({
      type: 'warning',
      category: 'overall',
      title: 'Potential Loss Risk',
      description: `Potential loss of $${this.summary.totalPotentialLoss.toFixed(2)} from aging and dead stock.`,
      impact: 'high',
      actionable: true,
      suggestedActions: ['Implement FIFO system', 'Review aging policies', 'Set up automated alerts']
    });
  }

  // Positive insights
  if (this.summary.fastMovingProducts > 0) {
    insights.push({
      type: 'achievement',
      category: 'turnover',
      title: 'Fast Moving Products',
      description: `${this.summary.fastMovingProducts} products have excellent turnover rates.`,
      impact: 'medium',
      actionable: true,
      suggestedActions: ['Increase stock levels', 'Expand product line', 'Use as loss leaders']
    });
  }

  this.insights = insights;
  return insights;
};

// Static method to get report statistics
inventoryReportSchema.statics.getReportStats = async function(period = {}) {
  const match = {};
  
  if (period.startDate && period.endDate) {
    match.generatedAt = {
      $gte: period.startDate,
      $lte: period.endDate
    };
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalReports: { $sum: 1 },
        completedReports: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalViews: { $sum: '$viewCount' },
        byType: { $push: '$reportType' },
        byPeriod: { $push: '$periodType' }
      }
    },
    {
      $project: {
        totalReports: 1,
        completedReports: 1,
        totalViews: 1,
        typeBreakdown: {
          $reduce: {
            input: '$byType',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [{ k: '$$this', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] } }]
                  ]
                }
              ]
            }
          }
        },
        periodBreakdown: {
          $reduce: {
            input: '$byPeriod',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [{ k: '$$this', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] } }]
                  ]
                }
              ]
            }
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalReports: 0,
    completedReports: 0,
    totalViews: 0,
    typeBreakdown: {},
    periodBreakdown: {}
  };
};

module.exports = mongoose.model('InventoryReport', inventoryReportSchema);
