const Customer = require('../models/Customer');
const CustomerTransaction = require('../models/CustomerTransaction');
const customerAuditLogService = require('./customerAuditLogService');

class CustomerCreditPolicyService {
  /**
   * Check and auto-suspend overdue customers
   * @returns {Promise<Object>}
   */
  async checkAndSuspendOverdueCustomers() {
    const activeCustomers = await Customer.find({
      status: 'active',
      isDeleted: false
    });

    const results = {
      checked: 0,
      suspended: 0,
      warnings: 0,
      errors: []
    };

    for (const customer of activeCustomers) {
      try {
        results.checked++;
        
        // Skip if cash-only customer
        if (customer.paymentTerms === 'cash') {
          continue;
        }

        // Get overdue invoices
        const overdueInvoices = await CustomerTransaction.find({
          customer: customer._id,
          transactionType: 'invoice',
          status: { $in: ['posted', 'partially_paid'] },
          dueDate: { $lt: new Date() },
          remainingAmount: { $gt: 0 }
        });

        if (overdueInvoices.length === 0) {
          continue;
        }

        // Find maximum days overdue
        const maxDaysOverdue = Math.max(
          ...overdueInvoices.map(inv => inv.daysOverdue || 0)
        );

        // Check if should be suspended
        const autoSuspendDays = customer.creditPolicy?.autoSuspendDays || 90;
        
        if (maxDaysOverdue >= autoSuspendDays) {
          // Auto-suspend
          customer.status = 'suspended';
          customer.suspendedAt = new Date();
          customer.suspensionReason = `Auto-suspended: ${maxDaysOverdue} days overdue`;
          customer.suspendedBy = null; // System action
          await customer.save();

          results.suspended++;

          // Log audit (system action, no req object)
          try {
            await customerAuditLogService.logCustomerSuspension(
              customer._id,
              customer.suspensionReason,
              { _id: null }, // System user
              null // No req object
            );
          } catch (auditError) {
            console.error('Audit logging error:', auditError);
          }

          // TODO: Send notification to customer
          // await notificationService.notifyCustomer(customer, 'suspension');
        } else if (maxDaysOverdue >= (autoSuspendDays - 30)) {
          // Warning threshold (30 days before suspension)
          results.warnings++;
          // TODO: Send warning notification
        }
      } catch (error) {
        results.errors.push({
          customerId: customer._id,
          businessName: customer.businessName,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get customers with overdue invoices
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getCustomersWithOverdueInvoices(options = {}) {
    const {
      minDaysOverdue = 0,
      maxDaysOverdue = null,
      includeSuspended = false
    } = options;

    // Find all customers with overdue invoices
    const overdueInvoices = await CustomerTransaction.find({
      transactionType: 'invoice',
      status: { $in: ['posted', 'partially_paid'] },
      isOverdue: true,
      daysOverdue: {
        $gte: minDaysOverdue,
        ...(maxDaysOverdue ? { $lte: maxDaysOverdue } : {})
      },
      remainingAmount: { $gt: 0 }
    })
    .populate('customer', 'name businessName email phone status creditLimit currentBalance')
    .sort({ daysOverdue: -1 });

    // Group by customer
    const customerMap = new Map();

    overdueInvoices.forEach(invoice => {
      const customerId = invoice.customer._id.toString();
      
      if (!includeSuspended && invoice.customer.status === 'suspended') {
        return; // Skip suspended customers
      }

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer: invoice.customer,
          overdueInvoices: [],
          totalOverdue: 0,
          maxDaysOverdue: 0,
          oldestInvoice: null
        });
      }

      const customerData = customerMap.get(customerId);
      customerData.overdueInvoices.push(invoice);
      customerData.totalOverdue += invoice.remainingAmount;
      customerData.maxDaysOverdue = Math.max(
        customerData.maxDaysOverdue,
        invoice.daysOverdue
      );

      if (!customerData.oldestInvoice || 
          invoice.dueDate < customerData.oldestInvoice.dueDate) {
        customerData.oldestInvoice = invoice;
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => 
      b.maxDaysOverdue - a.maxDaysOverdue
    );
  }

  /**
   * Check if customer is in grace period
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  async checkGracePeriod(customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const gracePeriodDays = customer.creditPolicy?.gracePeriodDays || 0;
    
    // Get invoices that are past due but within grace period
    const today = new Date();
    const gracePeriodEnd = new Date(today);
    gracePeriodEnd.setDate(today.getDate() + gracePeriodDays);

    const invoicesInGracePeriod = await CustomerTransaction.find({
      customer: customerId,
      transactionType: 'invoice',
      status: { $in: ['posted', 'partially_paid'] },
      dueDate: {
        $lt: today,
        $gte: new Date(today.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000)
      },
      remainingAmount: { $gt: 0 }
    });

    return {
      inGracePeriod: invoicesInGracePeriod.length > 0,
      gracePeriodDays,
      invoicesInGracePeriod: invoicesInGracePeriod.length,
      totalAmount: invoicesInGracePeriod.reduce((sum, inv) => sum + inv.remainingAmount, 0)
    };
  }

  /**
   * Send overdue warnings based on policy
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  async sendOverdueWarnings(customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const overdueInvoices = await CustomerTransaction.find({
      customer: customerId,
      transactionType: 'invoice',
      status: { $in: ['posted', 'partially_paid'] },
      isOverdue: true,
      remainingAmount: { $gt: 0 }
    });

    const warnings = [];
    const thresholds = customer.creditPolicy?.warningThresholds || [];

    for (const invoice of overdueInvoices) {
      for (const threshold of thresholds) {
        if (invoice.daysOverdue >= threshold.daysOverdue) {
          warnings.push({
            invoice: invoice.transactionNumber,
            daysOverdue: invoice.daysOverdue,
            amount: invoice.remainingAmount,
            action: threshold.action,
            message: threshold.message || `Invoice ${invoice.transactionNumber} is ${invoice.daysOverdue} days overdue`
          });
        }
      }
    }

    // TODO: Send actual notifications based on action type
    // await notificationService.sendWarnings(customer, warnings);

    return {
      customerId,
      warningsSent: warnings.length,
      warnings
    };
  }

  /**
   * Calculate customer credit score
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  async calculateCreditScore(customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get all transactions
    const transactions = await CustomerTransaction.find({
      customer: customerId,
      transactionType: { $in: ['invoice', 'payment'] }
    }).sort({ transactionDate: -1 });

    // Calculate metrics
    const totalInvoiced = transactions
      .filter(t => t.transactionType === 'invoice')
      .reduce((sum, t) => sum + t.netAmount, 0);

    const totalPaid = transactions
      .filter(t => t.transactionType === 'payment')
      .reduce((sum, t) => sum + t.netAmount, 0);

    const paymentRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

    // Get overdue history
    const overdueInvoices = await CustomerTransaction.find({
      customer: customerId,
      transactionType: 'invoice',
      isOverdue: true
    });

    const averageDaysOverdue = overdueInvoices.length > 0
      ? overdueInvoices.reduce((sum, inv) => sum + inv.daysOverdue, 0) / overdueInvoices.length
      : 0;

    // Calculate score (0-100)
    let score = 100;
    
    // Deduct for payment rate
    if (paymentRate < 100) {
      score -= (100 - paymentRate) * 0.5;
    }
    
    // Deduct for overdue history
    score -= Math.min(averageDaysOverdue * 2, 50);
    
    // Deduct for number of overdue invoices
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

  /**
   * Get risk level from score
   * @param {Number} score - Credit score
   * @returns {String}
   */
  getRiskLevel(score) {
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'high';
    return 'very_high';
  }
}

module.exports = new CustomerCreditPolicyService();

