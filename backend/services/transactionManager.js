const { transaction } = require('../config/postgres');

/**
 * Transaction Manager
 * Provides transaction execution using PostgreSQL (client passed to operations for use in repos).
 */
class TransactionManager {
  /**
   * Execute operations with rollback support (Postgres: full transaction rollback on error).
   * @param {Array<Function>} operations - Array of async functions that receive (client)
   * @param {Object} options - Options for transaction execution
   */
  async executeWithRollback(operations, options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      logErrors = true,
      operationNames = []
    } = options;

    const executedOperations = [];
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const results = await transaction(async (client) => {
          const out = [];
          for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            const operationName = operationNames[i] || `operation_${i}`;
            try {
              const result = await operation(client);
              out.push(result);
              executedOperations.push({
                name: operationName,
                result,
                timestamp: new Date(),
                attempt: attempt + 1
              });
            } catch (error) {
              executedOperations.push({
                name: operationName,
                error: error.message,
                timestamp: new Date(),
                attempt: attempt + 1,
                failed: true
              });
              throw error;
            }
          }
          return out;
        });

        return {
          success: true,
          results,
          executedOperations,
          attempts: attempt + 1
        };
      } catch (error) {
        if (logErrors) {
          await this.logError(error, executedOperations, attempt + 1);
        }

        if (this.isRetryableError(error) && attempt < maxRetries - 1) {
          attempt++;
          const delay = retryDelay * attempt;
          await this.delay(delay);
          executedOperations.length = 0;
          continue;
        }

        throw new Error(
          `Transaction failed after ${attempt + 1} attempts: ${error.message}`
        );
      }
    }

    throw new Error('Transaction failed (max retries reached)');
  }

  /**
   * Rollback executed operations (generic reversal; operations can implement their own).
   */
  async rollbackOperations(executedOperations) {
    const rollbacks = [];
    for (let i = executedOperations.length - 1; i >= 0; i--) {
      const op = executedOperations[i];
      if (op.failed) continue;
      try {
        const rollbackResult = await this.reverseOperation(op);
        rollbacks.push({ operation: op.name, rolledBack: true, result: rollbackResult });
      } catch (rollbackError) {
        rollbacks.push({ operation: op.name, rolledBack: false, error: rollbackError.message });
      }
    }
    return rollbacks;
  }

  async reverseOperation(operation) {
    console.log(`Attempting to reverse operation: ${operation.name}`);
    if (operation.result && (operation.result.id || operation.result._id)) {
      return { reversed: true, operation: operation.name };
    }
    return { reversed: false, reason: 'No reversal logic available' };
  }

  isRetryableError(error) {
    const code = error && error.code;
    if (code === '40001' || code === '40P01') return true; // serialization_failure, deadlock_detected
    const msg = error.message || '';
    return (
      /deadlock/i.test(msg) ||
      /serialization/i.test(msg) ||
      /connection terminated/i.test(msg)
    );
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async logError(error, executedOperations, attempt) {
    console.error('Transaction Error:', {
      error: { message: error.message, stack: error.stack, code: error.code },
      executedOperations,
      attempt,
      timestamp: new Date()
    });
  }

  async sendToDeadLetterQueue(data) {
    console.error('Dead Letter Queue:', JSON.stringify(data, null, 2));
  }

  async executeWithRetry(operation, options = {}) {
    const { maxRetries = 3, retryDelay = 1000, onRetry = null } = options;
    let attempt = 0;
    let lastError;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempt++;
        if (this.isRetryableError(error) && attempt < maxRetries) {
          if (onRetry) onRetry(attempt, error);
          await this.delay(retryDelay * attempt);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }
}

module.exports = new TransactionManager();
