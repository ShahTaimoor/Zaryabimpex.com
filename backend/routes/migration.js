const express = require('express');
const { auth, requireAnyPermission } = require('../middleware/auth');
const { MANAGE_MIGRATION } = require('../config/routePermissions');
const migrationService = require('../services/migrationService');

const router = express.Router();

// @route   POST /api/migration/update-invoice-prefix
// @desc    Update existing ORD- invoices to SI- format
// @access  Private
router.post('/update-invoice-prefix', auth, requireAnyPermission(MANAGE_MIGRATION), async (req, res) => {
  try {
    const result = await migrationService.updateInvoicePrefix();
    res.json(result);
  } catch (error) {
    console.error('Error updating invoice prefixes:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating invoice prefixes',
      error: error.message
    });
  }
});

module.exports = router;
