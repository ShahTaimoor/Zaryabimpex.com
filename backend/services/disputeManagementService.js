const Dispute = require('../models/Dispute');
const CustomerTransaction = require('../models/CustomerTransaction');
const customerTransactionService = require('./customerTransactionService');
const Counter = require('../models/Counter');

class DisputeManagementService {
  /**
   * Create a dispute
   * @param {Object} disputeData - Dispute data
   * @param {Object} user - User creating dispute
   * @returns {Promise<Dispute>}
   */
  async createDispute(disputeData, user) {
    const {
      transactionId,
      customerId,
      disputeType,
      disputedAmount,
      reason,
      customerDescription,
      priority = 'medium'
    } = disputeData;

    // Validate transaction
    const transaction = await CustomerTransaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.customer.toString() !== customerId) {
      throw new Error('Transaction does not belong to customer');
    }

    if (disputedAmount > transaction.netAmount) {
      throw new Error('Disputed amount cannot exceed transaction amount');
    }

    // Check if dispute already exists
    const existingDispute = await Dispute.findOne({
      transaction: transactionId,
      status: { $in: ['open', 'under_review'] }
    });

    if (existingDispute) {
      throw new Error('An active dispute already exists for this transaction');
    }

    // Calculate due date (7 days from creation for medium priority)
    const dueDate = new Date();
    const daysToAdd = priority === 'urgent' ? 1 : priority === 'high' ? 3 : priority === 'medium' ? 7 : 14;
    dueDate.setDate(dueDate.getDate() + daysToAdd);

    const dispute = new Dispute({
      transaction: transactionId,
      customer: customerId,
      disputeType,
      disputedAmount,
      reason,
      customerDescription,
      priority,
      dueDate,
      status: 'open',
      createdBy: user._id
    });

    await dispute.save();

    // Add initial communication
    dispute.addCommunication('internal_note', `Dispute created: ${reason}`, user._id, 'outbound');
    await dispute.save();

    return dispute;
  }

  /**
   * Resolve a dispute
   * @param {String} disputeId - Dispute ID
   * @param {Object} resolutionData - Resolution data
   * @param {Object} user - User resolving dispute
   * @returns {Promise<Object>}
   */
  async resolveDispute(disputeId, resolutionData, user) {
    const {
      resolution,
      resolutionAmount,
      resolutionNotes
    } = resolutionData;

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new Error('Dispute not found');
    }

    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      throw new Error(`Cannot resolve dispute with status: ${dispute.status}`);
    }

    // Resolve dispute
    dispute.resolve(resolution, resolutionAmount, resolutionNotes, user._id);
    await dispute.save();

    // Process resolution based on type
    let transactionResult = null;

    if (resolution === 'refund_full' || resolution === 'refund_partial') {
      // Create refund transaction
      const refundAmount = resolution === 'refund_full' 
        ? dispute.disputedAmount 
        : resolutionAmount || dispute.disputedAmount;

      transactionResult = await customerTransactionService.createTransaction({
        customerId: dispute.customer.toString(),
        transactionType: 'refund',
        netAmount: refundAmount,
        referenceType: 'refund',
        referenceId: dispute.transaction,
        referenceNumber: `REF-${dispute.disputeNumber}`,
        reason: `Dispute resolution: ${resolutionNotes || dispute.reason}`,
        notes: `Resolved dispute ${dispute.disputeNumber}: ${resolution}`
      }, user);
    } else if (resolution === 'credit_note') {
      // Create credit note
      transactionResult = await customerTransactionService.createTransaction({
        customerId: dispute.customer.toString(),
        transactionType: 'credit_note',
        netAmount: resolutionAmount || dispute.disputedAmount,
        referenceType: 'refund',
        referenceId: dispute.transaction,
        referenceNumber: `CN-${dispute.disputeNumber}`,
        reason: `Dispute resolution: ${resolutionNotes || dispute.reason}`,
        notes: `Resolved dispute ${dispute.disputeNumber}: ${resolution}`
      }, user);
    } else if (resolution === 'adjustment') {
      // Create adjustment
      transactionResult = await customerTransactionService.createTransaction({
        customerId: dispute.customer.toString(),
        transactionType: 'adjustment',
        netAmount: -(resolutionAmount || dispute.disputedAmount), // Negative to reduce balance
        referenceType: 'adjustment',
        referenceId: dispute.transaction,
        referenceNumber: `ADJ-${dispute.disputeNumber}`,
        reason: `Dispute resolution: ${resolutionNotes || dispute.reason}`,
        notes: `Resolved dispute ${dispute.disputeNumber}: ${resolution}`
      }, user);
    }

    // Add resolution communication
    dispute.addCommunication(
      'internal_note',
      `Dispute resolved: ${resolution} - ${resolutionNotes || ''}`,
      user._id,
      'outbound'
    );
    await dispute.save();

    return {
      dispute,
      transaction: transactionResult
    };
  }

  /**
   * Get disputes for a customer
   * @param {String} customerId - Customer ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async getCustomerDisputes(customerId, options = {}) {
    const {
      status,
      disputeType,
      limit = 50,
      skip = 0
    } = options;

    const filter = { customer: customerId };
    
    if (status) {
      filter.status = status;
    }
    
    if (disputeType) {
      filter.disputeType = disputeType;
    }

    const disputes = await Dispute.find(filter)
      .populate('transaction', 'transactionNumber transactionDate netAmount')
      .populate('createdBy', 'firstName lastName')
      .populate('resolvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Dispute.countDocuments(filter);

    return {
      disputes,
      total,
      limit,
      skip
    };
  }

  /**
   * Get all open disputes
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getOpenDisputes(options = {}) {
    const {
      priority,
      assignedTo,
      overdue = false
    } = options;

    const filter = {
      status: { $in: ['open', 'under_review'] }
    };

    if (priority) {
      filter.priority = priority;
    }

    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    if (overdue) {
      filter.dueDate = { $lt: new Date() };
    }

    return await Dispute.find(filter)
      .populate('customer', 'businessName name email')
      .populate('transaction', 'transactionNumber transactionDate netAmount')
      .populate('assignedTo', 'firstName lastName')
      .sort({ priority: -1, dueDate: 1, createdAt: -1 });
  }
}

module.exports = new DisputeManagementService();

