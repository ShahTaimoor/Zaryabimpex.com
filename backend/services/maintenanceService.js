const stockReservationService = require('./stockReservationService');
const expiryManagementService = require('./expiryManagementService');

/**
 * Maintenance service for scheduled tasks
 */
class MaintenanceService {
  /**
   * Clean up expired stock reservations
   * Should be run every 5-15 minutes
   * @returns {Promise<Object>}
   */
  async cleanupExpiredReservations() {
    try {
      const result = await stockReservationService.releaseExpiredReservations();
      console.log(`[Maintenance] Released ${result.reservationsReleased} expired reservations`);
      return result;
    } catch (error) {
      console.error('[Maintenance] Error cleaning up expired reservations:', error);
      throw error;
    }
  }

  /**
   * Check for expiring products and send alerts
   * Should be run daily
   * @returns {Promise<Object>}
   */
  async checkExpiringProducts() {
    try {
      const alerts = await expiryManagementService.sendExpiryAlerts([30, 15, 7]);
      console.log(`[Maintenance] Expiry check completed. Found ${alerts.totalItems} items expiring`);
      return alerts;
    } catch (error) {
      console.error('[Maintenance] Error checking expiring products:', error);
      throw error;
    }
  }

  /**
   * Auto-write off expired inventory
   * Should be run daily (optional - may want manual approval)
   * @param {boolean} autoWriteOff - Whether to automatically write off (default: false)
   * @returns {Promise<Object>}
   */
  async processExpiredInventory(autoWriteOff = false) {
    try {
      const expired = await expiryManagementService.getExpired();
      
      if (autoWriteOff && expired.totalItems > 0) {
        // Write off all expired batches
        const results = {
          batchesProcessed: 0,
          totalValue: 0,
          errors: []
        };

        // Get unique batch IDs
        const batchIds = [...new Set(expired.batches.map(b => b._id.toString()))];
        
        for (const batchId of batchIds) {
          try {
            const result = await expiryManagementService.writeOffExpired(
              batchId,
              null, // System user
              null  // No req object for system operations
            );
            results.batchesProcessed += result.batchesProcessed;
            results.totalValue += result.totalValue;
          } catch (error) {
            results.errors.push({ batchId, error: error.message });
          }
        }

        console.log(`[Maintenance] Auto-wrote off ${results.batchesProcessed} expired batches`);
        return results;
      }

      return {
        expiredItems: expired.totalItems,
        requiresManualApproval: !autoWriteOff,
        expired
      };
    } catch (error) {
      console.error('[Maintenance] Error processing expired inventory:', error);
      throw error;
    }
  }

  /**
   * Run all maintenance tasks
   * @param {Object} options - Maintenance options
   * @returns {Promise<Object>}
   */
  async runAllMaintenance(options = {}) {
    const {
      cleanupReservations = true,
      checkExpiry = true,
      processExpired = false,
      autoWriteOff = false
    } = options;

    const results = {
      timestamp: new Date(),
      cleanupReservations: null,
      expiryCheck: null,
      expiredProcessing: null
    };

    if (cleanupReservations) {
      results.cleanupReservations = await this.cleanupExpiredReservations();
    }

    if (checkExpiry) {
      results.expiryCheck = await this.checkExpiringProducts();
    }

    if (processExpired) {
      results.expiredProcessing = await this.processExpiredInventory(autoWriteOff);
    }

    return results;
  }
}

module.exports = new MaintenanceService();

