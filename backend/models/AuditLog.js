const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Entity Information
  entityType: {
    type: String,
    required: true,
    enum: ['Product', 'Inventory', 'Sales', 'Purchase', 'Customer', 'Supplier'],
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
    enum: [
      'CREATE',
      'UPDATE',
      'DELETE',
      'RESTORE',
      'STOCK_ADJUSTMENT',
      'PRICE_CHANGE',
      'STATUS_CHANGE',
      'BULK_UPDATE',
      'IMPORT',
      'EXPORT',
      'FINANCIAL_OPERATION',
      'unauthorized_access_attempt'
    ],
    index: true
  },

  // Document type (for compatibility with comprehensive audit)
  documentType: {
    type: String,
    index: true
  },

  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },

  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,

  // Request details
  requestMethod: String,
  requestPath: String,
  requestBody: mongoose.Schema.Types.Mixed,
  responseStatus: Number,
  duration: Number, // Response time in milliseconds

  // Approval tracking
  approvalRequired: Boolean,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Description
  description: String,

  // Change Details
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    fieldsChanged: [String]
  },

  // User Information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },

  // Request Information
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },

  // Additional Information
  reason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  }
}, {
  timestamps: false, // We use custom timestamp field
  collection: 'auditlogs'
});

// Compound indexes for common queries
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 }); // For time-based queries

// TTL index to auto-delete old logs after 2 years (optional, adjust as needed)
// auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

