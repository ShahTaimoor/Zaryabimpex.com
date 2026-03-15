const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema({
  // Bank Account Information
  accountName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  accountNumber: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  bankName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  branchName: {
    type: String,
    trim: true,
    maxlength: 200
  },
  branchAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'US'
    }
  },
  
  // Account Type
  accountType: {
    type: String,
    enum: ['checking', 'savings', 'current', 'other'],
    default: 'checking'
  },
  
  // Account Details
  routingNumber: {
    type: String,
    trim: true,
    maxlength: 50
  },
  swiftCode: {
    type: String,
    trim: true,
    maxlength: 50
  },
  iban: {
    type: String,
    trim: true,
    maxlength: 50
  },
  
  // Balance Information
  openingBalance: {
    type: Number,
    default: 0
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Additional Information
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Virtual for display name
bankSchema.virtual('displayName').get(function() {
  return `${this.bankName} - ${this.accountNumber}${this.accountName ? ` (${this.accountName})` : ''}`;
});

// Index for better query performance
bankSchema.index({ bankName: 1, accountNumber: 1 });
bankSchema.index({ isActive: 1 });

module.exports = mongoose.model('Bank', bankSchema);

