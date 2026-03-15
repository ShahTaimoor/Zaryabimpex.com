const Return = require('../models/Return');
const Sales = require('../models/Sales');
const SalesOrder = require('../models/SalesOrder');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const CustomerBalanceService = require('../services/customerBalanceService');
const AccountingService = require('../services/accountingService');
const ReturnRepository = require('../repositories/ReturnRepository');
const SalesRepository = require('../repositories/SalesRepository');
const TransactionRepository = require('../repositories/TransactionRepository');
const mongoose = require('mongoose');

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

  // Create a new return request
  async createReturn(returnData, requestedBy) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate original order - check if it's a sales return or purchase return
      const isPurchaseReturn = returnData.origin === 'purchase';

      let originalOrder;
      if (isPurchaseReturn) {
        // Try PurchaseInvoice first, then PurchaseOrder
        originalOrder = await PurchaseInvoice.findById(returnData.originalOrder)
          .populate('supplier')
          .populate('items.product');

        if (!originalOrder) {
          originalOrder = await PurchaseOrder.findById(returnData.originalOrder)
            .populate('supplier')
            .populate('items.product');
        }
      } else {
        // Try Sales first, then SalesOrder
        originalOrder = await Sales.findById(returnData.originalOrder)
          .populate('customer')
          .populate('items.product');

        if (!originalOrder) {
          originalOrder = await SalesOrder.findById(returnData.originalOrder)
            .populate('customer')
            .populate('items.product');
        }
      }

      if (!originalOrder) {
        throw new Error('Original order not found');
      }

      // Check if order is eligible for return (only for sales returns)
      if (!isPurchaseReturn) {
        const eligibility = await this.checkReturnEligibility(originalOrder, returnData.items);
        if (!eligibility.eligible) {
          throw new Error(eligibility.reason);
        }

        // Validate return items
        await this.validateReturnItems(originalOrder, returnData.items);
      }

      // Create return object with today's date at local midnight (avoid timezone issues)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day in local timezone

      const returnRequest = new Return({
        ...returnData,
        customer: isPurchaseReturn ? null : (originalOrder.customer?._id || originalOrder.customer),
        supplier: isPurchaseReturn ? (originalOrder.supplier?._id || originalOrder.supplier) : null,
        requestedBy,
        returnDate: today,
        status: 'completed', // Set directly to completed - no approval/process needed
        processedBy: requestedBy, // Mark as processed by the creator
        receivedBy: requestedBy,
        completionDate: new Date(),
        receivedDate: new Date()
      });

      // Ensure policy object exists before any calculations
      if (!returnRequest.policy) {
        returnRequest.policy = { restockingFeePercent: 0 };
      }

      // Calculate refund amounts
      await this.calculateRefundAmounts(returnRequest);

      console.log('Return amounts after calculation:', {
        totalRefundAmount: returnRequest.totalRefundAmount,
        totalRestockingFee: returnRequest.totalRestockingFee,
        netRefundAmount: returnRequest.netRefundAmount
      });

      // Save return request
      await returnRequest.save({ session });

      console.log('Return amounts after save:', {
        totalRefundAmount: returnRequest.totalRefundAmount,
        totalRestockingFee: returnRequest.totalRestockingFee,
        netRefundAmount: returnRequest.netRefundAmount
      });

      // Populate return request for processing
      await returnRequest.populate([
        { path: 'originalOrder', populate: { path: 'customer supplier items.product' } },
        { path: 'items.product' },
        { path: 'customer' },
        { path: 'supplier' }
      ]);

      // Immediately process the return (update inventory and accounting)
      // Update inventory for returned items (with proper cost tracking)
      await this.updateInventoryForReturn(returnRequest);

      // Process refund or exchange with accounting entries
      if (returnRequest.returnType === 'return') {
        await this.processRefund(returnRequest);
      } else if (returnRequest.returnType === 'exchange') {
        await this.processExchange(returnRequest);
      }

      // Commit transaction
      await session.commitTransaction();

      // Send completion notification (outside transaction)
      await this.notifyCustomer(returnRequest, 'return_completed');

      return returnRequest;
    } catch (error) {
      await session.abortTransaction();
      console.error('Error creating return:', error);
      throw error;
    } finally {
      session.endSession();
    }
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
        item._id.toString() === returnItem.originalOrderItem.toString()
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
      // Find the original order item
      const orderItem = originalOrder.items.find(item =>
        item._id.toString() === returnItem.originalOrderItem.toString()
      );

      if (!orderItem) {
        throw new Error(`Order item not found: ${returnItem.originalOrderItem}`);
      }

      // Validate product exists
      const product = await Product.findById(orderItem.product._id);
      if (!product) {
        throw new Error(`Product not found: ${orderItem.product._id}`);
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
      originalOrder: orderId,
      'items.originalOrderItem': orderItemId,
      status: { $nin: ['rejected', 'cancelled'] }
    });

    let totalReturned = 0;
    returns.forEach(returnDoc => {
      returnDoc.items.forEach(item => {
        if (item.originalOrderItem.toString() === orderItemId.toString()) {
          totalReturned += item.quantity;
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

      if (returnRequest.status !== 'pending') {
        throw new Error('Return request cannot be approved in current status');
      }

      // Update status to approved
      await returnRequest.updateStatus('approved', approvedBy, notes);

      // Send approval notification
      await this.notifyCustomer(returnRequest, 'return_approved');

      return returnRequest;
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

      if (returnRequest.status !== 'pending') {
        throw new Error('Return request cannot be rejected in current status');
      }

      // Update status to rejected
      await returnRequest.updateStatus('rejected', rejectedBy, `Rejected: ${reason}`);

      // Send rejection notification
      await this.notifyCustomer(returnRequest, 'return_rejected');

      return returnRequest;
    } catch (error) {
      console.error('Error rejecting return:', error);
      throw error;
    }
  }

  // Process received return with full accounting integration
  async processReceivedReturn(returnId, receivedBy, inspectionData = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const returnRequest = await ReturnRepository.findById(returnId, [
        { path: 'originalOrder', populate: { path: 'customer supplier items.product' } },
        { path: 'items.product' },
        { path: 'customer' },
        { path: 'supplier' }
      ]);

      if (!returnRequest) {
        throw new Error('Return request not found');
      }

      if (!['approved', 'processing', 'received'].includes(returnRequest.status)) {
        throw new Error('Return cannot be processed in current status');
      }

      // Update status to received
      await returnRequest.updateStatus('received', receivedBy);

      // Add inspection data
      if (inspectionData) {
        returnRequest.inspection = {
          ...inspectionData,
          inspectedBy: receivedBy,
          inspectionDate: new Date()
        };
        await returnRequest.save({ session });
      }

      // Update inventory for returned items (with proper cost tracking)
      await this.updateInventoryForReturn(returnRequest);

      // Process refund or exchange with accounting entries
      if (returnRequest.returnType === 'return') {
        await this.processRefund(returnRequest);
      } else if (returnRequest.returnType === 'exchange') {
        await this.processExchange(returnRequest);
      }

      // Update status to completed
      await returnRequest.updateStatus('completed', receivedBy);

      // Commit transaction
      await session.commitTransaction();

      // Send completion notification (outside transaction)
      await this.notifyCustomer(returnRequest, 'return_completed');

      return returnRequest;
    } catch (error) {
      await session.abortTransaction();
      console.error('Error processing return:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Update inventory for returned items with proper cost tracking
  async updateInventoryForReturn(returnRequest) {
    const isPurchaseReturn = returnRequest.origin === 'purchase';

    for (const item of returnRequest.items) {
      // Find or create inventory record
      let inventory = await Inventory.findOne({
        product: item.product._id || item.product
      });

      if (!inventory) {
        inventory = new Inventory({
          product: item.product._id || item.product,
          currentStock: 0,
          reservedStock: 0,
          reorderPoint: 0,
          reorderQuantity: 0
        });
      }

      // Get original order to find cost
      const originalOrder = await this.getOriginalOrder(returnRequest.originalOrder, isPurchaseReturn);
      const originalItem = originalOrder.items.find(oi =>
        oi._id.toString() === item.originalOrderItem.toString()
      );

      // Fix: Support both Sales (unitCost, unitPrice) and Purchase (costPerUnit) schemas
      const unitCost = originalItem?.unitCost || originalItem?.costPerUnit || originalItem?.unitPrice || 0;
      const returnCost = unitCost * item.quantity;

      // For Sale Return: Increase inventory (stock comes back)
      // For Purchase Return: Decrease inventory (stock goes back to supplier)
      if (isPurchaseReturn) {
        // Purchase Return: Decrease stock
        if (inventory.currentStock < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.product.name || item.product._id}. Available: ${inventory.currentStock}, Required: ${item.quantity}`);
        }

        // Log inventory movement (out) - addStockMovement will update stock
        await this.logInventoryMovement(
          item,
          'out',
          item.quantity,
          returnCost,
          returnRequest.returnNumber,
          returnRequest._id
        );
      } else {
        // Sale Return: Increase stock if resellable
        if (!returnRequest.inspection || returnRequest.inspection.resellable !== false) {
          // Log inventory movement (in) with cost - addStockMovement will update stock
          await this.logInventoryMovement(
            item,
            'return',
            item.quantity,
            returnCost,
            returnRequest.returnNumber,
            returnRequest._id
          );
        }
      }
    }
  }

  // Helper to get original order with populated items
  async getOriginalOrder(orderId, isPurchaseReturn) {
    if (isPurchaseReturn) {
      let order = await PurchaseInvoice.findById(orderId).populate('items.product');
      if (!order) {
        order = await PurchaseOrder.findById(orderId).populate('items.product');
      }
      return order;
    } else {
      let order = await Sales.findById(orderId).populate('items.product');
      if (!order) {
        order = await SalesOrder.findById(orderId).populate('items.product');
      }
      return order;
    }
  }

  // Log inventory movement with proper cost tracking
  async logInventoryMovement(item, type, quantity, cost, reference, returnId = null) {
    try {
      const productId = item.product._id || item.product;
      const inventory = await Inventory.findOne({ product: productId });

      if (inventory) {
        // Determine movement type based on quantity direction
        let movementType = 'return';
        if (type === 'return') {
          movementType = quantity > 0 ? 'return' : 'out'; // 'return' for stock in, 'out' for stock out
        } else {
          movementType = type;
        }

        await inventory.addStockMovement({
          type: movementType,
          quantity: Math.abs(quantity),
          cost: cost || 0,
          reference: reference || 'Return',
          referenceModel: 'Return', // Set referenceModel to 'Return'
          referenceId: returnId || null, // Set referenceId to return document ID
          notes: `Return ${reference || ''}`,
          reason: `Return ${reference || ''}`
        });
      }
    } catch (error) {
      console.error('Error logging inventory movement:', error);
      // Don't throw - inventory update is more critical
    }
  }

  // Process refund with proper accounting entries
  async processRefund(returnRequest) {
    try {
      const isPurchaseReturn = returnRequest.origin === 'purchase';
      const netAmount = returnRequest.netRefundAmount || 0;

      if (isPurchaseReturn) {
        // Purchase Return: Process supplier refund/credit
        await this.processPurchaseReturnRefund(returnRequest, netAmount);
      } else {
        // Sale Return: Process customer refund
        await this.processSaleReturnRefund(returnRequest, netAmount);
      }

      // Update return with refund details
      returnRequest.refundDetails = {
        refundDate: new Date(),
        refundReference: returnRequest.returnNumber
      };

      await returnRequest.save();

      return returnRequest;
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  }

  // Process Sale Return refund with accounting entries
  async processSaleReturnRefund(returnRequest, refundAmount) {
    try {
      const accountCodes = await AccountingService.getDefaultAccountCodes();

      // Get original sale to determine payment method
      const originalSale = await Sales.findById(returnRequest.originalOrder)
        .populate('customer')
        .populate('items.product');

      if (!originalSale) {
        throw new Error('Original sale not found');
      }

      // Calculate COGS adjustment (reverse COGS for returned items)
      const cogsAdjustment = await this.calculateCOGSAdjustment(returnRequest, originalSale);

      // Create accounting entries based on refund method
      const refundMethod = returnRequest.refundMethod || 'original_payment';

      if (refundMethod === 'cash' || refundMethod === 'original_payment') {
        // Cash refund: Dr Sales Return, Cr Cash
        await this.createAccountingEntry({
          accountCode: await AccountingService.getAccountCode('Sales Returns', 'revenue', 'sales_revenue').catch(() => accountCodes.salesRevenue),
          debitAmount: refundAmount,
          creditAmount: 0,
          description: `Sale Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });

        await this.createAccountingEntry({
          accountCode: accountCodes.cash,
          debitAmount: 0,
          creditAmount: refundAmount,
          description: `Cash Refund for Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });
      } else if (refundMethod === 'store_credit') {
        // Store credit: Dr Sales Return, Cr Customer Account Receivable (credit balance)
        await this.createAccountingEntry({
          accountCode: await AccountingService.getAccountCode('Sales Returns', 'revenue', 'sales_revenue').catch(() => accountCodes.salesRevenue),
          debitAmount: refundAmount,
          creditAmount: 0,
          description: `Sale Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });

        // Adjust customer balance (credit)
        await CustomerBalanceService.recordRefund(
          returnRequest.customer,
          refundAmount,
          returnRequest.originalOrder,
          null,
          { returnId: returnRequest._id, returnNumber: returnRequest.returnNumber }
        );
      } else {
        // Bank transfer or other: Dr Sales Return, Cr Bank
        await this.createAccountingEntry({
          accountCode: await AccountingService.getAccountCode('Sales Returns', 'revenue', 'sales_revenue').catch(() => accountCodes.salesRevenue),
          debitAmount: refundAmount,
          creditAmount: 0,
          description: `Sale Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });

        await this.createAccountingEntry({
          accountCode: accountCodes.bank,
          debitAmount: 0,
          creditAmount: refundAmount,
          description: `Bank Refund for Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });
      }

      // COGS Adjustment: Dr Inventory, Cr COGS (reverse the original COGS)
      if (cogsAdjustment > 0) {
        await this.createAccountingEntry({
          accountCode: accountCodes.inventory,
          debitAmount: cogsAdjustment,
          creditAmount: 0,
          description: `Inventory Restored - Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });

        await this.createAccountingEntry({
          accountCode: accountCodes.costOfGoodsSold,
          debitAmount: 0,
          creditAmount: cogsAdjustment,
          description: `COGS Reversed - Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });
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
  async processPurchaseReturnRefund(returnRequest, refundAmount) {
    try {
      const accountCodes = await AccountingService.getDefaultAccountCodes();

      // Get original purchase invoice
      const originalInvoice = await PurchaseInvoice.findById(returnRequest.originalOrder)
        .populate('supplier')
        .populate('items.product');

      if (!originalInvoice) {
        throw new Error('Original purchase invoice not found');
      }

      // Calculate COGS adjustment (reverse COGS for returned items)
      const cogsAdjustment = await this.calculatePurchaseCOGSAdjustment(returnRequest, originalInvoice);

      // Accounting Entry: Dr Supplier Accounts Payable, Cr Purchase Returns
      await this.createAccountingEntry({
        accountCode: accountCodes.accountsPayable,
        debitAmount: refundAmount,
        creditAmount: 0,
        description: `Purchase Return ${returnRequest.returnNumber} - Supplier Credit`,
        reference: returnRequest.returnNumber,
        returnId: returnRequest._id,
        supplierId: returnRequest.supplier
      });

      await this.createAccountingEntry({
        accountCode: await AccountingService.getAccountCode('Purchase Returns', 'expense', 'cost_of_goods_sold').catch(() => accountCodes.costOfGoodsSold),
        debitAmount: 0,
        creditAmount: refundAmount,
        description: `Purchase Return ${returnRequest.returnNumber}`,
        reference: returnRequest.returnNumber,
        returnId: returnRequest._id
      });

      // COGS Adjustment: Dr COGS, Cr Inventory (reverse inventory increase)
      if (cogsAdjustment > 0) {
        await this.createAccountingEntry({
          accountCode: accountCodes.costOfGoodsSold,
          debitAmount: cogsAdjustment,
          creditAmount: 0,
          description: `COGS Adjusted - Purchase Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });

        await this.createAccountingEntry({
          accountCode: accountCodes.inventory,
          debitAmount: 0,
          creditAmount: cogsAdjustment,
          description: `Inventory Reduced - Purchase Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });
      }

      // Handle payment method
      const refundMethod = returnRequest.refundMethod || 'original_payment';
      if (refundMethod === 'cash' || refundMethod === 'bank_transfer') {
        // If cash/bank refund received from supplier
        const cashAccount = refundMethod === 'cash' ? accountCodes.cash : accountCodes.bank;

        await this.createAccountingEntry({
          accountCode: cashAccount,
          debitAmount: refundAmount,
          creditAmount: 0,
          description: `Cash/Bank Refund Received - Purchase Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });

        await this.createAccountingEntry({
          accountCode: accountCodes.accountsPayable,
          debitAmount: 0,
          creditAmount: refundAmount,
          description: `Supplier Payable Reduced - Purchase Return ${returnRequest.returnNumber}`,
          reference: returnRequest.returnNumber,
          returnId: returnRequest._id
        });
      }

      // Update supplier balance
      await this.updateSupplierBalance(returnRequest.supplier, refundAmount, returnRequest.originalOrder);

    } catch (error) {
      console.error('Error processing purchase return refund:', error);
      throw error;
    }
  }

  // Create accounting entry
  async createAccountingEntry(entryData) {
    try {
      const transaction = new Transaction({
        transactionId: `RET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        orderId: entryData.returnId || entryData.orderId,
        paymentId: entryData.returnId,
        type: 'adjustment',
        amount: entryData.debitAmount || entryData.creditAmount,
        accountCode: entryData.accountCode,
        debitAmount: entryData.debitAmount || 0,
        creditAmount: entryData.creditAmount || 0,
        description: entryData.description,
        reference: entryData.reference,
        status: 'completed',
        paymentMethod: 'bank_transfer', // Use valid enum value for accounting entries
        metadata: {
          returnId: entryData.returnId,
          returnNumber: entryData.reference,
          entryType: 'return',
          isAccountingEntry: true // Flag to identify this as an accounting entry, not a real payment
        }
      });

      await transaction.save();
      return transaction;
    } catch (error) {
      console.error('Error creating accounting entry:', error);
      throw error;
    }
  }

  // Calculate COGS adjustment for sale return
  async calculateCOGSAdjustment(returnRequest, originalSale) {
    let totalCOGS = 0;

    for (const returnItem of returnRequest.items) {
      const originalItem = originalSale.items.find(oi =>
        oi._id.toString() === returnItem.originalOrderItem.toString()
      );

      if (originalItem) {
        const unitCost = originalItem.unitCost || 0;
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
        const unitCost = originalItem.unitCost || 0;
        totalCOGS += unitCost * returnItem.quantity;
      }
    }

    return totalCOGS;
  }

  // Update supplier balance
  async updateSupplierBalance(supplierId, amount, originalInvoiceId) {
    try {
      const SupplierBalanceService = require('../services/supplierBalanceService');
      if (SupplierBalanceService && SupplierBalanceService.recordReturn) {
        await SupplierBalanceService.recordReturn(supplierId, amount, originalInvoiceId);
      } else {
        // Fallback: Update supplier directly
        const supplier = await Supplier.findById(supplierId);
        if (supplier) {
          supplier.currentBalance = (supplier.currentBalance || 0) - amount;
          await supplier.save();
        }
      }
    } catch (error) {
      console.error('Error updating supplier balance:', error);
      // Don't throw - accounting entries are more critical
    }
  }

  // Process exchange
  async processExchange(returnRequest) {
    try {
      // Create new order for exchange items
      const exchangeOrder = new Sales({
        orderNumber: `EXC-${Date.now()}`,
        customer: returnRequest.customer,
        items: returnRequest.exchangeDetails.exchangeItems,
        orderType: 'exchange',
        status: 'completed',
        metadata: {
          originalReturn: returnRequest._id,
          exchangeType: 'return_exchange'
        }
      });

      await exchangeOrder.save();

      // Update return with exchange details
      returnRequest.exchangeDetails.exchangeOrder = exchangeOrder._id;
      await returnRequest.save();

      return exchangeOrder;
    } catch (error) {
      console.error('Error processing exchange:', error);
      throw error;
    }
  }

  // Notify customer about return status
  async notifyCustomer(returnRequest, notificationType) {
    try {
      const customer = await Customer.findById(returnRequest.customer);
      if (!customer) return;

      const messages = {
        return_requested: `Your return request ${returnRequest.returnNumber} has been submitted and is under review.`,
        return_approved: `Your return request ${returnRequest.returnNumber} has been approved. Please ship items back.`,
        return_rejected: `Your return request ${returnRequest.returnNumber} has been rejected. Contact support for details.`,
        return_completed: `Your return request ${returnRequest.returnNumber} has been completed. Refund processed.`
      };

      const message = messages[notificationType];
      if (message) {
        await returnRequest.addCommunication(
          'email',
          message,
          null, // System generated
          customer.email
        );
      }
    } catch (error) {
      console.error('Error notifying customer:', error);
    }
  }

  // Get return statistics
  async getReturnStats(period = {}) {
    try {
      const stats = await ReturnRepository.getStats(period);

      // Get additional metrics
      const filter = period.startDate && period.endDate ? {
        returnDate: {
          $gte: period.startDate,
          $lte: period.endDate
        }
      } : {};

      const totalReturns = await ReturnRepository.count(filter);

      const pendingFilter = {
        status: 'pending',
        ...(period.startDate && period.endDate ? {
          returnDate: {
            $gte: period.startDate,
            $lte: period.endDate
          }
        } : {})
      };
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

  // Calculate average processing time
  async calculateAverageProcessingTime(period = {}) {
    const match = {
      status: 'completed',
      ...(period.startDate && period.endDate ? {
        returnDate: {
          $gte: period.startDate,
          $lte: period.endDate
        }
      } : {})
    };

    const result = await Return.aggregate([
      { $match: match },
      {
        $project: {
          processingTime: {
            $divide: [
              { $subtract: ['$completionDate', '$returnDate'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          averageProcessingTime: { $avg: '$processingTime' }
        }
      }
    ]);

    return result[0]?.averageProcessingTime || 0;
  }

  // Calculate return rate
  async calculateReturnRate(period = {}) {
    const match = period.startDate && period.endDate ? {
      createdAt: {
        $gte: period.startDate,
        $lte: period.endDate
      }
    } : {};

    const totalOrders = await Sales.countDocuments(match);
    const totalReturns = await Return.countDocuments({
      ...match,
      status: { $nin: ['rejected', 'cancelled'] }
    });

    return totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;
  }

  // Get return trends
  async getReturnTrends(periods = 12) {
    try {
      const trends = await ReturnRepository.getTrends(periods);

      // Format trends data
      return trends.map(trend => ({
        period: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`,
        totalReturns: trend.count || 0,
        totalRefundAmount: trend.totalRefundAmount || 0,
        averageRefundAmount: trend.averageRefundAmount || 0
      }));
    } catch (error) {
      console.error('Error getting return trends:', error);
      throw error;
    }
  }

  // Get returns with filters and pagination
  async getReturns(queryParams) {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 10;

    const filter = {};

    // Apply filters
    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.returnType) filter.returnType = queryParams.returnType;
    if (queryParams.customer) filter.customer = queryParams.customer;
    if (queryParams.priority) filter.priority = queryParams.priority;

    // Date range filter - use dateFilter from middleware if available (Pakistan timezone)
    // Otherwise fall back to legacy startDate/endDate handling
    if (queryParams.dateFilter && Object.keys(queryParams.dateFilter).length > 0) {
      // Merge date filter from middleware (already in Pakistan timezone)
      Object.assign(filter, queryParams.dateFilter);
    } else if (queryParams.startDate || queryParams.endDate) {
      // Legacy date filtering (for backward compatibility)
      const { buildDateRangeFilter } = require('../utils/dateFilter');
      const dateFilter = buildDateRangeFilter(queryParams.startDate, queryParams.endDate, 'returnDate');
      Object.assign(filter, dateFilter);
    }

    // Search filter
    if (queryParams.search) {
      filter.$or = [
        { returnNumber: { $regex: queryParams.search, $options: 'i' } },
        { 'customer.firstName': { $regex: queryParams.search, $options: 'i' } },
        { 'customer.lastName': { $regex: queryParams.search, $options: 'i' } }
      ];
    }

    const result = await ReturnRepository.findWithPagination(filter, {
      page,
      limit,
      sort: { returnDate: -1 }
    });

    // Manually populate originalOrder based on origin (since originalOrder has no ref)
    const Sales = require('../models/Sales');
    const SalesOrder = require('../models/SalesOrder');
    const PurchaseInvoice = require('../models/PurchaseInvoice');
    const PurchaseOrder = require('../models/PurchaseOrder');

    // Populate originalOrder for all returns (since originalOrder has no ref, populate manually)
    const populatedReturns = await Promise.all(result.returns.map(async (returnItem) => {
      // Convert to plain object if needed
      const returnObj = returnItem.toObject ? returnItem.toObject() : { ...returnItem };
      
      // Get the originalOrder ID (could be ObjectId, string, or already populated object)
      let orderId = null;
      if (returnObj.originalOrder) {
        if (typeof returnObj.originalOrder === 'string' || returnObj.originalOrder._id) {
          // It's an ObjectId (string or ObjectId object)
          orderId = returnObj.originalOrder._id || returnObj.originalOrder;
        } else if (returnObj.originalOrder.orderNumber || returnObj.originalOrder.invoiceNumber || returnObj.originalOrder.poNumber) {
          // Already populated, keep it
          return returnObj;
        } else {
          // Try to get _id from the object
          orderId = returnObj.originalOrder._id || returnObj.originalOrder.toString();
        }
      }
      
      if (orderId) {
        let originalOrder = null;
        
        if (returnObj.origin === 'sales') {
          // Try Sales first (most common for sale returns)
          originalOrder = await Sales.findById(orderId)
            .select('orderNumber soNumber invoiceNumber createdAt orderDate')
            .lean();
          // If not found, try SalesOrder
          if (!originalOrder) {
            originalOrder = await SalesOrder.findById(orderId)
              .select('orderNumber soNumber invoiceNumber createdAt orderDate')
              .lean();
          }
        } else if (returnObj.origin === 'purchase') {
          // Try PurchaseInvoice first
          originalOrder = await PurchaseInvoice.findById(orderId)
            .select('invoiceNumber poNumber createdAt invoiceDate')
            .lean();
          // If not found, try PurchaseOrder
          if (!originalOrder) {
            originalOrder = await PurchaseOrder.findById(orderId)
              .select('poNumber createdAt')
              .lean();
          }
        }
        
        if (originalOrder) {
          returnObj.originalOrder = originalOrder;
        }
      }
      
      return returnObj;
    }));

    return {
      returns: populatedReturns,
      pagination: result.pagination
    };
  }

  // Get single return by ID
  async getReturnById(returnId) {
    const returnRequest = await ReturnRepository.findById(returnId, [
      { path: 'originalOrder', populate: { path: 'customer' } },
      { path: 'customer', select: 'name businessName email phone firstName lastName' },
      { path: 'supplier', select: 'name businessName email phone companyName contactPerson' },
      { path: 'items.product', select: 'name description pricing' },
      { path: 'requestedBy', select: 'firstName lastName email' },
      { path: 'approvedBy', select: 'firstName lastName email' },
      { path: 'processedBy', select: 'firstName lastName email' }
    ]);

    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    return returnRequest;
  }

  // Update return inspection details
  async updateInspection(returnId, inspectionData, userId) {
    const returnRequest = await ReturnRepository.findById(returnId);
    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    returnRequest.inspection = {
      inspectedBy: userId,
      inspectionDate: new Date(),
      ...inspectionData
    };

    await returnRequest.save();
    return returnRequest;
  }

  // Add note to return
  async addNote(returnId, note, userId, isInternal = false) {
    const returnRequest = await ReturnRepository.findById(returnId);
    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    await returnRequest.addNote(note, userId, isInternal);
    return returnRequest;
  }

  // Add communication log to return
  async addCommunication(returnId, type, message, userId, recipient) {
    const returnRequest = await ReturnRepository.findById(returnId);
    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    await returnRequest.addCommunication(type, message, userId, recipient);
    return returnRequest;
  }

  // Cancel return request
  async cancelReturn(returnId, userId) {
    const returnRequest = await ReturnRepository.findById(returnId);
    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    if (returnRequest.status !== 'pending') {
      throw new Error('Only pending return requests can be cancelled');
    }

    await returnRequest.updateStatus('cancelled', userId, 'Return request cancelled');
    return returnRequest;
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
