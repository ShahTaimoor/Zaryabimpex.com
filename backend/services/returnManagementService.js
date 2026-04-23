const { transaction } = require('../config/postgres');
const CustomerBalanceService = require('../services/customerBalanceService');
const AccountingService = require('../services/accountingService');
const ReturnRepository = require('../repositories/postgres/ReturnRepository');
const SalesRepository = require('../repositories/SalesRepository');
const SalesOrderRepository = require('../repositories/SalesOrderRepository');
const PurchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');
const PurchaseOrderRepository = require('../repositories/PurchaseOrderRepository');
const ProductRepository = require('../repositories/postgres/ProductRepository');
const CustomerRepository = require('../repositories/postgres/CustomerRepository');
const SupplierRepository = require('../repositories/postgres/SupplierRepository');
const InventoryRepository = require('../repositories/postgres/InventoryRepository');
const InventoryBalanceRepository = require('../repositories/postgres/InventoryBalanceRepository');
const StockMovementRepository = require('../repositories/StockMovementRepository');
const cashPaymentRepository = require('../repositories/postgres/CashPaymentRepository');
const bankPaymentRepository = require('../repositories/postgres/BankPaymentRepository');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Extract a UUID string from a value that may be an object (with id/_id) or a string. Prevents passing full entity to UUID columns. */
function toUuid(value) {
  if (value == null) return null;
  if (typeof value === 'object') {
    const id = value.id ?? value._id;
    return toUuid(id);
  }
  const s = String(value).trim();
  return UUID_REGEX.test(s) ? s : null;
}

class ReturnManagementService {
  constructor() {
    this.returnReasons = [
      'defective', 'wrong_item', 'not_as_described', 'damaged_shipping',
      'changed_mind', 'duplicate_order', 'size_issue', 'quality_issue',
      'late_delivery', 'other'
    ];

    this.returnActions = [
      'refund', 'exchange', 'store_credit', 'repair', 'replace'
    ];
  }

  /**
   * Extract cost basis from order item with consistent fallback logic.
   * Uses only cost fields, NOT selling price, to ensure accurate valuation.
   * Fallback hierarchy:
   *   1. unit_cost (snake_case from DB)
   *   2. unitCost (camelCase from JS)
   *   3. cost_price (product field)
   *   4. costPrice (product field camelCase)
   *   5. 0 (if nothing found)
   * 
   * IMPORTANT: Does NOT fallback to unitPrice/unit_price as those are selling prices, not costs.
   */
  extractCostBasis(orderItem, product = null) {
    const cost = 
      orderItem?.unit_cost ?? 
      orderItem?.unitCost ?? 
      product?.cost_price ?? 
      product?.costPrice ?? 
      0;
    
    const numCost = Number(cost) || 0;
    if (numCost < 0) return 0;
    return numCost;
  }

  /** Fetch order from Postgres and normalize to shape expected by return logic (customer, supplier, items with _id and product). */
  async fetchAndNormalizeOrder(orderId, isPurchaseReturn) {
    let row = null;
    if (isPurchaseReturn) {
      row = await PurchaseInvoiceRepository.findById(orderId);
      if (!row) row = await PurchaseOrderRepository.findById(orderId);
    } else {
      row = await SalesRepository.findById(orderId);
      if (!row) row = await SalesOrderRepository.findById(orderId);
    }
    if (!row) return null;

    const id = row.id || row._id;
    let items = row.items;
    if (typeof items === 'string') items = JSON.parse(items);
    if (!Array.isArray(items)) items = [];

    const normalizedItems = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const productId = it.product || it.product_id;
      const product = productId ? await ProductRepository.findById(typeof productId === 'object' ? (productId.id || productId._id) : productId) : null;
      normalizedItems.push({
        ...it,
        _id: it.id || it._id || `${id}-${i}`,
        id: it.id || it._id || `${id}-${i}`,
        product: product || (productId ? { _id: productId, id: productId } : null)
      });
    }

    let customer = null;
    let supplier = null;
    if (row.customer_id) customer = await CustomerRepository.findById(row.customer_id);
    if (row.supplier_id) supplier = await SupplierRepository.findById(row.supplier_id);

    return {
      _id: id,
      id,
      customer_id: row.customer_id,
      supplier_id: row.supplier_id,
      customer: customer || row.customer_id,
      supplier: supplier || row.supplier_id,
      items: normalizedItems,
      createdAt: row.created_at || row.createdAt,
      orderDate: row.order_date || row.sale_date || row.invoice_date,
      orderNumber: row.order_number || row.so_number || row.invoice_number || row.po_number
    };
  }

  // Create a new return request (persisted in PostgreSQL)
  async createReturn(returnData, requestedBy) {
    const isPurchaseReturn = returnData.origin === 'purchase';

    const originalOrder = await this.fetchAndNormalizeOrder(returnData.originalOrder, isPurchaseReturn);

    if (!originalOrder) {
      throw new Error('Original order not found');
    }

    if (!isPurchaseReturn) {
      const eligibility = await this.checkReturnEligibility(originalOrder, returnData.items);
      if (!eligibility.eligible) {
        throw new Error(eligibility.reason);
      }
      await this.validateReturnItems(originalOrder, returnData.items);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Plain object for calculations (same shape as Mongo doc for calculateRefundAmounts)
    const returnRequest = {
      ...returnData,
      customer: isPurchaseReturn ? null : (originalOrder.customer?._id || originalOrder.customer),
      supplier: isPurchaseReturn ? (originalOrder.supplier?._id || originalOrder.supplier) : null,
      requestedBy,
      returnDate: today,
      status: 'completed',
      processedBy: requestedBy,
      receivedBy: requestedBy,
      policy: returnData.policy || { restockingFeePercent: 0 },
      items: returnData.items.map(item => ({ ...item }))
    };

    await this.calculateRefundAmounts(returnRequest);

    const totalRefundAmount = returnRequest.items.reduce((s, i) => s + (Number(i.refundAmount) || 0), 0);
    const totalRestockingFee = returnRequest.items.reduce((s, i) => s + (Number(i.restockingFee) || 0), 0);
    const netRefundAmount = totalRefundAmount - totalRestockingFee;
    returnRequest.totalRefundAmount = totalRefundAmount;
    returnRequest.totalRestockingFee = totalRestockingFee;
    returnRequest.netRefundAmount = netRefundAmount;

    const referenceId = originalOrder.id ? String(originalOrder.id) : String(originalOrder._id);
    const customerId = toUuid(originalOrder.customer);
    const supplierId = toUuid(originalOrder.supplier);
    const createdBy = toUuid(requestedBy?.id ?? requestedBy?._id ?? requestedBy);

    const itemsForPostgres = returnRequest.items.map(item => ({
      product: item.product?._id ? String(item.product._id) : String(item.product),
      originalOrderItem: item.originalOrderItem ? String(item.originalOrderItem) : null,
      quantity: item.quantity,
      originalPrice: item.originalPrice,
      returnReason: item.returnReason,
      returnReasonDetail: item.returnReasonDetail,
      condition: item.condition,
      action: item.action,
      refundAmount: item.refundAmount,
      restockingFee: item.restockingFee,
      generalNotes: item.generalNotes
    }));

    const deferProcess = returnData.deferProcess === true;

    const refundDetailsOnCreate = { refundMethod: returnData.refundMethod || 'original_payment' };

    if (deferProcess) {
      // Workflow mode: create return with status pending only (no inventory/ledger). Call processReturn later.
      return await transaction(async (client) => {
        const returnNumber = await ReturnRepository.getNextReturnNumber(client);
        const created = await ReturnRepository.create({
          returnNumber,
          returnType: isPurchaseReturn ? 'purchase_return' : 'sale_return',
          referenceId,
          customerId: customerId || null,
          supplierId: supplierId || null,
          returnDate: today,
          items: itemsForPostgres,
          totalAmount: netRefundAmount,
          reason: null,
          status: 'pending',
          createdBy,
          refundDetails: refundDetailsOnCreate
        }, client);
        const createdReturn = created && (typeof created.items === 'string' ? { ...created, items: JSON.parse(created.items) } : created);
        return this.buildReturnRequestFromRow(createdReturn, returnRequest, originalOrder, netRefundAmount, totalRefundAmount, totalRestockingFee, returnData);
      });
    }

    // Single DB transaction: createReturn + createStockMovement + updateInventory + postLedger (COMMIT/ROLLBACK)
    return await transaction(async (client) => {
      const returnNumber = await ReturnRepository.getNextReturnNumber(client);
      const created = await ReturnRepository.create({
        returnNumber,
        returnType: isPurchaseReturn ? 'purchase_return' : 'sale_return',
        referenceId,
        customerId: customerId || null,
        supplierId: supplierId || null,
        returnDate: today,
        items: itemsForPostgres,
        totalAmount: netRefundAmount,
        reason: null,
        status: 'pending',
        createdBy,
        refundDetails: refundDetailsOnCreate
      }, client);

      const createdReturn = created && (typeof created.items === 'string' ? { ...created, items: JSON.parse(created.items) } : created);
      const returnRequestForDownstream = {
        _id: createdReturn.id,
        id: createdReturn.id,
        returnNumber: createdReturn.return_number,
        origin: isPurchaseReturn ? 'purchase' : 'sales',
        returnType: returnData.returnType || 'return',
        status: 'pending',
        items: returnRequest.items.map(item => {
          const orderItem = originalOrder.items?.find(oi => String(oi._id || oi.id) === String(item.originalOrderItem));
          const product = item.product?.name ? item.product : (orderItem?.product || item.product);
          const productIdVal = product && (product.id || product._id) || product || item.productId;
          return {
            ...item,
            product,
            productId: productIdVal ? String(productIdVal) : undefined
          };
        }),
        originalOrder: originalOrder.id || originalOrder._id,
        customer: originalOrder.customer,
        supplier: originalOrder.supplier,
        netRefundAmount,
        totalRefundAmount,
        totalRestockingFee,
        refundMethod: returnData.refundMethod || 'original_payment',
        inspection: returnData.inspection || null
      };

      await this.updateInventoryForReturn(returnRequestForDownstream, requestedBy, client);

      if (returnRequestForDownstream.returnType === 'return') {
        await this.processRefund(returnRequestForDownstream, client);
      } else if (returnRequestForDownstream.returnType === 'exchange') {
        await this.processExchange(returnRequestForDownstream, client);
      }

      const refundDetails = {
        refundDate: new Date(),
        refundReference: returnRequestForDownstream.return_number || returnRequestForDownstream.returnNumber
      };
      await ReturnRepository.update(createdReturn.id, { status: 'processed', refundDetails }, client);
      returnRequestForDownstream.status = 'processed';
      returnRequestForDownstream.refundDetails = refundDetails;

      await this.notifyCustomer(returnRequestForDownstream, 'return_completed');
      return returnRequestForDownstream;
    });
  }

  /** Build return request shape from DB row (for deferProcess response and processReturn). */
  buildReturnRequestFromRow(createdReturn, returnRequest, originalOrder, netRefundAmount, totalRefundAmount, totalRestockingFee, returnData) {
    return {
      _id: createdReturn.id,
      id: createdReturn.id,
      returnNumber: createdReturn.return_number,
      origin: returnData.origin === 'purchase' ? 'purchase' : 'sales',
      returnType: returnData.returnType || 'return',
      status: 'pending',
      items: returnRequest.items.map(item => ({
        ...item,
        product: item.product?.name ? item.product : (originalOrder.items?.find(oi => oi.product?._id?.toString() === String(item.product))?.product || item.product)
      })),
      originalOrder: originalOrder.id || originalOrder._id,
      customer: originalOrder.customer,
      supplier: originalOrder.supplier,
      netRefundAmount,
      totalRefundAmount,
      totalRestockingFee,
      refundMethod: returnData.refundMethod || 'original_payment',
      inspection: returnData.inspection || null
    };
  }

  /**
   * Process a return (inventory + ledger) in one transaction. Use after create with deferProcess: true.
   * Status must be pending, inspected, or approved.
   */
  async processReturn(returnId, userId) {
    const returnRow = await ReturnRepository.findById(returnId);
    if (!returnRow) throw new Error('Return not found');
    const allowed = ['pending', 'inspected', 'approved'];
    if (!allowed.includes(returnRow.status)) {
      throw new Error(`Return cannot be processed from status ${returnRow.status}. Allowed: ${allowed.join(', ')}`);
    }

    const returnRequest = await this.buildReturnRequestForDownstream(returnRow);

    return await transaction(async (client) => {
      await this.updateInventoryForReturn(returnRequest, userId, client);
      if (returnRequest.returnType === 'return') {
        await this.processRefund(returnRequest, client);
      } else if (returnRequest.returnType === 'exchange') {
        await this.processExchange(returnRequest, client);
      }
      const refundDetails = {
        refundDate: new Date(),
        refundReference: returnRequest.return_number || returnRequest.returnNumber
      };
      await ReturnRepository.update(returnId, { status: 'processed', refundDetails }, client);
      returnRequest.status = 'processed';
      returnRequest.refundDetails = refundDetails;
      await this.notifyCustomer(returnRequest, 'return_completed');
      return returnRequest;
    });
  }

  // Check if order is eligible for return
  async checkReturnEligibility(order, returnItems) {
    const now = new Date();
    const daysSinceOrder = Math.floor((now - order.createdAt) / (1000 * 60 * 60 * 24));

    // Check return window (default 30 days)
    const returnWindow = 30; // This could be configurable per product/category
    if (daysSinceOrder > returnWindow) {
      return {
        eligible: false,
        reason: `Return window has expired. Order is ${daysSinceOrder} days old.`
      };
    }

    // Check if items are returnable
    for (const returnItem of returnItems) {
      const orderItem = order.items.find(item =>
        String(item._id || item.id) === String(returnItem.originalOrderItem)
      );

      if (!orderItem) {
        return {
          eligible: false,
          reason: 'Item not found in original order'
        };
      }

      // Check if return quantity exceeds order quantity (allows multiple returns as long as total doesn't exceed)
      const alreadyReturnedQuantity = await this.getAlreadyReturnedQuantity(
        order._id,
        returnItem.originalOrderItem
      );

      const remainingQuantity = orderItem.quantity - alreadyReturnedQuantity;

      if (remainingQuantity <= 0) {
        return {
          eligible: false,
          reason: `All ${orderItem.quantity} items have already been returned.`
        };
      }

      if (returnItem.quantity > remainingQuantity) {
        return {
          eligible: false,
          reason: `Cannot return ${returnItem.quantity} items. Only ${remainingQuantity} item(s) available for return (${alreadyReturnedQuantity} already returned out of ${orderItem.quantity} sold).`
        };
      }
    }

    return { eligible: true };
  }

  // Validate return items
  async validateReturnItems(originalOrder, returnItems) {
    for (const returnItem of returnItems) {
      const orderItem = originalOrder.items.find(item =>
        String(item._id || item.id) === String(returnItem.originalOrderItem)
      );

      if (!orderItem) {
        throw new Error(`Order item not found: ${returnItem.originalOrderItem}`);
      }

      const productId = orderItem.product && (orderItem.product.id || orderItem.product._id);
      const product = productId ? await ProductRepository.findById(productId) : null;
      if (!product) {
        throw new Error(`Product not found: ${productId || orderItem.product}`);
      }

      // Always set original price from order (override any frontend value)
      // Sales/Orders use unitPrice, legacy might use price
      returnItem.originalPrice = Number(orderItem.unitPrice || orderItem.price) || 0;
      console.log(`Set originalPrice for item ${returnItem.product}: ${returnItem.originalPrice}`);

      // Always set default values for optional fields (override any frontend value)
      // Handle string "undefined" or actual undefined values
      returnItem.refundAmount = Number(returnItem.refundAmount) || 0;
      returnItem.restockingFee = Number(returnItem.restockingFee) || 0;
      console.log(`Set refundAmount: ${returnItem.refundAmount}, restockingFee: ${returnItem.restockingFee} for item ${returnItem.product}`);
    }
  }

  // Calculate refund amounts for return items
  async calculateRefundAmounts(returnRequest) {
    console.log('Calculating refund amounts for return items...');
    for (const item of returnRequest.items) {
      console.log(`Processing item: ${item.product}, originalPrice: ${item.originalPrice}, quantity: ${item.quantity}`);

      // Calculate restocking fee based on condition and policy
      const baseFee = Number(returnRequest.policy?.restockingFeePercent) || 0;
      const restockingFeePercent = this.calculateRestockingFee(
        item.condition,
        item.returnReason,
        baseFee
      );

      console.log(`Restocking fee percent: ${restockingFeePercent}%`);

      item.restockingFee = (item.originalPrice * item.quantity * restockingFeePercent) / 100;

      // Calculate refund amount
      item.refundAmount = (item.originalPrice * item.quantity) - item.restockingFee;

      console.log(`Calculated amounts - refundAmount: ${item.refundAmount}, restockingFee: ${item.restockingFee}`);
    }

    console.log('All item amounts calculated. Return totals will be calculated in pre-save middleware.');
  }

  // Calculate restocking fee based on various factors
  calculateRestockingFee(condition, returnReason, baseFeePercent) {
    let feePercent = baseFeePercent || 0;

    // Adjust fee based on condition
    switch (condition) {
      case 'new':
      case 'like_new':
        feePercent *= 0.5; // Reduce fee for good condition
        break;
      case 'good':
        break; // No adjustment
      case 'fair':
        feePercent *= 1.5; // Increase fee for fair condition
        break;
      case 'poor':
      case 'damaged':
        feePercent *= 2; // Double fee for poor condition
        break;
    }

    // Adjust fee based on return reason
    switch (returnReason) {
      case 'defective':
      case 'wrong_item':
      case 'damaged_shipping':
        feePercent = 0; // No fee for store error
        break;
      case 'changed_mind':
        feePercent *= 1.5; // Higher fee for change of mind
        break;
    }

    return Math.min(feePercent, 100); // Cap at 100%
  }

  // Get already returned quantity for an order item
  async getAlreadyReturnedQuantity(orderId, orderItemId) {
    const returns = await ReturnRepository.findAll({
      referenceId: String(orderId)
    });

    const excludeStatus = ['rejected', 'cancelled'];
    let totalReturned = 0;
    const orderItemStr = String(orderItemId);
    (returns || []).forEach(returnDoc => {
      if (excludeStatus.includes(returnDoc.status)) return;
      (returnDoc.items || []).forEach(item => {
        if (String(item.originalOrderItem) === orderItemStr) {
          totalReturned += item.quantity || 0;
        }
      });
    });

    return totalReturned;
  }

  // Approve return request
  async approveReturn(returnId, approvedBy, notes = null) {
    try {
      const returnRequest = await ReturnRepository.findById(returnId);
      if (!returnRequest) {
        throw new Error('Return request not found');
      }

      const status = returnRequest.status || returnRequest.status;
      if (status !== 'pending') {
        throw new Error('Return request cannot be approved in current status');
      }

      await ReturnRepository.update(returnId, { status: 'approved', updatedBy: approvedBy });

      const updated = await ReturnRepository.findById(returnId);
      await this.notifyCustomer(updated || returnRequest, 'return_approved');

      return updated || returnRequest;
    } catch (error) {
      console.error('Error approving return:', error);
      throw error;
    }
  }

  // Reject return request
  async rejectReturn(returnId, rejectedBy, reason) {
    try {
      const returnRequest = await ReturnRepository.findById(returnId);
      if (!returnRequest) {
        throw new Error('Return request not found');
      }

      const currentStatus = returnRequest.status;
      if (currentStatus !== 'pending') {
        throw new Error('Return request cannot be rejected in current status');
      }

      await ReturnRepository.update(returnId, { status: 'rejected', updatedBy: rejectedBy });

      const updated = await ReturnRepository.findById(returnId);
      await this.notifyCustomer(updated || returnRequest, 'return_rejected');

      return updated || returnRequest;
    } catch (error) {
      console.error('Error rejecting return:', error);
      throw error;
    }
  }

  // Process received return: save inspection then run processReturn (one transaction for inventory + ledger).
  async processReceivedReturn(returnId, receivedBy, inspectionData = {}) {
    const returnRow = await ReturnRepository.findById(returnId);
    if (!returnRow) throw new Error('Return request not found');

    const status = returnRow.status;
    const allowed = ['pending', 'inspected', 'approved', 'processing', 'received'];
    if (!allowed.includes(status)) {
      throw new Error(`Return cannot be processed from status ${status}. Allowed: ${allowed.join(', ')}`);
    }

    if (inspectionData && Object.keys(inspectionData).length > 0) {
      const inspection = {
        ...inspectionData,
        inspectedBy: receivedBy,
        inspectionDate: new Date()
      };
      const updatePayload = { inspection, updatedBy: receivedBy };
      if (status === 'pending') updatePayload.status = 'inspected';
      await ReturnRepository.update(returnId, updatePayload);
    }

    return await this.processReturn(returnId, receivedBy);
  }

  async buildReturnRequestForDownstream(returnRow) {
    const items = typeof returnRow.items === 'string' ? JSON.parse(returnRow.items) : (returnRow.items || []);
    const inspection = returnRow.inspection || null;
    return {
      _id: returnRow.id,
      id: returnRow.id,
      returnNumber: returnRow.return_number,
      origin: (returnRow.return_type || '').includes('purchase') ? 'purchase' : 'sales',
      returnType: (returnRow.return_type || '').includes('purchase') ? 'purchase_return' : 'return',
      status: returnRow.status,
      items,
      originalOrder: returnRow.reference_id,
      customer: returnRow.customer_id,
      supplier: returnRow.supplier_id,
      netRefundAmount: parseFloat(returnRow.total_amount) || 0,
      totalRefundAmount: parseFloat(returnRow.total_amount) || 0,
      refundMethod: returnRow.refund_details?.refundMethod || 'original_payment',
      inspection
    };
  }

  // Update inventory for returned items with proper cost tracking. Pass client when inside a transaction.
  async updateInventoryForReturn(returnRequest, userId, client = null) {
    const isPurchaseReturn = returnRequest.origin === 'purchase';

    for (const item of returnRequest.items) {
      const rawProductId = item.product && (item.product.id || item.product._id) || item.product;
      const productId = rawProductId ? String(rawProductId).trim() : null;
      if (!productId) {
        console.warn('updateInventoryForReturn: skipping item with no product id', item);
        continue;
      }
      let inventory = await InventoryRepository.findOne({ product: productId, productId }, client);

      if (!inventory) {
        inventory = await InventoryRepository.create({
          product: productId,
          productId,
          currentStock: 0,
          reservedStock: 0,
          reorderPoint: 0,
          reorderQuantity: 0
        }, client);
      }

      const originalOrder = await this.getOriginalOrder(returnRequest.originalOrder || returnRequest.reference_id, isPurchaseReturn);
      const originalItem = originalOrder && originalOrder.items && originalOrder.items.find(oi =>
        String(oi._id || oi.id) === String(item.originalOrderItem)
      );

      // Fetch product to use as fallback for cost basis extraction
      const product = originalItem?.product && (originalItem.product.id || originalItem.product._id)
        ? await ProductRepository.findById(originalItem.product.id || originalItem.product._id)
        : null;

      // Extract cost basis using consistent logic (avoids falling back to selling price)
      const unitCost = this.extractCostBasis(originalItem, product);
      const returnCost = unitCost * item.quantity;
      const currentStock = Number(inventory.current_stock ?? inventory.currentStock ?? 0);

      if (isPurchaseReturn) {
        if (currentStock < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.product?.name || productId}. Available: ${currentStock}, Required: ${item.quantity}`);
        }
        await this.logInventoryMovement(
          item,
          'out',
          item.quantity,
          returnCost,
          returnRequest.returnNumber || returnRequest.return_number,
          returnRequest.id || returnRequest._id,
          userId,
          client
        );
      } else {
        // Sale return: resellable = true → inventory++; resellable = false → quarantine/scrap (no sellable inventory increase)
        const resellable = returnRequest.inspection == null || returnRequest.inspection.resellable !== false;
        await this.logInventoryMovement(
          item,
          'return',
          item.quantity,
          returnCost,
          returnRequest.returnNumber || returnRequest.return_number,
          returnRequest.id || returnRequest._id,
          userId,
          client,
          { resellable }
        );
      }
    }
  }

  // Helper to get original order with populated items (from Postgres)
  async getOriginalOrder(orderId, isPurchaseReturn) {
    return this.fetchAndNormalizeOrder(orderId, isPurchaseReturn);
  }

  // Log inventory movement with proper cost tracking (Postgres). resellable: true = return_in + inventory++; false = return_quarantine, no sellable increase.
  async logInventoryMovement(item, type, quantity, cost, reference, returnId = null, userId = null, client = null, options = {}) {
    const rawProductId = item.product && (item.product.id || item.product._id) || item.product || item.productId;
    const productId = rawProductId ? String(rawProductId).trim() : null;
    if (!productId) {
      console.warn('logInventoryMovement: skipping item with no product id', item);
      return;
    }
    let inventory = await InventoryRepository.findOne({ product: productId, productId }, client);
    if (!inventory) {
      inventory = await InventoryRepository.create({
        product: productId,
        productId,
        currentStock: 0,
        reservedStock: 0,
        reorderPoint: 0,
        reorderQuantity: 0
      }, client);
    }

    const qty = Math.abs(quantity);
    const currentStock = Number(inventory.current_stock ?? inventory.currentStock ?? 0);

    let movementType;
    let newStock = currentStock;
    let quantityDelta = 0;
    let quarantineDelta = 0;

    if (type === 'return') {
      const resellable = options.resellable !== false;
      if (resellable) {
        movementType = 'return_in';
        newStock = Math.max(0, currentStock + qty);
        quantityDelta = qty;
      } else {
        movementType = 'return_quarantine';
        quarantineDelta = qty;
        // Do not increase current_stock for non-resellable (scrap/quarantine)
      }
    } else {
      movementType = quantity > 0 ? 'return_in' : 'return_out';
      if (movementType === 'return_out') {
        if (currentStock < qty) return;
        newStock = Math.max(0, currentStock - qty);
        quantityDelta = -qty;
      }
    }

    const product = await ProductRepository.findById(productId);
    const movementRow = await StockMovementRepository.create({
      productId,
      productName: product?.name,
      productSku: product?.sku,
      movementType,
      quantity: qty,
      unitCost: cost / qty || 0,
      totalValue: cost || 0,
      previousStock: currentStock,
      newStock,
      referenceType: 'return',
      referenceId: returnId,
      referenceNumber: reference || 'Return',
      userId,
      userName: (userId && typeof userId === 'object' && userId.name) ? userId.name : (userId ? String(userId) : 'System'),
      status: 'completed'
    }, client);

    if (movementType === 'return_in') {
      const reserved = Number(inventory.reserved_stock ?? inventory.reservedStock ?? 0);
      await InventoryRepository.updateById(inventory.id, {
        currentStock: newStock,
        availableStock: Math.max(0, newStock - reserved)
      }, client);
    }

    try {
      await InventoryBalanceRepository.upsertDelta(
        productId,
        quantityDelta,
        quarantineDelta,
        movementRow?.id || null,
        client
      );
    } catch (balanceErr) {
      console.warn('inventory_balance upsert skipped (table may be missing):', balanceErr.message);
    }
  }

  // Process refund with proper accounting entries. Pass client when inside a transaction.
  async processRefund(returnRequest, client = null) {
    try {
      const isPurchaseReturn = returnRequest.origin === 'purchase';
      const netAmount = returnRequest.netRefundAmount || 0;

      if (isPurchaseReturn) {
        await this.processPurchaseReturnRefund(returnRequest, netAmount, client);
      } else {
        await this.processSaleReturnRefund(returnRequest, netAmount, client);
      }

      const refundDetails = {
        refundDate: new Date(),
        refundReference: returnRequest.return_number || returnRequest.returnNumber
      };
      await ReturnRepository.update(returnRequest.id || returnRequest._id, { refundDetails }, client);
      returnRequest.refund_details = refundDetails;
      returnRequest.refundDetails = refundDetails;

      return returnRequest;
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  }

  // Process Sale Return refund with accounting entries
  async processSaleReturnRefund(returnRequest, refundAmount, client = null) {
    try {
      const accountCodes = await AccountingService.getDefaultAccountCodes();
      const customerId = toUuid(returnRequest.customer_id ?? returnRequest.customer);
      const salesReturnAccount = await AccountingService.getAccountCode('Sales Returns', 'revenue', 'sales_revenue').catch(() => accountCodes.salesRevenue);
      const arAccount = accountCodes.accountsReceivable || '1100';

      const originalSale = await this.getOriginalOrder(
        returnRequest.originalOrder || returnRequest.reference_id,
        false
      );
      if (!originalSale) {
        throw new Error('Original sale not found');
      }

      // Calculate COGS adjustment (reverse COGS for returned items)
      const cogsAdjustment = await this.calculateCOGSAdjustment(returnRequest, originalSale);

      const returnDate = returnRequest.returnDate || returnRequest.return_date || new Date();

      // 1) Always post Sale Return to AR (1100) with customerId so it shows in Account Ledger and reduces receivable
      await this.createDoubleEntry(
        {
          accountCode: salesReturnAccount,
          debitAmount: refundAmount,
          creditAmount: 0,
          description: `Sale Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id,
          referenceType: 'Sale Return',
          customerId: customerId || null,
          transactionDate: returnDate
        },
        {
          accountCode: arAccount,
          debitAmount: 0,
          creditAmount: refundAmount,
          description: `Sale Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id,
          referenceType: 'Sale Return',
          customerId: customerId || null,
          transactionDate: returnDate
        },
        client
      );

      // 2) For cash/bank refund: record the payment out (Dr AR, Cr Cash/Bank)
      // Skip this step for 'deferred' (no refund at this time - only record the return)
      const refundMethod = returnRequest.refundMethod || 'original_payment';
      if (refundMethod === 'cash' || refundMethod === 'original_payment') {
        await this.createDoubleEntry(
          {
            accountCode: arAccount,
            debitAmount: refundAmount,
            creditAmount: 0,
            description: `Cash Refund for Return ${returnRequest.returnNumber}`,
            reference: returnRequest.returnNumber,
            returnId: returnRequest._id,
            referenceType: 'Sale Return',
            customerId: customerId || null,
            transactionDate: returnDate
          },
          {
            accountCode: accountCodes.cash,
            debitAmount: 0,
            creditAmount: refundAmount,
            description: `Cash Refund for Return ${returnRequest.returnNumber}`,
            reference: returnRequest.returnNumber,
            returnId: returnRequest._id,
            referenceType: 'Sale Return',
            transactionDate: returnDate
          },
          client
        );
      } else if (refundMethod === 'bank_transfer' || refundMethod === 'check') {
        await this.createDoubleEntry(
          {
            accountCode: arAccount,
            debitAmount: refundAmount,
            creditAmount: 0,
            description: `Bank Refund for Return ${returnRequest.returnNumber}`,
            reference: returnRequest.returnNumber,
            returnId: returnRequest._id,
            referenceType: 'Sale Return',
            customerId: customerId || null,
            transactionDate: returnDate
          },
          {
            accountCode: accountCodes.bank,
            debitAmount: 0,
            creditAmount: refundAmount,
            description: `Bank Refund for Return ${returnRequest.returnNumber}`,
            reference: returnRequest.returnNumber,
            returnId: returnRequest._id,
            referenceType: 'Sale Return',
            transactionDate: returnDate
          },
          client
        );
      } else if (refundMethod === 'deferred' || refundMethod === 'none') {
        // No cash/bank/store_credit - only Step 1 (Sales Return to AR) was posted above.
        // Refund will be processed later when the user issues payment.
      } else if (refundMethod === 'store_credit') {
        await CustomerBalanceService.recordRefund(
          returnRequest.customer,
          refundAmount,
          returnRequest.originalOrder,
          null,
          { returnId: returnRequest._id, returnNumber: returnRequest.returnNumber }
        );
      }

      // COGS Adjustment: Dr Inventory, Cr COGS (reverse the original COGS)
      if (cogsAdjustment > 0) {
        await this.createDoubleEntry(
          {
            accountCode: accountCodes.inventory,
            debitAmount: cogsAdjustment,
            creditAmount: 0,
            description: `Inventory Restored - Return ${returnRequest.returnNumber}`,
            reference: returnRequest.returnNumber,
            returnId: returnRequest._id,
            transactionDate: returnDate
          },
          {
            accountCode: accountCodes.costOfGoodsSold,
            debitAmount: 0,
            creditAmount: cogsAdjustment,
            description: `COGS Reversed - Return ${returnRequest.returnNumber}`,
            reference: returnRequest.returnNumber,
            returnId: returnRequest._id,
            transactionDate: returnDate
          },
          client
        );
      }

      // Update customer balance if sale was on credit
      if (originalSale.payment?.status === 'pending' || originalSale.payment?.status === 'partial') {
        await CustomerBalanceService.recordRefund(
          returnRequest.customer,
          refundAmount,
          returnRequest.originalOrder,
          null,
          { returnId: returnRequest._id, returnNumber: returnRequest.returnNumber }
        );
      }

    } catch (error) {
      console.error('Error processing sale return refund:', error);
      throw error;
    }
  }

  // Process Purchase Return refund with accounting entries
  async processPurchaseReturnRefund(returnRequest, refundAmount, client = null) {
    try {
      const accountCodes = await AccountingService.getDefaultAccountCodes();

      const originalInvoice = await this.getOriginalOrder(
        returnRequest.originalOrder || returnRequest.reference_id,
        true
      );
      if (!originalInvoice) {
        throw new Error('Original purchase invoice not found');
      }

      // Calculate COGS adjustment (reverse COGS for returned items)
      const cogsAdjustment = await this.calculatePurchaseCOGSAdjustment(returnRequest, originalInvoice);

      // Accounting Entry: Dr Supplier Accounts Payable, Cr Purchase Returns
      const supplierId = toUuid(returnRequest.supplier_id ?? returnRequest.supplier);
      await this.createDoubleEntry(
        {
          accountCode: accountCodes.accountsPayable,
          debitAmount: refundAmount,
          creditAmount: 0,
          description: `Purchase Return ${returnRequest.returnNumber} - Supplier Credit`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id,
          supplierId
        },
        {
          accountCode: await AccountingService.getAccountCode('Purchase Returns', 'expense', 'cost_of_goods_sold').catch(() => accountCodes.costOfGoodsSold),
          debitAmount: 0,
          creditAmount: refundAmount,
          description: `Purchase Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        },
        client
      );

      // COGS Adjustment: Dr COGS, Cr Inventory (reverse inventory increase)
      if (cogsAdjustment > 0) {
        await this.createDoubleEntry(
          {
            accountCode: accountCodes.costOfGoodsSold,
            debitAmount: cogsAdjustment,
            creditAmount: 0,
            description: `COGS Adjusted - Purchase Return ${returnRequest.returnNumber}`,
            reference: returnRequest.returnNumber,
            returnId: returnRequest._id
          },
          {
            accountCode: accountCodes.inventory,
            debitAmount: 0,
            creditAmount: cogsAdjustment,
            description: `Inventory Reduced - Purchase Return ${returnRequest.returnNumber}`,
            reference: returnRequest.returnNumber,
            returnId: returnRequest._id
          }
        );
      }

      // Handle payment method
      const refundMethod = returnRequest.refundMethod || 'original_payment';
      if (refundMethod === 'cash' || refundMethod === 'bank_transfer') {
        // If cash/bank refund received from supplier
        const cashAccount = refundMethod === 'cash' ? accountCodes.cash : accountCodes.bank;

        await this.createDoubleEntry(
          {
            accountCode: cashAccount,
            debitAmount: refundAmount,
            creditAmount: 0,
            description: `Cash/Bank Refund Received - Purchase Return ${returnRequest.returnNumber}`,
            reference: returnRequest.returnNumber,
            returnId: returnRequest._id
          },
          {
            accountCode: accountCodes.accountsPayable,
            debitAmount: 0,
            creditAmount: refundAmount,
            description: `Supplier Payable Reduced - Purchase Return ${returnRequest.returnNumber}`,
            reference: returnRequest.returnNumber,
            returnId: returnRequest._id
          },
          client
        );
      }

      // Update supplier balance
      if (supplierId) {
        await this.updateSupplierBalance(supplierId, refundAmount, returnRequest.originalOrder);
      }

    } catch (error) {
      console.error('Error processing purchase return refund:', error);
      throw error;
    }
  }

  /**
   * Create double-entry accounting (PostgreSQL) for returns.
   * Pass client when inside a transaction so ledger is committed with return/inventory.
   */
  async createDoubleEntry(entry1Data, entry2Data, client = null) {
    try {
      const entry1 = {
        accountCode: entry1Data.accountCode,
        debitAmount: entry1Data.debitAmount || 0,
        creditAmount: entry1Data.creditAmount || 0,
        description: entry1Data.description
      };
      const entry2 = {
        accountCode: entry2Data.accountCode,
        debitAmount: entry2Data.debitAmount || 0,
        creditAmount: entry2Data.creditAmount || 0,
        description: entry2Data.description
      };
      const txnDate = entry1Data.transactionDate || entry2Data.transactionDate;
      const metadata = {
        referenceType: entry1Data.referenceType || entry2Data.referenceType || 'return',
        referenceId: entry1Data.returnId || entry2Data.returnId,
        referenceNumber: entry1Data.reference || entry2Data.reference,
        customerId: entry1Data.customerId || entry2Data.customerId,
        supplierId: entry1Data.supplierId || entry2Data.supplierId,
        ...(txnDate && { transactionDate: txnDate })
      };
      return await AccountingService.createTransaction(entry1, entry2, metadata, client);
    } catch (error) {
      console.error('Error creating accounting entry:', error);
      throw error;
    }
  }

  // Legacy single-entry: no-op (use createDoubleEntry for PostgreSQL)
  async createAccountingEntry(entryData) {
    console.warn('createAccountingEntry: single-entry not supported; use createDoubleEntry for return accounting');
    return null;
  }

  // Calculate COGS adjustment for sale return
  async calculateCOGSAdjustment(returnRequest, originalSale) {
    let totalCOGS = 0;

    for (const returnItem of returnRequest.items) {
      const originalItem = originalSale.items.find(oi =>
        oi._id.toString() === returnItem.originalOrderItem.toString()
      );

      if (originalItem) {
        // Fetch product to use as fallback for cost basis extraction
        const product = originalItem?.product && (originalItem.product.id || originalItem.product._id)
          ? await ProductRepository.findById(originalItem.product.id || originalItem.product._id)
          : null;

        // Extract cost basis using consistent logic (avoids falling back to selling price)
        const unitCost = this.extractCostBasis(originalItem, product);
        totalCOGS += unitCost * returnItem.quantity;
      }
    }

    return totalCOGS;
  }

  // Calculate COGS adjustment for purchase return
  async calculatePurchaseCOGSAdjustment(returnRequest, originalInvoice) {
    let totalCOGS = 0;

    for (const returnItem of returnRequest.items) {
      const originalItem = originalInvoice.items.find(oi =>
        oi._id.toString() === returnItem.originalOrderItem.toString()
      );

      if (originalItem) {
        // Fetch product to use as fallback for cost basis extraction
        const product = originalItem?.product && (originalItem.product.id || originalItem.product._id)
          ? await ProductRepository.findById(originalItem.product.id || originalItem.product._id)
          : null;

        // Extract cost basis using consistent logic (avoids falling back to selling price)
        const unitCost = this.extractCostBasis(originalItem, product);
        totalCOGS += unitCost * returnItem.quantity;
      }
    }

    return totalCOGS;
  }

  // Update supplier balance
  async updateSupplierBalance(supplierId, amount, originalInvoiceId) {
    // Note: Manual balance updates removed. 
    // Ledger is the SSoT; return refunds already post ledger entries in processPurchaseReturnRefund.
    return;
  }

  // Process exchange (pass client when inside return transaction so exchange order commits with return)
  async processExchange(returnRequest, client = null) {
    try {
      const customerId = toUuid(returnRequest.customer_id ?? returnRequest.customer);
      const exchangeItems = returnRequest.exchangeDetails?.exchangeItems || [];
      const subtotal = exchangeItems.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || i.unit_price || 0), 0);
      const exchangeOrder = await SalesRepository.create({
        orderNumber: `EXC-${Date.now()}`,
        customerId,
        saleDate: new Date(),
        items: exchangeItems,
        subtotal,
        total: subtotal,
        status: 'completed',
        paymentStatus: 'completed',
        notes: `Exchange for return ${returnRequest.return_number || returnRequest.returnNumber}`,
        createdBy: toUuid(returnRequest.created_by ?? returnRequest.createdBy)
      }, client);
      if (returnRequest.exchangeDetails) returnRequest.exchangeDetails.exchangeOrder = exchangeOrder.id || exchangeOrder._id;
      return exchangeOrder;
    } catch (error) {
      console.error('Error processing exchange:', error);
      throw error;
    }
  }

  // Notify customer about return status
  async notifyCustomer(returnRequest, notificationType) {
    try {
      const customerId = returnRequest.customer_id || returnRequest.customer && (returnRequest.customer.id || returnRequest.customer._id) || returnRequest.customer;
      const customer = customerId ? await CustomerRepository.findById(customerId) : null;
      if (!customer) return;

      const returnNumber = returnRequest.return_number || returnRequest.returnNumber;
      const messages = {
        return_requested: `Your return request ${returnNumber} has been submitted and is under review.`,
        return_approved: `Your return request ${returnNumber} has been approved. Please ship items back.`,
        return_rejected: `Your return request ${returnNumber} has been rejected. Contact support for details.`,
        return_completed: `Your return request ${returnNumber} has been completed. Refund processed.`
      };
      const message = messages[notificationType];
      if (message && typeof returnRequest.addCommunication === 'function') {
        await returnRequest.addCommunication('email', message, null, customer.email);
      }
    } catch (error) {
      console.error('Error notifying customer:', error);
    }
  }

  // Get return statistics
  async getReturnStats(period = {}) {
    try {
      const returnTypeFilter = period.origin === 'sales' ? 'sale_return' : (period.origin === 'purchase' ? 'purchase_return' : null);

      const stats = await ReturnRepository.getStats(period);

      // Get additional metrics - use dateFrom/dateTo for ReturnRepository (expects Date objects)
      const filter = {};
      if (returnTypeFilter) filter.returnType = returnTypeFilter;
      if (period.startDate && period.endDate) {
        filter.dateFrom = period.startDate;
        filter.dateTo = period.endDate;
      }

      const totalReturns = await ReturnRepository.count(filter);

      const pendingFilter = { status: 'pending', ...filter };
      const pendingReturns = await ReturnRepository.count(pendingFilter);

      const averageProcessingTime = await this.calculateAverageProcessingTime(period);

      // Calculate status and type breakdowns
      const statusBreakdown = {};
      const typeBreakdown = {};
      if (stats.byStatus && Array.isArray(stats.byStatus)) {
        stats.byStatus.forEach(status => {
          statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
        });
      }
      if (stats.byType && Array.isArray(stats.byType)) {
        stats.byType.forEach(type => {
          typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
        });
      }

      return {
        totalReturns,
        pendingReturns,
        totalRefundAmount: stats.totalRefundAmount || 0,
        totalRestockingFee: stats.totalRestockingFee || 0,
        netRefundAmount: stats.netRefundAmount || 0,
        averageRefundAmount: totalReturns > 0 ? (stats.totalRefundAmount || 0) / totalReturns : 0,
        averageProcessingTime,
        returnRate: await this.calculateReturnRate(period),
        statusBreakdown,
        typeBreakdown
      };
    } catch (error) {
      console.error('Error getting return stats:', error);
      throw error;
    }
  }

  // Calculate average processing time (Postgres: use updated_at - return_date for completed returns)
  async calculateAverageProcessingTime(period = {}) {
    const { query } = require('../config/postgres');
    let sql = `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - return_date)) / 86400.0) AS avg_days
      FROM returns WHERE deleted_at IS NULL AND status = 'completed'`;
    const params = [];
    let n = 1;
    if (period.startDate) { sql += ` AND return_date >= $${n++}`; params.push(period.startDate); }
    if (period.endDate) { sql += ` AND return_date <= $${n++}`; params.push(period.endDate); }
    const result = await query(sql, params);
    return parseFloat(result.rows[0]?.avg_days) || 0;
  }

  // Calculate return rate (Postgres)
  async calculateReturnRate(period = {}) {
    const { query } = require('../config/postgres');
    const dateFilter = period.startDate && period.endDate
      ? ` AND sale_date >= $1 AND sale_date <= $2` : '';
    const dateParams = period.startDate && period.endDate ? [period.startDate, period.endDate] : [];
    const salesCount = await query(
      `SELECT COUNT(*) FROM sales WHERE deleted_at IS NULL${dateFilter}`,
      dateParams
    );
    const returnDateFilter = period.startDate && period.endDate
      ? ` AND return_date >= $1 AND return_date <= $2` : '';
    const returnParams = period.startDate && period.endDate ? [period.startDate, period.endDate] : [];
    const returnsCount = await query(
      `SELECT COUNT(*) FROM returns WHERE deleted_at IS NULL AND status NOT IN ('rejected', 'cancelled')${returnDateFilter}`,
      returnParams
    );
    const totalOrders = parseInt(salesCount.rows[0]?.count || 0, 10);
    const totalReturns = parseInt(returnsCount.rows[0]?.count || 0, 10);
    return totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;
  }

  // Get return trends (Postgres)
  async getReturnTrends(periods = 12) {
    try {
      const { query } = require('../config/postgres');
      const result = await query(
        `SELECT
          EXTRACT(YEAR FROM return_date)::int AS year,
          EXTRACT(MONTH FROM return_date)::int AS month,
          COUNT(*) AS count,
          COALESCE(SUM(total_amount), 0) AS total_refund_amount,
          COALESCE(AVG(total_amount), 0) AS average_refund_amount
        FROM returns
        WHERE deleted_at IS NULL AND status != 'cancelled'
          AND return_date >= (CURRENT_DATE - ($1::int || ' months')::interval)
        GROUP BY EXTRACT(YEAR FROM return_date), EXTRACT(MONTH FROM return_date)
        ORDER BY year, month`,
        [periods]
      );
      return (result.rows || []).map(row => ({
        period: `${row.year}-${String(row.month).padStart(2, '0')}`,
        totalReturns: parseInt(row.count, 10) || 0,
        totalRefundAmount: parseFloat(row.total_refund_amount) || 0,
        averageRefundAmount: parseFloat(row.average_refund_amount) || 0
      }));
    } catch (error) {
      console.error('Error getting return trends:', error);
      throw error;
    }
  }

  // Get returns with filters and pagination (Postgres)
  async getReturns(queryParams) {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 10;

    const filter = {};
    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.returnType) filter.returnType = queryParams.returnType;
    if (queryParams.origin === 'purchase') filter.returnType = 'purchase_return';
    if (queryParams.origin === 'sales') filter.returnType = 'sale_return';
    if (queryParams.customer) filter.customerId = queryParams.customer;
    if (queryParams.search) filter.returnNumber = queryParams.search;

    if (queryParams.dateFilter && queryParams.dateFilter.returnDate) {
      const d = queryParams.dateFilter.returnDate;
      if (d.$gte) filter.dateFrom = d.$gte;
      if (d.$lte) filter.dateTo = d.$lte;
    } else if (queryParams.startDate || queryParams.endDate) {
      const { buildDateRangeFilter } = require('../utils/dateFilter');
      const dateFilter = buildDateRangeFilter(queryParams.startDate, queryParams.endDate, 'returnDate');
      if (dateFilter.returnDate) {
        if (dateFilter.returnDate.$gte) filter.dateFrom = dateFilter.returnDate.$gte;
        if (dateFilter.returnDate.$lte) filter.dateTo = dateFilter.returnDate.$lte;
      }
    }

    const result = await ReturnRepository.findWithPagination(filter, {
      page,
      limit,
      sort: 'return_date DESC'
    });

    const populatePromises = result.returns.map(async (returnItem) => {
      return await this.populateReturnData(returnItem);
    });

    const populatedReturns = await Promise.all(populatePromises);

    return {
      returns: populatedReturns,
      pagination: result.pagination
    };
  }

  /**
   * Helper to populate return data with customer, original order, and products
   */
  async populateReturnData(returnRow) {
    if (!returnRow) return null;

    const returnType = returnRow.return_type || returnRow.returnType || '';
    const isPurchase = (returnType + '').toLowerCase().includes('purchase');
    const origin = isPurchase ? 'purchase' : 'sales';

    // Transform snake_case to camelCase and ensure essential fields
    const returnObj = {
      ...returnRow,
      _id: returnRow.id,
      id: returnRow.id,
      returnNumber: returnRow.return_number || returnRow.returnNumber,
      returnDate: returnRow.return_date || returnRow.returnDate,
      customerId: returnRow.customer_id || returnRow.customerId,
      supplierId: returnRow.supplier_id || returnRow.supplierId,
      referenceId: returnRow.reference_id || returnRow.referenceId,
      returnType: returnType,
      origin,
      netRefundAmount: typeof returnRow.total_amount !== 'undefined' ? returnRow.total_amount : (returnRow.netRefundAmount || 0),
      totalAmount: typeof returnRow.total_amount !== 'undefined' ? returnRow.total_amount : (returnRow.totalAmount || 0),
      status: returnRow.status,
      reason: returnRow.reason,
      items: returnRow.items // Already parsed by repository
    };

    // Populate Customer
    if (returnObj.customerId) {
      const customer = await CustomerRepository.findById(returnObj.customerId);
      returnObj.customer = customer;
    }

    // Populate Supplier (normalize snake_case to camelCase for frontend)
    if (returnObj.supplierId) {
      const supplierRow = await SupplierRepository.findById(returnObj.supplierId);
      if (supplierRow) {
        returnObj.supplier = {
          id: supplierRow.id,
          _id: supplierRow.id,
          companyName: supplierRow.company_name || supplierRow.companyName,
          businessName: supplierRow.business_name || supplierRow.businessName,
          name: supplierRow.name
        };
      }
    }

    // Populate Original Order
    if (returnObj.referenceId) {
      const isPurchase = returnObj.origin === 'purchase' || returnObj.returnType === 'purchase_return';
      const originalOrder = await this.fetchAndNormalizeOrder(returnObj.referenceId, isPurchase);
      if (originalOrder) {
        returnObj.originalOrder = {
          _id: originalOrder.id,
          id: originalOrder.id,
          orderNumber: originalOrder.orderNumber,
          soNumber: originalOrder.orderNumber,
          createdAt: originalOrder.createdAt,
          orderDate: originalOrder.orderDate,
          invoiceNumber: originalOrder.orderNumber,
          poNumber: originalOrder.poNumber || originalOrder.orderNumber,
          customer: originalOrder.customer,
          supplier: originalOrder.supplier
        };
        // Fallback: If return has no customer attached but order has one, use it
        if (!returnObj.customer && originalOrder.customer) {
          returnObj.customer = originalOrder.customer;
        }
        // Fallback: If return has no supplier (purchase return) but original order has one, use it
        if (!returnObj.supplier && isPurchase && originalOrder.supplier) {
          const sup = originalOrder.supplier;
          returnObj.supplier = {
            id: sup.id || sup._id,
            _id: sup.id || sup._id,
            companyName: sup.company_name || sup.companyName,
            businessName: sup.business_name || sup.businessName,
            name: sup.name
          };
        }
      }
    }

    // Populate Items with Product Details
    if (returnObj.items && Array.isArray(returnObj.items)) {
      const populatedItems = [];
      for (const item of returnObj.items) {
        const productId = item.product || item.product_id;
        let product = null;
        if (productId) {
          const pId = typeof productId === 'object' ? (productId.id || productId._id) : productId;
          product = await ProductRepository.findById(pId);
        }
        populatedItems.push({
          ...item,
          product: product || { name: 'Unknown Product', _id: productId } // Ensure product object exists
        });
      }
      returnObj.items = populatedItems;
    }

    return returnObj;
  }

  // Get single return by ID
  async getReturnById(returnId) {
    const returnRequest = await ReturnRepository.findById(returnId);
    if (!returnRequest) {
      throw new Error('Return request not found');
    }
    return await this.populateReturnData(returnRequest);
  }


  // Update return inspection details (persisted to Postgres)
  async updateInspection(returnId, inspectionData, userId) {
    const returnRequest = await ReturnRepository.findById(returnId);
    if (!returnRequest) {
      throw new Error('Return request not found');
    }
    const inspection = {
      inspectedBy: userId,
      inspectionDate: new Date(),
      ...inspectionData
    };
    await ReturnRepository.update(returnId, { inspection, updatedBy: userId });
    const updated = await ReturnRepository.findById(returnId);
    return { ...updated, inspection: inspection };
  }

  // Add note to return (no-op until returns.notes or separate notes table exists)
  async addNote(returnId, note, userId, isInternal = false) {
    const returnRequest = await ReturnRepository.findById(returnId);
    if (!returnRequest) throw new Error('Return request not found');
    return returnRequest;
  }

  // Add communication log to return (no-op until returns comms storage exists)
  async addCommunication(returnId, type, message, userId, recipient) {
    const returnRequest = await ReturnRepository.findById(returnId);
    if (!returnRequest) throw new Error('Return request not found');
    return returnRequest;
  }

  /**
   * Issue refund payment for a deferred sale return.
   * Use when customer was owed a refund (from "No Refund Yet") and you are now paying them.
   * Posts: Dr AR, Cr Cash (or Cr Bank) — records the actual cash/bank outflow.
   */
  async issueRefundForDeferredReturn(returnId, { amount, method = 'cash', bankId = null, date }, userId) {
    const returnRow = await ReturnRepository.findById(returnId);
    if (!returnRow) throw new Error('Return not found');

    const refundMethod = returnRow.refund_details?.refundMethod || returnRow.refundMethod;
    if (refundMethod !== 'deferred' && refundMethod !== 'none') {
      throw new Error('This return does not have deferred refund. Refund was already processed at creation.');
    }
    if (returnRow.refund_details?.refundPaidAt) {
      throw new Error('Refund has already been paid for this return.');
    }

    const returnType = (returnRow.return_type || '').toLowerCase();
    if (returnType.includes('purchase')) {
      throw new Error('Issue refund is only for sale returns, not purchase returns.');
    }

    if (returnRow.status !== 'processed') {
      throw new Error('Return must be processed before issuing refund.');
    }

    const netAmount = parseFloat(returnRow.total_amount) || 0;
    if (netAmount <= 0) throw new Error('Return has no refund amount.');

    const refundAmount = amount != null ? parseFloat(amount) : netAmount;
    if (isNaN(refundAmount) || refundAmount <= 0 || refundAmount > netAmount) {
      throw new Error(`Refund amount must be between 0 and ${netAmount}.`);
    }

    const customerId = toUuid(returnRow.customer_id);
    if (!customerId) throw new Error('Return has no customer.');

    const returnNumber = returnRow.return_number || `RET-${returnId.substring(0, 8)}`;
    const particular = `Refund for Return ${returnNumber}`;
    const notes = `Sale Return: ${returnNumber}`;

    return await transaction(async (client) => {
      let payment;
      if (method === 'cash') {
        const cashPaymentData = {
          date: date ? new Date(date) : new Date(),
          amount: refundAmount,
          particular,
          notes,
          customerId,
          paymentMethod: 'cash',
          createdBy: userId
        };
        payment = await cashPaymentRepository.create(cashPaymentData, client);
        await AccountingService.recordCashPayment(
          { ...payment, customer_id: customerId, customerId },
          client
        );
      } else if (method === 'bank_transfer' || method === 'check') {
        const bankPaymentData = {
          date: date ? new Date(date) : new Date(),
          amount: refundAmount,
          particular,
          notes,
          bankId: bankId || null,
          customerId,
          createdBy: userId
        };
        payment = await bankPaymentRepository.create(bankPaymentData, client);
        await AccountingService.recordBankPayment(
          { ...payment, customer_id: customerId, customerId },
          client
        );
      } else {
        throw new Error('Refund method must be cash, bank_transfer, or check.');
      }

      const refundDetails = {
        ...(returnRow.refund_details || {}),
        refundMethod: returnRow.refund_details?.refundMethod,
        refundPaidAt: new Date(),
        refundPaymentId: payment.id,
        refundPaymentType: method === 'cash' ? 'cash_payment' : 'bank_payment'
      };
      await ReturnRepository.update(returnId, { refundDetails }, client);

      const updatedReturn = await ReturnRepository.findById(returnId);
      return {
        return: await this.populateReturnData(updatedReturn),
        payment
      };
    });
  }

  // Cancel return request
  async cancelReturn(returnId, userId) {
    const returnRequest = await ReturnRepository.findById(returnId);
    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    const status = returnRequest.status;
    if (status !== 'pending') {
      throw new Error('Only pending return requests can be cancelled');
    }

    await ReturnRepository.update(returnId, { status: 'cancelled', updatedBy: userId });
    return await ReturnRepository.findById(returnId) || returnRequest;
  }

  // Delete return request
  async deleteReturn(returnId) {
    const returnRequest = await ReturnRepository.findById(returnId);
    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    if (!['pending', 'cancelled'].includes(returnRequest.status)) {
      throw new Error('Only pending or cancelled return requests can be deleted');
    }

    await ReturnRepository.softDelete(returnId);
    return { message: 'Return request deleted successfully' };
  }
}

module.exports = new ReturnManagementService();
