const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const bankReceiptRepository = require('../repositories/postgres/BankReceiptRepository');
const customerRepository = require('../repositories/postgres/CustomerRepository');
const supplierRepository = require('../repositories/postgres/SupplierRepository');
const salesRepository = require('../repositories/SalesRepository');
const AccountingService = require('../services/accountingService');
const { validateUuidParam } = require('../middleware/validation');

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

    const result = await bankReceiptRepository.findWithPagination(filter, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
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
  body('bank').isUUID(4).withMessage('Valid bank account is required'),
  body('bankAccount').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Bank account must be a string (deprecated - use bank)'),
  body('bankName').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Bank name must be a string (deprecated - use bank)'),
  body('transactionReference').optional().isString().trim().withMessage('Transaction reference must be a string'),
  body('order').optional().isUUID(4).withMessage('Invalid order ID'),
  body('customer').optional().isUUID(4).withMessage('Invalid customer ID'),
  body('supplier').optional().isUUID(4).withMessage('Invalid supplier ID'),
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
      const customerExists = await customerRepository.findById(customer);
      if (!customerExists) {
        return res.status(400).json({
          success: false,
          message: 'Customer not found'
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

    // Validation: Must have either customer or supplier, not both
    if (customer && supplier) {
      return res.status(400).json({
        success: false,
        message: 'Bank receipt must be for either a customer OR a supplier, not both'
      });
    }

    if (!customer && !supplier) {
      return res.status(400).json({
        success: false,
        message: 'Bank receipt must specify either a customer or a supplier'
      });
    }

    // Validate amount
    const receiptAmount = parseFloat(amount);
    if (isNaN(receiptAmount) || receiptAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Bank validation - can be added later if Bank model is migrated to PostgreSQL

    // Create bank receipt with atomic transaction
    const { transaction } = require('../config/postgres');
    
    const bankReceipt = await transaction(async (client) => {
      const bankReceiptData = {
        date: date ? new Date(date) : new Date(),
        amount: receiptAmount,
        particular: particular ? particular.trim() : 'Bank Receipt',
        bankId: bank,
        transactionReference: transactionReference ? transactionReference.trim() : null,
        supplierId: supplier || null,
        customerId: customer || null,
        notes: notes ? notes.trim() : null,
        createdBy: req.user?.id || req.user?._id || req.user._id.toString()
      };

      // Create receipt
      const receipt = await bankReceiptRepository.create(bankReceiptData, client);

      // Post to account ledger atomically (using same client)
      await AccountingService.recordBankReceipt(receipt, client);

      return receipt;
    });

    // Fetch the created receipt with customer details using findById
    const receiptWithDetails = await bankReceiptRepository.findById(bankReceipt.id);

    res.status(201).json({
      success: true,
      message: 'Bank receipt created successfully',
      data: receiptWithDetails || bankReceipt
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
  validateUuidParam('id'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('particular').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Particular must be between 1 and 500 characters'),
  body('bank').optional().isUUID(4).withMessage('Valid bank account is required'),
  body('transactionReference').optional().isString().trim().withMessage('Transaction reference must be a string'),
  body('order').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid order ID'),
  body('customer').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid customer ID'),
  body('supplier').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid supplier ID'),
  body('notes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const bankReceipt = await bankReceiptRepository.findById(req.params.id);
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
      supplier,
      customer,
      notes
    } = req.body;

    const { transaction } = require('../config/postgres');
    const updatedReceipt = await transaction(async (client) => {
      // 1. Reverse old ledger entries
      await AccountingService.reverseLedgerEntriesByReference('bank_receipt', req.params.id, client);
      // 2. Update receipt (within transaction)
      const receipt = await bankReceiptRepository.update(req.params.id, {
        date: date ? new Date(date) : undefined,
        amount: amount ? parseFloat(amount) : undefined,
        particular: particular ? particular.trim() : undefined,
        bankId: bank || undefined,
        transactionReference: transactionReference ? transactionReference.trim() : undefined,
        supplierId: supplier !== undefined ? (supplier || null) : undefined,
        customerId: customer !== undefined ? (customer || null) : undefined,
        notes: notes ? notes.trim() : undefined
      }, client);
      if (!receipt) return null;
      // 3. Re-post ledger with updated values (must have customer or supplier)
      if (receipt.customer_id || receipt.supplier_id) {
        await AccountingService.recordBankReceipt(receipt, client);
      }
      return receipt;
    });

    if (!updatedReceipt) {
      return res.status(404).json({
        success: false,
        message: 'Bank receipt not found'
      });
    }

    // Fetch formatted receipt with supplier/customer for response
    const receiptWithDetails = await bankReceiptRepository.findById(req.params.id);

    res.json({
      success: true,
      message: 'Bank receipt updated successfully',
      data: receiptWithDetails || { ...updatedReceipt, voucherCode: updatedReceipt.receipt_number }
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
  requirePermission('delete_orders'),
  validateUuidParam('id'),
  handleValidationErrors
], async (req, res) => {
  try {
    const bankReceipt = await bankReceiptRepository.findById(req.params.id);
    if (!bankReceipt) {
      return res.status(404).json({
        success: false,
        message: 'Bank receipt not found'
      });
    }

    await bankReceiptRepository.delete(req.params.id);

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
