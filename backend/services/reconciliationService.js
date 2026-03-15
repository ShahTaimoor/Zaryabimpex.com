const CustomerRepository = require('../repositories/postgres/CustomerRepository');
const SupplierRepository = require('../repositories/postgres/SupplierRepository');
const CustomerTransactionRepository = require('../repositories/postgres/CustomerTransactionRepository');
const SalesRepository = require('../repositories/postgres/SalesRepository');
const PurchaseInvoiceRepository = require('../repositories/postgres/PurchaseInvoiceRepository');
const PurchaseOrderRepository = require('../repositories/postgres/PurchaseOrderRepository');
const SalesOrderRepository = require('../repositories/postgres/SalesOrderRepository');
const customerAuditLogService = require('./customerAuditLogService');
const AccountingService = require('./accountingService');

function normalizeTransactionRow(row) {
  if (!row) return row;
  const balanceAfter = row.balance_after && typeof row.balance_after === 'object'
    ? row.balance_after
    : (typeof row.balance_after === 'string' ? JSON.parse(row.balance_after || '{}') : {});
  return {
    ...row,
    affectsPendingBalance: row.affects_pending_balance ?? row.affectsPendingBalance,
    affectsAdvanceBalance: row.affects_advance_balance ?? row.affectsAdvanceBalance,
    balanceImpact: row.balance_impact ?? row.balanceImpact,
    balanceAfter,
    transactionType: row.transaction_type ?? row.transactionType,
    netAmount: row.net_amount ?? row.netAmount
  };
}

class ReconciliationService {
  /**
   * Reconcile a single customer's balance
   * @param {String} customerId - Customer ID
   * @param {Object} options - Reconciliation options
   * @returns {Promise<Object>}
   */
  async reconcileCustomerBalance(customerId, options = {}) {
    const { autoCorrect = false, alertOnDiscrepancy = true } = options;

    const customer = await CustomerRepository.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const rows = await CustomerTransactionRepository.findAll(
      { customerId, statusNe: 'reversed' }
    );
    const transactions = rows.map(normalizeTransactionRow);

    // Get ledger balance (Authoritative source)
    const ledgerBalance = await AccountingService.getCustomerBalance(customerId);

    const calculated = {
      pendingBalance: ledgerBalance > 0 ? ledgerBalance : 0,
      advanceBalance: ledgerBalance < 0 ? Math.abs(ledgerBalance) : 0,
      currentBalance: ledgerBalance
    };

    const current = {
      pendingBalance: customer.pending_balance ?? customer.pendingBalance ?? 0,
      advanceBalance: customer.advance_balance ?? customer.advanceBalance ?? 0,
      currentBalance: customer.current_balance ?? customer.currentBalance ?? 0
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

    const customers = await CustomerRepository.findAll({ isActive: true });

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
            customerId: customer.id || customer._id,
            customerName: customer.business_name || customer.businessName || customer.name,
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
      customerId: customer.id || customer._id,
      customerName: customer.business_name || customer.businessName || customer.name,
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
    const customer = await CustomerRepository.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const updated = await CustomerRepository.update(customerId, {
      pendingBalance: calculated.pendingBalance,
      advanceBalance: calculated.advanceBalance,
      currentBalance: calculated.currentBalance
    });

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

    const rows = await CustomerTransactionRepository.findAll({
      customerId,
      transactionDateFrom: startDate,
      transactionDateTo: endDate
    });
    const transactions = rows.map(normalizeTransactionRow);

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
    const suppliers = await SupplierRepository.findAll({ isActive: true });

    // Using PostgreSQL AccountingService directly for supplier balances
    // Ledger summary removed - balances calculated directly from PostgreSQL ledger

    const results = {
      total: suppliers.length,
      discrepancies: 0,
      corrected: 0,
      errors: []
    };

    for (const supplier of suppliers) {
      try {
        const supplierId = supplier.id || supplier._id;
        const ledgerBalance = await AccountingService.getSupplierBalance(supplierId);
        const profileBalance = supplier.current_balance ?? supplier.currentBalance ?? 0;

        if (Math.abs(ledgerBalance - profileBalance) > 0.01) {
          results.discrepancies++;
          if (autoCorrect) {
            const { query } = require('../config/postgres');
            await query(
              'UPDATE suppliers SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [ledgerBalance, supplierId]
            );
            results.corrected++;
          }
        }
      } catch (err) {
        results.errors.push({
          supplierId: supplier.id || supplier._id,
          supplierName: supplier.company_name || supplier.companyName,
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

    const sales = await SalesRepository.findAll({});
    for (const sale of sales) {
      const total = Number(sale.total ?? 0);
      const paymentStatus = sale.payment_status || sale.paymentStatus;
      const status = sale.status;
      const saleId = sale.id || sale._id;
      const orderNumber = sale.order_number || sale.orderNumber;
      // Simplified: no pricing/payment sub-doc in Postgres sales; skip balance check if not present
      if (sale.payment_status !== undefined && Math.abs((sale.total || 0) - (sale.payment_remaining || 0)) > 0.01) {
        issues.push({ type: 'SI_BALANCE', id: saleId, ref: orderNumber, expected: total });
        if (autoCorrect && SalesRepository.update) {
          await SalesRepository.update(saleId, { paymentStatus: paymentStatus });
        }
      }
      if (status !== 'cancelled' && status !== 'returned') {
        const expectedStatusSI = total <= 0 ? 'pending' : (paymentStatus === 'paid' ? 'paid' : 'partial');
        if (paymentStatus !== expectedStatusSI) {
          issues.push({ type: 'SI_STATUS', id: saleId, ref: orderNumber, expected: expectedStatusSI });
          if (autoCorrect && SalesRepository.update) {
            await SalesRepository.update(saleId, { paymentStatus: expectedStatusSI });
          }
        }
      }
    }

    const pos = await PurchaseOrderRepository.findAll({});
    for (const po of pos) {
      const items = po.items && (typeof po.items === 'string' ? JSON.parse(po.items) : po.items) || [];
      const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const receivedQty = items.reduce((sum, item) => sum + (item.receivedQuantity || item.received_quantity || 0), 0);
      const poStatus = po.status;
      let expectedStatus = poStatus;
      if (receivedQty >= totalQty && totalQty > 0) expectedStatus = 'fully_received';
      else if (receivedQty > 0) expectedStatus = 'partially_received';

      if (poStatus !== expectedStatus && !['cancelled', 'closed', 'draft', 'confirmed'].includes(poStatus)) {
        issues.push({ type: 'PO_STATUS', id: po.id || po._id, ref: po.po_number || po.poNumber, expected: expectedStatus });
        if (autoCorrect) {
          await PurchaseOrderRepository.updateById(po.id || po._id, { status: expectedStatus });
        }
      }
    }

    return issues;
  }
}

module.exports = new ReconciliationService();

