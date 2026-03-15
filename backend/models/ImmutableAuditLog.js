const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Immutable Audit Log
 * Tamper-proof audit log for forensic investigation
 * This collection is append-only and cannot be modified
 */
const immutableAuditLogSchema = new mongoose.Schema({
  // Reference to original audit log
  auditLogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditLog',
    index: true
  },
  
  // Entity Information
  entityType: {
    type: String,
    required: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Action Information
  action: {
    type: String,
    required: true,
    index: true
  },
  
  // Change Details (immutable copy)
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    fieldsChanged: [String]
  },
  
  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Timestamp
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // IP Address and User Agent
  ipAddress: String,
  userAgent: String,
  
  // Request details
  requestMethod: String,
  requestPath: String,
  requestBody: mongoose.Schema.Types.Mixed,
  responseStatus: Number,
  
  // Tamper-proof hash
  hash: {
    type: String,
    required: true,
    index: true
  },
  
  // Previous hash (chain)
  previousHash: {
    type: String,
    index: true
  },
  
  // Written timestamp (when written to immutable log)
  writtenAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // Immutable flag
  immutable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: false, // Don't use timestamps, use writtenAt instead
  collection: 'immutableauditlogs'
});

// Indexes for performance
immutableAuditLogSchema.index({ user: 1, timestamp: -1 });
immutableAuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
immutableAuditLogSchema.index({ action: 1, timestamp: -1 });
immutableAuditLogSchema.index({ hash: 1 });
immutableAuditLogSchema.index({ writtenAt: -1 });

// Pre-save hook to calculate hash and chain
immutableAuditLogSchema.pre('save', async function(next) {
  // Calculate hash of current document
  const dataToHash = {
    auditLogId: this.auditLogId,
    entityType: this.entityType,
    entityId: this.entityId,
    action: this.action,
    changes: this.changes,
    user: this.user,
    timestamp: this.timestamp,
    ipAddress: this.ipAddress,
    writtenAt: this.writtenAt
  };
  
  this.hash = crypto.createHash('sha256')
    .update(JSON.stringify(dataToHash))
    .digest('hex');
  
  // Get previous hash for chaining
  if (this.isNew) {
    const previousLog = await this.constructor.findOne()
      .sort({ writtenAt: -1 })
      .select('hash');
    
    if (previousLog) {
      this.previousHash = previousLog.hash;
    }
  }
  
  next();
});

// Prevent updates and deletes
immutableAuditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function() {
  throw new Error('ImmutableAuditLog cannot be modified or deleted');
});

// Static method to verify integrity
immutableAuditLogSchema.statics.verifyIntegrity = async function() {
  const logs = await this.find().sort({ writtenAt: 1 });
  const issues = [];
  
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    
    // Verify hash
    const dataToHash = {
      auditLogId: log.auditLogId,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      changes: log.changes,
      user: log.user,
      timestamp: log.timestamp,
      ipAddress: log.ipAddress,
      writtenAt: log.writtenAt
    };
    
    const calculatedHash = crypto.createHash('sha256')
      .update(JSON.stringify(dataToHash))
      .digest('hex');
    
    if (calculatedHash !== log.hash) {
      issues.push({
        logId: log._id,
        type: 'hash_mismatch',
        storedHash: log.hash,
        calculatedHash,
        severity: 'critical'
      });
    }
    
    // Verify chain (if not first log)
    if (i > 0) {
      const previousLog = logs[i - 1];
      if (log.previousHash !== previousLog.hash) {
        issues.push({
          logId: log._id,
          type: 'chain_break',
          expectedHash: previousLog.hash,
          storedHash: log.previousHash,
          severity: 'critical'
        });
      }
    }
  }
  
  return {
    verified: issues.length === 0,
    issues,
    totalLogs: logs.length
  };
};

const ImmutableAuditLog = mongoose.model('ImmutableAuditLog', immutableAuditLogSchema);

module.exports = ImmutableAuditLog;

