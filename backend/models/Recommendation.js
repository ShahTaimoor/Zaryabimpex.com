const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema({
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
    required: true, // Always track session
  },
  algorithm: {
    type: String,
    enum: ['collaborative', 'content_based', 'hybrid', 'trending', 'frequently_bought', 'similar_products', 'seasonal', 'price_based'],
    required: true,
  },
  context: {
    page: {
      type: String,
      enum: ['home', 'product', 'cart', 'checkout', 'search', 'category', 'sales'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    currentProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    currentProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    }],
    searchQuery: String,
    customerTier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
    },
    businessType: {
      type: String,
      enum: ['individual', 'wholesale', 'distributor', 'retail'],
    },
  },
  recommendations: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    reason: {
      type: String,
      enum: ['similar_to_purchased', 'frequently_bought_together', 'trending', 'seasonal', 'price_range', 'category_match', 'collaborative_filtering', 'content_similarity'],
    },
    position: {
      type: Number,
      required: true,
    },
  }],
  metadata: {
    totalProducts: Number,
    filteredProducts: Number,
    processingTime: Number, // in milliseconds
    modelVersion: String,
    features: mongoose.Schema.Types.Mixed,
  },
  interactions: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    action: {
      type: String,
      enum: ['view', 'click', 'add_to_cart', 'purchase', 'dismiss'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    position: Number,
  }],
  performance: {
    clickThroughRate: Number,
    conversionRate: Number,
    revenue: Number,
    lastCalculated: Date,
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
RecommendationSchema.index({ sessionId: 1, createdAt: -1 });
RecommendationSchema.index({ user: 1, createdAt: -1 });
RecommendationSchema.index({ customer: 1, createdAt: -1 });
RecommendationSchema.index({ algorithm: 1 });
RecommendationSchema.index({ 'context.page': 1 });
RecommendationSchema.index({ 'recommendations.product': 1 });

// Virtual for recommendation count
RecommendationSchema.virtual('recommendationCount').get(function() {
  return this.recommendations.length;
});

// Static method to get user recommendations
RecommendationSchema.statics.getUserRecommendations = async function(userId, sessionId, context = {}) {
  const query = { $or: [{ user: userId }, { sessionId: sessionId }] };
  
  return await this.findOne(query)
    .populate('recommendations.product')
    .sort({ createdAt: -1 })
    .limit(1);
};

// Static method to track interaction
RecommendationSchema.statics.trackInteraction = async function(recommendationId, productId, action, position = null) {
  const recommendation = await this.findById(recommendationId);
  
  if (!recommendation) {
    throw new Error('Recommendation not found');
  }
  
  recommendation.interactions.push({
    product: productId,
    action,
    position,
    timestamp: new Date(),
  });
  
  return await recommendation.save();
};

// Static method to calculate performance metrics
RecommendationSchema.statics.calculatePerformance = async function(recommendationId) {
  const recommendation = await this.findById(recommendationId);
  
  if (!recommendation) {
    throw new Error('Recommendation not found');
  }
  
  const interactions = recommendation.interactions;
  const totalRecommendations = recommendation.recommendations.length;
  
  if (totalRecommendations === 0) {
    return recommendation;
  }
  
  // Calculate CTR (Click Through Rate)
  const clicks = interactions.filter(i => i.action === 'click' || i.action === 'add_to_cart' || i.action === 'purchase').length;
  const views = interactions.filter(i => i.action === 'view').length;
  const clickThroughRate = views > 0 ? clicks / views : 0;
  
  // Calculate conversion rate
  const purchases = interactions.filter(i => i.action === 'purchase').length;
  const conversions = interactions.filter(i => i.action === 'add_to_cart' || i.action === 'purchase').length;
  const conversionRate = clicks > 0 ? conversions / clicks : 0;
  
  // Calculate revenue (simplified - would need actual order data)
  const revenue = purchases * 50; // Average order value placeholder
  
  recommendation.performance = {
    clickThroughRate,
    conversionRate,
    revenue,
    lastCalculated: new Date(),
  };
  
  return await recommendation.save();
};

module.exports = mongoose.model('Recommendation', RecommendationSchema);
