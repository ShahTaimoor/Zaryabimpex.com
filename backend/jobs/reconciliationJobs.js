const cron = require("node-cron");
const reconciliationService = require("../services/reconciliationService");
const logger = require("../utils/logger");

/**
 * Schedule reconciliation jobs
 */
function startReconciliationJobs() {
  // Daily balance reconciliation at 2 AM
  cron.schedule("0 2 * * *", async () => {
    try {
      logger.info("Starting daily customer balance reconciliation...");
      const results = await reconciliationService.reconcileAllCustomerBalances({
        autoCorrect: false, // Don't auto-correct, just alert
        alertOnDiscrepancy: true,
        batchSize: 100,
      });

      logger.info("Daily reconciliation completed:", {
        total: results.total,
        reconciled: results.reconciled,
        discrepancies: results.discrepancies,
        errors: results.errors.length,
        duration: `${(results.duration / 1000).toFixed(2)}s`,
      });

      if (results.discrepancies > 0) {
        logger.warn(
          `Balance discrepancies detected: ${results.discrepancies} customers`,
        );
        // TODO: Send alert notification
      }
    } catch (error) {
      logger.error("Daily reconciliation job failed:", error);
    }
  });

  // Weekly full reconciliation with auto-correction (Sundays at 3 AM)
  cron.schedule("0 3 * * 0", async () => {
    try {
      logger.info(
        "Starting weekly customer balance reconciliation with auto-correction...",
      );
      const results = await reconciliationService.reconcileAllCustomerBalances({
        autoCorrect: true, // Auto-correct discrepancies
        alertOnDiscrepancy: true,
        batchSize: 50, // Smaller batch for auto-correction
      });

      logger.info("Weekly reconciliation completed:", {
        total: results.total,
        reconciled: results.reconciled,
        discrepancies: results.discrepancies,
        corrected: results.corrected,
        errors: results.errors.length,
        duration: `${(results.duration / 1000).toFixed(2)}s`,
      });

      if (results.discrepancies > 0) {
        logger.warn(
          `Balance discrepancies found and corrected: ${results.discrepancies} customers`,
        );
        // TODO: Send summary notification
      }
    } catch (error) {
      logger.error("Weekly reconciliation job failed:", error);
    }
  });

  // Full system reconciliation with auto-correction (Every 5 minutes)
  cron.schedule("*/5 * * * *", async () => {
    try {
      logger.info("Starting scheduled 5-minute full system reconciliation with auto-correction...");
      const results = await reconciliationService.runFullSystemReconciliation({
        autoCorrect: true
      });

      logger.info("5-minute reconciliation completed:", {
        customers: results.customers.total,
        customerDiscrepancies: results.customers.discrepancies,
        suppliers: results.suppliers.total,
        supplierDiscrepancies: results.suppliers.discrepancies,
        orderIssues: results.orders.totalIssues,
        duration: `${(results.duration / 1000).toFixed(2)}s`,
      });

      if (results.customers.discrepancies > 0 || results.suppliers.discrepancies > 0 || results.orders.totalIssues > 0) {
        logger.info(
          `Auto-corrected discrepancies: ${results.customers.discrepancies} customers, ${results.suppliers.discrepancies} suppliers, ${results.orders.totalIssues} orders`,
        );
      }
    } catch (error) {
      logger.error("5-minute reconciliation job failed:", error);
    }
  });

  logger.info(
    "Reconciliation jobs scheduled: Every 5 minutes (Full), Daily at 2 AM (Balance), Weekly (Sunday) at 3 AM (Balance Correct)",
  );
}

module.exports = {
  startReconciliationJobs,
};
