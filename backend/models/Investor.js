const mongoose = require('mongoose');

const investorSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  
  // Investment Information
  totalInvestment: {
    type: Number,
    default: 0,
    min: 0
  },
  defaultProfitSharePercentage: {
    type: Number,
    default: 30,
    min: 0,
    max: 100
  },
  totalEarnedProfit: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPaidOut: {
    type: Number,
    default: 0,
    min: 0
  },
  currentBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Notes
  notes: {
    type: String,
    maxlength: 1000
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Soft Delete Fields
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
// email index removed - already has unique: true in field definition
investorSchema.index({ status: 1 });
investorSchema.index({ createdAt: -1 });

// Virtual to calculate outstanding balance
investorSchema.virtual('outstandingBalance').get(function() {
  return Math.max(0, this.totalEarnedProfit - this.totalPaidOut);
});

// Method to update earned profit
investorSchema.methods.addProfit = async function(amount) {
  this.totalEarnedProfit += amount;
  this.currentBalance = this.outstandingBalance;
  await this.save();
  return this;
};

// Method to record payout
investorSchema.methods.recordPayout = async function(amount) {
  this.totalPaidOut += amount;
  this.currentBalance = this.outstandingBalance;
  await this.save();
  return this;
};

// Method to record new investment or additional investment
investorSchema.methods.recordInvestment = async function(amount) {
  this.totalInvestment += amount;
  await this.save();
  return this;
};

module.exports = mongoose.model('Investor', investorSchema);

