const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const CashPayment = require('../models/CashPayment'); // Still needed for new CashPayment() and static methods
const Sales = require('../models/Sales'); // Still needed for model reference in populate
const cashPaymentRepository = require('../repositories/CashPaymentRepository');
const supplierRepository = require('../repositories/SupplierRepository');
const customerRepository = require('../repositories/CustomerRepository');
const chartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const salesRepository = require('../repositories/SalesRepository');

// @route   GET /api/cash-payments
// @desc    Get all cash payments with filtering and pagination
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

    // Build filter object
    const filter = {};

    // Date range filter - use dateFilter from middleware (Pakistan timezone)
    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      Object.assign(filter, req.dateFilter);
    }

    // Voucher code filter
    if (voucherCode) {
      filter.voucherCode = { $regex: voucherCode, $options: 'i' };
    }

    // Amount filter
    if (amount) {
      filter.amount = parseFloat(amount);
    }

    // Particular filter
    if (particular) {
      filter.particular = { $regex: particular, $options: 'i' };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get cash payments with pagination
    const result = await cashPaymentRepository.findWithPagination(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { date: -1, createdAt: -1 },
      populate: [
        { path: 'order', model: 'Sales', select: 'orderNumber' },
        { path: 'supplier', select: 'companyName contactPerson' },
        { path: 'customer', select: 'name businessName email' },
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'expenseAccount', select: 'accountName accountCode' }
      ]
    });

    const cashPayments = result.cashPayments;
    const total = result.total;

    res.json({
      success: true,
      data: {
        cashPayments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get cash payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/cash-payments
// @desc    Create new cash payment
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_orders'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('particular').optional().isString().trim().isLength({ max: 500 }).withMessage('Particular must be less than 500 characters'),
  body('order').optional().isMongoId().withMessage('Invalid order ID'),
  body('supplier').optional().isMongoId().withMessage('Invalid supplier ID'),
  body('customer').optional().isMongoId().withMessage('Invalid customer ID'),
  body('paymentMethod').optional().isIn(['cash', 'check', 'other']).withMessage('Invalid payment method'),
  body('expenseAccount').optional().isMongoId().withMessage('Invalid expense account ID'),
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
      order,
      supplier,
      customer,
      paymentMethod = 'cash',
      notes,
      expenseAccount
    } = req.body;

    // Validate order exists if provided
    if (order) {
      const orderExists = await salesRepository.findById(order);
      if (!orderExists) {
        return res.status(400).json({
          success: false,
          message: 'Order not found'
        });
      }
    }

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

    let expenseAccountDoc = null;
    if (expenseAccount) {
      expenseAccountDoc = await chartOfAccountsRepository.findById(expenseAccount);
      if (!expenseAccountDoc) {
        return res.status(400).json({
          success: false,
          message: 'Expense account not found'
        });
      }
    }

    const resolvedParticular = particular
      ? particular.trim()
      : expenseAccountDoc
        ? `Expense - ${expenseAccountDoc.accountName}`
        : 'Cash Payment';

    // Create cash payment
    const cashPaymentData = {
      date: date ? new Date(date) : new Date(),
      amount: parseFloat(amount),
      particular: resolvedParticular,
      order: order || null,
      supplier: supplier || null,
      customer: customer || null,
      paymentMethod,
      notes: notes ? notes.trim() : null,
      createdBy: req.user._id,
      expenseAccount: expenseAccountDoc ? expenseAccountDoc._id : null
    };

    const cashPayment = new CashPayment(cashPaymentData);
    await cashPayment.save();

    // Update supplier balance if supplier is provided
    if (supplier && amount > 0) {
      try {
        const SupplierBalanceService = require('../services/supplierBalanceService');
        await SupplierBalanceService.recordPayment(supplier, amount, order);
      } catch (error) {
        console.error('Error updating supplier balance for cash payment:', error);
        // Don't fail the cash payment creation if balance update fails
      }
    }

    // Update customer balance if customer is provided
    // When we pay cash to a customer, we're giving them money (refund/advance)
    // This should use recordRefund() which properly handles reducing advanceBalance first,
    // then increasing advanceBalance if we're paying more than their credit
    if (customer && amount > 0) {
      try {
        const CustomerBalanceService = require('../services/customerBalanceService');
        await CustomerBalanceService.recordRefund(customer, amount, order);
      } catch (error) {
        console.error('Error updating customer balance for cash payment:', error);
        // Don't fail the cash payment creation if balance update fails
      }
    }

    // Create accounting entries
    try {
      const AccountingService = require('../services/accountingService');
      await AccountingService.recordCashPayment(cashPayment);
    } catch (error) {
      console.error('Error creating accounting entries for cash payment:', error);
      // Don't fail the cash payment creation if accounting fails
    }

    // Populate the created payment
    await cashPayment.populate([
      { path: 'order', select: 'orderNumber' },
      { path: 'supplier', select: 'companyName contactPerson' },
      { path: 'customer', select: 'name businessName email' },
      { path: 'createdBy', select: 'firstName lastName' },
      { path: 'expenseAccount', select: 'accountName accountCode' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Cash payment created successfully',
      data: cashPayment
    });
  } catch (error) {
    console.error('Create cash payment error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/cash-payments/summary/date-range
// @desc    Get cash payments summary for date range
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

    const filter = {
      date: {
        $gte: new Date(fromDate),
        $lte: new Date(toDate + 'T23:59:59.999Z')
      }
    };

    // Get summary data
    const summary = await cashPaymentRepository.getSummary(filter);

    const result = summary.length > 0 ? summary[0] : {
      totalAmount: 0,
      totalCount: 0,
      averageAmount: 0
    };

    res.json({
      success: true,
      data: {
        fromDate,
        toDate,
        totalAmount: result.totalAmount,
        totalCount: result.totalCount,
        averageAmount: result.averageAmount
      }
    });
  } catch (error) {
    console.error('Get cash payments summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/cash-payments/:id
// @desc    Update cash payment
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('edit_orders'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('particular').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Particular must be between 1 and 500 characters'),
  body('order').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid order ID'),
  body('supplier').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid supplier ID'),
  body('customer').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid customer ID'),
  body('paymentMethod').optional().isIn(['cash', 'check', 'other']).withMessage('Invalid payment method'),
  body('expenseAccount').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid expense account ID'),
  body('notes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const cashPayment = await CashPayment.findById(req.params.id);
    if (!cashPayment) {
      return res.status(404).json({
        success: false,
        message: 'Cash payment not found'
      });
    }

    const {
      date,
      amount,
      particular,
      order,
      supplier,
      customer,
      paymentMethod,
      notes,
      expenseAccount
    } = req.body;

    // Update fields
    if (date !== undefined) cashPayment.date = new Date(date);
    if (amount !== undefined) cashPayment.amount = parseFloat(amount);
    if (particular !== undefined) cashPayment.particular = particular.trim();
    if (order !== undefined) cashPayment.order = order || null;
    if (supplier !== undefined) cashPayment.supplier = supplier || null;
    if (customer !== undefined) cashPayment.customer = customer || null;
    if (paymentMethod !== undefined) cashPayment.paymentMethod = paymentMethod;
    if (notes !== undefined) cashPayment.notes = notes ? notes.trim() : null;
    if (expenseAccount !== undefined) cashPayment.expenseAccount = expenseAccount || null;

    cashPayment.updatedBy = req.user._id;

    await cashPayment.save();

    // Populate the updated payment
    await cashPayment.populate([
      { path: 'order', select: 'orderNumber' },
      { path: 'supplier', select: 'companyName contactPerson' },
      { path: 'customer', select: 'name businessName email' },
      { path: 'createdBy', select: 'firstName lastName' },
      { path: 'expenseAccount', select: 'accountName accountCode' }
    ]);

    res.json({
      success: true,
      message: 'Cash payment updated successfully',
      data: cashPayment
    });
  } catch (error) {
    console.error('Update cash payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/cash-payments/:id
// @desc    Delete cash payment
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_orders')
], async (req, res) => {
  try {
    const cashPayment = await CashPayment.findById(req.params.id);
    if (!cashPayment) {
      return res.status(404).json({
        success: false,
        message: 'Cash payment not found'
      });
    }

    await CashPayment.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Cash payment deleted successfully'
    });
  } catch (error) {
    console.error('Delete cash payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
