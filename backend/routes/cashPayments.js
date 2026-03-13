const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const cashPaymentRepository = require('../repositories/postgres/CashPaymentRepository');
const supplierRepository = require('../repositories/postgres/SupplierRepository');
const customerRepository = require('../repositories/postgres/CustomerRepository');
const AccountingService = require('../services/accountingService');
const { validateUuidParam } = require('../middleware/validation');

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

    const result = await cashPaymentRepository.findWithPagination(filter, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });

    res.json({
      success: true,
      data: {
        cashPayments: result.cashPayments,
        pagination: {
          currentPage: result.pagination.page,
          totalPages: result.pagination.pages,
          totalItems: result.pagination.total,
          itemsPerPage: result.pagination.limit
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
  body('order').optional().isUUID(4).withMessage('Invalid order ID'),
  body('supplier').optional().isUUID(4).withMessage('Invalid supplier ID'),
  body('customer').optional().isUUID(4).withMessage('Invalid customer ID'),
  body('paymentMethod').optional().isIn(['cash', 'check', 'other']).withMessage('Invalid payment method'),
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
      order,
      supplier,
      customer,
      paymentMethod = 'cash',
      notes,
      expenseAccount
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

    // Validation: Must have either customer, supplier, or expense account (Record Expense)
    if (customer && supplier) {
      return res.status(400).json({
        success: false,
        message: 'Cash payment must be for either a customer OR a supplier, not both'
      });
    }

    const isExpenseOnly = Boolean(expenseAccount) && !customer && !supplier;
    if (!customer && !supplier && !expenseAccount) {
      return res.status(400).json({
        success: false,
        message: 'Cash payment must specify either a customer, a supplier, or an expense account (Record Expense)'
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

    // Expense account validation removed - Chart of Accounts will be migrated separately
    const resolvedParticular = particular
      ? particular.trim()
      : 'Cash Payment';

    // Create cash payment with atomic transaction
    const { transaction } = require('../config/postgres');
    
    const cashPayment = await transaction(async (client) => {
      const cashPaymentData = {
        date: date ? new Date(date) : new Date(),
        amount: paymentAmount,
        particular: resolvedParticular,
        order: order || null,
        supplierId: supplier || null,
        customerId: customer || null,
        paymentMethod: paymentMethod || 'cash',
        notes: notes ? notes.trim() : null,
        createdBy: (req.user._id || req.user.id || req.user?.id)?.toString(),
      };

      // Create payment
      const payment = await cashPaymentRepository.create(cashPaymentData, client);

      // Post to account ledger atomically (using same client)
      if (isExpenseOnly && expenseAccount) {
        await AccountingService.recordExpenseCashPayment(payment, expenseAccount, client);
      } else {
        await AccountingService.recordCashPayment(payment, client);
      }

      return payment;
    });

    // Fetch related data
    let supplierDetails = null;
    let customerDetails = null;
    if (cashPayment.supplier_id) {
      supplierDetails = await supplierRepository.findById(cashPayment.supplier_id);
    }
    if (cashPayment.customer_id) {
      customerDetails = await customerRepository.findById(cashPayment.customer_id);
    }

    // Map payment_number to voucherCode for frontend compatibility
    const responseData = {
      ...cashPayment,
      voucherCode: cashPayment.payment_number,
      supplier: supplierDetails ? {
        id: supplierDetails.id,
        _id: supplierDetails.id,
        companyName: supplierDetails.company_name,
        name: supplierDetails.name,
        displayName: supplierDetails.company_name || supplierDetails.name
      } : null,
      customer: customerDetails ? {
        id: customerDetails.id,
        _id: customerDetails.id,
        name: customerDetails.name,
        businessName: customerDetails.business_name,
        displayName: customerDetails.business_name || customerDetails.name
      } : null
    };

    res.status(201).json({
      success: true,
      message: 'Cash payment created successfully',
      data: responseData
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

    const summary = await cashPaymentRepository.getSummary(fromDate, toDate);

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
  body('order').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid order ID'),
  body('supplier').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid supplier ID'),
  body('customer').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid customer ID'),
  body('paymentMethod').optional().isIn(['cash', 'check', 'other']).withMessage('Invalid payment method'),
  body('expenseAccount').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid expense account ID'),
  body('notes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const cashPayment = await cashPaymentRepository.findById(req.params.id);
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

    // Build update data object
    const updateData = {};
    if (date !== undefined) updateData.date = new Date(date);
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (particular !== undefined) updateData.particular = particular.trim();
    if (supplier !== undefined) updateData.supplierId = supplier || null;
    if (customer !== undefined) updateData.customerId = customer || null;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;
    updateData.updatedBy = req.user._id.toString();

    // Update with ledger adjustment (reverse old entries, update record, re-post new entries)
    const { transaction } = require('../config/postgres');
    const updatedPayment = await transaction(async (client) => {
      await AccountingService.reverseLedgerEntriesByReference('cash_payment', req.params.id, client);
      const payment = await cashPaymentRepository.update(req.params.id, updateData, client);
      if (!payment) return null;
      // Re-post only for supplier/customer payments (not expense-only)
      if (payment.supplier_id || payment.customer_id) {
        await AccountingService.recordCashPayment(payment, client);
      }
      return payment;
    });
    
    if (!updatedPayment) {
      return res.status(404).json({
        success: false,
        message: 'Cash payment not found'
      });
    }

    // Fetch supplier and customer details if they exist
    let supplierDetails = null;
    let customerDetails = null;
    if (updatedPayment.supplier_id) {
      supplierDetails = await supplierRepository.findById(updatedPayment.supplier_id);
    }
    if (updatedPayment.customer_id) {
      customerDetails = await customerRepository.findById(updatedPayment.customer_id);
    }

    // Map payment_number to voucherCode for frontend compatibility
    const responseData = {
      ...updatedPayment,
      voucherCode: updatedPayment.payment_number,
      supplier: supplierDetails ? {
        id: supplierDetails.id,
        _id: supplierDetails.id,
        companyName: supplierDetails.company_name,
        name: supplierDetails.name,
        displayName: supplierDetails.company_name || supplierDetails.name
      } : null,
      customer: customerDetails ? {
        id: customerDetails.id,
        _id: customerDetails.id,
        name: customerDetails.name,
        businessName: customerDetails.business_name,
        displayName: customerDetails.business_name || customerDetails.name
      } : null
    };

    res.json({
      success: true,
      message: 'Cash payment updated successfully',
      data: responseData
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
  requirePermission('delete_orders'),
  validateUuidParam('id'),
  handleValidationErrors
], async (req, res) => {
  try {
    const cashPayment = await cashPaymentRepository.findById(req.params.id);
    if (!cashPayment) {
      return res.status(404).json({
        success: false,
        message: 'Cash payment not found'
      });
    }

    await cashPaymentRepository.delete(req.params.id);

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
