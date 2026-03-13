/**
 * Duplicate Prevention Middleware
 * Prevents duplicate POS submissions and concurrent requests
 * Uses idempotency keys to ensure requests are processed only once
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// In-memory store for idempotency keys (use Redis in production)
const idempotencyStore = new Map();

// Clean up old keys every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  for (const [key, data] of idempotencyStore.entries()) {
    if (now - data.timestamp > maxAge) {
      idempotencyStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Generate idempotency key from request
 */
const generateIdempotencyKey = (req) => {
  // Use custom idempotency key if provided (Express normalizes headers to lowercase)
  // Check both lowercase and any case variations
  const idempotencyKeyHeader = req.headers['idempotency-key'] || 
                                req.headers['Idempotency-Key'] ||
                                req.headers['IDEMPOTENCY-KEY'];
  if (idempotencyKeyHeader) {
    return idempotencyKeyHeader;
  }

  // Generate key from request body for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const bodyString = JSON.stringify(req.body);
    const hash = crypto.createHash('sha256').update(bodyString).digest('hex');
    return `${req.method}:${req.path}:${hash}`;
  }

  // For GET requests, use path and query params
  if (req.method === 'GET') {
    const queryString = JSON.stringify(req.query);
    const hash = crypto.createHash('sha256').update(queryString).digest('hex');
    return `${req.method}:${req.path}:${hash}`;
  }

  return null;
};

/**
 * Middleware to prevent duplicate requests
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds (default: 5000)
 * @param {boolean} options.requireIdempotencyKey - Require explicit idempotency key header (default: false)
 */
const preventDuplicates = (options = {}) => {
  const {
    windowMs = 5000, // 5 second window
    requireIdempotencyKey = false
  } = options;

  return async (req, res, next) => {
    // Skip for non-mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = generateIdempotencyKey(req);

    if (!idempotencyKey) {
      if (requireIdempotencyKey) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Idempotency-Key header is required for this request',
            code: 'IDEMPOTENCY_KEY_REQUIRED'
          }
        });
      }
      return next();
    }

    // Check if this request was already processed
    const existing = idempotencyStore.get(idempotencyKey);

    if (existing) {
      const age = Date.now() - existing.timestamp;
      
      if (age < windowMs) {
        // Request is a duplicate within the time window
        logger.warn(`Duplicate request detected: ${idempotencyKey} (age: ${age}ms)`, {
          path: req.path,
          method: req.method,
          idempotencyKey
        });
        
        // If we have a cached response, return it
        if (existing.response) {
          return res.status(existing.statusCode).json(existing.response);
        }

        // Otherwise, return conflict
        return res.status(409).json({
          success: false,
          error: {
            message: 'Duplicate request detected. Please wait before retrying.',
            code: 'DUPLICATE_REQUEST',
            retryAfter: Math.ceil((windowMs - age) / 1000) // seconds
          }
        });
      } else {
        // Old entry, remove it
        idempotencyStore.delete(idempotencyKey);
      }
    }

    // Mark request as in progress
    idempotencyStore.set(idempotencyKey, {
      timestamp: Date.now(),
      inProgress: true
    });

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = function(body) {
      // Cache successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cached = idempotencyStore.get(idempotencyKey);
        if (cached) {
          cached.response = body;
          cached.statusCode = res.statusCode;
          cached.inProgress = false;
        }
      } else {
        // Remove failed requests from cache
        idempotencyStore.delete(idempotencyKey);
      }

      return originalJson(body);
    };

    // Set up timeout to clean up stale in-progress requests
    const timeoutId = setTimeout(() => {
      const entry = idempotencyStore.get(idempotencyKey);
      // Only delete if still in progress (no response cached yet)
      if (entry && entry.inProgress && !entry.response) {
        idempotencyStore.delete(idempotencyKey);
      }
    }, windowMs * 2);

    // Clean up on request completion
    res.on('finish', () => {
      clearTimeout(timeoutId);
      // Remove failed requests from cache
      if (res.statusCode >= 400) {
        idempotencyStore.delete(idempotencyKey);
      }
    });

    next();
  };
};

/**
 * Middleware specifically for POS sales endpoints
 * Prevents double-click submissions
 */
const preventPOSDuplicates = preventDuplicates({
  windowMs: 5000, // 5 second window for POS (reduced from 10s)
  requireIdempotencyKey: false // Auto-generate from request body
});

module.exports = {
  preventDuplicates,
  preventPOSDuplicates,
  generateIdempotencyKey
};

