const ProductRepository = require('../repositories/ProductRepository');
const SalesRepository = require('../repositories/SalesRepository');
const UserBehavior = require('../models/UserBehavior');
const Recommendation = require('../models/Recommendation');
const Category = require('../models/Category');

class RecommendationEngine {
  constructor() {
    this.algorithms = {
      collaborative: this.collaborativeFiltering.bind(this),
      content_based: this.contentBasedFiltering.bind(this),
      hybrid: this.hybridRecommendation.bind(this),
      trending: this.trendingProducts.bind(this),
      frequently_bought: this.frequentlyBoughtTogether.bind(this),
      similar_products: this.similarProducts.bind(this),
      seasonal: this.seasonalRecommendations.bind(this),
      price_based: this.priceBasedRecommendations.bind(this),
    };
  }

  // Main recommendation method
  async generateRecommendations(userId, sessionId, context = {}, algorithm = 'hybrid') {
    const startTime = Date.now();
    
    try {
      // Get user preferences
      const userPreferences = await UserBehavior.getUserPreferences(userId, sessionId);
      
      // Generate recommendations using specified algorithm
      const recommendations = await this.algorithms[algorithm](userId, sessionId, context, userPreferences);
      
      // Create recommendation record
      const recommendation = new Recommendation({
        user: userId,
        sessionId,
        algorithm,
        context,
        recommendations: recommendations.map((rec, index) => ({
          product: rec.product._id,
          score: rec.score,
          reason: rec.reason,
          position: index + 1,
        })),
        metadata: {
          totalProducts: recommendations.length,
          filteredProducts: recommendations.length,
          processingTime: Date.now() - startTime,
          modelVersion: '1.0',
          features: {
            userPreferences,
            context,
          },
        },
      });
      
      await recommendation.save();
      
      // Populate product details
      await recommendation.populate('recommendations.product');
      
      return recommendation;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw error;
    }
  }

  // Collaborative filtering - users who bought X also bought Y
  async collaborativeFiltering(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    
    // Get user's purchase history
    const userOrders = await SalesRepository.findAll({
      $or: [{ customer: userId }, { 'metadata.sessionId': sessionId }],
      status: 'completed',
    }, {
      populate: [{ path: 'items.product' }]
    });
    
    if (userOrders.length === 0) {
      return await this.trendingProducts(userId, sessionId, context, userPreferences);
    }
    
    // Get all products user has purchased
    const purchasedProducts = userOrders.flatMap(order => 
      order.items.map(item => item.product._id)
    );
    
    // Find other users who bought similar products
    const similarUsers = await SalesRepository.aggregate([
      {
        $match: {
          status: 'completed',
          'items.product': { $in: purchasedProducts },
          customer: { $ne: userId },
        },
      },
      {
        $group: {
          _id: '$customer',
          commonProducts: {
            $sum: {
              $size: {
                $setIntersection: ['$items.product', purchasedProducts],
              },
            },
          },
          allProducts: { $addToSet: '$items.product' },
        },
      },
      {
        $match: { commonProducts: { $gte: 1 } },
      },
      {
        $sort: { commonProducts: -1 },
      },
      {
        $limit: 50,
      },
    ]);
    
    // Get recommended products from similar users
    const recommendedProducts = [];
    const seenProducts = new Set(purchasedProducts);
    
    for (const user of similarUsers) {
      for (const productId of user.allProducts) {
        if (!seenProducts.has(productId)) {
          const product = await ProductRepository.findById(productId);
          if (product && product.status === 'active') {
            recommendedProducts.push({
              product,
              score: user.commonProducts / purchasedProducts.length,
              reason: 'collaborative_filtering',
            });
            seenProducts.add(productId);
          }
        }
      }
    }
    
    return recommendedProducts
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Content-based filtering - products similar to what user likes
  async contentBasedFiltering(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    
    // Get user's preferred categories
    const preferredCategories = Object.keys(userPreferences.categories || {})
      .sort((a, b) => userPreferences.categories[b] - userPreferences.categories[a])
      .slice(0, 3);
    
    if (preferredCategories.length === 0) {
      return await this.trendingProducts(userId, sessionId, context, userPreferences);
    }
    
    // Get products in preferred categories
    const products = await ProductRepository.findAll({
      category: { $in: preferredCategories },
      status: 'active',
    }, {
      limit: limit * 3
    });
    
    // Score products based on user preferences
    const scoredProducts = products.map(product => {
      let score = 0;
      
      // Category preference score
      const categoryScore = userPreferences.categories[product.category] || 0;
      score += categoryScore * 0.4;
      
      // Price range score
      if (userPreferences.priceRange && userPreferences.priceRange.max > 0) {
        const price = product.pricing.retail;
        const priceRange = userPreferences.priceRange;
        if (price >= priceRange.min && price <= priceRange.max) {
          score += 0.3;
        } else {
          // Penalty for products outside price range
          score -= 0.1;
        }
      }
      
      // Popularity score
      score += (product.metadata?.popularity || 0) * 0.3;
      
      return {
        product,
        score: Math.max(0, score),
        reason: 'content_similarity',
      };
    });
    
    return scoredProducts
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Hybrid recommendation combining multiple algorithms
  async hybridRecommendation(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    
    // Get recommendations from multiple algorithms
    const [collaborative, contentBased, trending, frequentlyBought] = await Promise.all([
      this.collaborativeFiltering(userId, sessionId, context, userPreferences),
      this.contentBasedFiltering(userId, sessionId, context, userPreferences),
      this.trendingProducts(userId, sessionId, context, userPreferences),
      this.frequentlyBoughtTogether(userId, sessionId, context, userPreferences),
    ]);
    
    // Combine and deduplicate recommendations
    const productScores = new Map();
    
    // Weight different algorithms
    const weights = {
      collaborative: 0.4,
      contentBased: 0.3,
      trending: 0.2,
      frequentlyBought: 0.1,
    };
    
    [collaborative, contentBased, trending, frequentlyBought].forEach((recommendations, index) => {
      const weight = Object.values(weights)[index];
      recommendations.forEach(rec => {
        const productId = rec.product._id.toString();
        const currentScore = productScores.get(productId) || { score: 0, reasons: [] };
        
        productScores.set(productId, {
          product: rec.product,
          score: currentScore.score + (rec.score * weight),
          reasons: [...currentScore.reasons, rec.reason],
        });
      });
    });
    
    return Array.from(productScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(rec => ({
        product: rec.product,
        score: rec.score,
        reason: rec.reasons[0], // Primary reason
      }));
  }

  // Trending products based on recent activity
  async trendingProducts(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    const days = 7;
    
    const popularProducts = await UserBehavior.getPopularProducts(days, limit * 2);
    
    return popularProducts.map(item => ({
      product: item.product,
      score: item.engagementScore / 100, // Normalize score
      reason: 'trending',
    }));
  }

  // Frequently bought together
  async frequentlyBoughtTogether(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    
    if (!context.currentProduct) {
      return [];
    }
    
    const frequentlyBought = await UserBehavior.getFrequentlyBoughtTogether(
      context.currentProduct,
      limit
    );
    
    return frequentlyBought.map(item => ({
      product: item.product,
      score: item.confidence,
      reason: 'frequently_bought_together',
    }));
  }

  // Similar products based on attributes
  async similarProducts(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    
    if (!context.currentProduct) {
      return [];
    }
    
    const currentProduct = await ProductRepository.findById(context.currentProduct);
    if (!currentProduct) {
      return [];
    }
    
    // Find products in same category with similar attributes
    const similarProducts = await ProductRepository.findAll({
      _id: { $ne: currentProduct._id },
      category: currentProduct.category,
      status: 'active',
    }, {
      limit: limit * 2
    });
    
    // Score based on attribute similarity
    const scoredProducts = similarProducts.map(product => {
      let score = 0;
      
      // Category match
      if (product.category.equals(currentProduct.category)) {
        score += 0.4;
      }
      
      // Price similarity
      const priceDiff = Math.abs(product.pricing.retail - currentProduct.pricing.retail);
      const maxPrice = Math.max(product.pricing.retail, currentProduct.pricing.retail);
      if (maxPrice > 0) {
        score += (1 - priceDiff / maxPrice) * 0.3;
      }
      
      // Brand similarity (if available)
      if (product.brand && currentProduct.brand && product.brand === currentProduct.brand) {
        score += 0.2;
      }
      
      // Description similarity (simplified)
      if (product.description && currentProduct.description) {
        const commonWords = this.getCommonWords(product.description, currentProduct.description);
        score += (commonWords / 10) * 0.1; // Simple word overlap
      }
      
      return {
        product,
        score: Math.max(0, score),
        reason: 'similar_products',
      };
    });
    
    return scoredProducts
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Seasonal recommendations
  async seasonalRecommendations(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    const currentMonth = new Date().getMonth();
    
    // Define seasonal categories (simplified)
    const seasonalCategories = {
      0: ['winter', 'cold_weather'], // January
      1: ['winter', 'valentine'], // February
      2: ['spring', 'gardening'], // March
      3: ['spring', 'outdoor'], // April
      4: ['spring', 'mothers_day'], // May
      5: ['summer', 'outdoor', 'fathers_day'], // June
      6: ['summer', 'vacation'], // July
      7: ['summer', 'back_to_school'], // August
      8: ['fall', 'back_to_school'], // September
      9: ['fall', 'halloween'], // October
      10: ['fall', 'thanksgiving'], // November
      11: ['winter', 'christmas', 'holiday'], // December
    };
    
    const currentSeasonalTags = seasonalCategories[currentMonth] || [];
    
    if (currentSeasonalTags.length === 0) {
      return [];
    }
    
    // Find products with seasonal tags
    const products = await ProductRepository.findAll({
      status: 'active',
      $or: [
        { tags: { $in: currentSeasonalTags } },
        { 'metadata.seasonal': { $in: currentSeasonalTags } },
      ],
    }, {
      limit: limit
    });
    
    return products.map(product => ({
      product,
      score: 0.8, // High score for seasonal relevance
      reason: 'seasonal',
    }));
  }

  // Price-based recommendations
  async priceBasedRecommendations(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    
    if (!userPreferences.priceRange || userPreferences.priceRange.max === 0) {
      return [];
    }
    
    const { min, max } = userPreferences.priceRange;
    const midPrice = (min + max) / 2;
    
    // Find products in user's price range
    const products = await ProductRepository.findAll({
      status: 'active',
      'pricing.retail': { $gte: min, $lte: max },
    }, {
      limit: limit * 2
    });
    
    // Score based on price proximity to user's average
    const scoredProducts = products.map(product => {
      const price = product.pricing.retail;
      const priceDiff = Math.abs(price - midPrice);
      const maxDiff = max - min;
      const score = maxDiff > 0 ? 1 - (priceDiff / maxDiff) : 1;
      
      return {
        product,
        score: Math.max(0, score),
        reason: 'price_range',
      };
    });
    
    return scoredProducts
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Helper method to find common words
  getCommonWords(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    return [...set1].filter(word => set2.has(word)).length;
  }

  // Get recommendation performance metrics
  async getRecommendationMetrics(recommendationId) {
    const recommendation = await Recommendation.findById(recommendationId);
    if (!recommendation) {
      throw new Error('Recommendation not found');
    }
    
    return await Recommendation.calculatePerformance(recommendationId);
  }

  // Update recommendation based on user feedback
  async updateRecommendation(recommendationId, productId, action, position = null) {
    return await Recommendation.trackInteraction(recommendationId, productId, action, position);
  }
}

module.exports = new RecommendationEngine();
