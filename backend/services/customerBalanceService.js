const customerRepository = require('../repositories/postgres/CustomerRepository');
const salesRepository = require('../repositories/postgres/SalesRepository');
const customerTransactionRepository = require('../repositories/postgres/CustomerTransactionRepository');
const AccountingService = require('./accountingService');

class CustomerBalanceService {
  static async recordPayment(customerId, paymentAmount, orderId = null, user = null, paymentDetails = {}) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const balanceBefore = {
      pendingBalance: customer.pending_balance ?? customer.pendingBalance ?? 0,
      advanceBalance: customer.advance_balance ?? customer.advanceBalance ?? 0,
      currentBalance: customer.current_balance ?? customer.currentBalance ?? 0
    };

    let pendingBalance = balanceBefore.pendingBalance;
    let advanceBalance = balanceBefore.advanceBalance;
    let remainingPayment = paymentAmount;
    if (pendingBalance > 0 && remainingPayment > 0) {
      const pendingReduction = Math.min(remainingPayment, pendingBalance);
      pendingBalance -= pendingReduction;
      remainingPayment -= pendingReduction;
    }
    if (remainingPayment > 0) advanceBalance += remainingPayment;
    const currentBalance = pendingBalance - advanceBalance;
    const balanceAfter = { pendingBalance, advanceBalance, currentBalance };

    if (user) {
      const userId = user.id || user._id;
      const transactionNumber = await customerTransactionRepository.generateTransactionNumber('payment', customerId);
      await customerTransactionRepository.create({
        customerId,
        transactionNumber,
        transactionType: 'payment',
        transactionDate: new Date(),
        referenceType: orderId ? 'sales_order' : 'manual_entry',
        referenceId: orderId,
        netAmount: paymentAmount,
        affectsPendingBalance: true,
        affectsAdvanceBalance: remainingPayment > 0,
        balanceImpact: -paymentAmount,
        balanceBefore,
        balanceAfter,
        paymentDetails: {
          paymentMethod: paymentDetails.paymentMethod || 'account',
          paymentReference: paymentDetails.paymentReference,
          paymentDate: new Date()
        },
        status: 'posted',
        createdBy: userId,
        postedBy: userId,
        postedAt: new Date()
      });
    }
    return customer;
  }

  /**
   * Update customer balance when invoice is created (using transaction sub-ledger)
   * @param {String} customerId - Customer ID
   * @param {Number} invoiceAmount - Invoice amount
   * @param {String} orderId - Order ID
   * @param {Object} user - User creating invoice
   * @param {Object} invoiceData - Invoice details
   * @returns {Promise<Object>}
   */
  static async recordInvoice(customerId, invoiceAmount, orderId = null, user = null, invoiceData = {}) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const balanceBefore = {
      pendingBalance: customer.pending_balance ?? customer.pendingBalance ?? 0,
      advanceBalance: customer.advance_balance ?? customer.advanceBalance ?? 0,
      currentBalance: customer.current_balance ?? customer.currentBalance ?? 0
    };
    const balanceAfter = {
      pendingBalance: balanceBefore.pendingBalance + invoiceAmount,
      advanceBalance: balanceBefore.advanceBalance,
      currentBalance: (balanceBefore.pendingBalance + invoiceAmount) - balanceBefore.advanceBalance
    };

    if (user) {
      const userId = user.id || user._id;
      const transactionNumber = await customerTransactionRepository.generateTransactionNumber('invoice', customerId);
      const paymentTerms = customer.payment_terms || customer.paymentTerms;
      const dueDate = this.calculateDueDate(paymentTerms);
      const aging = this.calculateAging(dueDate);
      await customerTransactionRepository.create({
        customerId,
        transactionNumber,
        transactionType: 'invoice',
        transactionDate: new Date(),
        dueDate,
        referenceType: 'sales_order',
        referenceId: orderId,
        referenceNumber: invoiceData.invoiceNumber,
        grossAmount: invoiceData.grossAmount || invoiceAmount,
        discountAmount: invoiceData.discountAmount || 0,
        taxAmount: invoiceData.taxAmount || 0,
        netAmount: invoiceAmount,
        affectsPendingBalance: true,
        balanceImpact: invoiceAmount,
        balanceBefore,
        balanceAfter,
        lineItems: invoiceData.lineItems || [],
        status: 'posted',
        remainingAmount: invoiceAmount,
        ageInDays: aging.ageInDays,
        agingBucket: aging.agingBucket,
        isOverdue: aging.isOverdue,
        daysOverdue: aging.daysOverdue,
        createdBy: userId,
        postedBy: userId,
        postedAt: new Date()
      });
    }
    return customer;
  }

  /**
   * Calculate due date based on payment terms
   * @param {String} paymentTerms - Payment terms
   * @returns {Date}
   */
  static calculateDueDate(paymentTerms) {
    const today = new Date();
    const dueDate = new Date(today);

    switch (paymentTerms) {
      case 'cash':
        return today;
      case 'net15':
        dueDate.setDate(today.getDate() + 15);
        break;
      case 'net30':
        dueDate.setDate(today.getDate() + 30);
        break;
      case 'net45':
        dueDate.setDate(today.getDate() + 45);
        break;
      case 'net60':
        dueDate.setDate(today.getDate() + 60);
        break;
      default:
        dueDate.setDate(today.getDate() + 30);
    }

    return dueDate;
  }

  /**
   * Calculate aging for a due date
   * @param {Date} dueDate - Due date
   * @returns {Object}
   */
  static calculateAging(dueDate) {
    const today = new Date();
    const ageInDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    let agingBucket = 'current';
    let isOverdue = false;
    let daysOverdue = 0;

    if (ageInDays > 0) {
      isOverdue = true;
      daysOverdue = ageInDays;

      if (ageInDays <= 30) {
        agingBucket = '1-30';
      } else if (ageInDays <= 60) {
        agingBucket = '31-60';
      } else if (ageInDays <= 90) {
        agingBucket = '61-90';
      } else {
        agingBucket = '90+';
      }
    }

    return { ageInDays, agingBucket, isOverdue, daysOverdue };
  }

  /**
   * Update customer balance when refund is issued
   * @param {String} customerId - Customer ID
   * @param {Number} refundAmount - Refund amount
   * @param {String} orderId - Order ID (optional)
   * @returns {Promise<Object>}
   */
  static async recordRefund(customerId, refundAmount, orderId = null) {
    try {
      const customer = await customerRepository.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const balanceBefore = {
        pendingBalance: customer.pending_balance ?? customer.pendingBalance ?? 0,
        advanceBalance: customer.advance_balance ?? customer.advanceBalance ?? 0,
        currentBalance: customer.current_balance ?? customer.currentBalance ?? 0
      };

      // Note: Manual balance updates removed. Reliance on AccountingService / transaction sub-ledger for dynamic balances.
      return customer;
    } catch (error) {
      console.error('Error recording refund:', error);
      throw error;
    }
  }

  /**
   * Get customer balance summary
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  static async getBalanceSummary(customerId) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const recentOrders = await salesRepository.findByCustomer(customerId, { limit: 10, sort: 'created_at DESC' });
    const balance = await AccountingService.getCustomerBalance(customerId);

    return {
      customer: {
        _id: customer.id,
        id: customer.id,
        name: customer.name,
        businessName: customer.business_name || customer.businessName,
        email: customer.email,
        phone: customer.phone
      },
      balances: {
        pendingBalance: balance > 0 ? balance : 0,
        advanceBalance: balance < 0 ? Math.abs(balance) : 0,
        currentBalance: balance,
        creditLimit: customer.credit_limit || customer.creditLimit || 0
      },
      recentOrders: recentOrders.map(order => ({
        orderNumber: order.order_number || order.orderNumber,
        total: (order.pricing && order.pricing.total) ?? order.total,
        status: (order.payment && order.payment.status) ?? order.payment_status,
        createdAt: order.created_at || order.createdAt
      }))
    };
  }

  /**
   * Recalculate customer balance from CustomerTransaction sub-ledger
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  static async recalculateBalance(customerId) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const reconciliationService = require('./reconciliationService');
    const reconciliation = await reconciliationService.reconcileCustomerBalance(customerId, {
      autoCorrect: true,
      alertOnDiscrepancy: false
    });
    const calculated = reconciliation.calculated;

    const updatedCustomer = await customerRepository.update(customerId, {
      pendingBalance: calculated.pendingBalance,
      advanceBalance: calculated.advanceBalance,
      currentBalance: calculated.currentBalance
    });

    if (!updatedCustomer) throw new Error('Concurrent update conflict during balance recalculation');
    return {
      customer: updatedCustomer,
      reconciliation,
      corrected: reconciliation.discrepancy.hasDifference
    };
  }

  /**
   * Check if customer can make purchase
   * @param {String} customerId - Customer ID
   * @param {Number} amount - Purchase amount
   * @returns {Promise<Object>}
   */
  static async canMakePurchase(customerId, amount) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    const currentBalance = await AccountingService.getCustomerBalance(customerId);
    const creditLimit = customer.credit_limit || customer.creditLimit || 0;
    const canPurchase = (currentBalance + amount) <= creditLimit;
    const availableCredit = creditLimit - currentBalance;
    return {
      canPurchase,
      availableCredit,
      currentBalance,
      creditLimit,
      pendingBalance: currentBalance > 0 ? currentBalance : 0,
      advanceBalance: currentBalance < 0 ? Math.abs(currentBalance) : 0
    };
  }

  /**
   * Fix currentBalance for a customer by recalculating from pendingBalance and advanceBalance
   * This is useful when currentBalance is out of sync
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  static async fixCurrentBalance(customerId) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    const pendingBalance = customer.pending_balance ?? customer.pendingBalance ?? 0;
    const advanceBalance = customer.advance_balance ?? customer.advanceBalance ?? 0;
    const correctCurrentBalance = pendingBalance - advanceBalance;
    const oldCurrentBalance = customer.current_balance ?? customer.currentBalance ?? 0;

    if (Math.abs(oldCurrentBalance - correctCurrentBalance) > 0.01) {
      const updatedCustomer = await customerRepository.update(customerId, { currentBalance: correctCurrentBalance });
      if (!updatedCustomer) throw new Error('Concurrent balance update conflict. Please retry.');
      return { customer: updatedCustomer, fixed: true, oldCurrentBalance, newCurrentBalance: correctCurrentBalance };
    }
    return { customer, fixed: false, message: 'CurrentBalance is already correct' };
  }

  /**
   * Fix currentBalance for all customers by recalculating from pendingBalance and advanceBalance
   * @returns {Promise<Object>}
   */
  static async fixAllCurrentBalances() {
    const customers = await customerRepository.findAll({}, { limit: 10000 });
    const results = [];

    for (const customer of customers) {
      try {
        const pendingBalance = customer.pending_balance ?? customer.pendingBalance ?? 0;
        const advanceBalance = customer.advance_balance ?? customer.advanceBalance ?? 0;
        const correctCurrentBalance = pendingBalance - advanceBalance;
        const oldCurrentBalance = customer.current_balance ?? customer.currentBalance ?? 0;

        if (Math.abs(oldCurrentBalance - correctCurrentBalance) > 0.01) {
          const updated = await customerRepository.update(customer.id, { currentBalance: correctCurrentBalance });
          results.push({
            customerId: customer.id,
            customerName: customer.business_name || customer.businessName || customer.name,
            success: !!updated,
            fixed: !!updated,
            oldCurrentBalance,
            newCurrentBalance: correctCurrentBalance,
            pendingBalance,
            advanceBalance
          });
        } else {
          results.push({
            customerId: customer.id,
            customerName: customer.business_name || customer.businessName || customer.name,
            success: true,
            fixed: false,
            message: 'Already correct'
          });
        }
      } catch (error) {
        results.push({
          customerId: customer.id,
          customerName: customer.business_name || customer.businessName || customer.name,
          success: false,
          error: error.message
        });
      }
    }

    const fixed = results.filter(r => r.success && r.fixed).length;
    const alreadyCorrect = results.filter(r => r.success && !r.fixed).length;
    const failed = results.filter(r => !r.success).length;
    return {
      results,
      summary: { total: results.length, fixed, alreadyCorrect, failed }
    };
  }
}

module.exports = CustomerBalanceService;
