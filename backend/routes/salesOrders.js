const express = require('express');
const { body, validationResult, query } = require('express-validator');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const SalesOrder = require('../models/SalesOrder'); // Still needed for new SalesOrder() and static methods
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const inventoryService = require('../services/inventoryService');
const salesService = require('../services/salesService');
const salesOrderRepository = require('../repositories/SalesOrderRepository');
const customerRepository = require('../repositories/CustomerRepository');

const router = express.Router();

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

const transformProductToUppercase = (product) => {
  if (!product) return product;
  if (product.toObject) product = product.toObject();
  // Handle both products and variants
  if (product.displayName) {
    product.displayName = product.displayName.toUpperCase();
  }
  if (product.variantName) {
    product.variantName = product.variantName.toUpperCase();
  }
  if (product.name) product.name = product.name.toUpperCase();
  if (product.description) product.description = product.description.toUpperCase();
  return product;
};

// @route   GET /api/sales-orders
// @desc    Get all sales orders with filtering and pagination
// @access  Private
router.get('/', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 999999 }),
  query('all').optional({ checkFalsy: true }).isBoolean(),
  query('search').optional().trim(),
  query('status').optional({ checkFalsy: true }).isIn(['draft', 'confirmed', 'partially_invoiced', 'fully_invoiced', 'cancelled', 'closed']),
  query('customer').optional({ checkFalsy: true }).isMongoId(),
  ...validateDateParams,
  query('orderNumber').optional().trim(),
  handleValidationErrors,
  processDateFilter('createdAt'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if all sales orders are requested (no pagination)
    const getAllSalesOrders = req.query.all === 'true' || req.query.all === true ||
      (req.query.limit && parseInt(req.query.limit) >= 999999);

    const page = getAllSalesOrders ? 1 : (parseInt(req.query.page) || 1);
    const limit = getAllSalesOrders ? 999999 : (parseInt(req.query.limit) || 20);
    const skip = getAllSalesOrders ? 0 : ((page - 1) * limit);

    // Build filter
    const filter = {};

    if (req.query.search) {
      const searchTerm = req.query.search.trim();
      const searchConditions = [
        { soNumber: { $regex: searchTerm, $options: 'i' } },
        { notes: { $regex: searchTerm, $options: 'i' } }
      ];

      // Search in Customer collection and match by customer ID
      const customerMatches = await customerRepository.search(searchTerm, {
        limit: 1000,
        select: '_id',
        lean: true
      });

      if (customerMatches.length > 0) {
        const customerIds = customerMatches.map(c => c._id);
        searchConditions.push({ customer: { $in: customerIds } });
      }

      filter.$or = searchConditions;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.customer) {
      filter.customer = req.query.customer;
    }

    if (req.query.orderNumber) {
      filter.soNumber = { $regex: req.query.orderNumber, $options: 'i' };
    }

    // Date filtering - use dateFilter from middleware (Pakistan timezone)
    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      Object.assign(filter, req.dateFilter);
    }


    const result = await salesOrderRepository.findWithPagination(filter, {
      page,
      limit,
      getAll: getAllSalesOrders,
      sort: { createdAt: -1 },
      populate: [
        { path: 'customer', select: 'businessName name firstName lastName email phone businessType customerTier paymentTerms currentBalance pendingBalance' },
        { path: 'items.product', select: 'name description pricing inventory' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'lastModifiedBy', select: 'firstName lastName email' }
      ]
    });

    const salesOrders = result.salesOrders;

    // Transform names to uppercase and add displayName to each customer
    salesOrders.forEach(so => {
      if (so.customer) {
        so.customer = transformCustomerToUppercase(so.customer);
        so.customer.displayName = (so.customer.businessName || so.customer.name || `${so.customer.firstName || ''} ${so.customer.lastName || ''}`.trim() || so.customer.email || 'Unknown Customer').toUpperCase();
      }
      if (so.items && Array.isArray(so.items)) {
        so.items.forEach(item => {
          if (item.product) {
            item.product = transformProductToUppercase(item.product);
          }
        });
      }
    });

    res.json({
      salesOrders,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get sales orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/sales-orders/:id
// @desc    Get single sales order
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const salesOrder = await salesOrderRepository.findById(req.params.id, {
      populate: [
        { path: 'customer', select: 'businessName name firstName lastName email phone businessType customerTier paymentTerms currentBalance pendingBalance' },
        { path: 'items.product', select: 'name description pricing inventory' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'lastModifiedBy', select: 'firstName lastName email' },
        { path: 'conversions.convertedBy', select: 'firstName lastName email' }
      ]
    });

    if (!salesOrder) {
      return res.status(404).json({ message: 'Sales order not found' });
    }

    // Transform names to uppercase and add displayName to customer
    if (salesOrder.customer) {
      salesOrder.customer = transformCustomerToUppercase(salesOrder.customer);
      salesOrder.customer.displayName = (salesOrder.customer.businessName || salesOrder.customer.name || `${salesOrder.customer.firstName || ''} ${salesOrder.customer.lastName || ''}`.trim() || salesOrder.customer.email || 'Unknown Customer').toUpperCase();
    }
    if (salesOrder.items && Array.isArray(salesOrder.items)) {
      salesOrder.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }

    res.json({ salesOrder });
  } catch (error) {
    console.error('Get sales order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/sales-orders
// @desc    Create new sales order
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_sales_orders'),
  body('customer').isMongoId().withMessage('Valid customer is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be positive'),
  body('items.*.totalPrice').isFloat({ min: 0 }).withMessage('Total price must be positive'),
  body('items.*.invoicedQuantity').optional().isInt({ min: 0 }).withMessage('Invoiced quantity must be non-negative'),
  body('items.*.remainingQuantity').isInt({ min: 0 }).withMessage('Remaining quantity must be non-negative'),
  body('expectedDelivery').optional().isISO8601().withMessage('Valid delivery date required'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes too long'),
  body('terms').optional().trim().isLength({ max: 500 }).withMessage('Terms too long'),
  body('isTaxExempt').optional().isBoolean().withMessage('Tax exempt must be a boolean')
], async (req, res) => {
  try {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const soData = {
      ...req.body,
      soNumber: SalesOrder.generateSONumber(),
      createdBy: req.user._id
    };

    const salesOrder = new SalesOrder(soData);
    await salesOrder.save();

    await salesOrder.populate([
      { path: 'customer', select: 'displayName firstName lastName email phone businessType customerTier' },
      { path: 'items.product', select: 'name description pricing inventory' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    // Transform names to uppercase
    if (salesOrder.customer) {
      salesOrder.customer = transformCustomerToUppercase(salesOrder.customer);
    }
    if (salesOrder.items && Array.isArray(salesOrder.items)) {
      salesOrder.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }

    res.status(201).json({
      message: 'Sales order created successfully',
      salesOrder
    });
  } catch (error) {
    console.error('Create sales order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/sales-orders/:id
// @desc    Update sales order
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('edit_sales_orders'),
  body('customer').optional().isMongoId().withMessage('Valid customer is required'),
  body('orderType').optional().isIn(['retail', 'wholesale', 'return', 'exchange']).withMessage('Invalid order type'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').optional().isMongoId().withMessage('Valid product is required'),
  body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').optional().isFloat({ min: 0 }).withMessage('Unit price must be positive'),
  body('expectedDelivery').optional().isISO8601().withMessage('Valid delivery date required'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes too long'),
  body('terms').optional().trim().isLength({ max: 1000 }).withMessage('Terms too long'),
  body('isTaxExempt').optional().isBoolean().withMessage('Tax exempt must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const salesOrder = await salesOrderRepository.findById(req.params.id);
    if (!salesOrder) {
      return res.status(404).json({ message: 'Sales order not found' });
    }

    // Don't allow editing if already confirmed or invoiced
    if (['confirmed', 'partially_invoiced', 'fully_invoiced'].includes(salesOrder.status)) {
      return res.status(400).json({
        message: 'Cannot edit sales order that has been confirmed or invoiced'
      });
    }

    const updateData = {
      ...req.body,
      lastModifiedBy: req.user._id
    };

    const updatedSO = await salesOrderRepository.update(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    await updatedSO.populate([
      { path: 'customer', select: 'displayName firstName lastName email phone businessType customerTier' },
      { path: 'items.product', select: 'name description pricing inventory' },
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'lastModifiedBy', select: 'firstName lastName email' }
    ]);

    // Transform names to uppercase
    if (updatedSO.customer) {
      updatedSO.customer = transformCustomerToUppercase(updatedSO.customer);
    }
    if (updatedSO.items && Array.isArray(updatedSO.items)) {
      updatedSO.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }

    res.json({
      message: 'Sales order updated successfully',
      salesOrder: updatedSO
    });
  } catch (error) {
    console.error('Update sales order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/sales-orders/:id/confirm
// @desc    Confirm sales order and update inventory
// @access  Private
router.put('/:id/confirm', [
  auth,
  requirePermission('confirm_sales_orders')
], async (req, res) => {
  try {
    const salesOrder = await salesOrderRepository.findById(req.params.id);
    if (!salesOrder) {
      return res.status(404).json({ message: 'Sales order not found' });
    }

    if (salesOrder.status !== 'draft') {
      return res.status(400).json({
        message: 'Only draft sales orders can be confirmed'
      });
    }

    // Update inventory for each item in the sales order
    const inventoryUpdates = [];
    for (const item of salesOrder.items) {
      try {
        const inventoryUpdate = await inventoryService.updateStock({
          productId: item.product,
          type: 'out',
          quantity: item.quantity,
          reason: 'Sales Order Confirmation',
          reference: 'Sales Order',
          referenceId: salesOrder._id,
          referenceModel: 'SalesOrder',
          performedBy: req.user._id,
          notes: `Stock reduced due to sales order confirmation - SO: ${salesOrder.soNumber}`
        });

        inventoryUpdates.push({
          productId: item.product,
          quantity: item.quantity,
          newStock: inventoryUpdate.currentStock,
          success: true
        });

      } catch (inventoryError) {
        console.error(`Failed to update inventory for product ${item.product}:`, inventoryError.message);
        inventoryUpdates.push({
          productId: item.product,
          quantity: item.quantity,
          success: false,
          error: inventoryError.message
        });

        // If inventory update fails, rollback any successful updates and return error
        return res.status(400).json({
          message: `Insufficient stock for product ${item.product}. Cannot confirm sales order.`,
          details: inventoryError.message,
          inventoryUpdates: inventoryUpdates
        });
      }
    }

    // Update sales order status only after successful inventory updates
    salesOrder.status = 'confirmed';
    salesOrder.confirmedDate = new Date();
    salesOrder.lastModifiedBy = req.user._id;

    await salesOrder.save();

    // Automatically create a Sales Invoice (Sale) from this confirmed order
    let automaticSale = null;
    let saleError = null;
    try {
      automaticSale = await salesService.createSaleFromSalesOrder(salesOrder, req.user);

      // If invoice is successfully created, mark order as fully invoiced
      salesOrder.status = 'fully_invoiced';

      // Update items' invoiced and remaining quantities
      salesOrder.items = salesOrder.items.map(item => ({
        ...item.toObject(),
        invoicedQuantity: item.quantity,
        remainingQuantity: 0
      }));

      await salesOrder.save();
    } catch (createSaleError) {
      console.error('Failed to automatically create sales invoice during SO confirmation:', createSaleError);
      saleError = createSaleError.message;
    }

    await salesOrder.populate([
      { path: 'customer', select: 'displayName firstName lastName email phone businessType customerTier' },
      { path: 'items.product', select: 'name description pricing inventory' },
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'lastModifiedBy', select: 'firstName lastName email' }
    ]);

    // Transform names to uppercase
    if (salesOrder.customer) {
      salesOrder.customer = transformCustomerToUppercase(salesOrder.customer);
    }
    if (salesOrder.items && Array.isArray(salesOrder.items)) {
      salesOrder.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }

    res.json({
      message: automaticSale
        ? 'Sales order confirmed and invoice generated successfully'
        : `Sales order confirmed but failed to generate invoice: ${saleError}`,
      salesOrder,
      sale: automaticSale,
      inventoryUpdates: inventoryUpdates,
      invoiceError: saleError
    });
  } catch (error) {
    console.error('Confirm sales order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/sales-orders/:id/cancel
// @desc    Cancel sales order and restore inventory if previously confirmed
// @access  Private
router.put('/:id/cancel', [
  auth,
  requirePermission('cancel_sales_orders')
], async (req, res) => {
  try {
    const salesOrder = await salesOrderRepository.findById(req.params.id);
    if (!salesOrder) {
      return res.status(404).json({ message: 'Sales order not found' });
    }

    if (['fully_invoiced', 'cancelled', 'closed'].includes(salesOrder.status)) {
      return res.status(400).json({
        message: 'Cannot cancel sales order in current status'
      });
    }

    // If the sales order was confirmed, restore inventory
    const inventoryUpdates = [];
    if (salesOrder.status === 'confirmed') {
      for (const item of salesOrder.items) {
        try {
          const inventoryUpdate = await inventoryService.updateStock({
            productId: item.product,
            type: 'return',
            quantity: item.quantity,
            reason: 'Sales Order Cancellation',
            reference: 'Sales Order',
            referenceId: salesOrder._id,
            referenceModel: 'SalesOrder',
            performedBy: req.user._id,
            notes: `Stock restored due to sales order cancellation - SO: ${salesOrder.soNumber}`
          });

          inventoryUpdates.push({
            productId: item.product,
            quantity: item.quantity,
            newStock: inventoryUpdate.currentStock,
            success: true
          });

        } catch (inventoryError) {
          console.error(`Failed to restore inventory for product ${item.product}:`, inventoryError.message);
          inventoryUpdates.push({
            productId: item.product,
            quantity: item.quantity,
            success: false,
            error: inventoryError.message
          });

          // Continue with cancellation even if inventory restoration fails
          console.warn(`Continuing with sales order cancellation despite inventory restoration failure for product ${item.product}`);
        }
      }
    }

    salesOrder.status = 'cancelled';
    salesOrder.lastModifiedBy = req.user._id;

    await salesOrder.save();

    res.json({
      message: salesOrder.status === 'confirmed'
        ? 'Sales order cancelled successfully and inventory restored'
        : 'Sales order cancelled successfully',
      salesOrder,
      inventoryUpdates: inventoryUpdates.length > 0 ? inventoryUpdates : undefined
    });
  } catch (error) {
    console.error('Cancel sales order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/sales-orders/:id/close
// @desc    Close sales order
// @access  Private
router.put('/:id/close', [
  auth,
  requirePermission('close_sales_orders')
], async (req, res) => {
  try {
    const salesOrder = await salesOrderRepository.findById(req.params.id);
    if (!salesOrder) {
      return res.status(404).json({ message: 'Sales order not found' });
    }

    if (salesOrder.status === 'fully_invoiced') {
      salesOrder.status = 'closed';
      salesOrder.lastModifiedBy = req.user._id;

      await salesOrder.save();

      res.json({
        message: 'Sales order closed successfully',
        salesOrder
      });
    } else {
      return res.status(400).json({
        message: 'Only fully invoiced sales orders can be closed'
      });
    }
  } catch (error) {
    console.error('Close sales order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/sales-orders/:id
// @desc    Delete sales order
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_sales_orders')
], async (req, res) => {
  try {
    const salesOrder = await salesOrderRepository.findById(req.params.id);
    if (!salesOrder) {
      return res.status(404).json({ message: 'Sales order not found' });
    }

    // Only allow deletion of draft orders
    if (salesOrder.status !== 'draft') {
      return res.status(400).json({
        message: 'Only draft sales orders can be deleted'
      });
    }

    await salesOrderRepository.delete(req.params.id);

    res.json({ message: 'Sales order deleted successfully' });
  } catch (error) {
    console.error('Delete sales order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/sales-orders/:id/convert
// @desc    Get sales order items available for conversion
// @access  Private
router.get('/:id/convert', auth, async (req, res) => {
  try {
    const salesOrder = await salesOrderRepository.findById(req.params.id, {
      populate: [
        { path: 'items.product', select: 'name description pricing inventory' },
        { path: 'customer', select: 'displayName firstName lastName email phone businessType customerTier' }
      ]
    });

    if (!salesOrder) {
      return res.status(404).json({ message: 'Sales order not found' });
    }

    // Filter items that have remaining quantities
    const availableItems = salesOrder.items.filter(item => item.remainingQuantity > 0);

    res.json({
      salesOrder: {
        _id: salesOrder._id,
        soNumber: salesOrder.soNumber,
        customer: salesOrder.customer,
        status: salesOrder.status
      },
      availableItems
    });
  } catch (error) {
    console.error('Get conversion data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/sales-orders/export/excel
// @desc    Export sales orders to Excel
// @access  Private
router.post('/export/excel', [auth, requirePermission('view_sales_orders')], async (req, res) => {
  try {
    const { filters = {} } = req.body;

    // Build query based on filters (similar to GET endpoint)
    const filter = {};

    if (filters.search) {
      filter.$or = [
        { soNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.customer) {
      filter.customer = filters.customer;
    }

    if (filters.fromDate || filters.toDate) {
      filter.orderDate = {};
      if (filters.fromDate) {
        filter.orderDate.$gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        const toDate = new Date(filters.toDate);
        toDate.setHours(23, 59, 59, 999);
        filter.orderDate.$lte = toDate;
      }
    }

    if (filters.orderNumber) {
      filter.soNumber = { $regex: filters.orderNumber, $options: 'i' };
    }

    const salesOrders = await salesOrderRepository.findAll(filter, {
      populate: [
        { path: 'customer', select: 'businessName name firstName lastName email phone' },
        { path: 'items.product', select: 'name' },
        { path: 'createdBy', select: 'firstName lastName email' }
      ],
      sort: { createdAt: -1 },
      lean: true
    });

    // Prepare Excel data
    const excelData = salesOrders.map(order => {
      const customerName = order.customer?.businessName ||
        order.customer?.name ||
        `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
        'Unknown Customer';

      const itemsSummary = order.items?.map(item =>
        `${item.product?.name || 'Unknown'}: ${item.quantity} x $${item.unitPrice}`
      ).join('; ') || 'No items';

      return {
        'SO Number': order.soNumber || '',
        'Customer': customerName,
        'Customer Email': order.customer?.email || '',
        'Customer Phone': order.customer?.phone || '',
        'Status': order.status || '',
        'Order Date': order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '',
        'Expected Delivery': order.expectedDelivery ? new Date(order.expectedDelivery).toISOString().split('T')[0] : '',
        'Confirmed Date': order.confirmedDate ? new Date(order.confirmedDate).toISOString().split('T')[0] : '',
        'Subtotal': order.subtotal || 0,
        'Tax': order.tax || 0,
        'Total': order.total || 0,
        'Items Count': order.items?.length || 0,
        'Items Summary': itemsSummary,
        'Notes': order.notes || '',
        'Terms': order.terms || '',
        'Created By': order.createdBy ? `${order.createdBy.firstName || ''} ${order.createdBy.lastName || ''}`.trim() : '',
        'Created Date': order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : ''
      };
    });

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 15 }, // SO Number
      { wch: 25 }, // Customer
      { wch: 25 }, // Customer Email
      { wch: 15 }, // Customer Phone
      { wch: 15 }, // Status
      { wch: 12 }, // Order Date
      { wch: 12 }, // Expected Delivery
      { wch: 12 }, // Confirmed Date
      { wch: 12 }, // Subtotal
      { wch: 10 }, // Tax
      { wch: 12 }, // Total
      { wch: 10 }, // Items Count
      { wch: 50 }, // Items Summary
      { wch: 30 }, // Notes
      { wch: 20 }, // Terms
      { wch: 20 }, // Created By
      { wch: 12 }  // Created Date
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Orders');

    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `sales_orders_${timestamp}.xlsx`;
    const filepath = path.join(exportsDir, filename);

    XLSX.writeFile(workbook, filepath);

    res.json({
      message: 'Sales orders exported successfully',
      filename: filename,
      recordCount: excelData.length,
      downloadUrl: `/api/sales-orders/download/${filename}`
    });

  } catch (error) {
    console.error('Excel export error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      message: 'Export failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   POST /api/sales-orders/export/csv
// @desc    Export sales orders to CSV
// @access  Private
router.post('/export/csv', [auth, requirePermission('view_sales_orders')], async (req, res) => {
  try {
    const { filters = {} } = req.body;

    // Build query based on filters (same as Excel export)
    const filter = {};

    if (filters.search) {
      filter.$or = [
        { soNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.customer) {
      filter.customer = filters.customer;
    }

    if (filters.fromDate || filters.toDate) {
      filter.orderDate = {};
      if (filters.fromDate) {
        filter.orderDate.$gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        const toDate = new Date(filters.toDate);
        toDate.setHours(23, 59, 59, 999);
        filter.orderDate.$lte = toDate;
      }
    }

    if (filters.orderNumber) {
      filter.soNumber = { $regex: filters.orderNumber, $options: 'i' };
    }

    const salesOrders = await salesOrderRepository.findAll(filter, {
      populate: [
        { path: 'customer', select: 'businessName name firstName lastName email phone' },
        { path: 'items.product', select: 'name' },
        { path: 'createdBy', select: 'firstName lastName email' }
      ],
      sort: { createdAt: -1 },
      lean: true
    });

    // Prepare CSV data
    const csvData = salesOrders.map(order => {
      const customerName = order.customer?.businessName ||
        order.customer?.name ||
        `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
        'Unknown Customer';

      const itemsSummary = order.items?.map(item =>
        `${item.product?.name || 'Unknown'}: ${item.quantity} x $${item.unitPrice}`
      ).join('; ') || 'No items';

      return {
        'SO Number': order.soNumber || '',
        'Customer': customerName,
        'Customer Email': order.customer?.email || '',
        'Customer Phone': order.customer?.phone || '',
        'Status': order.status || '',
        'Order Date': order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '',
        'Expected Delivery': order.expectedDelivery ? new Date(order.expectedDelivery).toISOString().split('T')[0] : '',
        'Confirmed Date': order.confirmedDate ? new Date(order.confirmedDate).toISOString().split('T')[0] : '',
        'Subtotal': order.subtotal || 0,
        'Tax': order.tax || 0,
        'Total': order.total || 0,
        'Items Count': order.items?.length || 0,
        'Items Summary': itemsSummary,
        'Notes': order.notes || '',
        'Terms': order.terms || '',
        'Created By': order.createdBy ? `${order.createdBy.firstName || ''} ${order.createdBy.lastName || ''}`.trim() : '',
        'Created Date': order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : ''
      };
    });

    // Convert to CSV
    const createCsvWriter = require('csv-writer').createObjectCsvWriter;

    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `sales_orders_${timestamp}.csv`;
    const filepath = path.join(exportsDir, filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'SO Number', title: 'SO Number' },
        { id: 'Customer', title: 'Customer' },
        { id: 'Customer Email', title: 'Customer Email' },
        { id: 'Customer Phone', title: 'Customer Phone' },
        { id: 'Status', title: 'Status' },
        { id: 'Order Date', title: 'Order Date' },
        { id: 'Expected Delivery', title: 'Expected Delivery' },
        { id: 'Confirmed Date', title: 'Confirmed Date' },
        { id: 'Subtotal', title: 'Subtotal' },
        { id: 'Tax', title: 'Tax' },
        { id: 'Total', title: 'Total' },
        { id: 'Items Count', title: 'Items Count' },
        { id: 'Items Summary', title: 'Items Summary' },
        { id: 'Notes', title: 'Notes' },
        { id: 'Terms', title: 'Terms' },
        { id: 'Created By', title: 'Created By' },
        { id: 'Created Date', title: 'Created Date' }
      ]
    });

    await csvWriter.writeRecords(csvData);

    res.json({
      message: 'Sales orders exported successfully',
      filename: filename,
      recordCount: csvData.length,
      downloadUrl: `/api/sales-orders/download/${filename}`
    });

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

// @route   POST /api/sales-orders/export/pdf
// @desc    Export sales orders to PDF
// @access  Private
router.post('/export/pdf', [auth, requirePermission('view_sales_orders')], async (req, res) => {
  try {
    const { filters = {} } = req.body;

    // Build query based on filters (same as Excel export)
    const filter = {};

    if (filters.search) {
      filter.$or = [
        { soNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.customer) {
      filter.customer = filters.customer;
    }

    if (filters.fromDate || filters.toDate) {
      filter.orderDate = {};
      if (filters.fromDate) {
        filter.orderDate.$gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        const toDate = new Date(filters.toDate);
        toDate.setHours(23, 59, 59, 999);
        filter.orderDate.$lte = toDate;
      }
    }

    if (filters.orderNumber) {
      filter.soNumber = { $regex: filters.orderNumber, $options: 'i' };
    }

    const salesOrders = await salesOrderRepository.findAll(filter, {
      populate: [
        { path: 'customer', select: 'businessName name firstName lastName email phone' },
        { path: 'items.product', select: 'name' },
        { path: 'createdBy', select: 'firstName lastName email' }
      ],
      sort: { createdAt: -1 },
      lean: true
    });

    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `sales_orders_${timestamp}.pdf`;
    const filepath = path.join(exportsDir, filename);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Helper function to format currency
    const formatCurrency = (amount) => {
      return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Helper function to format date
    const formatDate = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('SALES ORDERS REPORT', { align: 'center' });
    doc.moveDown(0.5);

    // Report date range
    if (filters.fromDate || filters.toDate) {
      const dateRange = `Period: ${filters.fromDate ? formatDate(filters.fromDate) : 'All'} - ${filters.toDate ? formatDate(filters.toDate) : 'All'}`;
      doc.fontSize(12).font('Helvetica').text(dateRange, { align: 'center' });
    } else {
      doc.fontSize(12).font('Helvetica').text(`Generated on: ${formatDate(new Date())}`, { align: 'center' });
    }

    doc.moveDown(1);

    // Summary section
    const totalOrders = salesOrders.length;
    const totalAmount = salesOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const statusCounts = {};
    salesOrders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    doc.fontSize(11).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Total Orders: ${totalOrders}`);
    doc.text(`Total Amount: ${formatCurrency(totalAmount)}`);

    if (Object.keys(statusCounts).length > 0) {
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').text('Status Breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        doc.fontSize(10).font('Helvetica').text(`  ${status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}: ${count}`, { indent: 20 });
      });
    }

    doc.moveDown(1.5);

    // Table setup
    const tableTop = doc.y;
    const leftMargin = 50;
    const pageWidth = 550;
    const colWidths = {
      soNumber: 80,
      customer: 150,
      date: 80,
      status: 70,
      total: 80,
      items: 90
    };

    // Table headers
    doc.fontSize(10).font('Helvetica-Bold');
    let xPos = leftMargin;
    doc.text('SO #', xPos, tableTop);
    xPos += colWidths.soNumber;
    doc.text('Customer', xPos, tableTop);
    xPos += colWidths.customer;
    doc.text('Date', xPos, tableTop);
    xPos += colWidths.date;
    doc.text('Status', xPos, tableTop);
    xPos += colWidths.status;
    doc.text('Total', xPos, tableTop);
    xPos += colWidths.total;
    doc.text('Items', xPos, tableTop);

    // Draw header line
    doc.moveTo(leftMargin, tableTop + 15).lineTo(pageWidth, tableTop + 15).stroke();

    let currentY = tableTop + 25;
    const rowHeight = 20;
    const pageHeight = 750;

    // Table rows
    salesOrders.forEach((order, index) => {
      // Check if we need a new page
      if (currentY > pageHeight - 50) {
        doc.addPage();
        currentY = 50;

        // Redraw headers on new page
        doc.fontSize(10).font('Helvetica-Bold');
        xPos = leftMargin;
        doc.text('SO #', xPos, currentY);
        xPos += colWidths.soNumber;
        doc.text('Customer', xPos, currentY);
        xPos += colWidths.customer;
        doc.text('Date', xPos, currentY);
        xPos += colWidths.date;
        doc.text('Status', xPos, currentY);
        xPos += colWidths.status;
        doc.text('Total', xPos, currentY);
        xPos += colWidths.total;
        doc.text('Items', xPos, currentY);

        doc.moveTo(leftMargin, currentY + 15).lineTo(pageWidth, currentY + 15).stroke();
        currentY += 25;
      }

      const customerName = order.customer?.businessName ||
        order.customer?.name ||
        `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
        'Unknown Customer';

      const statusText = order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1).replace(/_/g, ' ') : 'N/A';
      const itemsCount = order.items?.length || 0;

      doc.fontSize(9).font('Helvetica');
      xPos = leftMargin;
      doc.text(order.soNumber || 'N/A', xPos, currentY, { width: colWidths.soNumber });
      xPos += colWidths.soNumber;
      doc.text(customerName.substring(0, 25), xPos, currentY, { width: colWidths.customer });
      xPos += colWidths.customer;
      doc.text(formatDate(order.orderDate), xPos, currentY, { width: colWidths.date });
      xPos += colWidths.date;
      doc.text(statusText, xPos, currentY, { width: colWidths.status });
      xPos += colWidths.status;
      doc.text(formatCurrency(order.total), xPos, currentY, { width: colWidths.total, align: 'right' });
      xPos += colWidths.total;
      doc.text(itemsCount.toString(), xPos, currentY, { width: colWidths.items, align: 'right' });

      // Draw row line
      doc.moveTo(leftMargin, currentY + 12).lineTo(pageWidth, currentY + 12).stroke({ color: '#cccccc', width: 0.5 });

      currentY += rowHeight;
    });

    // Footer
    currentY += 20;
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 50;
    }

    doc.moveDown(2);
    doc.fontSize(9).font('Helvetica').text(`Total Orders: ${totalOrders} | Total Amount: ${formatCurrency(totalAmount)}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.text(`Generated on: ${formatDate(new Date())}`, { align: 'center' });

    if (req.user) {
      doc.moveDown(0.3);
      doc.text(`Generated by: ${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(), { align: 'center' });
    }

    // Finalize PDF
    doc.end();

    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      stream.on('finish', () => {
        resolve();
      });
      stream.on('error', reject);
    });

    res.json({
      message: 'Sales orders exported successfully',
      filename: filename,
      recordCount: salesOrders.length,
      downloadUrl: `/api/sales-orders/download/${filename}`
    });

  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

// @route   POST /api/sales-orders/export/json
// @desc    Export sales orders to JSON
// @access  Private
router.post('/export/json', [auth, requirePermission('view_sales_orders')], async (req, res) => {
  try {
    const { filters = {} } = req.body;

    // Build query based on filters (same as Excel export)
    const filter = {};

    if (filters.search) {
      filter.$or = [
        { soNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.customer) {
      filter.customer = filters.customer;
    }

    if (filters.fromDate || filters.toDate) {
      filter.orderDate = {};
      if (filters.fromDate) {
        filter.orderDate.$gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        const toDate = new Date(filters.toDate);
        toDate.setHours(23, 59, 59, 999);
        filter.orderDate.$lte = toDate;
      }
    }

    if (filters.orderNumber) {
      filter.soNumber = { $regex: filters.orderNumber, $options: 'i' };
    }

    const salesOrders = await salesOrderRepository.findAll(filter, {
      populate: [
        { path: 'customer', select: 'businessName name firstName lastName email phone' },
        { path: 'items.product', select: 'name' },
        { path: 'createdBy', select: 'firstName lastName email' }
      ],
      sort: { createdAt: -1 },
      lean: true
    });

    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `sales_orders_${timestamp}.json`;
    const filepath = path.join(exportsDir, filename);

    // Write JSON file
    fs.writeFileSync(filepath, JSON.stringify(salesOrders, null, 2), 'utf8');

    res.json({
      message: 'Sales orders exported successfully',
      filename: filename,
      recordCount: salesOrders.length,
      downloadUrl: `/api/sales-orders/download/${filename}`
    });

  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

// @route   GET /api/sales-orders/download/:filename
// @desc    Download exported file
// @access  Private
router.get('/download/:filename', [auth, requirePermission('view_sales_orders')], (req, res) => {
  try {
    const filename = req.params.filename;
    const exportsDir = path.join(__dirname, '../exports');
    const filepath = path.join(exportsDir, filename);


    if (!fs.existsSync(filepath)) {
      console.error('File not found:', filepath);
      return res.status(404).json({ message: 'File not found', filename, filepath });
    }

    // Set appropriate content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    let disposition = 'attachment'; // Default to download

    if (ext === '.csv') {
      contentType = 'text/csv';
    } else if (ext === '.json') {
      contentType = 'application/json';
    } else if (ext === '.pdf') {
      contentType = 'application/pdf';
      // For PDF, check if inline viewing is requested
      if (req.query.view === 'inline' || req.headers.accept?.includes('application/pdf')) {
        disposition = 'inline';
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

    // For PDF inline viewing, also set these headers
    if (ext === '.pdf' && disposition === 'inline') {
      res.setHeader('Content-Length', fs.statSync(filepath).size);
    }

    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Download failed' });
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Download failed' });
    }
  }
});

module.exports = router;
