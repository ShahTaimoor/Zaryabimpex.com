const CustomerTransaction = require('../models/CustomerTransaction');
const Customer = require('../models/Customer');
const PaymentApplication = require('../models/PaymentApplication');
// const accountingService = require('./accountingService'); // TODO: Implement accounting service integration

class CustomerTransactionService {
  /**
   * Create customer transaction
   * @param {Object} transactionData - Transaction data
   * @param {Object} user - User creating transaction
   * @returns {Promise<CustomerTransaction>}
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

    // Get customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get current balances
    const balanceBefore = {
      pendingBalance: customer.pendingBalance || 0,
      advanceBalance: customer.advanceBalance || 0,
      currentBalance: customer.currentBalance || 0
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

    // Calculate new balances
    const balanceAfter = this.calculateNewBalances(balanceBefore, balanceImpact, transactionType);

    // Generate transaction number
    const transactionNumber = await CustomerTransaction.generateTransactionNumber(transactionType, customerId);

    // Create transaction
    const transaction = new CustomerTransaction({
      customer: customerId,
      transactionNumber,
      transactionType,
      transactionDate: new Date(),
      dueDate: dueDate || this.calculateDueDate(customer.paymentTerms),
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
      reason,
      notes,
      requiresApproval,
      status: requiresApproval ? 'draft' : 'posted',
      remainingAmount: transactionType === 'invoice' ? netAmount : 0,
      createdBy: user._id,
      postedBy: requiresApproval ? null : user._id,
      postedAt: requiresApproval ? null : new Date()
    });

    // Calculate aging
    const aging = transaction.calculateAging();
    transaction.ageInDays = aging.ageInDays;
    transaction.agingBucket = aging.agingBucket;
    transaction.isOverdue = aging.isOverdue;
    transaction.daysOverdue = aging.daysOverdue;

    await transaction.save();

    // Note: Manual customer balance updates removed. 
    // Reliance now exclusively on AccountingService for dynamic balances.

    // Create accounting entries if posted
    if (!requiresApproval) {
      await this.createAccountingEntries(transaction, user);
    }

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
    // Use atomic update with version check
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const updated = await Customer.findOneAndUpdate(
      { _id: customerId, __v: customer.__v },
      {
        $set: {
          pendingBalance: newBalances.pendingBalance,
          advanceBalance: newBalances.advanceBalance,
          currentBalance: newBalances.currentBalance
        },
        $inc: { __v: 1 }
      },
      { new: true }
    );

    if (!updated) {
      throw new Error('Concurrent balance update conflict. Please retry.');
    }

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

    switch (transaction.transactionType) {
      case 'invoice':
        // Debit: AR, Credit: Revenue
        entries.push({
          accountCode: 'AR', // Accounts Receivable
          debitAmount: transaction.netAmount,
          creditAmount: 0,
          description: `Invoice ${transaction.transactionNumber}`
        });
        entries.push({
          accountCode: 'REV', // Sales Revenue
          debitAmount: 0,
          creditAmount: transaction.netAmount,
          description: `Invoice ${transaction.transactionNumber}`
        });
        break;

      case 'payment':
        // Debit: Cash/Bank, Credit: AR
        const paymentAccount = transaction.paymentDetails.paymentMethod === 'bank_transfer'
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
          creditAmount: transaction.netAmount,
          description: `Payment ${transaction.transactionNumber}`
        });
        break;

      case 'refund':
      case 'credit_note':
        // Debit: Sales Returns, Credit: AR
        entries.push({
          accountCode: 'SALES_RET', // Sales Returns
          debitAmount: transaction.netAmount,
          creditAmount: 0,
          description: `Refund ${transaction.transactionNumber}`
        });
        entries.push({
          accountCode: 'AR',
          debitAmount: 0,
          creditAmount: transaction.netAmount,
          description: `Refund ${transaction.transactionNumber}`
        });
        break;

      case 'write_off':
        // Debit: Bad Debt Expense, Credit: AR
        entries.push({
          accountCode: 'BAD_DEBT',
          debitAmount: transaction.netAmount,
          creditAmount: 0,
          description: `Bad debt write-off ${transaction.transactionNumber}`
        });
        entries.push({
          accountCode: 'AR',
          debitAmount: 0,
          creditAmount: transaction.netAmount,
          description: `Bad debt write-off ${transaction.transactionNumber}`
        });
        break;
    }

    // Save accounting entries to transaction
    transaction.accountingEntries = entries;
    await transaction.save();

    // Create actual accounting transactions (if accountingService supports it)
    // This would integrate with your existing accounting system

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
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Create payment transaction first
    const paymentTransaction = await this.createTransaction({
      customerId,
      transactionType: 'payment',
      netAmount: paymentAmount,
      referenceType: 'payment',
      paymentDetails: {
        paymentMethod: 'account',
        paymentDate: new Date()
      }
    }, user);

    // Validate applications
    let totalApplied = 0;
    const validApplications = [];

    for (const app of applications) {
      const invoice = await CustomerTransaction.findById(app.invoiceId);
      if (!invoice || invoice.customer.toString() !== customerId) {
        throw new Error(`Invoice ${app.invoiceId} not found or does not belong to customer`);
      }

      if (invoice.transactionType !== 'invoice') {
        throw new Error(`Transaction ${app.invoiceId} is not an invoice`);
      }

      if (invoice.status === 'paid' || invoice.status === 'cancelled') {
        throw new Error(`Invoice ${app.invoiceId} is already paid or cancelled`);
      }

      const amountToApply = Math.min(app.amount, invoice.remainingAmount);
      totalApplied += amountToApply;

      validApplications.push({
        invoice: invoice._id,
        invoiceNumber: invoice.transactionNumber,
        amountApplied: amountToApply,
        discountTaken: 0, // Can be calculated if needed
        appliedDate: new Date(),
        appliedBy: user._id
      });

      // Update invoice
      invoice.paidAmount += amountToApply;
      invoice.remainingAmount -= amountToApply;
      if (invoice.remainingAmount === 0) {
        invoice.status = 'paid';
      } else {
        invoice.status = 'partially_paid';
      }
      await invoice.save();
    }

    const unappliedAmount = paymentAmount - totalApplied;

    // Create payment application record
    const paymentApplication = new PaymentApplication({
      payment: paymentTransaction._id,
      customer: customerId,
      applications: validApplications,
      unappliedAmount,
      totalPaymentAmount: paymentAmount,
      status: 'applied',
      createdBy: user._id,
      appliedBy: user._id
    });

    await paymentApplication.save();

    // Note: Manual balance updates removed.
    // Applications are recorded, but customer balances are derived from the ledger.

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
    const originalTransaction = await CustomerTransaction.findById(transactionId);
    if (!originalTransaction) {
      throw new Error('Transaction not found');
    }

    if (!originalTransaction.canBeReversed()) {
      throw new Error('Transaction cannot be reversed');
    }

    // Get customer current balances
    const customer = await Customer.findById(originalTransaction.customer);
    const balanceBefore = {
      pendingBalance: customer.pendingBalance,
      advanceBalance: customer.advanceBalance,
      currentBalance: customer.currentBalance
    };

    // Create reversal transaction (opposite impact)
    const reversalTransaction = await this.createTransaction({
      customerId: originalTransaction.customer.toString(),
      transactionType: 'reversal',
      netAmount: -originalTransaction.netAmount, // Opposite amount
      referenceType: 'reversal',
      referenceId: originalTransaction._id,
      referenceNumber: `REV-${originalTransaction.transactionNumber}`,
      reason: `Reversal of ${originalTransaction.transactionNumber}: ${reason}`,
      notes: reason
    }, user);

    // Link reversal
    reversalTransaction.isReversal = true;
    reversalTransaction.reversesTransaction = originalTransaction._id;
    reversalTransaction.reversedAt = new Date();
    await reversalTransaction.save();

    // Mark original as reversed
    originalTransaction.status = 'reversed';
    originalTransaction.reversedBy = reversalTransaction._id;
    originalTransaction.reversedAt = new Date();
    await originalTransaction.save();

    // Note: Reversal balances are now dynamically derived from ledger.

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
    const originalTransaction = await CustomerTransaction.findById(transactionId);
    if (!originalTransaction) {
      throw new Error('Transaction not found');
    }

    if (!originalTransaction.canBeReversed()) {
      throw new Error('Transaction cannot be reversed');
    }

    if (amount <= 0) {
      throw new Error('Reversal amount must be positive');
    }

    if (amount > originalTransaction.remainingAmount) {
      throw new Error(`Reversal amount (${amount}) exceeds remaining amount (${originalTransaction.remainingAmount})`);
    }

    // Get customer current balances
    const customer = await Customer.findById(originalTransaction.customer);
    const balanceBefore = {
      pendingBalance: customer.pendingBalance,
      advanceBalance: customer.advanceBalance,
      currentBalance: customer.currentBalance
    };

    // Create partial reversal transaction
    const reversalTransaction = await this.createTransaction({
      customerId: originalTransaction.customer.toString(),
      transactionType: 'reversal',
      netAmount: -amount, // Negative for reversal
      referenceType: 'reversal',
      referenceId: originalTransaction._id,
      referenceNumber: `REV-PARTIAL-${originalTransaction.transactionNumber}`,
      reason: `Partial reversal of ${originalTransaction.transactionNumber}: ${reason}`,
      notes: `Partial reversal: ${amount} of ${originalTransaction.netAmount}. ${reason}`
    }, user);

    // Link reversal
    reversalTransaction.isReversal = true;
    reversalTransaction.reversesTransaction = originalTransaction._id;
    reversalTransaction.reversedAt = new Date();
    await reversalTransaction.save();

    // Update original transaction
    originalTransaction.remainingAmount -= amount;
    originalTransaction.paidAmount -= amount;

    if (originalTransaction.remainingAmount <= 0.01) {
      originalTransaction.status = 'paid';
      originalTransaction.remainingAmount = 0;
    } else {
      originalTransaction.status = 'partially_paid';
    }

    await originalTransaction.save();

    // Note: Reversal balances are now dynamically derived from ledger.

    return reversalTransaction;
  }

  /**
   * Get customer transaction history
   * @param {String} customerId - Customer ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async getCustomerTransactions(customerId, options = {}) {
    const {
      limit = 50,
      skip = 0,
      transactionType,
      status,
      startDate,
      endDate,
      includeReversed = false
    } = options;

    const filter = { customer: customerId };

    if (transactionType) {
      filter.transactionType = transactionType;
    }

    if (status) {
      filter.status = status;
    }

    if (!includeReversed) {
      filter.status = { $ne: 'reversed' };
    }

    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    const transactions = await CustomerTransaction.find(filter)
      .populate('createdBy', 'firstName lastName')
      .populate('lineItems.product', 'name sku')
      .sort({ transactionDate: -1 })
      .limit(limit)
      .skip(skip);

    const total = await CustomerTransaction.countDocuments(filter);

    return {
      transactions,
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
    return await CustomerTransaction.find({
      customer: customerId,
      transactionType: 'invoice',
      status: { $in: ['posted', 'partially_paid'] },
      dueDate: { $lt: new Date() },
      remainingAmount: { $gt: 0 }
    })
      .sort({ dueDate: 1 })
      .populate('lineItems.product', 'name');
  }

  /**
   * Get customer aging report
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  async getCustomerAging(customerId) {
    const invoices = await CustomerTransaction.find({
      customer: customerId,
      transactionType: 'invoice',
      status: { $in: ['posted', 'partially_paid'] },
      remainingAmount: { $gt: 0 }
    });

    const aging = {
      current: 0,
      '1-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
      total: 0
    };

    invoices.forEach(invoice => {
      const amount = invoice.remainingAmount;
      aging[invoice.agingBucket] = (aging[invoice.agingBucket] || 0) + amount;
      aging.total += amount;
    });

    return aging;
  }
}

module.exports = new CustomerTransactionService();

