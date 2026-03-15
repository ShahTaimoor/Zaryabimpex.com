const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Financial Statement Export Audit Trail Model
 * CRITICAL: Tracks all financial statement exports for audit compliance
 * Required for SOX compliance and data security
 */
const financialStatementExportSchema = new mongoose.Schema({
  statementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinancialStatement',
    required: true,
    index: true
  },
  statementType: {
    type: String,
    enum: ['profit_loss', 'balance_sheet', 'cash_flow'],
    required: true
  },
  exportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  exportedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  format: {
    type: String,
    enum: ['pdf', 'excel', 'csv', 'json'],
    required: true
  },
  fileSize: {
    type: Number // Size in bytes
  },
  fileHash: {
    type: String // SHA-256 hash for integrity verification
  },
  downloadUrl: {
    type: String
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  approvalRequired: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  purpose: {
    type: String,
    trim: true,
    maxlength: 500
  },
  recipient: {
    type: String,
    trim: true,
    maxlength: 200
  },
  retentionPeriod: {
    type: Number, // Days to retain
    default: 90
  },
  deletedAt: Date,
  deletionReason: String,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Indexes
financialStatementExportSchema.index({ statementId: 1, exportedAt: -1 });
financialStatementExportSchema.index({ exportedBy: 1, exportedAt: -1 });
financialStatementExportSchema.index({ format: 1, exportedAt: -1 });

// Static method to calculate file hash
financialStatementExportSchema.statics.calculateFileHash = function(fileBuffer) {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

// Instance method to verify file integrity
financialStatementExportSchema.methods.verifyIntegrity = function(fileBuffer) {
  if (!this.fileHash) {
    return { valid: false, reason: 'No hash stored for this export' };
  }
  
  const calculatedHash = this.constructor.calculateFileHash(fileBuffer);
  const isValid = calculatedHash === this.fileHash;
  
  return {
    valid: isValid,
    storedHash: this.fileHash,
    calculatedHash: calculatedHash,
    reason: isValid ? 'File integrity verified' : 'File hash mismatch - file may have been modified'
  };
};

module.exports = mongoose.model('FinancialStatementExport', financialStatementExportSchema);

