const express = require('express');
const { body, validationResult, query } = require('express-validator');
const multer = require('multer');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { auth, requirePermission } = require('../middleware/auth');
const ledgerAccountService = require('../services/ledgerAccountService');
const customerService = require('../services/customerService');
const customerRepository = require('../repositories/CustomerRepository');
const { retryMongoTransaction, isDuplicateKeyError } = require('../utils/retry');
const { preventDuplicates } = require('../middleware/duplicatePrevention');
const customerAuditLogService = require('../services/customerAuditLogService');
const customerTransactionService = require('../services/customerTransactionService');
const customerCreditPolicyService = require('../services/customerCreditPolicyService');

// Helper function to transform customer names to uppercase
const transformCustomerToUppercase = (customer) => {
  if (!customer) return customer;
  if (customer.toObject) customer = customer.toObject();
  if (customer.name) customer.name = customer.name.toUpperCase();
  if (customer.businessName) customer.businessName = customer.businessName.toUpperCase();
  if (customer.firstName) customer.firstName = customer.firstName.toUpperCase();
  if (customer.lastName) customer.lastName = customer.lastName.toUpperCase();
  return customer;
};

const router = express.Router();

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const validateCustomerIdParam = (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid customer ID' });
  }
  next();
};

const isTransactionNotSupportedError = (error) => {
  if (!error) return false;
  const message = error.message || '';
  return error.code === 20 ||
    error.codeName === 'IllegalOperation' ||
    message.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
    message.includes('transactions are not supported');
};

const runWithOptionalTransaction = async (operation, context = 'operation') => {
  let session = null;
  let transactionStarted = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    transactionStarted = true;

    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (transactionStarted && session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error(`Failed to abort transaction for ${context}:`, abortError);
      }
    }

    if (!transactionStarted && isTransactionNotSupportedError(error)) {
      console.warn(`Transactions not supported for MongoDB deployment. Retrying ${context} without session.`);
      return await operation(null);
    }

    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

const parseOpeningBalance = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const applyOpeningBalance = (customer, openingBalance) => {
  if (openingBalance === null) return;
  customer.openingBalance = openingBalance;
  if (openingBalance >= 0) {
    // Positive opening balance: customer owes us money
    customer.pendingBalance = openingBalance;
    customer.advanceBalance = 0;
  } else {
    // Negative opening balance: we owe customer money (credit/advance)
    customer.pendingBalance = 0;
    customer.advanceBalance = Math.abs(openingBalance);
  }
  // Current balance = what customer owes us minus what we owe them
  customer.currentBalance = customer.pendingBalance - (customer.advanceBalance || 0);
};

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// @route   GET /api/customers
// @desc    Get all customers with filtering and pagination
// @access  Private
router.get('/', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 999999 }),
  query('all').optional({ checkFalsy: true }).isBoolean(),
  query('search').optional().trim(),
  query('businessType').optional().isIn(['retail', 'wholesale', 'distributor', 'individual']),
  query('status').optional().isIn(['active', 'inactive', 'suspended']),
  query('customerTier').optional().isIn(['bronze', 'silver', 'gold', 'platinum']),
  query('emailStatus').optional().isIn(['verified', 'unverified', 'no-email']),
  query('phoneStatus').optional().isIn(['verified', 'unverified', 'no-phone'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Call service to get customers
    const result = await customerService.getCustomers(req.query);
    
    res.json({
      customers: result.customers,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/customers/cities
// @desc    Get all unique cities from customer addresses
// @access  Private
router.get('/cities', [
  auth,
  requirePermission('view_reports')
], async (req, res) => {
  try {
    const cities = await customerService.getUniqueCities();
    res.json({
      success: true,
      data: cities
    });
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/customers/by-cities
// @desc    Get customers filtered by cities
// @access  Private
router.get('/by-cities', [
  auth,
  requirePermission('view_reports'),
  query('cities').optional().isString().withMessage('Cities must be a comma-separated string'),
  query('showZeroBalance').optional().isIn(['true', 'false']).withMessage('showZeroBalance must be true or false')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const citiesParam = req.query.cities;
    const showZeroBalance = req.query.showZeroBalance === 'true';
    
    const citiesArray = citiesParam
      ? citiesParam.split(',').map(c => c.trim()).filter(c => c)
      : [];
    
    // Call service to get customers by cities
    const formattedCustomers = await customerService.getCustomersByCities(citiesArray, showZeroBalance);
    
    res.json({
      success: true,
      data: formattedCustomers,
      count: formattedCustomers.length
    });
  } catch (error) {
    console.error('Get customers by cities error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/customers/:id
// @desc    Get single customer
// @access  Private
router.get('/:id', [auth, validateCustomerIdParam], async (req, res) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id);
    res.json({ customer });
  } catch (error) {
    if (error.message === 'Customer not found') {
      return res.status(404).json({ message: 'Customer not found' });
    }
    console.error('Get customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// @route   GET /api/customers/search/:query
// @desc    Search customers by name, email, or phone
// @access  Private
router.get('/search/:query', auth, async (req, res) => {
  try {
    const query = req.params.query;
    const customers = await customerService.searchCustomers(query, 10);
    res.json({ customers });
  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/customers/check-email/:email
// @desc    Check if email already exists
// @access  Private
router.get('/check-email/:email', auth, async (req, res) => {
  try {
    const email = req.params.email;
    const excludeId = req.query.excludeId; // Optional: exclude current customer when editing
    
    if (!email || email.trim() === '') {
      return res.json({ exists: false });
    }
    
    const exists = await customerService.checkEmailExists(email, excludeId);
    return res.json({ exists });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/customers/check-business-name/:businessName
// @desc    Check if business name already exists
// @access  Private
router.get('/check-business-name/:businessName', auth, async (req, res) => {
  try {
    const businessName = req.params.businessName;
    const excludeId = req.query.excludeId; // Optional: exclude current customer when editing
    
    if (!businessName || businessName.trim() === '') {
      return res.json({ exists: false });
    }
    
    const exists = await customerService.checkBusinessNameExists(businessName, excludeId);
    
    res.json({ 
      exists,
      businessName: businessName.trim()
    });
  } catch (error) {
    console.error('Check business name error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/customers/:id/address
// @desc    Add address to customer
// @access  Private
router.post('/:id/address', [
  auth,
  validateCustomerIdParam,
  requirePermission('edit_customers'),
  body('type').isIn(['billing', 'shipping', 'both']).withMessage('Invalid address type'),
  body('street').trim().isLength({ min: 1 }).withMessage('Street is required'),
  body('city').trim().isLength({ min: 1 }).withMessage('City is required'),
  body('state').trim().isLength({ min: 1 }).withMessage('State is required'),
  body('zipCode').trim().isLength({ min: 1 }).withMessage('Zip code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const customer = await customerService.addCustomerAddress(req.params.id, req.body);
    
    res.json({
      message: 'Address added successfully',
      customer
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/customers/:id/credit-limit
// @desc    Update customer credit limit
// @access  Private
router.put('/:id/credit-limit', [
  auth,
  validateCustomerIdParam,
  requirePermission('edit_customers'),
  body('creditLimit').isFloat({ min: 0 }).withMessage('Credit limit must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const customer = await customerService.updateCustomerCreditLimit(
      req.params.id,
      req.body.creditLimit,
      req.user._id
    );
    
    res.json({
      message: 'Credit limit updated successfully',
      customer
    });
  } catch (error) {
    console.error('Update credit limit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/customers
// @desc    Create a new customer with retry logic for WriteConflict errors
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_customers'),
  preventDuplicates({ windowMs: 10000 }), // Prevent duplicate submissions within 10 seconds
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('businessName').trim().isLength({ min: 1 }).withMessage('Business name is required'),
  body('businessType').optional().isIn(['retail', 'wholesale', 'distributor', 'individual']),
  body('customerTier').optional().isIn(['bronze', 'silver', 'gold', 'platinum']),
  body('creditLimit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be a positive number'),
  body('openingBalance').optional().isFloat().withMessage('Opening balance must be a valid number'),
  body('status').optional().isIn(['active', 'inactive', 'suspended'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await customerService.createCustomer(req.body, req.user._id, {
      openingBalance: req.body.openingBalance
    });

    res.status(201).json({
      success: true,
      message: result.message,
      customer: result.customer
    });
  } catch (error) {
    console.error('Create customer error:', {
      name: error.name,
      code: error.code,
      codeName: error.codeName,
      message: error.message,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });

    // Handle duplicate key errors (11000) - return HTTP 409 Conflict
    if (isDuplicateKeyError(error)) {
      let message = 'A customer with this information already exists';
      let field = 'unknown';

      if (error.keyPattern) {
        if (error.keyPattern.businessName) {
          message = 'A customer with this business name already exists';
          field = 'businessName';
        } else if (error.keyPattern.email) {
          message = 'A customer with this email already exists';
          field = 'email';
        } else if (error.keyPattern.phone) {
          message = 'A customer with this phone number already exists';
          field = 'phone';
        }
      }

      return res.status(409).json({
        success: false,
        error: {
          message,
          field,
          code: 'DUPLICATE_ENTRY',
          codeName: 'DuplicateKey',
          keyValue: error.keyValue
        }
      });
    }

    // Handle WriteConflict errors that weren't retried successfully
    if (error.code === 112 || error.codeName === 'WriteConflict') {
      return res.status(409).json({
        success: false,
        error: {
          message: 'A concurrent update conflict occurred. Please try again.',
          code: 'WRITE_CONFLICT',
          retryable: true
        }
      });
    }

    // Handle ledger account errors
    if (error.message && error.message.includes('Accounts Receivable')) {
      return res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to configure ledger account. Please contact support.',
          code: 'LEDGER_ACCOUNT_ERROR',
          ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }
      });
    }

    // Handle null reference errors (like accessing _id on null)
    if (error.message && (error.message.includes("Cannot read properties of null") || error.message.includes("_id"))) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to configure customer ledger account. Please ensure the chart of accounts is properly set up.',
          code: 'LEDGER_ACCOUNT_CONFIG_ERROR',
          ...(process.env.NODE_ENV === 'development' && { details: error.message, stack: error.stack })
        }
      });
    }

    // Handle other MongoDB errors
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Database error occurred. Please try again.',
          code: 'DATABASE_ERROR',
          ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }
      });
    }

    // Default error response
    res.status(500).json({
      success: false,
      error: {
        message: 'An unexpected error occurred while creating the customer',
        code: 'INTERNAL_SERVER_ERROR',
        ...(process.env.NODE_ENV === 'development' && { details: error.message, stack: error.stack })
      }
    });
  }
});

// @route   PUT /api/customers/:id
// @desc    Update a customer with retry logic for WriteConflict errors
// @access  Private
router.put('/:id', [
  auth,
  validateCustomerIdParam,
  requirePermission('edit_customers'),
  preventDuplicates({ windowMs: 10000 }), // Prevent duplicate submissions within 10 seconds
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Name cannot be empty'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('businessName').optional().trim().isLength({ min: 1 }).withMessage('Business name cannot be empty'),
  body('businessType').optional().isIn(['retail', 'wholesale', 'distributor', 'individual']),
  body('customerTier').optional().isIn(['bronze', 'silver', 'gold', 'platinum']),
  body('creditLimit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be a positive number'),
  body('openingBalance').optional().isFloat().withMessage('Opening balance must be a valid number'),
  body('status').optional().isIn(['active', 'inactive', 'suspended'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Include version for optimistic locking
    const updateData = {
      ...req.body,
      version: req.body.version !== undefined ? req.body.version : undefined
    };

    const result = await retryMongoTransaction(async () => {
      return await customerService.updateCustomer(
        req.params.id,
        updateData,
        req.user._id,
        { openingBalance: req.body.openingBalance }
      );
    }, {
      maxRetries: 5,
      initialDelay: 100,
      maxDelay: 3000
    });

    res.json({
      success: true,
      message: result.message,
      customer: result.customer
    });
  } catch (error) {
    console.error('Update customer error:', {
      name: error.name,
      code: error.code,
      codeName: error.codeName,
      message: error.message,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });

    // Handle duplicate key errors (11000) - return HTTP 409 Conflict
    if (isDuplicateKeyError(error)) {
      let message = 'A customer with this information already exists';
      let field = 'unknown';

      if (error.keyPattern) {
        if (error.keyPattern.businessName) {
          message = 'A customer with this business name already exists';
          field = 'businessName';
        } else if (error.keyPattern.email) {
          message = 'A customer with this email already exists';
          field = 'email';
        } else if (error.keyPattern.phone) {
          message = 'A customer with this phone number already exists';
          field = 'phone';
        }
      }

      return res.status(409).json({
        success: false,
        error: {
          message,
          field,
          code: 'DUPLICATE_ENTRY',
          codeName: 'DuplicateKey',
          keyValue: error.keyValue
        }
      });
    }

    // Handle WriteConflict errors that weren't retried successfully
    if (error.code === 112 || error.codeName === 'WriteConflict') {
      return res.status(409).json({
        success: false,
        error: {
          message: 'A concurrent update conflict occurred. Please try again.',
          code: 'WRITE_CONFLICT',
          retryable: true
        }
      });
    }

    // Handle other MongoDB errors
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Database error occurred. Please try again.',
          code: 'DATABASE_ERROR',
          ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }
      });
    }

    // Default error response
    res.status(500).json({
      success: false,
      error: {
        message: 'An unexpected error occurred while updating the customer',
        code: 'INTERNAL_SERVER_ERROR',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      }
    });
  }
});

// @route   DELETE /api/customers/:id
// @desc    Delete a customer (soft delete)
// @access  Private
router.delete('/:id', [
  auth,
  validateCustomerIdParam,
  requirePermission('delete_customers')
], async (req, res) => {
  try {
    const reason = req.body.reason || 'Customer deleted';
    const result = await customerService.deleteCustomer(req.params.id, req.user._id, reason);

    res.json({ message: result.message });
  } catch (error) {
    console.error('Delete customer error:', error);
    if (error.message.includes('outstanding balance') || error.message.includes('pending orders')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/customers/:id/restore
// @desc    Restore soft-deleted customer
// @access  Private
router.post('/:id/restore', [
  auth,
  validateCustomerIdParam,
  requirePermission('delete_customers')
], async (req, res) => {
  try {
    const result = await customerService.restoreCustomer(req.params.id, req.user._id);
    res.json({ success: true, message: result.message, customer: result.customer });
  } catch (error) {
    console.error('Restore customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/customers/deleted
// @desc    Get all deleted customers
// @access  Private
router.get('/deleted', [
  auth,
  requirePermission('view_customers')
], async (req, res) => {
  try {
    const result = await customerService.getDeletedCustomers(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get deleted customers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/customers/:id/balance
// @desc    Manually update customer balance
// @access  Private
router.put('/:id/balance', [
  auth,
  validateCustomerIdParam,
  requirePermission('edit_customers'),
  body('pendingBalance').optional().isFloat({ min: 0 }).withMessage('Pending balance must be a positive number'),
  body('currentBalance').optional().isFloat().withMessage('Current balance must be a number'),
  body('advanceBalance').optional().isFloat({ min: 0 }).withMessage('Advance balance must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { pendingBalance, currentBalance, advanceBalance } = req.body;
    const balanceData = {};
    if (pendingBalance !== undefined) balanceData.pendingBalance = pendingBalance;
    if (currentBalance !== undefined) balanceData.currentBalance = currentBalance;
    if (advanceBalance !== undefined) balanceData.advanceBalance = advanceBalance;

    // Call service to update balance
    const result = await customerService.updateCustomerBalance(req.params.id, balanceData);
    
    res.json(result);
  } catch (error) {
    console.error('Update customer balance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/customers/import/excel
// @desc    Import customers from Excel
// @access  Private
router.post('/import/excel', [
  auth,
  requirePermission('create_customers'),
  upload.single('file')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const results = {
      total: 0,
      success: 0,
      errors: []
    };
    
    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const customers = XLSX.utils.sheet_to_json(worksheet);
    
    results.total = customers.length;
    
    for (let i = 0; i < customers.length; i++) {
      try {
        const row = customers[i];
        
        // Map Excel columns to our format
        const customerData = {
          name: row['Name'] || row['name'] || row.name,
          email: row['Email'] || row['email'] || row.email || undefined,
          phone: row['Phone'] || row['phone'] || row.phone || '',
          businessName: row['Business Name'] || row['businessName'] || row.businessName,
          businessType: row['Business Type'] || row['businessType'] || row.businessType || 'wholesale',
          taxId: row['Tax ID'] || row['taxId'] || row.taxId || '',
          customerTier: row['Customer Tier'] || row['customerTier'] || row.customerTier || 'bronze',
          creditLimit: row['Credit Limit'] || row['creditLimit'] || row.creditLimit || 0,
          paymentTerms: row['Payment Terms'] || row['paymentTerms'] || row.paymentTerms || 'cash',
          status: row['Status'] || row['status'] || row.status || 'active',
          notes: row['Notes'] || row['notes'] || row.notes || ''
        };
        
        // Validate required fields
        if (!customerData.name) {
          results.errors.push({
            row: i + 2,
            error: 'Missing required field: Name is required'
          });
          continue;
        }
        
        if (!customerData.businessName) {
          results.errors.push({
            row: i + 2,
            error: 'Missing required field: Business Name is required'
          });
          continue;
        }
        
        // Check if customer already exists
        const customerExists = await customerService.customerExists({ 
          businessName: customerData.businessName.toString().trim()
        });
        
        if (customerExists) {
          results.errors.push({
            row: i + 2,
            error: `Customer already exists with business name: ${customerData.businessName}`
          });
          continue;
        }
        
        // Create customer using service
        const customerPayload = {
          name: customerData.name.toString().trim(),
          email: customerData.email ? customerData.email.toString().trim() : undefined,
          phone: customerData.phone.toString().trim() || '',
          businessName: customerData.businessName.toString().trim(),
          businessType: customerData.businessType.toString().toLowerCase(),
          taxId: customerData.taxId.toString().trim() || '',
          customerTier: customerData.customerTier.toString().toLowerCase(),
          creditLimit: parseFloat(customerData.creditLimit) || 0,
          paymentTerms: customerData.paymentTerms.toString().toLowerCase(),
          status: customerData.status.toString().toLowerCase(),
          notes: customerData.notes.toString().trim() || ''
        };
        
        await customerService.createCustomer(customerPayload, req.user._id);
        results.success++;
        
      } catch (error) {
        results.errors.push({
          row: i + 2,
          error: error.message
        });
      }
    }
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({
      message: 'Import completed',
      results: results
    });
    
  } catch (error) {
    console.error('Excel import error:', error);
    res.status(500).json({ message: 'Import failed' });
  }
});

// @route   POST /api/customers/export/excel
// @desc    Export customers to Excel
// @access  Private
router.post('/export/excel', [auth, requirePermission('view_customers')], async (req, res) => {
  try {
    const { filters = {} } = req.body;
    
    // Call service to get customers for export
    const customers = await customerService.getCustomersForExport(filters);
    
    // Prepare Excel data
    const excelData = customers.map(customer => ({
      'Name': customer.name,
      'Email': customer.email || '',
      'Phone': customer.phone || '',
      'Business Name': customer.businessName,
      'Business Type': customer.businessType || '',
      'Tax ID': customer.taxId || '',
      'Customer Tier': customer.customerTier || '',
      'Credit Limit': customer.creditLimit || 0,
      'Current Balance': customer.currentBalance || 0,
      'Payment Terms': customer.paymentTerms || '',
      'Status': customer.status || 'active',
      'Notes': customer.notes || '',
      'Created Date': customer.createdAt?.toISOString().split('T')[0] || ''
    }));
    
    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const columnWidths = [
      { wch: 20 }, // Name
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 25 }, // Business Name
      { wch: 15 }, // Business Type
      { wch: 15 }, // Tax ID
      { wch: 15 }, // Customer Tier
      { wch: 12 }, // Credit Limit
      { wch: 15 }, // Current Balance
      { wch: 15 }, // Payment Terms
      { wch: 10 }, // Status
      { wch: 30 }, // Notes
      { wch: 12 }  // Created Date
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
    
    // Ensure exports directory exists
    if (!fs.existsSync('exports')) {
      fs.mkdirSync('exports');
    }
    
    const filename = 'customers.xlsx';
    const filepath = path.join('exports', filename);
    XLSX.writeFile(workbook, filepath);
    
    res.json({
      message: 'Customers exported successfully',
      filename: filename,
      recordCount: excelData.length,
      downloadUrl: `/api/customers/download/${filename}`
    });
    
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

// @route   GET /api/customers/download/:filename
// @desc    Download exported file
// @access  Private
router.get('/download/:filename', [auth, requirePermission('view_customers')], (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join('exports', filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ message: 'Download failed' });
      }
    });
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Download failed' });
  }
});

// @route   GET /api/customers/template/excel
// @desc    Download Excel template
// @access  Private
router.get('/template/excel', [auth, requirePermission('create_customers')], (req, res) => {
  try {
    const templateData = [
      {
        'Name': 'John Doe',
        'Email': 'john@example.com',
        'Phone': '555-0123',
        'Business Name': 'Example Business Inc',
        'Business Type': 'wholesale',
        'Tax ID': '12-3456789',
        'Customer Tier': 'bronze',
        'Credit Limit': '5000',
        'Payment Terms': 'net30',
        'Status': 'active',
        'Notes': 'Sample customer for template'
      }
    ];
    
    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    const columnWidths = [
      { wch: 20 }, // Name
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 25 }, // Business Name
      { wch: 15 }, // Business Type
      { wch: 15 }, // Tax ID
      { wch: 15 }, // Customer Tier
      { wch: 12 }, // Credit Limit
      { wch: 15 }, // Payment Terms
      { wch: 10 }, // Status
      { wch: 30 }  // Notes
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
    
    // Ensure exports directory exists
    if (!fs.existsSync('exports')) {
      fs.mkdirSync('exports');
    }
    
    const filename = 'customer_template.xlsx';
    const filepath = path.join('exports', filename);
    XLSX.writeFile(workbook, filepath);
    
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ message: 'Failed to download template' });
      }
    });
    
  } catch (error) {
    console.error('Template error:', error);
    res.status(500).json({ message: 'Failed to generate template' });
  }
});

// @route   GET /api/customers/:id/audit-logs
// @desc    Get audit logs for a customer
// @access  Private
router.get('/:id/audit-logs', [
  auth,
  validateCustomerIdParam,
  requirePermission('view_audit_logs')
], async (req, res) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 50,
      skip: parseInt(req.query.skip) || 0,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const logs = await customerAuditLogService.getCustomerAuditLogs(req.params.id, options);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Get customer audit logs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/customers/:id/transactions
// @desc    Get customer transaction history
// @access  Private
router.get('/:id/transactions', [
  auth,
  validateCustomerIdParam,
  requirePermission('view_customer_transactions')
], async (req, res) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 50,
      skip: parseInt(req.query.skip) || 0,
      transactionType: req.query.transactionType,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      includeReversed: req.query.includeReversed === 'true'
    };

    const result = await customerTransactionService.getCustomerTransactions(req.params.id, options);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get customer transactions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/customers/:id/overdue
// @desc    Get overdue invoices for a customer
// @access  Private
router.get('/:id/overdue', [
  auth,
  validateCustomerIdParam,
  requirePermission('view_customer_transactions')
], async (req, res) => {
  try {
    const overdueInvoices = await customerTransactionService.getOverdueInvoices(req.params.id);
    res.json({ success: true, data: overdueInvoices });
  } catch (error) {
    console.error('Get overdue invoices error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/customers/:id/aging
// @desc    Get customer aging report
// @access  Private
router.get('/:id/aging', [
  auth,
  validateCustomerIdParam,
  requirePermission('view_customer_reports')
], async (req, res) => {
  try {
    const aging = await customerTransactionService.getCustomerAging(req.params.id);
    res.json({ success: true, data: aging });
  } catch (error) {
    console.error('Get customer aging error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/customers/:id/apply-payment
// @desc    Apply payment to customer invoices
// @access  Private
router.post('/:id/apply-payment', [
  auth,
  validateCustomerIdParam,
  requirePermission('create_customer_transactions'),
  body('paymentAmount').isFloat({ min: 0.01 }).withMessage('Payment amount must be positive'),
  body('applications').isArray().withMessage('Applications must be an array'),
  body('applications.*.invoiceId').isMongoId().withMessage('Valid invoice ID is required'),
  body('applications.*.amount').isFloat({ min: 0.01 }).withMessage('Application amount must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const paymentApplication = await customerTransactionService.applyPayment(
      req.params.id,
      req.body.paymentAmount,
      req.body.applications,
      req.user
    );
    res.status(201).json({ success: true, data: paymentApplication });
  } catch (error) {
    console.error('Apply payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/customers/credit-policy/overdue
// @desc    Get all customers with overdue invoices
// @access  Private
router.get('/credit-policy/overdue', [
  auth,
  requirePermission('view_customer_reports')
], async (req, res) => {
  try {
    const options = {
      minDaysOverdue: parseInt(req.query.minDaysOverdue) || 0,
      maxDaysOverdue: req.query.maxDaysOverdue ? parseInt(req.query.maxDaysOverdue) : null,
      includeSuspended: req.query.includeSuspended === 'true'
    };

    const customers = await customerCreditPolicyService.getCustomersWithOverdueInvoices(options);
    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Get overdue customers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/customers/credit-policy/check-suspensions
// @desc    Check and auto-suspend overdue customers
// @access  Private
router.post('/credit-policy/check-suspensions', [
  auth,
  requirePermission('manage_customer_credit')
], async (req, res) => {
  try {
    const results = await customerCreditPolicyService.checkAndSuspendOverdueCustomers();
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Check suspensions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/customers/:id/credit-score
// @desc    Get customer credit score
// @access  Private
router.get('/:id/credit-score', [
  auth,
  validateCustomerIdParam,
  requirePermission('view_customer_reports')
], async (req, res) => {
  try {
    const creditScore = await customerCreditPolicyService.calculateCreditScore(req.params.id);
    res.json({ success: true, data: creditScore });
  } catch (error) {
    console.error('Get credit score error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
