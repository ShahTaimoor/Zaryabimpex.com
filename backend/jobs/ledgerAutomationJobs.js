const cron = require('node-cron');
const ledgerAutomationService = require('../services/ledgerAutomationService');

/**
 * Ledger Automation Cron Jobs
 * Automatically converts confirmed orders to invoices and posts transactions to ledger
 */

let automationJob = null;
let isRunning = false;

/**
 * Initialize ledger automation cron job
 * Runs every 3 minutes
 */
function initializeLedgerAutomation() {
    // Run every 3 minutes: */3 * * * *
    automationJob = cron.schedule('*/3 * * * *', async () => {
        // Prevent concurrent runs
        if (isRunning) {
            console.log('[Ledger Automation] Previous run still in progress, skipping...');
            return;
        }

        isRunning = true;
        const startTime = Date.now();

        try {
            console.log('[Ledger Automation] Starting automation run at', new Date().toISOString());

            const results = await ledgerAutomationService.processUnpostedTransactions();

            const duration = Date.now() - startTime;

            console.log('[Ledger Automation] Completed successfully in', duration, 'ms');
            console.log('[Ledger Automation] Results:', {
                salesOrders: results.salesOrdersConverted,
                purchaseOrders: results.purchaseOrdersConverted,
                total: results.totalOrdersConverted,
                errors: results.errors.length
            });

            if (results.errors.length > 0) {
                console.error('[Ledger Automation] Errors encountered:', results.errors);
            }
        } catch (error) {
            console.error('[Ledger Automation] Fatal error:', error);
            console.error('[Ledger Automation] Stack trace:', error.stack);
        } finally {
            isRunning = false;
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Karachi' // Pakistan timezone
    });

    console.log('[Ledger Automation] Cron job initialized - runs every 3 minutes');
}

/**
 * Stop the ledger automation cron job
 */
function stopLedgerAutomation() {
    if (automationJob) {
        automationJob.stop();
        console.log('[Ledger Automation] Cron job stopped');
    }
}

/**
 * Manually trigger automation (for testing or manual runs)
 */
async function triggerManualRun() {
    if (isRunning) {
        throw new Error('Automation is already running');
    }

    isRunning = true;
    try {
        console.log('[Ledger Automation] Manual run triggered at', new Date().toISOString());
        const results = await ledgerAutomationService.processUnpostedTransactions();
        console.log('[Ledger Automation] Manual run completed:', results);
        return results;
    } finally {
        isRunning = false;
    }
}

/**
 * Get automation status
 */
function getAutomationStatus() {
    return {
        isInitialized: automationJob !== null,
        isRunning,
        schedule: '*/3 * * * *',
        description: 'Runs every 3 minutes',
        timezone: 'Asia/Karachi'
    };
}

module.exports = {
    initializeLedgerAutomation,
    stopLedgerAutomation,
    triggerManualRun,
    getAutomationStatus
};
