const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const cashReceiptService = require('../services/cashReceiptService');
const cashReceiptRepository = require('../repositories/postgres/CashReceiptRepository');
const customerRepository = require('../repositories/postgres/CustomerRepository');
const supplierRepository = require('../repositories/postgres/SupplierRepository');
const AccountingService = require('../services/accountingService');

// @route   GET /api/cash-receipts
// @desc    Get all cash receipts with filtering and pagination
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

    // Build filter object for PostgreSQL
    // Normalize dates to start/end of day for proper filtering
    const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');
    const filter = {};
    
    if (req.dateRange?.startDate) {
      // Normalize to start of day (00:00:00)
      filter.startDate = getStartOfDayPakistan(req.dateRange.startDate) || new Date(req.dateRange.startDate);
    }
    if (req.dateRange?.endDate) {
      // Normalize to end of day (23:59:59.999)
      filter.endDate = getEndOfDayPakistan(req.dateRange.endDate) || new Date(req.dateRange.endDate);
    }
    if (voucherCode) {
      filter.voucherCode = voucherCode;
    }
    if (amount) {
      filter.amount = amount;
    }
    if (particular) {
      filter.particular = particular;
    }

    // Get cash receipts from PostgreSQL using findWithPagination
    const result = await cashReceiptRepository.findWithPagination(filter, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });

    res.json({
      success: true,
      data: {
        cashReceipts: result.cashReceipts,
        pagination: {
          currentPage: result.pagination.page,
          totalPages: result.pagination.pages,
          totalItems: result.pagination.total,
          itemsPerPage: result.pagination.limit
        }
      }
    });
  } catch (error) {
    console.error('Get cash receipts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/cash-receipts/:id
// @desc    Get single cash receipt
// @access  Private
router.get('/:id', [
  auth,
  requirePermission('view_reports')
], async (req, res) => {
  try {
    const cashReceipt = await cashReceiptService.getCashReceiptById(req.params.id);

    res.json({
      success: true,
      data: cashReceipt
    });
  } catch (error) {
    if (error.message === 'Cash receipt not found') {
      return res.status(404).json({ 
        success: false,
        message: 'Cash receipt not found' 
      });
    }
    console.error('Get cash receipt error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/cash-receipts
// @desc    Create new cash receipt
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_orders'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('amount')
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return false;
      }
      const numValue = parseFloat(value);
      return !isNaN(numValue) && numValue >= 0;
    })
    .withMessage('Amount must be a positive number'),
  body('particular').optional().isString().trim().isLength({ max: 500 }).withMessage('Particular must be less than 500 characters'),
  body('order').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid order ID'),
  body('customer').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid customer ID'),
  body('supplier').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid supplier ID'),
  body('paymentMethod').optional().isIn(['cash', 'check', 'bank_transfer', 'other']).withMessage('Invalid payment method'),
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
      customer,
      supplier,
      paymentMethod = 'cash',
      notes
    } = req.body;

    // Validate order exists if provided
    if (order) {
      // Order validation removed - orders handled separately
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
        message: 'Cash receipt must be for either a customer OR a supplier, not both'
      });
    }

    if (!customer && !supplier) {
      return res.status(400).json({
        success: false,
        message: 'Cash receipt must specify either a customer or a supplier'
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

    // Create cash receipt using PostgreSQL repository with atomic transaction
    const { transaction } = require('../config/postgres');
    
    const cashReceipt = await transaction(async (client) => {
      const cashReceiptData = {
        date: date ? new Date(date) : new Date(),
        amount: receiptAmount,
        particular: particular ? particular.trim() : 'Cash Receipt',
        supplierId: supplier || null,
        customerId: customer || null,
        paymentMethod: paymentMethod || 'cash',
        notes: notes ? notes.trim() : null,
        createdBy: req.user._id.toString()
      };

      // Create receipt
      const receipt = await cashReceiptRepository.create(cashReceiptData, client);

      // Post to account ledger atomically (using same client)
      await AccountingService.recordCashReceipt(receipt, client);

      return receipt;
    });

    // Fetch the created receipt with supplier/customer details using findById
    const receiptWithDetails = await cashReceiptRepository.findById(cashReceipt.id);

    // Map receipt_number to voucherCode for frontend compatibility
    const responseData = receiptWithDetails || {
      ...cashReceipt,
      voucherCode: cashReceipt.receipt_number
    };

    res.status(201).json({
      success: true,
      message: 'Cash receipt created successfully',
      data: responseData
    });
  } catch (error) {
    console.error('Create cash receipt error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/cash-receipts/:id
// @desc    Update cash receipt
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('edit_orders'),
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('particular').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Particular must be between 1 and 500 characters'),
  body('order').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid order ID'),
  body('customer').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid customer ID'),
  body('supplier').optional({ checkFalsy: true }).isUUID(4).withMessage('Invalid supplier ID'),
  body('paymentMethod').optional().isIn(['cash', 'check', 'bank_transfer', 'other']).withMessage('Invalid payment method'),
  body('notes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const cashReceipt = await cashReceiptRepository.findById(req.params.id);
    if (!cashReceipt) {
      return res.status(404).json({ 
        success: false,
        message: 'Cash receipt not found' 
      });
    }

    // Check if receipt can be updated (not cancelled)
    if (cashReceipt.status === 'cancelled') {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot update cancelled cash receipt' 
      });
    }

    const {
      date,
      amount,
      particular,
      supplier,
      customer,
      paymentMethod,
      notes
    } = req.body;

    const { transaction } = require('../config/postgres');
    const updatedReceipt = await transaction(async (client) => {
      // 1. Reverse old ledger entries
      await AccountingService.reverseLedgerEntriesByReference('cash_receipt', req.params.id, client);
      // 2. Update receipt (within transaction)
      const receipt = await cashReceiptRepository.update(req.params.id, {
        date: date ? new Date(date) : undefined,
        amount: amount ? parseFloat(amount) : undefined,
        particular: particular ? particular.trim() : undefined,
        supplierId: supplier !== undefined ? (supplier || null) : undefined,
        customerId: customer !== undefined ? (customer || null) : undefined,
        paymentMethod: paymentMethod || undefined,
        notes: notes ? notes.trim() : undefined
      }, client);
      if (!receipt) return null;
      // 3. Re-post ledger with updated values (must have customer or supplier)
      if (receipt.customer_id || receipt.supplier_id) {
        await AccountingService.recordCashReceipt(receipt, client);
      }
      return receipt;
    });

    if (!updatedReceipt) {
      return res.status(404).json({
        success: false,
        message: 'Cash receipt not found'
      });
    }

    // Map receipt_number to voucherCode for frontend compatibility
    // findById already includes customer data, so we just need to add voucherCode
    const responseData = {
      ...updatedReceipt,
      voucherCode: updatedReceipt.receipt_number || updatedReceipt.voucherCode
    };

    res.json({
      success: true,
      message: 'Cash receipt updated successfully',
      data: responseData
    });
  } catch (error) {
    console.error('Update cash receipt error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/cash-receipts/:id
// @desc    Delete cash receipt
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_orders')
], async (req, res) => {
  try {
    const cashReceipt = await cashReceiptRepository.findById(req.params.id);
    if (!cashReceipt) {
      return res.status(404).json({ 
        success: false,
        message: 'Cash receipt not found' 
      });
    }

    await cashReceiptRepository.delete(req.params.id);

    res.json({
      success: true,
      message: 'Cash receipt deleted successfully'
    });
  } catch (error) {
    console.error('Delete cash receipt error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/cash-receipts/summary/date-range
// @desc    Get cash receipts summary for date range
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

    const summary = await cashReceiptService.getSummary(fromDate, toDate);

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
    console.error('Get cash receipts summary error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/cash-receipts/batch
// @desc    Create multiple cash receipts in a batch (for voucher-based cash receiving)
// @access  Private
router.post('/batch', [
  auth,
  requirePermission('create_orders'),
  body('voucherDate').isISO8601().withMessage('Voucher date must be a valid date'),
  body('cashAccount').optional().isString().trim().withMessage('Cash account must be a string'),
  body('paymentType').optional().isString().trim().withMessage('Payment type must be a string'),
  body('receipts').isArray().withMessage('Receipts must be an array'),
  body('receipts.*.customer').isUUID().withMessage('Invalid customer ID'),
  body('receipts.*.amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('receipts.*.particular').optional().isString().trim().isLength({ max: 500 }).withMessage('Particular must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      voucherDate,
      cashAccount,
      paymentType = 'cash',
      receipts
    } = req.body;

    if (!receipts || receipts.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'At least one receipt entry is required' 
      });
    }

    // Validate all customers exist
    const customerIds = receipts.map(r => r.customer).filter(Boolean);
    const customers = await cashReceiptService.getCustomersByIds(customerIds);
    
    if (customers.length !== customerIds.length) {
      return res.status(400).json({ 
        success: false,
        message: 'One or more customers not found' 
      });
    }

    // Validate that at least one receipt has a valid amount
    const validReceipts = receipts.filter(r => r.amount && parseFloat(r.amount) > 0);
    if (validReceipts.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'At least one receipt with a positive amount is required' 
      });
    }

    // Create cash receipts
    const createdReceipts = [];
    const CustomerBalanceService = require('../services/customerBalanceService');

    for (const receiptData of receipts) {
      if (!receiptData.amount || receiptData.amount <= 0) {
        continue; // Skip zero amounts
      }

      const cashReceiptData = {
        date: new Date(voucherDate),
        amount: parseFloat(receiptData.amount),
        particular: receiptData.particular ? receiptData.particular.trim() : 'Cash Receipt',
        customer: receiptData.customer,
        paymentMethod: paymentType.toLowerCase(),
        notes: cashAccount ? `Cash Account: ${cashAccount}` : null,
        createdBy: req.user._id
      };

      const cashReceipt = await cashReceiptRepository.create({
        date: new Date(voucherDate),
        amount: parseFloat(receiptData.amount),
        particular: receiptData.particular ? receiptData.particular.trim() : 'Cash Receipt',
        customerId: receiptData.customer || null,
        paymentMethod: paymentType.toLowerCase(),
        notes: cashAccount ? `Cash Account: ${cashAccount}` : null,
        createdBy: req.user._id.toString()
      });

      // Create accounting entries
      try {
        await AccountingService.recordCashReceipt(cashReceipt);
      } catch (error) {
        console.error(`Error creating accounting entries for cash receipt ${cashReceipt.id}:`, error);
      }

      createdReceipts.push(cashReceipt);
    }

    const totalAmount = createdReceipts.reduce((sum, r) => sum + r.amount, 0);

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdReceipts.length} cash receipt(s)`,
      data: {
        receipts: createdReceipts,
        count: createdReceipts.length,
        totalAmount
      }
    });
  } catch (error) {
    console.error('Batch create cash receipts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
