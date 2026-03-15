const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const CustomerTransaction = require('../models/CustomerTransaction');
const Sales = require('../models/Sales');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const PurchaseOrder = require('../models/PurchaseOrder');
const SalesOrder = require('../models/SalesOrder');
const Transaction = require('../models/Transaction');
const customerAuditLogService = require('./customerAuditLogService');
const accountLedgerService = require('./accountLedgerService');
const AccountingService = require('./accountingService');

class ReconciliationService {
  /**
   * Reconcile a single customer's balance
   * @param {String} customerId - Customer ID
   * @param {Object} options - Reconciliation options
   * @returns {Promise<Object>}
   */
  async reconcileCustomerBalance(customerId, options = {}) {
    const { autoCorrect = false, alertOnDiscrepancy = true } = options;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get all transactions (excluding reversed)
    const transactions = await CustomerTransaction.find({
      customer: customerId,
      status: { $ne: 'reversed' }
    }).sort({ transactionDate: 1 });

    // Get ledger balance (Authoritative source)
    const ledgerBalance = await AccountingService.getCustomerBalance(customerId);

    const calculated = {
      pendingBalance: ledgerBalance > 0 ? ledgerBalance : 0,
      advanceBalance: ledgerBalance < 0 ? Math.abs(ledgerBalance) : 0,
      currentBalance: ledgerBalance
    };

    // Get current customer profile balances (Legacy cached source)
    const current = {
      pendingBalance: customer.pendingBalance || 0,
      advanceBalance: customer.advanceBalance || 0,
      currentBalance: customer.currentBalance || 0
    };

    // Calculate discrepancies
    const discrepancy = {
      pendingBalance: Math.abs(current.pendingBalance - calculated.pendingBalance),
      advanceBalance: Math.abs(current.advanceBalance - calculated.advanceBalance),
      currentBalance: Math.abs(current.currentBalance - calculated.currentBalance),
      hasDifference: false
    };

    // Check if discrepancy exceeds threshold (0.01 for rounding)
    const threshold = 0.01;
    if (discrepancy.pendingBalance > threshold ||
      discrepancy.advanceBalance > threshold ||
      discrepancy.currentBalance > threshold) {
      discrepancy.hasDifference = true;
    }

    const reconciliation = {
      customerId,
      customerName: customer.businessName || customer.name,
      reconciliationDate: new Date(),
      current,
      calculated,
      discrepancy,
      transactionCount: transactions.length,
      reconciled: !discrepancy.hasDifference
    };

    // Handle discrepancy
    if (discrepancy.hasDifference) {
      reconciliation.discrepancyDetails = {
        pendingBalanceDiff: calculated.pendingBalance - current.pendingBalance,
        advanceBalanceDiff: calculated.advanceBalance - current.advanceBalance,
        currentBalanceDiff: calculated.currentBalance - current.currentBalance
      };

      // Log discrepancy
      await this.logDiscrepancy(customerId, discrepancy, calculated, current);

      // Alert if configured
      if (alertOnDiscrepancy) {
        await this.alertDiscrepancy(customer, reconciliation);
      }

      // Auto-correct if enabled
      if (autoCorrect) {
        await this.correctBalance(customerId, calculated, reconciliation);
        reconciliation.corrected = true;
      }
    }

    return reconciliation;
  }

  /**
   * Calculate balances from transaction sub-ledger
   * @param {Array} transactions - CustomerTransaction records
   * @returns {Object}
   */
  calculateBalancesFromTransactions(transactions) {
    let pendingBalance = 0;
    let advanceBalance = 0;

    transactions.forEach(transaction => {
      if (transaction.affectsPendingBalance) {
        // Positive impact increases pendingBalance (invoice)
        // Negative impact decreases pendingBalance (payment, refund)
        pendingBalance += transaction.balanceImpact;
      }

      if (transaction.affectsAdvanceBalance) {
        // Negative balanceImpact means payment exceeded pending, creating advance
        if (transaction.balanceImpact < 0) {
          const paymentAmount = Math.abs(transaction.balanceImpact);
          // This is handled in balanceAfter, but we need to recalculate
          // For simplicity, use balanceAfter from last transaction if available
        }
      }

      // Use balanceAfter from last transaction as source of truth
      if (transaction.balanceAfter) {
        pendingBalance = transaction.balanceAfter.pendingBalance;
        advanceBalance = transaction.balanceAfter.advanceBalance;
      }
    });

    // If no transactions, recalculate from balance impacts
    if (transactions.length > 0 && !transactions[transactions.length - 1].balanceAfter) {
      // Recalculate from scratch
      pendingBalance = 0;
      advanceBalance = 0;

      transactions.forEach(transaction => {
        const impact = transaction.balanceImpact;

        if (transaction.transactionType === 'invoice' || transaction.transactionType === 'debit_note') {
          pendingBalance += impact;
        } else if (transaction.transactionType === 'payment') {
          // Payment reduces pending first, then creates advance
          const paymentAmount = Math.abs(impact);
          const pendingReduction = Math.min(paymentAmount, pendingBalance);
          pendingBalance -= pendingReduction;

          const remainingPayment = paymentAmount - pendingReduction;
          if (remainingPayment > 0) {
            advanceBalance += remainingPayment;
          }
        } else if (transaction.transactionType === 'refund' || transaction.transactionType === 'credit_note') {
          // Refund reduces pending, may create advance
          const refundAmount = Math.abs(impact);
          const pendingReduction = Math.min(refundAmount, pendingBalance);
          pendingBalance -= pendingReduction;

          const remainingRefund = refundAmount - pendingReduction;
          if (remainingRefund > 0) {
            advanceBalance += remainingRefund;
          }
        } else if (transaction.transactionType === 'adjustment') {
          if (impact > 0) {
            pendingBalance += impact;
          } else {
            const adjustmentAmount = Math.abs(impact);
            const pendingReduction = Math.min(adjustmentAmount, pendingBalance);
            pendingBalance -= pendingReduction;

            const remainingAdjustment = adjustmentAmount - pendingReduction;
            if (remainingAdjustment > 0) {
              advanceBalance = Math.max(0, advanceBalance - remainingAdjustment);
            }
          }
        } else if (transaction.transactionType === 'write_off') {
          pendingBalance = Math.max(0, pendingBalance + impact);
        } else if (transaction.transactionType === 'opening_balance') {
          if (impact >= 0) {
            pendingBalance += impact;
          } else {
            advanceBalance += Math.abs(impact);
          }
        }
      });
    }

    const currentBalance = pendingBalance - advanceBalance;

    return {
      pendingBalance: Math.max(0, pendingBalance),
      advanceBalance: Math.max(0, advanceBalance),
      currentBalance
    };
  }

  /**
   * Reconcile all customer balances
   * @param {Object} options - Reconciliation options
   * @returns {Promise<Object>}
   */
  async reconcileAllCustomerBalances(options = {}) {
    const { autoCorrect = false, alertOnDiscrepancy = true, batchSize = 100 } = options;

    const customers = await Customer.find({
      isDeleted: false
    }).select('_id businessName name pendingBalance advanceBalance currentBalance');

    const results = {
      total: customers.length,
      reconciled: 0,
      discrepancies: 0,
      corrected: 0,
      errors: [],
      startTime: new Date()
    };

    // Process in batches
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);

      await Promise.all(batch.map(async (customer) => {
        try {
          const reconciliation = await this.reconcileCustomerBalance(
            customer._id,
            { autoCorrect, alertOnDiscrepancy }
          );

          if (reconciliation.reconciled) {
            results.reconciled++;
          } else {
            results.discrepancies++;
            if (reconciliation.corrected) {
              results.corrected++;
            }
          }
        } catch (error) {
          results.errors.push({
            customerId: customer._id,
            customerName: customer.businessName || customer.name,
            error: error.message
          });
        }
      }));
    }

    results.endTime = new Date();
    results.duration = results.endTime - results.startTime;

    return results;
  }

  /**
   * Log discrepancy for audit
   * @param {String} customerId - Customer ID
   * @param {Object} discrepancy - Discrepancy details
   * @param {Object} calculated - Calculated balances
   * @param {Object} current - Current balances
   * @returns {Promise<void>}
   */
  async logDiscrepancy(customerId, discrepancy, calculated, current) {
    try {
      await customerAuditLogService.logBalanceAdjustment(
        customerId,
        current.currentBalance,
        calculated.currentBalance,
        { _id: null }, // System user
        null, // No req object
        `Balance discrepancy detected: Pending ${discrepancy.pendingBalance.toFixed(2)}, Advance ${discrepancy.advanceBalance.toFixed(2)}`
      );
    } catch (error) {
      console.error('Error logging discrepancy:', error);
    }
  }

  /**
   * Alert on discrepancy
   * @param {Customer} customer - Customer
   * @param {Object} reconciliation - Reconciliation result
   * @returns {Promise<void>}
   */
  async alertDiscrepancy(customer, reconciliation) {
    // TODO: Implement actual alerting (email, Slack, etc.)
    console.error('BALANCE DISCREPANCY DETECTED:', {
      customerId: customer._id,
      customerName: customer.businessName || customer.name,
      discrepancy: reconciliation.discrepancy
    });
  }

  /**
   * Correct balance discrepancy
   * @param {String} customerId - Customer ID
   * @param {Object} calculated - Calculated balances
   * @param {Object} reconciliation - Reconciliation result
   * @returns {Promise<Customer>}
   */
  async correctBalance(customerId, calculated, reconciliation) {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Update balance atomically
    const updated = await Customer.findOneAndUpdate(
      { _id: customerId, __v: customer.__v },
      {
        $set: {
          pendingBalance: calculated.pendingBalance,
          advanceBalance: calculated.advanceBalance,
          currentBalance: calculated.currentBalance
        },
        $inc: { __v: 1 }
      },
      { new: true }
    );

    if (!updated) {
      throw new Error('Concurrent update conflict during balance correction');
    }

    // Log correction
    await customerAuditLogService.logBalanceAdjustment(
      customerId,
      reconciliation.current.currentBalance,
      calculated.currentBalance,
      { _id: null }, // System user
      null,
      `Balance auto-corrected during reconciliation: ${JSON.stringify(reconciliation.discrepancyDetails)}`
    );

    return updated;
  }

  /**
   * Get reconciliation report for a customer
   * @param {String} customerId - Customer ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>}
   */
  async getReconciliationReport(customerId, startDate, endDate) {
    const reconciliation = await this.reconcileCustomerBalance(customerId);

    const transactions = await CustomerTransaction.find({
      customer: customerId,
      transactionDate: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ transactionDate: 1 });

    return {
      reconciliation,
      period: { startDate, endDate },
      transactions: transactions.length,
      transactionSummary: this.summarizeTransactions(transactions)
    };
  }

  /**
   * Summarize transactions for reporting
   * @param {Array} transactions - Transactions
   * @returns {Object}
   */
  summarizeTransactions(transactions) {
    const summary = {
      invoices: { count: 0, total: 0 },
      payments: { count: 0, total: 0 },
      refunds: { count: 0, total: 0 },
      adjustments: { count: 0, total: 0 },
      writeOffs: { count: 0, total: 0 }
    };

    transactions.forEach(transaction => {
      switch (transaction.transactionType) {
        case 'invoice':
          summary.invoices.count++;
          summary.invoices.total += transaction.netAmount;
          break;
        case 'payment':
          summary.payments.count++;
          summary.payments.total += transaction.netAmount;
          break;
        case 'refund':
        case 'credit_note':
          summary.refunds.count++;
          summary.refunds.total += transaction.netAmount;
          break;
        case 'adjustment':
          summary.adjustments.count++;
          summary.adjustments.total += transaction.netAmount;
          break;
        case 'write_off':
          summary.writeOffs.count++;
          summary.writeOffs.total += transaction.netAmount;
          break;
      }
    });

    return summary;
  }

  /**
   * Run full system reconciliation (Customers, Suppliers, Orders, Invoices)
   * @param {Object} options - Options with autoCorrect
   * @returns {Promise<Object>}
   */
  async runFullSystemReconciliation(options = {}) {
    const { autoCorrect = false } = options;
    const results = {
      startTime: new Date(),
      customers: null,
      suppliers: null,
      orders: {
        totalIssues: 0,
        fixed: 0,
        details: []
      }
    };

    // 1. Reconcile Customers
    results.customers = await this.reconcileAllCustomerBalances({ autoCorrect });

    // 2. Reconcile Suppliers
    results.suppliers = await this.reconcileAllSupplierBalances({ autoCorrect });

    // 3. Reconcile Orders and Invoices
    const orderIssues = await this.reconcileOrderAndInvoiceConsistency({ autoCorrect });
    results.orders.totalIssues = orderIssues.length;
    results.orders.details = orderIssues;
    if (autoCorrect) {
      results.orders.fixed = orderIssues.length; // Assuming all fixed if autoCorrect is true
    }

    results.endTime = new Date();
    results.duration = results.endTime - results.startTime;

    return results;
  }

  /**
   * Reconcile all supplier balances
   */
  async reconcileAllSupplierBalances(options = {}) {
    const { autoCorrect = false, batchSize = 100 } = options;
    const suppliers = await Supplier.find({ isDeleted: false });

    // We'll use the accountLedgerService logic for suppliers since it's already robust
    const ledgerResult = await accountLedgerService.getLedgerSummary({
      startDate: '1970-01-01',
      endDate: '2099-12-31'
    });

    const results = {
      total: suppliers.length,
      discrepancies: 0,
      corrected: 0,
      errors: []
    };

    for (const supplier of suppliers) {
      try {
        const ledgerBalance = await AccountingService.getSupplierBalance(supplier._id);
        const profileBalance = supplier.currentBalance || 0;

        if (Math.abs(ledgerBalance - profileBalance) > 0.01) {
          results.discrepancies++;
          if (autoCorrect) {
            await Supplier.updateOne(
              { _id: supplier._id },
              {
                $set: {
                  currentBalance: ledgerBalance,
                  pendingBalance: ledgerBalance > 0 ? ledgerBalance : 0,
                  advanceBalance: ledgerBalance < 0 ? Math.abs(ledgerBalance) : 0
                }
              }
            );
            results.corrected++;
          }
        }
      } catch (err) {
        results.errors.push({
          supplierId: supplier._id,
          supplierName: supplier.companyName,
          error: err.message
        });
      }
    }

    return results;
  }

  /**
   * Reconcile consistency between Orders, Invoices and Ledger
   */
  async reconcileOrderAndInvoiceConsistency(options = {}) {
    const { autoCorrect = false } = options;
    const issues = [];

    // Sales Invoices
    const sales = await Sales.find({ isDeleted: { $ne: true } });
    for (const sale of sales) {
      const calculatedBalance = sale.pricing.total - sale.payment.amountPaid;
      const storedBalance = sale.payment.remainingBalance;

      if (Math.abs(calculatedBalance - storedBalance) > 0.01) {
        issues.push({ type: 'SI_BALANCE', id: sale._id, ref: sale.orderNumber, expected: calculatedBalance });
        if (autoCorrect) {
          await Sales.updateOne({ _id: sale._id }, { $set: { 'payment.remainingBalance': calculatedBalance } });
        }
      }

      // Paid status SI
      const paidSI = sale.payment.amountPaid;
      const totalSI = sale.pricing.total;
      let expectedStatusSI = 'pending';
      if (paidSI >= totalSI && totalSI > 0) expectedStatusSI = 'paid';
      else if (paidSI > 0) expectedStatusSI = 'partial';

      if (sale.payment.status !== expectedStatusSI && sale.status !== 'cancelled' && sale.status !== 'returned') {
        issues.push({ type: 'SI_STATUS', id: sale._id, ref: sale.orderNumber, expected: expectedStatusSI });
        if (autoCorrect) {
          await Sales.updateOne({ _id: sale._id }, { $set: { 'payment.status': expectedStatusSI } });
        }
      }
    }

    // Purchase Orders (simplified status check logic)
    const pos = await PurchaseOrder.find({ isDeleted: { $ne: true } });
    for (const po of pos) {
      const totalQty = po.items.reduce((sum, item) => sum + item.quantity, 0);
      const receivedQty = po.items.reduce((sum, item) => sum + item.receivedQuantity, 0);

      let expectedStatus = po.status;
      if (receivedQty >= totalQty && totalQty > 0) expectedStatus = 'fully_received';
      else if (receivedQty > 0) expectedStatus = 'partially_received';

      if (po.status !== expectedStatus && !['cancelled', 'closed', 'draft', 'confirmed'].includes(po.status)) {
        issues.push({ type: 'PO_STATUS', id: po._id, ref: po.poNumber, expected: expectedStatus });
        if (autoCorrect) {
          await PurchaseOrder.updateOne({ _id: po._id }, { $set: { status: expectedStatus } });
        }
      }
    }

    return issues;
  }
}

module.exports = new ReconciliationService();

