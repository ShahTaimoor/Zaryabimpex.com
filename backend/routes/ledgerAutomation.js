const express = require('express');
const { auth, requirePermission } = require('../middleware/auth');
const { triggerManualRun, getAutomationStatus } = require('../jobs/ledgerAutomationJobs');

const router = express.Router();

/**
 * @route   GET /api/ledger-automation/status
 * @desc    Get automation status
 * @access  Private (Admin only)
 */
router.get('/status', [
    auth,
    requirePermission('manage_settings')
], async (req, res) => {
    try {
        const status = getAutomationStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting automation status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get automation status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/ledger-automation/trigger
 * @desc    Manually trigger automation run
 * @access  Private (Admin only)
 */
router.post('/trigger', [
    auth,
    requirePermission('manage_settings')
], async (req, res) => {
    try {
        const results = await triggerManualRun();

        res.json({
            success: true,
            message: 'Automation run completed',
            data: results
        });
    } catch (error) {
        console.error('Error triggering automation:', error);

        if (error.message === 'Automation is already running') {
            return res.status(409).json({
                success: false,
                message: 'Automation is already running. Please wait for it to complete.',
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to trigger automation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
