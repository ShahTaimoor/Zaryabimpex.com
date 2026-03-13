const { query } = require('../../config/postgres');

function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    user: row.user_id,
    userId: row.user_id,
    customer: row.customer_id,
    customerId: row.customer_id,
    sessionId: row.session_id,
    action: row.action,
    entity: {
      type: row.entity_type,
      id: row.entity_id,
      name: row.entity_name,
      category: row.category_id
    },
    context: row.context || {},
    metadata: row.metadata || {},
    timestamp: row.timestamp,
    createdAt: row.created_at
  };
}

class UserBehaviorRepository {
  async create(data) {
    const entity = data.entity || {};
    const result = await query(
      `INSERT INTO user_behaviors (user_id, customer_id, session_id, action, entity_type, entity_id, entity_name, category_id, context, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        data.user ?? data.userId ?? null,
        data.customer ?? data.customerId ?? null,
        data.sessionId ?? data.session_id,
        data.action,
        entity.type ?? data.entityType ?? null,
        entity.id ?? data.entityId ?? null,
        entity.name ?? data.entityName ?? null,
        entity.category ?? data.categoryId ?? null,
        data.context ? JSON.stringify(data.context) : '{}',
        data.metadata ? JSON.stringify(data.metadata) : '{}',
        data.timestamp ?? new Date()
      ]
    );
    return toCamel(result.rows[0]);
  }

  async getUserPatterns(userId, sessionId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    let sql = `SELECT * FROM user_behaviors WHERE timestamp >= $1 AND (user_id = $2 OR session_id = $3) ORDER BY timestamp DESC`;
    const result = await query(sql, [startDate, userId, sessionId]);
    return result.rows.map(toCamel);
  }

  async getPopularProducts(days = 7, limit = 20) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const result = await query(
      `WITH agg AS (
         SELECT entity_id,
                SUM(CASE WHEN action = 'product_view' THEN 1 ELSE 0 END) AS views,
                SUM(CASE WHEN action = 'product_click' THEN 1 ELSE 0 END) AS clicks,
                SUM(CASE WHEN action = 'add_to_cart' THEN 1 ELSE 0 END) AS add_to_cart,
                SUM(CASE WHEN action = 'purchase' THEN 1 ELSE 0 END) AS purchases
         FROM user_behaviors
         WHERE action IN ('product_view', 'product_click', 'add_to_cart', 'purchase')
           AND entity_type = 'product' AND timestamp >= $1 AND entity_id IS NOT NULL
         GROUP BY entity_id
       )
       SELECT entity_id AS product_id,
              (COALESCE(views,0)*1 + COALESCE(clicks,0)*2 + COALESCE(add_to_cart,0)*5 + COALESCE(purchases,0)*10)::int AS engagement_score
       FROM agg
       ORDER BY engagement_score DESC
       LIMIT $2`,
      [startDate, limit]
    );
    return result.rows;
  }

  async getFrequentlyBoughtTogether(productId, limit = 10) {
    const sessionsResult = await query(
      `SELECT DISTINCT session_id FROM user_behaviors
       WHERE action = 'purchase' AND entity_type = 'product' AND entity_id = $1`,
      [productId]
    );
    const sessions = sessionsResult.rows.map(r => r.session_id).filter(Boolean);
    if (sessions.length === 0) return [];

    const result = await query(
      `SELECT entity_id AS product_id, COUNT(*) AS frequency
       FROM user_behaviors
       WHERE session_id = ANY($1::text[]) AND action = 'purchase' AND entity_type = 'product'
         AND entity_id IS NOT NULL AND entity_id != $2
       GROUP BY entity_id
       ORDER BY frequency DESC
       LIMIT $3`,
      [sessions, productId, limit]
    );
    return result.rows;
  }

  async getUserPreferences(userId, sessionId, days = 90) {
    const rows = await this.getUserPatterns(userId, sessionId, days);
    const preferences = { categories: {}, priceRange: { min: Infinity, max: 0 }, brands: {}, actions: {}, timePatterns: {} };
    for (const r of rows) {
      const cat = r.entity?.category ?? r.categoryId;
      if (cat) preferences.categories[cat] = (preferences.categories[cat] || 0) + 1;
      const price = r.metadata?.productPrice ?? r.metadata?.product_price;
      if (price != null) {
        preferences.priceRange.min = Math.min(preferences.priceRange.min, Number(price));
        preferences.priceRange.max = Math.max(preferences.priceRange.max, Number(price));
      }
      preferences.actions[r.action] = (preferences.actions[r.action] || 0) + 1;
      const hour = new Date(r.timestamp).getHours();
      preferences.timePatterns[hour] = (preferences.timePatterns[hour] || 0) + 1;
    }
    if (preferences.priceRange.min === Infinity) preferences.priceRange.min = 0;
    return preferences;
  }
}

module.exports = new UserBehaviorRepository();
