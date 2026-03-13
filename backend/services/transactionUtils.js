const { transaction } = require('../config/postgres');

/**
 * Run a transactional operation with automatic retry for transient errors.
 *
 * Uses PostgreSQL; retries on serialization_failure (40001) and deadlock_detected (40P01).
 *
 * @param {function(import('pg').PoolClient): Promise<any>} txnFn - Function that receives a pg client and performs DB work.
 * @param {object} [options] - Transaction options and retry config.
 * @param {number} [options.maxRetries=5] - Maximum number of retries for transient errors.
 * @returns {Promise<any>} Result of txnFn on success.
 */
async function runWithTransactionRetry(txnFn, options = {}) {
  const { maxRetries = 5 } = options;

  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await transaction(async (client) => {
        return await txnFn(client);
      });
    } catch (err) {
      const code = err && err.code;
      const isTransient =
        code === '40001' || // serialization_failure
        code === '40P01';   // deadlock_detected

      if (!isTransient || attempt >= maxRetries) {
        throw err;
      }

      attempt += 1;
      const backoffMs = 100 * attempt;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

module.exports = {
  runWithTransactionRetry
};
