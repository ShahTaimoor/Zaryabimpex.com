const express = require('express');
const { body, validationResult, query } = require('express-validator');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Sales = require('../models/Sales'); // Still needed for new Sales() and static methods
const Product = require('../models/Product'); // Still needed for validation
const ProductVariant = require('../models/ProductVariant'); // For variant support
const Customer = require('../models/Customer'); // Still needed for validation
const CashReceipt = require('../models/CashReceipt');
const BankReceipt = require('../models/BankReceipt');
const Inventory = require('../models/Inventory');
const StockMovementService = require('../services/stockMovementService');
const salesService = require('../services/salesService');
const salesRepository = require('../repositories/SalesRepository');
const productRepository = require('../repositories/ProductRepository');
const productVariantRepository = require('../repositories/ProductVariantRepository');
const customerRepository = require('../repositories/CustomerRepository');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { preventPOSDuplicates } = require('../middleware/duplicatePrevention');

const router = express.Router();

// Helper function to parse date string as local date (not UTC)
// This ensures that "2025-01-20" is interpreted as local midnight, not UTC midnight
const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  // If dateString is already a Date object, return it
  if (dateString instanceof Date) return dateString;
  // Parse date string and create date at local midnight
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  // Create date in local timezone (month is 0-indexed in Date constructor)
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

// Format customer address for order customerInfo (for print)
const formatCustomerAddress = (customerData) => {
  if (!customerData) return '';
  if (customerData.address && typeof customerData.address === 'string') return customerData.address;
  if (customerData.addresses && Array.isArray(customerData.addresses) && customerData.addresses.length > 0) {
    const addr = customerData.addresses.find(a => a.isDefault) || customerData.addresses.find(a => a.type === 'billing' || a.type === 'both') || customerData.addresses[0];
    const parts = [addr.street, addr.city, addr.state, addr.country, addr.zipCode].filter(Boolean);
    return parts.join(', ');
  }
  return '';
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

const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');

// @route   GET /api/orders
// @desc    Get all orders with filtering and pagination
// @access  Private
router.get('/', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 999999 }),
  query('all').optional({ checkFalsy: true }).isBoolean(),
  query('search').optional().trim(),
  query('productSearch').optional().trim(),
  query('status').optional({ checkFalsy: true }).isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']),
  query('paymentStatus').optional({ checkFalsy: true }).isIn(['pending', 'paid', 'partial', 'refunded']),
  query('orderType').optional({ checkFalsy: true }).isIn(['retail', 'wholesale', 'return', 'exchange']),
  ...validateDateParams,
  handleValidationErrors,
  processDateFilter(['billDate', 'createdAt']), // Support both billDate and createdAt
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Merge date filter from middleware if present (for Pakistan timezone)
    const queryParams = { ...req.query };
    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      queryParams.dateFilter = req.dateFilter;
    }

    // Call service to get sales orders
    const result = await salesService.getSalesOrders(queryParams);

    res.json({
      orders: result.orders,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/sales/cctv-orders
// @desc    Get orders with CCTV timestamps for camera access
// @access  Private
router.get('/cctv-orders', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('orderNumber').optional().trim(),
  query('customerId').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query - only orders with CCTV timestamps
    const query = {
      billStartTime: { $exists: true, $ne: null },
      billEndTime: { $exists: true, $ne: null },
      isDeleted: { $ne: true }
    };

    // Add date filters
    if (req.query.dateFrom || req.query.dateTo) {
      query.createdAt = {};
      if (req.query.dateFrom) {
        const dateFrom = new Date(req.query.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        query.createdAt.$gte = dateFrom;
      }
      if (req.query.dateTo) {
        const dateTo = new Date(req.query.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        query.createdAt.$lte = dateTo;
      }
    }

    // Add order number filter
    if (req.query.orderNumber) {
      query.orderNumber = { $regex: req.query.orderNumber, $options: 'i' };
    }

    // Add customer filter
    if (req.query.customerId) {
      query.customer = req.query.customerId;
    }

    // Get orders with CCTV timestamps
    const orders = await Sales.find(query)
      .populate('customer', 'displayName firstName lastName email phone addresses currentBalance pendingBalance advanceBalance')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await Sales.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get CCTV orders error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/sales/period-summary
// @desc    Get period summary for comparisons (alternative route with hyphen)
// @access  Private
router.get('/period-summary', [
  auth,
  query('dateFrom').isISO8601().withMessage('Invalid start date'),
  query('dateTo').isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const dateFrom = new Date(req.query.dateFrom);
    dateFrom.setHours(0, 0, 0, 0);
    const dateTo = new Date(req.query.dateTo);
    dateTo.setDate(dateTo.getDate() + 1);
    dateTo.setHours(0, 0, 0, 0);

    const orders = await Sales.find({
      createdAt: { $gte: dateFrom, $lt: dateTo }
    });

    const totalRevenue = orders.reduce((sum, order) => sum + (order.pricing?.total || 0), 0);
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) =>
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate discounts
    const totalDiscounts = orders.reduce((sum, order) =>
      sum + (order.pricing?.discountAmount || 0), 0);

    // Calculate by order type
    const revenueByType = {
      retail: orders.filter(o => o.orderType === 'retail')
        .reduce((sum, order) => sum + (order.pricing?.total || 0), 0),
      wholesale: orders.filter(o => o.orderType === 'wholesale')
        .reduce((sum, order) => sum + (order.pricing?.total || 0), 0)
    };

    const summary = {
      total: totalRevenue,
      totalRevenue,
      totalOrders,
      totalItems,
      averageOrderValue,
      totalDiscounts,
      netRevenue: totalRevenue - totalDiscounts,
      revenueByType,
      period: {
        start: req.query.dateFrom,
        end: req.query.dateTo
      }
    };

    res.json({ data: summary });
  } catch (error) {
    console.error('Get period summary error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/orders/:id
// @desc    Get single order
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await salesService.getSalesOrderById(req.params.id);

    // Transform names to uppercase
    if (order.customer) {
      order.customer = transformCustomerToUppercase(order.customer);
    }
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/customer/:customerId/last-prices
// @desc    Get last order prices for a customer (product prices from most recent order)
// @access  Private
router.get('/customer/:customerId/last-prices', auth, async (req, res) => {
  try {
    const { customerId } = req.params;

    // Find the most recent order for this customer
    const lastOrder = await salesRepository.findByCustomer(customerId, {
      sort: { createdAt: -1 },
      limit: 1,
      populate: [{ path: 'items.product', select: 'name _id' }]
    });

    const lastOrderDoc = lastOrder && lastOrder.length > 0 ? lastOrder[0] : null;

    if (!lastOrderDoc) {
      return res.json({
        success: true,
        message: 'No previous orders found for this customer',
        prices: {}
      });
    }

    // Extract product prices from last order
    const prices = {};
    lastOrderDoc.items.forEach(item => {
      if (item.product && item.product._id) {
        prices[item.product._id.toString()] = {
          productId: item.product._id.toString(),
          productName: item.product.isVariant
            ? (item.product.displayName || item.product.variantName || item.product.name)
            : item.product.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity
        };
      }
    });

    res.json({
      success: true,
      message: 'Last order prices retrieved successfully',
      orderNumber: lastOrderDoc.orderNumber,
      orderDate: lastOrderDoc.createdAt,
      prices: prices
    });
  } catch (error) {
    console.error('Get last prices error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/orders
// @desc    Create new order
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_orders'),
  preventPOSDuplicates, // Backend safety net for duplicate prevention
  body('orderType').isIn(['retail', 'wholesale', 'return', 'exchange']).withMessage('Invalid order type'),
  body('customer').optional().isMongoId().withMessage('Invalid customer ID'),
  body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
  body('items.*.product').isMongoId().withMessage('Invalid product ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('payment.method').isIn(['cash', 'credit_card', 'debit_card', 'check', 'account', 'split', 'bank']).withMessage('Invalid payment method'),
  body('payment.amount').optional().isFloat({ min: 0 }).withMessage('Payment amount must be a positive number'),
  body('payment.remainingBalance').optional().isFloat().withMessage('Remaining balance must be a valid number'),
  body('payment.isPartialPayment').optional().isBoolean().withMessage('Partial payment must be a boolean'),
  body('payment.isAdvancePayment').optional().isBoolean().withMessage('Advance payment must be a boolean'),
  body('payment.advanceAmount').optional().isFloat({ min: 0 }).withMessage('Advance amount must be a positive number'),
  body('isTaxExempt').optional().isBoolean().withMessage('Tax exempt must be a boolean'),
  body('billDate').optional().isISO8601().withMessage('Valid bill date required (ISO 8601 format)')
], async (req, res) => {
  // Capture bill start time (when billing begins)
  const billStartTime = new Date();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array().map(error => ({
          field: error.path || error.param,
          message: error.msg,
          value: error.value
        }))
      });
    }

    const { customer, items, orderType, payment, notes, isTaxExempt, billDate } = req.body;

    // Use SalesService to create the sale (invoice)
    const savedOrder = await salesService.createSale(
      {
        customer,
        items,
        orderType,
        payment,
        notes,
        isTaxExempt,
        billDate,
        billStartTime
      },
      req.user
    );

    // Get plain object for response transformations
    const orderForResponse = savedOrder.toObject ? savedOrder.toObject({ virtuals: true }) : { ...savedOrder };

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: orderForResponse
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      message: error.message || 'Server error. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private
router.put('/:id/status', [
  auth,
  requirePermission('edit_orders'),
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const order = await Sales.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if status change is allowed
    if (req.body.status === 'cancelled' && !order.canBeCancelled()) {
      return res.status(400).json({
        message: 'Order cannot be cancelled in its current status'
      });
    }

    const oldStatus = order.status;
    order.status = req.body.status;
    order.processedBy = req.user._id;

    // Note: Customer balance updates removed from route.
    // Balances are now dynamically derived from the Account Ledger.

    // If cancelling, restore inventory
    if (req.body.status === 'cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { 'inventory.currentStock': item.quantity } }
        );
      }

      // Note: Reversing customer balance is now handled by the ledger.
    }

    await order.save();

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/orders/:id
// @desc    Update order details
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('edit_orders'),
  preventPOSDuplicates, // Backend safety net for duplicate prevention
  body('customer').optional().isMongoId().withMessage('Valid customer is required'),
  body('orderType').optional().isIn(['retail', 'wholesale', 'return', 'exchange']).withMessage('Invalid order type'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes too long'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').optional().isMongoId().withMessage('Valid product is required'),
  body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').optional().isFloat({ min: 0 }).withMessage('Unit price must be positive'),
  body('billDate').optional().isISO8601().withMessage('Valid bill date required (ISO 8601 format)')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const order = await Sales.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get customer data if customer is being updated
    let customerData = null;
    if (req.body.customer) {
      customerData = await Customer.findById(req.body.customer);
      if (!customerData) {
        return res.status(400).json({ message: 'Customer not found' });
      }
    }

    // Store old items and old total for comparison
    const oldItems = JSON.parse(JSON.stringify(order.items));
    const oldTotal = order.pricing.total;
    const oldCustomer = order.customer;

    // Update order fields
    if (req.body.customer !== undefined) {
      order.customer = req.body.customer || null;
      order.customerInfo = customerData ? {
        name: customerData.displayName,
        email: customerData.email,
        phone: customerData.phone,
        businessName: customerData.businessName,
        address: formatCustomerAddress(customerData),
        currentBalance: customerData.currentBalance,
        pendingBalance: customerData.pendingBalance,
        advanceBalance: customerData.advanceBalance
      } : null;
    }

    if (req.body.orderType !== undefined) {
      order.orderType = req.body.orderType;
    }

    if (req.body.notes !== undefined) {
      order.notes = req.body.notes;
    }

    // Update billDate if provided (for backdating/postdating)
    if (req.body.billDate !== undefined) {
      order.billDate = parseLocalDate(req.body.billDate);
    }

    // Update items if provided and recalculate pricing
    if (req.body.items && req.body.items.length > 0) {
      // Validate products and stock availability
      for (const item of req.body.items) {
        // Try to find as product first, then as variant
        let product = await productRepository.findById(item.product);
        let isVariant = false;

        if (!product) {
          product = await productVariantRepository.findById(item.product);
          if (product) {
            isVariant = true;
          }
        }

        if (!product) {
          return res.status(400).json({ message: `Product or variant ${item.product} not found` });
        }

        // Find old quantity for this product
        const oldItem = oldItems.find(oi => {
          const oldProductId = oi.product?._id ? oi.product._id.toString() : oi.product?.toString() || oi.product;
          const newProductId = item.product?.toString() || item.product;
          return oldProductId === newProductId;
        });
        const oldQuantity = oldItem ? oldItem.quantity : 0;
        const quantityChange = item.quantity - oldQuantity;

        // Check if increasing quantity - need to verify stock availability
        if (quantityChange > 0) {
          // Product is already fetched above, just get the name
          const productName = isVariant
            ? (product.displayName || product.variantName || `${product.baseProduct?.name || 'Product'} - ${product.variantValue || ''}`)
            : product.name;

          const currentStock = product.inventory?.currentStock || 0;
          if (currentStock < quantityChange) {
            return res.status(400).json({
              message: `Insufficient stock for ${productName}. Available: ${currentStock}, Additional needed: ${quantityChange}`
            });
          }
        }
      }

      // Recalculate pricing for new items
      let newSubtotal = 0;
      let newTotalDiscount = 0;
      let newTotalTax = 0;
      const newOrderItems = [];

      for (const item of req.body.items) {
        // Try to find as product first, then as variant (for tax rate)
        let productForTax = await productRepository.findById(item.product);
        let isVariantForTax = false;
        if (!productForTax) {
          productForTax = await productVariantRepository.findById(item.product);
          if (productForTax) {
            isVariantForTax = true;
          }
        }

        const itemSubtotal = item.quantity * item.unitPrice;
        const itemDiscount = itemSubtotal * ((item.discountPercent || 0) / 100);
        const itemTaxable = itemSubtotal - itemDiscount;
        // Use taxRate from item if provided, otherwise get from product/variant
        const taxRate = item.taxRate !== undefined
          ? item.taxRate
          : (isVariantForTax
            ? (productForTax?.baseProduct?.taxSettings?.taxRate || 0)
            : (productForTax?.taxSettings?.taxRate || 0));
        const itemTax = order.pricing.isTaxExempt ? 0 : itemTaxable * taxRate;

        newOrderItems.push({
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          taxRate: item.taxRate || 0,
          subtotal: itemSubtotal,
          discountAmount: itemDiscount,
          taxAmount: itemTax,
          total: itemSubtotal - itemDiscount + itemTax
        });

        newSubtotal += itemSubtotal;
        newTotalDiscount += itemDiscount;
        newTotalTax += itemTax;
      }

      // Update order items and pricing
      order.items = newOrderItems;
      order.pricing.subtotal = newSubtotal;
      order.pricing.discountAmount = newTotalDiscount;
      order.pricing.taxAmount = newTotalTax;
      order.pricing.total = newSubtotal - newTotalDiscount + newTotalTax;

      // Check credit limit for credit sales when order total increases
      const finalCustomer = customerData || (order.customer ? await Customer.findById(order.customer) : null);
      if (finalCustomer && finalCustomer.creditLimit > 0) {
        const newTotal = order.pricing.total;
        const paymentMethod = order.payment?.method || 'cash';
        const amountPaid = order.payment?.amountPaid || 0;
        const unpaidAmount = newTotal - amountPaid;

        // For account payments or partial payments, check credit limit
        if (paymentMethod === 'account' || unpaidAmount > 0) {
          const currentBalance = finalCustomer.currentBalance || 0;
          const pendingBalance = finalCustomer.pendingBalance || 0;

          // Calculate what the balance would be after this update
          // First, remove the old order's unpaid amount, then add the new unpaid amount
          const wasConfirmed = order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered';
          let oldUnpaidAmount = 0;

          if (order.payment.isPartialPayment && order.payment.remainingBalance > 0) {
            oldUnpaidAmount = order.payment.remainingBalance;
          } else if (order.payment.method === 'account' || order.payment.status === 'pending') {
            oldUnpaidAmount = oldTotal;
          } else if (order.payment.status === 'partial') {
            oldUnpaidAmount = oldTotal - order.payment.amountPaid;
          }

          // Calculate effective outstanding balance (after removing old order's contribution)
          const effectiveOutstanding = currentBalance - oldUnpaidAmount;
          const newBalanceAfterUpdate = effectiveOutstanding + unpaidAmount;

          if (newBalanceAfterUpdate > finalCustomer.creditLimit) {
            return res.status(400).json({
              message: `Credit limit exceeded for customer ${finalCustomer.displayName || finalCustomer.name}`,
              error: 'CREDIT_LIMIT_EXCEEDED',
              details: {
                currentBalance: currentBalance,
                totalOutstanding: currentBalance,
                oldOrderUnpaid: oldUnpaidAmount,
                newOrderTotal: newTotal,
                unpaidAmount: unpaidAmount,
                creditLimit: finalCustomer.creditLimit,
                newBalance: newBalanceAfterUpdate,
                availableCredit: finalCustomer.creditLimit - currentBalance
              }
            });
          }
        }
      }
    }

    await order.save();

    // Adjust inventory based on item changes
    if (req.body.items && req.body.items.length > 0) {
      try {
        const inventoryService = require('../services/inventoryService');

        for (const newItem of req.body.items) {
          const oldItem = oldItems.find(oi => {
            const oldProductId = oi.product?._id ? oi.product._id.toString() : oi.product?.toString() || oi.product;
            const newProductId = newItem.product?.toString() || newItem.product;
            return oldProductId === newProductId;
          });
          const oldQuantity = oldItem ? oldItem.quantity : 0;
          const quantityChange = newItem.quantity - oldQuantity;

          if (quantityChange !== 0) {
            if (quantityChange > 0) {
              // Quantity increased - reduce inventory
              await inventoryService.updateStock({
                productId: newItem.product,
                type: 'out',
                quantity: quantityChange,
                reason: 'Order Update - Quantity Increased',
                reference: 'Sales Order',
                referenceId: order._id,
                referenceModel: 'SalesOrder',
                performedBy: req.user._id,
                notes: `Inventory reduced due to order ${order.orderNumber} update - quantity increased by ${quantityChange}`
              });
            } else {
              // Quantity decreased - restore inventory
              await inventoryService.updateStock({
                productId: newItem.product,
                type: 'in',
                quantity: Math.abs(quantityChange),
                reason: 'Order Update - Quantity Decreased',
                reference: 'Sales Order',
                referenceId: order._id,
                referenceModel: 'SalesOrder',
                performedBy: req.user._id,
                notes: `Inventory restored due to order ${order.orderNumber} update - quantity decreased by ${Math.abs(quantityChange)}`
              });
            }
          }
        }

        // Handle removed items (items that were in old but not in new)
        for (const oldItem of oldItems) {
          const oldProductId = oldItem.product?._id ? oldItem.product._id.toString() : oldItem.product?.toString() || oldItem.product;
          const stillExists = req.body.items.find(newItem => {
            const newProductId = newItem.product?.toString() || newItem.product;
            return oldProductId === newProductId;
          });
          if (!stillExists) {
            // Item was removed - restore inventory
            await inventoryService.updateStock({
              productId: oldItem.product?._id || oldItem.product,
              type: 'in',
              quantity: oldItem.quantity,
              reason: 'Order Update - Item Removed',
              reference: 'Sales Order',
              referenceId: order._id,
              referenceModel: 'SalesOrder',
              performedBy: req.user._id,
              notes: `Inventory restored due to order ${order.orderNumber} update - item removed`
            });
          }
        }
      } catch (error) {
        console.error('Error adjusting inventory on order update:', error);
        // Don't fail update if inventory adjustment fails
      }
    }

    // Adjust customer balance if total changed or customer changed
    if (order.customer && (order.pricing.total !== oldTotal || oldCustomer !== order.customer)) {
      try {
        const customer = await Customer.findById(order.customer);
        if (customer) {
          // Check if order was confirmed - balance may be in currentBalance instead of pendingBalance
          const wasConfirmed = order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered';

          // Calculate old balance that was added
          let oldBalanceAdded = 0;
          if (order.payment.isPartialPayment && order.payment.remainingBalance > 0) {
            oldBalanceAdded = order.payment.remainingBalance;
          } else if (order.payment.method === 'account' || order.payment.status === 'pending') {
            oldBalanceAdded = oldTotal;
          } else if (order.payment.status === 'partial') {
            oldBalanceAdded = oldTotal - order.payment.amountPaid;
          }

          // Calculate new balance that should be added
          let newBalanceToAdd = 0;
          if (order.payment.isPartialPayment && order.payment.remainingBalance > 0) {
            newBalanceToAdd = order.payment.remainingBalance;
          } else if (order.payment.method === 'account' || order.payment.status === 'pending') {
            newBalanceToAdd = order.pricing.total;
          } else if (order.payment.status === 'partial') {
            newBalanceToAdd = order.pricing.total - order.payment.amountPaid;
          }

          // Calculate difference
          const balanceDifference = newBalanceToAdd - oldBalanceAdded;

          if (balanceDifference !== 0) {
            let balanceUpdate = {};

            if (wasConfirmed) {
              // Order was confirmed - balance is in currentBalance
              balanceUpdate = { currentBalance: balanceDifference };
            } else {
              // Order not confirmed - balance is in pendingBalance
              balanceUpdate = { pendingBalance: balanceDifference };
            }

            const updateResult = await Customer.findByIdAndUpdate(
              order.customer,
              { $inc: balanceUpdate },
              { new: true }
            );
          }

          // If customer changed, remove balance from old customer
          if (oldCustomer && oldCustomer.toString() !== order.customer.toString()) {
            if (oldBalanceAdded > 0) {
              // Need to check if old order was confirmed to know which balance field to adjust
              // For simplicity, we'll check current order status (assuming status wasn't changed)
              const oldWasConfirmed = wasConfirmed; // Same status assumption
              let oldBalanceUpdate = {};
              if (oldWasConfirmed) {
                oldBalanceUpdate = { currentBalance: -oldBalanceAdded };
              } else {
                oldBalanceUpdate = { pendingBalance: -oldBalanceAdded };
              }

              await Customer.findByIdAndUpdate(
                oldCustomer,
                { $inc: oldBalanceUpdate },
                { new: true }
              );
            }
          }
        }
      } catch (error) {
        console.error('Error adjusting customer balance on order update:', error);
        // Don't fail update if balance adjustment fails
      }
    }

    // Populate order for response (include addresses for print)
    await order.populate([
      { path: 'customer', select: 'firstName lastName businessName email phone addresses currentBalance pendingBalance advanceBalance' },
      { path: 'items.product', select: 'name description pricing' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.json({
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/orders/:id/payment
// @desc    Process payment for order
// @access  Private
router.post('/:id/payment', [
  auth,
  requirePermission('edit_orders'),
  body('method').isIn(['cash', 'credit_card', 'debit_card', 'check', 'account']).withMessage('Invalid payment method'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('reference').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const order = await Sales.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const { method, amount, reference } = req.body;
    const remainingBalance = order.pricing.total - order.payment.amountPaid;

    // Allow overpayments - excess will be tracked in advanceBalance
    // Removed the check that prevented overpayments

    // Add transaction
    order.payment.transactions.push({
      method,
      amount,
      reference,
      timestamp: new Date()
    });

    // Update payment status
    const previousPaidAmount = order.payment.amountPaid;
    order.payment.amountPaid += amount;
    const newRemainingBalance = order.pricing.total - order.payment.amountPaid;

    if (order.payment.amountPaid >= order.pricing.total) {
      order.payment.status = 'paid';
    } else {
      order.payment.status = 'partial';
    }

    await order.save();

    // Update customer balance: record payment using CustomerBalanceService
    // This properly handles overpayments by adding excess to advanceBalance
    if (order.customer && amount > 0) {
      try {
        const CustomerBalanceService = require('../services/customerBalanceService');
        await CustomerBalanceService.recordPayment(order.customer, amount, order._id);

        const Customer = require('../models/Customer');
        const updatedCustomer = await Customer.findById(order.customer);
      } catch (error) {
        console.error('Error updating customer balance on payment:', error);
        // Don't fail the payment if customer update fails
      }
    }

    res.json({
      message: 'Payment processed successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        payment: order.payment
      }
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/orders/:id
// @desc    Delete order
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_orders')
], async (req, res) => {
  try {
    const order = await Sales.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order can be deleted (allow deletion of orders that haven't been delivered)
    // Business rule: Can delete orders until they're shipped/delivered
    const nonDeletableStatuses = ['shipped', 'delivered'];
    if (nonDeletableStatuses.includes(order.status)) {
      return res.status(400).json({
        message: `Cannot delete order with status: ${order.status}. Orders that have been shipped or delivered cannot be deleted.`
      });
    }

    // Update customer balance - reverse invoice total and payment
    // This matches the new logic in sales order creation
    if (order.customer && order.pricing && order.pricing.total > 0) {
      try {
        const CustomerBalanceService = require('../services/customerBalanceService');
        const Customer = require('../models/Customer');
        const customerExists = await Customer.findById(order.customer);

        if (customerExists) {
          const amountPaid = order.payment?.amountPaid || 0;

          // Reverse payment first: restore pendingBalance, remove from advanceBalance
          if (amountPaid > 0) {
            const pendingRestored = Math.min(amountPaid, order.pricing.total);
            const advanceToRemove = Math.max(0, amountPaid - order.pricing.total);

            await Customer.findByIdAndUpdate(
              order.customer,
              {
                $inc: {
                  pendingBalance: pendingRestored,
                  advanceBalance: -advanceToRemove
                }
              },
              { new: true }
            );
          }

          // Remove invoice total from pendingBalance
          const updateResult = await Customer.findByIdAndUpdate(
            order.customer,
            { $inc: { pendingBalance: -order.pricing.total } },
            { new: true }
          );
        } else {
        }
      } catch (error) {
        console.error('Error rolling back customer balance:', error);
        // Continue with deletion even if customer update fails
      }
    }

    // Restore inventory for items in the order using inventoryService for audit trail
    try {
      const inventoryService = require('../services/inventoryService');
      for (const item of order.items) {
        try {
          await inventoryService.updateStock({
            productId: item.product,
            type: 'in',
            quantity: item.quantity,
            reason: 'Order Deletion',
            reference: 'Sales Order',
            referenceId: order._id,
            referenceModel: 'SalesOrder',
            performedBy: req.user._id,
            notes: `Inventory restored due to deletion of order ${order.orderNumber}`
          });
        } catch (error) {
          console.error(`Failed to restore inventory for product ${item.product}:`, error);
          // Continue with other items
        }
      }
    } catch (error) {
      console.error('Error restoring inventory on order deletion:', error);
      // Don't fail deletion if inventory update fails
    }

    await Sales.findByIdAndDelete(req.params.id);

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/today/summary
// @desc    Get today's order summary
// @access  Private
router.get('/today/summary', [
  auth
], async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const orders = await salesRepository.findByDateRange(startOfDay, endOfDay, { lean: true });

    const summary = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.pricing.total, 0),
      totalItems: orders.reduce((sum, order) =>
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
      averageOrderValue: orders.length > 0 ?
        orders.reduce((sum, order) => sum + order.pricing.total, 0) / orders.length : 0,
      orderTypes: {
        retail: orders.filter(o => o.orderType === 'retail').length,
        wholesale: orders.filter(o => o.orderType === 'wholesale').length,
        return: orders.filter(o => o.orderType === 'return').length,
        exchange: orders.filter(o => o.orderType === 'exchange').length
      },
      paymentMethods: orders.reduce((acc, order) => {
        acc[order.payment.method] = (acc[order.payment.method] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({ summary });
  } catch (error) {
    console.error('Get today summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/orders/period/summary
// @desc    Get period summary for comparisons
// @access  Private
router.get('/period/summary', [
  auth,
  query('dateFrom').isISO8601().withMessage('Invalid start date'),
  query('dateTo').isISO8601().withMessage('Invalid end date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const dateFrom = new Date(req.query.dateFrom);
    dateFrom.setHours(0, 0, 0, 0);
    const dateTo = new Date(req.query.dateTo);
    dateTo.setDate(dateTo.getDate() + 1);
    dateTo.setHours(0, 0, 0, 0);

    const orders = await Sales.find({
      createdAt: { $gte: dateFrom, $lt: dateTo }
    });

    const totalRevenue = orders.reduce((sum, order) => sum + (order.pricing?.total || 0), 0);
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) =>
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate discounts
    const totalDiscounts = orders.reduce((sum, order) =>
      sum + (order.pricing?.discountAmount || 0), 0);

    // Calculate by order type
    const revenueByType = {
      retail: orders.filter(o => o.orderType === 'retail')
        .reduce((sum, order) => sum + (order.pricing?.total || 0), 0),
      wholesale: orders.filter(o => o.orderType === 'wholesale')
        .reduce((sum, order) => sum + (order.pricing?.total || 0), 0)
    };

    const summary = {
      total: totalRevenue,
      totalRevenue,
      totalOrders,
      totalItems,
      averageOrderValue,
      totalDiscounts,
      netRevenue: totalRevenue - totalDiscounts,
      revenueByType,
      period: {
        start: req.query.dateFrom,
        end: req.query.dateTo
      }
    };

    res.json({ data: summary });
  } catch (error) {
    console.error('Get period summary error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/orders/export/excel
// @desc    Export orders to Excel
// @access  Private
router.post('/export/excel', [auth, requirePermission('view_orders')], async (req, res) => {
  try {
    const { filters = {} } = req.body;

    // Build query based on filters
    const filter = {};

    if (filters.search) {
      filter.$or = [
        { orderNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.paymentStatus) {
      filter['payment.status'] = filters.paymentStatus;
    }

    if (filters.orderType) {
      filter.orderType = filters.orderType;
    }

    if (filters.customer) {
      filter.customer = filters.customer;
    }

    if (filters.dateFrom || filters.dateTo) {
      filter.createdAt = {};
      if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = dateFrom;
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setDate(dateTo.getDate() + 1);
        dateTo.setHours(0, 0, 0, 0);
        filter.createdAt.$lt = dateTo;
      }
    }

    const orders = await Sales.find(filter)
      .populate('customer', 'businessName name firstName lastName email phone addresses')
      .populate('items.product', 'name')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    // Prepare Excel data
    const excelData = orders.map(order => {
      const customerName = order.customer?.businessName ||
        order.customer?.name ||
        `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
        'Walk-in Customer';

      const itemsSummary = order.items?.map(item =>
        `${item.product?.name || 'Unknown'}: ${item.quantity} x $${item.unitPrice}`
      ).join('; ') || 'No items';

      return {
        'Order Number': order.orderNumber || '',
        'Customer': customerName,
        'Customer Email': order.customer?.email || '',
        'Customer Phone': order.customer?.phone || '',
        'Order Type': order.orderType || '',
        'Status': order.status || '',
        'Payment Status': order.payment?.status || '',
        'Payment Method': order.payment?.method || '',
        'Order Date': order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : '',
        'Subtotal': order.pricing?.subtotal || 0,
        'Discount': order.pricing?.discountAmount || 0,
        'Tax': order.pricing?.taxAmount || 0,
        'Total': order.pricing?.total || 0,
        'Amount Paid': order.payment?.amountPaid || 0,
        'Remaining Balance': order.payment?.remainingBalance || 0,
        'Items Count': order.items?.length || 0,
        'Items Summary': itemsSummary,
        'Tax Exempt': order.pricing?.isTaxExempt ? 'Yes' : 'No',
        'Notes': order.notes || '',
        'Created By': order.createdBy ? `${order.createdBy.firstName || ''} ${order.createdBy.lastName || ''}`.trim() : '',
        'Created Date': order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : ''
      };
    });

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 15 }, // Order Number
      { wch: 25 }, // Customer
      { wch: 25 }, // Customer Email
      { wch: 15 }, // Customer Phone
      { wch: 12 }, // Order Type
      { wch: 15 }, // Status
      { wch: 15 }, // Payment Status
      { wch: 15 }, // Payment Method
      { wch: 12 }, // Order Date
      { wch: 12 }, // Subtotal
      { wch: 12 }, // Discount
      { wch: 10 }, // Tax
      { wch: 12 }, // Total
      { wch: 12 }, // Amount Paid
      { wch: 15 }, // Remaining Balance
      { wch: 10 }, // Items Count
      { wch: 50 }, // Items Summary
      { wch: 10 }, // Tax Exempt
      { wch: 30 }, // Notes
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
    const filename = `sales_${timestamp}.xlsx`;
    const filepath = path.join(exportsDir, filename);

    XLSX.writeFile(workbook, filepath);

    res.json({
      message: 'Orders exported successfully',
      filename: filename,
      recordCount: excelData.length,
      downloadUrl: `/api/orders/download/${filename}`
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

// @route   POST /api/orders/export/csv
// @desc    Export orders to CSV
// @access  Private
router.post('/export/csv', [auth, requirePermission('view_orders')], async (req, res) => {
  try {
    const { filters = {} } = req.body;

    // Build query based on filters (same as Excel export)
    const filter = {};

    if (filters.search) {
      filter.$or = [
        { orderNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.paymentStatus) {
      filter['payment.status'] = filters.paymentStatus;
    }

    if (filters.orderType) {
      filter.orderType = filters.orderType;
    }

    if (filters.customer) {
      filter.customer = filters.customer;
    }

    if (filters.dateFrom || filters.dateTo) {
      filter.createdAt = {};
      if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = dateFrom;
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setDate(dateTo.getDate() + 1);
        dateTo.setHours(0, 0, 0, 0);
        filter.createdAt.$lt = dateTo;
      }
    }

    const orders = await Sales.find(filter)
      .populate('customer', 'businessName name firstName lastName email phone addresses')
      .populate('items.product', 'name')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    // Prepare CSV data
    const csvData = orders.map(order => {
      const customerName = order.customer?.businessName ||
        order.customer?.name ||
        `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
        'Walk-in Customer';

      const itemsSummary = order.items?.map(item =>
        `${item.product?.name || 'Unknown'}: ${item.quantity} x $${item.unitPrice}`
      ).join('; ') || 'No items';

      return {
        'Order Number': order.orderNumber || '',
        'Customer': customerName,
        'Customer Email': order.customer?.email || '',
        'Customer Phone': order.customer?.phone || '',
        'Order Type': order.orderType || '',
        'Status': order.status || '',
        'Payment Status': order.payment?.status || '',
        'Payment Method': order.payment?.method || '',
        'Order Date': order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : '',
        'Subtotal': order.pricing?.subtotal || 0,
        'Discount': order.pricing?.discountAmount || 0,
        'Tax': order.pricing?.taxAmount || 0,
        'Total': order.pricing?.total || 0,
        'Amount Paid': order.payment?.amountPaid || 0,
        'Remaining Balance': order.payment?.remainingBalance || 0,
        'Items Count': order.items?.length || 0,
        'Items Summary': itemsSummary,
        'Tax Exempt': order.pricing?.isTaxExempt ? 'Yes' : 'No',
        'Notes': order.notes || '',
        'Created By': order.createdBy ? `${order.createdBy.firstName || ''} ${order.createdBy.lastName || ''}`.trim() : '',
        'Created Date': order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : ''
      };
    });

    // Create CSV workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(csvData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Orders');

    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `sales_${timestamp}.csv`;
    const filepath = path.join(exportsDir, filename);

    // Write CSV file
    XLSX.writeFile(workbook, filepath);

    res.json({
      message: 'Orders exported successfully',
      filename: filename,
      recordCount: csvData.length,
      downloadUrl: `/api/orders/download/${filename}`
    });

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

// @route   POST /api/orders/export/pdf
// @desc    Export orders to PDF
// @access  Private
router.post('/export/pdf', [auth, requirePermission('view_orders')], async (req, res) => {
  try {
    const { filters = {} } = req.body;

    // Build query based on filters (same as Excel export)
    const filter = {};

    if (filters.search) {
      filter.$or = [
        { orderNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.paymentStatus) {
      filter['payment.status'] = filters.paymentStatus;
    }

    if (filters.orderType) {
      filter.orderType = filters.orderType;
    }

    if (filters.customer) {
      filter.customer = filters.customer;
    }

    if (filters.dateFrom || filters.dateTo) {
      filter.createdAt = {};
      if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = dateFrom;
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setDate(dateTo.getDate() + 1);
        dateTo.setHours(0, 0, 0, 0);
        filter.createdAt.$lt = dateTo;
      }
    }

    // Fetch customer name if customer filter is applied
    let customerName = null;
    if (filters.customer) {
      const customer = await Customer.findById(filters.customer).lean();
      if (customer) {
        customerName = customer.businessName ||
          customer.name ||
          `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
          'Unknown Customer';
      }
    }

    const orders = await Sales.find(filter)
      .populate('customer', 'businessName name firstName lastName email phone pendingBalance currentBalance addresses')
      .populate('items.product', 'name')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    // Get all customer IDs and order IDs for receipt lookup
    const customerIds = [...new Set(orders.map(o => o.customer?._id).filter(Boolean))];
    const orderIds = orders.map(o => o._id);

    // Build date filter for receipts (use same date range as orders if provided)
    const receiptDateFilter = {};
    if (filters.dateFrom || filters.dateTo) {
      receiptDateFilter.date = {};
      if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        receiptDateFilter.date.$gte = dateFrom;
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setDate(dateTo.getDate() + 1);
        dateTo.setHours(0, 0, 0, 0);
        receiptDateFilter.date.$lt = dateTo;
      }
    }

    // Fetch cash receipts linked to orders or customers in the date range
    const cashReceiptFilter = {
      ...receiptDateFilter,
      status: 'confirmed',
      $or: [
        { order: { $in: orderIds } },
        ...(customerIds.length > 0 ? [{ customer: { $in: customerIds } }] : [])
      ]
    };
    const cashReceipts = await CashReceipt.find(cashReceiptFilter)
      .select('order customer voucherCode amount date paymentMethod')
      .lean();

    // Fetch bank receipts linked to orders or customers in the date range
    const bankReceiptFilter = {
      ...receiptDateFilter,
      status: 'confirmed',
      $or: [
        { order: { $in: orderIds } },
        ...(customerIds.length > 0 ? [{ customer: { $in: customerIds } }] : [])
      ]
    };
    const bankReceipts = await BankReceipt.find(bankReceiptFilter)
      .select('order customer voucherCode amount date transactionReference')
      .lean();

    // Create maps for quick lookup: orderId -> receipts, customerId -> receipts
    const receiptsByOrder = {};
    const receiptsByCustomer = {};

    [...cashReceipts, ...bankReceipts].forEach(receipt => {
      const receiptInfo = {
        type: receipt.voucherCode?.startsWith('CR-') ? 'Cash' : 'Bank',
        voucherCode: receipt.voucherCode || 'N/A',
        amount: receipt.amount || 0,
        date: receipt.date,
        method: receipt.paymentMethod || (receipt.transactionReference ? 'Bank Transfer' : 'N/A')
      };

      if (receipt.order) {
        const orderId = receipt.order.toString();
        if (!receiptsByOrder[orderId]) {
          receiptsByOrder[orderId] = [];
        }
        receiptsByOrder[orderId].push(receiptInfo);
      }

      if (receipt.customer) {
        const customerId = receipt.customer.toString();
        if (!receiptsByCustomer[customerId]) {
          receiptsByCustomer[customerId] = [];
        }
        receiptsByCustomer[customerId].push(receiptInfo);
      }
    });

    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `sales_${timestamp}.pdf`;
    const filepath = path.join(exportsDir, filename);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Helper function to format currency
    const formatCurrency = (amount) => {
      return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Helper function to format date as DD/MM/YYYY
    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('SALES REPORT', { align: 'center' });
    doc.moveDown(0.5);

    // Customer name (if filtered by customer)
    if (customerName) {
      doc.fontSize(14).font('Helvetica-Bold').text(`Customer: ${customerName}`, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Report date range (only show if date filters are applied)
    if (filters.dateFrom || filters.dateTo) {
      const dateRange = `Period: ${filters.dateFrom ? formatDate(filters.dateFrom) : 'All'} - ${filters.dateTo ? formatDate(filters.dateTo) : 'All'}`;
      doc.fontSize(12).font('Helvetica').text(dateRange, { align: 'center' });
      doc.moveDown(0.5);
    }

    doc.moveDown(1);

    // Summary section
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + (order.pricing?.total || 0), 0);
    const statusCounts = {};
    const paymentStatusCounts = {};
    const orderTypeCounts = {};
    let totalItems = 0;
    let earliestDate = null;
    let latestDate = null;

    orders.forEach(order => {
      // Status breakdown
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;

      // Payment status breakdown
      const paymentStatus = order.payment?.status || 'pending';
      paymentStatusCounts[paymentStatus] = (paymentStatusCounts[paymentStatus] || 0) + 1;

      // Order type breakdown
      if (order.orderType) {
        orderTypeCounts[order.orderType] = (orderTypeCounts[order.orderType] || 0) + 1;
      }

      // Total items
      if (order.items && Array.isArray(order.items)) {
        totalItems += order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      }

      // Date range
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        if (!earliestDate || orderDate < earliestDate) {
          earliestDate = orderDate;
        }
        if (!latestDate || orderDate > latestDate) {
          latestDate = orderDate;
        }
      }
    });

    const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

    // Summary section with three columns (similar to invoice format)
    const leftColumnX = 50;
    const middleColumnX = 220;
    const rightColumnX = 390;
    const columnWidth = 160; // Width for each column
    const lineHeight = 16; // Consistent line height
    const headerLineYOffset = 12; // Offset for header separator line

    doc.fontSize(11).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown(0.5);

    // Start all columns at the same Y position
    const startY = doc.y;
    let leftY = startY;
    let middleY = startY;
    let rightY = startY;

    // Left column - Order Summary
    doc.fontSize(10).font('Helvetica-Bold').text('Order Summary:', leftColumnX, leftY);
    // Draw separator line under header
    doc.moveTo(leftColumnX, leftY + headerLineYOffset).lineTo(leftColumnX + columnWidth, leftY + headerLineYOffset).stroke({ color: '#cccccc', width: 0.5 });
    leftY += lineHeight + 3;

    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Amount: ${formatCurrency(totalAmount)}`, leftColumnX, leftY);
    leftY += lineHeight;
    doc.text(`Total Items: ${totalItems}`, leftColumnX, leftY);
    leftY += lineHeight;
    doc.text(`Avg Order Value: ${formatCurrency(averageOrderValue)}`, leftColumnX, leftY);
    leftY += lineHeight;

    // Middle column - Status Details
    doc.fontSize(10).font('Helvetica-Bold').text('Status Details:', middleColumnX, middleY);
    // Draw separator line under header
    doc.moveTo(middleColumnX, middleY + headerLineYOffset).lineTo(middleColumnX + columnWidth, middleY + headerLineYOffset).stroke({ color: '#cccccc', width: 0.5 });
    middleY += lineHeight + 3;

    doc.fontSize(10).font('Helvetica');
    if (Object.keys(statusCounts).length > 0) {
      Object.entries(statusCounts).forEach(([status, count]) => {
        doc.text(`${status.charAt(0).toUpperCase() + status.slice(1)}: ${count}`, middleColumnX, middleY);
        middleY += lineHeight;
      });
    }

    // Right column - Payment & Types
    doc.fontSize(10).font('Helvetica-Bold').text('Payment & Types:', rightColumnX, rightY);
    // Draw separator line under header
    doc.moveTo(rightColumnX, rightY + headerLineYOffset).lineTo(rightColumnX + columnWidth, rightY + headerLineYOffset).stroke({ color: '#cccccc', width: 0.5 });
    rightY += lineHeight + 3;

    doc.fontSize(10).font('Helvetica');
    if (Object.keys(paymentStatusCounts).length > 0) {
      Object.entries(paymentStatusCounts).forEach(([status, count]) => {
        doc.text(`${status.charAt(0).toUpperCase() + status.slice(1)}: ${count}`, rightColumnX, rightY);
        rightY += lineHeight;
      });
    }

    if (Object.keys(orderTypeCounts).length > 0) {
      rightY += 3;
      Object.entries(orderTypeCounts).forEach(([type, count]) => {
        doc.text(`${type.charAt(0).toUpperCase() + type.slice(1)}: ${count}`, rightColumnX, rightY);
        rightY += lineHeight;
      });
    }

    // Move to the lower of all three columns
    const finalY = Math.max(leftY, Math.max(middleY, rightY));
    doc.y = finalY;
    doc.moveDown(1);

    // Table setup
    const tableTop = doc.y;
    const leftMargin = 50;
    const pageWidth = 550;

    // Adjust column widths based on whether customer filter is applied
    const showCustomerColumn = !customerName; // Only show customer column if no customer filter
    const availableWidth = pageWidth - leftMargin; // Total available width for columns

    const colWidths = showCustomerColumn ? {
      sno: 25,           // Serial number column
      orderNumber: 85,
      customer: 95,
      date: 60,
      status: 50,
      total: 60,
      items: 40,
      balance: 65,       // Customer Balance column
      receipts: 90       // Receipts column
    } : {
      sno: 25,           // Serial number column
      orderNumber: 95,   // Adjusted to fit within page
      date: 65,          // Adjusted to fit within page
      status: 50,        // Adjusted to fit within page
      total: 65,         // Adjusted to fit within page
      items: 45,         // Adjusted to fit within page, right-aligned
      balance: 65,       // Customer Balance column
      receipts: 105      // Receipts column
    };

    // Verify total width doesn't exceed available space
    const totalWidth = Object.values(colWidths).reduce((sum, width) => sum + width, 0);
    if (totalWidth > availableWidth) {
      // Scale down proportionally if needed
      const scale = availableWidth / totalWidth;
      Object.keys(colWidths).forEach(key => {
        colWidths[key] = Math.floor(colWidths[key] * scale);
      });
    }

    // Table headers
    doc.fontSize(10).font('Helvetica-Bold');
    let xPos = leftMargin;
    doc.text('SNO', xPos, tableTop, { width: colWidths.sno, align: 'center' });
    xPos += colWidths.sno;
    doc.text('Date', xPos, tableTop);
    xPos += colWidths.date;
    doc.text('Order #', xPos, tableTop);
    xPos += colWidths.orderNumber;
    if (showCustomerColumn) {
      doc.text('Customer', xPos, tableTop);
      xPos += colWidths.customer;
    }
    doc.text('Status', xPos, tableTop);
    xPos += colWidths.status;
    // Total header - right-aligned to match data
    doc.text('Total', xPos, tableTop, { width: colWidths.total, align: 'right' });
    xPos += colWidths.total;
    // Items header - right-aligned to match data
    doc.text('Items', xPos, tableTop, { width: colWidths.items, align: 'right' });
    xPos += colWidths.items;
    // Customer Balance header - right-aligned
    doc.text('Balance', xPos, tableTop, { width: colWidths.balance, align: 'right' });
    xPos += colWidths.balance;
    // Add larger gap between Balance and Receipts columns to use available space
    xPos += 20;
    // Receipts header
    doc.text('Receipts', xPos, tableTop, { width: colWidths.receipts });

    // Draw header line
    doc.moveTo(leftMargin, tableTop + 15).lineTo(pageWidth, tableTop + 15).stroke();

    let currentY = tableTop + 25;
    const rowHeight = 20;
    const pageHeight = 750;
    let serialNumber = 1; // Track serial number across pages

    // Table rows
    orders.forEach((order, index) => {
      // Check if we need a new page
      if (currentY > pageHeight - 50) {
        doc.addPage();
        currentY = 50;

        // Redraw headers on new page
        doc.fontSize(10).font('Helvetica-Bold');
        xPos = leftMargin;
        doc.text('SNO', xPos, currentY, { width: colWidths.sno, align: 'center' });
        xPos += colWidths.sno;
        doc.text('Date', xPos, currentY);
        xPos += colWidths.date;
        doc.text('Order #', xPos, currentY);
        xPos += colWidths.orderNumber;
        if (showCustomerColumn) {
          doc.text('Customer', xPos, currentY);
          xPos += colWidths.customer;
        }
        doc.text('Status', xPos, currentY);
        xPos += colWidths.status;
        // Total header - right-aligned to match data
        doc.text('Total', xPos, currentY, { width: colWidths.total, align: 'right' });
        xPos += colWidths.total;
        // Items header - right-aligned to match data
        doc.text('Items', xPos, currentY, { width: colWidths.items, align: 'right' });
        xPos += colWidths.items;
        // Customer Balance header - right-aligned
        doc.text('Balance', xPos, currentY, { width: colWidths.balance, align: 'right' });
        xPos += colWidths.balance;
        // Add larger gap between Balance and Receipts columns to use available space
        xPos += 20;
        // Receipts header
        doc.text('Receipts', xPos, currentY, { width: colWidths.receipts });

        doc.moveTo(leftMargin, currentY + 15).lineTo(pageWidth, currentY + 15).stroke();
        currentY += 25;
      }

      const statusText = order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'N/A';
      const itemsCount = order.items?.length || 0;

      // Get customer balance
      const customerBalance = order.customer
        ? ((order.customer.pendingBalance || 0) + (order.customer.currentBalance || 0))
        : 0;

      // Get receipts for this order
      const orderIdStr = order._id.toString();
      const orderReceipts = receiptsByOrder[orderIdStr] || [];

      // Also get receipts for customer if no order-specific receipts
      let customerReceipts = [];
      if (orderReceipts.length === 0 && order.customer) {
        const customerIdStr = order.customer._id.toString();
        customerReceipts = receiptsByCustomer[customerIdStr] || [];
      }

      // Also include direct payment from invoice
      const directPayment = order.payment?.amountPaid || 0;
      const allReceipts = [...orderReceipts, ...customerReceipts];
      if (directPayment > 0) {
        allReceipts.push({
          type: 'Invoice',
          voucherCode: order.orderNumber || 'N/A',
          amount: directPayment,
          date: order.createdAt,
          method: order.payment?.method || 'N/A'
        });
      }

      // Format receipts text - very compact format to avoid overflow
      let receiptsText = '-';
      if (allReceipts.length > 0) {
        // Calculate total receipt amount
        const totalReceiptAmount = allReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);

        // Show summary: count and total amount
        const receiptCount = allReceipts.length;
        const receiptTypes = [...new Set(allReceipts.map(r => r.type === 'Cash' ? 'C' : r.type === 'Bank' ? 'B' : 'I'))];
        const typeSummary = receiptTypes.join('/');

        // Format: TypeCount:TotalAmount (e.g., "C2/B1: $1,500.00")
        receiptsText = `${typeSummary}${receiptCount}: ${formatCurrency(totalReceiptAmount)}`;

        // If text is still too long, truncate further
        if (receiptsText.length > 25) {
          receiptsText = `${receiptCount} rec: ${formatCurrency(totalReceiptAmount)}`;
        }
      }

      doc.fontSize(9).font('Helvetica');
      xPos = leftMargin;
      // Serial number - centered
      doc.text(serialNumber.toString(), xPos, currentY, {
        width: colWidths.sno,
        align: 'center'
      });
      xPos += colWidths.sno;
      serialNumber++; // Increment for next row
      // Date - before Order #
      doc.text(formatDate(order.createdAt), xPos, currentY, {
        width: colWidths.date
      });
      xPos += colWidths.date;
      // Order number - prevent wrapping, use ellipsis if too long
      const orderNum = order.orderNumber || 'N/A';
      doc.text(orderNum, xPos, currentY, {
        width: colWidths.orderNumber,
        ellipsis: true
      });
      xPos += colWidths.orderNumber;
      // Customer name - only show if no customer filter is applied
      if (showCustomerColumn) {
        const orderCustomerName = order.customer?.businessName ||
          order.customer?.name ||
          `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
          'Walk-in Customer';
        doc.text(orderCustomerName.substring(0, 20), xPos, currentY, {
          width: colWidths.customer,
          ellipsis: true
        });
        xPos += colWidths.customer;
      }
      doc.text(statusText, xPos, currentY, {
        width: colWidths.status
      });
      xPos += colWidths.status;
      doc.text(formatCurrency(order.pricing?.total || 0), xPos, currentY, {
        width: colWidths.total,
        align: 'right'
      });
      xPos += colWidths.total;
      doc.text(itemsCount.toString(), xPos, currentY, {
        width: colWidths.items,
        align: 'right'
      });
      xPos += colWidths.items;
      // Customer Balance - right-aligned
      doc.text(formatCurrency(customerBalance), xPos, currentY, {
        width: colWidths.balance,
        align: 'right'
      });
      xPos += colWidths.balance;
      // Add larger gap between Balance and Receipts columns to use available space
      xPos += 20;
      // Receipts - use smaller font and compact format
      doc.fontSize(8).text(receiptsText, xPos, currentY, {
        width: colWidths.receipts,
        ellipsis: true
      });
      doc.fontSize(9); // Reset font size

      // Draw row line
      doc.moveTo(leftMargin, currentY + 12).lineTo(pageWidth, currentY + 12).stroke({ color: '#cccccc', width: 0.5 });

      currentY += rowHeight;
    });

    // Footer - Center aligned (same line format like invoice)
    currentY += 20;
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 50;
    }

    doc.moveDown(2);
    let footerText = `Generated on: ${formatDate(new Date())}`;
    if (req.user) {
      const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
      if (userName) {
        footerText += ` | Generated by: ${userName}`;
      }
    }
    // Center the footer text by using the full page width
    const footerX = leftMargin;
    const footerWidth = pageWidth - leftMargin;
    doc.fontSize(9).font('Helvetica').text(footerText, footerX, doc.y, {
      width: footerWidth,
      align: 'center'
    });

    // Add date range below if available
    if (earliestDate && latestDate) {
      doc.moveDown(0.3);
      const dateRangeText = `Date Range: ${formatDate(earliestDate)} ${formatDate(latestDate)}`;
      doc.fontSize(9).font('Helvetica').text(dateRangeText, footerX, doc.y, {
        width: footerWidth,
        align: 'center'
      });
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
      message: 'Orders exported successfully',
      filename: filename,
      recordCount: orders.length,
      downloadUrl: `/api/orders/download/${filename}`
    });

  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

// @route   POST /api/orders/export/json
// @desc    Export orders to JSON
// @access  Private
router.post('/export/json', [auth, requirePermission('view_orders')], async (req, res) => {
  try {
    const { filters = {} } = req.body;

    // Build query based on filters (same as Excel export)
    const filter = {};

    if (filters.search) {
      filter.$or = [
        { orderNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.paymentStatus) {
      filter['payment.status'] = filters.paymentStatus;
    }

    if (filters.orderType) {
      filter.orderType = filters.orderType;
    }

    if (filters.customer) {
      filter.customer = filters.customer;
    }

    if (filters.dateFrom || filters.dateTo) {
      filter.createdAt = {};
      if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = dateFrom;
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setDate(dateTo.getDate() + 1);
        dateTo.setHours(0, 0, 0, 0);
        filter.createdAt.$lt = dateTo;
      }
    }

    const orders = await Sales.find(filter)
      .populate('customer', 'businessName name firstName lastName email phone addresses')
      .populate('items.product', 'name')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `sales_${timestamp}.json`;
    const filepath = path.join(exportsDir, filename);

    // Write JSON file
    fs.writeFileSync(filepath, JSON.stringify(orders, null, 2), 'utf8');

    res.json({
      message: 'Orders exported successfully',
      filename: filename,
      recordCount: orders.length,
      downloadUrl: `/api/orders/download/${filename}`
    });

  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

// @route   GET /api/orders/download/:filename
// @desc    Download exported file
// @access  Private
router.get('/download/:filename', [auth, requirePermission('view_orders')], async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(__dirname, '../exports', filename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    let disposition = 'attachment';

    if (ext === '.pdf') {
      contentType = 'application/pdf';
      // For PDF, check if we should show inline
      if (req.query.view === 'inline' || req.headers.accept?.includes('application/pdf')) {
        disposition = 'inline';
      }
    } else if (ext === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (ext === '.csv') {
      contentType = 'text/csv';
    } else if (ext === '.json') {
      contentType = 'application/json';
    }

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

    // For PDF inline viewing, we need Content-Length
    if (ext === '.pdf' && disposition === 'inline') {
      const stats = fs.statSync(filepath);
      res.setHeader('Content-Length', stats.size);
    }

    // Stream the file
    const stream = fs.createReadStream(filepath);
    stream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Download failed', error: error.message });
  }
});

module.exports = router;
