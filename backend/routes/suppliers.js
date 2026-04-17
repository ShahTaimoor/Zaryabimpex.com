const express = require('express');
const { body, validationResult, query } = require('express-validator');
const fs = require('fs');
const path = require('path');
const { auth, requirePermission } = require('../middleware/auth');
const { validateUuidParam, handleValidationErrors } = require('../middleware/validation');
const supplierService = require('../services/supplierServicePostgres');
const supplierRepository = require('../repositories/postgres/SupplierRepository');
const AccountingService = require('../services/accountingService');

const router = express.Router();

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



const buildSupplierCreatePayload = (body, userId) => {
  const openingBalance = parseOpeningBalance(body.openingBalance);
  const address = body.address ?? (Array.isArray(body.addresses) && body.addresses.length > 0 ? body.addresses : null);
  const payload = {
    companyName: body.companyName,
    contactPerson: body.contactPerson?.name != null ? { name: body.contactPerson.name } : (body.contactPersonName ? { name: body.contactPersonName } : null),
    email: body.email || null,
    phone: body.phone || null,
    address: address || null,
    paymentTerms: body.paymentTerms || null,
    taxId: body.taxId || null,
    notes: body.notes || null,
    status: body.status || 'active',
    businessType: body.businessType || body.supplierType || 'other',
    rating: body.rating != null ? Math.min(5, Math.max(0, parseInt(body.rating, 10) || 3)) : 3,
    createdBy: userId
  };
  if (openingBalance !== null) payload.openingBalance = openingBalance;
  if (body.creditLimit !== undefined && body.creditLimit !== null) payload.creditLimit = parseFloat(body.creditLimit) || 0;
  return payload;
};

const buildSupplierUpdatePayload = (body, userId) => {
  const payload = { updatedBy: userId };
  if (body.companyName !== undefined) payload.companyName = body.companyName;
  if (body.contactPerson !== undefined) payload.contactPerson = body.contactPerson;
  if (body.email !== undefined) payload.email = body.email;
  if (body.phone !== undefined) payload.phone = body.phone;
  if (body.address !== undefined) payload.address = body.address;
  if (body.addresses !== undefined) payload.address = body.addresses;
  if (body.paymentTerms !== undefined) payload.paymentTerms = body.paymentTerms;
  if (body.taxId !== undefined) payload.taxId = body.taxId;
  if (body.notes !== undefined) payload.notes = body.notes;
  if (body.status !== undefined) payload.status = body.status;
  if (body.businessType !== undefined || body.supplierType !== undefined) payload.businessType = body.businessType || body.supplierType;
  if (body.rating !== undefined) payload.rating = body.rating;
  if (body.creditLimit !== undefined && body.creditLimit !== null) payload.creditLimit = parseFloat(body.creditLimit) || 0;
  const ob = parseOpeningBalance(body.openingBalance);
  if (ob !== null) {
    payload.openingBalance = ob;
    payload.pendingBalance = ob >= 0 ? ob : 0;
    payload.advanceBalance = ob < 0 ? Math.abs(ob) : 0;
  }
  return payload;
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
    // Prevent stale list after import (avoid 304/cached supplier listing)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

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

// Fixed paths must come before /:id so they are not matched as id
// @route   GET /api/suppliers/deleted
router.get('/deleted', [
  auth,
  requirePermission('view_suppliers')
], async (req, res) => {
  try {
    const deletedSuppliers = await supplierRepository.findDeleted({}, { limit: 9999 });
    res.json(deletedSuppliers);
  } catch (error) {
    console.error('Get deleted suppliers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/search/:query
router.get('/search/:query', auth, async (req, res) => {
  try {
    const searchQuery = req.params.query;
    const suppliers = await supplierService.searchSuppliers(searchQuery, 10);
    res.json({ suppliers });
  } catch (error) {
    console.error('Search suppliers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/check-email/:email
router.get('/check-email/:email', auth, async (req, res) => {
  try {
    const email = req.params.email;
    const excludeId = req.query.excludeId;
    if (!email || email.trim() === '') return res.json({ exists: false });
    const emailLower = email.trim().toLowerCase();
    const exists = await supplierService.supplierExists({ email: emailLower, id: excludeId });
    res.json({ exists, email: emailLower });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/check-company-name/:companyName
router.get('/check-company-name/:companyName', auth, async (req, res) => {
  try {
    const companyName = req.params.companyName;
    const excludeId = req.query.excludeId;
    if (!companyName || companyName.trim() === '') return res.json({ exists: false });
    const exists = await supplierService.checkCompanyNameExists(companyName, excludeId);
    res.json({ exists, companyName: companyName.trim() });
  } catch (error) {
    console.error('Check company name error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/check-contact-name/:contactName
router.get('/check-contact-name/:contactName', auth, async (req, res) => {
  try {
    const contactName = req.params.contactName;
    const excludeId = req.query.excludeId;
    if (!contactName || contactName.trim() === '') return res.json({ exists: false });
    const contactNameTrimmed = contactName.trim();
    const exists = await supplierService.supplierExists({ 'contactPerson.name': contactNameTrimmed, id: excludeId });
    res.json({ exists, contactName: contactNameTrimmed });
  } catch (error) {
    console.error('Check contact name error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/active/list
router.get('/active/list', auth, async (req, res) => {
  try {
    const suppliers = await supplierService.getAllSuppliers({ status: 'active' });
    const transformedSuppliers = suppliers.map(transformSupplierToUppercase);
    res.json({ suppliers: transformedSuppliers });
  } catch (error) {
    console.error('Get active suppliers list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/suppliers/:id
// @desc    Get single supplier
// @access  Private
router.get('/:id', [auth, validateUuidParam('id'), handleValidationErrors], async (req, res) => {
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
  body('contactPerson.name').optional().trim(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional({ checkFalsy: true }).trim(),
  body('businessType').optional().isIn(['manufacturer', 'distributor', 'wholesaler', 'dropshipper', 'other']),
  body('paymentTerms').optional().isIn(['cash', 'net15', 'net30', 'net45', 'net60', 'net90']),
  body('openingBalance').optional().isFloat().withMessage('Opening balance must be a valid number'),
  body('creditLimit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be a non-negative number'),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'blacklisted']),
  handleValidationErrors
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const cleanData = { ...req.body };
    if (cleanData.email === '') cleanData.email = undefined;
    if (cleanData.phone === '') cleanData.phone = undefined;
    if (cleanData.website === '') cleanData.website = undefined;
    if (cleanData.notes === '') cleanData.notes = undefined;
    if (cleanData.taxId === '') cleanData.taxId = undefined;
    if (cleanData.openingBalance === '') cleanData.openingBalance = undefined;
    if (cleanData.creditLimit === '') cleanData.creditLimit = undefined;

    const userId = req.user?.id || req.user?._id;
    const supplierData = buildSupplierCreatePayload(cleanData, userId);

    const row = await supplierRepository.create(supplierData);
    // Post opening balance to account ledger if set
    const openingBalance = parseFloat(row.opening_balance ?? 0) || 0;
    if (Math.abs(openingBalance) >= 0.01) {
      try {
        await AccountingService.postSupplierOpeningBalance(row.id, openingBalance, {
          createdBy: userId,
          transactionDate: row.created_at
        });
      } catch (err) {
        console.error('Error posting supplier opening balance to ledger:', err);
        // Don't fail create - balance will be off until corrected
      }
    }
    const supplier = await supplierService.getSupplierByIdWithLedger(row.id);

    res.status(201).json({
      message: 'Supplier created successfully',
      supplier
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Supplier with this email or company already exists' });
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
  body('creditLimit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be a non-negative number'),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'blacklisted'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    if (req.body.openingBalance === '') req.body.openingBalance = undefined;
    if (req.body.creditLimit === '') req.body.creditLimit = undefined;

    const userId = req.user?.id || req.user?._id;
    const supplierData = buildSupplierUpdatePayload(req.body, userId);
    const updatedRow = await supplierService.updateSupplier(req.params.id, supplierData, userId);
    const supplier = updatedRow ? await supplierService.getSupplierById(updatedRow.id) : null;

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
  requirePermission('delete_suppliers'),
  validateUuidParam('id'),
  handleValidationErrors
], async (req, res) => {
  try {
    const supplier = await supplierService.deleteSupplier(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    if (error.message === 'Supplier not found') return res.status(404).json({ message: 'Supplier not found' });
    if (error.message && error.message.includes('outstanding balance')) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Delete supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/suppliers/:id/restore
// @desc    Restore soft-deleted supplier
// @access  Private
router.post('/:id/restore', [
  auth,
  requirePermission('delete_suppliers'),
  validateUuidParam('id'),
  handleValidationErrors
], async (req, res) => {
  try {
    const supplier = await supplierRepository.findDeletedById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Deleted supplier not found' });
    await supplierRepository.restore(req.params.id);
    res.json({ message: 'Supplier restored successfully' });
  } catch (error) {
    console.error('Restore supplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/suppliers/import/excel



// @route   POST /api/suppliers/bulk-create
// @desc    Bulk create suppliers from import
// @access  Private
router.post('/bulk-create', [
  auth,
  requirePermission('create_suppliers')
], async (req, res) => {
  try {
    const suppliersPayload = Array.isArray(req.body)
      ? req.body
      : (req.body?.suppliers || req.body?.data || req.body?.rows);
    if (!Array.isArray(suppliersPayload)) {
      return res.status(400).json({
        message: 'Suppliers array is required',
        expected: 'Send an array body or { suppliers: [...] }',
      });
    }
    const result = await supplierService.bulkCreateSuppliers(
      suppliersPayload,
      req.user?.id || req.user?._id,
      { autoCreateCities: req.body?.autoCreateCities !== false }
    );
    res.status(201).json(result);
  } catch (error) {
    console.error('Bulk create suppliers error:', error);
    res.status(500).json({ message: 'Server error bulk creating suppliers', error: error.message });
  }
});

module.exports = router;
