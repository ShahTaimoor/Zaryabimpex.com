const express = require('express');
const { auth } = require('../middleware/auth');
const AccountingService = require('../services/accountingService');

const router = express.Router();

/**
 * @route   GET /api/accounting/balance/:type/:id
 * @desc    Get unified balance for an account (customer, supplier, bank, or coa)
 * @access  Private
 */
router.get('/balance/:type/:id', auth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { asOfDate } = req.query;

    const balance = await AccountingService.getUnifiedBalance(
      id, 
      type, 
      asOfDate ? new Date(asOfDate) : null
    );

    res.json({
      success: true,
      type,
      id,
      balance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching unified balance (${req.params.type}):`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch balance',
      error: error.message
    });
  }
});

module.exports = router;
