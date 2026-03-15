const cron = require('node-cron');
const backupService = require('./backupService');
const BackupRepository = require('../repositories/BackupRepository');

class BackupScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('Backup scheduler is already running');
      return;
    }

    console.log('Starting backup scheduler...');
    this.isRunning = true;

    // Schedule hourly backups (during business hours)
    if (process.env.HOURLY_BACKUPS_ENABLED === 'true') {
      this.scheduleJob('hourly', '0 * * * *', async () => {
        await this.runScheduledBackup('hourly', 'incremental');
      });
    }

    // Schedule daily full backups
    if (process.env.DAILY_BACKUPS_ENABLED !== 'false') {
      this.scheduleJob('daily', '0 2 * * *', async () => {
        await this.runScheduledBackup('daily', 'full');
      });
    }

    // Schedule weekly full backups
    if (process.env.WEEKLY_BACKUPS_ENABLED === 'true') {
      this.scheduleJob('weekly', '0 1 * * 0', async () => {
        await this.runScheduledBackup('weekly', 'full');
      });
    }

    // Schedule monthly full backups
    if (process.env.MONTHLY_BACKUPS_ENABLED === 'true') {
      this.scheduleJob('monthly', '0 0 1 * *', async () => {
        await this.runScheduledBackup('monthly', 'full');
      });
    }

    // Schedule cleanup job (daily at 3 AM)
    this.scheduleJob('cleanup', '0 3 * * *', async () => {
      await this.runCleanup();
    });

    // Schedule retry job (every 6 hours)
    this.scheduleJob('retry', '0 */6 * * *', async () => {
      await this.runRetryFailedBackups();
    });

    console.log('Backup scheduler started successfully');
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      console.log('Backup scheduler is not running');
      return;
    }

    console.log('Stopping backup scheduler...');
    
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`Stopped job: ${name}`);
    }
    
    this.jobs.clear();
    this.isRunning = false;
    console.log('Backup scheduler stopped');
  }

  // Schedule a cron job
  scheduleJob(name, cronExpression, task) {
    if (this.jobs.has(name)) {
      console.log(`Job ${name} already exists, stopping previous instance`);
      this.jobs.get(name).stop();
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        console.log(`Running scheduled job: ${name}`);
        await task();
        console.log(`Completed scheduled job: ${name}`);
      } catch (error) {
        console.error(`Error in scheduled job ${name}:`, error);
      }
    }, {
      scheduled: false,
      timezone: process.env.BACKUP_TIMEZONE || 'UTC',
    });

    job.start();
    this.jobs.set(name, job);
    console.log(`Scheduled job ${name} with expression: ${cronExpression}`);
  }

  // Run a scheduled backup
  async runScheduledBackup(schedule, type) {
    try {
      console.log(`Starting ${schedule} ${type} backup...`);
      
      // Check if we should skip this backup
      if (await this.shouldSkipBackup(schedule, type)) {
        console.log(`Skipping ${schedule} ${type} backup`);
        return;
      }

      // Create backup
      const backup = await backupService.createFullBackup({
        schedule,
        type,
        compression: true,
        encryption: process.env.BACKUP_ENCRYPTION === 'true',
        triggerReason: 'scheduled',
      });

      console.log(`Completed ${schedule} ${type} backup: ${backup.backupId}`);
    } catch (error) {
      console.error(`Failed ${schedule} ${type} backup:`, error);
      
      try {
        await BackupRepository.create({
          type,
          schedule,
          status: 'failed',
          error: { message: error.message, stack: error.stack, retryable: true },
          triggerReason: 'scheduled',
        });
      } catch (createError) {
        console.error('Failed to create failed backup record:', createError);
      }
    }
  }

  // Check if we should skip this backup
  async shouldSkipBackup(schedule, type) {
    const inProgress = await BackupRepository.findInProgress(schedule, type);
    if (inProgress) {
      console.log(`Backup already in progress for ${schedule} ${type}`);
      return true;
    }
    const since = new Date(Date.now() - this.getSkipInterval(schedule));
    const recent = await BackupRepository.findRecentCompleted(schedule, type, since);
    if (recent) {
      console.log(`Recent backup found for ${schedule} ${type}, skipping`);
      return true;
    }
    return false;
  }

  // Get skip interval for different schedules
  getSkipInterval(schedule) {
    const intervals = {
      hourly: 30 * 60 * 1000,    // 30 minutes
      daily: 20 * 60 * 60 * 1000, // 20 hours
      weekly: 6 * 24 * 60 * 60 * 1000, // 6 days
      monthly: 25 * 24 * 60 * 60 * 1000, // 25 days
    };
    
    return intervals[schedule] || 24 * 60 * 60 * 1000; // Default: 24 hours
  }

  // Run cleanup
  async runCleanup() {
    try {
      console.log('Running backup cleanup...');
      const deletedCount = await backupService.cleanupOldBackups();
      console.log(`Cleaned up ${deletedCount} old backups`);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // Retry failed backups
  async runRetryFailedBackups() {
    try {
      console.log('Checking for failed backups to retry...');
      await backupService.retryFailedBackups();
    } catch (error) {
      console.error('Error retrying failed backups:', error);
    }
  }

  // Get scheduler status
  getStatus() {
    const status = {
      running: this.isRunning,
      jobs: {},
    };

    for (const [name, job] of this.jobs) {
      status.jobs[name] = {
        running: job.running,
        nextRun: job.nextDate(),
      };
    }

    return status;
  }

  // Manually trigger a backup
  async triggerBackup(schedule, type, userId = null) {
    try {
      console.log(`Manually triggering ${schedule} ${type} backup...`);
      
      const backup = await backupService.createFullBackup({
        userId,
        schedule,
        type,
        compression: true,
        encryption: process.env.BACKUP_ENCRYPTION === 'true',
        triggerReason: 'manual',
      });

      return backup;
    } catch (error) {
      console.error(`Failed to trigger ${schedule} ${type} backup:`, error);
      throw error;
    }
  }

  // Update job schedule
  updateJobSchedule(name, cronExpression) {
    if (!this.jobs.has(name)) {
      throw new Error(`Job ${name} not found`);
    }

    console.log(`Updating schedule for job ${name} to: ${cronExpression}`);
    
    // Stop current job
    this.jobs.get(name).stop();
    
    // Get the task function
    const task = this.getJobTask(name);
    if (!task) {
      throw new Error(`Task for job ${name} not found`);
    }

    // Schedule new job
    this.scheduleJob(name, cronExpression, task);
  }

  // Get job task function
  getJobTask(name) {
    const tasks = {
      hourly: () => this.runScheduledBackup('hourly', 'incremental'),
      daily: () => this.runScheduledBackup('daily', 'full'),
      weekly: () => this.runScheduledBackup('weekly', 'full'),
      monthly: () => this.runScheduledBackup('monthly', 'full'),
      cleanup: () => this.runCleanup(),
      retry: () => this.runRetryFailedBackups(),
    };

    return tasks[name];
  }

  // Enable/disable a job
  toggleJob(name, enabled) {
    if (!this.jobs.has(name)) {
      throw new Error(`Job ${name} not found`);
    }

    const job = this.jobs.get(name);
    
    if (enabled) {
      job.start();
      console.log(`Enabled job: ${name}`);
    } else {
      job.stop();
      console.log(`Disabled job: ${name}`);
    }
  }
}

module.exports = new BackupScheduler();
