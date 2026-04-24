const CustomerRepository = require('../repositories/postgres/CustomerRepository');
const CustomerTransactionRepository = require('../repositories/postgres/CustomerTransactionRepository');
const PaymentApplicationRepository = require('../repositories/postgres/PaymentApplicationRepository');

function computeAging(dueDate) {
  if (!dueDate) return { ageInDays: 0, agingBucket: 'current', isOverdue: false, daysOverdue: 0 };
  const today = new Date();
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  const ageInDays = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  let agingBucket = 'current';
  let isOverdue = false;
  let daysOverdue = 0;
  if (ageInDays > 0) {
    isOverdue = true;
    daysOverdue = ageInDays;
    if (ageInDays <= 30) agingBucket = '1-30';
    else if (ageInDays <= 60) agingBucket = '31-60';
    else if (ageInDays <= 90) agingBucket = '61-90';
    else agingBucket = '90+';
  }
  return { ageInDays, agingBucket, isOverdue, daysOverdue };
}

class CustomerTransactionService {
  /**
   * Create customer transaction (Postgres)
   * @param {Object} transactionData - Transaction data
   * @param {Object} user - User creating transaction
   * @returns {Promise<Object>} Created transaction row
   */
  async createTransaction(transactionData, user) {
    const {
      customerId,
      transactionType,
      netAmount,
      grossAmount = 0,
      discountAmount = 0,
      taxAmount = 0,
      referenceType,
      referenceId,
      referenceNumber,
      dueDate,
      lineItems = [],
      paymentDetails = {},
      reason,
      notes,
      requiresApproval = false
    } = transactionData;

    let affectsPendingBalance = transactionData.affectsPendingBalance ?? false;
    let affectsAdvanceBalance = transactionData.affectsAdvanceBalance ?? false;
    let balanceImpact = transactionData.balanceImpact ?? 0;

    if (transactionData.balanceImpact === undefined) {
      switch (transactionType) {
        case 'invoice':
          affectsPendingBalance = true;
          balanceImpact = netAmount;
          break;
        case 'payment':
          affectsAdvanceBalance = true;
          balanceImpact = -netAmount;
          break;
        case 'refund':
        case 'credit_note':
          balanceImpact = -netAmount;
          break;
        case 'debit_note':
        case 'opening_balance':
        case 'adjustment':
        case 'reversal':
          balanceImpact = netAmount;
          break;
      }
    }

    const customer = await CustomerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const transactionNumber = await CustomerTransactionRepository.generateTransactionNumber(transactionType, customerId);
    const resolvedDueDate = dueDate || this.calculateDueDate(customer.payment_terms || customer.paymentTerms);
    const aging = computeAging(resolvedDueDate);

    const transaction = await CustomerTransactionRepository.create({
      customerId,
      transactionNumber,
      transactionType,
      transactionDate: new Date(),
      dueDate: resolvedDueDate,
      referenceType,
      referenceId,
      referenceNumber,
      grossAmount,
      discountAmount,
      taxAmount,
      netAmount,
      affectsPendingBalance,
      affectsAdvanceBalance,
      balanceImpact,
      balanceBefore: null, // Legacy snapshot removed
      balanceAfter: null,  // Legacy snapshot removed
      lineItems,
      paymentDetails,
      status: requiresApproval ? 'draft' : 'posted',
      remainingAmount: transactionType === 'invoice' ? netAmount : 0,
      ageInDays: aging.ageInDays,
      agingBucket: aging.agingBucket,
      isOverdue: aging.isOverdue,
      daysOverdue: aging.daysOverdue,
      createdBy: user.id || user._id,
      postedBy: requiresApproval ? null : (user.id || user._id),
      postedAt: requiresApproval ? null : new Date()
    });

    return transaction;
  }


  /**
   * Calculate due date based on payment terms
   * @param {String} paymentTerms - Payment terms
   * @returns {Date}
   */
  calculateDueDate(paymentTerms) {
    const today = new Date();
    const dueDate = new Date(today);

    switch (paymentTerms) {
      case 'cash':
        return today; // Due immediately
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
        dueDate.setDate(today.getDate() + 30); // Default to net30
    }

    return dueDate;
  }

  /**
   * Update customer balance atomically
   * @param {String} customerId - Customer ID
   * @param {Object} newBalances - New balance values
   * @returns {Promise<Customer>}
   */
  async updateCustomerBalance(customerId, newBalances) {
    console.warn(`[DEPRECATED] updateCustomerBalance called for ${customerId}. Manual column updates are disabled.`);
    const customer = await CustomerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    return customer; // Return original without updates
  }


  /**
   * Apply payment to invoices
   * @param {String} customerId - Customer ID
   * @param {Number} paymentAmount - Payment amount
   * @param {Array} applications - Array of { invoiceId, amount }
   * @param {Object} user - User
   * @returns {Promise<PaymentApplication>}
   */
  async applyPayment(customerId, paymentAmount, applications, user) {
    const customer = await CustomerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const paymentTransaction = await this.createTransaction({
      customerId,
      transactionType: 'payment',
      netAmount: paymentAmount,
      referenceType: 'payment',
      paymentDetails: { paymentMethod: 'account', paymentDate: new Date() }
    }, user);

    let totalApplied = 0;
    const validApplications = [];

    for (const app of applications) {
      const invoice = await CustomerTransactionRepository.findById(app.invoiceId);
      if (!invoice || (invoice.customer_id || invoice.customer) !== customerId) {
        throw new Error(`Invoice ${app.invoiceId} not found or does not belong to customer`);
      }
      const invType = invoice.transaction_type ?? invoice.transactionType;
      if (invType !== 'invoice') {
        throw new Error(`Transaction ${app.invoiceId} is not an invoice`);
      }
      const status = invoice.status;
      if (status === 'paid' || status === 'cancelled') {
        throw new Error(`Invoice ${app.invoiceId} is already paid or cancelled`);
      }

      const remaining = parseFloat(invoice.remaining_amount ?? invoice.remainingAmount ?? 0) || 0;
      const paid = parseFloat(invoice.paid_amount ?? invoice.paidAmount ?? 0) || 0;
      const amountToApply = Math.min(app.amount, remaining);
      totalApplied += amountToApply;

      validApplications.push({
        invoice: invoice.id ?? invoice._id,
        invoiceNumber: invoice.transaction_number ?? invoice.transactionNumber,
        amountApplied: amountToApply,
        discountTaken: 0,
        appliedDate: new Date(),
        appliedBy: user.id || user._id
      });

      const newPaid = paid + amountToApply;
      const newRemaining = remaining - amountToApply;
      await CustomerTransactionRepository.updateById(invoice.id ?? invoice._id, {
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        status: newRemaining === 0 ? 'paid' : 'partially_paid'
      });
    }

    const unappliedAmount = paymentAmount - totalApplied;
    const paymentApplication = await PaymentApplicationRepository.create({
      payment: paymentTransaction.id ?? paymentTransaction._id,
      customerId,
      applications: validApplications,
      unappliedAmount,
      totalPaymentAmount: paymentAmount,
      status: 'applied',
      createdBy: user.id || user._id,
      appliedBy: user.id || user._id
    });

    return paymentApplication;
  }

  /**
   * Reverse a transaction (full reversal)
   * @param {String} transactionId - Transaction ID to reverse
   * @param {String} reason - Reason for reversal
   * @param {Object} user - User
   * @returns {Promise<CustomerTransaction>}
   */
  async reverseTransaction(transactionId, reason, user) {
    const originalTransaction = await CustomerTransactionRepository.findById(transactionId);
    if (!originalTransaction) throw new Error('Transaction not found');

    const status = originalTransaction.status;
    if (status === 'reversed') throw new Error('Transaction cannot be reversed');

    const customerId = originalTransaction.customer_id ?? originalTransaction.customer;
    const netAmount = parseFloat(originalTransaction.net_amount ?? originalTransaction.netAmount ?? 0) || 0;
    const transactionNumber = originalTransaction.transaction_number ?? originalTransaction.transactionNumber;

    const reversalTransaction = await this.createTransaction({
      customerId: typeof customerId === 'string' ? customerId : String(customerId),
      transactionType: 'reversal',
      netAmount: -netAmount,
      referenceType: 'reversal',
      referenceId: originalTransaction.id ?? originalTransaction._id,
      referenceNumber: `REV-${transactionNumber}`,
      notes: reason
    }, user);

    await CustomerTransactionRepository.updateById(transactionId, {
      status: 'reversed',
      reversedBy: reversalTransaction.id ?? reversalTransaction._id,
      reversedAt: new Date()
    });

    return reversalTransaction;
  }

  /**
   * Partially reverse a transaction
   * @param {String} transactionId - Transaction ID to partially reverse
   * @param {Number} amount - Amount to reverse
   * @param {String} reason - Reason for reversal
   * @param {Object} user - User
   * @returns {Promise<CustomerTransaction>}
   */
  async partialReverseTransaction(transactionId, amount, reason, user) {
    const originalTransaction = await CustomerTransactionRepository.findById(transactionId);
    if (!originalTransaction) throw new Error('Transaction not found');

    const status = originalTransaction.status;
    if (status === 'reversed') throw new Error('Transaction cannot be reversed');

    if (amount <= 0) throw new Error('Reversal amount must be positive');

    const remaining = parseFloat(originalTransaction.remaining_amount ?? originalTransaction.remainingAmount ?? 0) || 0;
    if (amount > remaining) {
      throw new Error(`Reversal amount (${amount}) exceeds remaining amount (${remaining})`);
    }

    const customerId = originalTransaction.customer_id ?? originalTransaction.customer;
    const netAmount = parseFloat(originalTransaction.net_amount ?? originalTransaction.netAmount ?? 0) || 0;
    const transactionNumber = originalTransaction.transaction_number ?? originalTransaction.transactionNumber;

    const reversalTransaction = await this.createTransaction({
      customerId: typeof customerId === 'string' ? customerId : String(customerId),
      transactionType: 'reversal',
      netAmount: -amount,
      referenceType: 'reversal',
      referenceId: originalTransaction.id ?? originalTransaction._id,
      referenceNumber: `REV-PARTIAL-${transactionNumber}`,
      notes: `Partial reversal: ${amount} of ${netAmount}. ${reason}`
    }, user);

    const newRemaining = remaining - amount;
    const paid = parseFloat(originalTransaction.paid_amount ?? originalTransaction.paidAmount ?? 0) || 0;
    await CustomerTransactionRepository.updateById(transactionId, {
      remainingAmount: newRemaining <= 0.01 ? 0 : newRemaining,
      paidAmount: paid - amount,
      status: newRemaining <= 0.01 ? 'paid' : 'partially_paid'
    });

    return reversalTransaction;
  }

  /**
   * Get customer transaction history
   * @param {String} customerId - Customer ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async getCustomerTransactions(customerId, options = {}) {
    const { limit = 50, skip = 0, transactionType, status, startDate, endDate, includeReversed = false } = options;

    const filter = { customerId };
    if (transactionType) filter.transactionType = transactionType;
    if (status) filter.status = status;
    if (!includeReversed) filter.statusNe = 'reversed';
    if (startDate) filter.transactionDateFrom = new Date(startDate);
    if (endDate) filter.transactionDateTo = new Date(endDate);

    const [all, total] = await Promise.all([
      CustomerTransactionRepository.findAll(filter, { limit, offset: skip }),
      CustomerTransactionRepository.count(filter)
    ]);
    return {
      transactions: all,
      total,
      limit,
      skip
    };
  }

  /**
   * Get overdue invoices for customer
   * @param {String} customerId - Customer ID
   * @returns {Promise<Array>}
   */
  async getOverdueInvoices(customerId) {
    const rows = await CustomerTransactionRepository.findAll(
      { customerId, transactionType: 'invoice' },
      { limit: 500 }
    );
    const now = new Date();
    return rows.filter(
      (r) =>
        ['posted', 'partially_paid'].includes(r.status) &&
        r.due_date && new Date(r.due_date) < now &&
        (parseFloat(r.remaining_amount) || 0) > 0
    ).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  }

  /**
   * Get customer aging report
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  async getCustomerAging(customerId) {
    const rows = await CustomerTransactionRepository.findAll(
      { customerId, transactionType: 'invoice' },
      { limit: 1000 }
    );
    const invoices = rows.filter(
      (r) =>
        ['posted', 'partially_paid'].includes(r.status) &&
        (parseFloat(r.remaining_amount) || 0) > 0
    );

    const aging = {
      current: 0,
      '1-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
      total: 0
    };

    const today = new Date();
    invoices.forEach((invoice) => {
      const amount = parseFloat(invoice.remaining_amount ?? invoice.remainingAmount) || 0;
      const due = invoice.due_date ? new Date(invoice.due_date) : today;
      const ageInDays = Math.floor((today - due) / (1000 * 60 * 60 * 24));
      let bucket = 'current';
      if (ageInDays > 0) {
        if (ageInDays <= 30) bucket = '1-30';
        else if (ageInDays <= 60) bucket = '31-60';
        else if (ageInDays <= 90) bucket = '61-90';
        else bucket = '90+';
      }
      aging[bucket] = (aging[bucket] || 0) + amount;
      aging.total += amount;
    });

    return aging;
  }
}

module.exports = new CustomerTransactionService();

