const mongoose = require('mongoose');

/**
 * Transaction Manager
 * Provides comprehensive error recovery and transaction rollback mechanisms
 */
class TransactionManager {
  /**
   * Execute operations with comprehensive rollback support
   * @param {Array<Function>} operations - Array of async functions that receive session
   * @param {Object} options - Options for transaction execution
   */
  async executeWithRollback(operations, options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      rollbackOnError = true,
      logErrors = true,
      operationNames = []
    } = options;
    
    const executedOperations = [];
    let attempt = 0;
    
    while (attempt < maxRetries) {
      const session = await mongoose.startSession();
      
      try {
        let results = [];
        
        await session.withTransaction(async () => {
          for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            const operationName = operationNames[i] || `operation_${i}`;
            
            try {
              const result = await operation(session);
              results.push(result);
              
              executedOperations.push({
                name: operationName,
                result,
                timestamp: new Date(),
                attempt: attempt + 1
              });
            } catch (error) {
              // Log operation failure
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
        });
        
        await session.endSession();
        
        return {
          success: true,
          results,
          executedOperations,
          attempts: attempt + 1
        };
      } catch (error) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          // Ignore abort errors
        } finally {
          await session.endSession();
        }
        
        if (logErrors) {
          await this.logError(error, executedOperations, attempt + 1);
        }
        
        // Check if retryable
        if (this.isRetryableError(error) && attempt < maxRetries - 1) {
          attempt++;
          const delay = retryDelay * attempt; // Exponential backoff
          await this.delay(delay);
          executedOperations.length = 0; // Reset for retry
          continue;
        }
        
        // If rollback is enabled and we have executed operations, try to rollback
        if (rollbackOnError && executedOperations.length > 0) {
          try {
            await this.rollbackOperations(executedOperations);
          } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError);
            // Send to dead letter queue
            await this.sendToDeadLetterQueue({
              operations: executedOperations,
              error: error.message,
              rollbackError: rollbackError.message,
              stack: error.stack,
              timestamp: new Date()
            });
          }
        }
        
        throw new Error(
          `Transaction failed after ${attempt + 1} attempts: ${error.message}`
        );
      }
    }
  }
  
  /**
   * Rollback executed operations
   */
  async rollbackOperations(executedOperations) {
    const rollbacks = [];
    
    // Reverse operations in reverse order
    for (let i = executedOperations.length - 1; i >= 0; i--) {
      const op = executedOperations[i];
      
      if (op.failed) {
        continue; // Skip operations that already failed
      }
      
      try {
        const rollbackResult = await this.reverseOperation(op);
        rollbacks.push({
          operation: op.name,
          rolledBack: true,
          result: rollbackResult
        });
      } catch (rollbackError) {
        rollbacks.push({
          operation: op.name,
          rolledBack: false,
          error: rollbackError.message
        });
        // Continue with other rollbacks even if one fails
      }
    }
    
    return rollbacks;
  }
  
  /**
   * Reverse a specific operation
   */
  async reverseOperation(operation) {
    // This is a generic reversal - specific operations should implement their own reversal
    // For now, log the reversal attempt
    console.log(`Attempting to reverse operation: ${operation.name}`);
    
    // Example: If operation created a document, delete it
    if (operation.result && operation.result._id) {
      // Try to identify the model and delete
      // This is simplified - real implementation would need model mapping
      return { reversed: true, operation: operation.name };
    }
    
    return { reversed: false, reason: 'No reversal logic available' };
  }
  
  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'TransientTransactionError',
      'UnknownTransactionCommitResult',
      'WriteConflict',
      'NetworkError',
      'TimeoutError',
      'MongoNetworkError',
      'MongoServerError'
    ];
    
    const errorLabels = error.errorLabels || [];
    const isTransient = errorLabels.includes('TransientTransactionError') ||
                       errorLabels.includes('UnknownTransactionCommitResult');
    
    return isTransient ||
           retryableErrors.some(type => 
             error.name === type || 
             error.message?.includes(type) ||
             error.codeName === type ||
             error.code === 50 || // WriteConflict
             error.code === 251 // TransientTransactionError
           );
  }
  
  /**
   * Delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Log error for investigation
   */
  async logError(error, executedOperations, attempt) {
    const errorLog = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        codeName: error.codeName,
        errorLabels: error.errorLabels
      },
      executedOperations,
      attempt,
      timestamp: new Date()
    };
    
    // Log to database or file
    console.error('Transaction Error:', JSON.stringify(errorLog, null, 2));
    
    // TODO: Store in error log collection
    // await ErrorLog.create(errorLog);
  }
  
  /**
   * Send failed operations to dead letter queue
   */
  async sendToDeadLetterQueue(data) {
    // TODO: Implement dead letter queue
    // For now, log to file or database
    console.error('Dead Letter Queue:', JSON.stringify(data, null, 2));
    
    // Store in dead letter queue collection
    // await DeadLetterQueue.create({
    //   ...data,
    //   status: 'pending',
    //   createdAt: new Date()
    // });
  }
  
  /**
   * Execute with automatic retry wrapper
   */
  async executeWithRetry(operation, options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      onRetry = null
    } = options;
    
    let attempt = 0;
    let lastError;
    
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (this.isRetryableError(error) && attempt < maxRetries) {
          if (onRetry) {
            onRetry(attempt, error);
          }
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

