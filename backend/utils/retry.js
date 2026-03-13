/**
 * Retry Utility for MongoDB WriteConflict and TransientTransaction Errors
 * Implements exponential backoff for retryable operations
 * Production-ready solution for handling concurrent MongoDB write conflicts
 */

/**
 * Check if error is a retryable MongoDB error
 * @param {Error} error - Error to check
 * @returns {boolean} True if error should be retried
 */
const isRetryableError = (error) => {
  if (!error) return false;

  // WriteConflict error (code 112)
  if (error.code === 112 || error.codeName === 'WriteConflict') {
    return true;
  }

  // TransientTransactionError (MongoDB transaction errors)
  if (error.errorLabels && Array.isArray(error.errorLabels)) {
    if (error.errorLabels.includes('TransientTransactionError')) {
      return true;
    }
  }

  // Check error message for transient transaction indicators
  const message = (error.message || '').toLowerCase();
  if (message.includes('transienttransactionerror') ||
      message.includes('please retry your operation') ||
      message.includes('multi-document transaction')) {
    return true;
  }

  // Network and timeout errors
  if (error.name === 'MongoNetworkError' || 
      error.name === 'MongoTimeoutError' ||
      error.name === 'MongoServerSelectionError') {
    return true;
  }

  // Connection errors
  if (error.code === 6 || // HostUnreachable
      error.code === 7 || // HostNotFound
      error.code === 89 || // NetworkTimeout
      error.code === 91) { // ShutdownInProgress
    return true;
  }

  return false;
};

/**
 * Check if error is a duplicate key error (should NOT be retried)
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is a duplicate key error
 */
const isDuplicateKeyError = (error) => {
  return error.code === 11000 || error.codeName === 'DuplicateKey';
};

/**
 * Retry a function with exponential backoff for retryable errors
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 5)
 * @param {number} options.initialDelay - Initial delay in ms (default: 50)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 2000)
 * @param {number} options.multiplier - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Custom function to determine if error should be retried
 * @param {boolean} options.jitter - Add random jitter to delay (default: true)
 * @returns {Promise} Result of the function
 */
const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 5,
    initialDelay = 50,
    maxDelay = 2000,
    multiplier = 2,
    jitter = true,
    shouldRetry = isRetryableError
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Never retry duplicate key errors - these are permanent failures
      if (isDuplicateKeyError(error)) {
        throw error;
      }

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      let currentDelay = Math.min(delay, maxDelay);
      
      // Add jitter to prevent thundering herd
      if (jitter) {
        const jitterAmount = currentDelay * 0.1; // 10% jitter
        currentDelay += (Math.random() * 2 - 1) * jitterAmount;
        currentDelay = Math.max(0, currentDelay);
      }
      
      const logContext = {
        attempt: attempt + 1,
        maxRetries,
        delay: Math.round(currentDelay),
        error: {
          code: error.code,
          codeName: error.codeName,
          name: error.name,
          message: error.message?.substring(0, 100)
        }
      };

      console.log(`[Retry] Attempt ${logContext.attempt}/${maxRetries} after ${logContext.delay}ms`, logContext.error);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, Math.round(currentDelay)));

      // Increase delay for next attempt
      delay *= multiplier;
    }
  }

  // All retries exhausted
  console.error(`[Retry] All ${maxRetries} retry attempts exhausted`, {
    code: lastError?.code,
    codeName: lastError?.codeName,
    message: lastError?.message
  });
  throw lastError;
};

/**
 * Retry a MongoDB operation with WriteConflict and TransientTransactionError handling
 * Specifically designed for MongoDB operations that may encounter write conflicts
 * @param {Function} operation - Async MongoDB operation to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the operation
 */
const retryMongoOperation = async (operation, options = {}) => {
  return retryWithBackoff(operation, {
    maxRetries: options.maxRetries || 5,
    initialDelay: options.initialDelay || 50,
    maxDelay: options.maxDelay || 2000,
    shouldRetry: isRetryableError,
    ...options
  });
};

/**
 * Retry a MongoDB transaction operation
 * Handles both WriteConflict and TransientTransactionError
 * @param {Function} operation - Async transaction operation
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the operation
 */
const retryMongoTransaction = async (operation, options = {}) => {
  return retryMongoOperation(operation, {
    maxRetries: options.maxRetries || 5,
    initialDelay: options.initialDelay || 100, // Slightly longer initial delay for transactions
    maxDelay: options.maxDelay || 3000, // Longer max delay for transactions
    ...options
  });
};

module.exports = {
  retryWithBackoff,
  retryMongoOperation,
  retryMongoTransaction,
  isRetryableError,
  isDuplicateKeyError
};

