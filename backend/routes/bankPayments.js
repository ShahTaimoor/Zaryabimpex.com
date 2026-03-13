const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const bankPaymentRepository = require('../repositories/postgres/BankPaymentRepository');
const supplierRepository = require('../repositories/postgres/SupplierRepository');
const customerRepository = require('../repositories/postgres/CustomerRepository');
const AccountingService = require('../services/accountingService');
const { validateUuidParam } = require('../middleware/validation');

// @route   GET /api/bank-payments
// @desc    Get all bank payments with filtering and pagination
// @access  Private
router.get('/', [
  auth,
  requirePermission('view_reports'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ...validateDateParams,
  query('voucherCode').optional().isString().trim().withMessage('Voucher code must be a string'),
  query('amount')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values for optional query params
      }
      const numValue = parseFloat(value);
      return !isNaN(numValue) && numValue >= 0;
    })
    .withMessage('Amount must be a positive number'),
  query('particular').optional().isString().trim().withMessage('Particular must be a string'),
  handleValidationErrors,
  processDateFilter('date'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 50,
      voucherCode,
      amount,
      particular
    } = req.query;

    // Build Postgres filter
    // Normalize dates to start/end of day for proper filtering
    const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');
    const filter = {
      startDate: req.dateRange?.startDate ? (getStartOfDayPakistan(req.dateRange.startDate) || new Date(req.dateRange.startDate)) : null,
      endDate: req.dateRange?.endDate ? (getEndOfDayPakistan(req.dateRange.endDate) || new Date(req.dateRange.endDate)) : null,
      voucherCode: voucherCode || undefined,
      amount: amount ? parseFloat(amount) : undefined,
      particular: particular || undefined
    };

    const result = await bankPaymentRepository.findWithPagination(filter, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });

    res.json({
      success: true,
      data: {
        bankPayments: result.bankPayments,
        pagination: {
          currentPage: result.pagination.page,
          totalPages: result.pagination.pages,
          totalItems: result.pagination.total,
          itemsPerPage: result.pagination.limit
        }
      }
    });
  } catch (error) {
    console.error('Get bank payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/bank-payments
// @desc    Create new bank payment
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_orders'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('particular').optional().isString().trim().isLength({ max: 500 }).withMessage('Particular must be less than 500 characters'),
  body('bank').isUUID(4).withMessage('Valid bank account is required'),
  body('bankAccount').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Bank account must be a string (deprecated - use bank)'),
  body('bankName').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Bank name must be a string (deprecated - use bank)'),
  body('transactionReference').optional().isString().trim().withMessage('Transaction reference must be a string'),
  body('order').optional().isUUID(4).withMessage('Invalid order ID'),
  body('supplier').optional().isUUID(4).withMessage('Invalid supplier ID'),
  body('customer').optional().isUUID(4).withMessage('Invalid customer ID'),
  body('expenseAccount').optional().isUUID(4).withMessage('Invalid expense account ID'),
  body('notes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      date,
      amount,
      particular,
      bank,
      bankAccount,
      bankName,
      transactionReference,
      order,
      supplier,
      customer,
      notes,
    } = req.body;

    // Order validation removed - orders handled separately

    // Validate supplier exists if provided
    if (supplier) {
      const supplierExists = await supplierRepository.findById(supplier);
      if (!supplierExists) {
        return res.status(400).json({
          success: false,
          message: 'Supplier not found'
        });
      }
    }

    // Validate customer exists if provided
    if (customer) {
      const customerExists = await customerRepository.findById(customer);
      if (!customerExists) {
        return res.status(400).json({
          success: false,
          message: 'Customer not found'
        });
      }
    }

    // Validation: Must have either customer or supplier, not both
    if (customer && supplier) {
      return res.status(400).json({
        success: false,
        message: 'Bank payment must be for either a customer OR a supplier, not both'
      });
    }

    if (!customer && !supplier) {
      return res.status(400).json({
        success: false,
        message: 'Bank payment must specify either a customer or a supplier'
      });
    }

    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Bank validation - can be added later if Bank model is migrated to PostgreSQL

    const resolvedParticular = particular
      ? particular.trim()
      : 'Bank Payment';

    // Create bank payment with atomic transaction
    const { transaction } = require('../config/postgres');
    
    const bankPayment = await transaction(async (client) => {
      const bankPaymentData = {
        date: date ? new Date(date) : new Date(),
        amount: paymentAmount,
        particular: resolvedParticular,
        bankId: bank || null,
        transactionReference: transactionReference ? transactionReference.trim() : null,
        supplierId: supplier || null,
        customerId: customer || null,
        notes: notes ? notes.trim() : null,
        createdBy: req.user._id.toString(),
      };

      // Create payment
      const payment = await bankPaymentRepository.create(bankPaymentData, client);

      // Post to account ledger atomically (using same client)
      await AccountingService.recordBankPayment(payment, client);

      return payment;
    });

    // Fetch the created payment with supplier/customer details using findById
    const paymentWithDetails = await bankPaymentRepository.findById(bankPayment.id);

    res.status(201).json({
      success: true,
      message: 'Bank payment created successfully',
      data: paymentWithDetails || bankPayment
    });
  } catch (error) {
    console.error('Create bank payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/bank-payments/summary/date-range
// @desc    Get bank payments summary for date range
// @access  Private
router.get('/summary/date-range', [
  auth,
  requirePermission('view_reports'),
  query('fromDate').isISO8601().withMessage('From date is required and must be a valid date'),
  query('toDate').isISO8601().withMessage('To date is required and must be a valid date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fromDate, toDate } = req.query;

    const summary = await bankPaymentRepository.getSummary(fromDate, toDate);

    res.json({
      success: true,
      data: {
        fromDate,
        toDate,
        totalAmount: summary.totalAmount || 0,
        totalCount: summary.totalCount || 0,
        averageAmount: summary.averageAmount || 0
      }
    });
  } catch (error) {
    console.error('Get bank payments summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/bank-payments/:id
// @desc    Update bank payment
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('edit_orders'),
  validateUuidParam('id'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('particular').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Particular must be between 1 and 500 characters'),
  body('bank').optional().isUUID(4).withMessage('Valid bank account is required'),
  body('transactionReference').optional().isString().trim().withMessage('Transaction reference must be a string'),
  body('supplier').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid supplier ID'),
  body('customer').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid customer ID'),
  body('notes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const existing = await bankPaymentRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Bank payment not found'
      });
    }

    const {
      date,
      amount,
      particular,
      bank,
      transactionReference,
      supplier,
      customer,
      notes
    } = req.body;

    const updateData = {};
    if (date !== undefined) updateData.date = new Date(date);
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (particular !== undefined) updateData.particular = particular.trim();
    if (bank !== undefined) updateData.bankId = bank;
    if (transactionReference !== undefined) updateData.transactionReference = transactionReference ? transactionReference.trim() : null;
    if (supplier !== undefined) updateData.supplierId = supplier || null;
    if (customer !== undefined) updateData.customerId = customer || null;
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;

    const { transaction } = require('../config/postgres');
    const updatedPayment = await transaction(async (client) => {
      // 1. Reverse old ledger entries
      await AccountingService.reverseLedgerEntriesByReference('bank_payment', req.params.id, client);
      // 2. Update payment (within transaction)
      const payment = await bankPaymentRepository.update(req.params.id, updateData, client);
      if (!payment) return null;
      // 3. Re-post ledger with updated values (must have customer or supplier)
      if (payment.customer_id || payment.supplier_id) {
        await AccountingService.recordBankPayment(payment, client);
      }
      return payment;
    });

    if (!updatedPayment) {
      return res.status(404).json({
        success: false,
        message: 'Bank payment not found'
      });
    }

    // Fetch formatted payment with supplier/customer for response
    const paymentWithDetails = await bankPaymentRepository.findById(req.params.id);

    res.json({
      success: true,
      message: 'Bank payment updated successfully',
      data: paymentWithDetails || { ...updatedPayment, voucherCode: updatedPayment.payment_number }
    });
  } catch (error) {
    console.error('Update bank payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/bank-payments/:id
// @desc    Delete bank payment
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_orders'),
  validateUuidParam('id'),
  handleValidationErrors
], async (req, res) => {
  try {
    const bankPayment = await bankPaymentRepository.findById(req.params.id);
    if (!bankPayment) {
      return res.status(404).json({
        success: false,
        message: 'Bank payment not found'
      });
    }

    await bankPaymentRepository.delete(req.params.id);

    res.json({
      success: true,
      message: 'Bank payment deleted successfully'
    });
  } catch (error) {
    console.error('Delete bank payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
