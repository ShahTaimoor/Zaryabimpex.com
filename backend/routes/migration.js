const express = require('express');
const { auth } = require('../middleware/auth');
const migrationService = require('../services/migrationService');

const router = express.Router();

// @route   POST /api/migration/update-invoice-prefix
// @desc    Update existing ORD- invoices to SI- format
// @access  Private
router.post('/update-invoice-prefix', auth, async (req, res) => {
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
