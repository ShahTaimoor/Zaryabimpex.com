const supplierRepository = require('../repositories/postgres/SupplierRepository');
const purchaseRepository = require('../repositories/postgres/PurchaseRepository');
const AccountingService = require('./accountingService');

class SupplierBalanceService {
  static async recordPayment(supplierId, paymentAmount, purchaseOrderId = null) {
    const supplier = await supplierRepository.findById(supplierId);
    if (!supplier) throw new Error('Supplier not found');
    return supplier;
  }

  static async recordPurchase(supplierId, purchaseAmount, purchaseOrderId = null) {
    const supplier = await supplierRepository.findById(supplierId);
    if (!supplier) throw new Error('Supplier not found');
    return supplier;
  }

  static async recordRefund(supplierId, refundAmount, purchaseOrderId = null) {
    const supplier = await supplierRepository.findById(supplierId);
    if (!supplier) throw new Error('Supplier not found');
    return supplier;
  }

  static async getBalanceSummary(supplierId) {
    const supplier = await supplierRepository.findById(supplierId);
    if (!supplier) throw new Error('Supplier not found');

    const recentPurchases = await purchaseRepository.findBySupplier(supplierId, { limit: 10, sort: 'created_at DESC' });
    const balance = await AccountingService.getSupplierBalance(supplierId);

    return {
      supplier: {
        _id: supplier.id,
        id: supplier.id,
        companyName: supplier.company_name || supplier.companyName,
        contactPerson: supplier.contact_person || supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone
      },
      balances: {
        pendingBalance: balance > 0 ? balance : 0,
        advanceBalance: balance < 0 ? Math.abs(balance) : 0,
        currentBalance: balance,
        creditLimit: supplier.credit_limit || supplier.creditLimit || 0
      },
      recentPurchaseOrders: recentPurchases.map(po => ({
        poNumber: po.purchase_order_number || po.poNumber,
        total: po.total,
        status: po.status,
        createdAt: po.created_at || po.createdAt
      }))
    };
  }

  static async recalculateBalance(supplierId) {
    const supplier = await supplierRepository.findById(supplierId);
    if (!supplier) throw new Error('Supplier not found');
    // Balance is derived from ledger; no Mongo update. Return supplier from repo.
    return supplier;
  }

  static async canAcceptPurchase(supplierId, amount) {
    const supplier = await supplierRepository.findById(supplierId);
    if (!supplier) throw new Error('Supplier not found');
    const currentBalance = await AccountingService.getSupplierBalance(supplierId);
    const canAccept = (supplier.is_active !== false) && (supplier.status !== 'inactive');
    const creditLimit = supplier.credit_limit || supplier.creditLimit || 0;
    const availableCredit = creditLimit - currentBalance;
    return {
      canAccept: !!canAccept,
      availableCredit,
      currentBalance,
      creditLimit,
      pendingBalance: currentBalance > 0 ? currentBalance : 0,
      advanceBalance: currentBalance < 0 ? Math.abs(currentBalance) : 0
    };
  }
}

module.exports = SupplierBalanceService;
