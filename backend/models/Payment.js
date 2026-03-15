const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  // Payment identification
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Order reference
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales',
    required: true
  },
  
  // Payment method details
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'credit_card', 'debit_card', 'digital_wallet', 'bank_transfer', 'check', 'gift_card', 'store_credit']
  },
  
  // Payment amount
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Currency
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  
  // Payment status
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  
  // Transaction details
  transactionId: {
    type: String,
    sparse: true // Allow null values but ensure uniqueness when present
  },
  
  // Gateway information
  gateway: {
    name: {
      type: String,
      enum: ['stripe', 'paypal', 'square', 'authorize_net', 'manual', 'offline']
    },
    transactionId: String,
    gatewayResponse: mongoose.Schema.Types.Mixed
  },
  
  // Payment processing details
  processing: {
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    processingTime: Number, // in milliseconds
    retryCount: {
      type: Number,
      default: 0
    }
  },
  
  // Card details (encrypted)
  cardDetails: {
    last4: String,
    brand: String,
    expiryMonth: Number,
    expiryYear: Number,
    holderName: String
  },
  
  // Digital wallet details
  walletDetails: {
    provider: String, // 'apple_pay', 'google_pay', 'samsung_pay', etc.
    walletId: String
  },
  
  // Refund information
  refunds: [{
    refundId: String,
    amount: Number,
    reason: String,
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    }
  }],
  
  // Fees and taxes
  fees: {
    processingFee: {
      type: Number,
      default: 0
    },
    gatewayFee: {
      type: Number,
      default: 0
    },
    totalFees: {
      type: Number,
      default: 0
    }
  },
  
  // Metadata
  metadata: {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    },
    terminalId: String,
    receiptNumber: String,
    notes: String
  },
  
  // Security
  security: {
    ipAddress: String,
    userAgent: String,
    riskScore: Number,
    fraudCheck: {
      passed: Boolean,
      details: mongoose.Schema.Types.Mixed
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
// paymentId index removed - already has unique: true in field definition
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ paymentMethod: 1 });
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ 'gateway.transactionId': 1 });

// Virtual for total refunded amount
PaymentSchema.virtual('totalRefunded').get(function() {
  return this.refunds.reduce((total, refund) => {
    return total + (refund.status === 'completed' ? refund.amount : 0);
  }, 0);
});

// Virtual for remaining amount
PaymentSchema.virtual('remainingAmount').get(function() {
  return this.amount - this.totalRefunded;
});

// Pre-save middleware
PaymentSchema.pre('save', function(next) {
  // Update total fees
  this.fees.totalFees = this.fees.processingFee + this.fees.gatewayFee;
  
  // Update updatedAt
  this.updatedAt = new Date();
  
  next();
});

// Static methods
PaymentSchema.statics.findByOrderId = function(orderId) {
  return this.find({ orderId }).sort({ createdAt: -1 });
};

PaymentSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

PaymentSchema.statics.getPaymentStats = function(startDate, endDate) {
  const match = {};
  if (startDate && endDate) {
    match.createdAt = { $gte: startDate, $lte: endDate };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' }
      }
    }
  ]);
};

// Instance methods
PaymentSchema.methods.canRefund = function() {
  return this.status === 'completed' && this.remainingAmount > 0;
};

PaymentSchema.methods.processRefund = function(amount, reason, processedBy) {
  if (!this.canRefund()) {
    throw new Error('Payment cannot be refunded');
  }
  
  if (amount > this.remainingAmount) {
    throw new Error('Refund amount exceeds remaining amount');
  }
  
  const refund = {
    refundId: `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount,
    reason,
    processedAt: new Date(),
    processedBy,
    status: 'pending'
  };
  
  this.refunds.push(refund);
  
  // Update payment status if fully refunded
  if (this.remainingAmount - amount === 0) {
    this.status = 'refunded';
  } else {
    this.status = 'partially_refunded';
  }
  
  return refund;
};

module.exports = mongoose.model('Payment', PaymentSchema);
