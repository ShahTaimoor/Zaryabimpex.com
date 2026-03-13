const express = require('express');
const { body, validationResult, query } = require('express-validator');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const inventoryService = require('../services/inventoryService');
const salesService = require('../services/salesService');
const salesOrderRepository = require('../repositories/postgres/SalesOrderRepository');
const customerRepository = require('../repositories/postgres/CustomerRepository');
const productRepository = require('../repositories/postgres/ProductRepository');
const productVariantRepository = require('../repositories/postgres/ProductVariantRepository');
const inventoryRepository = require('../repositories/InventoryRepository');

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

// Format customer address for print (handles string, array, object)
const formatCustomerAddress = (customerData) => {
  if (!customerData) return '';
  if (typeof customerData.address === 'string' && customerData.address.trim()) return customerData.address.trim();
  const addrRaw = customerData.address ?? customerData.addresses;
  if (Array.isArray(addrRaw) && addrRaw.length > 0) {
    const a = addrRaw.find(x => x.isDefault) || addrRaw.find(x => x.type === 'billing' || x.type === 'both') || addrRaw[0];
    const parts = [a.street || a.address_line1 || a.addressLine1 || a.line1, a.city, a.state || a.province, a.country, a.zipCode || a.zip || a.postalCode || a.postal_code].filter(Boolean);
    return parts.join(', ');
  }
  if (addrRaw && typeof addrRaw === 'object' && !Array.isArray(addrRaw)) {
    const parts = [addrRaw.street || addrRaw.address_line1 || addrRaw.addressLine1 || addrRaw.line1, addrRaw.city, addrRaw.state || addrRaw.province, addrRaw.country, addrRaw.zipCode || addrRaw.zip || addrRaw.postalCode || addrRaw.postal_code].filter(Boolean);
    return parts.join(', ');
  }
  if (typeof customerData.location === 'string' && customerData.location.trim()) return customerData.location.trim();
  if (typeof customerData.companyAddress === 'string' && customerData.companyAddress.trim()) return customerData.companyAddress.trim();
  return '';
};

// Enrich items with product objects when product is just an ID (for print)
const enrichItemsWithProducts = async (items) => {
  if (!items || !Array.isArray(items)) return;
  for (const item of items) {
    const productId = item.product || item.product_id;
    if (!productId) continue;
    const id = typeof productId === 'object' ? (productId.id || productId._id) : productId;
    if (typeof id !== 'string') continue;
    if (typeof item.product === 'object' && item.product && (item.product.name || item.product.displayName)) continue; // Already populated
    try {
      let p = await productRepository.findById(id);
      if (p) {
        item.product = { ...p, name: p.name || p.displayName };
      } else {
        p = await productVariantRepository.findById(id);
        if (p) {
          item.product = { name: p.display_name ?? p.displayName ?? p.variant_name ?? p.variantName ?? 'Product' };
        }
      }
    } catch (e) {
      // Keep item.product as-is on error
    }
  }
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
  query('customer').optional({ checkFalsy: true }).isUUID(4),
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

    const filter = {};

    if (req.query.search) {
      const searchTerm = req.query.search.trim();
      filter.searchTerm = searchTerm;
      const customerMatches = await customerRepository.search(searchTerm, { limit: 1000 });
      if (customerMatches.length > 0) {
        filter.searchCustomerIds = customerMatches.map(c => c.id || c._id).filter(Boolean);
      }
    }

    if (req.query.status) filter.status = req.query.status;
    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.orderNumber) filter.soNumberIlike = req.query.orderNumber.trim();

    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      if (req.dateFilter.createdAt && req.dateFilter.createdAt.$gte) filter.createdAtFrom = req.dateFilter.createdAt.$gte;
      if (req.dateFilter.createdAt && req.dateFilter.createdAt.$lte) filter.createdAtTo = req.dateFilter.createdAt.$lte;
      if (req.dateFilter.$or) {
        req.dateFilter.$or.forEach((cond) => {
          if (cond.createdAt && cond.createdAt.$gte) filter.createdAtFrom = filter.createdAtFrom || cond.createdAt.$gte;
          if (cond.createdAt && cond.createdAt.$lte) filter.createdAtTo = filter.createdAtTo || cond.createdAt.$lte;
        });
      }
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

    // Attach customer to each sales order (PostgreSQL repo does not populate; use customer_id to fetch)
    const customerIds = [...new Set(salesOrders.map(so => so.customer_id).filter(Boolean))];
    const customerMap = {};
    for (const cid of customerIds) {
      const c = await customerRepository.findById(cid);
      if (c) {
        c.businessName = c.business_name ?? c.businessName;
        c._id = c.id;
        customerMap[cid] = c;
      }
    }
    await enrichItemsWithProducts(salesOrders.flatMap(so => so.items || []));
    salesOrders.forEach(so => {
      so.customer = so.customer_id ? customerMap[so.customer_id] : null;
      if (so.customer) {
        so.customer = transformCustomerToUppercase(so.customer);
        const custName = (so.customer.business_name ?? so.customer.businessName) || so.customer.name || `${(so.customer.first_name || so.customer.firstName || '')} ${(so.customer.last_name || so.customer.lastName || '')}`.trim() || so.customer.email || 'Unknown Customer';
        so.customer.displayName = custName.toUpperCase();
        so.customerInfo = {
          ...so.customerInfo,
          address: formatCustomerAddress(so.customer) || so.customerInfo?.address
        };
      }
      if (so.items && Array.isArray(so.items)) {
        so.items.forEach(item => {
          if (item.product && typeof item.product === 'object') {
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
    const salesOrder = await salesOrderRepository.findById(req.params.id);

    if (!salesOrder) {
      return res.status(404).json({ message: 'Sales order not found' });
    }

    // Attach customer (PostgreSQL repo does not populate)
    if (salesOrder.customer_id) {
      const c = await customerRepository.findById(salesOrder.customer_id);
      if (c) {
        c.businessName = c.business_name ?? c.businessName;
        c._id = c.id;
        salesOrder.customer = c;
      }
    }
    if (salesOrder.customer) {
      salesOrder.customer = transformCustomerToUppercase(salesOrder.customer);
      const custName = (salesOrder.customer.business_name ?? salesOrder.customer.businessName) || salesOrder.customer.name || `${(salesOrder.customer.first_name || salesOrder.customer.firstName || '')} ${(salesOrder.customer.last_name || salesOrder.customer.lastName || '')}`.trim() || salesOrder.customer.email || 'Unknown Customer';
      salesOrder.customer.displayName = custName.toUpperCase();
      salesOrder.customerInfo = {
        ...salesOrder.customerInfo,
        address: formatCustomerAddress(salesOrder.customer) || salesOrder.customerInfo?.address
      };
    }
    if (salesOrder.items && Array.isArray(salesOrder.items)) {
      await enrichItemsWithProducts(salesOrder.items);
      salesOrder.items.forEach(item => {
        if (item.product && typeof item.product === 'object') {
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
  body('customer').isUUID(4).withMessage('Valid customer is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isUUID(4).withMessage('Valid product is required'),
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
      soNumber: salesOrderRepository.generateSONumber(),
      createdBy: req.user?.id || req.user?._id
    };

    const created = await salesOrderRepository.create(soData);
    let salesOrder = await salesOrderRepository.findById(created.id);
    if (salesOrder && salesOrder.customer_id) {
      const customer = await customerRepository.findById(salesOrder.customer_id);
      if (customer) salesOrder.customer = transformCustomerToUppercase(customer);
    }
    if (salesOrder && salesOrder.items && Array.isArray(salesOrder.items)) {
      salesOrder.items.forEach(item => {
        if (item.product) item.product = transformProductToUppercase(item.product);
      });
    }

    res.status(201).json({
      message: 'Sales order created successfully',
      salesOrder: salesOrder || created
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
  body('customer').optional({ checkFalsy: true }).isUUID(4).withMessage('Valid customer is required'),
  body('orderType').optional().isIn(['retail', 'wholesale', 'return', 'exchange']).withMessage('Invalid order type'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').optional({ checkFalsy: true }).isUUID(4).withMessage('Valid product is required'),
  body('items.*.quantity').optional().custom((v) => (Number.isInteger(Number(v)) && Number(v) >= 1)).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').optional().custom((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0).withMessage('Unit price must be positive'),
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
      lastModifiedBy: req.user?.id || req.user?._id
    };

    const updatedSO = await salesOrderRepository.update(req.params.id, updateData);
    if (updatedSO && updatedSO.customer_id) {
      const customer = await customerRepository.findById(updatedSO.customer_id);
      if (customer) updatedSO.customer = transformCustomerToUppercase(customer);
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

// @route   GET /api/sales-orders/:id/stock-status
// @desc    Check which items have insufficient/out-of-stock before confirm
// @access  Private
router.get('/:id/stock-status', auth, async (req, res) => {
  try {
    const salesOrder = await salesOrderRepository.findById(req.params.id);
    if (!salesOrder) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    const items = Array.isArray(salesOrder.items) ? salesOrder.items : (typeof salesOrder.items === 'string' ? JSON.parse(salesOrder.items || '[]') : []);
    const outOfStock = [];

    for (const item of items) {
      const productId = item.product || item.product_id;
      if (!productId) continue;

      let currentStock = 0;
      try {
        const inv = await inventoryRepository.findByProduct(productId);
        if (inv) {
          currentStock = Number(inv.current_stock ?? inv.currentStock ?? 0);
        } else {
          const product = await productRepository.findById(productId);
          if (product) currentStock = Number(product.stock_quantity ?? product.stockQuantity ?? 0);
        }
      } catch {
        currentStock = 0;
      }

      const requestedQty = Number(item.quantity) || 0;
      if (requestedQty > 0 && currentStock < requestedQty) {
        let productName = 'Unknown';
        try {
          let p = await productRepository.findById(productId);
          if (p) productName = p.name || p.displayName || 'Product';
          else {
            p = await productVariantRepository.findById(productId);
            if (p) productName = (p.display_name ?? p.displayName) || (p.variant_name ?? p.variantName) || 'Variant';
          }
        } catch {}
        outOfStock.push({
          productId,
          productName,
          requestedQty,
          availableStock: currentStock
        });
      }
    }

    res.json({
      outOfStock,
      canConfirm: outOfStock.length === 0
    });
  } catch (error) {
    console.error('Stock status check error:', error);
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

    const userId = req.user?.id || req.user?._id;
    const items = Array.isArray(salesOrder.items) ? salesOrder.items : (typeof salesOrder.items === 'string' ? JSON.parse(salesOrder.items || '[]') : []);

    const inventoryUpdates = [];
    for (const item of items) {
      const productId = item.product || item.product_id;
      try {
        const inventoryUpdate = await inventoryService.updateStock({
          productId,
          type: 'out',
          quantity: item.quantity,
          reason: 'Sales Order Confirmation',
          reference: 'Sales Order',
          referenceId: salesOrder.id,
          referenceModel: 'SalesOrder',
          performedBy: userId,
          notes: `Stock reduced due to sales order confirmation - SO: ${salesOrder.so_number || salesOrder.soNumber}`
        });

        inventoryUpdates.push({
          productId,
          quantity: item.quantity,
          newStock: inventoryUpdate.currentStock,
          success: true
        });
      } catch (inventoryError) {
        console.error(`Failed to update inventory for product ${productId}:`, inventoryError.message);
        inventoryUpdates.push({
          productId,
          quantity: item.quantity,
          success: false,
          error: inventoryError.message
        });

        return res.status(400).json({
          message: `Insufficient stock for product ${productId}. Cannot confirm sales order.`,
          details: inventoryError.message,
          inventoryUpdates
        });
      }
    }

    await salesOrderRepository.update(req.params.id, {
      status: 'confirmed',
      confirmedDate: new Date(),
      lastModifiedBy: userId
    });

    let automaticSale = null;
    let saleError = null;
    try {
      const soForSale = await salesOrderRepository.findById(req.params.id);
      automaticSale = await salesService.createSaleFromSalesOrder(soForSale, req.user);

      const updatedItems = items.map(item => ({
        ...item,
        invoicedQuantity: item.quantity,
        remainingQuantity: 0
      }));

      await salesOrderRepository.update(req.params.id, {
        status: 'fully_invoiced',
        items: updatedItems,
        lastModifiedBy: userId
      });
    } catch (createSaleError) {
      console.error('Failed to automatically create sales invoice during SO confirmation:', createSaleError);
      saleError = createSaleError.message;
    }

    let salesOrderResult = await salesOrderRepository.findById(req.params.id);
    if (salesOrderResult && salesOrderResult.customer_id) {
      const customer = await customerRepository.findById(salesOrderResult.customer_id);
      if (customer) salesOrderResult.customer = transformCustomerToUppercase(customer);
    }

    // Transform names to uppercase
    if (salesOrderResult && salesOrderResult.customer) {
      salesOrderResult.customer = transformCustomerToUppercase(salesOrderResult.customer);
    }
    if (salesOrderResult && salesOrderResult.items && Array.isArray(salesOrderResult.items)) {
      salesOrderResult.items.forEach(item => {
        if (item.product) item.product = transformProductToUppercase(item.product);
      });
    }

    res.json({
      message: automaticSale
        ? 'Sales order confirmed and invoice generated successfully'
        : `Sales order confirmed but failed to generate invoice: ${saleError}`,
      salesOrder: salesOrderResult,
      sale: automaticSale,
      inventoryUpdates,
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

    const soItems = Array.isArray(salesOrder.items) ? salesOrder.items : (typeof salesOrder.items === 'string' ? JSON.parse(salesOrder.items || '[]') : []);
    const userId = req.user?.id || req.user?._id;

    const inventoryUpdates = [];
    if (salesOrder.status === 'confirmed') {
      for (const item of soItems) {
        const productId = item.product || item.product_id;
        try {
          const inventoryUpdate = await inventoryService.updateStock({
            productId,
            type: 'return',
            quantity: item.quantity,
            reason: 'Sales Order Cancellation',
            reference: 'Sales Order',
            referenceId: salesOrder.id,
            referenceModel: 'SalesOrder',
            performedBy: userId,
            notes: `Stock restored due to sales order cancellation - SO: ${salesOrder.so_number || salesOrder.soNumber}`
          });

          inventoryUpdates.push({
            productId,
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

          console.warn(`Continuing with sales order cancellation despite inventory restoration failure for product ${productId}`);
        }
      }
    }

    const updated = await salesOrderRepository.update(req.params.id, {
      status: 'cancelled',
      lastModifiedBy: userId
    });

    res.json({
      message: salesOrder.status === 'confirmed'
        ? 'Sales order cancelled successfully and inventory restored'
        : 'Sales order cancelled successfully',
      salesOrder: updated || salesOrder,
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
      const updated = await salesOrderRepository.update(req.params.id, {
        status: 'closed',
        lastModifiedBy: req.user?.id || req.user?._id
      });
      res.json({
        message: 'Sales order closed successfully',
        salesOrder: updated || salesOrder
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
        id: salesOrder.id,
        _id: salesOrder.id,
        soNumber: salesOrder.so_number || salesOrder.soNumber,
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
