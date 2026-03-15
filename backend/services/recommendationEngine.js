const ProductRepository = require('../repositories/ProductRepository');
const SalesRepository = require('../repositories/SalesRepository');
const RecommendationRepository = require('../repositories/RecommendationRepository');
const CategoryRepository = require('../repositories/CategoryRepository');
const UserBehaviorRepository = require('../repositories/UserBehaviorRepository');

async function getUserPreferences(userId, sessionId) {
  return UserBehaviorRepository.getUserPreferences(userId, sessionId, 90);
}

async function getPopularProducts(days, limit) {
  const rows = await UserBehaviorRepository.getPopularProducts(days, limit);
  const out = [];
  for (const row of rows) {
    const product = await ProductRepository.findById(row.product_id);
    if (product) {
      out.push({
        product,
        engagementScore: row.engagement_score ?? 50
      });
    }
  }
  return out;
}

async function getFrequentlyBoughtTogether(productId, limit) {
  const rows = await UserBehaviorRepository.getFrequentlyBoughtTogether(productId, limit);
  const out = [];
  for (const row of rows) {
    const product = await ProductRepository.findById(row.product_id);
    if (product) {
      const confidence = row.frequency ? Math.min(1, row.frequency / 10) : 0.5;
      out.push({ product, confidence });
    }
  }
  return out;
}

function toId(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v && typeof v.toString === 'function') return v.toString();
  return String(v);
}

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
      price_based: this.priceBasedRecommendations.bind(this)
    };
  }

  async generateRecommendations(userId, sessionId, context = {}, algorithm = 'hybrid') {
    const startTime = Date.now();
    try {
      const userPreferences = await getUserPreferences(userId, sessionId);
      let recommendations = await this.algorithms[algorithm](userId, sessionId, context, userPreferences);

      // Fallback when algorithm returns no results (e.g. no behavior data yet)
      const limit = context.limit || 10;
      if (!recommendations || recommendations.length === 0) {
        recommendations = await this.trendingProducts(userId, sessionId, { ...context, limit }, userPreferences);
      }
      if (!recommendations || recommendations.length === 0) {
        recommendations = await this.seasonalRecommendations(userId, sessionId, { ...context, limit }, userPreferences);
      }

      const recsPayload = recommendations.map((rec, index) => ({
        product: toId(rec.product?.id ?? rec.product?._id),
        score: rec.score ?? 0,
        reason: rec.reason ?? algorithm,
        position: index + 1
      }));

      const created = await RecommendationRepository.create({
        user: userId,
        sessionId: sessionId || null,
        algorithm,
        context: context || {},
        recommendations: recsPayload
      });

      return {
        ...created,
        id: created.id,
        recommendations: recommendations.map((r, i) => ({
          product: r.product,
          score: r.score,
          reason: r.reason,
          position: i + 1
        }))
      };
    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw error;
    }
  }

  async collaborativeFiltering(userId, sessionId, context, userPreferences) {
    return this.trendingProducts(userId, sessionId, context, userPreferences);
  }

  async contentBasedFiltering(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    const preferredCategories = Object.keys(userPreferences.categories || {})
      .sort((a, b) => (userPreferences.categories[b] || 0) - (userPreferences.categories[a] || 0))
      .slice(0, 3);
    if (preferredCategories.length === 0) {
      return this.trendingProducts(userId, sessionId, context, userPreferences);
    }
    const products = await ProductRepository.findAll(
      { categoryId: preferredCategories[0], isActive: true },
      { limit: limit * 2 }
    );
    return products.slice(0, limit).map(p => ({
      product: p,
      score: 0.6,
      reason: 'content_similarity'
    }));
  }

  async hybridRecommendation(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    const [trending, frequentlyBought] = await Promise.all([
      this.trendingProducts(userId, sessionId, context, userPreferences),
      this.frequentlyBoughtTogether(userId, sessionId, context, userPreferences)
    ]);
    const productScores = new Map();
    [...trending, ...frequentlyBought].forEach(rec => {
      const id = toId(rec.product?.id ?? rec.product?._id);
      if (!id) return;
      const current = productScores.get(id) || { score: 0, product: rec.product, reason: rec.reason };
      productScores.set(id, {
        product: rec.product,
        score: current.score + (rec.score || 0),
        reason: current.reason || rec.reason
      });
    });
    return Array.from(productScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => ({ product: r.product, score: r.score, reason: r.reason }));
  }

  async trendingProducts(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    const popular = await getPopularProducts(7, limit * 2);
    return popular.map(item => ({
      product: item.product,
      score: (item.engagementScore || 50) / 100,
      reason: 'trending'
    })).slice(0, limit);
  }

  async frequentlyBoughtTogether(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    if (!context.currentProduct) return [];
    const items = await getFrequentlyBoughtTogether(context.currentProduct, limit);
    return items.map(item => ({
      product: item.product,
      score: item.confidence ?? 0.5,
      reason: 'frequently_bought_together'
    }));
  }

  async similarProducts(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    if (!context.currentProduct) return [];
    const currentProduct = await ProductRepository.findById(context.currentProduct);
    if (!currentProduct) return [];
    const categoryId = currentProduct.category_id ?? currentProduct.category;
    const list = await ProductRepository.findAll(
      { categoryId, isActive: true },
      { limit: limit * 2 }
    );
    const similar = list
      .filter(p => toId(p.id) !== toId(context.currentProduct))
      .slice(0, limit);
    return similar.map(p => ({
      product: p,
      score: 0.7,
      reason: 'similar_products'
    }));
  }

  async seasonalRecommendations(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    const products = await ProductRepository.findAll(
      { isActive: true },
      { limit }
    );
    return products.map(p => ({
      product: p,
      score: 0.8,
      reason: 'seasonal'
    }));
  }

  async priceBasedRecommendations(userId, sessionId, context, userPreferences) {
    const limit = context.limit || 10;
    if (!userPreferences.priceRange || !userPreferences.priceRange.max) return [];
    const { min, max } = userPreferences.priceRange;
    const products = await ProductRepository.findAll(
      { isActive: true },
      { limit: limit * 2 }
    );
    const filtered = products.filter(p => {
      const price = parseFloat(p.selling_price ?? p.sellingPrice ?? 0) || 0;
      return price >= min && price <= max;
    });
    return filtered.slice(0, limit).map(p => ({
      product: p,
      score: 0.6,
      reason: 'price_range'
    }));
  }

  getCommonWords(text1, text2) {
    if (!text1 || !text2) return 0;
    const words1 = String(text1).toLowerCase().split(/\s+/);
    const words2 = String(text2).toLowerCase().split(/\s+/);
    const set2 = new Set(words2);
    return words1.filter(w => set2.has(w)).length;
  }

  async getRecommendationMetrics(recommendationId) {
    const rec = await RecommendationRepository.findById(recommendationId);
    if (!rec) throw new Error('Recommendation not found');
    return {
      views: 0,
      clicks: 0,
      conversions: 0,
      recommendationId
    };
  }

  async updateRecommendation(recommendationId, productId, action, position = null) {
    return { recommendationId, productId, action, position };
  }
}

module.exports = new RecommendationEngine();
