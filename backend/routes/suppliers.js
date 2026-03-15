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
const supplierService = require('../services/supplierService');
const supplierRepository = require('../repositories/SupplierRepository');
const Supplier = require('../models/Supplier'); // Still needed for new Supplier() in transaction helpers

const router = express.Router();

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// Helper function to transform supplier names to uppercase
const transformSupplierToUppercase = (supplier) => {
  if (!supplier) return supplier;
  if (supplier.toObject) supplier = supplier.toObject();
  if (supplier.companyName) supplier.companyName = supplier.companyName.toUpperCase();
  if (supplier.contactPerson && supplier.contactPerson.name) {
    supplier.contactPerson.name = supplier.contactPerson.name.toUpperCase();
  }
  return supplier;
};

const parseOpeningBalance = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const applyOpeningBalance = (supplier, openingBalance) => {
  if (openingBalance === null || openingBalance === undefined) return;
  supplier.openingBalance = openingBalance;
  if (openingBalance >= 0) {
    supplier.pendingBalance = openingBalance;
    supplier.advanceBalance = 0;
  } else {
    supplier.pendingBalance = 0;
    supplier.advanceBalance = Math.abs(openingBalance);
  }
  supplier.currentBalance = supplier.pendingBalance - (supplier.advanceBalance || 0);
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

const saveSupplierWithLedger = async (supplierData, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const openingBalance = parseOpeningBalance(supplierData.openingBalance);
    if (openingBalance !== null) {
      supplierData.openingBalance = openingBalance;
    }

    let supplier = new Supplier(supplierData);
    applyOpeningBalance(supplier, openingBalance);
    await supplier.save({ session });

    await ledgerAccountService.syncSupplierLedgerAccount(supplier, {
      session,
      userId
    });

    await session.commitTransaction();
    session.endSession();

    supplier = await supplierService.getSupplierByIdWithLedger(supplier._id);
    return supplier;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const updateSupplierWithLedger = async (supplierId, updateData, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const supplier = await supplierRepository.findById(supplierId, { session });

    if (!supplier) {
      await session.abortTransaction();
      session.endSession();
      return null;
    }

    const openingBalance = parseOpeningBalance(updateData.openingBalance);
    if (openingBalance !== null) {
      updateData.openingBalance = openingBalance;
      applyOpeningBalance(supplier, openingBalance);
    }

    Object.assign(supplier, {
      ...updateData,
      lastModifiedBy: userId
    });

    await supplier.save({ session });
    await ledgerAccountService.syncSupplierLedgerAccount(supplier, {
      session,
      userId
    });

    await session.commitTransaction();
    session.endSession();

    return supplierService.getSupplierByIdWithLedger(supplier._id);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const deleteSupplierWithLedger = async (supplierId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const supplier = await supplierRepository.findById(supplierId, { session });

    if (!supplier) {
      await session.abortTransaction();
      session.endSession();
      return null;
    }

    if (supplier.ledgerAccount) {
      await ledgerAccountService.deactivateLedgerAccount(supplier.ledgerAccount, {
        session,
        userId
      });
    }

    await supplier.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    return supplier;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};


// @route   GET /api/suppliers
// @desc    Get all suppliers with filtering and pagination
// @access  Private
router.get('/', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 999999 }),
  query('all').optional({ checkFalsy: true }).isBoolean(),
  query('search').optional().trim(),
  query('businessType').optional().custom((value) => {
    if (!value || value === '') return true;
    return ['manufacturer', 'distributor', 'wholesaler', 'dropshipper', 'other'].includes(value);
  }),
  query('status').optional().custom((value) => {
    if (!value || value === '') return true;
    return ['active', 'inactive', 'suspended', 'blacklisted'].includes(value);
  }),
  query('reliability').optional().custom((value) => {
    if (!value || value === '') return true;
    return ['excellent', 'good', 'average', 'poor'].includes(value);
  }),
  query('emailStatus').optional().isIn(['verified', 'unverified', 'no-email']),
  query('phoneStatus').optional().isIn(['verified', 'unverified', 'no-phone'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Suppliers validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Invalid request. Please check your input.',
        errors: errors.array() 
      });
    }

    // Call service to get suppliers
    const result = await supplierService.getSuppliers(req.query);
    
    res.json({
      suppliers: result.suppliers,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/:id
// @desc    Get single supplier
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const supplier = await supplierService.getSupplierById(req.params.id);
    res.json({ supplier });
  } catch (error) {
    if (error.message === 'Supplier not found') {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    console.error('Get supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/suppliers
// @desc    Create new supplier
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_suppliers'),
  body('companyName').trim().isLength({ min: 1 }).withMessage('Company name is required'),
  body('contactPerson.name').trim().isLength({ min: 1 }).withMessage('Contact name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional({ checkFalsy: true }).trim(),
  body('businessType').optional().isIn(['manufacturer', 'distributor', 'wholesaler', 'dropshipper', 'other']),
  body('paymentTerms').optional().isIn(['cash', 'net15', 'net30', 'net45', 'net60', 'net90']),
  body('openingBalance').optional().isFloat().withMessage('Opening balance must be a valid number'),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'blacklisted'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    
    // Clean up empty strings
    const cleanData = { ...req.body };
    if (cleanData.email === '') cleanData.email = undefined;
    if (cleanData.phone === '') cleanData.phone = undefined;
    if (cleanData.website === '') cleanData.website = undefined;
    if (cleanData.notes === '') cleanData.notes = undefined;
    if (cleanData.taxId === '') cleanData.taxId = undefined;
    if (cleanData.openingBalance === '') cleanData.openingBalance = undefined;
    
    const supplierData = {
      ...cleanData,
      createdBy: req.user._id
    };
    
    const supplier = await saveSupplierWithLedger(supplierData, req.user._id);
    
    res.status(201).json({
      message: 'Supplier created successfully',
      supplier
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Supplier with this email already exists' });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation failed', errors });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/suppliers/:id
// @desc    Update supplier
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('edit_suppliers'),
  body('companyName').optional().trim().isLength({ min: 1 }),
  body('contactPerson.name').optional().trim().isLength({ min: 1 }),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).trim(),
  body('businessType').optional().isIn(['manufacturer', 'distributor', 'wholesaler', 'dropshipper', 'other']),
  body('paymentTerms').optional().isIn(['cash', 'net15', 'net30', 'net45', 'net60', 'net90']),
  body('openingBalance').optional().isFloat().withMessage('Opening balance must be a valid number'),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'blacklisted'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    if (req.body.openingBalance === '') {
      req.body.openingBalance = undefined;
    }

    const supplier = await updateSupplierWithLedger(
      req.params.id,
      req.body,
      req.user._id
    );

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    res.json({
      message: 'Supplier updated successfully',
      supplier
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Supplier with this email already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/suppliers/:id
// @desc    Delete supplier (soft delete)
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_suppliers')
], async (req, res) => {
  try {
    const supplier = await deleteSupplierWithLedger(req.params.id, req.user?._id);
    
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/suppliers/:id/restore
// @desc    Restore soft-deleted supplier
// @access  Private
router.post('/:id/restore', [
  auth,
  requirePermission('delete_suppliers')
], async (req, res) => {
  try {
    const supplierRepository = require('../repositories/SupplierRepository');
    const supplier = await supplierRepository.findDeletedById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Deleted supplier not found' });
    }
    
    await supplierRepository.restore(req.params.id);
    res.json({ message: 'Supplier restored successfully' });
  } catch (error) {
    console.error('Restore supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/deleted
// @desc    Get all deleted suppliers
// @access  Private
router.get('/deleted', [
  auth,
  requirePermission('view_suppliers')
], async (req, res) => {
  try {
    const supplierRepository = require('../repositories/SupplierRepository');
    const deletedSuppliers = await supplierRepository.findDeleted({}, {
      sort: { deletedAt: -1 }
    });
    res.json(deletedSuppliers);
  } catch (error) {
    console.error('Get deleted suppliers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/search/:query
// @desc    Search suppliers by company name, contact person, or email
// @access  Private
router.get('/search/:query', auth, async (req, res) => {
  try {
    const query = req.params.query;
    const suppliers = await supplierService.searchSuppliers(query, 10);
    res.json({ suppliers });
  } catch (error) {
    console.error('Search suppliers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/check-email/:email
// @desc    Check if email already exists
// @access  Private
router.get('/check-email/:email', auth, async (req, res) => {
  try {
    const email = req.params.email;
    const excludeId = req.query.excludeId; // Optional: exclude current supplier when editing
    
    if (!email || email.trim() === '') {
      return res.json({ exists: false });
    }
    
    // Use case-insensitive search to match how emails are stored (lowercase)
    const emailLower = email.trim().toLowerCase();
    const query = { email: emailLower };
    if (excludeId && isValidObjectId(excludeId)) {
      query._id = { $ne: excludeId };
    }
    
    const exists = await supplierService.supplierExists(query);
    
    res.json({ 
      exists,
      email: emailLower
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/check-company-name/:companyName
// @desc    Check if company name already exists
// @access  Private
router.get('/check-company-name/:companyName', auth, async (req, res) => {
  try {
    const companyName = req.params.companyName;
    const excludeId = req.query.excludeId; // Optional: exclude current supplier when editing
    
    if (!companyName || companyName.trim() === '') {
      return res.json({ exists: false });
    }
    
    const exists = await supplierService.checkCompanyNameExists(companyName, excludeId);
    
    res.json({ 
      exists,
      companyName: companyName.trim()
    });
  } catch (error) {
    console.error('Check company name error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/check-contact-name/:contactName
// @desc    Check if contact person name already exists
// @access  Private
router.get('/check-contact-name/:contactName', auth, async (req, res) => {
  try {
    const contactName = req.params.contactName;
    const excludeId = req.query.excludeId; // Optional: exclude current supplier when editing
    
    if (!contactName || contactName.trim() === '') {
      return res.json({ exists: false });
    }
    
    // Use case-insensitive search (contact names are stored in uppercase via transform)
    const contactNameTrimmed = contactName.trim();
    const query = { 'contactPerson.name': { $regex: new RegExp(`^${contactNameTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };
    if (excludeId && isValidObjectId(excludeId)) {
      query._id = { $ne: excludeId };
    }
    
    const exists = await supplierService.supplierExists(query);
    
    res.json({ 
      exists,
      contactName: contactNameTrimmed
    });
  } catch (error) {
    console.error('Check contact name error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/suppliers
// @desc    Create a new supplier
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_suppliers'),
  body('companyName').trim().isLength({ min: 1, max: 200 }).withMessage('Company name is required and must be less than 200 characters'),
  body('contactPerson.name').trim().isLength({ min: 1, max: 100 }).withMessage('Contact person name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional({ checkFalsy: true }).trim(),
  body('website').optional({ checkFalsy: true }).isURL().withMessage('Website must be a valid URL'),
  body('taxId').optional().trim(),
  body('businessType').isIn(['manufacturer', 'distributor', 'wholesaler', 'dropshipper', 'other']).withMessage('Valid business type is required'),
  body('paymentTerms').optional().trim(),
  body('address.street').optional().trim(),
  body('address.city').optional().trim(),
  body('address.state').optional().trim(),
  body('address.zipCode').optional().trim(),
  body('address.country').optional().trim(),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'blacklisted']),
  body('reliability').optional().isIn(['excellent', 'good', 'average', 'poor']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    // Clean up empty strings
    const cleanData = { ...req.body };
    if (cleanData.email === '') cleanData.email = undefined;
    if (cleanData.phone === '') cleanData.phone = undefined;
    if (cleanData.website === '') cleanData.website = undefined;
    if (cleanData.notes === '') cleanData.notes = undefined;
    if (cleanData.taxId === '') cleanData.taxId = undefined;
    
    const supplierData = cleanData;
    
    // Check if supplier with same email already exists (only if email is provided)
    if (supplierData.email) {
      const emailExists = await supplierService.supplierExists({ email: supplierData.email });
      if (emailExists) {
        return res.status(400).json({ 
          message: 'Supplier with this email already exists' 
        });
      }
    }

    const supplier = await saveSupplierWithLedger({
      ...supplierData,
      createdBy: req.user._id
    }, req.user._id);


    res.status(201).json({
      message: 'Supplier created successfully',
      supplier
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/active/list
// @desc    Get list of active suppliers for dropdowns
// @access  Private
router.get('/active/list', auth, async (req, res) => {
  try {
    const suppliers = await supplierService.getAllSuppliers({ status: 'active' });
    
    // Transform supplier names to uppercase
    const transformedSuppliers = suppliers.map(transformSupplierToUppercase);
    res.json({ suppliers: transformedSuppliers });
  } catch (error) {
    console.error('Get active suppliers list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/suppliers/import/excel
// @desc    Import suppliers from Excel
// @access  Private
router.post('/import/excel', [
  auth,
  requirePermission('create_suppliers'),
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
    const suppliers = XLSX.utils.sheet_to_json(worksheet);
    
    results.total = suppliers.length;
    
    for (let i = 0; i < suppliers.length; i++) {
      try {
        const row = suppliers[i];
        
        // Map Excel columns to our format
        const supplierData = {
          companyName: row['Company Name'] || row['companyName'] || row.companyName,
          contactPersonName: row['Contact Person'] || row['contactPerson'] || row.contactPersonName,
          contactPersonTitle: row['Contact Title'] || row['contactTitle'] || row.contactPersonTitle || '',
          email: row['Email'] || row['email'] || row.email || undefined,
          phone: row['Phone'] || row['phone'] || row.phone || '',
          website: row['Website'] || row['website'] || row.website || '',
          taxId: row['Tax ID'] || row['taxId'] || row.taxId || '',
          businessType: row['Business Type'] || row['businessType'] || row.businessType || 'wholesaler',
          paymentTerms: row['Payment Terms'] || row['paymentTerms'] || row.paymentTerms || 'net30',
          reliability: row['Reliability'] || row['reliability'] || row.reliability || 'average',
          rating: row['Rating'] || row['rating'] || row.rating || 3,
          status: row['Status'] || row['status'] || row.status || 'active',
          notes: row['Notes'] || row['notes'] || row.notes || ''
        };
        
        // Validate required fields
        if (!supplierData.companyName) {
          results.errors.push({
            row: i + 2,
            error: 'Missing required field: Company Name is required'
          });
          continue;
        }
        
        if (!supplierData.contactPersonName) {
          results.errors.push({
            row: i + 2,
            error: 'Missing required field: Contact Person is required'
          });
          continue;
        }
        
        // Check if supplier already exists
        const supplierExists = await supplierService.supplierExists({ 
          companyName: supplierData.companyName.toString().trim()
        });
        
        if (supplierExists) {
          results.errors.push({
            row: i + 2,
            error: `Supplier already exists with company name: ${supplierData.companyName}`
          });
          continue;
        }
        
        // Create supplier
        const supplier = new Supplier({
          companyName: supplierData.companyName.toString().trim(),
          contactPerson: {
            name: supplierData.contactPersonName.toString().trim(),
            title: supplierData.contactPersonTitle.toString().trim() || ''
          },
          email: supplierData.email ? supplierData.email.toString().trim() : undefined,
          phone: supplierData.phone.toString().trim() || '',
          website: supplierData.website.toString().trim() || '',
          taxId: supplierData.taxId.toString().trim() || '',
          businessType: supplierData.businessType.toString().toLowerCase(),
          paymentTerms: supplierData.paymentTerms.toString().toLowerCase(),
          reliability: supplierData.reliability.toString().toLowerCase(),
          rating: parseFloat(supplierData.rating) || 3,
          status: supplierData.status.toString().toLowerCase(),
          notes: supplierData.notes.toString().trim() || '',
          createdBy: req.user._id
        });
        
        await supplier.save();
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

// @route   POST /api/suppliers/export/excel
// @desc    Export suppliers to Excel
// @access  Private
router.post('/export/excel', [auth, requirePermission('view_suppliers')], async (req, res) => {
  try {
    const { filters = {} } = req.body;
    
    // Build query based on filters
    const query = {};
    if (filters.businessType) query.businessType = filters.businessType;
    if (filters.status) query.status = filters.status;
    if (filters.reliability) query.reliability = filters.reliability;
    
    const suppliers = await supplierService.getSuppliersForExport(query);
    
    // Prepare Excel data
    const excelData = suppliers.map(supplier => ({
      'Company Name': supplier.companyName,
      'Contact Person': supplier.contactPerson?.name || '',
      'Contact Title': supplier.contactPerson?.title || '',
      'Email': supplier.email || '',
      'Phone': supplier.phone || '',
      'Website': supplier.website || '',
      'Tax ID': supplier.taxId || '',
      'Business Type': supplier.businessType || '',
      'Payment Terms': supplier.paymentTerms || '',
      'Reliability': supplier.reliability || '',
      'Rating': supplier.rating || 3,
      'Current Balance': supplier.currentBalance || 0,
      'Status': supplier.status || 'active',
      'Notes': supplier.notes || '',
      'Created Date': supplier.createdAt?.toISOString().split('T')[0] || ''
    }));
    
    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const columnWidths = [
      { wch: 25 }, // Company Name
      { wch: 20 }, // Contact Person
      { wch: 20 }, // Contact Title
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 25 }, // Website
      { wch: 15 }, // Tax ID
      { wch: 15 }, // Business Type
      { wch: 15 }, // Payment Terms
      { wch: 12 }, // Reliability
      { wch: 8 },  // Rating
      { wch: 15 }, // Current Balance
      { wch: 10 }, // Status
      { wch: 30 }, // Notes
      { wch: 12 }  // Created Date
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
    
    // Ensure exports directory exists
    if (!fs.existsSync('exports')) {
      fs.mkdirSync('exports');
    }
    
    const filename = 'suppliers.xlsx';
    const filepath = path.join('exports', filename);
    XLSX.writeFile(workbook, filepath);
    
    res.json({
      message: 'Suppliers exported successfully',
      filename: filename,
      recordCount: excelData.length,
      downloadUrl: `/api/suppliers/download/${filename}`
    });
    
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

// @route   GET /api/suppliers/download/:filename
// @desc    Download exported file
// @access  Private
router.get('/download/:filename', [auth, requirePermission('view_suppliers')], (req, res) => {
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

// @route   GET /api/suppliers/template/excel
// @desc    Download Excel template
// @access  Private
router.get('/template/excel', [auth, requirePermission('create_suppliers')], (req, res) => {
  try {
    const templateData = [
      {
        'Company Name': 'ABC Suppliers Inc',
        'Contact Person': 'Jane Smith',
        'Contact Title': 'Sales Manager',
        'Email': 'jane@abcsuppliers.com',
        'Phone': '555-0456',
        'Website': 'www.abcsuppliers.com',
        'Tax ID': '98-7654321',
        'Business Type': 'wholesaler',
        'Payment Terms': 'net30',
        'Reliability': 'good',
        'Rating': '4',
        'Status': 'active',
        'Notes': 'Sample supplier for template'
      }
    ];
    
    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    const columnWidths = [
      { wch: 25 }, // Company Name
      { wch: 20 }, // Contact Person
      { wch: 20 }, // Contact Title
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 25 }, // Website
      { wch: 15 }, // Tax ID
      { wch: 15 }, // Business Type
      { wch: 15 }, // Payment Terms
      { wch: 12 }, // Reliability
      { wch: 8 },  // Rating
      { wch: 10 }, // Status
      { wch: 30 }  // Notes
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
    
    // Ensure exports directory exists
    if (!fs.existsSync('exports')) {
      fs.mkdirSync('exports');
    }
    
    const filename = 'supplier_template.xlsx';
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

module.exports = router;
