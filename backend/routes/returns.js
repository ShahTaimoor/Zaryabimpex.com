const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const returnManagementService = require('../services/returnManagementService');
const SalesRepository = require('../repositories/SalesRepository');
const SalesOrderRepository = require('../repositories/SalesOrderRepository');
const PurchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');
const PurchaseOrderRepository = require('../repositories/PurchaseOrderRepository');
const CustomerRepository = require('../repositories/postgres/CustomerRepository');
const SupplierRepository = require('../repositories/postgres/SupplierRepository');
const ProductRepository = require('../repositories/postgres/ProductRepository');

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
  if (product.name) product.name = product.name.toUpperCase();
  if (product.description) product.description = product.description.toUpperCase();
  return product;
};

// @route   POST /api/returns
// @desc    Create a new return request
// @access  Private (requires 'create_orders' permission)
router.post('/', [
  auth,
  requirePermission('create_orders'),
  sanitizeRequest,
  body('originalOrder').isUUID(4).withMessage('Valid original order UUID is required'),
  body('returnType').isIn(['return', 'exchange', 'warranty', 'recall']).withMessage('Valid return type is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one return item is required'),
  body('items.*.product').isUUID(4).withMessage('Valid product ID is required'),
  body('items.*.originalOrderItem').isUUID(4).withMessage('Valid order item UUID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required'),
  body('items.*.returnReason').isIn([
    'defective', 'wrong_item', 'not_as_described', 'damaged_shipping',
    'changed_mind', 'duplicate_order', 'size_issue', 'quality_issue',
    'late_delivery', 'other'
  ]).withMessage('Valid return reason is required'),
  body('items.*.condition').isIn(['new', 'like_new', 'good', 'fair', 'poor', 'damaged']).withMessage('Valid condition is required'),
  body('items.*.action').isIn(['refund', 'exchange', 'store_credit', 'repair', 'replace']).withMessage('Valid action is required'),
  body('items.*.originalPrice').optional().isFloat({ min: 0 }).withMessage('Valid original price is required'),
  body('items.*.refundAmount').optional().isFloat({ min: 0 }).withMessage('Valid refund amount is required'),
  body('items.*.restockingFee').optional().isFloat({ min: 0 }).withMessage('Valid restocking fee is required'),
  body('items.*.generalNotes').optional().isString().isLength({ max: 1000 }).withMessage('General notes must be less than 1000 characters'),
  body('refundMethod').optional().isIn(['original_payment', 'store_credit', 'cash', 'check', 'bank_transfer', 'deferred']),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  body('generalNotes').optional().trim().isLength({ max: 1000 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const returnData = {
      ...req.body,
      requestedBy: req.user?.id || req.user?._id
    };

    const returnRequest = await returnManagementService.createReturn(returnData, req.user?.id || req.user?._id);

    if (typeof returnRequest.populate === 'function') {
      await returnRequest.populate([
        { path: 'originalOrder', populate: { path: 'customer' } },
        { path: 'customer', select: 'name businessName email phone' },
        { path: 'items.product' },
        { path: 'requestedBy', select: 'firstName lastName email' }
      ]);
    }

    // Transform names to uppercase
    if (returnRequest.customer) {
      returnRequest.customer = transformCustomerToUppercase(returnRequest.customer);
    }
    if (returnRequest.items && Array.isArray(returnRequest.items)) {
      returnRequest.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }
    if (returnRequest.originalOrder && returnRequest.originalOrder.customer) {
      returnRequest.originalOrder.customer = transformCustomerToUppercase(returnRequest.originalOrder.customer);
    }

    res.status(201).json({
      message: 'Return request created successfully',
      return: returnRequest
    });
  } catch (error) {
    console.error('Error creating return:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/returns
// @desc    Get list of returns with filters
// @access  Private (requires 'view_orders' permission)
router.get('/', [
  auth,
  requirePermission('view_orders'),
  sanitizeRequest,
  query('page').optional({ checkFalsy: true }).customSanitizer((value) => {
    if (!value || value === '') return undefined;
    const num = parseInt(value);
    return isNaN(num) ? undefined : num;
  }).isInt({ min: 1 }),
  query('limit').optional({ checkFalsy: true }).customSanitizer((value) => {
    if (!value || value === '') return undefined;
    const num = parseInt(value);
    return isNaN(num) ? undefined : num;
  }).isInt({ min: 1, max: 100 }),
  query('status').optional({ checkFalsy: true }).customSanitizer((value) => {
    return (!value || value === '') ? undefined : value;
  }).isIn([
    'pending', 'approved', 'rejected', 'processing', 'received',
    'inspected', 'refunded', 'exchanged', 'completed', 'cancelled'
  ]),
  query('returnType').optional({ checkFalsy: true }).customSanitizer((value) => {
    return (!value || value === '') ? undefined : value;
  }).isIn(['return', 'exchange', 'warranty', 'recall']),
  query('customer').optional({ checkFalsy: true }).customSanitizer((value) => {
    return (!value || value === '') ? undefined : value;
  }).isUUID(4),
  query('startDate').optional({ checkFalsy: true }).customSanitizer((value) => {
    if (!value || value === '') return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }),
  query('endDate').optional({ checkFalsy: true }).customSanitizer((value) => {
    if (!value || value === '') return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }),
  query('priority').optional({ checkFalsy: true }).customSanitizer((value) => {
    return (!value || value === '') ? undefined : value;
  }).isIn(['low', 'normal', 'high', 'urgent']),
  query('search').optional({ checkFalsy: true }).customSanitizer((value) => {
    return (!value || value === '') ? undefined : value.trim();
  }),
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
  handleValidationErrors,
  processDateFilter('returnDate'),
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      returnType,
      customer,
      priority,
      search
    } = req.query;

    const queryParams = {
      page,
      limit,
      status,
      returnType,
      customer,
      priority,
      search
    };
    
    // Merge date filter from middleware if present (for Pakistan timezone)
    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      queryParams.dateFilter = req.dateFilter;
    }

    const result = await returnManagementService.getReturns(queryParams);

    // Transform names to uppercase
    result.returns.forEach(returnItem => {
      if (returnItem.customer) {
        returnItem.customer = transformCustomerToUppercase(returnItem.customer);
      }
      if (returnItem.supplier) {
        // Transform supplier names similarly if needed
        if (returnItem.supplier.name) {
          returnItem.supplier.name = returnItem.supplier.name.toUpperCase();
        }
        if (returnItem.supplier.companyName) {
          returnItem.supplier.companyName = returnItem.supplier.companyName.toUpperCase();
        }
        if (returnItem.supplier.businessName) {
          returnItem.supplier.businessName = returnItem.supplier.businessName.toUpperCase();
        }
      }
      if (returnItem.items && Array.isArray(returnItem.items)) {
        returnItem.items.forEach(item => {
          if (item.product) {
            item.product = transformProductToUppercase(item.product);
          }
        });
      }
      if (returnItem.originalOrder) {
        if (returnItem.originalOrder.customer) {
          returnItem.originalOrder.customer = transformCustomerToUppercase(returnItem.originalOrder.customer);
        }
        if (returnItem.originalOrder.items && Array.isArray(returnItem.originalOrder.items)) {
          returnItem.originalOrder.items.forEach(item => {
            if (item.product) {
              item.product = transformProductToUppercase(item.product);
            }
          });
        }
      }
    });

    res.json({
      returns: result.returns,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching returns:', error);
    res.status(500).json({ message: 'Server error fetching returns', error: error.message });
  }
});

// @route   GET /api/returns/stats
// @desc    Get return statistics
// @access  Private (requires 'view_reports' permission)
router.get('/stats', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('startDate').optional({ checkFalsy: true }).customSanitizer((value) => {
    if (!value || value === '') return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }),
  query('endDate').optional({ checkFalsy: true }).customSanitizer((value) => {
    if (!value || value === '') return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build period object - dates are already Date objects from sanitizer, or undefined
    const period = {};
    if (startDate && endDate) {
      period.startDate = startDate instanceof Date ? startDate : new Date(startDate);
      period.endDate = endDate instanceof Date ? endDate : new Date(endDate);
    }
    
    const stats = await returnManagementService.getReturnStats(period);
    
    // Ensure stats object has all required fields
    const response = {
      totalReturns: stats.totalReturns || 0,
      pendingReturns: stats.pendingReturns || 0,
      totalRefundAmount: stats.totalRefundAmount || 0,
      returnRate: stats.returnRate || 0,
      averageRefundAmount: stats.averageRefundAmount || 0,
      averageProcessingTime: stats.averageProcessingTime || 0,
      statusBreakdown: stats.statusBreakdown || {},
      typeBreakdown: stats.typeBreakdown || {}
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching return stats:', error);
    res.status(500).json({ message: 'Server error fetching return stats', error: error.message });
  }
});

// @route   GET /api/returns/trends
// @desc    Get return trends over time
// @access  Private (requires 'view_reports' permission)
router.get('/trends', [
  auth,
  requirePermission('view_reports'),
  sanitizeRequest,
  query('periods').optional({ checkFalsy: true }).isInt({ min: 1, max: 24 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { periods = 12 } = req.query;
    const trends = await returnManagementService.getReturnTrends(parseInt(periods));

    res.json({
      trends,
      totalPeriods: trends.length
    });
  } catch (error) {
    console.error('Error fetching return trends:', error);
    res.status(500).json({ message: 'Server error fetching return trends', error: error.message });
  }
});

// @route   GET /api/returns/:returnId
// @desc    Get detailed return information
// @access  Private (requires 'view_orders' permission)
router.get('/:returnId', [
  auth,
  requirePermission('view_orders'),
  sanitizeRequest,
  param('returnId').isUUID(4).withMessage('Valid return UUID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { returnId } = req.params;
    
    let returnRequest = await returnManagementService.getReturnById(returnId);

    if (!returnRequest) {
      return res.status(404).json({ message: 'Return request not found' });
    }

    if (typeof returnRequest.populate === 'function') {
      await returnRequest.populate([
        { path: 'originalOrder', populate: [{ path: 'customer' }, { path: 'supplier' }, { path: 'items.product' }] },
        { path: 'customer' },
        { path: 'supplier' },
        { path: 'items.product' },
        { path: 'requestedBy' },
        { path: 'approvedBy' },
        { path: 'processedBy' },
        { path: 'receivedBy' },
        { path: 'inspection.inspectedBy' }
      ]);
    } else {
      if (returnRequest.customer_id) {
        returnRequest.customer = await CustomerRepository.findById(returnRequest.customer_id);
      }
      if (returnRequest.supplier_id) {
        returnRequest.supplier = await SupplierRepository.findById(returnRequest.supplier_id);
      }
      if (returnRequest.items && Array.isArray(returnRequest.items)) {
        for (const item of returnRequest.items) {
          const productId = item.product && (typeof item.product === 'string' ? item.product : (item.product.id || item.product._id));
          if (productId) {
            const product = await ProductRepository.findById(productId);
            item.product = product || { id: productId, _id: productId };
          }
        }
      }
      returnRequest._id = returnRequest.id;
    }
    
    // Transform names to uppercase
    if (returnRequest.customer) {
      returnRequest.customer = transformCustomerToUppercase(returnRequest.customer);
    }
    if (returnRequest.supplier) {
      if (returnRequest.supplier.name) {
        returnRequest.supplier.name = returnRequest.supplier.name.toUpperCase();
      }
      if (returnRequest.supplier.companyName) {
        returnRequest.supplier.companyName = returnRequest.supplier.companyName.toUpperCase();
      }
      if (returnRequest.supplier.businessName) {
        returnRequest.supplier.businessName = returnRequest.supplier.businessName.toUpperCase();
      }
    }
    if (returnRequest.items && Array.isArray(returnRequest.items)) {
      returnRequest.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }
    if (returnRequest.originalOrder) {
      if (returnRequest.originalOrder.customer) {
        returnRequest.originalOrder.customer = transformCustomerToUppercase(returnRequest.originalOrder.customer);
      }
      if (returnRequest.originalOrder.supplier) {
        if (returnRequest.originalOrder.supplier.name) {
          returnRequest.originalOrder.supplier.name = returnRequest.originalOrder.supplier.name.toUpperCase();
        }
        if (returnRequest.originalOrder.supplier.companyName) {
          returnRequest.originalOrder.supplier.companyName = returnRequest.originalOrder.supplier.companyName.toUpperCase();
        }
        if (returnRequest.originalOrder.supplier.businessName) {
          returnRequest.originalOrder.supplier.businessName = returnRequest.originalOrder.supplier.businessName.toUpperCase();
        }
      }
      if (returnRequest.originalOrder.items && Array.isArray(returnRequest.originalOrder.items)) {
        returnRequest.originalOrder.items.forEach(item => {
          if (item.product) {
            item.product = transformProductToUppercase(item.product);
          }
        });
      }
    }
    

    res.json(returnRequest);
  } catch (error) {
    if (error.message === 'Return request not found') {
      return res.status(404).json({ message: 'Return request not found' });
    }
    console.error('Error fetching return:', error);
    res.status(500).json({ message: 'Server error fetching return', error: error.message });
  }
});

// @route   PUT /api/returns/:returnId/status
// @desc    Update return status
// @access  Private (requires 'edit_orders' permission)
router.put('/:returnId/status', [
  auth,
  requirePermission('edit_orders'),
  sanitizeRequest,
  param('returnId').isUUID(4).withMessage('Valid return UUID is required'),
  body('status').isIn([
    'pending', 'approved', 'rejected', 'processing', 'received',
    'inspected', 'refunded', 'exchanged', 'completed', 'cancelled'
  ]).withMessage('Valid status is required'),
  body('notes').optional().trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { returnId } = req.params;
    const { status, notes } = req.body;
    
    // Handle different status changes
    let returnRequest;
    switch (status) {
      case 'approved':
        returnRequest = await returnManagementService.approveReturn(returnId, req.user._id, notes);
        break;
      case 'rejected':
        if (!notes) {
          return res.status(400).json({ message: 'Rejection reason is required' });
        }
        returnRequest = await returnManagementService.rejectReturn(returnId, req.user._id, notes);
        break;
      case 'received':
        returnRequest = await returnManagementService.processReceivedReturn(returnId, req.user._id);
        break;
      default:
        returnRequest = await ReturnRepository.findById(returnId);
        if (!returnRequest) {
          throw new Error('Return request not found');
        }
        await returnRequest.updateStatus(status, req.user._id, notes);
    }

    // Populate the updated return
    await returnRequest.populate([
      { path: 'originalOrder', select: 'orderNumber createdAt' },
      { path: 'customer', select: 'name businessName email' },
      { path: 'items.product', select: 'name description' },
      { path: 'requestedBy', select: 'name businessName' },
      { path: 'approvedBy', select: 'name businessName' },
      { path: 'processedBy', select: 'name businessName' }
    ]);

    res.json({
      message: 'Return status updated successfully',
      return: returnRequest
    });
  } catch (error) {
    console.error('Error updating return status:', error);
    res.status(400).json({ message: error.message });
  }
});

// @route   PUT /api/returns/:returnId/inspection
// @desc    Update return inspection details
// @access  Private (requires 'edit_orders' permission)
router.put('/:returnId/inspection', [
  auth,
  requirePermission('edit_orders'),
  sanitizeRequest,
  param('returnId').isUUID(4).withMessage('Valid return UUID is required'),
  body('inspectionNotes').optional().trim(),
  body('conditionVerified').optional().isBoolean(),
  body('resellable').optional().isBoolean(),
  body('disposalRequired').optional().isBoolean(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { returnId } = req.params;
    const { inspectionNotes, conditionVerified, resellable, disposalRequired } = req.body;
    
    const returnRequest = await returnManagementService.updateInspection(returnId, {
      inspectionNotes,
      conditionVerified,
      resellable,
      disposalRequired
    }, req.user._id);

    res.json({
      message: 'Inspection details updated successfully',
      return: returnRequest
    });
  } catch (error) {
    console.error('Error updating inspection:', error);
    res.status(500).json({ message: 'Server error updating inspection', error: error.message });
  }
});

// @route   POST /api/returns/:returnId/notes
// @desc    Add note to return
// @access  Private (requires 'view_orders' permission)
router.post('/:returnId/notes', [
  auth,
  requirePermission('view_orders'),
  sanitizeRequest,
  param('returnId').isUUID(4).withMessage('Valid return UUID is required'),
  body('note').trim().isLength({ min: 1 }).withMessage('Note is required'),
  body('isInternal').optional().isBoolean(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { returnId } = req.params;
    const { note, isInternal = false } = req.body;
    
    const returnRequest = await returnManagementService.addNote(returnId, note, req.user._id, isInternal);

    res.json({
      message: 'Note added successfully',
      return: returnRequest
    });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ message: 'Server error adding note', error: error.message });
  }
});

// @route   POST /api/returns/:returnId/communication
// @desc    Add communication log to return
// @access  Private (requires 'view_orders' permission)
router.post('/:returnId/communication', [
  auth,
  requirePermission('view_orders'),
  sanitizeRequest,
  param('returnId').isUUID(4).withMessage('Valid return UUID is required'),
  body('type').isIn(['email', 'phone', 'in_person', 'system']).withMessage('Valid communication type is required'),
  body('message').trim().isLength({ min: 1 }).withMessage('Message is required'),
  body('recipient').optional().trim(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { returnId } = req.params;
    const { type, message, recipient } = req.body;
    
    const returnRequest = await returnManagementService.addCommunication(returnId, type, message, req.user._id, recipient);

    res.json({
      message: 'Communication logged successfully',
      return: returnRequest
    });
  } catch (error) {
    console.error('Error adding communication:', error);
    res.status(500).json({ message: 'Server error adding communication', error: error.message });
  }
});

// @route   GET /api/returns/order/:orderId/eligible-items
// @desc    Get eligible items for return from a sales order (Sales or SalesOrder)
// @access  Private (requires 'view_orders' permission)
router.get('/order/:orderId/eligible-items', [
  auth,
  requirePermission('view_orders'),
  sanitizeRequest,
  param('orderId').isUUID(4).withMessage('Valid order UUID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { orderId } = req.params;

    let order = await SalesRepository.findById(orderId);
    if (!order) order = await SalesOrderRepository.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.items && typeof order.items === 'string') {
      order.items = JSON.parse(order.items);
    }
    const orderIdVal = order.id || order._id;
    const orderNumber = order.order_number || order.orderNumber || order.so_number;
    const orderDate = order.sale_date || order.created_at || order.order_date;
    const items = Array.isArray(order.items) ? order.items : [];

    const customer = order.customer_id
      ? await CustomerRepository.findById(order.customer_id)
      : null;

    const eligibleItems = [];
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const itemId = item.id || item._id || `${orderIdVal}-${idx}`;
      const alreadyReturnedQuantity = await returnManagementService.getAlreadyReturnedQuantity(
        orderIdVal,
        itemId
      );
      const itemPrice = item.unit_price || item.unitPrice || item.price || 0;
      const itemQuantity = item.quantity || 0;
      const availableForReturn = itemQuantity - alreadyReturnedQuantity;

      if (availableForReturn > 0) {
        eligibleItems.push({
          orderItem: {
            ...item,
            _id: itemId,
            id: itemId,
            price: itemPrice
          },
          availableQuantity: availableForReturn,
          alreadyReturned: alreadyReturnedQuantity
        });
      }
    }

    res.json({
      order: {
        _id: orderIdVal,
        id: orderIdVal,
        orderNumber,
        createdAt: orderDate,
        customer
      },
      eligibleItems
    });
  } catch (error) {
    console.error('Error fetching eligible items:', error);
    res.status(500).json({ message: 'Server error fetching eligible items', error: error.message });
  }
});

// @route   GET /api/returns/purchase-order/:orderId/eligible-items
// @desc    Get eligible items for return from a purchase order (PurchaseInvoice or PurchaseOrder)
// @access  Private (requires 'view_orders' permission)
router.get('/purchase-order/:orderId/eligible-items', [
  auth,
  requirePermission('view_orders'),
  sanitizeRequest,
  param('orderId').isUUID(4).withMessage('Valid order UUID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { orderId } = req.params;

    let order = await PurchaseInvoiceRepository.findById(orderId);
    if (!order) order = await PurchaseOrderRepository.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    if (order.items && typeof order.items === 'string') {
      order.items = JSON.parse(order.items);
    }
    const orderIdVal = order.id || order._id;
    const orderNumber = order.invoice_number || order.invoiceNumber || order.po_number;
    const orderDate = order.invoice_date || order.created_at || order.order_date;
    const items = Array.isArray(order.items) ? order.items : [];

    const supplier = order.supplier_id
      ? await SupplierRepository.findById(order.supplier_id)
      : null;

    const eligibleItems = [];
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const itemPrice = item.unit_cost || item.unitCost || item.costPerUnit || (item.totalCost / (item.quantity || 1)) || 0;
      const itemQuantity = item.quantity || 0;
      if (itemQuantity > 0) {
        const itemId = item.id || item._id || `${orderIdVal}-${idx}`;
        eligibleItems.push({
          orderItem: {
            ...item,
            _id: itemId,
            id: itemId,
            price: itemPrice
          },
          availableQuantity: itemQuantity,
          alreadyReturned: 0
        });
      }
    }

    res.json({
      order: {
        _id: orderIdVal,
        id: orderIdVal,
        orderNumber,
        createdAt: orderDate,
        supplier
      },
      eligibleItems
    });
  } catch (error) {
    console.error('Error fetching eligible purchase items:', error);
    res.status(500).json({ message: 'Server error fetching eligible purchase items', error: error.message });
  }
});

// @route   PUT /api/returns/:returnId/cancel
// @desc    Cancel a pending return request (status -> cancelled)
// @access  Private (requires 'edit_orders' permission)
router.put('/:returnId/cancel', [
  auth,
  requirePermission('edit_orders'),
  sanitizeRequest,
  param('returnId').isUUID(4).withMessage('Valid return UUID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { returnId } = req.params;
    
    await returnManagementService.cancelReturn(returnId, req.user._id);

    res.json({ message: 'Return request cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling return:', error);
    res.status(500).json({ message: 'Server error cancelling return', error: error.message });
  }
});

// @route   DELETE /api/returns/:returnId
// @desc    Permanently delete a return request (pending or cancelled only)
// @access  Private (Admin only)
router.delete('/:returnId', [
  auth,
  requirePermission('delete_returns'),
  sanitizeRequest,
  param('returnId').isUUID(4).withMessage('Valid return UUID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { returnId } = req.params;
    
    const result = await returnManagementService.deleteReturn(returnId);

    res.json({ message: result.message });
  } catch (error) {
    console.error('Error deleting return:', error);
    res.status(500).json({ message: 'Server error deleting return', error: error.message });
  }
});

module.exports = router;
