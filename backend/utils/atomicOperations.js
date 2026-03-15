/**
 * Atomic Operations Utility for MongoDB
 * Provides safe CRUD operations using atomic operators like $inc, $set, etc.
 * Prevents race conditions and WriteConflict errors
 */

const mongoose = require('mongoose');
const { retryMongoOperation } = require('./retry');

/**
 * Atomically increment/decrement a numeric field
 * @param {mongoose.Model} Model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {Object} updates - Field updates with $inc, $set, etc.
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Updated document
 */
const atomicUpdate = async (Model, filter, updates, options = {}) => {
  const {
    upsert = false,
    returnDocument = 'after', // 'before' | 'after'
    maxRetries = 5
  } = options;

  return retryMongoOperation(async () => {
    const updateOptions = {
      new: returnDocument === 'after',
      upsert,
      runValidators: true,
      setDefaultsOnInsert: true
    };

    const result = await Model.findOneAndUpdate(filter, updates, updateOptions);
    
    if (!result && !upsert) {
      throw new Error(`Document not found with filter: ${JSON.stringify(filter)}`);
    }

    return result;
  }, { maxRetries });
};

/**
 * Atomically increment a numeric field
 * @param {mongoose.Model} Model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {string} field - Field to increment
 * @param {number} amount - Amount to increment (can be negative)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Updated document
 */
const atomicIncrement = async (Model, filter, field, amount, options = {}) => {
  const updates = { $inc: { [field]: amount } };
  
  // Add additional updates if provided
  if (options.additionalUpdates) {
    Object.assign(updates, options.additionalUpdates);
  }

  return atomicUpdate(Model, filter, updates, options);
};

/**
 * Atomically update stock level
 * Prevents negative stock unless explicitly allowed
 * @param {mongoose.Model} Model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {number} quantity - Quantity to change (positive for increase, negative for decrease)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Updated document
 */
const atomicStockUpdate = async (Model, filter, quantity, options = {}) => {
  const {
    allowNegative = false,
    stockField = 'currentStock',
    minStock = 0
  } = options;

  // Build update with conditional logic
  const updates = {
    $inc: { [stockField]: quantity },
    $set: { lastUpdated: new Date() }
  };

  // Add minimum stock constraint if not allowing negative
  if (!allowNegative) {
    // Use aggregation pipeline for conditional updates
    const pipeline = [
      { $match: filter },
      {
        $set: {
          [stockField]: {
            $max: [
              { $add: [`$${stockField}`, quantity] },
              minStock
            ]
          },
          lastUpdated: new Date()
        }
      }
    ];

    return retryMongoOperation(async () => {
      const result = await Model.aggregate(pipeline);
      if (!result || result.length === 0) {
        throw new Error(`Document not found with filter: ${JSON.stringify(filter)}`);
      }
      
      // Fetch the updated document
      return await Model.findOne(filter);
    });
  }

  return atomicUpdate(Model, filter, updates, options);
};

/**
 * Atomically update balance (for customers, accounts, etc.)
 * @param {mongoose.Model} Model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {number} amount - Amount to change (positive for increase, negative for decrease)
 * @param {string} balanceField - Field name for balance (default: 'currentBalance')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Updated document
 */
const atomicBalanceUpdate = async (Model, filter, amount, balanceField = 'currentBalance', options = {}) => {
  const updates = {
    $inc: { [balanceField]: amount },
    $set: { lastUpdated: new Date() }
  };

  return atomicUpdate(Model, filter, updates, options);
};

/**
 * Atomically add item to array (prevents duplicates)
 * @param {mongoose.Model} Model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {string} arrayField - Array field name
 * @param {Object} item - Item to add
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Updated document
 */
const atomicArrayAdd = async (Model, filter, arrayField, item, options = {}) => {
  const {
    unique = true, // Prevent duplicates
    position = 'end' // 'start' | 'end'
  } = options;

  let updates;
  
  if (unique) {
    // Use $addToSet to prevent duplicates
    updates = {
      $addToSet: { [arrayField]: item }
    };
  } else {
    // Use $push
    if (position === 'start') {
      updates = {
        $push: { [arrayField]: { $each: [item], $position: 0 } }
      };
    } else {
      updates = {
        $push: { [arrayField]: item }
      };
    }
  }

  return atomicUpdate(Model, filter, updates, options);
};

/**
 * Atomically remove item from array
 * @param {mongoose.Model} Model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {string} arrayField - Array field name
 * @param {Object} itemFilter - Filter to match items to remove
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Updated document
 */
const atomicArrayRemove = async (Model, filter, arrayField, itemFilter, options = {}) => {
  const updates = {
    $pull: { [arrayField]: itemFilter }
  };

  return atomicUpdate(Model, filter, updates, options);
};

/**
 * Atomically update multiple fields
 * @param {mongoose.Model} Model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {Object} setFields - Fields to set
 * @param {Object} incFields - Fields to increment
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Updated document
 */
const atomicMultiUpdate = async (Model, filter, { setFields = {}, incFields = {}, pushFields = {}, pullFields = {} }, options = {}) => {
  const updates = {};

  if (Object.keys(setFields).length > 0) {
    updates.$set = setFields;
  }

  if (Object.keys(incFields).length > 0) {
    updates.$inc = incFields;
  }

  if (Object.keys(pushFields).length > 0) {
    updates.$push = pushFields;
  }

  if (Object.keys(pullFields).length > 0) {
    updates.$pull = pullFields;
  }

  return atomicUpdate(Model, filter, updates, options);
};

module.exports = {
  atomicUpdate,
  atomicIncrement,
  atomicStockUpdate,
  atomicBalanceUpdate,
  atomicArrayAdd,
  atomicArrayRemove,
  atomicMultiUpdate
};

