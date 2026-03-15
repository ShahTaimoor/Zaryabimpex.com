const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const paymentService = require('../services/paymentService');
const { auth, requirePermission } = require('../middleware/auth');
const { sanitizeRequest, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/payments/process
// @desc    Process a payment
// @access  Private
router.post('/process', [
  sanitizeRequest,
  auth,
  requirePermission('process_payments'),
  body('orderId').isUUID(4).withMessage('Valid order ID is required'),
  body('paymentMethod').isIn(['cash', 'credit_card', 'debit_card', 'digital_wallet', 'bank_transfer', 'check', 'gift_card', 'store_credit']).withMessage('Valid payment method is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('gateway').optional().isIn(['stripe', 'paypal', 'square', 'authorize_net', 'manual', 'offline']).withMessage('Valid gateway is required'),
  body('cardDetails').optional().isObject().withMessage('Card details must be an object'),
  body('walletDetails').optional().isObject().withMessage('Wallet details must be an object'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const result = await paymentService.processPayment(req.body, req.user);
    
    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: result
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Payment processing failed'
    });
  }
});

// @route   POST /api/payments/:paymentId/refund
// @desc    Process a refund
// @access  Private
router.post('/:paymentId/refund', [
  sanitizeRequest,
  auth,
  requirePermission('process_refunds'),
  param('paymentId').isUUID(4).withMessage('Valid payment ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Refund amount must be greater than 0'),
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    const result = await paymentService.processRefund(paymentId, { amount, reason }, req.user);
    
    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: result
    });

  } catch (error) {
    console.error('Refund processing error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Refund processing failed'
    });
  }
});

// @route   POST /api/payments/transactions/:transactionId/void
// @desc    Void a transaction
// @access  Private
router.post('/transactions/:transactionId/void', [
  sanitizeRequest,
  auth,
  requirePermission('void_transactions'),
  param('transactionId').isLength({ min: 1 }).withMessage('Valid transaction ID is required'),
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { transactionId } = req.params;
    const { reason } = req.body;

    const result = await paymentService.voidTransaction(transactionId, req.user, reason);
    
    res.json({
      success: true,
      message: 'Transaction voided successfully',
      data: result
    });

  } catch (error) {
    console.error('Void transaction error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Void transaction failed'
    });
  }
});

// @route   GET /api/payments
// @desc    Get payment history
// @access  Private
router.get('/', [
  sanitizeRequest,
  auth,
  requirePermission('view_payments'),
  query('orderId').optional().isUUID(4).withMessage('Valid order ID is required'),
  query('paymentId').optional().isUUID(4).withMessage('Valid payment ID is required'),
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded']).withMessage('Valid status is required'),
  query('paymentMethod').optional().isIn(['cash', 'credit_card', 'debit_card', 'digital_wallet', 'bank_transfer', 'check', 'gift_card', 'store_credit']).withMessage('Valid payment method is required'),
  query('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  query('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const result = await paymentService.getPaymentHistory(req.query);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment history'
    });
  }
});

// @route   GET /api/payments/stats
// @desc    Get payment statistics
// @access  Private
router.get('/stats', [
  sanitizeRequest,
  auth,
  requirePermission('view_payment_stats'),
  query('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  query('endDate').optional().isISO8601().withMessage('Valid end date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { startDate, endDate } = req.query;
    const result = await paymentService.getPaymentStats(startDate, endDate);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment statistics'
    });
  }
});

// @route   GET /api/payments/methods
// @desc    Get available payment methods
// @access  Private
router.get('/methods', [
  sanitizeRequest,
  auth
], async (req, res) => {
  try {
    const paymentMethods = [
      {
        id: 'cash',
        name: 'Cash',
        description: 'Cash payment',
        icon: 'cash',
        processingTime: 'instant',
        fees: 0,
        gateway: 'manual'
      },
      {
        id: 'credit_card',
        name: 'Credit Card',
        description: 'Visa, Mastercard, American Express',
        icon: 'credit-card',
        processingTime: 'instant',
        fees: '2.9% + 30¢',
        gateway: 'stripe'
      },
      {
        id: 'debit_card',
        name: 'Debit Card',
        description: 'Visa, Mastercard debit cards',
        icon: 'debit-card',
        processingTime: 'instant',
        fees: '2.9% + 30¢',
        gateway: 'stripe'
      },
      {
        id: 'digital_wallet',
        name: 'Digital Wallet',
        description: 'Apple Pay, Google Pay',
        icon: 'smartphone',
        processingTime: 'instant',
        fees: '2.9% + 30¢',
        gateway: 'stripe'
      },
      {
        id: 'check',
        name: 'Check',
        description: 'Check payment',
        icon: 'check',
        processingTime: '1-3 days',
        fees: 0,
        gateway: 'manual'
      },
      {
        id: 'bank_transfer',
        name: 'Bank Transfer',
        description: 'Direct bank transfer',
        icon: 'bank',
        processingTime: '1-2 days',
        fees: 0,
        gateway: 'manual'
      },
      {
        id: 'gift_card',
        name: 'Gift Card',
        description: 'Store gift card',
        icon: 'gift',
        processingTime: 'instant',
        fees: 0,
        gateway: 'manual'
      },
      {
        id: 'store_credit',
        name: 'Store Credit',
        description: 'Store credit account',
        icon: 'credit',
        processingTime: 'instant',
        fees: 0,
        gateway: 'manual'
      }
    ];

    res.json({
      success: true,
      data: paymentMethods
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment methods'
    });
  }
});

// @route   GET /api/payments/:paymentId
// @desc    Get payment details
// @access  Private
router.get('/:paymentId', [
  sanitizeRequest,
  auth,
  requirePermission('view_payments'),
  param('paymentId').isUUID(4).withMessage('Valid payment ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const payment = await paymentService.getPaymentById(req.params.paymentId);

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    if (error.message === 'Payment not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    console.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment details'
    });
  }
});

module.exports = router;
