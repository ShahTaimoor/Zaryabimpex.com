const Customer = require('../models/Customer');
const CustomerTransaction = require('../models/CustomerTransaction');
const Sales = require('../models/Sales');
const PaymentApplication = require('../models/PaymentApplication');
const customerAuditLogService = require('./customerAuditLogService');
const mongoose = require('mongoose');

class CustomerMergeService {
  /**
   * Merge two customers (source into target)
   * @param {String} sourceCustomerId - Source customer ID (will be soft-deleted)
   * @param {String} targetCustomerId - Target customer ID (will receive all data)
   * @param {Object} user - User performing merge
   * @param {Object} options - Merge options
   * @returns {Promise<Object>}
   */
  async mergeCustomers(sourceCustomerId, targetCustomerId, user, options = {}) {
    const { mergeAddresses = true, mergeNotes = true } = options;

    // Validate customers
    const source = await Customer.findById(sourceCustomerId);
    const target = await Customer.findById(targetCustomerId);

    if (!source || !target) {
      throw new Error('One or both customers not found');
    }

    if (source.isDeleted || target.isDeleted) {
      throw new Error('Cannot merge deleted customers');
    }

    if (source._id.toString() === target._id.toString()) {
      throw new Error('Cannot merge customer with itself');
    }

    // Use transaction for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Calculate merged balances
      const mergedBalances = {
        pendingBalance: (source.pendingBalance || 0) + (target.pendingBalance || 0),
        advanceBalance: (source.advanceBalance || 0) + (target.advanceBalance || 0),
        currentBalance: ((source.pendingBalance || 0) + (target.pendingBalance || 0)) - 
                        ((source.advanceBalance || 0) + (target.advanceBalance || 0))
      };

      // Move all transactions from source to target
      const transactionUpdate = await CustomerTransaction.updateMany(
        { customer: sourceCustomerId },
        { $set: { customer: targetCustomerId } },
        { session }
      );

      // Move all sales orders from source to target
      const salesUpdate = await Sales.updateMany(
        { customer: sourceCustomerId },
        { $set: { customer: targetCustomerId } },
        { session }
      );

      // Move payment applications
      await PaymentApplication.updateMany(
        { customer: sourceCustomerId },
        { $set: { customer: targetCustomerId } },
        { session }
      );

      // Merge addresses if requested
      if (mergeAddresses && source.addresses && source.addresses.length > 0) {
        const existingAddresses = target.addresses || [];
        const mergedAddresses = [...existingAddresses, ...source.addresses];
        
        // Remove duplicate addresses (by street + city)
        const uniqueAddresses = mergedAddresses.filter((addr, index, self) =>
          index === self.findIndex(a => 
            a.street === addr.street && 
            a.city === addr.city &&
            a.zipCode === addr.zipCode
          )
        );

        target.addresses = uniqueAddresses;
      }

      // Merge notes if requested
      if (mergeNotes && source.notes) {
        const existingNotes = target.notes || '';
        target.notes = existingNotes 
          ? `${existingNotes}\n\n--- Merged from ${source.businessName || source.name} ---\n${source.notes}`
          : source.notes;
      }

      // Update target customer balances
      target.pendingBalance = mergedBalances.pendingBalance;
      target.advanceBalance = mergedBalances.advanceBalance;
      target.currentBalance = mergedBalances.currentBalance;
      target.lastModifiedBy = user._id;

      await target.save({ session });

      // Soft delete source customer
      source.isDeleted = true;
      source.deletedAt = new Date();
      source.deletedBy = user._id;
      source.deletionReason = `Merged into customer: ${target.businessName || target.name} (${target._id})`;
      source.status = 'inactive';

      await source.save({ session });

      // Log merge in audit trail
      await customerAuditLogService.logCustomerMerge(
        sourceCustomerId,
        targetCustomerId,
        user,
        {
          sourceName: source.businessName || source.name,
          targetName: target.businessName || target.name,
          mergedBalances,
          transactionsMoved: transactionUpdate.modifiedCount,
          salesOrdersMoved: salesUpdate.modifiedCount
        }
      );

      await session.commitTransaction();

      return {
        success: true,
        sourceCustomer: {
          id: source._id,
          name: source.businessName || source.name,
          status: 'merged'
        },
        targetCustomer: {
          id: target._id,
          name: target.businessName || target.name,
          newBalances: mergedBalances
        },
        statistics: {
          transactionsMoved: transactionUpdate.modifiedCount,
          salesOrdersMoved: salesUpdate.modifiedCount,
          mergedBalances
        }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Find potential duplicate customers
   * @param {Object} options - Search options
   * @returns {Promise<Array>}
   */
  async findPotentialDuplicates(options = {}) {
    const { threshold = 0.8, minSimilarity = 0.7 } = options;

    const customers = await Customer.find({ isDeleted: false })
      .select('name businessName email phone');

    const duplicates = [];
    const processed = new Set();

    for (let i = 0; i < customers.length; i++) {
      if (processed.has(customers[i]._id.toString())) continue;

      const group = [customers[i]];

      for (let j = i + 1; j < customers.length; j++) {
        if (processed.has(customers[j]._id.toString())) continue;

        const similarity = this.calculateSimilarity(customers[i], customers[j]);
        
        if (similarity >= minSimilarity) {
          group.push(customers[j]);
          processed.add(customers[j]._id.toString());
        }
      }

      if (group.length > 1) {
        duplicates.push({
          group,
          similarity: this.calculateGroupSimilarity(group),
          suggestedTarget: this.suggestTargetCustomer(group)
        });
        processed.add(customers[i]._id.toString());
      }
    }

    return duplicates;
  }

  /**
   * Calculate similarity between two customers
   * @param {Customer} customer1 - First customer
   * @param {Customer} customer2 - Second customer
   * @returns {Number} Similarity score (0-1)
   */
  calculateSimilarity(customer1, customer2) {
    let score = 0;
    let factors = 0;

    // Business name similarity
    if (customer1.businessName && customer2.businessName) {
      const name1 = customer1.businessName.toLowerCase().trim();
      const name2 = customer2.businessName.toLowerCase().trim();
      if (name1 === name2) {
        score += 0.4;
      } else if (name1.includes(name2) || name2.includes(name1)) {
        score += 0.3;
      }
      factors += 0.4;
    }

    // Email similarity
    if (customer1.email && customer2.email) {
      if (customer1.email.toLowerCase() === customer2.email.toLowerCase()) {
        score += 0.3;
      }
      factors += 0.3;
    }

    // Phone similarity
    if (customer1.phone && customer2.phone) {
      const phone1 = customer1.phone.replace(/\D/g, '');
      const phone2 = customer2.phone.replace(/\D/g, '');
      if (phone1 === phone2) {
        score += 0.3;
      }
      factors += 0.3;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Calculate group similarity
   * @param {Array} group - Group of customers
   * @returns {Number}
   */
  calculateGroupSimilarity(group) {
    if (group.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        totalSimilarity += this.calculateSimilarity(group[i], group[j]);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Suggest target customer for merge (keep the one with most transactions)
   * @param {Array} group - Group of duplicate customers
   * @returns {Customer}
   */
  async suggestTargetCustomer(group) {
    // Get transaction counts for each customer
    const counts = await Promise.all(group.map(async (customer) => {
      const transactionCount = await CustomerTransaction.countDocuments({ customer: customer._id });
      const salesCount = await Sales.countDocuments({ customer: customer._id });
      return {
        customer,
        transactionCount,
        salesCount,
        totalActivity: transactionCount + salesCount
      };
    }));

    // Sort by activity (most active first)
    counts.sort((a, b) => b.totalActivity - a.totalActivity);

    return counts[0].customer;
  }
}

module.exports = new CustomerMergeService();

