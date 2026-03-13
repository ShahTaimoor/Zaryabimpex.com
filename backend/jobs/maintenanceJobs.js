const cron = require('node-cron');
const maintenanceService = require('../services/maintenanceService');

/**
 * Setup maintenance cron jobs
 * Call this from your server.js or app initialization
 */
function setupMaintenanceJobs() {
  // Clean up expired reservations every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await maintenanceService.cleanupExpiredReservations();
    } catch (error) {
      console.error('[Cron Job] Error in reservation cleanup:', error);
    }
  });

  // Check for expiring products daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      await maintenanceService.checkExpiringProducts();
    } catch (error) {
      console.error('[Cron Job] Error in expiry check:', error);
    }
  });

  // Process expired inventory daily at 10 AM (optional - set autoWriteOff: true to enable)
  // Currently disabled - requires manual approval
  // cron.schedule('0 10 * * *', async () => {
  //   try {
  //     await maintenanceService.processExpiredInventory(false); // Manual approval
  //   } catch (error) {
  //     console.error('[Cron Job] Error processing expired inventory:', error);
  //   }
  // });

  console.log('[Maintenance Jobs] Scheduled maintenance jobs initialized');
}

module.exports = { setupMaintenanceJobs };

