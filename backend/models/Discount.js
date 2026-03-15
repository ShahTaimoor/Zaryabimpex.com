const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: 20,
    match: [/^[A-Z0-9-_]+$/, 'Discount code can only contain uppercase letters, numbers, hyphens, and underscores']
  },

  // Discount Type and Value
  type: {
    type: String,
    enum: ['percentage', 'fixed_amount'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  maximumDiscount: {
    type: Number,
    min: 0,
    default: null // For percentage discounts, maximum amount that can be discounted
  },
  minimumOrderAmount: {
    type: Number,
    min: 0,
    default: 0
  },

  // Applicability
  applicableTo: {
    type: String,
    enum: ['all', 'products', 'categories', 'customers'],
    default: 'all'
  },
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  applicableCustomers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  }],
  customerTiers: [{
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum']
  }],
  businessTypes: [{
    type: String,
    enum: ['retail', 'wholesale', 'distributor']
  }],

  // Usage Limits
  usageLimit: {
    type: Number,
    min: 1,
    default: null // Total number of times this discount can be used
  },
  usageLimitPerCustomer: {
    type: Number,
    min: 1,
    default: null // Number of times a single customer can use this discount
  },
  currentUsage: {
    type: Number,
    default: 0,
    min: 0
  },

  // Validity Period
  validFrom: {
    type: Date,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Combination Rules
  combinableWithOtherDiscounts: {
    type: Boolean,
    default: false
  },
  combinableDiscounts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discount'
  }],
  priority: {
    type: Number,
    default: 0,
    min: 0 // Higher number = higher priority
  },

  // Conditions
  conditions: {
    minimumQuantity: {
      type: Number,
      min: 1,
      default: 1
    },
    maximumQuantity: {
      type: Number,
      min: 1,
      default: null
    },
    daysOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    timeOfDay: {
      start: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format']
      },
      end: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format']
      }
    },
    firstTimeCustomersOnly: {
      type: Boolean,
      default: false
    },
    returningCustomersOnly: {
      type: Boolean,
      default: false
    }
  },

  // Tracking and Analytics
  analytics: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalDiscountAmount: {
      type: Number,
      default: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: null
    },
    usageHistory: [{
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sales'
      },
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
      },
      discountAmount: Number,
      orderAmount: Number,
      usedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [String],
  notes: String,

  // Audit Trail
  auditTrail: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'activated', 'deactivated', 'used', 'expired']
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
// code index removed - already has unique: true in field definition
discountSchema.index({ isActive: 1 });
discountSchema.index({ validFrom: 1, validUntil: 1 });
discountSchema.index({ type: 1 });
discountSchema.index({ applicableTo: 1 });
discountSchema.index({ createdBy: 1 });
discountSchema.index({ priority: -1 });

// Virtual for discount status
discountSchema.virtual('status').get(function() {
  const now = new Date();
  
  if (!this.isActive) {
    return 'inactive';
  }
  
  if (now < this.validFrom) {
    return 'scheduled';
  }
  
  if (now > this.validUntil) {
    return 'expired';
  }
  
  if (this.usageLimit && this.currentUsage >= this.usageLimit) {
    return 'exhausted';
  }
  
  return 'active';
});

// Virtual for days until expiration
discountSchema.virtual('daysUntilExpiration').get(function() {
  if (this.status !== 'active') return null;
  
  const now = new Date();
  const expiration = new Date(this.validUntil);
  const diffTime = expiration - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

// Virtual for usage percentage
discountSchema.virtual('usagePercentage').get(function() {
  if (!this.usageLimit) return null;
  
  return Math.round((this.currentUsage / this.usageLimit) * 100);
});

// Pre-save middleware to validate dates
discountSchema.pre('save', function(next) {
  // Validate date range
  if (this.validUntil <= this.validFrom) {
    return next(new Error('Valid until date must be after valid from date'));
  }
  
  // Validate percentage discount value
  if (this.type === 'percentage' && this.value > 100) {
    return next(new Error('Percentage discount cannot exceed 100%'));
  }
  
  // Validate maximum discount for percentage
  if (this.type === 'percentage' && this.maximumDiscount && this.maximumDiscount <= 0) {
    return next(new Error('Maximum discount amount must be greater than 0'));
  }
  
  // Validate minimum order amount
  if (this.minimumOrderAmount < 0) {
    return next(new Error('Minimum order amount cannot be negative'));
  }
  
  // Validate usage limits
  if (this.usageLimit && this.usageLimitPerCustomer && this.usageLimitPerCustomer > this.usageLimit) {
    return next(new Error('Per-customer usage limit cannot exceed total usage limit'));
  }
  
  // Validate current usage doesn't exceed limits
  if (this.currentUsage > this.usageLimit) {
    return next(new Error('Current usage cannot exceed usage limit'));
  }
  
  next();
});

// Method to check if discount is applicable to an order
discountSchema.methods.isApplicableToOrder = function(order, customer = null) {
  const now = new Date();
  
  // Check if discount is active and within validity period
  if (!this.isActive || now < this.validFrom || now > this.validUntil) {
    return { applicable: false, reason: 'Discount is not active or expired' };
  }
  
  // Check usage limits
  if (this.usageLimit && this.currentUsage >= this.usageLimit) {
    return { applicable: false, reason: 'Usage limit exceeded' };
  }
  
  // Check minimum order amount
  if (order.total < this.minimumOrderAmount) {
    return { applicable: false, reason: `Minimum order amount of $${this.minimumOrderAmount} required` };
  }
  
  // Check customer restrictions
  if (customer) {
    // Check if customer is in applicable customers list
    if (this.applicableCustomers.length > 0 && !this.applicableCustomers.includes(customer._id)) {
      return { applicable: false, reason: 'Discount not applicable to this customer' };
    }
    
    // Check customer tier
    if (this.customerTiers.length > 0 && !this.customerTiers.includes(customer.customerTier)) {
      return { applicable: false, reason: 'Discount not applicable to customer tier' };
    }
    
    // Check business type
    if (this.businessTypes.length > 0 && !this.businessTypes.includes(customer.businessType)) {
      return { applicable: false, reason: 'Discount not applicable to business type' };
    }
    
    // Check first time customer restriction
    if (this.conditions.firstTimeCustomersOnly) {
      // This would need to be implemented based on order history
      // For now, we'll assume it's not a first-time customer
    }
    
    // Check returning customer restriction
    if (this.conditions.returningCustomersOnly) {
      // This would need to be implemented based on order history
      // For now, we'll assume it's a returning customer
    }
  }
  
  // Check product/category restrictions
  if (this.applicableTo === 'products' && this.applicableProducts.length > 0) {
    const orderProductIds = order.items.map(item => item.product.toString());
    const hasApplicableProduct = orderProductIds.some(productId => 
      this.applicableProducts.some(applicableProduct => applicableProduct.toString() === productId)
    );
    
    if (!hasApplicableProduct) {
      return { applicable: false, reason: 'Discount not applicable to products in order' };
    }
  }
  
  // Check quantity conditions
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity < this.conditions.minimumQuantity) {
    return { applicable: false, reason: `Minimum quantity of ${this.conditions.minimumQuantity} required` };
  }
  
  if (this.conditions.maximumQuantity && totalQuantity > this.conditions.maximumQuantity) {
    return { applicable: false, reason: `Maximum quantity of ${this.conditions.maximumQuantity} exceeded` };
  }
  
  // Check day of week restrictions
  if (this.conditions.daysOfWeek.length > 0) {
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
    if (!this.conditions.daysOfWeek.includes(dayOfWeek)) {
      return { applicable: false, reason: 'Discount not valid on this day of week' };
    }
  }
  
  // Check time of day restrictions
  if (this.conditions.timeOfDay.start && this.conditions.timeOfDay.end) {
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    if (currentTime < this.conditions.timeOfDay.start || currentTime > this.conditions.timeOfDay.end) {
      return { applicable: false, reason: 'Discount not valid at this time' };
    }
  }
  
  return { applicable: true, reason: 'Discount is applicable' };
};

// Method to calculate discount amount
discountSchema.methods.calculateDiscountAmount = function(orderAmount) {
  let discountAmount = 0;
  
  if (this.type === 'percentage') {
    discountAmount = (orderAmount * this.value) / 100;
    
    // Apply maximum discount limit if set
    if (this.maximumDiscount && discountAmount > this.maximumDiscount) {
      discountAmount = this.maximumDiscount;
    }
  } else if (this.type === 'fixed_amount') {
    discountAmount = Math.min(this.value, orderAmount);
  }
  
  return Math.round(discountAmount * 100) / 100; // Round to 2 decimal places
};

// Method to record usage
discountSchema.methods.recordUsage = function(orderId, customerId, discountAmount, orderAmount) {
  this.currentUsage += 1;
  this.analytics.totalOrders += 1;
  this.analytics.totalDiscountAmount += discountAmount;
  this.analytics.lastUsed = new Date();
  
  // Update average order value
  this.analytics.averageOrderValue = this.analytics.totalDiscountAmount / this.analytics.totalOrders;
  
  // Add to usage history
  this.analytics.usageHistory.push({
    orderId,
    customerId,
    discountAmount,
    orderAmount,
    usedAt: new Date()
  });
  
  // Add audit trail entry
  this.auditTrail.push({
    action: 'used',
    details: `Discount applied to order ${orderId}`,
    performedAt: new Date()
  });
  
  return this.save();
};

// Static method to find applicable discounts
discountSchema.statics.findApplicableDiscounts = async function(order, customer = null) {
  const now = new Date();
  
  // Find active discounts within validity period
  const discounts = await this.find({
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $or: [
      { usageLimit: null },
      { usageLimit: { $gt: { $expr: '$currentUsage' } } }
    ]
  }).sort({ priority: -1, createdAt: -1 });
  
  // Filter discounts based on applicability
  const applicableDiscounts = [];
  
  for (const discount of discounts) {
    const result = discount.isApplicableToOrder(order, customer);
    if (result.applicable) {
      applicableDiscounts.push({
        discount,
        reason: result.reason
      });
    }
  }
  
  return applicableDiscounts;
};

// Static method to get discount statistics
discountSchema.statics.getDiscountStats = async function(period = {}) {
  const match = {};
  
  if (period.startDate && period.endDate) {
    match.createdAt = {
      $gte: period.startDate,
      $lte: period.endDate
    };
  }
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalDiscounts: { $sum: 1 },
        activeDiscounts: {
          $sum: {
            $cond: [
              { $and: [
                '$isActive',
                { $lte: ['$validFrom', '$$NOW'] },
                { $gte: ['$validUntil', '$$NOW'] }
              ]},
              1,
              0
            ]
          }
        },
        totalUsage: { $sum: '$currentUsage' },
        totalDiscountAmount: { $sum: '$analytics.totalDiscountAmount' },
        averageDiscountValue: { $avg: '$value' },
        byType: { $push: '$type' },
        byStatus: {
          $push: {
            $cond: [
              { $and: ['$isActive', { $lte: ['$validFrom', '$$NOW'] }, { $gte: ['$validUntil', '$$NOW'] }]},
              'active',
              'inactive'
            ]
          }
        }
      }
    },
    {
      $project: {
        totalDiscounts: 1,
        activeDiscounts: 1,
        totalUsage: 1,
        totalDiscountAmount: { $round: ['$totalDiscountAmount', 2] },
        averageDiscountValue: { $round: ['$averageDiscountValue', 2] },
        typeBreakdown: {
          $reduce: {
            input: '$byType',
            initialValue: { percentage: 0, fixed_amount: 0 },
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
        statusBreakdown: {
          $reduce: {
            input: '$byStatus',
            initialValue: { active: 0, inactive: 0 },
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
    totalDiscounts: 0,
    activeDiscounts: 0,
    totalUsage: 0,
    totalDiscountAmount: 0,
    averageDiscountValue: 0,
    typeBreakdown: { percentage: 0, fixed_amount: 0 },
    statusBreakdown: { active: 0, inactive: 0 }
  };
};

module.exports = mongoose.model('Discount', discountSchema);
