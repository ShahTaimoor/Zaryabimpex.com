const mongoose = require('mongoose');

const profitShareSchema = new mongoose.Schema({
  // Order Information
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales',
    required: true,
    index: true
  },
  orderNumber: {
    type: String,
    required: true,
    index: true
  },
  orderDate: {
    type: Date,
    required: true
  },
  
  // Product Information
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Financial Details
  saleAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalProfit: {
    type: Number,
    required: true
  },
  
  // Profit Distribution
  investorShare: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  companyShare: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  investorSharePercentage: {
    type: Number,
    default: 30,
    min: 0,
    max: 100
  },
  companySharePercentage: {
    type: Number,
    default: 70,
    min: 0,
    max: 100
  },
  
  // Investor Details (for individual investor tracking)
  investor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investor',
    index: true
  },
  investorName: {
    type: String
  },
  
  // Legacy investors array (for backward compatibility)
  investors: [{
    investor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investor'
    },
    investorName: {
      type: String
    },
    shareAmount: {
      type: Number,
      min: 0
    },
    sharePercentage: {
      type: Number,
      default: 30,
      min: 0,
      max: 100
    }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['calculated', 'distributed', 'cancelled'],
    default: 'calculated'
  },
  
  // Metadata
  calculatedAt: {
    type: Date,
    default: Date.now
  },
  calculatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
profitShareSchema.index({ order: 1, product: 1 });
profitShareSchema.index({ 'investors.investor': 1 });
profitShareSchema.index({ orderDate: -1 });
profitShareSchema.index({ status: 1 });

// Static method to calculate profit share
profitShareSchema.statics.calculateProfitShare = function(saleAmount, totalCost, investorSharePercentage = 30) {
  const totalProfit = saleAmount - totalCost;
  const companySharePercentage = 100 - investorSharePercentage;
  
  return {
    totalProfit,
    investorShare: (totalProfit * investorSharePercentage) / 100,
    companyShare: (totalProfit * companySharePercentage) / 100,
    investorSharePercentage,
    companySharePercentage
  };
};

module.exports = mongoose.model('ProfitShare', profitShareSchema);

