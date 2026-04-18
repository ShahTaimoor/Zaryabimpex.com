const express = require('express');
const { body, validationResult, query } = require('express-validator');
const fs = require('fs');
const path = require('path');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const inventoryService = require('../services/inventoryService');
const salesService = require('../services/salesService');
const salesOrderRepository = require('../repositories/postgres/SalesOrderRepository');
const {
  ensureItemConfirmationStatus,
  computeOrderConfirmationStatus,
  recalculateTotalsFromItems,
  getSalesOrderLineTotal
} = require('../utils/orderConfirmationUtils');
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

/** UUID or manual_* line id (same rule as POST /sales) */
const isValidSalesOrderProductId = (val) => {
  if (val == null || val === '') return false;
  const s = String(val);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
  if (isUuid) return true;
  return s.startsWith('manual_');
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
    if (typeof id !== 'string' && !(id && id.toString)) continue;
    const sid = String(id);

    if (sid.startsWith('manual_')) {
      const displayName =
        item.name ||
        item.productName ||
        (typeof item.product === 'object' && item.product?.name) ||
        'Manual Item';
      item.product = { _id: sid, id: sid, name: displayName, sku: item.sku || null, isManual: true };
      item.name = displayName;
      continue;
    }

    // If already populated with a name, we can skip lookup but check if it's 'Unknown Product'
    if (typeof item.product === 'object' && item.product && item.product.name && item.product.name !== 'Unknown Product') continue;
    if (item.name && item.name !== 'Unknown Product') {
       if (typeof item.product !== 'object') {
         item.product = { _id: sid, id: sid, name: item.name, sku: item.sku || item.productSku };
       }
       continue;
    }

    try {
      let p = await productRepository.findById(sid, true);
      if (p) {
        item.product = { ...p, id: sid, _id: sid, name: p.name || p.displayName, sku: p.sku };
        item.name = p.name || p.displayName;
        item.sku = p.sku;
      } else {
        p = await productVariantRepository.findById(sid, true);
        if (p) {
          const vname = p.display_name ?? p.displayName ?? p.variant_name ?? p.variantName ?? 'Product';
          item.product = { ...p, id: sid, _id: sid, name: vname, sku: p.sku };
          item.name = vname;
          item.sku = p.sku;
        } else {
          // DEEP RECOVERY: Search history for this product ID in sales or purchase invoices
          const { query } = require('../config/postgres');
          const recoveryRes = await query(`
            SELECT name, sku FROM (
              SELECT (elem->>'name') as name, (elem->>'sku') as sku, s.created_at FROM sales s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.items) = 'array' THEN s.items ELSE '[]'::jsonb END) elem WHERE (elem->>'product' = $1 OR elem->>'product_id' = $1)
              UNION ALL
              SELECT (elem->>'productName') as name, (elem->>'sku') as sku, pi.created_at FROM purchase_invoices pi, jsonb_array_elements(CASE WHEN jsonb_typeof(pi.items) = 'array' THEN pi.items ELSE '[]'::jsonb END) elem WHERE (elem->>'product' = $1 OR elem->>'product_id' = $1)
              UNION ALL
              SELECT (elem->>'name') as name, (elem->>'sku') as sku, so.created_at FROM sales_orders so, jsonb_array_elements(CASE WHEN jsonb_typeof(so.items) = 'array' THEN so.items ELSE '[]'::jsonb END) elem WHERE (elem->>'product' = $1 OR elem->>'product_id' = $1)
            ) h WHERE name IS NOT NULL AND name != 'Unknown Product' ORDER BY created_at DESC LIMIT 1
          `, [sid]);

          const recoveredName = recoveryRes.rows[0]?.name || item.name || item.productName || 'Unknown Product';
          const recoveredSku = recoveryRes.rows[0]?.sku || item.sku || item.productSku || null;
          item.product = { _id: sid, id: sid, name: recoveredName, sku: recoveredSku };
          item.name = recoveredName;
          item.sku = recoveredSku;
        }
      }
    } catch (e) {
      console.error('Error in enrichItemsWithProducts:', e);
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
      let c = await customerRepository.findById(cid);
      if (!c) {
        // Recovery for deep deleted customers from historical sales
        const { query } = require('../config/postgres');
        const rec = await query(`SELECT (customer_info->>'name') as name FROM sales WHERE customer_id = $1 AND customer_info IS NOT NULL LIMIT 1`, [cid]);
        if (rec.rows[0]) {
          c = { id: cid, _id: cid, name: rec.rows[0].name, isRecovered: true };
        }
      }
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

    // Enrich items with product names before saving
    if (req.body.items && Array.isArray(req.body.items)) {
      await enrichItemsWithProducts(req.body.items);
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
  body('items.*.product').optional({ checkFalsy: true }).custom((val) => !val || isValidSalesOrderProductId(val)).withMessage('Valid product is required'),
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

    // Enrich items with product names before saving
    if (req.body.items && Array.isArray(req.body.items)) {
      await enrichItemsWithProducts(req.body.items);
    }

    const updateData = {
      ...req.body,
      lastModifiedBy: req.user?.id || req.user?._id
    };
    if (Array.isArray(req.body.items)) {
      updateData.items = ensureItemConfirmationStatus(req.body.items);
      const tax = Number(salesOrder.tax) || 0;
      const { subtotal, total } = recalculateTotalsFromItems(updateData.items, getSalesOrderLineTotal, tax);
      updateData.subtotal = subtotal;
      updateData.total = total;
      updateData.confirmationStatus = computeOrderConfirmationStatus(updateData.items);
    }

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

// @route   PATCH /api/sales-orders/:id/items-confirmation
// @desc    Update item-wise confirmation status (partial confirmation)
// @access  Private
router.patch('/:id/items-confirmation', [
  auth,
  requirePermission('confirm_sales_orders'),
  body('itemUpdates').optional().isArray().withMessage('itemUpdates must be an array'),
  body('itemUpdates.*.itemIndex').isInt({ min: 0 }).withMessage('Valid itemIndex required'),
  body('itemUpdates.*.confirmationStatus').isIn(['pending', 'confirmed', 'cancelled']).withMessage('Invalid confirmationStatus'),
  body('confirmAll').optional().isBoolean().withMessage('confirmAll must be boolean'),
  body('cancelAll').optional().isBoolean().withMessage('cancelAll must be boolean')
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
    if (['fully_invoiced', 'cancelled', 'closed'].includes(salesOrder.status)) {
      return res.status(400).json({ message: 'Cannot update confirmation for order in current status' });
    }

    const userId = req.user?.id || req.user?._id;
    let items = Array.isArray(salesOrder.items) ? salesOrder.items : (typeof salesOrder.items === 'string' ? JSON.parse(salesOrder.items || '[]') : []);

    if (req.body.confirmAll === true) {
      items = items.map((i) => ({ ...i, confirmationStatus: 'confirmed', confirmation_status: 'confirmed' }));
    } else if (req.body.cancelAll === true) {
      items = items.map((i) => ({ ...i, confirmationStatus: 'cancelled', confirmation_status: 'cancelled' }));
    } else if (Array.isArray(req.body.itemUpdates) && req.body.itemUpdates.length > 0) {
      items = ensureItemConfirmationStatus(items);
      for (const { itemIndex, confirmationStatus } of req.body.itemUpdates) {
        if (itemIndex >= 0 && itemIndex < items.length) {
          const prevStatus = items[itemIndex].confirmationStatus ?? items[itemIndex].confirmation_status ?? 'pending';
          items[itemIndex] = { ...items[itemIndex], confirmationStatus, confirmation_status: confirmationStatus };

          const productId = items[itemIndex].product || items[itemIndex].product_id;
          const qty = Number(items[itemIndex].quantity) || 0;
          if (!productId || qty <= 0) continue;

          if (confirmationStatus === 'confirmed' && prevStatus !== 'confirmed') {
            try {
              await inventoryService.updateStock({
                productId: typeof productId === 'object' ? productId.id || productId._id : productId,
                type: 'out',
                quantity: qty,
                reason: 'Sales Order Item Confirmation',
                reference: 'Sales Order',
                referenceId: salesOrder.id,
                referenceModel: 'SalesOrder',
                performedBy: userId,
                notes: `Stock reduced - SO item confirmed: ${salesOrder.so_number || salesOrder.soNumber}`
              });
            } catch (invErr) {
              return res.status(400).json({
                message: `Insufficient stock for item at index ${itemIndex}. Cannot confirm.`,
                details: invErr.message
              });
            }
          } else if ((confirmationStatus === 'pending' || confirmationStatus === 'cancelled') && prevStatus === 'confirmed') {
            try {
              await inventoryService.updateStock({
                productId: typeof productId === 'object' ? productId.id || productId._id : productId,
                type: 'return',
                quantity: qty,
                reason: 'Sales Order Item Un-confirm',
                reference: 'Sales Order',
                referenceId: salesOrder.id,
                referenceModel: 'SalesOrder',
                performedBy: userId,
                notes: `Stock restored - SO item unconfirmed: ${salesOrder.so_number || salesOrder.soNumber}`
              });
            } catch (invErr) {
              return res.status(400).json({
                message: `Failed to restore stock for item at index ${itemIndex}.`,
                details: invErr.message
              });
            }
          }
        }
      }
    } else {
      return res.status(400).json({ message: 'Provide itemUpdates, confirmAll, or cancelAll' });
    }

    const confirmationStatus = computeOrderConfirmationStatus(items);
    const tax = Number(salesOrder.tax) || 0;
    const { subtotal, total } = recalculateTotalsFromItems(items, getSalesOrderLineTotal, tax);

    // Create invoice for newly confirmed items
    const newlyConfirmedIndices = Array.isArray(req.body.itemUpdates)
      ? req.body.itemUpdates
        .filter((u) => u.confirmationStatus === 'confirmed')
        .map((u) => u.itemIndex)
      : req.body.confirmAll === true
        ? items.map((_, i) => i)
        : [];

    let automaticSale = null;
    let updatePayload = { items, subtotal, total, confirmationStatus, lastModifiedBy: userId };

    if (newlyConfirmedIndices.length > 0) {
      try {
        const soForSale = { ...salesOrder, items, subtotal, total, confirmationStatus };
        automaticSale = await salesService.createPartialSaleFromSalesOrder(soForSale, newlyConfirmedIndices, req.user);
        const updatedItems = items.map((item) => {
          const isConfirmed = (item.confirmationStatus ?? item.confirmation_status) === 'confirmed';
          return isConfirmed
            ? { ...item, invoicedQuantity: item.quantity ?? 0, remainingQuantity: 0 }
            : item;
        });
        const allNonCancelledConfirmed = updatedItems
          .filter((i) => (i.confirmationStatus ?? i.confirmation_status) !== 'cancelled')
          .every((i) => (i.confirmationStatus ?? i.confirmation_status) === 'confirmed');
        updatePayload = {
          items: updatedItems,
          subtotal,
          total,
          confirmationStatus,
          status: allNonCancelledConfirmed ? 'fully_invoiced' : 'partially_invoiced',
          lastModifiedBy: userId
        };
      } catch (createSaleError) {
        console.error('Failed to create invoice for confirmed items:', createSaleError);
      }
    }

    const updatedSO = await salesOrderRepository.updateById(req.params.id, updatePayload);
    if (updatedSO && updatedSO.customer_id) {
      const customer = await customerRepository.findById(updatedSO.customer_id);
      if (customer) updatedSO.customer = transformCustomerToUppercase(customer);
    }
    if (updatedSO && Array.isArray(updatedSO.items)) {
      updatedSO.items.forEach((item) => {
        if (item.product) item.product = transformProductToUppercase(item.product);
      });
    }

    const saleMessage = automaticSale ? ' Item(s) confirmed and invoice created.' : newlyConfirmedIndices.length > 0 ? ' Item(s) confirmed but invoice creation failed.' : '';
    res.json({
      message: `Item confirmation updated successfully.${saleMessage}`,
      salesOrder: updatedSO,
      sale: automaticSale,
      invoiceError: automaticSale ? null : (newlyConfirmedIndices.length > 0 ? 'Invoice creation failed' : null)
    });
  } catch (error) {
    console.error('Items confirmation update error:', error);
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
    await enrichItemsWithProducts(items);
    const outOfStock = [];

    for (const item of items) {
      const productId = (item.product && typeof item.product === 'object') ? (item.product.id || item.product._id) : (item.product || item.product_id);
      if (!productId || typeof productId !== 'string') continue;
      if (productId.startsWith('manual_')) continue;

      let currentStock = 0;
      let usedReplacement = false;
      let replacementId = null;

      try {
        const inv = await inventoryRepository.findByProduct(productId);
        if (inv) {
          currentStock = Number(inv.current_stock ?? inv.currentStock ?? 0);
        } else {
          const product = await productRepository.findById(productId, true);
          if (product) currentStock = Number(product.stock_quantity ?? product.stockQuantity ?? 0);
        }

        // SMART FALLBACK: If current stock is 0/low, check if there's an active product with the same SKU or name
        const requestedQty = Number(item.quantity) || 0;
        if (currentStock < requestedQty) {
          const productName = (item.product && typeof item.product === 'object' && item.product.name) ? item.product.name : (item.name || item.productName);
          const productSku = (item.product && typeof item.product === 'object') ? item.product.sku : item.sku;

          if (productSku || productName) {
            const activeProducts = await productRepository.findAll({ 
              search: productSku || productName,
              limit: 5,
              includeDeleted: false 
            });

            // Find an exact match that is NOT the same deleted ID
            const replacement = activeProducts.find(p => {
              if (p.id === productId) return false;
              const matchSku = productSku && p.sku && p.sku.trim().toLowerCase() === String(productSku).trim().toLowerCase();
              const matchName = productName && p.name && p.name.trim().toLowerCase() === String(productName).trim().toLowerCase();
              return matchSku || matchName;
            });

            if (replacement && replacement.stockQuantity >= requestedQty) {
              currentStock = replacement.stockQuantity;
              usedReplacement = true;
              replacementId = replacement.id;
            }
          }
        }
      } catch (err) {
        console.warn('Stock status lookup failed for item:', productId, err.message);
        currentStock = 0;
      }

      const requestedQty = Number(item.quantity) || 0;
      if (requestedQty > 0 && currentStock < requestedQty) {
        const productName = (item.product && typeof item.product === 'object' && item.product.name) ? item.product.name : (item.name || item.productName || 'Unknown');
        
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
    await enrichItemsWithProducts(items);

    const inventoryUpdates = [];
    const updatedItemsForOrder = [];

    for (const item of items) {
      let productId = item.product || item.product_id;
      if (typeof productId === 'object' && productId !== null) {
        productId = productId.id || productId._id;
      }
      const originalProductId = productId;
      const requestedQty = Number(item.quantity) || 0;

      if (productId != null && String(productId).startsWith('manual_')) {
        updatedItemsForOrder.push(item);
        continue;
      }

      // Smart Resolution: Check if product exists and has stock
      let needsReplacement = false;
      try {
        const inv = await inventoryRepository.findByProduct(productId);
        const stock = Number(inv?.current_stock ?? inv?.currentStock ?? 0);
        if (stock < requestedQty) needsReplacement = true;
      } catch {
        needsReplacement = true;
      }

      if (needsReplacement) {
        // Try to find a replacement by SKU or Name
        try {
          // Get product info (we already enriched above, but let's be sure)
          const pName = (item.product?.name || item.name || item.productName || '').trim();
          const pSku = (item.product?.sku || item.sku || '').trim();

          if (pSku || pName) {
            const activeProducts = await productRepository.findAll({ 
              search: pSku || pName,
              limit: 10,
              includeDeleted: false 
            });

            const replacement = activeProducts.find(p => {
              if (p.id === originalProductId) return false;
              
              const matchSku = pSku && p.sku && p.sku.trim().toLowerCase() === pSku.toLowerCase();
              const matchName = pName && p.name && p.name.trim().toLowerCase() === pName.toLowerCase();
              
              return matchSku || matchName;
            });

            if (replacement && replacement.stockQuantity >= requestedQty) {
              console.log(`Replacing product ${originalProductId} with ${replacement.id} for SO item due to stock availability`);
              productId = replacement.id;
              item.product = replacement.id;
              item.product_id = replacement.id;
            }
          }
        } catch (recoverErr) {
          console.error('Failed to resolve replacement product:', recoverErr.message);
        }
      }

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
          notes: `Stock reduced due to sales order confirmation - SO: ${salesOrder.so_number || salesOrder.soNumber}${productId !== originalProductId ? ` (Resolved from replacement for ${originalProductId})` : ''}`
        });

        inventoryUpdates.push({
          productId,
          originalProductId,
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
          message: inventoryError.message.includes('stock') 
            ? `Insufficient stock for product ${item.product?.name || item.name || productId}. Cannot confirm sales order.`
            : `Failed to confirm sales order: ${inventoryError.message}`,
          details: inventoryError.message,
          inventoryUpdates
        });
      }
      updatedItemsForOrder.push(item);
    }

    const itemsWithConfirmed = updatedItemsForOrder.map((i) => ({
      ...i,
      confirmationStatus: 'confirmed',
      confirmation_status: 'confirmed'
    }));

    await salesOrderRepository.update(req.params.id, {
      status: 'confirmed',
      confirmationStatus: 'completed',
      confirmedDate: new Date(),
      items: itemsWithConfirmed,
      lastModifiedBy: userId
    });

    let automaticSale = null;
    let saleError = null;
    try {
      const soForSale = await salesOrderRepository.findById(req.params.id);
      automaticSale = await salesService.createSaleFromSalesOrder(soForSale, req.user);

      const updatedItems = itemsWithConfirmed.map((item) => ({
        ...item,
        invoicedQuantity: item.quantity,
        remainingQuantity: 0
      }));

      await salesOrderRepository.update(req.params.id, {
        status: 'fully_invoiced',
        items: updatedItems,
        confirmationStatus: 'completed',
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
        let productId = item.product || item.product_id;
        if (typeof productId === 'object' && productId !== null) {
          productId = productId.id || productId._id;
        }
        if (productId != null && String(productId).startsWith('manual_')) {
          continue;
        }
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











module.exports = router;
