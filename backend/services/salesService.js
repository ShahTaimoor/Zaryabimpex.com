const { transaction, query } = require('../config/postgres');
const salesRepository = require('../repositories/postgres/SalesRepository');
const productRepository = require('../repositories/ProductRepository');
const customerRepository = require('../repositories/postgres/CustomerRepository');
const productVariantRepository = require('../repositories/ProductVariantRepository');
const inventoryRepository = require('../repositories/postgres/InventoryRepository');
const StockMovementService = require('./stockMovementService');
const inventoryService = require('./inventoryService');
const customerTransactionService = require('./customerTransactionService');
const CustomerBalanceService = require('./customerBalanceService');
const AccountingService = require('./accountingService');
const profitDistributionService = require('./profitDistributionService');
const discountService = require('./discountService');
const paymentRepository = require('../repositories/postgres/PaymentRepository');

// Helper function to parse date string as local date (not UTC)
const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  if (typeof dateString !== 'string') return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

// Helper to format customer address
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

class SalesService {
  /**
   * Transform customer names to uppercase
   * @param {object} customer - Customer to transform
   * @returns {object} - Transformed customer
   */
  transformCustomerToUppercase(customer) {
    if (!customer) return customer;
    if (customer.toObject) customer = customer.toObject();
    if (customer.name) customer.name = customer.name.toUpperCase();
    if (customer.businessName) customer.businessName = customer.businessName.toUpperCase();
    if (customer.firstName) customer.firstName = customer.firstName.toUpperCase();
    if (customer.lastName) customer.lastName = customer.lastName.toUpperCase();
    return customer;
  }

  /**
   * Enrich order items with product names, inventory (stock), and cost when product is stored as ID only.
   * @param {Array} items - Order items
   * @returns {Promise<Array>} - Items with product populated as { _id, name, inventory, pricing }
   */
  async enrichItemsWithProductNames(items) {
    if (!items || !Array.isArray(items) || items.length === 0) return items;
    const productIds = [...new Set(items.map(i => {
      const p = i.product || i.product_id;
      if (!p) return null;
      const id = typeof p === 'string' ? p : (p._id || p.id || p);
      return id && typeof id === 'string' ? id : (id && id.toString ? id.toString() : null);
    }).filter(Boolean))];
    if (productIds.length === 0) return items;

    const [products, invRows] = await Promise.all([
      productRepository.findAll({ ids: productIds }, { limit: 1000 }),
      inventoryRepository.findByProductIds(productIds)
    ]);
    const invByProduct = new Map((invRows || []).map(inv => [String(inv.product_id), inv]));

    const productMap = new Map();
    for (const p of products) {
      const id = p.id || p._id;
      const sid = id && id.toString ? id.toString() : String(id);
      const inv = invByProduct.get(sid);
      const currentStock = inv ? (Number(inv.current_stock ?? inv.currentStock) || 0) : (Number(p.stockQuantity ?? p.stock_quantity) || 0);
      const reorderPoint = inv ? (Number(inv.reorder_point ?? inv.reorderPoint) || 0) : (Number(p.minStockLevel ?? p.min_stock_level) || 0);
      const cost = Number(p.costPrice ?? p.cost_price) || 0;
      productMap.set(sid, {
        _id: id,
        name: p.name || p.displayName || 'Product',
        inventory: { currentStock, reorderPoint },
        pricing: { cost }
      });
    }
    for (const id of productIds) {
      if (productMap.has(id)) continue;
      const v = await productVariantRepository.findById(id);
      if (v) {
        const inv = invByProduct.get(id);
        const invData = v.inventory_data || v.inventory || {};
        const parsed = typeof invData === 'string' ? (() => { try { return JSON.parse(invData || '{}'); } catch { return {}; } })() : invData;
        const currentStock = inv ? (Number(inv.current_stock ?? inv.currentStock) || 0) : (Number(parsed.currentStock ?? parsed.current_stock) || 0);
        const reorderPoint = inv ? (Number(inv.reorder_point ?? inv.reorderPoint) || 0) : (Number(parsed.reorderPoint ?? parsed.reorder_point) || 0);
        const pricing = v.pricing;
        const costObj = typeof pricing === 'string' ? (() => { try { return JSON.parse(pricing || '{}'); } catch { return {}; } })() : (pricing || {});
        const cost = Number(costObj?.cost ?? costObj?.cost_price ?? 0) || 0;
        productMap.set(id, {
          _id: v.id || v._id,
          name: v.display_name || v.variant_name || v.displayName || v.variantName || 'Variant',
          isVariant: true,
          inventory: { currentStock, reorderPoint },
          pricing: { cost }
        });
      }
    }

    return items.map(item => {
      const i = { ...item };
      const p = i.product || i.product_id;
      const id = !p ? null : (typeof p === 'string' ? p : (p._id || p.id || p));
      const sid = id && typeof id === 'string' ? id : (id && id.toString ? id.toString() : null);
      if (sid && productMap.has(sid)) {
        i.product = productMap.get(sid);
      }
      return i;
    });
  }

  /**
   * Transform product names to uppercase
   * @param {object} product - Product to transform
   * @returns {object} - Transformed product
   */
  transformProductToUppercase(product) {
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
  }

  /**
   * Build filter query from request parameters
   * @param {object} queryParams - Request query parameters
   * @returns {Promise<object>} - MongoDB filter object
   */
  async buildFilter(queryParams) {
    const filter = {};

    if (queryParams.productSearch) {
      const matchingProducts = await productRepository.search(queryParams.productSearch.trim(), 1000);
      if (matchingProducts.length > 0) {
        filter.productIds = matchingProducts.map(p => (p.id != null ? p.id : (p._id && p._id.toString && p._id.toString()))).filter(Boolean);
      } else {
        filter.productIds = ['__none__'];
      }
    }

    if (queryParams.search) {
      const searchTerm = String(queryParams.search).trim();
      filter.search = searchTerm;
      const customerMatches = await customerRepository.search(searchTerm, { limit: 1000 });
      if (customerMatches.length > 0) {
        filter.searchCustomerIds = customerMatches.map(c => (c.id != null ? c.id : (c._id && c._id.toString && c._id.toString()))).filter(Boolean);
      }
    }

    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.paymentStatus) filter.paymentStatus = queryParams.paymentStatus;
    if (queryParams.customerId) filter.customerId = queryParams.customerId;

    const { parseDateParams } = require('../utils/dateFilter');
    const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');
    const { startDate, endDate } = parseDateParams(queryParams);
    const dateFrom = startDate || queryParams.dateFrom;
    const dateTo = endDate || queryParams.dateTo;
    if (dateFrom) {
      filter.dateFrom = getStartOfDayPakistan(dateFrom);
    }
    if (dateTo) {
      filter.dateTo = getEndOfDayPakistan(dateTo);
    }

    return filter;
  }

  /**
   * Get sales orders with filtering and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getSalesOrders(queryParams) {
    const getAllOrders = queryParams.all === 'true' || queryParams.all === true ||
      (queryParams.limit && parseInt(queryParams.limit) >= 999999);

    const page = getAllOrders ? 1 : (parseInt(queryParams.page) || 1);
    const limit = getAllOrders ? 999999 : (parseInt(queryParams.limit) || 20);

    const filter = await this.buildFilter(queryParams);

    const result = await salesRepository.findWithPagination(filter, {
      page,
      limit,
      sort: 'created_at DESC'
    });

    const sales = result.sales || [];
    const customerIds = [...new Set(sales.map(o => o.customer_id).filter(Boolean))];
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    const customerMap = new Map();
    for (const cid of customerIds) {
      const cust = await customerRepository.findById(cid);
      if (cust) customerMap.set(cid, this.transformCustomerToUppercase(cust));
    }

    const orders = await Promise.all(sales.map(async (order) => {
      const o = { ...order };
      // Add pricing object for frontend consistency (Dashboard, Print, P&L matching)
      const discount = parseFloat(o.discount) || 0;
      const subtotal = parseFloat(o.subtotal) || 0;
      const tax = parseFloat(o.tax) || 0;
      const total = parseFloat(o.total) || 0;
      o.pricing = { subtotal, total, discountAmount: discount, taxAmount: tax };
      o.discountAmount = discount; // Alias for Dashboard salesInvoicesDiscounts
      if (o.customer_id && customerMap.has(o.customer_id)) {
        o.customer = customerMap.get(o.customer_id);
        const bal = balanceMap.get(o.customer_id) || 0;
        const ob = o.customer.opening_balance ?? o.customer.openingBalance ?? 0;
        o.customer.currentBalance = ob + bal;
        o.customer.pendingBalance = (ob + bal) > 0 ? (ob + bal) : 0;
        o.customer.advanceBalance = (ob + bal) < 0 ? Math.abs(ob + bal) : 0;
      }
      if (o.items && Array.isArray(o.items)) {
        o.items = await this.enrichItemsWithProductNames(o.items);
        o.items = o.items.map(item => {
          const i = { ...item };
          if (i.product) i.product = this.transformProductToUppercase(i.product);
          return i;
        });
      }
      return o;
    }));

    return {
      orders,
      pagination: result.pagination || { page, limit, total: orders.length, pages: 1 }
    };
  }

  /**
   * Get single sales order by ID
   * @param {string} id - Order ID
   * @returns {Promise<object>}
   */
  async getSalesOrderById(id) {
    const order = await salesRepository.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    // Fetch customer details if exists
    if (order.customer_id) {
      const customer = await customerRepository.findById(order.customer_id);
      if (customer) {
        order.customer = this.transformCustomerToUppercase(customer);
        const balance = await AccountingService.getCustomerBalance(order.customer_id);

        order.customer.currentBalance = balance;
        order.customer.pendingBalance = balance > 0 ? balance : 0;
        order.customer.advanceBalance = balance < 0 ? Math.abs(balance) : 0;

        // customerInfo for print: include formatted address (handle address as array or object from JSONB)
        const addrRaw = customer.address;
        let addressStr = '';
        if (typeof addrRaw === 'string') addressStr = addrRaw;
        else if (Array.isArray(addrRaw) && addrRaw.length > 0) {
          const a = addrRaw.find(ad => ad.isDefault) || addrRaw.find(ad => ad.type === 'billing' || ad.type === 'both') || addrRaw[0];
          addressStr = [a.street || a.address_line1 || a.addressLine1, a.city, a.state || a.province, a.country, a.zipCode || a.zip || a.postalCode].filter(Boolean).join(', ');
        } else if (addrRaw && typeof addrRaw === 'object') {
          addressStr = [addrRaw.street || addrRaw.address_line1 || addrRaw.addressLine1, addrRaw.city, addrRaw.state || addrRaw.province, addrRaw.country, addrRaw.zipCode || addrRaw.zip || addrRaw.postalCode].filter(Boolean).join(', ');
        }
        order.customerInfo = {
          name: customer.business_name || customer.businessName || customer.name,
          businessName: customer.business_name || customer.businessName,
          email: customer.email,
          phone: customer.phone,
          address: addressStr,
        };
      }
    }

    // Enrich items with product names and transform to uppercase
    if (order.items && Array.isArray(order.items)) {
      order.items = await this.enrichItemsWithProductNames(order.items);
      order.items.forEach(item => {
        if (item.product) {
          item.product = this.transformProductToUppercase(item.product);
        }
      });
    }

    // Attach payment.amountPaid for invoice/print (stored on sale, or payments table, or paid-at-creation)
    const orderId = order.id || order._id;
    let amountPaid = parseFloat(order.amount_paid);
    if (Number.isNaN(amountPaid) || amountPaid < 0) amountPaid = 0;
    if (amountPaid === 0) {
      try {
        amountPaid = await paymentRepository.calculateTotalPaid(orderId);
      } catch (_) { /* ignore */ }
    }
    if (amountPaid === 0) {
      try {
        const ledgerResult = await query(
          `SELECT COALESCE(SUM(credit_amount), 0) AS total
           FROM account_ledger
           WHERE reference_type = 'sale_payment'
             AND reference_id::text = $1
             AND account_code = '1100'
             AND status = 'completed'
             AND reversed_at IS NULL`,
          [String(orderId)]
        );
        amountPaid = parseFloat(ledgerResult.rows[0]?.total || 0);
      } catch (_) { /* ignore */ }
    }
    if (amountPaid === 0 && (order.payment_status === 'paid' || order.paymentStatus === 'paid')) {
      amountPaid = parseFloat(order.total) || 0;
    }
    order.payment = {
      ...(order.payment || {}),
      amountPaid,
      method: order.payment?.method || order.payment_method || 'N/A',
      status: order.payment?.status || order.payment_status || 'pending',
    };

    // Add pricing object for frontend consistency (Print, P&L matching)
    const discount = parseFloat(order.discount) || 0;
    const subtotal = parseFloat(order.subtotal) || 0;
    const tax = parseFloat(order.tax) || 0;
    const total = parseFloat(order.total) || 0;
    order.pricing = { subtotal, total, discountAmount: discount, taxAmount: tax };
    order.discountAmount = discount;

    return order;
  }

  /**
   * Get period summary
   * @param {Date} dateFrom - Start date
   * @param {Date} dateTo - End date
   * @returns {Promise<object>}
   */
  async getPeriodSummary(dateFrom, dateTo) {
    const raw = await salesRepository.findByDateRange(dateFrom, dateTo);
    const orders = Array.isArray(raw) ? raw : [];

    const totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0);
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) => {
      const items = Array.isArray(order?.items) ? order.items : [];
      return sum + items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
    }, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate discounts
    const totalDiscounts = orders.reduce((sum, order) =>
      sum + (parseFloat(order?.discount) || 0), 0);

    // Calculate by payment status (orderType not in PostgreSQL schema, using payment_status)
    const revenueByPaymentStatus = {
      paid: orders.filter(o => o && (o.payment_status === 'paid'))
        .reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0),
      pending: orders.filter(o => o && (o.payment_status === 'pending'))
        .reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0),
      partial: orders.filter(o => o && (o.payment_status === 'partial'))
        .reduce((sum, order) => sum + (parseFloat(order?.total) || 0), 0)
    };

    return {
      totalRevenue,
      totalOrders,
      totalItems,
      averageOrderValue,
      totalDiscounts,
      revenueByType: {}, // Not available in PostgreSQL schema
      ordersByType: {}, // Not available in PostgreSQL schema
      revenueByPaymentStatus
    };
  }

  // Duplicate method removed - using the one above

  /**
   * Create a new sale (invoice)
   * @param {object} data - Sale data
   * @param {object} user - User creating the sale
   * @param {object} options - Options (skipInventoryUpdate)
   * @returns {Promise<object>}
   */
  async createSale(data, user, options = {}) {
    const { skipInventoryUpdate = false } = options;
    const { customer, items, orderType, payment, notes, isTaxExempt, billDate, billStartTime, salesOrderId, appliedDiscounts: payloadDiscounts, discountAmount: payloadDiscountAmount, subtotal: payloadSubtotal, total: payloadTotal, tax: payloadTax } = data;

    // Validate customer if provided
    let customerData = null;
    if (customer) {
      customerData = await customerRepository.findById(customer);
      if (!customerData) {
        throw new Error('Customer not found');
      }
    }

    // Prepare order items and calculate pricing
    const orderItems = [];
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    for (const item of items) {
      // Try to find as product first, then as variant
      let product = await productRepository.findById(item.product);
      let isVariant = false;

      if (!product) {
        product = await productVariantRepository.findById(item.product);
        if (product) isVariant = true;
      }

      if (!product) {
        throw new Error(`Product or variant ${item.product} not found`);
      }

      // pricing logic (same as in sales.js)
      let unitPrice = item.unitPrice;
      if (unitPrice === undefined || unitPrice === null) {
        const customerType = customerData ? (customerData.business_type || customerData.businessType) : 'retail';
        if (isVariant) {
          const pricing = product.pricing || {};
          unitPrice = (customerType === 'wholesale' || customerType === 'distributor')
            ? (pricing.wholesale ?? pricing.retail ?? 0)
            : (pricing.retail ?? 0);
        } else {
          unitPrice = product.selling_price ?? product.pricing?.retail ?? 0;
        }
      }

      const itemDiscountPercent = item.discountPercent || 0;
      const itemSubtotal = item.quantity * unitPrice;
      const itemDiscount = itemSubtotal * (itemDiscountPercent / 100);
      const itemTaxable = itemSubtotal - itemDiscount;
      const taxRate = isVariant ? (product.baseProduct?.taxSettings?.taxRate ?? 0) : (product.tax_settings?.tax_rate ?? product.taxSettings?.taxRate ?? 0);
      const itemTax = isTaxExempt ? 0 : itemTaxable * taxRate;

      let unitCost = 0;
      const productId = product.id || product._id;
      const inv = await inventoryRepository.findByProduct(productId);
      if (inv && inv.cost) {
        const costObj = typeof inv.cost === 'string' ? JSON.parse(inv.cost) : inv.cost;
        unitCost = costObj.average ?? costObj.lastPurchase ?? 0;
      }
      if (unitCost === 0) unitCost = product.pricing?.cost ?? product.cost_price ?? 0;

      orderItems.push({
        product: productId,
        quantity: item.quantity,
        unitCost,
        unitPrice,
        discountPercent: itemDiscountPercent,
        taxRate,
        subtotal: itemSubtotal,
        discountAmount: itemDiscount,
        taxAmount: itemTax,
        total: itemSubtotal - itemDiscount + itemTax
      });

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
    }

    let orderTotal = subtotal - totalDiscount + totalTax;
    let finalDiscount = totalDiscount;
    let finalTax = totalTax;
    const appliedDiscountsForSale = Array.isArray(payloadDiscounts) ? payloadDiscounts : [];

    if (appliedDiscountsForSale.length > 0 && (payloadDiscountAmount != null || payloadTotal != null)) {
      if (payloadDiscountAmount != null) finalDiscount = Number(payloadDiscountAmount);
      if (payloadTax != null) finalTax = Number(payloadTax);
      if (payloadTotal != null) orderTotal = Number(payloadTotal);
      else orderTotal = subtotal - finalDiscount + finalTax;
    }

    // Check credit limit for credit sales (account payment or partial payment)
    if (customerData && (customerData.credit_limit || customerData.creditLimit) > 0) {
      const creditLimit = customerData.credit_limit || customerData.creditLimit;
      const amountPaid = payment.amount || 0;
      const unpaidAmount = orderTotal - amountPaid;

      if (payment.method === 'account' || unpaidAmount > 0) {
        // Fetch real-time balance from ledger for credit check
        const customerId = customerData.id || customerData._id;
        const currentBalance = await AccountingService.getCustomerBalance(customerId);
        const newBalanceAfterOrder = currentBalance + unpaidAmount;

        if (newBalanceAfterOrder > creditLimit) {
          const customerName = customerData.business_name || customerData.businessName || customerData.name || 'Customer';
          throw new Error(`Credit limit exceeded for customer ${customerName}. Available credit: ${creditLimit - currentBalance}`);
        }
      }
    }

    // Inventory Updates (unless skipped)
    if (!skipInventoryUpdate) {
      for (const item of items) {
        await inventoryService.updateStock({
          productId: item.product,
          type: 'out',
          quantity: item.quantity,
          reason: 'Sales Invoice Creation',
          reference: 'Sales Invoice',
          performedBy: user._id,
          notes: `Stock reduced due to sales invoice creation`
        });
      }
    }

    // Generate order number if not provided (sales/invoices use INV-, not SO- which is for sales orders only)
    const orderNumber = data.orderNumber || `INV-${Date.now()}`;

    // Prepare sale data for PostgreSQL (include applied discount codes when provided from POS)
    const amountPaidAtCreate = parseFloat(payment?.amount ?? 0) || 0;
    const saleData = {
      orderNumber,
      customerId: customer || null,
      saleDate: parseLocalDate(billDate) || new Date(),
      items: orderItems,
      subtotal,
      discount: finalDiscount,
      tax: finalTax,
      total: orderTotal,
      amountPaid: amountPaidAtCreate,
      paymentMethod: payment.method,
      paymentStatus: payment.isPartialPayment ? 'partial' : (String(payment.method || '').toLowerCase() === 'cash' ? 'paid' : 'pending'),
      status: 'confirmed',
      notes,
      createdBy: user.id || user._id?.toString(),
      appliedDiscounts: appliedDiscountsForSale,
      orderType: orderType || 'retail'
    };

    const order = await transaction(async (client) => {
      return await salesRepository.create(saleData, client);
    });

    // Record discount usage for each applied code (so usage limits are updated)
    for (const applied of appliedDiscountsForSale) {
      const code = applied.code || applied.discountCode;
      const amount = Number(applied.amount ?? 0);
      if (code && amount >= 0) {
        try {
          await discountService.recordDiscountUsage(code, customer || null, amount, order.id);
        } catch (e) {
          console.error('Failed to record discount usage for', code, e.message);
        }
      }
    }

    const paymentStatus = order.payment_status ?? order.paymentStatus ?? saleData.paymentStatus;
    const orderStatus = order.status ?? saleData.status;

    const orderPayload = {
      _id: order.id,
      id: order.id,
      items: orderItems,
      status: orderStatus,
      payment_status: paymentStatus,
      paymentStatus,
      orderNumber: order.order_number ?? order.orderNumber,
      createdAt: order.created_at ?? order.createdAt,
      payment: paymentStatus ? { status: paymentStatus } : undefined
    };

    await StockMovementService.trackSalesOrder(orderPayload, user, {});

    if (orderStatus === 'confirmed' && paymentStatus === 'paid') {
      await profitDistributionService.distributeProfitForOrder(orderPayload, user, {});
    }

    if (customer && orderTotal > 0) {
      const amountPaid = payment.amount || 0;
      const isAccountPayment = payment.method === 'account' || amountPaid < orderTotal;

      if (isAccountPayment) {
        const productIds = orderItems.map(item => item.product);
        const productMap = new Map();
        for (const id of productIds) {
          const p = await productRepository.findById(id);
          if (p) productMap.set((id && id.toString ? id.toString() : id), p.name || p.displayName || 'Product');
        }

        const lineItems = orderItems.map(item => ({
          product: item.product,
          description: productMap.get((item.product && item.product.toString ? item.product.toString() : item.product)) || 'Product',
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
          discountAmount: item.discountAmount || 0,
          taxAmount: item.taxAmount || 0,
          totalPrice: item.total || 0
        }));

        await customerTransactionService.createTransaction({
          customerId: customer,
          transactionType: 'invoice',
          netAmount: orderTotal,
          grossAmount: subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          referenceType: 'sales_order',
          referenceId: order.id,
          referenceNumber: order.order_number,
          lineItems,
          notes: `Invoice for sale ${order.order_number}${salesOrderId ? ' (from SO)' : ''}`
        }, user, {});
      }

      if (amountPaid > 0) {
        await CustomerBalanceService.recordPayment(
          customer,
          amountPaid,
          order.id,
          user,
          { paymentMethod: payment.method, paymentReference: order.order_number }
        );
      }
    }

    await AccountingService.recordSale(order, {});

    // Post payment to ledger when sale is created with amount paid (so balance reflects payment)
    if (amountPaidAtCreate > 0 && customer) {
      try {
        await AccountingService.recordSalePaymentAdjustment({
          saleId: order.id || order._id,
          orderNumber: order.order_number || order.orderNumber,
          customerId: customer,
          oldAmountPaid: 0,
          newAmountPaid: amountPaidAtCreate,
          paymentMethod: payment?.method || 'cash',
          createdBy: user?.id || user?._id
        });
      } catch (ledgerErr) {
        console.error('Failed to post sale payment to ledger on create:', ledgerErr);
      }
    }

    const createdSale = await salesRepository.findById(order.id);
    if (createdSale && createdSale.customer_id) {
      const customerDetails = await customerRepository.findById(createdSale.customer_id);
      createdSale.customer = customerDetails;
    }

    return createdSale;
  }

  /**
   * Create a sale (invoice) from a sales order (plain object from Postgres).
   * @param {object} salesOrder - Sales order (id, customer_id, items, so_number, etc.)
   * @param {object} user - User
   * @returns {Promise<object>} Created sale
   */
  async createSaleFromSalesOrder(salesOrder, user) {
    const customerId = salesOrder.customer_id || salesOrder.customer;
    const items = Array.isArray(salesOrder.items) ? salesOrder.items : (typeof salesOrder.items === 'string' ? JSON.parse(salesOrder.items || '[]') : []);
    const saleData = {
      customer: customerId,
      items: items.map(i => ({
        product: i.product || i.product_id,
        quantity: i.quantity || 0,
        unitPrice: i.unitPrice ?? i.unit_price ?? 0,
        discountPercent: i.discountPercent ?? i.discount_percent ?? 0
      })),
      orderType: 'retail',
      payment: { method: 'account', amount: 0, isPartialPayment: false },
      notes: `From Sales Order ${salesOrder.so_number || salesOrder.soNumber || salesOrder.id}`,
      isTaxExempt: salesOrder.is_tax_exempt ?? salesOrder.isTaxExempt ?? false,
      billDate: salesOrder.order_date || salesOrder.orderDate || new Date(),
      salesOrderId: salesOrder.id || salesOrder._id,
      orderNumber: `INV-${(salesOrder.so_number || salesOrder.soNumber || salesOrder.id || '').toString().replace(/^SO-/, '')}`
    };
    return await this.createSale(saleData, user, { skipInventoryUpdate: true });
  }

  /**
   * Update order status
   * @param {string} id - Order ID
   * @param {string} status - New status
   * @param {object} user - User performing the update
   * @returns {Promise<object>}
   */
  async updateStatus(id, status, user) {
    const order = await salesRepository.findById(id);
    if (!order) {
      throw new Error('Order not found');
    }

    // Update status in PostgreSQL
    const updatedOrder = await salesRepository.update(id, {
      status,
      updatedBy: user.id || user._id?.toString()
    });

    if (status === 'cancelled' && order.items) {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        if (item.product) {
          await inventoryService.updateStock({
            productId: item.product,
            type: 'in',
            quantity: item.quantity || 0,
            reason: 'Sale cancelled',
            reference: 'Sales',
            referenceId: order.id,
            performedBy: user.id || user._id?.toString(),
            notes: 'Stock restored due to sale cancellation'
          });
        }
      }

      // Note: Reversing customer balance is now handled by the ledger/transactions.
      // If we need to reverse a specific transaction, we should call customerTransactionService.reverseTransaction.
    }

    return updatedOrder;
  }

  /**
   * Update order details
   * @param {string} id - Order ID
   * @param {object} updateData - Data to update
   * @param {object} user - User performing the update
   * @returns {Promise<object>}
   */
  async updateOrder(id, updateData, user) {
    const order = await salesRepository.findById(id);
    if (!order) {
      throw new Error('Order not found');
    }

    // Prepare update data for PostgreSQL
    const pgUpdateData = {
      updatedBy: user.id || user._id?.toString()
    };

    if (updateData.customer !== undefined) {
      pgUpdateData.customerId = updateData.customer || null;
    }

    if (updateData.notes !== undefined) {
      pgUpdateData.notes = updateData.notes;
    }

    if (updateData.billDate !== undefined) {
      pgUpdateData.saleDate = parseLocalDate(updateData.billDate);
    }

    // Update items if provided (would need to recalculate pricing)
    if (updateData.items && updateData.items.length > 0) {
      pgUpdateData.items = updateData.items;
      // Note: Pricing recalculation would need to be done here
      // For now, assuming items already have correct pricing
    }

    const updatedOrder = await salesRepository.update(id, pgUpdateData);

    return updatedOrder;
  }

  /**
   * Post to account_ledger any sales (invoices) that were never recorded.
   * Use for backfilling previous sale/invoice entries that were created before ledger posting was fixed.
   * @param {object} options - { dateFrom?, dateTo? } optional date range (sale_date)
   * @returns {Promise<{ posted: number, skipped: number, errors: Array<{ saleId, message }> }>}
   */
  async postMissingSalesToLedger(options = {}) {
    const alreadyPosted = await AccountingService.getSaleIdsAlreadyPosted();
    const filters = {};
    if (options.dateFrom) filters.dateFrom = options.dateFrom;
    if (options.dateTo) filters.dateTo = options.dateTo;
    const sales = await salesRepository.findAll(filters, { limit: 10000 });
    let posted = 0;
    const errors = [];
    for (const sale of sales) {
      const idStr = sale.id && sale.id.toString();
      if (alreadyPosted.has(idStr)) continue;
      try {
        await AccountingService.recordSale(sale);
        posted++;
        alreadyPosted.add(idStr);
      } catch (err) {
        errors.push({ saleId: idStr, orderNumber: sale.order_number || sale.orderNumber, message: err.message || String(err) });
      }
    }
    return { posted, skipped: sales.length - posted - errors.length, errors };
  }

  /**
   * Sync existing sales to ledger (update amounts/dates/customer; post missing).
   * Use to fix previously edited invoices that didn't reflect in ledger.
   * @param {object} options - { dateFrom?, dateTo? } optional date range (sale_date)
   * @returns {Promise<{ posted: number, updated: number, skipped: number, errors: Array<{ saleId, message }> }>}
   */
  async syncSalesLedger(options = {}) {
    const filters = {};
    if (options.dateFrom) filters.dateFrom = options.dateFrom;
    if (options.dateTo) filters.dateTo = options.dateTo;
    const sales = await salesRepository.findAll(filters, { limit: 10000 });
    let posted = 0;
    let updated = 0;
    const errors = [];
    for (const sale of sales) {
      const idStr = sale.id && sale.id.toString();
      try {
        const hasLedger = await AccountingService.hasSaleLedgerEntries(idStr);
        if (!hasLedger) {
          await AccountingService.recordSale(sale);
          posted++;
        } else {
          const refNum = sale.order_number || sale.orderNumber || sale.id;
          const txnDate = sale.sale_date || sale.saleDate || sale.created_at || sale.createdAt || new Date();
          const customerId = sale.customer_id || sale.customerId || null;
          await AccountingService.updateSaleLedgerEntries({
            saleId: idStr,
            total: sale.total,
            transactionDate: txnDate,
            customerId,
            referenceNumber: refNum
          });
          updated++;
        }
      } catch (err) {
        errors.push({ saleId: idStr, orderNumber: sale.order_number || sale.orderNumber, message: err.message || String(err) });
      }
    }
    return { posted, updated, skipped: sales.length - posted - updated - errors.length, errors };
  }
}

module.exports = new SalesService();
