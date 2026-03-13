/**
 * User behavior service - Postgres-friendly stub.
 * Replaces UserBehavior model static methods until user_behaviors table exists.
 */

async function trackBehavior(data) {
  // No-op when no user_behaviors table; can be implemented later
  return { id: null, _id: null };
}

async function getPopularProducts(days, limit) {
  return [];
}

async function getFrequentlyBoughtTogether(productId, limit) {
  return [];
}

module.exports = {
  trackBehavior,
  getPopularProducts,
  getFrequentlyBoughtTogether
};
