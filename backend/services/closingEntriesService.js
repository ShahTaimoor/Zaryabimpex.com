const AccountingPeriod = require('../models/AccountingPeriod');
const ChartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const AccountingService = require('./accountingService');
const JournalVoucher = require('../models/JournalVoucher');
const Counter = require('../models/Counter');

/**
 * Closing Entries Service
 * CRITICAL: Automates period-end closing entries
 * Required for GAAP compliance and proper period closing
 */
class ClosingEntriesService {
  /**
   * Generate closing entries for a period
   * @param {String} periodId - Accounting period ID
   * @param {String} userId - User ID performing the closing
   * @returns {Promise<Object>} Closing entries journal voucher
   */
  async generateClosingEntries(periodId, userId) {
    try {
      const period = await AccountingPeriod.findById(periodId);
      if (!period) {
        throw new Error('Accounting period not found');
      }
      
      // Get all revenue and expense accounts
      const revenueAccounts = await ChartOfAccountsRepository.findAll({
        accountType: 'revenue',
        isActive: true
      });
      
      const expenseAccounts = await ChartOfAccountsRepository.findAll({
        accountType: 'expense',
        isActive: true
      });
      
      const closingEntries = [];
      let incomeSummaryDebit = 0;
      let incomeSummaryCredit = 0;
      
      // Close revenue accounts to Income Summary
      for (const account of revenueAccounts) {
        const balance = await AccountingService.getAccountBalance(
          account.accountCode,
          period.periodEnd
        );
        
        // Revenue accounts have credit normal balance
        // If balance is positive (credit), we need to debit to close
        if (balance !== 0) {
          const debitAmount = balance > 0 ? Math.abs(balance) : 0;
          const creditAmount = balance < 0 ? Math.abs(balance) : 0;
          
          if (debitAmount > 0 || creditAmount > 0) {
            closingEntries.push({
              account: account._id,
              accountCode: account.accountCode,
              accountName: account.accountName,
              particulars: `Closing entry: Close ${account.accountName} to Income Summary`,
              debit: debitAmount,
              credit: creditAmount
            });
            
            incomeSummaryDebit += debitAmount;
            incomeSummaryCredit += creditAmount;
          }
        }
      }
      
      // Close expense accounts to Income Summary
      for (const account of expenseAccounts) {
        const balance = await AccountingService.getAccountBalance(
          account.accountCode,
          period.periodEnd
        );
        
        // Expense accounts have debit normal balance
        // If balance is positive (debit), we need to credit to close
        if (balance !== 0) {
          const debitAmount = balance < 0 ? Math.abs(balance) : 0;
          const creditAmount = balance > 0 ? Math.abs(balance) : 0;
          
          if (debitAmount > 0 || creditAmount > 0) {
            closingEntries.push({
              account: account._id,
              accountCode: account.accountCode,
              accountName: account.accountName,
              particulars: `Closing entry: Close ${account.accountName} to Income Summary`,
              debit: debitAmount,
              credit: creditAmount
            });
            
            incomeSummaryDebit += debitAmount;
            incomeSummaryCredit += creditAmount;
          }
        }
      }
      
      // Calculate net income (Income Summary balance)
      const netIncome = incomeSummaryCredit - incomeSummaryDebit;
      
      // Close Income Summary to Retained Earnings
      if (netIncome !== 0) {
        let retainedEarningsCode;
        try {
          retainedEarningsCode = await AccountingService.getAccountCode(
            'Retained Earnings',
            'equity',
            'retained_earnings'
          );
        } catch (error) {
          // Fallback to default code
          retainedEarningsCode = '3001';
        }
        
        const retainedEarningsAccount = await ChartOfAccountsRepository.findOne({
          accountCode: retainedEarningsCode
        });
        
        if (!retainedEarningsAccount) {
          throw new Error(`Retained Earnings account (${retainedEarningsCode}) not found`);
        }
        
        // Debit Income Summary, Credit Retained Earnings (if net income is positive)
        // Credit Income Summary, Debit Retained Earnings (if net income is negative)
        if (netIncome > 0) {
          closingEntries.push({
            account: retainedEarningsAccount._id,
            accountCode: retainedEarningsAccount.accountCode,
            accountName: retainedEarningsAccount.accountName,
            particulars: 'Closing entry: Close Income Summary to Retained Earnings',
            debit: 0,
            credit: netIncome
          });
        } else {
          closingEntries.push({
            account: retainedEarningsAccount._id,
            accountCode: retainedEarningsAccount.accountCode,
            accountName: retainedEarningsAccount.accountName,
            particulars: 'Closing entry: Close Income Summary to Retained Earnings',
            debit: Math.abs(netIncome),
            credit: 0
          });
        }
      }
      
      if (closingEntries.length === 0) {
        return {
          message: 'No closing entries required - all revenue and expense accounts are zero',
          closingEntries: []
        };
      }
      
      // Calculate totals
      const totalDebit = closingEntries.reduce((sum, entry) => sum + entry.debit, 0);
      const totalCredit = closingEntries.reduce((sum, entry) => sum + entry.credit, 0);
      
      // Generate voucher number
      const counter = await Counter.findOneAndUpdate(
        { _id: 'journalVoucherNumber' },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );
      const voucherNumber = `JV-CLOSE-${String(counter.seq).padStart(6, '0')}`;
      
      // Create journal voucher for closing entries
      const closingVoucher = new JournalVoucher({
        voucherNumber,
        voucherDate: period.periodEnd,
        reference: `Closing entries for ${period.periodName}`,
        description: `Period-end closing entries for ${period.periodName} (${period.periodStart.toISOString().split('T')[0]} to ${period.periodEnd.toISOString().split('T')[0]})`,
        entries: closingEntries,
        totalDebit,
        totalCredit,
        status: 'posted', // Closing entries are automatically posted
        notes: `Automated closing entries generated for period ${period.periodName}. Net Income: ${netIncome >= 0 ? '+' : ''}${netIncome.toFixed(2)}`,
        createdBy: userId,
        metadata: {
          isClosingEntry: true,
          periodId: periodId,
          periodName: period.periodName,
          netIncome: netIncome
        }
      });
      
      await closingVoucher.save();
      
      // Update account balances
      for (const entry of closingEntries) {
        const account = await ChartOfAccountsRepository.findById(entry.account);
        if (!account) continue;
        
        const amount = entry.debit > 0 ? entry.debit : entry.credit;
        const isDebitEntry = entry.debit > 0;
        
        let delta = amount;
        if (account.normalBalance === 'debit') {
          delta = isDebitEntry ? amount : -amount;
        } else {
          delta = isDebitEntry ? -amount : amount;
        }
        
        await ChartOfAccountsRepository.updateBalance(
          account._id,
          { $inc: { currentBalance: delta } }
        );
      }
      
      return {
        message: 'Closing entries generated successfully',
        closingVoucher: {
          _id: closingVoucher._id,
          voucherNumber: closingVoucher.voucherNumber,
          voucherDate: closingVoucher.voucherDate,
          totalDebit: closingVoucher.totalDebit,
          totalCredit: closingVoucher.totalCredit,
          netIncome: netIncome,
          entryCount: closingEntries.length
        },
        summary: {
          revenueAccountsClosed: revenueAccounts.length,
          expenseAccountsClosed: expenseAccounts.length,
          netIncome: netIncome,
          totalEntries: closingEntries.length
        }
      };
    } catch (error) {
      console.error('Error generating closing entries:', error);
      throw error;
    }
  }
  
  /**
   * Check if closing entries are required for a period
   * @param {String} periodId - Accounting period ID
   * @returns {Promise<Boolean>} True if closing entries are required
   */
  async areClosingEntriesRequired(periodId) {
    try {
      const period = await AccountingPeriod.findById(periodId);
      if (!period) {
        throw new Error('Accounting period not found');
      }
      
      // Check if closing entries already exist for this period
      const existingClosing = await JournalVoucher.findOne({
        'metadata.periodId': periodId,
        'metadata.isClosingEntry': true
      });
      
      if (existingClosing) {
        return false; // Closing entries already generated
      }
      
      // Check if there are any revenue or expense accounts with balances
      const revenueAccounts = await ChartOfAccountsRepository.findAll({
        accountType: 'revenue',
        isActive: true
      });
      
      const expenseAccounts = await ChartOfAccountsRepository.findAll({
        accountType: 'expense',
        isActive: true
      });
      
      for (const account of [...revenueAccounts, ...expenseAccounts]) {
        const balance = await AccountingService.getAccountBalance(
          account.accountCode,
          period.periodEnd
        );
        
        if (balance !== 0) {
          return true; // At least one account has a balance
        }
      }
      
      return false; // No balances to close
    } catch (error) {
      console.error('Error checking if closing entries are required:', error);
      throw error;
    }
  }
}

module.exports = new ClosingEntriesService();

