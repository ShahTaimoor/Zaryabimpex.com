// Simple in-memory rate limiter (per-process). For clustered deployments, use Redis.

const createRateLimiter = ({ windowMs = 60_000, max = 60, keyGenerator } = {}) => {
  const hits = new Map();
  const getKey = (req) => (keyGenerator ? keyGenerator(req) : (req.ip || req.headers['x-forwarded-for'] || 'global'));

  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of hits.entries()) {
      if (now - data.start >= windowMs) hits.delete(key);
    }
  }, Math.max(5_000, Math.floor(windowMs / 2))).unref();

  return (req, res, next) => {
    const key = getKey(req);
    const now = Date.now();
    const record = hits.get(key) || { count: 0, start: now };
    if (now - record.start >= windowMs) {
      record.count = 0;
      record.start = now;
    }
    record.count += 1;
    hits.set(key, record);
    
    // Add rate limit headers
    const remaining = Math.max(0, max - record.count);
    const resetTime = record.start + windowMs;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());
    
    if (record.count > max) {
      const retryAfter = Math.ceil((resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ 
        message: 'Too many requests. Please try again later.',
        retryAfter: retryAfter
      });
    }
    next();
  };
};

module.exports = { createRateLimiter };


