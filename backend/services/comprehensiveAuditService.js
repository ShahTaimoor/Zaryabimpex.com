const AuditLog = require('../models/AuditLog');
const ImmutableAuditLog = require('../models/ImmutableAuditLog');
const crypto = require('crypto');

/**
 * Comprehensive Audit Service
 * Provides comprehensive audit logging and forensic capabilities
 */
class ComprehensiveAuditService {
  /**
   * Log financial operation with comprehensive details
   */
  async logFinancialOperation(operation) {
    const {
      userId,
      action,
      entityType,
      entityId,
      changes,
      before,
      after,
      ipAddress,
      userAgent,
      reason,
      approvalRequired,
      approvedBy,
      requestMethod,
      requestPath,
      requestBody,
      responseStatus
    } = operation;
    
    // Create audit log
    const auditLog = await AuditLog.create({
      user: userId,
      action: action || 'FINANCIAL_OPERATION',
      documentType: entityType,
      documentId: entityId,
      oldValue: before,
      newValue: after,
      changes: changes || this.detectChanges(before, after),
      timestamp: new Date(),
      ipAddress,
      userAgent,
      reason,
      approvalRequired,
      approvedBy,
      requestMethod,
      requestPath,
      requestBody: this.sanitizeForLogging(requestBody),
      responseStatus
    });
    
    // Write to immutable audit log
    await this.writeToImmutableLog(auditLog);
    
    return auditLog;
  }
  
  /**
   * Detect changes between before and after
   */
  detectChanges(before, after) {
    const changes = [];
    
    if (!before || !after) {
      return changes;
    }
    
    // Handle both objects and primitives
    const beforeObj = typeof before === 'object' ? before : { value: before };
    const afterObj = typeof after === 'object' ? after : { value: after };
    
    const allKeys = new Set([
      ...Object.keys(beforeObj),
      ...Object.keys(afterObj)
    ]);
    
    for (const key of allKeys) {
      if (JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key])) {
        changes.push({
          field: key,
          oldValue: beforeObj[key],
          newValue: afterObj[key]
        });
      }
    }
    
    return changes;
  }
  
  /**
   * Calculate tamper-proof hash
   */
  calculateHash(data) {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }
  
  /**
   * Write to immutable log (append-only)
   */
  async writeToImmutableLog(auditLog) {
    try {
      // Get previous hash for chaining
      const previousLog = await ImmutableAuditLog.findOne()
        .sort({ writtenAt: -1 })
        .select('hash');
      
      const immutableLog = await ImmutableAuditLog.create({
        auditLogId: auditLog._id,
        entityType: auditLog.documentType,
        entityId: auditLog.documentId,
        action: auditLog.action,
        changes: {
          before: auditLog.oldValue,
          after: auditLog.newValue,
          fieldsChanged: auditLog.changes?.map(c => c.field) || []
        },
        user: auditLog.user,
        timestamp: auditLog.timestamp,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        requestMethod: auditLog.requestMethod,
        requestPath: auditLog.requestPath,
        requestBody: auditLog.requestBody,
        responseStatus: auditLog.responseStatus,
        previousHash: previousLog?.hash || null,
        writtenAt: new Date()
      });
      
      return immutableLog;
    } catch (error) {
      console.error('Error writing to immutable audit log:', error);
      // Don't throw - audit logging should not break operations
      return null;
    }
  }
  
  /**
   * Investigate user activity
   */
  async investigateUserActivity(userId, startDate, endDate) {
    return await AuditLog.find({
      user: userId,
      timestamp: { $gte: startDate, $lte: endDate }
    })
    .sort({ timestamp: -1 })
    .populate('user', 'firstName lastName email')
    .lean();
  }
  
  /**
   * Investigate entity changes
   */
  async investigateEntityChanges(entityType, entityId) {
    return await AuditLog.find({
      documentType: entityType,
      documentId: entityId
    })
    .sort({ timestamp: -1 })
    .populate('user', 'firstName lastName email')
    .lean();
  }
  
  /**
   * Investigate financial changes
   */
  async investigateFinancialChanges(accountCode, startDate, endDate) {
    return await AuditLog.find({
      $or: [
        { 'oldValue.accountCode': accountCode },
        { 'newValue.accountCode': accountCode },
        { 'changes.field': 'amount' },
        { 'changes.field': 'balance' }
      ],
      timestamp: { $gte: startDate, $lte: endDate }
    })
    .sort({ timestamp: -1 })
    .populate('user', 'firstName lastName email')
    .lean();
  }
  
  /**
   * Get audit trail for specific transaction
   */
  async getTransactionAuditTrail(transactionId) {
    return await AuditLog.find({
      $or: [
        { documentId: transactionId },
        { 'oldValue.transactionId': transactionId },
        { 'newValue.transactionId': transactionId }
      ]
    })
    .sort({ timestamp: -1 })
    .populate('user', 'firstName lastName email')
    .lean();
  }
  
  /**
   * Verify audit log integrity
   */
  async verifyAuditLogIntegrity() {
    const immutableResult = await ImmutableAuditLog.verifyIntegrity();
    
    // Also check that all recent audit logs have immutable copies
    const recentLogs = await AuditLog.find({
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    }).limit(1000);
    
    const missingImmutable = [];
    for (const log of recentLogs) {
      const immutable = await ImmutableAuditLog.findOne({ auditLogId: log._id });
      if (!immutable) {
        missingImmutable.push({
          auditLogId: log._id,
          action: log.action,
          timestamp: log.timestamp
        });
      }
    }
    
    return {
      immutableIntegrity: immutableResult,
      missingImmutableLogs: missingImmutable,
      verified: immutableResult.verified && missingImmutable.length === 0
    };
  }
  
  /**
   * Sanitize sensitive data for logging
   */
  sanitizeForLogging(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'cvv', 'ssn'];
    const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone
    
    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }
}

module.exports = new ComprehensiveAuditService();

