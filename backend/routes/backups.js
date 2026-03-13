const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const backupService = require('../services/backupService');
const backupScheduler = require('../services/backupScheduler');
const backupRepository = require('../repositories/postgres/BackupRepository');

const router = express.Router();

// @route   POST /api/backups/create
// @desc    Create a new backup
// @access  Private (requires 'create_backups' permission)
router.post('/create', [
  auth,
  requirePermission('create_backups'),
  sanitizeRequest,
  body('type').optional().isIn(['full', 'incremental', 'differential', 'schema_only', 'data_only']),
  body('schedule').optional().isIn(['hourly', 'daily', 'weekly', 'monthly', 'manual']),
  body('compression').optional().isBoolean(),
  body('encryption').optional().isBoolean(),
  body('collections').optional().isArray(),
  body('excludeCollections').optional().isArray(),
  body('notes').optional().trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const {
      type = 'full',
      schedule = 'manual',
      compression = true,
      encryption = false,
      collections = [],
      excludeCollections = [],
      notes,
    } = req.body;

    const backup = await backupService.createFullBackup({
      userId: req.user.id || req.user._id,
      schedule,
      type,
      compression,
      encryption,
      collections,
      excludeCollections,
    });

    const backupId = backup.id || backup._id;
    if (notes && backupId) {
      await backupRepository.updateById(backupId, { notes }).catch(() => {});
    }

    res.status(201).json({
      message: 'Backup created successfully',
      backup: {
        backupId: backup.backupId || backup.backup_id || backupId,
        type: backup.type,
        schedule: backup.schedule,
        status: backup.status,
        createdAt: backup.createdAt || backup.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ message: 'Server error creating backup', error: error.message });
  }
});

// @route   GET /api/backups
// @desc    Get list of backups with filters and pagination
// @access  Private (requires 'view_backups' permission)
router.get('/', [
  auth,
  requirePermission('view_backups'),
  sanitizeRequest,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'in_progress', 'completed', 'failed', 'cancelled']),
  query('type').optional().isIn(['full', 'incremental', 'differential', 'schema_only', 'data_only']),
  query('schedule').optional().isIn(['hourly', 'daily', 'weekly', 'monthly', 'manual']),
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      type, 
      schedule, 
      startDate, 
      endDate 
    } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (schedule) filter.schedule = schedule;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    const result = await backupRepository.findWithPagination(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    });

    const { backups, total, pagination } = result;

    res.json({
      backups,
      pagination
    });
  } catch (error) {
    console.error('Error fetching backups:', error);
    res.status(500).json({ message: 'Server error fetching backups', error: error.message });
  }
});

// @route   GET /api/backups/stats
// @desc    Get backup statistics
// @access  Private (requires 'view_backups' permission)
router.get('/stats', [
  auth,
  requirePermission('view_backups'),
  sanitizeRequest,
  query('days').optional().isInt({ min: 1, max: 365 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const stats = await backupService.getBackupStats(parseInt(days));
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching backup stats:', error);
    res.status(500).json({ message: 'Server error fetching backup stats', error: error.message });
  }
});

// @route   GET /api/backups/:backupId
// @desc    Get backup details
// @access  Private (requires 'view_backups' permission)
router.get('/:backupId', [
  auth,
  requirePermission('view_backups'),
  sanitizeRequest,
  param('backupId').isUUID(4).withMessage('Valid Backup ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { backupId } = req.params;
    
    const backup = await backupRepository.findById(backupId, {
      populate: [
        { path: 'triggeredBy', select: 'firstName lastName email' },
        { path: 'verification.verifiedBy', select: 'firstName lastName email' }
      ]
    });

    if (!backup) {
      return res.status(404).json({ message: 'Backup not found' });
    }

    res.json(backup);
  } catch (error) {
    console.error('Error fetching backup details:', error);
    res.status(500).json({ message: 'Server error fetching backup details', error: error.message });
  }
});

// @route   POST /api/backups/:backupId/restore
// @desc    Restore from backup
// @access  Private (requires 'restore_backups' permission)
router.post('/:backupId/restore', [
  auth,
  requirePermission('restore_backups'),
  sanitizeRequest,
  param('backupId').isUUID(4).withMessage('Valid Backup ID is required'),
  body('collections').optional().isArray(),
  body('dropExisting').optional().isBoolean(),
  body('confirmRestore').isBoolean().withMessage('Restore confirmation is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { backupId } = req.params;
    const { collections = [], dropExisting = false, confirmRestore } = req.body;

    if (!confirmRestore) {
      return res.status(400).json({ message: 'Restore confirmation is required' });
    }

    const result = await backupService.restoreBackup(backupId, {
      userId: req.user.id,
      collections,
      dropExisting,
    });

    res.json({
      message: 'Backup restored successfully',
      result,
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ message: 'Server error restoring backup', error: error.message });
  }
});

// @route   DELETE /api/backups/:backupId
// @desc    Delete backup
// @access  Private (requires 'delete_backups' permission)
router.delete('/:backupId', [
  auth,
  requirePermission('delete_backups'),
  sanitizeRequest,
  param('backupId').isUUID(4).withMessage('Valid Backup ID is required'),
  body('confirmDelete').isBoolean().withMessage('Delete confirmation is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { backupId } = req.params;
    const { confirmDelete } = req.body;

    if (!confirmDelete) {
      return res.status(400).json({ message: 'Delete confirmation is required' });
    }

    const backup = await backupRepository.findById(backupId);
    if (!backup) {
      return res.status(404).json({ message: 'Backup not found' });
    }

    // Delete local files
    if (backup.files.local.path) {
      try {
        const fs = require('fs').promises;
        await fs.unlink(backup.files.local.path);
      } catch (error) {
        console.error('Error deleting backup file:', error);
      }
    }

    // Delete database record
    await backupRepository.delete(backupId);

    res.json({ message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ message: 'Server error deleting backup', error: error.message });
  }
});

// @route   POST /api/backups/:backupId/verify
// @desc    Verify backup integrity
// @access  Private (requires 'view_backups' permission)
router.post('/:backupId/verify', [
  auth,
  requirePermission('view_backups'),
  sanitizeRequest,
  param('backupId').isUUID(4).withMessage('Valid Backup ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { backupId } = req.params;
    
    const backup = await backupRepository.findById(backupId);
    if (!backup) {
      return res.status(404).json({ message: 'Backup not found' });
    }

    await backupService.verifyBackup(backup);

    res.json({
      message: 'Backup verification completed',
      verified: backup.verification.checksumVerified,
    });
  } catch (error) {
    console.error('Error verifying backup:', error);
    res.status(500).json({ message: 'Server error verifying backup', error: error.message });
  }
});

// @route   POST /api/backups/:backupId/retry
// @desc    Retry failed backup
// @access  Private (requires 'create_backups' permission)
router.post('/:backupId/retry', [
  auth,
  requirePermission('create_backups'),
  sanitizeRequest,
  param('backupId').isUUID(4).withMessage('Valid Backup ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { backupId } = req.params;
    
    const backup = await backupRepository.findById(backupId);
    if (!backup) {
      return res.status(404).json({ message: 'Backup not found' });
    }

    if (backup.status !== 'failed') {
      return res.status(400).json({ message: 'Only failed backups can be retried' });
    }

    // Create new backup with same parameters
    const newBackup = await backupService.createFullBackup({
      userId: req.user.id,
      schedule: backup.schedule,
      type: backup.type,
      compression: backup.compression.enabled,
      encryption: backup.encryption.enabled,
      triggerReason: 'retry',
    });

    res.json({
      message: 'Backup retry initiated',
      backup: {
        backupId: newBackup.backupId,
        status: newBackup.status,
      },
    });
  } catch (error) {
    console.error('Error retrying backup:', error);
    res.status(500).json({ message: 'Server error retrying backup', error: error.message });
  }
});

// @route   GET /api/backups/scheduler/status
// @desc    Get backup scheduler status
// @access  Private (requires 'view_backups' permission)
router.get('/scheduler/status', [
  auth,
  requirePermission('view_backups'),
  sanitizeRequest,
  handleValidationErrors,
], async (req, res) => {
  try {
    const status = backupScheduler.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error fetching scheduler status:', error);
    res.status(500).json({ message: 'Server error fetching scheduler status', error: error.message });
  }
});

// @route   POST /api/backups/scheduler/start
// @desc    Start backup scheduler
// @access  Private (requires 'manage_backups' permission)
router.post('/scheduler/start', [
  auth,
  requirePermission('manage_backups'),
  sanitizeRequest,
  handleValidationErrors,
], async (req, res) => {
  try {
    backupScheduler.start();
    res.json({ message: 'Backup scheduler started successfully' });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({ message: 'Server error starting scheduler', error: error.message });
  }
});

// @route   POST /api/backups/scheduler/stop
// @desc    Stop backup scheduler
// @access  Private (requires 'manage_backups' permission)
router.post('/scheduler/stop', [
  auth,
  requirePermission('manage_backups'),
  sanitizeRequest,
  handleValidationErrors,
], async (req, res) => {
  try {
    backupScheduler.stop();
    res.json({ message: 'Backup scheduler stopped successfully' });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({ message: 'Server error stopping scheduler', error: error.message });
  }
});

// @route   POST /api/backups/scheduler/trigger
// @desc    Manually trigger a backup
// @access  Private (requires 'create_backups' permission)
router.post('/scheduler/trigger', [
  auth,
  requirePermission('create_backups'),
  sanitizeRequest,
  body('schedule').isIn(['hourly', 'daily', 'weekly', 'monthly']).withMessage('Valid schedule is required'),
  body('type').optional().isIn(['full', 'incremental', 'differential']),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { schedule, type = 'full' } = req.body;
    
    const backup = await backupScheduler.triggerBackup(schedule, type, req.user.id);

    res.json({
      message: 'Backup triggered successfully',
      backup: {
        backupId: backup.backupId,
        type: backup.type,
        schedule: backup.schedule,
        status: backup.status,
      },
    });
  } catch (error) {
    console.error('Error triggering backup:', error);
    res.status(500).json({ message: 'Server error triggering backup', error: error.message });
  }
});

// @route   POST /api/backups/cleanup
// @desc    Run backup cleanup
// @access  Private (requires 'manage_backups' permission)
router.post('/cleanup', [
  auth,
  requirePermission('manage_backups'),
  sanitizeRequest,
  handleValidationErrors,
], async (req, res) => {
  try {
    const deletedCount = await backupService.cleanupOldBackups();
    
    res.json({
      message: 'Backup cleanup completed successfully',
      deletedCount,
    });
  } catch (error) {
    console.error('Error running cleanup:', error);
    res.status(500).json({ message: 'Server error running cleanup', error: error.message });
  }
});

module.exports = router;
