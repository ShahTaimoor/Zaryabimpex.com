const { transaction } = require('../config/postgres');
const CustomerRepository = require('../repositories/CustomerRepository');
const CustomerTransactionRepository = require('../repositories/CustomerTransactionRepository');
const SalesRepository = require('../repositories/SalesRepository');
const PaymentApplicationRepository = require('../repositories/PaymentApplicationRepository');
const customerAuditLogService = require('./customerAuditLogService');

function toId(v) {
  return v && (v.id || v._id || v);
}

function idEq(a, b) {
  return toId(a) && toId(b) && String(toId(a)) === String(toId(b));
}

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
    const userId = toId(user);

    const source = await CustomerRepository.findById(sourceCustomerId);
    const target = await CustomerRepository.findById(targetCustomerId);

    if (!source || !target) {
      throw new Error('One or both customers not found');
    }

    if (source.is_deleted || target.is_deleted) {
      throw new Error('Cannot merge deleted customers');
    }

    if (idEq(sourceCustomerId, targetCustomerId)) {
      throw new Error('Cannot merge customer with itself');
    }

    let transactionsMoved = 0;
    let salesOrdersMoved = 0;

    await transaction(async (client) => {
      transactionsMoved = await CustomerTransactionRepository.updateCustomerId(sourceCustomerId, targetCustomerId, client);
      salesOrdersMoved = await SalesRepository.updateCustomerId(sourceCustomerId, targetCustomerId, client);
      await PaymentApplicationRepository.updateCustomerId(sourceCustomerId, targetCustomerId, client);

      const mergedBalances = {
        pendingBalance: (Number(source.pending_balance ?? source.pendingBalance ?? 0) || 0) + (Number(target.pending_balance ?? target.pendingBalance ?? 0) || 0),
        advanceBalance: (Number(source.advance_balance ?? source.advanceBalance ?? 0) || 0) + (Number(target.advance_balance ?? target.advanceBalance ?? 0) || 0),
      };
      mergedBalances.currentBalance = mergedBalances.pendingBalance - mergedBalances.advanceBalance;

      let targetAddress = target.address;
      if (mergeAddresses && source.address) {
        const existing = Array.isArray(targetAddress) ? targetAddress : (targetAddress ? [targetAddress] : []);
        const sourceArr = Array.isArray(source.address) ? source.address : (source.address ? [source.address] : []);
        const merged = [...existing, ...sourceArr];
        const unique = merged.filter((addr, i, self) =>
          i === self.findIndex(a =>
            (a && a.street) === (addr && addr.street) &&
            (a && a.city) === (addr && addr.city) &&
            (a && a.zipCode) === (addr && addr.zipCode)
          )
        );
        targetAddress = unique;
      }

      let targetNotes = target.notes || '';
      if (mergeNotes && source.notes) {
        const sourceName = source.business_name || source.businessName || source.name || 'Customer';
        targetNotes = targetNotes
          ? `${targetNotes}\n\n--- Merged from ${sourceName} ---\n${source.notes}`
          : source.notes;
      }

      await CustomerRepository.update(
        targetCustomerId,
        {
          pendingBalance: mergedBalances.pendingBalance,
          advanceBalance: mergedBalances.advanceBalance,
          currentBalance: mergedBalances.currentBalance,
          addresses: targetAddress,
          notes: targetNotes,
          updatedBy: userId,
        },
        client
      );

      await CustomerRepository.delete(sourceCustomerId, client);
    });

    await customerAuditLogService.logCustomerMerge(
      sourceCustomerId,
      targetCustomerId,
      user,
      {
        sourceName: source.business_name || source.businessName || source.name,
        targetName: target.business_name || target.businessName || target.name,
        mergedBalances: {
          pendingBalance: (Number(source.pending_balance ?? 0) || 0) + (Number(target.pending_balance ?? 0) || 0),
          advanceBalance: (Number(source.advance_balance ?? 0) || 0) + (Number(target.advance_balance ?? 0) || 0),
        },
        transactionsMoved,
        salesOrdersMoved,
      }
    );

    const targetUpdated = await CustomerRepository.findById(targetCustomerId);
    const mergedBalances = {
      pendingBalance: Number(targetUpdated?.pending_balance ?? 0),
      advanceBalance: Number(targetUpdated?.advance_balance ?? 0),
      currentBalance: Number(targetUpdated?.current_balance ?? 0),
    };

    return {
      success: true,
      sourceCustomer: {
        id: sourceCustomerId,
        name: source.business_name || source.businessName || source.name,
        status: 'merged',
      },
      targetCustomer: {
        id: targetCustomerId,
        name: target.business_name || target.businessName || target.name,
        newBalances: mergedBalances,
      },
      statistics: {
        transactionsMoved,
        salesOrdersMoved,
        mergedBalances,
      },
    };
  }

  /**
   * Find potential duplicate customers
   */
  async findPotentialDuplicates(options = {}) {
    const { minSimilarity = 0.7 } = options;
    const customers = await CustomerRepository.findAll({}, { limit: 5000 });
    const list = customers.map(c => ({
      _id: c.id,
      name: c.name,
      businessName: c.business_name || c.businessName,
      email: c.email,
      phone: c.phone,
    }));

    const duplicates = [];
    const processed = new Set();

    for (let i = 0; i < list.length; i++) {
      if (processed.has(String(list[i]._id))) continue;
      const group = [list[i]];

      for (let j = i + 1; j < list.length; j++) {
        if (processed.has(String(list[j]._id))) continue;
        const similarity = this.calculateSimilarity(list[i], list[j]);
        if (similarity >= minSimilarity) {
          group.push(list[j]);
          processed.add(String(list[j]._id));
        }
      }

      if (group.length > 1) {
        duplicates.push({
          group,
          similarity: this.calculateGroupSimilarity(group),
          suggestedTarget: await this.suggestTargetCustomer(group),
        });
        processed.add(String(list[i]._id));
      }
    }

    return duplicates;
  }

  calculateSimilarity(customer1, customer2) {
    let score = 0;
    let factors = 0;
    const b1 = customer1.businessName || '';
    const b2 = customer2.businessName || '';
    if (b1 && b2) {
      const name1 = b1.toLowerCase().trim();
      const name2 = b2.toLowerCase().trim();
      if (name1 === name2) score += 0.4;
      else if (name1.includes(name2) || name2.includes(name1)) score += 0.3;
      factors += 0.4;
    }
    if (customer1.email && customer2.email) {
      if (customer1.email.toLowerCase() === customer2.email.toLowerCase()) score += 0.3;
      factors += 0.3;
    }
    if (customer1.phone && customer2.phone) {
      const phone1 = String(customer1.phone).replace(/\D/g, '');
      const phone2 = String(customer2.phone).replace(/\D/g, '');
      if (phone1 === phone2) score += 0.3;
      factors += 0.3;
    }
    return factors > 0 ? score / factors : 0;
  }

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

  async suggestTargetCustomer(group) {
    const counts = await Promise.all(group.map(async (customer) => {
      const cid = toId(customer);
      const transactionCount = await CustomerTransactionRepository.count({ customerId: cid });
      const salesCount = await SalesRepository.count({ customerId: cid });
      return {
        customer,
        transactionCount,
        salesCount,
        totalActivity: transactionCount + salesCount,
      };
    }));
    counts.sort((a, b) => b.totalActivity - a.totalActivity);
    return counts[0] ? counts[0].customer : group[0];
  }
}

module.exports = new CustomerMergeService();
