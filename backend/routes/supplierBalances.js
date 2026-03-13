const express = require('express');
const { body, param, query } = require('express-validator');
const SupplierBalanceService = require('../services/supplierBalanceService');
const supplierRepository = require('../repositories/SupplierRepository');
const { auth, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get supplier balance summary
router.get('/:supplierId', [
  auth,
  requirePermission('view_suppliers'),
  param('supplierId').isUUID(4).withMessage('Invalid supplier ID')
], async (req, res) => {
  try {
    const { supplierId } = req.params;
    const summary = await SupplierBalanceService.getBalanceSummary(supplierId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting supplier balance summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Record payment to supplier
router.post('/:supplierId/payment', [
  auth,
  requirePermission('manage_payments'),
  param('supplierId').isUUID(4).withMessage('Invalid supplier ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
  body('purchaseOrderId').optional().isUUID(4).withMessage('Invalid purchase order ID'),
  body('notes').optional().isString().trim().isLength({ max: 500 }).withMessage('Notes too long')
], async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { amount, purchaseOrderId, notes } = req.body;

    const updatedSupplier = await SupplierBalanceService.recordPayment(supplierId, amount, purchaseOrderId);

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        supplier: updatedSupplier,
        paymentAmount: amount
      }
    });
  } catch (error) {
    console.error('Error recording supplier payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Record refund from supplier
router.post('/:supplierId/refund', [
  auth,
  requirePermission('manage_payments'),
  param('supplierId').isUUID(4).withMessage('Invalid supplier ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Refund amount must be greater than 0'),
  body('purchaseOrderId').optional().isUUID(4).withMessage('Invalid purchase order ID'),
  body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Reason too long')
], async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { amount, purchaseOrderId, reason } = req.body;

    const updatedSupplier = await SupplierBalanceService.recordRefund(supplierId, amount, purchaseOrderId);

    res.json({
      success: true,
      message: 'Refund recorded successfully',
      data: {
        supplier: updatedSupplier,
        refundAmount: amount
      }
    });
  } catch (error) {
    console.error('Error recording supplier refund:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Recalculate supplier balance
router.post('/:supplierId/recalculate', [
  auth,
  requirePermission('manage_suppliers'),
  param('supplierId').isUUID(4).withMessage('Invalid supplier ID')
], async (req, res) => {
  try {
    const { supplierId } = req.params;
    const updatedSupplier = await SupplierBalanceService.recalculateBalance(supplierId);

    res.json({
      success: true,
      message: 'Supplier balance recalculated successfully',
      data: updatedSupplier
    });
  } catch (error) {
    console.error('Error recalculating supplier balance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Check if supplier can accept purchase
router.get('/:supplierId/can-accept-purchase', [
  auth,
  requirePermission('view_suppliers'),
  param('supplierId').isUUID(4).withMessage('Invalid supplier ID'),
  query('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
], async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { amount } = req.query;

    const eligibility = await SupplierBalanceService.canAcceptPurchase(supplierId, parseFloat(amount));

    res.json({
      success: true,
      data: eligibility
    });
  } catch (error) {
    console.error('Error checking purchase eligibility:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all suppliers with balance issues
router.get('/reports/balance-issues', [
  auth,
  requirePermission('view_reports')
], async (req, res) => {
  try {
    // Fetch all active suppliers
    const suppliers = await supplierRepository.findAll({ isDeleted: { $ne: true } }, {
      select: 'companyName contactPerson email phone openingBalance creditLimit'
    });

    const supplierIds = suppliers.map(s => s._id.toString());
    // Accounting removed - balances calculated from SupplierBalanceService
    const balanceMap = new Map();
    for (const supplierId of supplierIds) {
      try {
        const summary = await SupplierBalanceService.getBalanceSummary(supplierId);
        balanceMap.set(supplierId, summary.currentBalance || 0);
      } catch (error) {
        balanceMap.set(supplierId, 0);
      }
    }

    const pendingBalances = [];
    const advanceBalances = [];
    const overCreditLimit = [];

    suppliers.forEach(s => {
      const ledgerBalance = balanceMap.get(s._id.toString()) || 0;
      const netBalance = (s.openingBalance || 0) + ledgerBalance;

      const supplierWithBalance = {
        ...s.toObject(),
        pendingBalance: netBalance > 0 ? netBalance : 0,
        advanceBalance: netBalance < 0 ? Math.abs(netBalance) : 0,
        currentBalance: netBalance
      };

      if (netBalance > 0) pendingBalances.push(supplierWithBalance);
      if (netBalance < 0) advanceBalances.push(supplierWithBalance);
      if (s.creditLimit > 0 && netBalance > s.creditLimit) overCreditLimit.push(supplierWithBalance);
    });

    res.json({
      success: true,
      data: {
        pendingBalances,
        advanceBalances,
        overCreditLimit,
        summary: {
          totalPendingBalance: pendingBalances.reduce((sum, s) => sum + s.pendingBalance, 0),
          totalAdvanceBalance: advanceBalances.reduce((sum, s) => sum + s.advanceBalance, 0),
          suppliersWithPendingBalances: pendingBalances.length,
          suppliersWithAdvanceBalances: advanceBalances.length,
          suppliersOverCreditLimit: overCreditLimit.length
        }
      }
    });
  } catch (error) {
    console.error('Error getting supplier balance issues report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Fix all supplier balances (recalculate from purchase orders)
router.post('/fix-all-balances', [
  auth,
  requirePermission('manage_suppliers')
], async (req, res) => {
  try {
    const suppliers = await supplierRepository.findAll({});
    const results = [];

    for (const supplier of suppliers) {
      try {
        const updatedSupplier = await SupplierBalanceService.recalculateBalance(supplier._id);
        results.push({
          supplierId: supplier._id,
          supplierName: supplier.companyName,
          success: true,
          newPendingBalance: updatedSupplier.pendingBalance,
          newAdvanceBalance: updatedSupplier.advanceBalance
        });
      } catch (error) {
        results.push({
          supplierId: supplier._id,
          supplierName: supplier.companyName,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Supplier balance fix completed. ${successful} successful, ${failed} failed.`,
      data: {
        results,
        summary: {
          total: results.length,
          successful,
          failed
        }
      }
    });
  } catch (error) {
    console.error('Error fixing all supplier balances:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
