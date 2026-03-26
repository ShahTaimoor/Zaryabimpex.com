const express = require('express');
const { body, validationResult, query } = require('express-validator');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const StockMovementService = require('../services/stockMovementService');
const salesService = require('../services/salesService');
const AccountingService = require('../services/accountingService');
const profitDistributionService = require('../services/profitDistributionService');
const salesRepository = require('../repositories/SalesRepository');
const productRepository = require('../repositories/ProductRepository');
const inventoryRepository = require('../repositories/postgres/InventoryRepository');
const productVariantRepository = require('../repositories/ProductVariantRepository');
const customerRepository = require('../repositories/CustomerRepository');
const cashReceiptRepository = require('../repositories/postgres/CashReceiptRepository');
const bankReceiptRepository = require('../repositories/postgres/BankReceiptRepository');

/** Check if order can be cancelled (works with plain order object from repo). */
function canBeCancelled(order) {
  const status = order?.status;
  return status === 'pending' || status === 'confirmed';
}
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
  query('customerId').optional().isUUID(4)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build Postgres filter (CCTV columns not in sales table; filter by date/customer)
    const filters = {};
    if (req.query.dateFrom) {
      filters.dateFrom = new Date(req.query.dateFrom);
      filters.dateFrom.setHours(0, 0, 0, 0);
    }
    if (req.query.dateTo) {
      filters.dateTo = new Date(req.query.dateTo);
      filters.dateTo.setHours(23, 59, 59, 999);
    }
    if (req.query.orderNumber) filters.orderNumber = req.query.orderNumber;
    if (req.query.customerId) filters.customerId = req.query.customerId;

    const result = await salesRepository.findWithPagination(filters, {
      page,
      limit,
      sort: 'created_at DESC'
    });
    const orders = result.sales || [];
    const total = result.pagination?.total ?? orders.length;

    // Attach customer for each order
    for (const order of orders) {
      if (order.customer_id) {
        order.customer = await customerRepository.findById(order.customer_id);
      }
    }

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

    const raw = await salesRepository.findByDateRange(dateFrom, dateTo);
    const orders = Array.isArray(raw) ? raw : [];
    const totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0);
    const totalOrders = orders.length;
    const itemsArr = (o) => (o && Array.isArray(o.items) ? o.items : []);
    const totalItems = orders.reduce((sum, order) =>
      sum + itemsArr(order).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalDiscounts = orders.reduce((sum, order) => sum + (parseFloat(order?.discount) || 0), 0);
    const revenueByType = {
      retail: orders.filter(o => o && o.order_type === 'retail').reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0),
      wholesale: orders.filter(o => o && o.order_type === 'wholesale').reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0)
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
      period: { start: req.query.dateFrom, end: req.query.dateTo }
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
  body('customer').optional().isUUID(4).withMessage('Invalid customer ID'),
  body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
  body('items.*.product').isUUID(4).withMessage('Invalid product ID'),
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

    const { customer, items, orderType, payment, notes, isTaxExempt, billDate, appliedDiscounts, discountAmount, subtotal, total, tax } = req.body;

    // Use SalesService to create the sale (invoice); appliedDiscounts/discountAmount from POS discount codes
    const savedOrder = await salesService.createSale(
      {
        customer,
        items,
        orderType,
        payment,
        notes,
        isTaxExempt,
        billDate,
        billStartTime,
        appliedDiscounts,
        discountAmount,
        subtotal,
        total,
        tax
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

// @route   POST /api/sales/post-missing-to-ledger
// @desc    Backfill account ledger: post any sales/invoices that were never recorded to the ledger (e.g. created before the fix).
// @access  Private
router.post('/post-missing-to-ledger', auth, requirePermission('view_reports'), async (req, res) => {
  try {
    const dateFrom = req.query.dateFrom || req.body?.dateFrom;
    const dateTo = req.query.dateTo || req.body?.dateTo;
    const result = await salesService.postMissingSalesToLedger({ dateFrom, dateTo });
    return res.json({
      success: true,
      message: `Posted ${result.posted} sale(s) to the ledger.${result.errors.length ? ` ${result.errors.length} failed.` : ''}`,
      ...result
    });
  } catch (error) {
    console.error('Post missing sales to ledger error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to post missing sales to ledger.' });
  }
});

// @route   POST /api/sales/sync-ledger
// @desc    Sync sales to ledger: update existing sale entries + post missing (fixes old edits not reflected).
// @access  Private
router.post('/sync-ledger', auth, requirePermission('view_reports'), async (req, res) => {
  try {
    const dateFrom = req.query.dateFrom || req.body?.dateFrom;
    const dateTo = req.query.dateTo || req.body?.dateTo;
    const result = await salesService.syncSalesLedger({ dateFrom, dateTo });
    return res.json({
      success: true,
      message: `Synced sales ledger. Updated ${result.updated}, posted ${result.posted}.` + (result.errors.length ? ` ${result.errors.length} failed.` : ''),
      ...result
    });
  } catch (error) {
    console.error('Sync sales ledger error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to sync sales ledger.' });
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

    const order = await salesRepository.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.body.status === 'cancelled' && !canBeCancelled(order)) {
      return res.status(400).json({
        message: 'Order cannot be cancelled in its current status'
      });
    }

    // If cancelling, restore inventory (Postgres: update product stock_quantity)
    if (req.body.status === 'cancelled' && Array.isArray(order.items)) {
      for (const item of order.items) {
        const productId = item.product_id || item.product;
        if (!productId) continue;
        const product = await productRepository.findById(productId);
        if (product) {
          const newStock = (parseFloat(product.stock_quantity) || 0) + (item.quantity || 0);
          await productRepository.update(productId, { stockQuantity: newStock });
        }
      }
    }

    await salesRepository.update(req.params.id, {
      status: req.body.status,
      updatedBy: req.user?.id || req.user?._id
    });
    const updatedOrder = await salesRepository.findById(req.params.id);

    res.json({
      message: 'Order status updated successfully',
      order: updatedOrder
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
  body('customer').optional().isUUID(4).withMessage('Valid customer is required'),
  body('orderType').optional().isIn(['retail', 'wholesale', 'return', 'exchange']).withMessage('Invalid order type'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes too long'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').optional().isUUID(4).withMessage('Valid product is required'),
  body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').optional().isFloat({ min: 0 }).withMessage('Unit price must be positive'),
  body('billDate').optional().isISO8601().withMessage('Valid bill date required (ISO 8601 format)'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be a non-negative number'),
  body('amountReceived').optional().isFloat({ min: 0 }).withMessage('Amount received must be a non-negative number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const order = await salesRepository.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow editing invoices from the last 1 month
    const saleDate = order.sale_date || order.saleDate || order.created_at || order.createdAt;
    if (saleDate) {
      const invoiceDate = new Date(saleDate);
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      oneMonthAgo.setHours(0, 0, 0, 0);
      invoiceDate.setHours(0, 0, 0, 0);
      if (invoiceDate < oneMonthAgo) {
        return res.status(403).json({
          message: 'Cannot edit sales invoice older than 1 month. Only invoices from the last 30 days can be edited.',
          code: 'EDIT_WINDOW_EXPIRED'
        });
      }
    }

    let customerData = null;
    if (req.body.customer) {
      customerData = await customerRepository.findById(req.body.customer);
      if (!customerData) {
        return res.status(400).json({ message: 'Customer not found' });
      }
    }

    // Normalize for Postgres: order has total, subtotal, discount, tax; items array
    const orderTotal = () => parseFloat(order.total) || 0;
    const orderPricing = { total: orderTotal(), subtotal: parseFloat(order.subtotal) || 0, discountAmount: parseFloat(order.discount) || 0, taxAmount: parseFloat(order.tax) || 0, isTaxExempt: false };
    if (!order.pricing) order.pricing = orderPricing;
    if (!order.payment) order.payment = { method: order.payment_method || 'cash', status: order.payment_status || 'pending', amountPaid: 0, remainingBalance: orderTotal(), isPartialPayment: false };

    const oldItems = JSON.parse(JSON.stringify(Array.isArray(order.items) ? order.items : []));
    const oldTotal = orderTotal();
    const oldCustomer = order.customer_id || order.customer;
    const oldSaleDate = order.sale_date || order.saleDate || order.created_at || order.createdAt;
    const incomingCustomer = req.body.customer !== undefined ? (req.body.customer || null) : oldCustomer;
    const customerChanged = String(oldCustomer || '') !== String(incomingCustomer || '');

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

    // Invoice-level discount: if provided, set pricing discount and recalc total
    if (req.body.discount !== undefined) {
      const discountAmount = parseFloat(req.body.discount) || 0;
      order.pricing.discountAmount = discountAmount;
      order.pricing.total = (order.pricing.subtotal || 0) - discountAmount + (order.pricing.taxAmount || 0);
    }

    // Amount received (for edit invoice)
    if (req.body.amountReceived !== undefined) {
      const amt = parseFloat(req.body.amountReceived) || 0;
      order.payment.amountPaid = amt;
      order.payment.status = amt >= (parseFloat(order.pricing?.total ?? order.total) || 0) ? 'paid' : (amt > 0 ? 'partial' : 'pending');
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

          const currentStock = parseFloat(product.stock_quantity) || product.inventory?.currentStock || 0;
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
        // Try to find as product first, then as variant (for tax rate and cost)
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

        // Get unit cost for P&L (COGS) - same logic as createSale
        let unitCost = 0;
        const productId = productForTax?.id || productForTax?._id;
        if (productId) {
          const inv = await inventoryRepository.findByProduct(productId);
          if (inv && inv.cost) {
            const costObj = typeof inv.cost === 'string' ? JSON.parse(inv.cost) : inv.cost;
            unitCost = costObj.average ?? costObj.lastPurchase ?? 0;
          }
          if (unitCost === 0) unitCost = productForTax?.pricing?.cost ?? productForTax?.cost_price ?? 0;
        }

        newOrderItems.push({
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost,
          cost_price: unitCost,
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
      order.pricing.discountAmount = req.body.discount !== undefined ? (parseFloat(req.body.discount) || 0) : newTotalDiscount;
      order.pricing.taxAmount = newTotalTax;
      order.pricing.total = newSubtotal - order.pricing.discountAmount + newTotalTax;

      // Check credit limit for credit sales when order total increases
      const finalCustomer = customerData || (order.customer_id || order.customer ? await customerRepository.findById(order.customer_id || order.customer) : null);
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

          if (newBalanceAfterUpdate > (finalCustomer.credit_limit || finalCustomer.creditLimit || 0)) {
            return res.status(400).json({
              message: `Credit limit exceeded for customer ${finalCustomer.business_name || finalCustomer.displayName || finalCustomer.name}`,
              error: 'CREDIT_LIMIT_EXCEEDED',
              details: {
                currentBalance: currentBalance,
                totalOutstanding: currentBalance,
                oldOrderUnpaid: oldUnpaidAmount,
                newOrderTotal: newTotal,
                unpaidAmount: unpaidAmount,
                creditLimit: finalCustomer.credit_limit || finalCustomer.creditLimit,
                newBalance: newBalanceAfterUpdate,
                availableCredit: (finalCustomer.credit_limit || finalCustomer.creditLimit) - currentBalance
              }
            });
          }
        }
      }
    }

    // Persist to Postgres
    const updateData = {
      customerId: order.customer || order.customer_id || null,
      saleDate: order.billDate || order.sale_date,
      notes: order.notes,
      updatedBy: req.user?.id || req.user?._id
    };
    if (order.items && order.items.length) {
      updateData.items = order.items.map(it => ({
        product_id: it.product_id || it.product,
        product: it.product_id || it.product,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unitCost: it.unitCost ?? it.cost_price ?? 0,
        cost_price: it.cost_price ?? it.unitCost ?? 0,
        subtotal: it.subtotal,
        total: it.total
      }));
      updateData.subtotal = order.pricing?.subtotal ?? order.subtotal;
      updateData.discount = order.pricing?.discountAmount ?? order.discount;
      updateData.tax = order.pricing?.taxAmount ?? order.tax;
      updateData.total = order.pricing?.total ?? order.total;
    } else if (req.body.discount !== undefined) {
      updateData.discount = order.pricing?.discountAmount ?? order.discount;
      updateData.total = order.pricing?.total ?? order.total;
    }
    if (req.body.amountReceived !== undefined) {
      updateData.amountPaid = parseFloat(req.body.amountReceived) || 0;
      updateData.paymentStatus = order.payment?.status ?? (updateData.amountPaid >= (parseFloat(order.pricing?.total ?? order.total) || 0) ? 'paid' : (updateData.amountPaid > 0 ? 'partial' : 'pending'));
    }
    if (req.body.orderType !== undefined) {
      updateData.orderType = req.body.orderType;
    }
    await salesRepository.update(req.params.id, updateData);

    // Refresh order from DB for ledger updates (ensures latest totals/dates)
    let updatedOrder = await salesRepository.findById(req.params.id);

    const newTotal = parseFloat(updatedOrder?.total) || 0;
    const newSaleDate = updatedOrder?.sale_date || updatedOrder?.saleDate || updatedOrder?.created_at || updatedOrder?.createdAt;
    const refNum = updatedOrder?.order_number || updatedOrder?.orderNumber || (updatedOrder?.id || updatedOrder?._id);
    const totalChanged = Math.abs(newTotal - oldTotal) >= 0.01;
    const billDateChanged = req.body.billDate !== undefined && String(newSaleDate || '') !== String(oldSaleDate || '');
    const customerIdForLedger = updatedOrder?.customer_id || updatedOrder?.customer || null;

    // Ensure sale ledger entries exist, and update key fields when edited
    try {
      if (updatedOrder) {
        const hasSaleLedger = await AccountingService.hasSaleLedgerEntries(req.params.id);
        if (!hasSaleLedger && newTotal > 0) {
          await AccountingService.recordSale(updatedOrder);
        } else if (hasSaleLedger && (totalChanged || billDateChanged || customerChanged)) {
          await AccountingService.updateSaleLedgerEntries({
            saleId: req.params.id,
            total: newTotal,
            transactionDate: billDateChanged ? newSaleDate : undefined,
            customerId: customerChanged ? customerIdForLedger : undefined,
            referenceNumber: refNum
          });
        }
      }
    } catch (ledgerErr) {
      console.error('Failed to ensure/update sale ledger on edit:', ledgerErr);
    }

    // Post amount received change to account ledger so balance reflects the update
    if (!customerChanged && req.body.amountReceived !== undefined) {
      const oldAmountPaid = parseFloat(order.amount_paid) || 0;
      const newAmountPaid = parseFloat(req.body.amountReceived) || 0;
      if (Math.abs(newAmountPaid - oldAmountPaid) >= 0.01) {
        try {
          await AccountingService.recordSalePaymentAdjustment({
            saleId: order.id || order._id,
            orderNumber: order.order_number || order.orderNumber,
            customerId: order.customer_id,
            oldAmountPaid,
            newAmountPaid,
            paymentMethod: order.payment_method || order.payment?.method || 'cash',
            createdBy: req.user?.id || req.user?._id
          });
        } catch (ledgerErr) {
          console.error('Failed to post sale payment adjustment to ledger:', ledgerErr);
        }
      }
    }

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
                referenceId: order.id || order._id,
                referenceModel: 'SalesOrder',
                performedBy: req.user?.id || req.user?._id,
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
                referenceId: order.id || order._id,
                referenceModel: 'SalesOrder',
                performedBy: req.user?.id || req.user?._id,
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
              referenceId: order.id || order._id,
              referenceModel: 'SalesOrder',
              performedBy: req.user?.id || req.user?._id,
              notes: `Inventory restored due to order ${order.orderNumber} update - item removed`
            });
          }
        }
      } catch (error) {
        console.error('Error adjusting inventory on order update:', error);
        // Don't fail update if inventory adjustment fails
      }
    }

    // Customer balance: now derived from Account Ledger (AccountingService), no direct Customer update.

    // If customer changed, move ledger entries to the new customer
    if (customerChanged) {
      try {
        await AccountingService.updateLedgerCustomerForSale(req.params.id, incomingCustomer);
      } catch (ledgerErr) {
        console.error('Failed to update sale ledger customer on edit:', ledgerErr);
      }
    }

    if (updatedOrder && updatedOrder.customer_id) {
      updatedOrder.customer = await customerRepository.findById(updatedOrder.customer_id);
    }

    // Redistribute profit shares when total or items changed (so investor P&L stays correct)
    if (updatedOrder && (totalChanged || (req.body.items && req.body.items.length > 0))) {
      try {
        await profitDistributionService.redistributeProfitForOrder(updatedOrder, req.user);
      } catch (profitErr) {
        console.error('Failed to redistribute profit on sale edit:', profitErr);
      }
    }

    let finalOrder = updatedOrder || order;
    try {
      finalOrder = await salesService.getSalesOrderById(finalOrder.id || finalOrder._id);
    } catch(e) {
      console.error('Failed to get fully enriched order on update:', e);
    }

    res.json({
      message: 'Order updated successfully',
      order: finalOrder
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

    const order = await salesRepository.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderTotal = parseFloat(order.total) || 0;
    const amountPaidSoFar = parseFloat(order.amount_paid) || 0;
    const { method, amount, reference } = req.body;
    const newAmountPaid = amountPaidSoFar + amount;
    const newPaymentStatus = newAmountPaid >= orderTotal ? 'paid' : 'partial';

    await salesRepository.update(req.params.id, {
      paymentStatus: newPaymentStatus,
      updatedBy: req.user?.id || req.user?._id
    });

    if (order.customer_id && amount > 0) {
      try {
        const CustomerBalanceService = require('../services/customerBalanceService');
        await CustomerBalanceService.recordPayment(order.customer_id, amount, order.id || order._id);
      } catch (error) {
        console.error('Error updating customer balance on payment:', error);
      }
    }

    const updatedOrder = await salesRepository.findById(req.params.id);
    res.json({
      message: 'Payment processed successfully',
      order: {
        id: updatedOrder?.id || updatedOrder?._id,
        order_number: updatedOrder?.order_number,
        orderNumber: updatedOrder?.order_number,
        payment: { status: newPaymentStatus, amountPaid: newAmountPaid }
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
    const order = await salesRepository.findById(req.params.id);
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

    // Customer balance: now derived from Account Ledger; no direct Customer update on delete.

    const orderTotal = parseFloat(order.total) || 0;
    const orderItems = Array.isArray(order.items) ? order.items : [];
    if (orderTotal > 0 || orderItems.length > 0) {
      try {
        const inventoryService = require('../services/inventoryService');
        for (const item of orderItems) {
          const productId = item.product_id || item.product;
          if (!productId) continue;
          try {
            await inventoryService.updateStock({
              productId,
              type: 'in',
              quantity: item.quantity || 0,
              reason: 'Order Deletion',
              reference: 'Sales Order',
              referenceId: order.id || order._id,
              referenceModel: 'SalesOrder',
              performedBy: req.user?.id || req.user?._id,
              notes: `Inventory restored due to deletion of order ${order.order_number || order.orderNumber}`
            });
          } catch (err) {
            console.error(`Failed to restore inventory for product ${productId}:`, err);
          }
        }
      } catch (error) {
        console.error('Error restoring inventory on order deletion:', error);
      }
    }

    // Reverse account ledger entries so ledger summary reflects the deletion
    try {
      const orderId = req.params.id;
      await AccountingService.reverseLedgerEntriesByReference('sale', orderId);
      await AccountingService.reverseLedgerEntriesByReference('sale_payment', orderId);
    } catch (ledgerErr) {
      console.error('Reverse ledger for sale delete:', ledgerErr);
      // Continue with deletion; ledger may not have had entries (e.g. draft)
    }

    await salesRepository.delete(req.params.id);

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

    const raw = await salesRepository.findByDateRange(startOfDay, endOfDay);
    const orders = Array.isArray(raw) ? raw : [];

    const totalRev = orders.reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0);
    const itemsArr = (o) => (o && Array.isArray(o.items) ? o.items : []);
    const totalItems = orders.reduce((sum, order) =>
      sum + itemsArr(order).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0);
    const summary = {
      totalOrders: orders.length,
      totalRevenue: totalRev,
      totalItems: totalItems,
      averageOrderValue: orders.length > 0 ? totalRev / orders.length : 0,
      orderTypes: {
        retail: orders.filter(o => o && o.order_type === 'retail').length,
        wholesale: orders.filter(o => o && o.order_type === 'wholesale').length,
        return: orders.filter(o => o && o.order_type === 'return').length,
        exchange: orders.filter(o => o && o.order_type === 'exchange').length
      },
      paymentMethods: orders.reduce((acc, order) => {
        const m = order?.payment_method || 'cash';
        acc[m] = (acc[m] || 0) + 1;
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

    const raw = await salesRepository.findByDateRange(dateFrom, dateTo);
    const orders = Array.isArray(raw) ? raw : [];
    const totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0);
    const totalOrders = orders.length;
    const itemsArr = (o) => (o && Array.isArray(o.items) ? o.items : []);
    const totalItems = orders.reduce((sum, order) =>
      sum + itemsArr(order).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalDiscounts = orders.reduce((sum, order) => sum + (parseFloat(order?.discount) || 0), 0);
    const revenueByType = {
      retail: orders.filter(o => o && o.order_type === 'retail').reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0),
      wholesale: orders.filter(o => o && o.order_type === 'wholesale').reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0)
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
      period: { start: req.query.dateFrom, end: req.query.dateTo }
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

    const filter = {};
    if (filters.search) filter.orderNumber = filters.search;
    if (filters.status) filter.status = filters.status;
    if (filters.paymentStatus) filter.paymentStatus = filters.paymentStatus;
    if (filters.customer) filter.customerId = filters.customer;
    if (filters.dateFrom) {
      filter.dateFrom = new Date(filters.dateFrom);
      filter.dateFrom.setHours(0, 0, 0, 0);
    }
    if (filters.dateTo) {
      filter.dateTo = new Date(filters.dateTo);
      filter.dateTo.setDate(filter.dateTo.getDate() + 1);
      filter.dateTo.setHours(0, 0, 0, 0);
    }

    const orders = await salesRepository.findAll(filter, { limit: 10000, sort: 'created_at DESC' });

    const excelData = await Promise.all(orders.map(async (order) => {
      let customerName = 'Walk-in Customer';
      let customerEmail = '';
      let customerPhone = '';
      if (order.customer_id) {
        const cust = await customerRepository.findById(order.customer_id);
        if (cust) {
          customerName = cust.business_name || cust.name || `${(cust.first_name || '')} ${(cust.last_name || '')}`.trim() || customerName;
          customerEmail = cust.email || '';
          customerPhone = cust.phone || '';
        }
      }
      const itemsArr = Array.isArray(order.items) ? order.items : [];
      const itemsSummary = itemsArr.map(item => `${item.product_id || item.product || 'Unknown'}: ${item.quantity || 0} x $${item.unitPrice || item.unit_price || 0}`).join('; ') || 'No items';
      return {
        'Order Number': order.order_number || '',
        'Customer': customerName,
        'Customer Email': customerEmail,
        'Customer Phone': customerPhone,
        'Order Type': order.order_type || '',
        'Status': order.status || '',
        'Payment Status': order.payment_status || '',
        'Payment Method': order.payment_method || '',
        'Order Date': order.sale_date || order.created_at ? new Date(order.sale_date || order.created_at).toISOString().split('T')[0] : '',
        'Subtotal': order.subtotal ?? 0,
        'Discount': order.discount ?? 0,
        'Tax': order.tax ?? 0,
        'Total': order.total ?? 0,
        'Amount Paid': order.amount_paid ?? 0,
        'Remaining Balance': (parseFloat(order.total) || 0) - (parseFloat(order.amount_paid) || 0),
        'Items Count': itemsArr.length,
        'Items Summary': itemsSummary,
        'Tax Exempt': 'No',
        'Notes': order.notes || '',
        'Created By': '',
        'Created Date': order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : ''
      };
    }));

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

    const pgFilter = {};
    if (filters.search) pgFilter.orderNumber = filters.search;
    if (filters.status) pgFilter.status = filters.status;
    if (filters.paymentStatus) pgFilter.paymentStatus = filters.paymentStatus;
    if (filters.customer) pgFilter.customerId = filters.customer;
    if (filters.dateFrom) {
      pgFilter.dateFrom = new Date(filters.dateFrom);
      pgFilter.dateFrom.setHours(0, 0, 0, 0);
    }
    if (filters.dateTo) {
      pgFilter.dateTo = new Date(filters.dateTo);
      pgFilter.dateTo.setDate(pgFilter.dateTo.getDate() + 1);
      pgFilter.dateTo.setHours(0, 0, 0, 0);
    }
    const orders = await salesRepository.findAll(pgFilter, { limit: 10000, sort: 'created_at DESC' });

    const csvData = await Promise.all(orders.map(async (order) => {
      let customerName = 'Walk-in Customer';
      let customerEmail = '';
      let customerPhone = '';
      if (order.customer_id) {
        const cust = await customerRepository.findById(order.customer_id);
        if (cust) {
          customerName = cust.business_name || cust.name || `${(cust.first_name || '')} ${(cust.last_name || '')}`.trim() || customerName;
          customerEmail = cust.email || '';
          customerPhone = cust.phone || '';
        }
      }
      const itemsArr = Array.isArray(order.items) ? order.items : [];
      const itemsSummary = itemsArr.map(item => `${item.product_id || item.product || 'Unknown'}: ${item.quantity || 0} x $${item.unitPrice || item.unit_price || 0}`).join('; ') || 'No items';
      return {
        'Order Number': order.order_number || '',
        'Customer': customerName,
        'Customer Email': customerEmail,
        'Customer Phone': customerPhone,
        'Order Type': order.order_type || '',
        'Status': order.status || '',
        'Payment Status': order.payment_status || '',
        'Payment Method': order.payment_method || '',
        'Order Date': order.sale_date || order.created_at ? new Date(order.sale_date || order.created_at).toISOString().split('T')[0] : '',
        'Subtotal': order.subtotal ?? 0,
        'Discount': order.discount ?? 0,
        'Tax': order.tax ?? 0,
        'Total': order.total ?? 0,
        'Amount Paid': order.amount_paid ?? 0,
        'Remaining Balance': (parseFloat(order.total) || 0) - (parseFloat(order.amount_paid) || 0),
        'Items Count': itemsArr.length,
        'Items Summary': itemsSummary,
        'Tax Exempt': 'No',
        'Notes': order.notes || '',
        'Created By': '',
        'Created Date': order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : ''
      };
    }));

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
      const customer = await customerRepository.findById(filters.customer);
      if (customer) {
        customerName = customer.business_name || customer.name ||
          `${(customer.first_name || '')} ${(customer.last_name || '')}`.trim() || 'Unknown Customer';
      }
    }

    const pgFilter = {};
    if (filters.customer) pgFilter.customerId = filters.customer;
    if (filters.dateFrom) {
      pgFilter.dateFrom = new Date(filters.dateFrom);
      pgFilter.dateFrom.setHours(0, 0, 0, 0);
    }
    if (filters.dateTo) {
      pgFilter.dateTo = new Date(filters.dateTo);
      pgFilter.dateTo.setDate(pgFilter.dateTo.getDate() + 1);
      pgFilter.dateTo.setHours(0, 0, 0, 0);
    }
    const orders = await salesRepository.findAll(pgFilter, { limit: 5000, sort: 'created_at DESC' });

    const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];
    const customerMap = {};
    for (const cid of customerIds) {
      const c = await customerRepository.findById(cid);
      if (c) customerMap[cid] = c;
    }
    orders.forEach(o => {
      o.customer = o.customer_id ? customerMap[o.customer_id] : null;
      if (o.customer) {
        o.customer._id = o.customer.id;
        o.customer.pendingBalance = o.customer.pending_balance ?? o.customer.pendingBalance;
        o.customer.currentBalance = o.customer.current_balance ?? o.customer.currentBalance;
        o.customer.businessName = o.customer.business_name ?? o.customer.businessName;
        o.customer.firstName = o.customer.first_name ?? o.customer.firstName;
        o.customer.lastName = o.customer.last_name ?? o.customer.lastName;
        o.customerInfo = {
          name: o.customer.business_name ?? o.customer.businessName ?? o.customer.name,
          businessName: o.customer.business_name ?? o.customer.businessName,
          email: o.customer.email,
          phone: o.customer.phone
        };
      } else {
        o.customerInfo = null;
      }
      o._id = o.id;
      o.orderNumber = o.order_number;
      o.payment = { amountPaid: parseFloat(o.amount_paid) || 0, method: o.payment_method || 'N/A' };
      o.createdAt = o.created_at || o.sale_date;
      o.pricing = { total: parseFloat(o.total) || 0 };
    });
    const orderIds = orders.map(o => o.id);

    let receiptStartDate = null;
    let receiptEndDate = null;
    if (filters.dateFrom || filters.dateTo) {
      if (filters.dateFrom) {
        receiptStartDate = new Date(filters.dateFrom);
        receiptStartDate.setHours(0, 0, 0, 0);
      }
      if (filters.dateTo) {
        receiptEndDate = new Date(filters.dateTo);
        receiptEndDate.setDate(receiptEndDate.getDate() + 1);
        receiptEndDate.setHours(0, 0, 0, 0);
      }
    }
    const receiptsByOrder = {};
    const receiptsByCustomer = {};
    if (customerIds.length > 0 || true) {
      const cashReceipts = await cashReceiptRepository.findAll(
        { startDate: receiptStartDate, endDate: receiptEndDate },
        { limit: 5000 }
      );
      const bankReceipts = await bankReceiptRepository.findAll(
        { startDate: receiptStartDate, endDate: receiptEndDate },
        { limit: 5000 }
      );
      const cashFiltered = receiptStartDate && receiptEndDate && customerIds.length
        ? cashReceipts.filter(r => r.customer_id && customerIds.includes(r.customer_id))
        : cashReceipts;
      const bankFiltered = receiptStartDate && receiptEndDate && customerIds.length
        ? bankReceipts.filter(r => r.customer_id && customerIds.includes(r.customer_id))
        : bankReceipts;
      [...cashFiltered, ...bankFiltered].forEach(receipt => {
        const receiptInfo = {
          type: (receipt.receipt_number || '').startsWith('CR-') ? 'Cash' : 'Bank',
          voucherCode: receipt.receipt_number || 'N/A',
          amount: receipt.amount || 0,
          date: receipt.date,
          method: receipt.payment_method || (receipt.transaction_reference ? 'Bank Transfer' : 'N/A')
        };
        if (receipt.customer_id) {
          const cid = receipt.customer_id.toString ? receipt.customer_id.toString() : receipt.customer_id;
          if (!receiptsByCustomer[cid]) receiptsByCustomer[cid] = [];
          receiptsByCustomer[cid].push(receiptInfo);
        }
      });
    }

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

    const pgFilter = {};
    if (filters.search) pgFilter.orderNumber = filters.search;
    if (filters.status) pgFilter.status = filters.status;
    if (filters.paymentStatus) pgFilter.paymentStatus = filters.paymentStatus;
    if (filters.customer) pgFilter.customerId = filters.customer;
    if (filters.dateFrom) {
      pgFilter.dateFrom = new Date(filters.dateFrom);
      pgFilter.dateFrom.setHours(0, 0, 0, 0);
    }
    if (filters.dateTo) {
      pgFilter.dateTo = new Date(filters.dateTo);
      pgFilter.dateTo.setDate(pgFilter.dateTo.getDate() + 1);
      pgFilter.dateTo.setHours(0, 0, 0, 0);
    }
    const orders = await salesRepository.findAll(pgFilter, { limit: 10000, sort: 'created_at DESC' });

    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
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
