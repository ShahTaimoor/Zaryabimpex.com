const AccountingPeriod = require('../models/AccountingPeriod');
const CustomerTransaction = require('../models/CustomerTransaction');
const reconciliationService = require('./reconciliationService');
const trialBalanceService = require('./trialBalanceService');
const closingEntriesService = require('./closingEntriesService');

class AccountingPeriodService {
  /**
   * Create a new accounting period
   * @param {Object} periodData - Period data
   * @param {Object} user - User creating period
   * @returns {Promise<AccountingPeriod>}
   */
  async createPeriod(periodData, user) {
    const {
      periodName,
      periodType,
      periodStart,
      periodEnd
    } = periodData;

    // Validate dates
    if (periodStart >= periodEnd) {
      throw new Error('Period start date must be before end date');
    }

    // Check for overlapping periods
    const overlapping = await AccountingPeriod.findOne({
      periodType,
      $or: [
        {
          periodStart: { $lte: periodEnd },
          periodEnd: { $gte: periodStart }
        }
      ],
      status: { $ne: 'closed' }
    });

    if (overlapping) {
      throw new Error(`Overlapping period exists: ${overlapping.periodName}`);
    }

    const period = new AccountingPeriod({
      periodName,
      periodType,
      periodStart,
      periodEnd,
      createdBy: user._id,
      status: 'open'
    });

    await period.save();
    return period;
  }

  /**
   * Close an accounting period
   * @param {String} periodId - Period ID
   * @param {Object} user - User closing period
   * @param {String} notes - Closing notes
   * @returns {Promise<AccountingPeriod>}
   */
  async closePeriod(periodId, user, notes = '') {
    const period = await AccountingPeriod.findById(periodId);
    if (!period) {
      throw new Error('Period not found');
    }

    // Check if can be closed
    const canClose = await period.canBeClosed();
    if (!canClose.canClose) {
      throw new Error(`Cannot close period: ${canClose.reason}`);
    }

    // Set status to closing
    period.status = 'closing';
    await period.save();

    try {
      // CRITICAL: Validate trial balance before closing
      try {
        await trialBalanceService.validateTrialBalance(period.periodEnd, periodId);
      } catch (trialBalanceError) {
        throw new Error(`Cannot close period: ${trialBalanceError.message}`);
      }

      // Reconcile all customer balances
      const reconciliation = await reconciliationService.reconcileAllCustomerBalances({
        autoCorrect: false,
        alertOnDiscrepancy: true
      });

      if (reconciliation.discrepancies > 0) {
        throw new Error(
          `Cannot close period: ${reconciliation.discrepancies} balance discrepancies found. ` +
          `Please resolve before closing.`
        );
      }

      // CRITICAL: Generate closing entries if required
      const closingEntriesRequired = await closingEntriesService.areClosingEntriesRequired(periodId);
      if (closingEntriesRequired) {
        try {
          await closingEntriesService.generateClosingEntries(periodId, user._id);
        } catch (closingError) {
          throw new Error(`Error generating closing entries: ${closingError.message}`);
        }
      }

      // Calculate period statistics
      const stats = await this.calculatePeriodStatistics(period);

      // Close period
      period.status = 'closed';
      period.closedBy = user._id;
      period.closedAt = new Date();
      period.closingNotes = notes;
      period.transactionCount = stats.transactionCount;
      period.totalRevenue = stats.totalRevenue;
      period.totalReceivables = stats.totalReceivables;
      period.reconciled = true;
      period.reconciledBy = user._id;
      period.reconciledAt = new Date();

      await period.save();

      return period;
    } catch (error) {
      // Revert to open if closing fails
      period.status = 'open';
      await period.save();
      throw error;
    }
  }

  /**
   * Lock an accounting period (prevents all modifications)
   * @param {String} periodId - Period ID
   * @param {Object} user - User locking period
   * @param {String} reason - Lock reason
   * @returns {Promise<AccountingPeriod>}
   */
  async lockPeriod(periodId, user, reason = '') {
    const period = await AccountingPeriod.findById(periodId);
    if (!period) {
      throw new Error('Period not found');
    }

    if (period.status !== 'closed') {
      throw new Error('Period must be closed before locking');
    }

    period.status = 'locked';
    period.lockedBy = user._id;
    period.lockedAt = new Date();
    period.lockReason = reason;

    await period.save();
    return period;
  }

  /**
   * Unlock an accounting period
   * @param {String} periodId - Period ID
   * @param {Object} user - User unlocking period
   * @returns {Promise<AccountingPeriod>}
   */
  async unlockPeriod(periodId, user) {
    const period = await AccountingPeriod.findById(periodId);
    if (!period) {
      throw new Error('Period not found');
    }

    if (period.status !== 'locked') {
      throw new Error('Period is not locked');
    }

    period.status = 'closed';
    period.lockedBy = null;
    period.lockedAt = null;
    period.lockReason = null;

    await period.save();
    return period;
  }

  /**
   * Calculate period statistics
   * @param {AccountingPeriod} period - Period
   * @returns {Promise<Object>}
   */
  async calculatePeriodStatistics(period) {
    const transactions = await CustomerTransaction.find({
      transactionDate: {
        $gte: period.periodStart,
        $lte: period.periodEnd
      },
      status: { $ne: 'reversed' }
    });

    let totalRevenue = 0;
    let totalReceivables = 0;

    transactions.forEach(transaction => {
      if (transaction.transactionType === 'invoice') {
        totalRevenue += transaction.netAmount;
        totalReceivables += transaction.netAmount;
      } else if (transaction.transactionType === 'payment') {
        totalReceivables -= transaction.netAmount;
      } else if (transaction.transactionType === 'refund' || transaction.transactionType === 'credit_note') {
        totalRevenue -= transaction.netAmount;
        totalReceivables -= transaction.netAmount;
      }
    });

    return {
      transactionCount: transactions.length,
      totalRevenue,
      totalReceivables: Math.max(0, totalReceivables)
    };
  }

  /**
   * Get current period
   * @param {String} periodType - Period type
   * @returns {Promise<AccountingPeriod>}
   */
  async getCurrentPeriod(periodType = 'monthly') {
    return await AccountingPeriod.getCurrentPeriod(periodType);
  }

  /**
   * Get period for a date
   * @param {Date} date - Date
   * @param {String} periodType - Period type
   * @returns {Promise<AccountingPeriod>}
   */
  async getPeriodForDate(date, periodType = 'monthly') {
    return await AccountingPeriod.findPeriodForDate(date, periodType);
  }

  /**
   * Validate transaction can be created for date
   * @param {Date} date - Transaction date
   * @returns {Promise<{allowed: boolean, reason?: string}>}
   */
  async validateTransactionDate(date) {
    const period = await AccountingPeriod.findPeriodForDate(date);
    
    if (!period) {
      return { allowed: true }; // No period restriction
    }

    if (period.status === 'closed' || period.status === 'locked') {
      return {
        allowed: false,
        reason: `Transaction date falls in ${period.status} period: ${period.periodName}`
      };
    }

    return { allowed: true };
  }
}

module.exports = new AccountingPeriodService();

