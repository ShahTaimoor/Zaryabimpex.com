const { runWithTransactionRetry } = require('./transactionUtils');

/**
 * Execute one business event with:
 * 1) atomic DB writes inside a transaction
 * 2) optional post-commit side effects outside the transaction
 *
 * Usage:
 *   const result = await withBusinessTransaction(async ({ client, addPostCommit }) => {
 *     await repoA.create(dataA, client);
 *     await repoB.update(id, patch, client);
 *
 *     addPostCommit(async () => notifications.send(...));
 *     addPostCommit(async () => analytics.track(...));
 *
 *     return { ok: true };
 *   });
 *
 * @param {(ctx: {client: import('pg').PoolClient, addPostCommit: (fn: Function) => void}) => Promise<any>} eventFn
 * @param {object} [options]
 * @param {number} [options.maxRetries=5] retries for transient DB errors (40001, 40P01)
 * @param {(error: Error, index: number) => Promise<void>|void} [options.onPostCommitError]
 * @returns {Promise<any>}
 */
async function withBusinessTransaction(eventFn, options = {}) {
  const { maxRetries = 5, onPostCommitError = defaultPostCommitErrorHandler } = options;
  const postCommitTasks = [];

  const addPostCommit = (fn) => {
    if (typeof fn !== 'function') {
      throw new Error('addPostCommit expects a function');
    }
    postCommitTasks.push(fn);
  };

  const result = await runWithTransactionRetry(async (client) => {
    return await eventFn({ client, addPostCommit });
  }, { maxRetries });

  for (let i = 0; i < postCommitTasks.length; i += 1) {
    try {
      await postCommitTasks[i]();
    } catch (error) {
      await onPostCommitError(error, i);
    }
  }

  return result;
}

async function defaultPostCommitErrorHandler(error, index) {
  console.error(`Post-commit task ${index + 1} failed:`, error?.message || error);
}

module.exports = {
  withBusinessTransaction
};
