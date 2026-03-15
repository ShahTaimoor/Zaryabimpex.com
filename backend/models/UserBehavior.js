const mongoose = require('mongoose');

const UserBehaviorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Can be anonymous
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false, // Can be anonymous
  },
  sessionId: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    enum: [
      'page_view',
      'product_view',
      'product_click',
      'add_to_cart',
      'remove_from_cart',
      'purchase',
      'search',
      'filter',
      'category_view',
      'recommendation_view',
      'recommendation_click',
      'recommendation_dismiss'
    ],
    required: true,
  },
  entity: {
    type: {
      type: String,
      enum: ['product', 'category', 'search', 'page', 'recommendation'],
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'entity.ref',
    },
    ref: {
      type: String,
      enum: ['Product', 'Category', 'Recommendation'],
    },
    name: String,
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
  },
  context: {
    page: String,
    referrer: String,
    userAgent: String,
    ip: String,
    location: {
      country: String,
      region: String,
      city: String,
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
    },
    browser: String,
  },
  metadata: {
    searchQuery: String,
    filterCriteria: mongoose.Schema.Types.Mixed,
    cartValue: Number,
    productPrice: Number,
    quantity: Number,
    position: Number, // Position in list/recommendations
    timeOnPage: Number,
    scrollDepth: Number,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
UserBehaviorSchema.index({ sessionId: 1, timestamp: -1 });
UserBehaviorSchema.index({ user: 1, timestamp: -1 });
UserBehaviorSchema.index({ customer: 1, timestamp: -1 });
UserBehaviorSchema.index({ action: 1, timestamp: -1 });
UserBehaviorSchema.index({ 'entity.type': 1, 'entity.id': 1 });
UserBehaviorSchema.index({ timestamp: -1 });

// Static method to track user behavior
UserBehaviorSchema.statics.trackBehavior = async function(behaviorData) {
  const behavior = new this(behaviorData);
  return await behavior.save();
};

// Static method to get user behavior patterns
UserBehaviorSchema.statics.getUserPatterns = async function(userId, sessionId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const query = {
    $or: [{ user: userId }, { sessionId: sessionId }],
    timestamp: { $gte: startDate },
  };
  
  return await this.find(query)
    .populate('entity.id')
    .sort({ timestamp: -1 });
};

// Static method to get popular products
UserBehaviorSchema.statics.getPopularProducts = async function(days = 7, limit = 20) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const pipeline = [
    {
      $match: {
        action: { $in: ['product_view', 'product_click', 'add_to_cart', 'purchase'] },
        'entity.type': 'product',
        timestamp: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$entity.id',
        views: {
          $sum: { $cond: [{ $eq: ['$action', 'product_view'] }, 1, 0] }
        },
        clicks: {
          $sum: { $cond: [{ $eq: ['$action', 'product_click'] }, 1, 0] }
        },
        addToCart: {
          $sum: { $cond: [{ $eq: ['$action', 'add_to_cart'] }, 1, 0] }
        },
        purchases: {
          $sum: { $cond: [{ $eq: ['$action', 'purchase'] }, 1, 0] }
        },
        totalInteractions: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    {
      $unwind: '$product',
    },
    {
      $addFields: {
        engagementScore: {
          $add: [
            { $multiply: ['$views', 1] },
            { $multiply: ['$clicks', 2] },
            { $multiply: ['$addToCart', 5] },
            { $multiply: ['$purchases', 10] },
          ],
        },
      },
    },
    {
      $sort: { engagementScore: -1 },
    },
    {
      $limit: limit,
    },
  ];
  
  return await this.aggregate(pipeline);
};

// Static method to get frequently bought together
UserBehaviorSchema.statics.getFrequentlyBoughtTogether = async function(productId, limit = 10) {
  // Get all sessions that purchased the target product
  const sessionsWithProduct = await this.distinct('sessionId', {
    action: 'purchase',
    'entity.id': productId,
  });
  
  // Get all products purchased in those sessions
  const pipeline = [
    {
      $match: {
        sessionId: { $in: sessionsWithProduct },
        action: 'purchase',
        'entity.type': 'product',
        'entity.id': { $ne: productId }, // Exclude the target product
      },
    },
    {
      $group: {
        _id: '$entity.id',
        frequency: { $sum: 1 },
        sessions: { $addToSet: '$sessionId' },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    {
      $unwind: '$product',
    },
    {
      $addFields: {
        confidence: { $divide: ['$frequency', sessionsWithProduct.length] },
      },
    },
    {
      $sort: { confidence: -1, frequency: -1 },
    },
    {
      $limit: limit,
    },
  ];
  
  return await this.aggregate(pipeline);
};

// Static method to get user preferences
UserBehaviorSchema.statics.getUserPreferences = async function(userId, sessionId) {
  const behaviors = await this.getUserPatterns(userId, sessionId, 90); // 90 days
  
  const preferences = {
    categories: {},
    priceRange: { min: Infinity, max: 0 },
    brands: {},
    actions: {},
    timePatterns: {},
  };
  
  behaviors.forEach(behavior => {
    // Category preferences
    if (behavior.entity.category) {
      const categoryId = behavior.entity.category.toString();
      preferences.categories[categoryId] = (preferences.categories[categoryId] || 0) + 1;
    }
    
    // Price range
    if (behavior.metadata.productPrice) {
      preferences.priceRange.min = Math.min(preferences.priceRange.min, behavior.metadata.productPrice);
      preferences.priceRange.max = Math.max(preferences.priceRange.max, behavior.metadata.productPrice);
    }
    
    // Action patterns
    preferences.actions[behavior.action] = (preferences.actions[behavior.action] || 0) + 1;
    
    // Time patterns
    const hour = behavior.timestamp.getHours();
    preferences.timePatterns[hour] = (preferences.timePatterns[hour] || 0) + 1;
  });
  
  // Normalize price range
  if (preferences.priceRange.min === Infinity) {
    preferences.priceRange.min = 0;
  }
  
  return preferences;
};

module.exports = mongoose.model('UserBehavior', UserBehaviorSchema);
