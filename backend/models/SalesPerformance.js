const mongoose = require('mongoose');

const salesPerformanceSchema = new mongoose.Schema({
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
    enum: ['top_products', 'top_customers', 'top_sales_reps', 'comprehensive', 'custom'],
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
    limit: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    },
    includeMetrics: {
      revenue: { type: Boolean, default: true },
      quantity: { type: Boolean, default: true },
      profit: { type: Boolean, default: true },
      margin: { type: Boolean, default: true },
      orders: { type: Boolean, default: true },
      averageOrderValue: { type: Boolean, default: true }
    },
    filters: {
      orderTypes: [String],
      customerTiers: [String],
      businessTypes: [String],
      productCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
      salesReps: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    rankBy: {
      type: String,
      enum: ['revenue', 'profit'],
      default: 'revenue'
    },
    groupBy: {
      type: String,
      enum: ['product', 'customer', 'sales_rep', 'category', 'date'],
      default: 'product'
    }
  },

  // Top Products Data
  topProducts: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    metrics: {
      totalRevenue: { type: Number, default: 0 },
      totalQuantity: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      profit: { type: Number, default: 0 },
      margin: { type: Number, default: 0 },
      costOfGoodsSold: { type: Number, default: 0 }
    },
    trend: {
      previousPeriodRevenue: { type: Number, default: 0 },
      revenueChange: { type: Number, default: 0 },
      revenueChangePercentage: { type: Number, default: 0 },
      quantityChange: { type: Number, default: 0 },
      quantityChangePercentage: { type: Number, default: 0 }
    },
    rank: { type: Number, required: true }
  }],

  // Top Customers Data
  topCustomers: [{
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    metrics: {
      totalRevenue: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      lastOrderDate: { type: Date },
      firstOrderDate: { type: Date },
      averageOrderFrequency: { type: Number, default: 0 },
      totalProfit: { type: Number, default: 0 },
      margin: { type: Number, default: 0 }
    },
    trend: {
      previousPeriodRevenue: { type: Number, default: 0 },
      revenueChange: { type: Number, default: 0 },
      revenueChangePercentage: { type: Number, default: 0 },
      orderCountChange: { type: Number, default: 0 },
      orderCountChangePercentage: { type: Number, default: 0 },
      previousPeriodProfit: { type: Number, default: 0 },
      profitChange: { type: Number, default: 0 },
      profitChangePercentage: { type: Number, default: 0 }
    },
    rank: { type: Number, required: true }
  }],

  // Top Sales Reps Data
  topSalesReps: [{
    salesRep: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    metrics: {
      totalRevenue: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      totalCustomers: { type: Number, default: 0 },
      newCustomers: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 }
    },
    trend: {
      previousPeriodRevenue: { type: Number, default: 0 },
      revenueChange: { type: Number, default: 0 },
      revenueChangePercentage: { type: Number, default: 0 },
      orderCountChange: { type: Number, default: 0 },
      orderCountChangePercentage: { type: Number, default: 0 }
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
      totalRevenue: { type: Number, default: 0 },
      totalQuantity: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      profit: { type: Number, default: 0 },
      margin: { type: Number, default: 0 }
    },
    trend: {
      previousPeriodRevenue: { type: Number, default: 0 },
      revenueChange: { type: Number, default: 0 },
      revenueChangePercentage: { type: Number, default: 0 }
    },
    rank: { type: Number, required: true }
  }],

  // Time Series Data
  timeSeriesData: [{
    date: { type: Date, required: true },
    metrics: {
      totalRevenue: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      totalQuantity: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      newCustomers: { type: Number, default: 0 },
      returningCustomers: { type: Number, default: 0 }
    }
  }],

  // Summary Statistics
  summary: {
    totalRevenue: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    averageMargin: { type: Number, default: 0 },
    totalCustomers: { type: Number, default: 0 },
    newCustomers: { type: Number, default: 0 },
    returningCustomers: { type: Number, default: 0 },
    topProductRevenue: { type: Number, default: 0 },
    topCustomerRevenue: { type: Number, default: 0 },
    topCustomerProfit: { type: Number, default: 0 },
    topSalesRepRevenue: { type: Number, default: 0 }
  },

  // Comparison with Previous Period
  comparison: {
    previousPeriod: {
      startDate: { type: Date },
      endDate: { type: Date },
      totalRevenue: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      totalQuantity: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      totalProfit: { type: Number, default: 0 },
      totalCustomers: { type: Number, default: 0 }
    },
    changes: {
      revenueChange: { type: Number, default: 0 },
      revenueChangePercentage: { type: Number, default: 0 },
      orderChange: { type: Number, default: 0 },
      orderChangePercentage: { type: Number, default: 0 },
      quantityChange: { type: Number, default: 0 },
      quantityChangePercentage: { type: Number, default: 0 },
      aovChange: { type: Number, default: 0 },
      aovChangePercentage: { type: Number, default: 0 },
      profitChange: { type: Number, default: 0 },
      profitChangePercentage: { type: Number, default: 0 },
      customerChange: { type: Number, default: 0 },
      customerChangePercentage: { type: Number, default: 0 }
    }
  },

  // Insights and Recommendations
  insights: [{
    type: {
      type: String,
      enum: ['trend', 'opportunity', 'warning', 'achievement', 'recommendation'],
      required: true
    },
    category: {
      type: String,
      enum: ['product', 'customer', 'sales_rep', 'category', 'overall'],
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
    suggestedActions: [String]
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
salesPerformanceSchema.index({ reportType: 1 });
salesPerformanceSchema.index({ startDate: 1, endDate: 1 });
salesPerformanceSchema.index({ generatedBy: 1 });
salesPerformanceSchema.index({ status: 1 });
salesPerformanceSchema.index({ generatedAt: -1 });
salesPerformanceSchema.index({ 'topProducts.product': 1 });
salesPerformanceSchema.index({ 'topCustomers.customer': 1 });
salesPerformanceSchema.index({ 'topSalesReps.salesRep': 1 });

// Virtual for report duration
salesPerformanceSchema.virtual('duration').get(function() {
  const diffTime = this.endDate - this.startDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for report age
salesPerformanceSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.generatedAt) / (1000 * 60 * 60));
});

// Pre-save middleware to generate report ID
salesPerformanceSchema.pre('save', function(next) {
  if (this.isNew && !this.reportId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.reportId = `SPR-${timestamp}-${random}`;
  }
  next();
});

// Method to mark as viewed
salesPerformanceSchema.methods.markAsViewed = function() {
  this.viewCount += 1;
  this.lastViewedAt = new Date();
  return this.save();
};

// Method to add export record
salesPerformanceSchema.methods.addExport = function(format, exportedBy, fileSize = null, downloadUrl = null) {
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
salesPerformanceSchema.methods.generateInsights = function() {
  const insights = [];

  // Revenue insights
  if (this.comparison.changes.revenueChangePercentage > 10) {
    insights.push({
      type: 'achievement',
      category: 'overall',
      title: 'Strong Revenue Growth',
      description: `Revenue increased by ${this.comparison.changes.revenueChangePercentage.toFixed(1)}% compared to the previous period.`,
      impact: 'high',
      actionable: true,
      suggestedActions: ['Analyze successful strategies', 'Scale successful approaches']
    });
  } else if (this.comparison.changes.revenueChangePercentage < -10) {
    insights.push({
      type: 'warning',
      category: 'overall',
      title: 'Revenue Decline',
      description: `Revenue decreased by ${Math.abs(this.comparison.changes.revenueChangePercentage).toFixed(1)}% compared to the previous period.`,
      impact: 'high',
      actionable: true,
      suggestedActions: ['Review sales strategies', 'Check market conditions', 'Analyze competitor activity']
    });
  }

  // Top product insights
  if (this.topProducts.length > 0) {
    const topProduct = this.topProducts[0];
    if (topProduct.trend.revenueChangePercentage > 20) {
      insights.push({
        type: 'opportunity',
        category: 'product',
        title: 'Top Product Performing Well',
        description: `${topProduct.product.name} shows strong growth with ${topProduct.trend.revenueChangePercentage.toFixed(1)}% revenue increase.`,
        impact: 'medium',
        actionable: true,
        suggestedActions: ['Increase inventory', 'Promote more aggressively', 'Cross-sell related products']
      });
    }
  }

  // Customer insights
  if (this.topCustomers.length > 0) {
    const topCustomer = this.topCustomers[0];
    if (topCustomer.metrics.totalOrders > 10) {
      insights.push({
        type: 'achievement',
        category: 'customer',
        title: 'High-Value Customer',
        description: `${topCustomer.customer.displayName} has placed ${topCustomer.metrics.totalOrders} orders worth $${topCustomer.metrics.totalRevenue.toFixed(2)}.`,
        impact: 'high',
        actionable: true,
        suggestedActions: ['Create loyalty program', 'Offer exclusive deals', 'Assign dedicated account manager']
      });
    }
  }

  // Sales rep insights
  if (this.topSalesReps.length > 0) {
    const topSalesRep = this.topSalesReps[0];
    if (topSalesRep.metrics.conversionRate > 0.8) {
      insights.push({
        type: 'achievement',
        category: 'sales_rep',
        title: 'Excellent Sales Performance',
        description: `${topSalesRep.salesRep.firstName} ${topSalesRep.salesRep.lastName} has a conversion rate of ${(topSalesRep.metrics.conversionRate * 100).toFixed(1)}%.`,
        impact: 'high',
        actionable: true,
        suggestedActions: ['Share best practices with team', 'Consider promotion', 'Create training program based on their methods']
      });
    }
  }

  this.insights = insights;
  return insights;
};

// Static method to get report statistics
salesPerformanceSchema.statics.getReportStats = async function(period = {}) {
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

module.exports = mongoose.model('SalesPerformance', salesPerformanceSchema);
