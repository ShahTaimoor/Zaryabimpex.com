const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const recommendationEngine = require('../services/recommendationEngine');
const userBehaviorService = require('../services/userBehaviorService');
const recommendationRepository = require('../repositories/postgres/RecommendationRepository');

const router = express.Router();

// @route   POST /api/recommendations/generate
// @desc    Generate product recommendations
// @access  Private (requires 'view_recommendations' permission)
router.post('/generate', [
  auth,
  requirePermission('view_recommendations'),
  sanitizeRequest,
  body('sessionId').optional().custom((value) => {
    if (value && typeof value !== 'string') {
      throw new Error('Session ID must be a string');
    }
    return true;
  }),
  body('algorithm').optional().isIn(['collaborative', 'content_based', 'hybrid', 'trending', 'frequently_bought', 'similar_products', 'seasonal', 'price_based']),
  body('context').optional().isObject(),
  body('context.page').optional().isIn(['home', 'product', 'cart', 'checkout', 'search', 'category', 'sales']),
  body('context.currentProduct').optional().isUUID(4),
  body('context.currentProducts').optional().isArray(),
  body('context.category').optional().isUUID(4),
  body('context.searchQuery').optional().trim(),
  body('context.customerTier').optional().isIn(['bronze', 'silver', 'gold', 'platinum']),
  body('context.businessType').optional().isIn(['individual', 'wholesale', 'distributor', 'retail']),
  body('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, algorithm = 'hybrid', context = {}, limit = 10 } = req.body;
    const userId = req.user?.id;

    // Track recommendation request
    try {
      await UserBehavior.trackBehavior({
        user: userId,
        sessionId,
        action: 'recommendation_view',
        entity: {
          type: 'recommendation',
          name: algorithm,
        },
        context: {
          page: context.page || 'unknown',
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          device: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
        },
        metadata: {
          algorithm,
          limit,
        },
      });
    } catch (trackingError) {
      console.warn('Failed to track recommendation behavior:', trackingError.message);
      // Continue with recommendation generation even if tracking fails
    }

    const recommendations = await recommendationEngine.generateRecommendations(
      userId,
      sessionId,
      { ...context, limit },
      algorithm
    );

    res.json({
      recommendations: recommendations.recommendations || [],
      algorithm,
      context,
      metadata: recommendations.metadata || {},
      recommendationId: recommendations._id || null,
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ message: 'Server error generating recommendations', error: error.message });
  }
});

// @route   GET /api/recommendations/:recommendationId
// @desc    Get specific recommendation details
// @access  Private (requires 'view_recommendations' permission)
router.get('/:recommendationId', [
  auth,
  requirePermission('view_recommendations'),
  sanitizeRequest,
  param('recommendationId').isUUID(4).withMessage('Valid Recommendation ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const userId = req.user?.id;

    const recommendation = await recommendationRepository.findById(recommendationId, {
      populate: [
        { path: 'recommendations.product' },
        { path: 'user', select: 'firstName lastName email' },
        { path: 'customer', select: 'firstName lastName email' }
      ]
    });

    if (!recommendation) {
      return res.status(404).json({ message: 'Recommendation not found' });
    }

    // Check if user has access to this recommendation
    if (recommendation.user && !recommendation.user.equals(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(recommendation);
  } catch (error) {
    console.error('Error fetching recommendation:', error);
    res.status(500).json({ message: 'Server error fetching recommendation', error: error.message });
  }
});

// @route   POST /api/recommendations/:recommendationId/interact
// @desc    Track user interaction with recommendations
// @access  Private (requires 'view_recommendations' permission)
router.post('/:recommendationId/interact', [
  auth,
  requirePermission('view_recommendations'),
  sanitizeRequest,
  param('recommendationId').isUUID(4).withMessage('Valid Recommendation ID is required'),
  body('productId').isUUID(4).withMessage('Valid Product ID is required'),
  body('action').isIn(['view', 'click', 'add_to_cart', 'purchase', 'dismiss']).withMessage('Invalid action'),
  body('position').optional().isInt({ min: 1 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const { productId, action, position } = req.body;
    const userId = req.user?.id;

    // Track the interaction
    const recommendation = await recommendationEngine.updateRecommendation(
      recommendationId,
      productId,
      action,
      position
    );

    // Also track in user behavior
    await UserBehavior.trackBehavior({
      user: userId,
      sessionId: recommendation.sessionId,
      action: `recommendation_${action}`,
      entity: {
        type: 'product',
        id: productId,
        ref: 'Product',
      },
      context: {
        page: recommendation.context?.page || 'unknown',
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      },
      metadata: {
        position,
        algorithm: recommendation.algorithm,
      },
    });

    res.json({
      message: 'Interaction tracked successfully',
      recommendation: recommendation._id,
    });
  } catch (error) {
    console.error('Error tracking recommendation interaction:', error);
    res.status(500).json({ message: 'Server error tracking interaction', error: error.message });
  }
});

// @route   GET /api/recommendations/trending
// @desc    Get trending products
// @access  Public (for anonymous users)
router.get('/trending', [
  sanitizeRequest,
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('days').optional().isInt({ min: 1, max: 30 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { limit = 10, days = 7 } = req.query;

    const trendingProducts = await userBehaviorService.getPopularProducts(days, limit);

    res.json({
      trending: trendingProducts.map(item => ({
        product: item.product,
        score: item.engagementScore,
        metrics: {
          views: item.views,
          clicks: item.clicks,
          addToCart: item.addToCart,
          purchases: item.purchases,
          totalInteractions: item.totalInteractions,
        },
      })),
      period: `${days} days`,
    });
  } catch (error) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({ message: 'Server error fetching trending products', error: error.message });
  }
});

// @route   GET /api/recommendations/frequently-bought/:productId
// @desc    Get products frequently bought together
// @access  Public
router.get('/frequently-bought/:productId', [
  sanitizeRequest,
  param('productId').isUUID(4).withMessage('Valid Product ID is required'),
  query('limit').optional().isInt({ min: 1, max: 20 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10 } = req.query;

    const frequentlyBought = await UserBehavior.getFrequentlyBoughtTogether(productId, limit);

    res.json({
      product: productId,
      frequentlyBoughtTogether: frequentlyBought.map(item => ({
        product: item.product,
        confidence: item.confidence,
        frequency: item.frequency,
      })),
    });
  } catch (error) {
    console.error('Error fetching frequently bought together:', error);
    res.status(500).json({ message: 'Server error fetching frequently bought together', error: error.message });
  }
});

// @route   GET /api/recommendations/similar/:productId
// @desc    Get similar products
// @access  Public
router.get('/similar/:productId', [
  sanitizeRequest,
  param('productId').isUUID(4).withMessage('Valid Product ID is required'),
  query('limit').optional().isInt({ min: 1, max: 20 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10 } = req.query;

    const similarProducts = await recommendationEngine.similarProducts(
      null,
      null,
      { currentProduct: productId, limit }
    );

    res.json({
      product: productId,
      similar: similarProducts.map(item => ({
        product: item.product,
        score: item.score,
        reason: item.reason,
      })),
    });
  } catch (error) {
    console.error('Error fetching similar products:', error);
    res.status(500).json({ message: 'Server error fetching similar products', error: error.message });
  }
});

// @route   POST /api/recommendations/behavior
// @desc    Track user behavior for recommendation learning
// @access  Private (requires 'view_recommendations' permission)
router.post('/behavior', [
  auth,
  requirePermission('view_recommendations'),
  sanitizeRequest,
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('action').isIn(['page_view', 'product_view', 'product_click', 'add_to_cart', 'remove_from_cart', 'purchase', 'search', 'filter', 'category_view']).withMessage('Invalid action'),
  body('entity.type').isIn(['product', 'category', 'search', 'page']).withMessage('Invalid entity type'),
  body('entity.id').optional().isUUID(4),
  body('context').optional().isObject(),
  body('metadata').optional().isObject(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { sessionId, action, entity, context = {}, metadata = {} } = req.body;
    const userId = req.user?.id;

    const behavior = await userBehaviorService.trackBehavior({
      user: userId,
      sessionId,
      action,
      entity,
      context: {
        ...context,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        device: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      },
      metadata,
    });

    res.json({
      message: 'Behavior tracked successfully',
      behaviorId: behavior._id || behavior.id,
    });
  } catch (error) {
    console.error('Error tracking behavior:', error);
    res.status(500).json({ message: 'Server error tracking behavior', error: error.message });
  }
});

// @route   GET /api/recommendations/performance
// @desc    Get recommendation performance metrics
// @access  Private (requires 'view_reports' permission)
router.get('/performance', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
  query('algorithm').optional().isIn(['collaborative', 'content_based', 'hybrid', 'trending', 'frequently_bought', 'similar_products', 'seasonal', 'price_based']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { startDate, endDate, algorithm } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }
    if (algorithm) filter.algorithm = algorithm;

    const recommendations = await recommendationRepository.findWithFilter(filter, {
      sort: { createdAt: -1 },
      populate: [
        { path: 'recommendations.product' }
      ]
    });

    // Calculate aggregate metrics
    const metrics = {
      totalRecommendations: recommendations.length,
      totalInteractions: 0,
      totalClicks: 0,
      totalPurchases: 0,
      totalRevenue: 0,
      averageCTR: 0,
      averageConversionRate: 0,
      algorithmPerformance: {},
    };

    recommendations.forEach(rec => {
      const interactions = rec.interactions || [];
      const clicks = interactions.filter(i => i.action === 'click' || i.action === 'add_to_cart' || i.action === 'purchase').length;
      const purchases = interactions.filter(i => i.action === 'purchase').length;
      const views = interactions.filter(i => i.action === 'view').length;

      metrics.totalInteractions += interactions.length;
      metrics.totalClicks += clicks;
      metrics.totalPurchases += purchases;
      metrics.totalRevenue += rec.performance?.revenue || 0;

      // Algorithm-specific metrics
      if (!metrics.algorithmPerformance[rec.algorithm]) {
        metrics.algorithmPerformance[rec.algorithm] = {
          count: 0,
          interactions: 0,
          clicks: 0,
          purchases: 0,
          revenue: 0,
        };
      }

      metrics.algorithmPerformance[rec.algorithm].count++;
      metrics.algorithmPerformance[rec.algorithm].interactions += interactions.length;
      metrics.algorithmPerformance[rec.algorithm].clicks += clicks;
      metrics.algorithmPerformance[rec.algorithm].purchases += purchases;
      metrics.algorithmPerformance[rec.algorithm].revenue += rec.performance?.revenue || 0;
    });

    // Calculate averages
    if (metrics.totalInteractions > 0) {
      metrics.averageCTR = metrics.totalClicks / metrics.totalInteractions;
      metrics.averageConversionRate = metrics.totalPurchases / metrics.totalClicks;
    }

    // Calculate algorithm-specific averages
    Object.keys(metrics.algorithmPerformance).forEach(algo => {
      const perf = metrics.algorithmPerformance[algo];
      perf.averageCTR = perf.interactions > 0 ? perf.clicks / perf.interactions : 0;
      perf.averageConversionRate = perf.clicks > 0 ? perf.purchases / perf.clicks : 0;
      perf.averageRevenue = perf.count > 0 ? perf.revenue / perf.count : 0;
    });

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching recommendation performance:', error);
    res.status(500).json({ message: 'Server error fetching recommendation performance', error: error.message });
  }
});

// @route   GET /api/recommendations/user/:userId
// @desc    Get user's recommendation history
// @access  Private (requires 'view_recommendations' permission)
router.get('/user/:userId', [
  auth,
  requirePermission('view_recommendations'),
  sanitizeRequest,
  param('userId').isUUID(4).withMessage('Valid User ID is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    // Check if user can view this user's recommendations
    if (req.user.id !== userId && !req.user.permissions.includes('view_all_recommendations')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const recommendations = await recommendationRepository.findWithFilter(
      { user: userId },
      {
        sort: { createdAt: -1 },
        populate: [
          { path: 'recommendations.product' }
        ],
        limit: parseInt(limit)
      }
    );

    res.json({
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    console.error('Error fetching user recommendations:', error);
    res.status(500).json({ message: 'Server error fetching user recommendations', error: error.message });
  }
});

module.exports = router;
