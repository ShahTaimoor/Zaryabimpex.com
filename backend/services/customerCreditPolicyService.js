const CustomerRepository = require('../repositories/postgres/CustomerRepository');
const CustomerTransactionRepository = require('../repositories/postgres/CustomerTransactionRepository');

function toNum(v) {
  return v != null ? Number(v) : 0;
}

function creditPolicy(customer) {
  const raw = customer.credit_policy ?? customer.creditPolicy;
  if (!raw) return {};
  return typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch (_) { return {}; } })() : raw;
}

class CustomerCreditPolicyService {
  /**
   * Check and auto-suspend overdue customers
   * @returns {Promise<Object>}
   */
  async checkAndSuspendOverdueCustomers() {
    const activeCustomers = await CustomerRepository.findAll(
      { status: 'active', isActive: true },
      {}
    );

    const results = { checked: 0, suspended: 0, warnings: 0, errors: [] };

    for (const row of activeCustomers) {
      try {
        results.checked++;
        const paymentTerms = row.payment_terms ?? row.paymentTerms;
        if (paymentTerms === 'cash') continue;

        const overdueInvoices = await CustomerTransactionRepository.findAll(
          {
            customerId: row.id,
            transactionType: 'invoice',
            statusIn: ['posted', 'partially_paid'],
            dueDateBefore: new Date(),
            remainingAmountGt: 0
          },
          {}
        );

        if (overdueInvoices.length === 0) continue;

        const maxDaysOverdue = Math.max(
          ...overdueInvoices.map((inv) => toNum(inv.days_overdue ?? inv.daysOverdue))
        );

        const policy = creditPolicy(row);
        const autoSuspendDays = policy.autoSuspendDays ?? 90;

        if (maxDaysOverdue >= autoSuspendDays) {
          await CustomerRepository.update(row.id, {
            status: 'suspended',
            isActive: false,
            suspendedAt: new Date(),
            suspensionReason: `Auto-suspended: ${maxDaysOverdue} days overdue`,
            suspendedBy: null
          });
          results.suspended++;

          // Optional: log to customer audit (uses Mongoose AuditLog until migrated)
          try {
            const customerAuditLogService = require('./customerAuditLogService');
            await customerAuditLogService.logCustomerSuspension(
              row.id,
              `Auto-suspended: ${maxDaysOverdue} days overdue`,
              { _id: null },
              null
            );
          } catch (auditError) {
            console.error('Audit logging error (optional):', auditError.message);
          }
        } else if (maxDaysOverdue >= (autoSuspendDays - 30)) {
          results.warnings++;
        }
      } catch (error) {
        results.errors.push({
          customerId: row.id,
          businessName: row.business_name ?? row.businessName,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get customers with overdue invoices
   */
  async getCustomersWithOverdueInvoices(options = {}) {
    const {
      minDaysOverdue = 0,
      maxDaysOverdue = null,
      includeSuspended = false
    } = options;

    const filters = {
      transactionType: 'invoice',
      statusIn: ['posted', 'partially_paid'],
      isOverdue: true,
      remainingAmountGt: 0,
      daysOverdueMin: minDaysOverdue
    };
    if (maxDaysOverdue != null) filters.daysOverdueMax = maxDaysOverdue;

    const overdueInvoices = await CustomerTransactionRepository.findAll(
      filters,
      { sort: 'days_overdue DESC' }
    );

    const customerMap = new Map();

    for (const inv of overdueInvoices) {
      const customerId = (inv.customer_id ?? inv.customer)?.toString?.() ?? inv.customer_id;
      if (!customerId) continue;

      const customer = await CustomerRepository.findById(customerId);
      if (!includeSuspended && (customer?.status === 'suspended')) continue;

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer: customer || { id: customerId, _id: customerId },
          overdueInvoices: [],
          totalOverdue: 0,
          maxDaysOverdue: 0,
          oldestInvoice: null
        });
      }

      const data = customerMap.get(customerId);
      data.overdueInvoices.push(inv);
      data.totalOverdue += toNum(inv.remaining_amount ?? inv.remainingAmount);
      const daysOverdue = toNum(inv.days_overdue ?? inv.daysOverdue);
      data.maxDaysOverdue = Math.max(data.maxDaysOverdue, daysOverdue);
      const dueDate = inv.due_date ?? inv.dueDate;
      if (!data.oldestInvoice || (dueDate && new Date(dueDate) < new Date(data.oldestInvoice.due_date || data.oldestInvoice.dueDate))) {
        data.oldestInvoice = inv;
      }
    }

    return Array.from(customerMap.values()).sort(
      (a, b) => (b.maxDaysOverdue || 0) - (a.maxDaysOverdue || 0)
    );
  }

  /**
   * Check if customer is in grace period
   */
  async checkGracePeriod(customerId) {
    const customer = await CustomerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const policy = creditPolicy(customer);
    const gracePeriodDays = policy.gracePeriodDays ?? 0;
    const today = new Date();
    const gracePeriodStart = new Date(today);
    gracePeriodStart.setDate(today.getDate() - gracePeriodDays);

    const invoicesInGracePeriod = await CustomerTransactionRepository.findAll(
      {
        customerId,
        transactionType: 'invoice',
        statusIn: ['posted', 'partially_paid'],
        dueDateBefore: today,
        dueDateAfter: gracePeriodStart,
        remainingAmountGt: 0
      },
      {}
    );

    const totalAmount = invoicesInGracePeriod.reduce(
      (sum, inv) => sum + toNum(inv.remaining_amount ?? inv.remainingAmount),
      0
    );

    return {
      inGracePeriod: invoicesInGracePeriod.length > 0,
      gracePeriodDays,
      invoicesInGracePeriod: invoicesInGracePeriod.length,
      totalAmount
    };
  }

  /**
   * Send overdue warnings based on policy
   */
  async sendOverdueWarnings(customerId) {
    const customer = await CustomerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const overdueInvoices = await CustomerTransactionRepository.findAll(
      {
        customerId,
        transactionType: 'invoice',
        statusIn: ['posted', 'partially_paid'],
        isOverdue: true,
        remainingAmountGt: 0
      },
      {}
    );

    const policy = creditPolicy(customer);
    const thresholds = policy.warningThresholds || [];
    const warnings = [];

    for (const invoice of overdueInvoices) {
      const daysOverdue = toNum(invoice.days_overdue ?? invoice.daysOverdue);
      const txnNum = invoice.transaction_number ?? invoice.transactionNumber;
      for (const threshold of thresholds) {
        if (daysOverdue >= (threshold.daysOverdue ?? 0)) {
          warnings.push({
            invoice: txnNum,
            daysOverdue,
            amount: toNum(invoice.remaining_amount ?? invoice.remainingAmount),
            action: threshold.action,
            message: threshold.message || `Invoice ${txnNum} is ${daysOverdue} days overdue`
          });
        }
      }
    }

    return { customerId, warningsSent: warnings.length, warnings };
  }

  /**
   * Calculate customer credit score
   */
  async calculateCreditScore(customerId) {
    const customer = await CustomerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const transactions = await CustomerTransactionRepository.findAll(
      { customerId },
      { sort: 'transaction_date DESC', limit: 10000 }
    );

    const invoiceOrPayment = transactions.filter((t) => {
      const type = t.transaction_type ?? t.transactionType;
      return type === 'invoice' || type === 'payment';
    });

    const totalInvoiced = invoiceOrPayment
      .filter((t) => (t.transaction_type ?? t.transactionType) === 'invoice')
      .reduce((sum, t) => sum + toNum(t.net_amount ?? t.netAmount), 0);
    const totalPaid = invoiceOrPayment
      .filter((t) => (t.transaction_type ?? t.transactionType) === 'payment')
      .reduce((sum, t) => sum + toNum(t.net_amount ?? t.netAmount), 0);

    const paymentRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

    const overdueInvoices = await CustomerTransactionRepository.findAll(
      {
        customerId,
        transactionType: 'invoice',
        isOverdue: true
      },
      {}
    );

    const averageDaysOverdue =
      overdueInvoices.length > 0
        ? overdueInvoices.reduce(
            (sum, inv) => sum + toNum(inv.days_overdue ?? inv.daysOverdue),
            0
          ) / overdueInvoices.length
        : 0;

    let score = 100;
    if (paymentRate < 100) score -= (100 - paymentRate) * 0.5;
    score -= Math.min(averageDaysOverdue * 2, 50);
    score -= Math.min(overdueInvoices.length * 5, 30);
    score = Math.max(0, Math.min(100, score));

    return {
      score: Math.round(score),
      paymentRate: Math.round(paymentRate * 100) / 100,
      totalInvoiced,
      totalPaid,
      averageDaysOverdue: Math.round(averageDaysOverdue),
      overdueCount: overdueInvoices.length,
      riskLevel: this.getRiskLevel(score)
    };
  }

  getRiskLevel(score) {
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'high';
    return 'very_high';
  }
}

module.exports = new CustomerCreditPolicyService();
