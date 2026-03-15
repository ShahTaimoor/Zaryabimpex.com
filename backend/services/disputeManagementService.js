const DisputeRepository = require('../repositories/DisputeRepository');
const CustomerTransactionRepository = require('../repositories/CustomerTransactionRepository');
const customerTransactionService = require('./customerTransactionService');

function toId(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v && typeof v.toString === 'function') return v.toString();
  return String(v);
}

class DisputeManagementService {
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

    const transaction = await CustomerTransactionRepository.findById(transactionId);
    if (!transaction) throw new Error('Transaction not found');

    const txnCustomerId = toId(transaction.customer_id || transaction.customer);
    if (txnCustomerId !== toId(customerId)) {
      throw new Error('Transaction does not belong to customer');
    }

    const netAmount = parseFloat(transaction.net_amount ?? transaction.netAmount ?? 0) || 0;
    if (disputedAmount > netAmount) {
      throw new Error('Disputed amount cannot exceed transaction amount');
    }

    const existingDispute = await DisputeRepository.findOne({
      transactionId,
      statusIn: ['open', 'under_review']
    });
    if (existingDispute) {
      throw new Error('An active dispute already exists for this transaction');
    }

    const dueDate = new Date();
    const daysToAdd = priority === 'urgent' ? 1 : priority === 'high' ? 3 : priority === 'medium' ? 7 : 14;
    dueDate.setDate(dueDate.getDate() + daysToAdd);

    const userId = user?.id ?? user?._id;

    const dispute = await DisputeRepository.create({
      transactionId,
      customerId,
      disputeType,
      disputedAmount,
      reason,
      customerDescription,
      priority,
      dueDate,
      status: 'open',
      createdBy: userId,
      communications: [
        { type: 'internal_note', direction: 'outbound', content: `Dispute created: ${reason}`, sentBy: userId, sentAt: new Date() }
      ]
    });

    return dispute;
  }

  async resolveDispute(disputeId, resolutionData, user) {
    const { resolution, resolutionAmount, resolutionNotes } = resolutionData;

    const dispute = await DisputeRepository.findById(disputeId);
    if (!dispute) throw new Error('Dispute not found');
    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      throw new Error(`Cannot resolve dispute with status: ${dispute.status}`);
    }

    const userId = user?.id ?? user?._id;
    const customerId = toId(dispute.customerId ?? dispute.customer);
    const transactionId = dispute.transactionId ?? dispute.transaction;

    const communications = [...(dispute.communications || [])];
    communications.push({
      type: 'internal_note',
      direction: 'outbound',
      content: `Dispute resolved: ${resolution} - ${resolutionNotes || ''}`,
      sentBy: userId,
      sentAt: new Date()
    });

    const updated = await DisputeRepository.updateById(disputeId, {
      status: 'resolved',
      resolution,
      resolutionAmount: resolutionAmount ?? dispute.disputedAmount,
      resolutionNotes,
      resolvedBy: userId,
      resolvedAt: new Date(),
      communications
    });

    let transactionResult = null;

    if (resolution === 'refund_full' || resolution === 'refund_partial') {
      const refundAmount = resolution === 'refund_full'
        ? dispute.disputedAmount
        : (resolutionAmount || dispute.disputedAmount);
      transactionResult = await customerTransactionService.createTransaction({
        customerId,
        transactionType: 'refund',
        netAmount: refundAmount,
        referenceType: 'refund',
        referenceId: transactionId,
        referenceNumber: `REF-${dispute.disputeNumber}`,
        reason: `Dispute resolution: ${resolutionNotes || dispute.reason}`,
        notes: `Resolved dispute ${dispute.disputeNumber}: ${resolution}`
      }, user);
    } else if (resolution === 'credit_note') {
      transactionResult = await customerTransactionService.createTransaction({
        customerId,
        transactionType: 'credit_note',
        netAmount: resolutionAmount || dispute.disputedAmount,
        referenceType: 'refund',
        referenceId: transactionId,
        referenceNumber: `CN-${dispute.disputeNumber}`,
        reason: `Dispute resolution: ${resolutionNotes || dispute.reason}`,
        notes: `Resolved dispute ${dispute.disputeNumber}: ${resolution}`
      }, user);
    } else if (resolution === 'adjustment') {
      transactionResult = await customerTransactionService.createTransaction({
        customerId,
        transactionType: 'adjustment',
        netAmount: -(resolutionAmount || dispute.disputedAmount),
        referenceType: 'adjustment',
        referenceId: transactionId,
        referenceNumber: `ADJ-${dispute.disputeNumber}`,
        reason: `Dispute resolution: ${resolutionNotes || dispute.reason}`,
        notes: `Resolved dispute ${dispute.disputeNumber}: ${resolution}`
      }, user);
    }

    return { dispute: updated, transaction: transactionResult };
  }

  async getCustomerDisputes(customerId, options = {}) {
    const { status, disputeType, limit = 50, skip = 0 } = options;
    const filter = { customerId: toId(customerId) };
    if (status) filter.status = status;
    if (disputeType) filter.disputeType = disputeType;

    const disputes = await DisputeRepository.findAll(filter, { limit, offset: skip });
    const total = await DisputeRepository.count(filter);
    return { disputes, total, limit, skip };
  }

  async getOpenDisputes(options = {}) {
    const { priority, assignedTo, overdue = false } = options;
    const filter = { statusIn: ['open', 'under_review'] };
    if (priority) filter.priority = priority;
    if (assignedTo != null) filter.assignedTo = assignedTo;
    if (overdue) filter.overdue = true;

    return DisputeRepository.findAll(filter, { limit: 200 });
  }
}

module.exports = new DisputeManagementService();
