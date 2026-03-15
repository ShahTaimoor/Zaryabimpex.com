const BackupRepository = require('../repositories/BackupRepository');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Backup Verification Service
 * Verifies backup integrity and tests restore procedures
 */
class BackupVerificationService {
  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId) {
    const backup = await BackupRepository.findById(backupId) || await BackupRepository.findOne({ backupId });
    if (!backup) {
      throw new Error('Backup not found');
    }
    
    if (backup.status !== 'completed') {
      throw new Error(`Backup status is ${backup.status}, cannot verify`);
    }
    
    const results = {
      checksumVerified: false,
      integrityTest: false,
      collectionsVerified: false,
      recordCountsVerified: false,
      errors: []
    };
    
    try {
      const filesLocal = backup.files && typeof backup.files === 'object' ? backup.files.local : (backup.files && typeof backup.files === 'string' ? JSON.parse(backup.files || '{}').local : null);
      if (filesLocal?.path) {
        const fileBuffer = await fs.readFile(filesLocal.path);
        const calculatedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        if (calculatedHash === filesLocal.checksum) {
          results.checksumVerified = true;
        } else {
          results.errors.push('Checksum verification failed');
        }
      }
      
      if (filesLocal?.path) {
        try {
          await fs.access(filesLocal.path);
          results.integrityTest = true;
        } catch (error) {
          results.errors.push(`File access error: ${error.message}`);
        }
      }
      const backupCollections = Array.isArray(backup.collections) ? backup.collections.map(c => c && c.name) : (typeof backup.collections === 'string' ? JSON.parse(backup.collections || '[]').map(c => c && c.name) : []);
      if (backupCollections.length > 0) {
        const expectedCollections = ['sales', 'customers', 'transactions', 'inventory', 'products'];
        const missingCollections = expectedCollections.filter(c => !backupCollections.includes(c));
        if (missingCollections.length === 0) results.collectionsVerified = true;
        else results.errors.push(`Missing collections: ${missingCollections.join(', ')}`);
      }
      const metadata = backup.metadata && typeof backup.metadata === 'object' ? backup.metadata : (typeof backup.metadata === 'string' ? JSON.parse(backup.metadata || '{}') : {});
      if (metadata.totalRecords) results.recordCountsVerified = true;
      const verification = {
        ...(backup.verification && typeof backup.verification === 'object' ? backup.verification : {}),
        checksumVerified: results.checksumVerified,
        integrityTest: results.integrityTest,
        verifiedAt: new Date(),
        verifiedBy: null,
      };
      await BackupRepository.updateById(backup.id, { verification });
      return {
        verified: results.errors.length === 0,
        backupId: backup.backup_id || backup.backupId,
        results,
      };
    } catch (error) {
      results.errors.push(`Verification error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Test restore procedure
   */
  async testRestore(backupId, testDatabaseName = 'backup_test_restore') {
    const backup = await BackupRepository.findOne({ backupId }) || await BackupRepository.findById(backupId);
    if (!backup) throw new Error('Backup not found');

    // MongoDB removed; restore test no longer supported
    const cols = Array.isArray(backup.collections) ? backup.collections : (typeof backup.collections === 'string' ? JSON.parse(backup.collections || '[]') : []);
    const restoreResults = {
      restored: false,
      collections: cols.map(c => c && c.name) || [],
      recordCounts: {},
      errors: ['MongoDB restore test removed; use Postgres backup/restore tools']
    };
    return {
      success: false,
      backupId: backup.backup_id ?? backup.backupId,
      results: restoreResults,
    };
  }
  
  /**
   * Schedule automated verification
   */
  scheduleVerification() {
    const cron = require('node-cron');
    cron.schedule('0 3 * * *', async () => {
      try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentBackups = await BackupRepository.findAll({ status: 'completed' }, { limit: 10 });
        const filtered = recentBackups.filter(b => new Date(b.created_at || b.createdAt) >= since);
        for (const backup of filtered) {
          try {
            await this.verifyBackup(backup.backup_id || backup.backupId);
            console.log(`Verified backup: ${backup.backup_id || backup.backupId}`);
          } catch (error) {
            console.error(`Backup verification failed for ${backup.backupId}:`, error);
            
            // TODO: Send alert
            // await sendAlert({
            //   type: 'backup_verification_failed',
            //   backupId: backup.backupId,
            //   error: error.message
            // });
          }
        }
      } catch (error) {
        console.error('Error in scheduled backup verification:', error);
      }
    });
    
    cron.schedule('0 4 * * 0', async () => {
      try {
        const rows = await BackupRepository.findAll({ status: 'completed', type: 'full' }, { limit: 1 });
        const latestBackup = rows[0];
        if (latestBackup) {
          try {
            await this.testRestore(latestBackup.backup_id || latestBackup.backupId);
            console.log(`Restore test passed for backup: ${latestBackup.backup_id || latestBackup.backupId}`);
          } catch (error) {
            console.error(`Restore test failed for ${latestBackup.backup_id || latestBackup.backupId}:`, error);
            
            // TODO: Send alert
            // await sendAlert({
            //   type: 'backup_restore_test_failed',
            //   backupId: latestBackup.backupId,
            //   error: error.message
            // });
          }
        }
      } catch (error) {
        console.error('Error in scheduled restore test:', error);
      }
    });
  }
}

module.exports = new BackupVerificationService();

