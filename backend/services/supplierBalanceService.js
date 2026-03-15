const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const AccountingService = require('./accountingService');

class SupplierBalanceService {
  /**
   * Update supplier balance when payment is made
   * @param {String} supplierId - Supplier ID
   * @param {Number} paymentAmount - Amount paid
   * @param {String} purchaseOrderId - Purchase Order ID (optional)
   * @returns {Promise<Object>}
   */
  static async recordPayment(supplierId, paymentAmount, purchaseOrderId = null) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Note: Manual balance updates removed. 
      // Reliance now exclusively on AccountingService for dynamic balances.
      return supplier;
    } catch (error) {
      console.error('Error recording supplier payment:', error);
      throw error;
    }
  }

  /**
   * Update supplier balance when purchase order is created
   * @param {String} supplierId - Supplier ID
   * @param {Number} purchaseAmount - Purchase amount
   * @param {String} purchaseOrderId - Purchase Order ID
   * @returns {Promise<Object>}
   */
  static async recordPurchase(supplierId, purchaseAmount, purchaseOrderId = null) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Note: Manual balance updates removed. 
      // Reliance now exclusively on AccountingService for dynamic balances.
      return supplier;
    } catch (error) {
      console.error('Error recording supplier purchase:', error);
      throw error;
    }
  }

  /**
   * Update supplier balance when refund is received
   * @param {String} supplierId - Supplier ID
   * @param {Number} refundAmount - Refund amount
   * @param {String} purchaseOrderId - Purchase Order ID (optional)
   * @returns {Promise<Object>}
   */
  static async recordRefund(supplierId, refundAmount, purchaseOrderId = null) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Note: Manual balance updates removed. 
      // Reliance now exclusively on AccountingService for dynamic balances.
      return supplier;
    } catch (error) {
      console.error('Error recording supplier refund:', error);
      throw error;
    }
  }

  /**
   * Get supplier balance summary
   * @param {String} supplierId - Supplier ID
   * @returns {Promise<Object>}
   */
  static async getBalanceSummary(supplierId) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Get recent purchase orders for this supplier
      const recentPurchaseOrders = await PurchaseOrder.find({ supplier: supplierId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('poNumber total status createdAt');

      const balance = await AccountingService.getSupplierBalance(supplierId);

      return {
        supplier: {
          _id: supplier._id,
          companyName: supplier.companyName,
          contactPerson: supplier.contactPerson,
          email: supplier.email,
          phone: supplier.phone
        },
        balances: {
          pendingBalance: balance > 0 ? balance : 0,
          advanceBalance: balance < 0 ? Math.abs(balance) : 0,
          currentBalance: balance,
          creditLimit: supplier.creditLimit || 0
        },
        recentPurchaseOrders: recentPurchaseOrders.map(po => ({
          poNumber: po.poNumber,
          total: po.total,
          status: po.status,
          createdAt: po.createdAt
        }))
      };
    } catch (error) {
      console.error('Error getting supplier balance summary:', error);
      throw error;
    }
  }

  /**
   * Recalculate supplier balance from all purchase orders
   * @param {String} supplierId - Supplier ID
   * @returns {Promise<Object>}
   */
  static async recalculateBalance(supplierId) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Get all purchase orders for this supplier
      const purchaseOrders = await PurchaseOrder.find({ supplier: supplierId });

      let totalPurchased = 0;
      let totalPaid = 0;

      purchaseOrders.forEach(po => {
        totalPurchased += po.total;
        totalPaid += po.payment?.amountPaid || 0;
      });

      const calculatedPendingBalance = Math.max(0, totalPurchased - totalPaid);
      const calculatedAdvanceBalance = Math.max(0, totalPaid - totalPurchased);

      // Update supplier balances
      const updatedSupplier = await Supplier.findByIdAndUpdate(
        supplierId,
        {
          $set: {
            pendingBalance: calculatedPendingBalance,
            advanceBalance: calculatedAdvanceBalance,
            currentBalance: calculatedPendingBalance
          }
        },
        { new: true }
      );

      console.log(`Supplier ${supplierId} balance recalculated:`, {
        totalPurchased,
        totalPaid,
        calculatedPendingBalance,
        calculatedAdvanceBalance
      });

      return updatedSupplier;
    } catch (error) {
      console.error('Error recalculating supplier balance:', error);
      throw error;
    }
  }

  /**
   * Check if supplier can accept purchase order
   * @param {String} supplierId - Supplier ID
   * @param {Number} amount - Purchase amount
   * @returns {Promise<Object>}
   */
  static async canAcceptPurchase(supplierId, amount) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const currentBalance = await AccountingService.getSupplierBalance(supplierId);
      const canAccept = supplier.status === 'active';
      const availableCredit = (supplier.creditLimit || 0) - currentBalance;

      return {
        canAccept,
        availableCredit,
        currentBalance,
        creditLimit: supplier.creditLimit,
        pendingBalance: currentBalance > 0 ? currentBalance : 0,
        advanceBalance: currentBalance < 0 ? Math.abs(currentBalance) : 0
      };
    } catch (error) {
      console.error('Error checking purchase eligibility:', error);
      throw error;
    }
  }
}

module.exports = SupplierBalanceService;
