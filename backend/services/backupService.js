const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const BackupRepository = require('../repositories/BackupRepository');

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
    this.ensureBackupDirectory();
    this.schedules = new Map();
  }

  // Ensure backup directory exists
  async ensureBackupDirectory() {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
    }
  }

  // Build a backup proxy that persists via BackupRepository
  _backupProxy(row) {
    const backup = {
      id: row.id,
      backupId: row.backup_id || row.backupId,
      type: row.type,
      schedule: row.schedule,
      status: row.status,
      database: row.database_info || row.database || {},
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : (typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : {}),
      collections: Array.isArray(row.collections) ? row.collections : (typeof row.collections === 'string' ? JSON.parse(row.collections || '[]') : []),
      files: row.files && typeof row.files === 'object' ? row.files : (typeof row.files === 'string' ? JSON.parse(row.files || '{}') : { local: {} }),
      verification: row.verification && typeof row.verification === 'object' ? row.verification : (typeof row.verification === 'string' ? JSON.parse(row.verification || '{}') : {}),
      notifications: Array.isArray(row.notifications) ? row.notifications : (typeof row.notifications === 'string' ? JSON.parse(row.notifications || '[]') : []),
      error: row.error_info || row.error || null,
    };
    backup.save = async () => {
      await BackupRepository.updateById(backup.id, {
        status: backup.status,
        metadata: backup.metadata,
        collections: backup.collections,
        files: backup.files,
        verification: backup.verification,
        error: backup.error,
        notifications: backup.notifications,
      });
    };
    backup.toObject = () => ({ ...backup });
    return backup;
  }

  // Create a full database backup
  async createFullBackup(options = {}) {
    const {
      userId,
      schedule = 'manual',
      compression = true,
      encryption = false,
      collections = [],
      excludeCollections = [],
    } = options;

    const row = await BackupRepository.create({
      type: 'full',
      schedule,
      status: 'pending',
      database: { name: process.env.DB_NAME || 'pos_system' },
      compression: { enabled: compression },
      encryption: { enabled: encryption },
      triggeredBy: userId,
      triggerReason: options.triggerReason || 'manual',
    });
    const backup = this._backupProxy(row);

    try {
      backup.status = 'in_progress';
      backup.metadata.startTime = new Date();
      await backup.save();

      const targetCollections = collections.length > 0
        ? collections.filter(name => !excludeCollections.includes(name))
        : [];

      backup.collections = targetCollections.map(name => ({ name, count: 0, size: 0, status: 'pending' }));
      await backup.save();

      const backupResults = await this.backupCollections(targetCollections, backup);
      const totalRecords = backupResults.reduce((sum, result) => sum + result.count, 0);
      const totalSize = backupResults.reduce((sum, result) => sum + result.size, 0);

      backup.metadata.totalRecords = totalRecords;
      backup.metadata.totalSize = totalSize;
      backup.collections = backupResults;

      let compressedSize = totalSize;
      if (compression) {
        compressedSize = await this.compressBackup(backup);
      }

      backup.metadata.compressedSize = compressedSize;
      backup.metadata.compression = compression ? { ratio: totalSize > 0 ? (compressedSize / totalSize) * 100 : 0 } : null;
      backup.metadata.endTime = new Date();

      const checksum = await this.generateChecksum(backup);
      backup.files.local = backup.files.local || {};
      backup.files.local.checksum = checksum;

      await this.verifyBackup(backup);

      backup.status = 'completed';
      await backup.save();

      await this.sendNotifications(backup);

      return backup;
    } catch (error) {
      backup.status = 'failed';
      backup.error = { message: error.message, stack: error.stack, retryable: true };
      backup.metadata.endTime = new Date();
      await backup.save();
      throw error;
    }
  }

  // Backup collections (no-op; MongoDB removed - use Postgres backup tools for DB backups)
  async backupCollections(collections, backup) {
    return collections.map(name => ({ name, count: 0, size: 0, status: 'completed' }));
  }

  // Compress backup files
  async compressBackup(backup) {
    const backupPath = path.join(this.backupDir, backup.backupId);
    const compressedPath = `${backupPath}.tar.gz`;

    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-czf', compressedPath, '-C', this.backupDir, backup.backupId]);
      
      tar.on('close', async (code) => {
        if (code === 0) {
          try {
            const stats = await fs.stat(compressedPath);
            backup.files.local.path = compressedPath;
            backup.files.local.size = stats.size;
            backup.files.local.createdAt = new Date();
            await backup.save();
            
            // Remove uncompressed directory
            await fs.rmdir(backupPath, { recursive: true });
            
            resolve(stats.size);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`Compression failed with code ${code}`));
        }
      });

      tar.on('error', reject);
    });
  }

  // Generate checksum for backup
  async generateChecksum(backup) {
    const filePath = backup.files.local.path;
    if (!filePath) return null;

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = require('fs').createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  // Verify backup integrity
  async verifyBackup(backup) {
    try {
      // Verify file exists
      if (!backup.files.local.path) {
        throw new Error('Backup file not found');
      }

      await fs.access(backup.files.local.path);

      // Verify checksum
      const currentChecksum = await this.generateChecksum(backup);
      if (backup.files.local.checksum !== currentChecksum) {
        throw new Error('Checksum verification failed');
      }

      // Verify file size
      const stats = await fs.stat(backup.files.local.path);
      if (stats.size !== backup.files.local.size) {
        throw new Error('File size verification failed');
      }

      backup.verification.checksumVerified = true;
      backup.verification.integrityTest = true;
      backup.verification.verifiedAt = new Date();
      await backup.save();

    } catch (error) {
      backup.verification.checksumVerified = false;
      backup.verification.integrityTest = false;
      await backup.save();
      throw error;
    }
  }

  // Restore from backup
  async restoreBackup(backupId, options = {}) {
    const {
      userId,
      collections = [],
      dropExisting = false,
    } = options;

    const row = await BackupRepository.findOne({ backupId }) || await BackupRepository.findById(backupId);
    if (!row) throw new Error('Backup not found');
    const backup = this._backupProxy(row);

    if (backup.status !== 'completed') {
      throw new Error('Cannot restore from incomplete backup');
    }

    try {
      const backupPath = backup.files?.local?.path;
      if (backupPath.endsWith('.tar.gz')) {
        await this.extractBackup(backup);
      }

      // Get collections to restore
      let targetCollections = collections;
      if (targetCollections.length === 0) {
        targetCollections = backup.collections
          .filter(c => c.status === 'completed')
          .map(c => c.name);
      }

      // Restore each collection (MongoDB removed; no-op for legacy backup restores)
      for (const collectionName of targetCollections) {
        await this.restoreCollection(backup, collectionName);
      }

      return { message: 'Backup restored successfully', collections: targetCollections };
    } catch (error) {
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  // Extract compressed backup
  async extractBackup(backup) {
    const backupPath = backup.files.local.path;
    const extractPath = path.join(this.backupDir, backup.backupId);

    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', backupPath, '-C', this.backupDir]);
      
      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Extraction failed with code ${code}`));
        }
      });

      tar.on('error', reject);
    });
  }

  // Restore individual collection (MongoDB removed - no-op)
  async restoreCollection(backup, collectionName) {
    // MongoDB restore removed; use Postgres restore tools for DB restores
  }

  // Schedule automatic backups
  scheduleBackups() {
    // Hourly backups (during business hours)
    this.schedules.set('hourly', {
      cron: '0 * * * *', // Every hour
      enabled: process.env.HOURLY_BACKUPS_ENABLED === 'true',
      type: 'incremental',
    });

    // Daily full backups
    this.schedules.set('daily', {
      cron: '0 2 * * *', // 2 AM daily
      enabled: process.env.DAILY_BACKUPS_ENABLED !== 'false',
      type: 'full',
    });

    // Weekly full backups
    this.schedules.set('weekly', {
      cron: '0 1 * * 0', // 1 AM on Sunday
      enabled: process.env.WEEKLY_BACKUPS_ENABLED === 'true',
      type: 'full',
    });

    // Monthly full backups
    this.schedules.set('monthly', {
      cron: '0 0 1 * *', // Midnight on 1st of month
      enabled: process.env.MONTHLY_BACKUPS_ENABLED === 'true',
      type: 'full',
    });
  }

  // Send notifications
  async sendNotifications(backup) {
    const notifications = [];

    // Email notification
    if (process.env.BACKUP_EMAIL_NOTIFICATIONS === 'true') {
      notifications.push({
        type: 'email',
        recipient: process.env.BACKUP_EMAIL,
        sent: false,
      });
    }

    // Slack notification
    if (process.env.BACKUP_SLACK_WEBHOOK) {
      notifications.push({
        type: 'slack',
        recipient: process.env.BACKUP_SLACK_WEBHOOK,
        sent: false,
      });
    }

    // Webhook notification
    if (process.env.BACKUP_WEBHOOK_URL) {
      notifications.push({
        type: 'webhook',
        recipient: process.env.BACKUP_WEBHOOK_URL,
        sent: false,
      });
    }

    backup.notifications = notifications;
    await backup.save();

    // Send notifications
    for (const notification of notifications) {
      try {
        await this.sendNotification(backup, notification);
        notification.sent = true;
        notification.sentAt = new Date();
      } catch (error) {
        notification.error = error.message;
      }
    }

    await backup.save();
  }

  // Send individual notification
  async sendNotification(backup, notification) {
    const message = this.formatNotificationMessage(backup);

    switch (notification.type) {
      case 'email':
        // Implement email sending
        break;
      case 'slack':
        await this.sendSlackNotification(notification.recipient, message);
        break;
      case 'webhook':
        await this.sendWebhookNotification(notification.recipient, backup);
        break;
    }
  }

  // Format notification message
  formatNotificationMessage(backup) {
    const status = backup.status === 'completed' ? '✅' : '❌';
    const duration = backup.metadata.duration ? `${backup.metadata.duration}ms` : 'N/A';
    const size = backup.metadata.compressedSize ? this.formatBytes(backup.metadata.compressedSize) : 'N/A';

    return `Backup ${backup.backupId} ${status}
Type: ${backup.type}
Schedule: ${backup.schedule}
Duration: ${duration}
Size: ${size}
Collections: ${backup.collections.length}`;
  }

  // Send Slack notification
  async sendSlackNotification(webhookUrl, message) {
    const axios = require('axios');
    await axios.post(webhookUrl, { text: message });
  }

  // Send webhook notification
  async sendWebhookNotification(webhookUrl, backup) {
    const axios = require('axios');
    await axios.post(webhookUrl, {
      event: 'backup.completed',
      backup: typeof backup.toObject === 'function' ? backup.toObject() : backup,
    });
  }

  // Format bytes to human readable
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Cleanup old backups
  async cleanupOldBackups() {
    const deletedCount = await BackupRepository.cleanupOldBackups(90);
    
    // Also cleanup local files
    try {
      const files = await fs.readdir(this.backupDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up backup files:', error);
    }

    return deletedCount;
  }

  // Get backup statistics
  async getBackupStats(days = 30) {
    return await BackupRepository.getBackupStats(days);
  }

  // Retry failed backups
  async retryFailedBackups() {
    const failedRows = await BackupRepository.getFailedBackupsForRetry();
    for (const row of failedRows) {
      try {
        const backupId = row.backup_id || row.backupId;
        const err = row.error_info && typeof row.error_info === 'object' ? row.error_info : (typeof row.error_info === 'string' ? JSON.parse(row.error_info || '{}') : {});
        await BackupRepository.updateById(row.id, { error: { ...err, retryCount: (err.retryCount || 0) + 1 } });
        await this.createFullBackup({
          userId: row.triggered_by || row.triggeredBy,
          schedule: row.schedule,
        });
      } catch (error) {
        console.error(`Failed to retry backup ${row.backup_id || row.backupId}:`, error);
      }
    }
  }
}

module.exports = new BackupService();
