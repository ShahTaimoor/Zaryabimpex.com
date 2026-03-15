const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  // Transaction identification
  transactionId: {
    type: String,
    required: true,
    unique: true
  },

  // Order reference (optional for expense transactions)
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales',
    required: false
  },

  // Payment reference
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },

  // Transaction type
  type: {
    type: String,
    required: true,
    enum: ['sale', 'purchase', 'refund', 'purchase_return', 'void', 'adjustment', 'tip', 'discount', 'opening_balance', 'accounting']
  },

  // Transaction amount
  amount: {
    type: Number,
    required: true
  },

  // Accounting entries (for double-entry bookkeeping)
  accountCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  debitAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  creditAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  reference: {
    type: String,
    trim: true
  },

  // Currency
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },

  // Transaction status
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'declined'],
    default: 'pending'
  },

  // Payment method (optional for accounting entries)
  paymentMethod: {
    type: String,
    required: false,
    enum: ['cash', 'credit_card', 'debit_card', 'digital_wallet', 'bank_transfer', 'check', 'gift_card', 'store_credit', 'account', 'other']
  },

  // Gateway information
  gateway: {
    name: {
      type: String,
      enum: ['stripe', 'paypal', 'square', 'authorize_net', 'manual', 'offline']
    },
    transactionId: String,
    gatewayResponse: mongoose.Schema.Types.Mixed,
    processingFee: {
      type: Number,
      default: 0
    }
  },

  // Card details (for card transactions)
  cardDetails: {
    last4: String,
    brand: String,
    expiryMonth: Number,
    expiryYear: Number,
    holderName: String,
    token: String // Encrypted token
  },

  // Digital wallet details
  walletDetails: {
    provider: String,
    walletId: String,
    deviceInfo: mongoose.Schema.Types.Mixed
  },

  // Processing details
  processing: {
    initiatedAt: Date,
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    processingTime: Number, // in milliseconds
    retryCount: {
      type: Number,
      default: 0
    },
    errorCode: String,
    errorMessage: String
  },

  // Customer information
  customer: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    },
    email: String,
    phone: String
  },

  // Supplier reference (for AP and purchase-related transactions)
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },

  // User who created the transaction
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Terminal information
  terminal: {
    id: String,
    location: String,
    version: String
  },

  // Security and fraud prevention
  security: {
    ipAddress: String,
    userAgent: String,
    riskScore: Number,
    fraudCheck: {
      passed: Boolean,
      details: mongoose.Schema.Types.Mixed,
      provider: String
    },
    encryption: {
      algorithm: String,
      keyId: String
    }
  },

  // Additional data
  metadata: {
    receiptNumber: String,
    reference: String,
    notes: String,
    tags: [String]
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
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

// Indexes for performance
// transactionId index removed - already has unique: true in field definition
TransactionSchema.index({ orderId: 1 });
TransactionSchema.index({ paymentId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ paymentMethod: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ 'gateway.transactionId': 1 });
TransactionSchema.index({ accountCode: 1, createdAt: -1 });
TransactionSchema.index({ accountCode: 1, status: 1, createdAt: -1 });
TransactionSchema.index({ supplier: 1, createdAt: -1 });
TransactionSchema.index({ description: 'text', reference: 'text' });

// Pre-save middleware
TransactionSchema.pre('save', function (next) {
  // Update processing time if completed
  if (this.status === 'completed' && this.processing.processedAt && this.processing.initiatedAt) {
    this.processing.processingTime = this.processing.processedAt.getTime() - this.processing.initiatedAt.getTime();
  }

  // Update updatedAt
  this.updatedAt = new Date();

  next();
});

// Static methods
TransactionSchema.statics.findByOrderId = function (orderId) {
  return this.find({ orderId }).sort({ createdAt: -1 });
};

TransactionSchema.statics.findByPaymentId = function (paymentId) {
  return this.find({ paymentId }).sort({ createdAt: -1 });
};

TransactionSchema.statics.findByStatus = function (status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

TransactionSchema.statics.getTransactionStats = function (startDate, endDate) {
  const match = {};
  if (startDate && endDate) {
    match.createdAt = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          status: '$status',
          paymentMethod: '$paymentMethod',
          type: '$type'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' },
        totalFees: { $sum: '$gateway.processingFee' }
      }
    }
  ]);
};

// Instance methods
TransactionSchema.methods.isSuccessful = function () {
  return this.status === 'completed';
};

TransactionSchema.methods.isPending = function () {
  return this.status === 'pending' || this.status === 'processing';
};

TransactionSchema.methods.canVoid = function () {
  return this.status === 'completed' && this.type === 'sale';
};

TransactionSchema.methods.canRefund = function () {
  return this.status === 'completed' && (this.type === 'sale' || this.type === 'tip');
};

TransactionSchema.methods.void = function (processedBy, reason) {
  if (!this.canVoid()) {
    throw new Error('Transaction cannot be voided');
  }

  this.status = 'cancelled';
  this.metadata.notes = reason || 'Transaction voided';
  this.processing.processedBy = processedBy;
  this.processing.processedAt = new Date();

  return this.save();
};

module.exports = mongoose.model('Transaction', TransactionSchema);
