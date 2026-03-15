const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const bankReceiptService = require('../services/bankReceiptService');
const BankReceipt = require('../models/BankReceipt'); // Still needed for create/update operations
const Bank = require('../models/Bank');
const Sales = require('../models/Sales');
const Customer = require('../models/Customer');

// @route   GET /api/bank-receipts
// @desc    Get all bank receipts with filtering and pagination
// @access  Private
router.get('/', [
  auth,
  requirePermission('view_reports'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
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
  ...validateDateParams,
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

    // Get date range for service call (for backward compatibility)
    const fromDate = req.dateRange?.startDate || null;
    const toDate = req.dateRange?.endDate || null;
    const dateFrom = req.dateRange?.startDate || null;
    const dateTo = req.dateRange?.endDate || null;

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

    const result = await bankReceiptService.getBankReceipts({
      page,
      limit,
      fromDate,
      toDate,
      dateFrom,
      dateTo,
      voucherCode,
      amount,
      particular
    });

    res.json({
      success: true,
      data: {
        bankReceipts: result.bankReceipts,
        pagination: result.pagination
      }
    });
  } catch (error) {
    console.error('Get bank receipts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/bank-receipts
// @desc    Create new bank receipt
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_orders'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('particular').optional().isString().trim().isLength({ max: 500 }).withMessage('Particular must be less than 500 characters'),
  body('bank').isMongoId().withMessage('Valid bank account is required'),
  body('bankAccount').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Bank account must be a string (deprecated - use bank)'),
  body('bankName').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Bank name must be a string (deprecated - use bank)'),
  body('transactionReference').optional().isString().trim().withMessage('Transaction reference must be a string'),
  body('order').optional().isMongoId().withMessage('Invalid order ID'),
  body('customer').optional().isMongoId().withMessage('Invalid customer ID'),
  body('supplier').optional().isMongoId().withMessage('Invalid supplier ID'),
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
      customer,
      supplier,
      notes
    } = req.body;

    // Validate order exists if provided
    if (order) {
      const orderExists = await Sales.findById(order);
      if (!orderExists) {
        return res.status(400).json({
          success: false,
          message: 'Order not found'
        });
      }
    }

    // Validate customer exists if provided
    if (customer) {
      const customerExists = await Customer.findById(customer);
      if (!customerExists) {
        return res.status(400).json({
          success: false,
          message: 'Customer not found'
        });
      }
    }

    // Validate supplier exists if provided
    if (supplier) {
      const supplierExists = await bankReceiptService.supplierExists(supplier);
      if (!supplierExists) {
        return res.status(400).json({
          success: false,
          message: 'Supplier not found'
        });
      }
    }

    // Validate bank exists
    const bankExists = await Bank.findById(bank);
    if (!bankExists) {
      return res.status(400).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    if (!bankExists.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Bank account is inactive'
      });
    }

    // Create bank receipt
    const bankReceiptData = {
      date: date ? new Date(date) : new Date(),
      amount: parseFloat(amount),
      particular: particular ? particular.trim() : 'Bank Receipt',
      bank: bank,
      transactionReference: transactionReference ? transactionReference.trim() : null,
      order: order || null,
      customer: customer || null,
      supplier: supplier || null,
      notes: notes ? notes.trim() : null,
      createdBy: req.user._id
    };

    const bankReceipt = new BankReceipt(bankReceiptData);
    await bankReceipt.save();

    // Update customer balance if customer is provided
    if (customer && amount > 0) {
      try {
        const CustomerBalanceService = require('../services/customerBalanceService');
        await CustomerBalanceService.recordPayment(customer, amount, order);
      } catch (error) {
        console.error('Error updating customer balance for bank receipt:', error);
        // Don't fail the bank receipt creation if balance update fails
      }
    }

    // Update supplier balance if supplier is provided
    // When we receive bank payment from a supplier, they're paying us (reduces our payables)
    if (supplier && amount > 0) {
      try {
        const SupplierBalanceService = require('../services/supplierBalanceService');
        await SupplierBalanceService.recordPayment(supplier, amount, order);
      } catch (error) {
        console.error('Error updating supplier balance for bank receipt:', error);
        // Don't fail the bank receipt creation if balance update fails
      }
    }

    // Create accounting entries
    try {
      const AccountingService = require('../services/accountingService');
      await AccountingService.recordBankReceipt(bankReceipt);
    } catch (error) {
      console.error('Error creating accounting entries for bank receipt:', error);
      // Don't fail the bank receipt creation if accounting fails
    }

    // Populate the created receipt
    await bankReceipt.populate([
      { path: 'bank', select: 'accountName accountNumber bankName' },
      { path: 'order', select: 'orderNumber' },
      { path: 'customer', select: 'name businessName' },
      { path: 'supplier', select: 'name businessName' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Bank receipt created successfully',
      data: bankReceipt
    });
  } catch (error) {
    console.error('Create bank receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/bank-receipts/summary/date-range
// @desc    Get bank receipts summary for date range
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

    const summary = await bankReceiptService.getSummary(fromDate, toDate);

    res.json({
      success: true,
      data: {
        fromDate,
        toDate,
        totalAmount: summary.totalAmount || 0,
        totalCount: summary.totalReceipts || 0,
        averageAmount: summary.averageAmount || 0
      }
    });
  } catch (error) {
    console.error('Get bank receipts summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/bank-receipts/:id
// @desc    Update bank receipt
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('edit_orders'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('particular').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Particular must be between 1 and 500 characters'),
  body('bank').optional().isMongoId().withMessage('Valid bank account is required'),
  body('transactionReference').optional().isString().trim().withMessage('Transaction reference must be a string'),
  body('order').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid order ID'),
  body('customer').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid customer ID'),
  body('supplier').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid supplier ID'),
  body('notes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const bankReceipt = await BankReceipt.findById(req.params.id);
    if (!bankReceipt) {
      return res.status(404).json({
        success: false,
        message: 'Bank receipt not found'
      });
    }

    const {
      date,
      amount,
      particular,
      bank,
      transactionReference,
      order,
      customer,
      supplier,
      notes
    } = req.body;

    // Update fields
    if (date !== undefined) bankReceipt.date = new Date(date);
    if (amount !== undefined) bankReceipt.amount = parseFloat(amount);
    if (particular !== undefined) bankReceipt.particular = particular.trim();
    if (bank !== undefined) bankReceipt.bank = bank;
    if (transactionReference !== undefined) bankReceipt.transactionReference = transactionReference ? transactionReference.trim() : null;
    if (order !== undefined) bankReceipt.order = order || null;
    if (customer !== undefined) bankReceipt.customer = customer || null;
    if (supplier !== undefined) bankReceipt.supplier = supplier || null;
    if (notes !== undefined) bankReceipt.notes = notes ? notes.trim() : null;

    bankReceipt.updatedBy = req.user._id;

    await bankReceipt.save();

    // Populate the updated receipt
    await bankReceipt.populate([
      { path: 'bank', select: 'accountName accountNumber bankName' },
      { path: 'order', select: 'orderNumber' },
      { path: 'customer', select: 'name businessName' },
      { path: 'supplier', select: 'name businessName' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.json({
      success: true,
      message: 'Bank receipt updated successfully',
      data: bankReceipt
    });
  } catch (error) {
    console.error('Update bank receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/bank-receipts/:id
// @desc    Delete bank receipt
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_orders')
], async (req, res) => {
  try {
    const bankReceipt = await BankReceipt.findById(req.params.id);
    if (!bankReceipt) {
      return res.status(404).json({
        success: false,
        message: 'Bank receipt not found'
      });
    }

    await BankReceipt.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Bank receipt deleted successfully'
    });
  } catch (error) {
    console.error('Delete bank receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
