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

    const customer = await CustomerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const balanceBefore = {
      pendingBalance: customer.pending_balance ?? customer.pendingBalance ?? 0,
      advanceBalance: customer.advance_balance ?? customer.advanceBalance ?? 0,
      currentBalance: customer.current_balance ?? customer.currentBalance ?? 0
    };

    // Calculate balance impact
    let balanceImpact = 0;
    let affectsPendingBalance = false;
    let affectsAdvanceBalance = false;

    switch (transactionType) {
      case 'invoice':
      case 'debit_note':
        balanceImpact = netAmount;
        affectsPendingBalance = true;
        break;
      case 'payment':
        balanceImpact = -netAmount; // Reduces what customer owes
        affectsPendingBalance = true;
        affectsAdvanceBalance = true; // May create advance
        break;
      case 'refund':
      case 'credit_note':
        balanceImpact = -netAmount; // Reduces what customer owes
        affectsPendingBalance = true;
        affectsAdvanceBalance = true;
        break;
      case 'adjustment':
        balanceImpact = netAmount; // Can be positive or negative
        affectsPendingBalance = true;
        break;
      case 'write_off':
        balanceImpact = -netAmount; // Reduces receivable
        affectsPendingBalance = true;
        break;
      case 'opening_balance':
        balanceImpact = netAmount;
        if (netAmount >= 0) {
          affectsPendingBalance = true;
        } else {
          affectsAdvanceBalance = true;
        }
        break;
    }

    const balanceAfter = this.calculateNewBalances(balanceBefore, balanceImpact, transactionType);

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
      balanceBefore,
      balanceAfter,
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
   * Calculate new balances after transaction
   * @param {Object} balanceBefore - Current balances
   * @param {Number} balanceImpact - Impact amount
   * @param {String} transactionType - Type of transaction
   * @returns {Object}
   */
  calculateNewBalances(balanceBefore, balanceImpact, transactionType) {
    let pendingBalance = balanceBefore.pendingBalance;
    let advanceBalance = balanceBefore.advanceBalance;

    if (transactionType === 'payment') {
      // Payment reduces pendingBalance first, then adds to advanceBalance
      if (balanceImpact < 0) {
        const paymentAmount = Math.abs(balanceImpact);
        const pendingReduction = Math.min(paymentAmount, pendingBalance);
        pendingBalance -= pendingReduction;

        const remainingPayment = paymentAmount - pendingReduction;
        if (remainingPayment > 0) {
          advanceBalance += remainingPayment;
        }
      }
    } else if (transactionType === 'invoice' || transactionType === 'debit_note') {
      // Invoice adds to pendingBalance
      pendingBalance += balanceImpact;
    } else if (transactionType === 'refund' || transactionType === 'credit_note') {
      // Refund reduces pendingBalance, may add to advanceBalance
      if (balanceImpact < 0) {
        const refundAmount = Math.abs(balanceImpact);
        const pendingReduction = Math.min(refundAmount, pendingBalance);
        pendingBalance -= pendingReduction;

        const remainingRefund = refundAmount - pendingReduction;
        if (remainingRefund > 0) {
          advanceBalance += remainingRefund;
        }
      }
    } else if (transactionType === 'adjustment') {
      // Adjustment can affect either balance
      if (balanceImpact > 0) {
        pendingBalance += balanceImpact;
      } else {
        const adjustmentAmount = Math.abs(balanceImpact);
        const pendingReduction = Math.min(adjustmentAmount, pendingBalance);
        pendingBalance -= pendingReduction;

        const remainingAdjustment = adjustmentAmount - pendingReduction;
        if (remainingAdjustment > 0) {
          advanceBalance = Math.max(0, advanceBalance - remainingAdjustment);
        }
      }
    } else if (transactionType === 'write_off') {
      // Write-off reduces pendingBalance
      pendingBalance = Math.max(0, pendingBalance + balanceImpact);
    } else if (transactionType === 'opening_balance') {
      if (balanceImpact >= 0) {
        pendingBalance += balanceImpact;
      } else {
        advanceBalance += Math.abs(balanceImpact);
      }
    }

    const currentBalance = pendingBalance - advanceBalance;

    return {
      pendingBalance,
      advanceBalance,
      currentBalance
    };
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
    const customer = await CustomerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const updated = await CustomerRepository.update(customerId, {
      pendingBalance: newBalances.pendingBalance,
      advanceBalance: newBalances.advanceBalance,
      currentBalance: newBalances.currentBalance
    });

    if (!updated) throw new Error('Concurrent balance update conflict. Please retry.');
    return updated;
  }

  /**
   * Create accounting entries for transaction
   * @param {CustomerTransaction} transaction - Transaction
   * @param {Object} user - User
   * @returns {Promise<Array>}
   */
  async createAccountingEntries(transaction, user) {
    const entries = [];
    const transactionType = transaction.transaction_type ?? transaction.transactionType;
    const transactionNumber = transaction.transaction_number ?? transaction.transactionNumber;
    const netAmount = transaction.net_amount ?? transaction.netAmount;
    const paymentDetails = (transaction.payment_details ?? transaction.paymentDetails) || {};

    switch (transactionType) {
      case 'invoice':
        // Debit: AR, Credit: Revenue
        entries.push({
          accountCode: 'AR',
          debitAmount: netAmount,
          creditAmount: 0,
          description: `Invoice ${transactionNumber}`
        });
        entries.push({
          accountCode: 'REV',
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Invoice ${transactionNumber}`
        });
        break;

      case 'payment': {
        const paymentAccount = paymentDetails.paymentMethod === 'bank_transfer'
          ? 'BANK'
          : 'CASH';
        entries.push({
          accountCode: paymentAccount,
          debitAmount: transaction.netAmount,
          creditAmount: 0,
          description: `Payment ${transaction.transactionNumber}`
        });
        entries.push({
          accountCode: 'AR',
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Payment ${transactionNumber}`
        });
        break;
      }

      case 'refund':
      case 'credit_note':
        // Debit: Sales Returns, Credit: AR
        entries.push({
          accountCode: 'SALES_RET',
          debitAmount: netAmount,
          creditAmount: 0,
          description: `Refund ${transaction.transactionNumber}`
        });
        entries.push({
          accountCode: 'AR',
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Refund ${transactionNumber}`
        });
        break;

      case 'write_off':
        // Debit: Bad Debt Expense, Credit: AR
        entries.push({
          accountCode: 'BAD_DEBT',
          debitAmount: netAmount,
          creditAmount: 0,
          description: `Bad debt write-off ${transaction.transactionNumber}`
        });
        entries.push({
          accountCode: 'AR',
          debitAmount: 0,
          creditAmount: netAmount,
          description: `Bad debt write-off ${transactionNumber}`
        });
        break;
    }

    return entries;
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

