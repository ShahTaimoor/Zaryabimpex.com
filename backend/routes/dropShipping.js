const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const dropShippingRepository = require('../repositories/postgres/DropShippingRepository');
const supplierRepository = require('../repositories/postgres/SupplierRepository');
const customerRepository = require('../repositories/postgres/CustomerRepository');
const productRepository = require('../repositories/postgres/ProductRepository');

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Helper functions to transform names to uppercase
const transformCustomerToUppercase = (customer) => {
  if (!customer) return customer;
  if (customer.toObject) customer = customer.toObject();
  if (customer.name) customer.name = customer.name.toUpperCase();
  if (customer.businessName) customer.businessName = customer.businessName.toUpperCase();
  if (customer.firstName) customer.firstName = customer.firstName.toUpperCase();
  if (customer.lastName) customer.lastName = customer.lastName.toUpperCase();
  return customer;
};

const transformSupplierToUppercase = (supplier) => {
  if (!supplier) return supplier;
  if (supplier.toObject) supplier = supplier.toObject();
  if (supplier.companyName) supplier.companyName = supplier.companyName.toUpperCase();
  if (supplier.contactPerson && supplier.contactPerson.name) {
    supplier.contactPerson.name = supplier.contactPerson.name.toUpperCase();
  }
  return supplier;
};

const transformProductToUppercase = (product) => {
  if (!product) return product;
  if (product.toObject) product = product.toObject();
  if (product.name) product.name = product.name.toUpperCase();
  if (product.description) product.description = product.description.toUpperCase();
  return product;
};

// @route   GET /api/drop-shipping
// @desc    Get all drop shipping transactions with filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      supplier,
      customer,
      startDate,
      endDate,
      search
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (supplier) filter.supplierId = supplier;
    if (customer) filter.customerId = customer;
    if (startDate) filter.transactionDateFrom = new Date(startDate);
    if (endDate) filter.transactionDateTo = new Date(endDate);
    if (search) filter.searchIlike = search;

    const result = await dropShippingRepository.findWithPagination(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50
    });

    const { transactions, total, pagination } = result;

    res.json({
      transactions,
      pagination
    });
  } catch (error) {
    console.error('Get drop shipping transactions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/drop-shipping/stats
// @desc    Get drop shipping statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate) filter.transactionDateFrom = new Date(startDate);
    if (endDate) filter.transactionDateTo = new Date(endDate);

    const [overall] = await dropShippingRepository.getStats(filter);
    const statusBreakdown = await dropShippingRepository.getStatusBreakdown(filter);

    res.json({
      overall: overall || {
        totalTransactions: 0,
        totalSupplierAmount: 0,
        totalCustomerAmount: 0,
        totalProfit: 0,
        avgMargin: 0
      },
      statusBreakdown: statusBreakdown.map(r => ({ _id: r.status, count: r.count }))
    });
  } catch (error) {
    console.error('Get drop shipping stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/drop-shipping/:id
// @desc    Get single drop shipping transaction
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const transaction = await dropShippingRepository.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Drop shipping transaction not found' });
    }

    res.json({ transaction });
  } catch (error) {
    console.error('Get drop shipping transaction error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/drop-shipping
// @desc    Create new drop shipping transaction
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_drop_shipping'),
  body('supplier').isUUID(4).withMessage('Valid supplier is required'),
  body('customer').isUUID(4).withMessage('Valid customer is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isUUID(4).withMessage('Valid product is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.supplierRate').isFloat({ min: 0 }).withMessage('Supplier rate must be positive'),
  body('items.*.customerRate').isFloat({ min: 0 }).withMessage('Customer rate must be positive'),
  handleValidationErrors
], async (req, res) => {
  try {
    // Verify supplier and customer exist
    const supplier = await supplierRepository.findById(req.body.supplier);
    if (!supplier) {
      return res.status(400).json({ message: 'Supplier not found' });
    }

    const customer = await customerRepository.findById(req.body.customer);
    if (!customer) {
      return res.status(400).json({ message: 'Customer not found' });
    }

    // Verify all products exist
    const productIds = req.body.items.map(item => item.product);
    const products = await productRepository.findAll({ _id: { $in: productIds } });
    
    if (products.length !== productIds.length) {
      return res.status(400).json({ message: 'One or more products not found' });
    }

    // Build transaction data
    const transactionData = {
      ...req.body,
      supplierInfo: {
        companyName: supplier.companyName,
        contactPerson: supplier.contactPerson?.name || '',
        email: supplier.email || '',
        phone: supplier.phone || ''
      },
      customerInfo: {
        displayName: customer.displayName || customer.name,
        businessName: customer.businessName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        businessType: customer.businessType || ''
      },
      createdBy: req.user.id || req.user._id,
      lastModifiedBy: req.user.id || req.user._id
    };

    const transaction = await dropShippingRepository.create({
      ...transactionData,
      supplier: supplier.id || supplier._id,
      customer: customer.id || customer._id,
      supplierTotal: transactionData.supplierTotal ?? transactionData.subtotal,
      total: transactionData.total ?? transactionData.subtotal,
      orderDate: transactionData.orderDate || new Date()
    });

    const supplierId = supplier.id || supplier._id;
    const supplierTotal = transaction.supplier_total ?? transaction.supplierTotal ?? transactionData.supplierTotal ?? 0;
    const sup = await supplierRepository.findById(supplierId);
    if (sup) {
      const currentPending = parseFloat(sup.pending_balance ?? sup.pendingBalance ?? 0) || 0;
      await supplierRepository.update(supplierId, { pendingBalance: currentPending + supplierTotal });
    }

    const customerPaymentMethod = transactionData.customerPayment?.method;
    if (customerPaymentMethod === 'account') {
      const customerId = customer.id || customer._id;
      const customerTotal = transaction.total ?? transactionData.total ?? 0;
      const cust = await customerRepository.findById(customerId);
      if (cust) {
        const currentPending = parseFloat(cust.pending_balance ?? cust.pendingBalance ?? 0) || 0;
        await customerRepository.update(customerId, { pendingBalance: currentPending + customerTotal });
      }
    }

    const out = { ...transaction };
    if (supplier) out.supplier = transformSupplierToUppercase(supplier);
    if (customer) out.customer = transformCustomerToUppercase(customer);

    res.status(201).json({
      message: 'Drop shipping transaction created successfully',
      transaction: out
    });
  } catch (error) {
    console.error('Create drop shipping transaction error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/drop-shipping/:id
// @desc    Update drop shipping transaction
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('update_drop_shipping'),
  body('supplier').optional().isUUID(4).withMessage('Valid supplier is required'),
  body('customer').optional().isUUID(4).withMessage('Valid customer is required'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const transaction = await dropShippingRepository.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ message: 'Drop shipping transaction not found' });
    }

    const oldSupplierTotal = parseFloat(transaction.supplier_total ?? transaction.supplierTotal ?? 0) || 0;
    const oldCustomerTotal = parseFloat(transaction.total ?? transaction.customerTotal ?? 0) || 0;
    const supplierId = transaction.supplier_id || transaction.supplier;
    const customerId = transaction.customer_id || transaction.customer;

    const updatePayload = { status: req.body.status, notes: req.body.notes, items: req.body.items };
    if (req.body.items) updatePayload.items = req.body.items;
    if (req.body.total !== undefined) updatePayload.total = req.body.total;

    if (req.body.supplier && req.body.supplier !== supplierId) {
      const supplier = await supplierRepository.findById(req.body.supplier);
      if (supplier) {
        updatePayload.supplierInfo = {
          companyName: supplier.company_name || supplier.companyName,
          contactPerson: supplier.contact_person || supplier.contactPerson?.name || '',
          email: supplier.email || '',
          phone: supplier.phone || ''
        };
        updatePayload.supplierId = req.body.supplier;
      }
    }
    if (req.body.customer && req.body.customer !== customerId) {
      const customer = await customerRepository.findById(req.body.customer);
      if (customer) {
        updatePayload.customerInfo = {
          displayName: customer.business_name || customer.name,
          businessName: customer.business_name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          businessType: customer.business_type || ''
        };
        updatePayload.customerId = req.body.customer;
      }
    }

    const updated = await dropShippingRepository.updateById(req.params.id, updatePayload);
    if (!updated) {
      return res.status(500).json({ message: 'Failed to update transaction' });
    }

    const newSupplierTotal = parseFloat(updated.supplier_total ?? updated.supplierTotal ?? 0) || 0;
    const newCustomerTotal = parseFloat(updated.total ?? updated.customerTotal ?? 0) || 0;

    if (newSupplierTotal !== oldSupplierTotal && supplierId) {
      const sup = await supplierRepository.findById(supplierId);
      if (sup) {
        const current = parseFloat(sup.pending_balance ?? sup.pendingBalance ?? 0) || 0;
        await supplierRepository.update(supplierId, { pendingBalance: current - oldSupplierTotal + newSupplierTotal });
      }
    }
    if (newCustomerTotal !== oldCustomerTotal && customerId) {
      const cust = await customerRepository.findById(customerId);
      if (cust) {
        const current = parseFloat(cust.pending_balance ?? cust.pendingBalance ?? 0) || 0;
        await customerRepository.update(customerId, { pendingBalance: current - oldCustomerTotal + newCustomerTotal });
      }
    }

    res.json({
      message: 'Drop shipping transaction updated successfully',
      transaction: updated
    });
  } catch (error) {
    console.error('Update drop shipping transaction error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/drop-shipping/:id
// @desc    Delete drop shipping transaction
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_drop_shipping')
], async (req, res) => {
  try {
    const transaction = await dropShippingRepository.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ message: 'Drop shipping transaction not found' });
    }

    const supplierId = transaction.supplier_id || transaction.supplier;
    const supplierTotal = parseFloat(transaction.supplier_total ?? transaction.supplierTotal ?? 0) || 0;
    if (supplierId && supplierTotal) {
      const sup = await supplierRepository.findById(supplierId);
      if (sup) {
        const current = parseFloat(sup.pending_balance ?? sup.pendingBalance ?? 0) || 0;
        await supplierRepository.update(supplierId, { pendingBalance: Math.max(0, current - supplierTotal) });
      }
    }
    const customerId = transaction.customer_id || transaction.customer;
    const customerTotal = parseFloat(transaction.total ?? transaction.customerTotal ?? 0) || 0;
    if (customerId && customerTotal) {
      const cust = await customerRepository.findById(customerId);
      if (cust) {
        const current = parseFloat(cust.pending_balance ?? cust.pendingBalance ?? 0) || 0;
        await customerRepository.update(customerId, { pendingBalance: Math.max(0, current - customerTotal) });
      }
    }

    await dropShippingRepository.softDelete(transaction.id || transaction._id);

    res.json({ message: 'Drop shipping transaction deleted successfully' });
  } catch (error) {
    console.error('Delete drop shipping transaction error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/drop-shipping/:id/status
// @desc    Update transaction status
// @access  Private
router.put('/:id/status', [
  auth,
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'completed']).withMessage('Valid status is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const transaction = await dropShippingRepository.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ message: 'Drop shipping transaction not found' });
    }

    const updatedTransaction = await dropShippingRepository.updateById(transaction.id || transaction._id, {
      status: req.body.status
    });

    res.json({
      message: 'Transaction status updated successfully',
      transaction: updatedTransaction
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

