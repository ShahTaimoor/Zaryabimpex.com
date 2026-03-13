const express = require('express');
const { body, param, query } = require('express-validator');
const CustomerBalanceService = require('../services/customerBalanceService');
const customerRepository = require('../repositories/CustomerRepository');
const { auth, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get customer balance summary
router.get('/:customerId', [
  auth,
  requirePermission('view_customers'),
  param('customerId').isUUID(4).withMessage('Invalid customer ID')
], async (req, res) => {
  try {
    const { customerId } = req.params;
    const summary = await CustomerBalanceService.getBalanceSummary(customerId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting customer balance summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Record payment for customer
router.post('/:customerId/payment', [
  auth,
  requirePermission('manage_payments'),
  param('customerId').isUUID(4).withMessage('Invalid customer ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
  body('orderId').optional().isUUID(4).withMessage('Invalid order ID'),
  body('notes').optional().isString().trim().isLength({ max: 500 }).withMessage('Notes too long')
], async (req, res) => {
  try {
    const { customerId } = req.params;
    const { amount, orderId, notes } = req.body;

    const updatedCustomer = await CustomerBalanceService.recordPayment(customerId, amount, orderId);

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        customer: updatedCustomer,
        paymentAmount: amount
      }
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Record refund for customer
router.post('/:customerId/refund', [
  auth,
  requirePermission('manage_payments'),
  param('customerId').isUUID(4).withMessage('Invalid customer ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Refund amount must be greater than 0'),
  body('orderId').optional().isUUID(4).withMessage('Invalid order ID'),
  body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Reason too long')
], async (req, res) => {
  try {
    const { customerId } = req.params;
    const { amount, orderId, reason } = req.body;

    const updatedCustomer = await CustomerBalanceService.recordRefund(customerId, amount, orderId);

    res.json({
      success: true,
      message: 'Refund recorded successfully',
      data: {
        customer: updatedCustomer,
        refundAmount: amount
      }
    });
  } catch (error) {
    console.error('Error recording refund:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Recalculate customer balance
router.post('/:customerId/recalculate', [
  auth,
  requirePermission('manage_customers'),
  param('customerId').isUUID(4).withMessage('Invalid customer ID')
], async (req, res) => {
  try {
    const { customerId } = req.params;
    const updatedCustomer = await CustomerBalanceService.recalculateBalance(customerId);

    res.json({
      success: true,
      message: 'Customer balance recalculated successfully',
      data: updatedCustomer
    });
  } catch (error) {
    console.error('Error recalculating balance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Check if customer can make purchase
router.get('/:customerId/can-purchase', [
  auth,
  requirePermission('view_customers'),
  param('customerId').isUUID(4).withMessage('Invalid customer ID'),
  query('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
], async (req, res) => {
  try {
    const { customerId } = req.params;
    const { amount } = req.query;

    const eligibility = await CustomerBalanceService.canMakePurchase(customerId, parseFloat(amount));

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

// Get all customers with balance issues
router.get('/reports/balance-issues', [
  auth,
  requirePermission('view_reports')
], async (req, res) => {
  try {
    // Fetch all active customers
    const customers = await customerRepository.findAll({ isDeleted: { $ne: true } }, {
      select: 'name businessName email phone openingBalance creditLimit'
    });

    const customerIds = customers.map(c => c._id.toString());
    // Accounting removed - balances calculated from CustomerBalanceService
    const balanceMap = new Map();
    for (const customerId of customerIds) {
      try {
        const summary = await CustomerBalanceService.getBalanceSummary(customerId);
        balanceMap.set(customerId, summary.currentBalance || 0);
      } catch (error) {
        balanceMap.set(customerId, 0);
      }
    }

    const pendingBalances = [];
    const advanceBalances = [];
    const overCreditLimit = [];

    customers.forEach(c => {
      const ledgerBalance = balanceMap.get(c._id.toString()) || 0;
      const netBalance = (c.openingBalance || 0) + ledgerBalance;

      const customerWithBalance = {
        ...c.toObject(),
        pendingBalance: netBalance > 0 ? netBalance : 0,
        advanceBalance: netBalance < 0 ? Math.abs(netBalance) : 0,
        currentBalance: netBalance
      };

      if (netBalance > 0) pendingBalances.push(customerWithBalance);
      if (netBalance < 0) advanceBalances.push(customerWithBalance);
      if (c.creditLimit > 0 && netBalance > c.creditLimit) overCreditLimit.push(customerWithBalance);
    });

    res.json({
      success: true,
      data: {
        pendingBalances,
        advanceBalances,
        overCreditLimit,
        summary: {
          totalPendingBalance: pendingBalances.reduce((sum, c) => sum + c.pendingBalance, 0),
          totalAdvanceBalance: advanceBalances.reduce((sum, c) => sum + c.advanceBalance, 0),
          customersWithPendingBalances: pendingBalances.length,
          customersWithAdvanceBalances: advanceBalances.length,
          customersOverCreditLimit: overCreditLimit.length
        }
      }
    });
  } catch (error) {
    console.error('Error getting balance issues report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Fix all customer balances (recalculate from orders)
router.post('/fix-all-balances', [
  auth,
  requirePermission('manage_customers')
], async (req, res) => {
  try {
    const customers = await customerRepository.findAll({});
    const results = [];

    for (const customer of customers) {
      try {
        const updatedCustomer = await CustomerBalanceService.recalculateBalance(customer._id);
        results.push({
          customerId: customer._id,
          customerName: customer.businessName || customer.name,
          success: true,
          newPendingBalance: updatedCustomer.pendingBalance,
          newAdvanceBalance: updatedCustomer.advanceBalance
        });
      } catch (error) {
        results.push({
          customerId: customer._id,
          customerName: customer.businessName || customer.name,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Balance fix completed. ${successful} successful, ${failed} failed.`,
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
    console.error('Error fixing all balances:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Fix currentBalance for a specific customer (recalculate from pendingBalance and advanceBalance)
router.post('/:customerId/fix-current-balance', [
  auth,
  requirePermission('manage_customers'),
  param('customerId').isUUID(4).withMessage('Invalid customer ID')
], async (req, res) => {
  try {
    const { customerId } = req.params;
    const result = await CustomerBalanceService.fixCurrentBalance(customerId);

    res.json({
      success: true,
      message: result.fixed ? 'CurrentBalance fixed successfully' : result.message,
      data: result
    });
  } catch (error) {
    console.error('Error fixing currentBalance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Fix currentBalance for all customers (recalculate from pendingBalance and advanceBalance)
router.post('/fix-all-current-balances', [
  auth,
  requirePermission('manage_customers')
], async (req, res) => {
  try {
    const result = await CustomerBalanceService.fixAllCurrentBalances();

    res.json({
      success: true,
      message: `CurrentBalance fix completed. ${result.summary.fixed} fixed, ${result.summary.alreadyCorrect} already correct, ${result.summary.failed} failed.`,
      data: result
    });
  } catch (error) {
    console.error('Error fixing all currentBalances:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
