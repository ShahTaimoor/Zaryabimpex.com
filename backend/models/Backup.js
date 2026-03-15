const mongoose = require('mongoose');

const BackupSchema = new mongoose.Schema({
  backupId: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    enum: ['full', 'incremental', 'differential', 'schema_only', 'data_only'],
    required: true,
  },
  schedule: {
    type: String,
    enum: ['hourly', 'daily', 'weekly', 'monthly', 'manual'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  database: {
    name: {
      type: String,
      required: true,
    },
    version: String,
    size: Number, // in bytes
  },
  collections: [{
    name: String,
    count: Number,
    size: Number, // in bytes
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'],
    },
    error: String,
  }],
  files: {
    local: {
      path: String,
      size: Number,
      checksum: String,
      createdAt: Date,
    },
    remote: [{
      provider: {
        type: String,
        enum: ['aws_s3', 'google_cloud', 'azure_blob', 'dropbox', 'local'],
      },
      path: String,
      url: String,
      size: Number,
      checksum: String,
      uploadedAt: Date,
      status: {
        type: String,
        enum: ['pending', 'uploading', 'completed', 'failed'],
        default: 'pending',
      },
      error: String,
    }],
  },
  compression: {
    enabled: {
      type: Boolean,
      default: true,
    },
    algorithm: {
      type: String,
      enum: ['gzip', 'bzip2', 'zip', 'tar'],
      default: 'gzip',
    },
    ratio: Number, // compression ratio
  },
  encryption: {
    enabled: {
      type: Boolean,
      default: false,
    },
    algorithm: {
      type: String,
      enum: ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'],
    },
    keyId: String,
  },
  metadata: {
    totalRecords: Number,
    totalSize: Number, // uncompressed size
    compressedSize: Number,
    duration: Number, // in milliseconds
    startTime: Date,
    endTime: Date,
    version: String,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
    },
  },
  retention: {
    keepLocal: {
      enabled: Boolean,
      days: Number,
    },
    keepRemote: {
      enabled: Boolean,
      days: Number,
    },
    maxBackups: Number,
  },
  verification: {
    checksumVerified: Boolean,
    integrityTest: Boolean,
    restoreTest: Boolean,
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  triggerReason: {
    type: String,
    enum: ['scheduled', 'manual', 'system', 'error_recovery'],
  },
  notifications: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'webhook', 'slack', 'teams'],
    },
    recipient: String,
    sent: Boolean,
    sentAt: Date,
    error: String,
  }],
  error: {
    message: String,
    stack: String,
    code: String,
    retryable: Boolean,
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
  },
  tags: [String],
  notes: String,
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
BackupSchema.index({ backupId: 1 });
BackupSchema.index({ status: 1 });
BackupSchema.index({ type: 1 });
BackupSchema.index({ schedule: 1 });
BackupSchema.index({ createdAt: -1 });
BackupSchema.index({ 'metadata.startTime': -1 });
BackupSchema.index({ 'database.name': 1 });

// Virtual for backup duration
BackupSchema.virtual('duration').get(function() {
  if (this.metadata.startTime && this.metadata.endTime) {
    return this.metadata.endTime - this.metadata.startTime;
  }
  return null;
});

// Virtual for success rate
BackupSchema.virtual('successRate').get(function() {
  if (this.collections.length === 0) return 0;
  const completed = this.collections.filter(c => c.status === 'completed').length;
  return (completed / this.collections.length) * 100;
});

// Pre-save middleware to generate backup ID
BackupSchema.pre('save', async function(next) {
  if (!this.backupId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 6);
    this.backupId = `backup_${timestamp}_${random}`;
  }
  
  // Set start time if not set and status is in_progress
  if (this.status === 'in_progress' && !this.metadata.startTime) {
    this.metadata.startTime = new Date();
  }
  
  // Set end time if status is completed or failed
  if ((this.status === 'completed' || this.status === 'failed') && !this.metadata.endTime) {
    this.metadata.endTime = new Date();
    if (this.metadata.startTime) {
      this.metadata.duration = this.metadata.endTime - this.metadata.startTime;
    }
  }
  
  next();
});

// Static method to create backup
BackupSchema.statics.createBackup = async function(backupData) {
  const backup = new this(backupData);
  return await backup.save();
};

// Static method to get backup statistics
BackupSchema.statics.getBackupStats = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalBackups: { $sum: 1 },
        successfulBackups: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedBackups: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        averageDuration: { $avg: '$metadata.duration' },
        totalSize: { $sum: '$metadata.compressedSize' },
        byType: {
          $push: {
            type: '$type',
            status: '$status',
            size: '$metadata.compressedSize',
            duration: '$metadata.duration',
          },
        },
      },
    },
  ]);
  
  return stats[0] || {
    totalBackups: 0,
    successfulBackups: 0,
    failedBackups: 0,
    averageDuration: 0,
    totalSize: 0,
    byType: [],
  };
};

// Static method to cleanup old backups
BackupSchema.statics.cleanupOldBackups = async function() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep backups for 90 days
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: 'completed',
  });
  
  return result.deletedCount;
};

// Static method to get failed backups for retry
BackupSchema.statics.getFailedBackupsForRetry = async function() {
  return await this.find({
    status: 'failed',
    'error.retryable': true,
    'error.retryCount': { $lt: '$error.maxRetries' },
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Backup', BackupSchema);
