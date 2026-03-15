const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const Sales = require('../models/Sales');
const SalesOrder = require('../models/SalesOrder');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const PurchaseOrder = require('../models/PurchaseOrder');
const returnManagementService = require('../services/returnManagementService');
const ReturnRepository = require('../repositories/ReturnRepository');

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
  body('originalOrder').isMongoId().withMessage('Valid original order ID is required'),
  body('returnType').isIn(['return', 'exchange', 'warranty', 'recall']).withMessage('Valid return type is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one return item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product ID is required'),
  body('items.*.originalOrderItem').isMongoId().withMessage('Valid order item ID is required'),
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
  body('refundMethod').optional().isIn(['original_payment', 'store_credit', 'cash', 'check', 'bank_transfer']),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  body('generalNotes').optional().trim().isLength({ max: 1000 }),
  handleValidationErrors,
], async (req, res) => {
  try {
    const returnData = {
      ...req.body,
      requestedBy: req.user._id
    };

    const returnRequest = await returnManagementService.createReturn(returnData, req.user._id);
    
    // Populate the return with related data
    await returnRequest.populate([
      { path: 'originalOrder', populate: { path: 'customer' } },
      { path: 'customer', select: 'name businessName email phone' },
      { path: 'items.product' },
      { path: 'requestedBy', select: 'firstName lastName email' }
    ]);

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
  }).isMongoId(),
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
  param('returnId').isMongoId().withMessage('Valid Return ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { returnId } = req.params;
    
    const returnRequest = await returnManagementService.getReturnById(returnId);
    
    // Additional population if needed
    await returnRequest.populate([
      { 
        path: 'originalOrder',
        populate: [
            { path: 'customer', select: 'name businessName email phone firstName lastName' },
            { path: 'supplier', select: 'name businessName email phone companyName contactPerson' },
            { path: 'items.product', select: 'name description pricing' }
          ]
        },
        { path: 'customer', select: 'name businessName email phone firstName lastName' },
        { path: 'supplier', select: 'name businessName email phone companyName contactPerson' },
        { path: 'items.product', select: 'name description pricing category' },
        { path: 'requestedBy', select: 'firstName lastName email' },
        { path: 'approvedBy', select: 'firstName lastName email' },
        { path: 'processedBy', select: 'firstName lastName email' },
        { path: 'receivedBy', select: 'firstName lastName email' },
        { path: 'inspection.inspectedBy', select: 'firstName lastName email' }
      ]);

    if (!returnRequest) {
      return res.status(404).json({ message: 'Return request not found' });
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
  param('returnId').isMongoId().withMessage('Valid Return ID is required'),
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
  param('returnId').isMongoId().withMessage('Valid Return ID is required'),
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
  param('returnId').isMongoId().withMessage('Valid Return ID is required'),
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
  param('returnId').isMongoId().withMessage('Valid Return ID is required'),
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
  param('orderId').isMongoId().withMessage('Valid Order ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Try to find in Sales first, then SalesOrder
    let order = await Sales.findById(orderId)
      .populate('customer')
      .populate('items.product');
    
    if (!order) {
      order = await SalesOrder.findById(orderId)
        .populate('customer')
        .populate('items.product');
    }
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Normalize order structure - SalesOrder uses different field names
    const orderNumber = order.orderNumber || order.soNumber;
    const orderDate = order.createdAt || order.orderDate;
    const items = order.items || [];

    // Check return eligibility for each item
    const eligibleItems = [];
    
    for (const item of items) {
      const alreadyReturnedQuantity = await returnManagementService.getAlreadyReturnedQuantity(
        order._id,
        item._id
      );
      
      // Handle different price field names
      const itemPrice = item.unitPrice || item.price || 0;
      const itemQuantity = item.quantity || 0;
      
      const availableForReturn = itemQuantity - alreadyReturnedQuantity;
      
      if (availableForReturn > 0) {
        eligibleItems.push({
          orderItem: {
            ...item.toObject(),
            price: itemPrice
          },
          availableQuantity: availableForReturn,
          alreadyReturned: alreadyReturnedQuantity
        });
      }
    }

    res.json({
      order: {
        _id: order._id,
        orderNumber: orderNumber,
        createdAt: orderDate,
        customer: order.customer
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
  param('orderId').isMongoId().withMessage('Valid Order ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Try to find in PurchaseInvoice first, then PurchaseOrder
    let order = await PurchaseInvoice.findById(orderId)
      .populate('supplier')
      .populate('items.product');
    
    if (!order) {
      order = await PurchaseOrder.findById(orderId)
        .populate('supplier')
        .populate('items.product');
    }
    
    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    // Normalize order structure
    const orderNumber = order.invoiceNumber || order.poNumber;
    const orderDate = order.createdAt || order.invoiceDate || order.orderDate;
    const items = order.items || [];

    // For purchase returns, all items are eligible (no existing return tracking needed for now)
    const eligibleItems = [];
    
    for (const item of items) {
      // Handle different price/cost field names
      const itemPrice = item.unitCost || item.costPerUnit || item.totalCost / (item.quantity || 1) || 0;
      const itemQuantity = item.quantity || 0;
      
      if (itemQuantity > 0) {
        eligibleItems.push({
          orderItem: {
            ...item.toObject(),
            price: itemPrice
          },
          availableQuantity: itemQuantity,
          alreadyReturned: 0
        });
      }
    }

    res.json({
      order: {
        _id: order._id,
        orderNumber: orderNumber,
        createdAt: orderDate,
        supplier: order.supplier
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
  param('returnId').isMongoId().withMessage('Valid Return ID is required'),
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
  param('returnId').isMongoId().withMessage('Valid Return ID is required'),
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
