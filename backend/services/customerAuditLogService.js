const AuditLog = require('../models/AuditLog');

class CustomerAuditLogService {
  /**
   * Log customer creation
   * @param {Object} customer - Created customer
   * @param {Object} user - User creating the customer
   * @param {Object} req - Express request object
   * @returns {Promise<AuditLog>}
   */
  async logCustomerCreation(customer, user, req) {
    return await AuditLog.create({
      entityType: 'Customer',
      entityId: customer._id,
      action: 'CREATE',
      changes: {
        after: this.sanitizeCustomer(customer)
      },
      user: user._id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      reason: 'Customer created',
      metadata: {
        businessName: customer.businessName,
        email: customer.email,
        openingBalance: customer.openingBalance
      }
    });
  }

  /**
   * Log customer update
   * @param {Object} oldCustomer - Customer before update
   * @param {Object} newCustomer - Customer after update
   * @param {Object} user - User updating the customer
   * @param {Object} req - Express request object
   * @param {string} reason - Reason for update
   * @returns {Promise<AuditLog>}
   */
  async logCustomerUpdate(oldCustomer, newCustomer, user, req, reason = 'Customer updated') {
    const fieldsChanged = this.getChangedFields(oldCustomer, newCustomer);
    
    return await AuditLog.create({
      entityType: 'Customer',
      entityId: newCustomer._id,
      action: 'UPDATE',
      changes: {
        before: this.sanitizeCustomer(oldCustomer),
        after: this.sanitizeCustomer(newCustomer),
        fieldsChanged
      },
      user: user._id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      reason,
      metadata: {
        businessName: newCustomer.businessName,
        fieldsChangedCount: fieldsChanged.length
      }
    });
  }

  /**
   * Log customer deletion
   * @param {Object} customer - Deleted customer
   * @param {Object} user - User deleting the customer
   * @param {Object} req - Express request object
   * @param {string} reason - Reason for deletion
   * @returns {Promise<AuditLog>}
   */
  async logCustomerDeletion(customer, user, req, reason) {
    return await AuditLog.create({
      entityType: 'Customer',
      entityId: customer._id,
      action: 'DELETE',
      changes: {
        before: this.sanitizeCustomer(customer)
      },
      user: user._id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      reason: reason || 'Customer deleted',
      metadata: {
        businessName: customer.businessName,
        currentBalance: customer.currentBalance,
        deletionReason: reason
      }
    });
  }

  /**
   * Log balance adjustment
   * @param {string} customerId - Customer ID
   * @param {number} oldBalance - Old balance
   * @param {number} newBalance - New balance
   * @param {Object} user - User making adjustment
   * @param {Object} req - Express request object
   * @param {string} reason - Reason for adjustment
   * @returns {Promise<AuditLog>}
   */
  async logBalanceAdjustment(customerId, oldBalance, newBalance, user, req, reason) {
    return await AuditLog.create({
      entityType: 'Customer',
      entityId: customerId,
      action: 'STOCK_ADJUSTMENT', // Reuse action type
      changes: {
        before: { currentBalance: oldBalance },
        after: { currentBalance: newBalance },
        fieldsChanged: ['currentBalance', 'pendingBalance', 'advanceBalance']
      },
      user: user._id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      reason: reason || 'Balance adjustment',
      metadata: {
        balanceChange: newBalance - oldBalance,
        balanceChangeType: newBalance > oldBalance ? 'increase' : 'decrease'
      }
    });
  }

  /**
   * Log credit limit change
   * @param {string} customerId - Customer ID
   * @param {number} oldLimit - Old credit limit
   * @param {number} newLimit - New credit limit
   * @param {Object} user - User making change
   * @param {Object} req - Express request object
   * @param {string} reason - Reason for change
   * @returns {Promise<AuditLog>}
   */
  async logCreditLimitChange(customerId, oldLimit, newLimit, user, req, reason) {
    return await AuditLog.create({
      entityType: 'Customer',
      entityId: customerId,
      action: 'UPDATE',
      changes: {
        before: { creditLimit: oldLimit },
        after: { creditLimit: newLimit },
        fieldsChanged: ['creditLimit']
      },
      user: user._id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      reason: reason || 'Credit limit changed',
      metadata: {
        creditLimitChange: newLimit - oldLimit
      }
    });
  }

  /**
   * Log customer suspension
   * @param {string} customerId - Customer ID
   * @param {string} reason - Suspension reason
   * @param {Object} user - User suspending
   * @param {Object} req - Express request object
   * @returns {Promise<AuditLog>}
   */
  async logCustomerSuspension(customerId, reason, user, req) {
    return await AuditLog.create({
      entityType: 'Customer',
      entityId: customerId,
      action: 'STATUS_CHANGE',
      changes: {
        after: { status: 'suspended' },
        fieldsChanged: ['status']
      },
      user: user._id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      reason: reason || 'Customer suspended',
      metadata: {
        suspensionReason: reason
      }
    });
  }

  /**
   * Get audit logs for a customer
   * @param {string} customerId - Customer ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getCustomerAuditLogs(customerId, options = {}) {
    const { limit = 50, skip = 0, action, startDate, endDate } = options;
    
    const filter = {
      entityType: 'Customer',
      entityId: customerId
    };

    if (action) {
      filter.action = action;
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    return await AuditLog.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Get changed fields between two customer objects
   * @param {Object} oldCustomer - Old customer
   * @param {Object} newCustomer - New customer
   * @returns {Array<string>}
   */
  getChangedFields(oldCustomer, newCustomer) {
    const fieldsChanged = [];
    const fieldsToCheck = [
      'name',
      'email',
      'phone',
      'businessName',
      'businessType',
      'customerTier',
      'creditLimit',
      'paymentTerms',
      'discountPercent',
      'currentBalance',
      'pendingBalance',
      'advanceBalance',
      'status'
    ];

    fieldsToCheck.forEach(field => {
      const oldValue = this.getNestedValue(oldCustomer, field);
      const newValue = this.getNestedValue(newCustomer, field);
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        fieldsChanged.push(field);
      }
    });

    return fieldsChanged;
  }

  /**
   * Get nested value from object
   * @param {Object} obj - Object
   * @param {string} path - Dot-separated path
   * @returns {*}
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => {
      return current && current[prop] !== undefined ? current[prop] : undefined;
    }, obj);
  }

  /**
   * Log customer merge
   * @param {String} sourceCustomerId - Source customer ID
   * @param {String} targetCustomerId - Target customer ID
   * @param {Object} user - User performing merge
   * @param {Object} mergeDetails - Merge details
   * @returns {Promise<AuditLog>}
   */
  async logCustomerMerge(sourceCustomerId, targetCustomerId, user, mergeDetails) {
    return await AuditLog.create({
      entityType: 'Customer',
      entityId: targetCustomerId,
      action: 'UPDATE', // Using UPDATE as merge is a form of update
      changes: {
        after: {
          mergedFrom: sourceCustomerId,
          mergedBalances: mergeDetails.mergedBalances,
          transactionsMoved: mergeDetails.transactionsMoved,
          salesOrdersMoved: mergeDetails.salesOrdersMoved
        },
        fieldsChanged: ['pendingBalance', 'advanceBalance', 'currentBalance']
      },
      user: user._id,
      reason: `Customer merged: ${mergeDetails.sourceName} into ${mergeDetails.targetName}`,
      metadata: {
        mergeOperation: true,
        sourceCustomerId,
        sourceName: mergeDetails.sourceName,
        targetName: mergeDetails.targetName,
        mergedBalances: mergeDetails.mergedBalances
      }
    });
  }

  /**
   * Sanitize customer for audit log (remove sensitive/unnecessary data)
   * @param {Object} customer - Customer object
   * @returns {Object}
   */
  sanitizeCustomer(customer) {
    if (!customer) return null;
    
    const customerObj = customer.toObject ? customer.toObject() : customer;
    
    return {
      _id: customerObj._id,
      name: customerObj.name,
      email: customerObj.email,
      phone: customerObj.phone,
      businessName: customerObj.businessName,
      businessType: customerObj.businessType,
      customerTier: customerObj.customerTier,
      creditLimit: customerObj.creditLimit,
      currentBalance: customerObj.currentBalance,
      pendingBalance: customerObj.pendingBalance,
      advanceBalance: customerObj.advanceBalance,
      status: customerObj.status,
      version: customerObj.__v || customerObj.version
    };
  }
}

module.exports = new CustomerAuditLogService();

