const mongoose = require('mongoose');

/**
 * Run a transactional operation with automatic retry for transient errors.
 *
 * Retries on:
 * - TransientTransactionError
 * - UnknownTransactionCommitResult
 * - WriteConflict
 *
 * @param {function(mongoose.ClientSession): Promise<any>} txnFn - Function that receives a session and performs DB work.
 * @param {object} [options] - Transaction options and retry config.
 * @param {number} [options.maxRetries=5] - Maximum number of retries for transient errors.
 * @returns {Promise<any>} Result of txnFn on success.
 */
async function runWithTransactionRetry(txnFn, options = {}) {
  const {
    maxRetries = 5,
    // Reasonable defaults for production-safe transactions
    readConcern = { level: 'snapshot' },
    writeConcern = { w: 'majority' },
    readPreference = 'primary',
    ...restOptions
  } = options;

  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const session = await mongoose.startSession();

    try {
      let result;

      await session.withTransaction(
        async () => {
          result = await txnFn(session);
        },
        {
          readConcern,
          writeConcern,
          readPreference,
          ...restOptions
        }
      );

      await session.endSession();
      return result;
    } catch (err) {
      const labels = err && err.errorLabels ? err.errorLabels : [];
      const isTransient =
        labels.includes('TransientTransactionError') ||
        labels.includes('UnknownTransactionCommitResult') ||
        err.codeName === 'WriteConflict';

      try {
        // Abort if still active; ignore errors from abort
        await session.abortTransaction();
      } catch (abortErr) {
        // noop
      } finally {
        await session.endSession();
      }

      if (!isTransient || attempt >= maxRetries) {
        throw err;
      }

      attempt += 1;

      // Simple exponential backoff to avoid hot-looping
      const backoffMs = 100 * attempt;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

module.exports = {
  runWithTransactionRetry
};


