const purchaseOrderRepository = require('../repositories/postgres/PurchaseRepository');
const supplierRepository = require('../repositories/postgres/SupplierRepository');
const productRepository = require('../repositories/postgres/ProductRepository');
const productVariantRepository = require('../repositories/postgres/ProductVariantRepository');
const AccountingService = require('./accountingService');

// Format supplier address for print/display
function formatSupplierAddress(supplierData) {
  if (!supplierData) return '';
  if (supplierData.address && typeof supplierData.address === 'string') return supplierData.address.trim();
  const addrRaw = supplierData.address ?? supplierData.addresses;
  if (Array.isArray(addrRaw) && addrRaw.length > 0) {
    const a = addrRaw.find(x => x.isDefault) || addrRaw.find(x => x.type === 'billing' || x.type === 'both') || addrRaw[0];
    const parts = [a.street || a.address_line1 || a.addressLine1 || a.line1, a.city, a.state || a.province, a.country, a.zipCode || a.zip || a.postalCode || a.postal_code].filter(Boolean);
    return parts.join(', ');
  }
  if (addrRaw && typeof addrRaw === 'object' && !Array.isArray(addrRaw)) {
    const parts = [addrRaw.street || addrRaw.address_line1 || addrRaw.addressLine1 || addrRaw.line1, addrRaw.city, addrRaw.state || addrRaw.province, addrRaw.country, addrRaw.zipCode || addrRaw.zip || addrRaw.postalCode || addrRaw.postal_code].filter(Boolean);
    return parts.join(', ');
  }
  return '';
}

class PurchaseOrderService {
  /**
   * Transform supplier names to uppercase
   * @param {object} supplier - Supplier to transform
   * @returns {object} - Transformed supplier
   */
  transformSupplierToUppercase(supplier) {
    if (!supplier) return supplier;
    if (supplier.toObject) supplier = supplier.toObject();
    const name = supplier.companyName || supplier.company_name;
    if (name) supplier.companyName = (typeof name === 'string' ? name : '').toUpperCase();
    const cp = supplier.contactPerson || supplier.contact_person;
    if (cp && (typeof cp === 'object' ? cp.name : cp)) {
      if (!supplier.contactPerson) supplier.contactPerson = {};
      supplier.contactPerson.name = String(cp.name || cp).toUpperCase();
    }
    return supplier;
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
   * @returns {object} - MongoDB filter object
   */
  buildFilter(queryParams) {
    const filter = {};

    // Search filter
    if (queryParams.search) {
      filter.$or = [
        { poNumber: { $regex: queryParams.search, $options: 'i' } },
        { notes: { $regex: queryParams.search, $options: 'i' } }
      ];
    }

    // Status filter
    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    // Supplier filter
    if (queryParams.supplier) {
      filter.supplier = queryParams.supplier;
    }

    // Date range filter - use dateFilter from middleware if available (Pakistan timezone)
    if (queryParams.dateFilter && Object.keys(queryParams.dateFilter).length > 0) {
      Object.assign(filter, queryParams.dateFilter);
    } else if (queryParams.dateFrom || queryParams.dateTo) {
      // Legacy date filtering (for backward compatibility)
      const { buildDateRangeFilter } = require('../utils/dateFilter');
      const dateFilter = buildDateRangeFilter(queryParams.dateFrom, queryParams.dateTo, 'createdAt');
      Object.assign(filter, dateFilter);
    }

    return filter;
  }

  /**
   * Get purchase orders with filtering and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getPurchaseOrders(queryParams) {
    const getAllPurchaseOrders = queryParams.all === 'true' || queryParams.all === true ||
      (queryParams.limit && parseInt(queryParams.limit) >= 999999);

    const page = getAllPurchaseOrders ? 1 : (parseInt(queryParams.page) || 1);
    const limit = getAllPurchaseOrders ? 999999 : (parseInt(queryParams.limit) || 20);

    const filter = this.buildFilter(queryParams);

    // Convert MongoDB-style filter to PostgreSQL filter
    const pgFilter = {};
    if (filter.supplier) pgFilter.supplierId = filter.supplier;
    if (filter.status) pgFilter.status = filter.status;
    if (filter.poNumber) pgFilter.purchaseOrderNumber = filter.poNumber;
    if (queryParams.dateFrom) pgFilter.dateFrom = queryParams.dateFrom;
    if (queryParams.dateTo) pgFilter.dateTo = queryParams.dateTo;
    if (filter.dateFilter?.orderDate) {
      if (filter.dateFilter.orderDate.$gte) pgFilter.dateFrom = filter.dateFilter.orderDate.$gte;
      if (filter.dateFilter.orderDate.$lte) pgFilter.dateTo = filter.dateFilter.orderDate.$lte;
    }

    const result = await purchaseOrderRepository.findWithPagination(pgFilter, {
      page,
      limit,
      sort: 'created_at DESC'
    });

    // Fetch dynamic balances from ledger for all suppliers in this page
    const supplierIds = result.purchases
      .filter(po => po.supplier_id)
      .map(po => po.supplier_id);

    const balanceMap = supplierIds.length > 0
      ? await AccountingService.getBulkSupplierBalances(supplierIds)
      : new Map();

    // Fetch supplier details, enrich items with products, and transform
    for (const purchase of result.purchases) {
      if (purchase.supplier_id) {
        const supplier = await supplierRepository.findById(purchase.supplier_id);
        if (supplier) {
          purchase.supplier = this.transformSupplierToUppercase(supplier);
          purchase.supplierInfo = { ...purchase.supplierInfo, address: formatSupplierAddress(supplier) || purchase.supplierInfo?.address };
          const ledgerBalance = balanceMap.get(purchase.supplier_id) || 0;
          const netBalance = (supplier.opening_balance || 0) + ledgerBalance;

          purchase.supplier.currentBalance = netBalance;
          purchase.supplier.pendingBalance = netBalance > 0 ? netBalance : 0;
          purchase.supplier.advanceBalance = netBalance < 0 ? Math.abs(netBalance) : 0;
        }
      }
      if (purchase.items && Array.isArray(purchase.items)) {
        for (const item of purchase.items) {
          const productId = item.product_id || item.product;
          if (!productId) continue;
          const id = typeof productId === 'object' ? (productId.id || productId._id) : productId;
          if (typeof id !== 'string') continue;
          if (typeof item.product === 'object' && item.product && (item.product.name || item.product.displayName)) continue;
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
            if (item.product) item.product = this.transformProductToUppercase(item.product);
          } catch (e) {
            // Keep item.product as-is on error
          }
        }
      }
    }

    return {
      purchaseOrders: result.purchases,
      pagination: {
        ...result.pagination,
        totalItems: result.pagination.total
      }
    };
  }

  /**
   * Get single purchase order by ID
   * @param {string} id - Purchase order ID
   * @returns {Promise<object>}
   */
  async getPurchaseOrderById(id) {
    const purchaseOrder = await purchaseOrderRepository.findById(id);

    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (purchaseOrder.items && typeof purchaseOrder.items === 'string') {
      purchaseOrder.items = JSON.parse(purchaseOrder.items);
    }

    if (purchaseOrder.supplier_id) {
      const supplier = await supplierRepository.findById(purchaseOrder.supplier_id);
      if (supplier) {
        purchaseOrder.supplier = this.transformSupplierToUppercase(supplier);
        purchaseOrder.supplierInfo = { ...purchaseOrder.supplierInfo, address: formatSupplierAddress(supplier) || purchaseOrder.supplierInfo?.address };
        const balance = await AccountingService.getSupplierBalance(purchaseOrder.supplier_id);
        purchaseOrder.supplier.currentBalance = balance;
        purchaseOrder.supplier.pendingBalance = balance > 0 ? balance : 0;
        purchaseOrder.supplier.advanceBalance = balance < 0 ? Math.abs(balance) : 0;
      }
    }
    if (purchaseOrder.items && Array.isArray(purchaseOrder.items)) {
      for (const item of purchaseOrder.items) {
        const productId = item.product_id || item.product;
        if (productId && (typeof productId === 'string' || typeof productId === 'object')) {
          const id = typeof productId === 'object' ? (productId.id || productId._id) : productId;
          const product = await productRepository.findById(id);
          if (product) {
            item.product = this.transformProductToUppercase(product);
          }
        } else if (item.product) {
          item.product = this.transformProductToUppercase(item.product);
        }
      }
    }

    return purchaseOrder;
  }

  /**
   * Create a new purchase order
   * @param {object} poData - Purchase order data
   * @param {string} userId - User ID creating the order
   * @returns {Promise<PurchaseOrder>}
   */
  async createPurchaseOrder(poData, userId) {
    // Generate PO number
    const poNumber = poData.poNumber || purchaseOrderRepository.generatePONumber();

    // Prepare purchase data for PostgreSQL
    const purchaseData = {
      purchaseOrderNumber: poNumber,
      supplierId: poData.supplier || poData.supplierId || null,
      purchaseDate: poData.orderDate || new Date(),
      items: poData.items || [],
      subtotal: poData.subtotal || 0,
      discount: poData.discount || 0,
      tax: poData.tax || 0,
      total: poData.total || 0,
      paymentMethod: poData.paymentMethod || null,
      paymentStatus: 'pending',
      status: poData.status || 'draft',
      notes: poData.notes || null,
      createdBy: userId
    };

    const purchaseOrder = await purchaseOrderRepository.create(purchaseData);

    // Note: Manual increment of supplier.pendingBalance removed.
    // Balances are now dynamically derived from the Account Ledger transactions.

    // Fetch supplier details if exists
    if (purchaseOrder.supplier_id) {
      const supplier = await supplierRepository.findById(purchaseOrder.supplier_id);
      if (supplier) {
        purchaseOrder.supplier = supplier;
      }
    }

    return purchaseOrder;
  }

  /**
   * Update an existing purchase order
   * @param {string} id - Purchase order ID
   * @param {object} updateData - Update data
   * @param {string} userId - User ID performing the update
   * @returns {Promise<PurchaseOrder>}
   */
  async updatePurchaseOrder(id, updateData, userId) {
    const purchaseOrder = await purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (['confirmed', 'partially_received', 'fully_received'].includes(purchaseOrder.status)) {
      throw new Error('Cannot edit purchase order that has been confirmed or received');
    }

    const updatedData = { ...updateData, updatedBy: userId };

    const updatedPO = await purchaseOrderRepository.update(id, updatedData);
    if (!updatedPO) return null;

    if (updatedPO.items && typeof updatedPO.items === 'string') {
      updatedPO.items = JSON.parse(updatedPO.items);
    }
    if (updatedPO.supplier_id) {
      updatedPO.supplier = await supplierRepository.findById(updatedPO.supplier_id);
    }

    return updatedPO;
  }

  /**
   * Confirm a purchase order
   * @param {string} id - Purchase order ID
   * @returns {Promise<PurchaseOrder>}
   */
  async confirmPurchaseOrder(id) {
    const purchaseOrder = await purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (purchaseOrder.status !== 'draft') {
      throw new Error('Only draft purchase orders can be confirmed');
    }

    const updatedPO = await purchaseOrderRepository.update(id, {
      status: 'confirmed'
    });

    return updatedPO;
  }

  /**
   * Cancel a purchase order
   * @param {string} id - Purchase order ID
   * @param {string} userId - User ID performing the cancellation
   * @returns {Promise<PurchaseOrder>}
   */
  async cancelPurchaseOrder(id, userId) {
    const purchaseOrder = await purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (['fully_received', 'cancelled', 'closed'].includes(purchaseOrder.status)) {
      throw new Error('Cannot cancel purchase order in current status');
    }

    const updated = await purchaseOrderRepository.update(id, {
      status: 'cancelled',
      updatedBy: userId
    });
    return updated || purchaseOrder;
  }

  /**
   * Close a purchase order
   * @param {string} id - Purchase order ID
   * @param {string} userId - User ID performing the closure
   * @returns {Promise<PurchaseOrder>}
   */
  async closePurchaseOrder(id, userId) {
    const purchaseOrder = await purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (purchaseOrder.status !== 'fully_received' && purchaseOrder.status !== 'received') {
      throw new Error('Only fully received purchase orders can be closed');
    }

    const updatedPO = await purchaseOrderRepository.update(id, {
      status: 'completed',
      updatedBy: userId
    });

    return updatedPO;
  }

  /**
   * Delete a purchase order
   * @param {string} id - Purchase order ID
   * @returns {Promise<void>}
   */
  async deletePurchaseOrder(id) {
    const purchaseOrder = await purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (purchaseOrder.status !== 'draft') {
      throw new Error('Only draft purchase orders can be deleted');
    }

    await purchaseOrderRepository.softDelete(id);
  }

  /**
   * Get purchase order for conversion
   * @param {string} id - Purchase order ID
   * @returns {Promise<object>}
   */
  async getPurchaseOrderForConversion(id) {
    const purchaseOrder = await purchaseOrderRepository.findById(id);

    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    // Fetch supplier details if exists
    if (purchaseOrder.supplier_id) {
      const supplier = await supplierRepository.findById(purchaseOrder.supplier_id);
      if (supplier) {
        purchaseOrder.supplier = supplier;
      }
    }

    // Filter items that have remaining quantities (if items have remainingQuantity field)
    const items = Array.isArray(purchaseOrder.items) ? purchaseOrder.items : [];
    const availableItems = items.filter(item => !item.remainingQuantity || item.remainingQuantity > 0);

    return {
      purchaseOrder: {
        id: purchaseOrder.id,
        purchaseOrderNumber: purchaseOrder.purchase_order_number,
        supplier: purchaseOrder.supplier,
        status: purchaseOrder.status
      },
      availableItems
    };
  }

  /**
   * Automatically create a purchase invoice from a purchase order
   * @param {object} purchaseOrder - Purchase order object
   * @param {string} userId - User ID performing the action
   * @param {Array} convertItems - Specific items to convert (optional, if null converts all PO items)
   * @returns {Promise<object>}
   */
  async createInvoiceFromPurchaseOrder(purchaseOrder, userId, convertItems = null) {
    const purchaseInvoiceRepository = require('../repositories/postgres/PurchaseInvoiceRepository');

    let supplier = purchaseOrder.supplier;
    if (!supplier && purchaseOrder.supplier_id) {
      supplier = await supplierRepository.findById(purchaseOrder.supplier_id);
    }

    const items = convertItems || purchaseOrder.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * (item.costPerUnit || item.unit_cost || item.unitCost || 0)), 0);
    const poNum = purchaseOrder.purchase_order_number || purchaseOrder.poNumber;

    const invoiceNumber = `PI-${Date.now()}`;
    const invoiceData = {
      invoiceNumber,
      invoiceType: 'purchase',
      supplier: purchaseOrder.supplier_id || purchaseOrder.supplier?.id || purchaseOrder.supplier,
      supplierInfo: supplier ? {
        name: supplier.contact_person || supplier.company_name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        companyName: supplier.company_name || '',
        address: supplier.address || ''
      } : null,
      items: items.map(item => ({
        product: item.product_id || item.product,
        productName: item.displayName || 'Product',
        quantity: item.quantity,
        unitCost: item.costPerUnit || item.unit_cost || item.cost_per_unit || 0,
        totalCost: item.quantity * (item.costPerUnit || item.unit_cost || 0)
      })),
      pricing: { subtotal, discountAmount: 0, taxAmount: 0, total: subtotal },
      payment: { status: 'pending', method: 'credit', paidAmount: 0 },
      notes: purchaseOrder.notes || `Generated from Purchase Order ${poNum}`,
      terms: purchaseOrder.terms,
      status: 'confirmed',
      confirmedDate: new Date(),
      createdBy: userId,
      invoiceDate: new Date()
    };

    const invoice = await purchaseInvoiceRepository.create(invoiceData);
    
    // Post to account ledger
    try {
      const AccountingService = require('./accountingService');
      await AccountingService.recordPurchaseInvoice(invoice);
    } catch (error) {
      console.error('Error creating accounting entries for purchase invoice from PO:', error);
      // Don't fail the invoice creation if ledger posting fails
    }
    
    return invoice;
  }
}

module.exports = new PurchaseOrderService();

