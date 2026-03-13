/**
 * Request Locking Utility
 * Prevents duplicate submissions and double-clicks in POS applications
 * Uses idempotency keys to ensure requests are processed only once
 */

// In-memory store for active requests (use sessionStorage for persistence across refreshes)
const activeRequests = new Map();

// Generate a unique idempotency key
export const generateIdempotencyKey = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Check if a request is currently in progress
 * @param {string} key - Request key (idempotency key or request identifier)
 * @returns {boolean} True if request is in progress
 */
export const isRequestInProgress = (key) => {
  return activeRequests.has(key);
};

/**
 * Lock a request to prevent duplicate submissions
 * @param {string} key - Request key
 * @param {Object} options - Lock options
 * @param {number} options.timeout - Lock timeout in ms (default: 30000)
 * @returns {boolean} True if lock was acquired, false if already locked
 */
export const lockRequest = (key, options = {}) => {
  const { timeout = 30000 } = options;
  
  if (activeRequests.has(key)) {
    return false; // Request already in progress
  }

  // Set lock with expiration
  activeRequests.set(key, {
    timestamp: Date.now(),
    timeout
  });

  // Auto-release lock after timeout
  setTimeout(() => {
    if (activeRequests.has(key)) {
      activeRequests.delete(key);
    }
  }, timeout);

  return true;
};

/**
 * Release a request lock
 * @param {string} key - Request key
 */
export const releaseRequest = (key) => {
  activeRequests.delete(key);
};

/**
 * Clear all expired locks
 */
export const clearExpiredLocks = () => {
  const now = Date.now();
  for (const [key, data] of activeRequests.entries()) {
    if (now - data.timestamp > data.timeout) {
      activeRequests.delete(key);
    }
  }
};

// Clean up expired locks every minute
setInterval(clearExpiredLocks, 60000);

/**
 * Create a request wrapper that prevents duplicate submissions
 * @param {Function} requestFn - Async function to execute
 * @param {Object} options - Options
 * @param {string} options.idempotencyKey - Custom idempotency key (auto-generated if not provided)
 * @param {number} options.timeout - Lock timeout in ms (default: 30000)
 * @param {boolean} options.autoRelease - Auto-release lock on completion (default: true)
 * @returns {Promise} Result of the request function
 */
export const withRequestLock = async (requestFn, options = {}) => {
  const {
    idempotencyKey,
    timeout = 30000,
    autoRelease = true
  } = options;

  const key = idempotencyKey || generateIdempotencyKey();

  // Try to acquire lock
  if (!lockRequest(key, { timeout })) {
    throw new Error('Request is already in progress. Please wait.');
  }

  try {
    const result = await requestFn(key);
    return result;
  } catch (error) {
    // Don't release lock on error - let timeout handle it
    // This prevents immediate retries on transient errors
    throw error;
  } finally {
    if (autoRelease) {
      // Small delay before release to prevent rapid re-submissions
      setTimeout(() => {
        releaseRequest(key);
      }, 1000);
    }
  }
};

/**
 * Generate idempotency key from request data
 * Useful for creating consistent keys from form data
 * @param {Object} data - Request data
 * @param {string} endpoint - API endpoint
 * @returns {string} Idempotency key
 */
export const generateKeyFromData = (data, endpoint) => {
  const dataString = JSON.stringify(data);
  const hash = btoa(dataString).substring(0, 32);
  return `${endpoint}:${hash}`;
};

export default {
  generateIdempotencyKey,
  isRequestInProgress,
  lockRequest,
  releaseRequest,
  withRequestLock,
  generateKeyFromData
};

