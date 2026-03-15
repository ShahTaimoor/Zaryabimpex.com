const ChartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const AccountingService = require('./accountingService');
const TransactionRepository = require('../repositories/TransactionRepository');

/**
 * Trial Balance Service
 * CRITICAL: Validates that debits = credits before period closing
 * Required for GAAP compliance and audit trail
 */
class TrialBalanceService {
  /**
   * Generate trial balance for a specific date
   * @param {Date} asOfDate - Date to calculate trial balance as of
   * @param {String} periodId - Optional period ID for tracking
   * @returns {Promise<Object>} Trial balance with validation
   */
  async generateTrialBalance(asOfDate, periodId = null) {
    try {
      const accounts = await ChartOfAccountsRepository.findAll({ isActive: true });
      const trialBalance = [];
      
      for (const account of accounts) {
        const balance = await AccountingService.getAccountBalance(
          account.accountCode,
          asOfDate
        );
        
        // Calculate debit and credit balances based on normal balance
        let debitBalance = 0;
        let creditBalance = 0;
        
        if (account.normalBalance === 'debit') {
          debitBalance = Math.max(0, balance);
          creditBalance = Math.max(0, -balance);
        } else {
          debitBalance = Math.max(0, -balance);
          creditBalance = Math.max(0, balance);
        }
        
        trialBalance.push({
          accountId: account._id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountType: account.accountType,
          accountCategory: account.accountCategory,
          normalBalance: account.normalBalance,
          debitBalance: Math.round((debitBalance + Number.EPSILON) * 100) / 100,
          creditBalance: Math.round((creditBalance + Number.EPSILON) * 100) / 100,
          netBalance: Math.round((balance + Number.EPSILON) * 100) / 100
        });
      }
      
      // Calculate totals
      const totalDebits = trialBalance.reduce((sum, tb) => sum + tb.debitBalance, 0);
      const totalCredits = trialBalance.reduce((sum, tb) => sum + tb.creditBalance, 0);
      const difference = Math.abs(totalDebits - totalCredits);
      const isBalanced = difference <= 0.01; // Allow 1 cent tolerance for rounding
      
      return {
        asOfDate,
        periodId,
        generatedAt: new Date(),
        trialBalance,
        totals: {
          totalDebits: Math.round((totalDebits + Number.EPSILON) * 100) / 100,
          totalCredits: Math.round((totalCredits + Number.EPSILON) * 100) / 100,
          difference: Math.round((difference + Number.EPSILON) * 100) / 100
        },
        isBalanced,
        validation: {
          passed: isBalanced,
          message: isBalanced 
            ? 'Trial balance is balanced' 
            : `Trial balance is unbalanced: Debits ${totalDebits.toFixed(2)} ≠ Credits ${totalCredits.toFixed(2)} (Difference: ${difference.toFixed(2)})`
        }
      };
    } catch (error) {
      console.error('Error generating trial balance:', error);
      throw error;
    }
  }
  
  /**
   * Validate trial balance before period closing
   * @param {Date} asOfDate - Date to validate
   * @param {String} periodId - Period ID
   * @returns {Promise<Object>} Validation result
   */
  async validateTrialBalance(asOfDate, periodId = null) {
    const trialBalance = await this.generateTrialBalance(asOfDate, periodId);
    
    if (!trialBalance.isBalanced) {
      throw new Error(
        `Cannot close period: Trial balance is unbalanced. ` +
        `Debits: ${trialBalance.totals.totalDebits.toFixed(2)} ≠ ` +
        `Credits: ${trialBalance.totals.totalCredits.toFixed(2)} ` +
        `(Difference: ${trialBalance.totals.difference.toFixed(2)})`
      );
    }
    
    return {
      valid: true,
      trialBalance,
      message: 'Trial balance is balanced and valid for period closing'
    };
  }
  
  /**
   * Get trial balance summary by account type
   * @param {Date} asOfDate - Date to calculate as of
   * @returns {Promise<Object>} Summary by account type
   */
  async getTrialBalanceSummary(asOfDate) {
    const trialBalance = await this.generateTrialBalance(asOfDate);
    
    const summaryByType = {};
    
    trialBalance.trialBalance.forEach(tb => {
      if (!summaryByType[tb.accountType]) {
        summaryByType[tb.accountType] = {
          accountType: tb.accountType,
          accountCount: 0,
          totalDebits: 0,
          totalCredits: 0,
          netBalance: 0
        };
      }
      
      summaryByType[tb.accountType].accountCount++;
      summaryByType[tb.accountType].totalDebits += tb.debitBalance;
      summaryByType[tb.accountType].totalCredits += tb.creditBalance;
      summaryByType[tb.accountType].netBalance += tb.netBalance;
    });
    
    // Round values
    Object.keys(summaryByType).forEach(type => {
      const summary = summaryByType[type];
      summary.totalDebits = Math.round((summary.totalDebits + Number.EPSILON) * 100) / 100;
      summary.totalCredits = Math.round((summary.totalCredits + Number.EPSILON) * 100) / 100;
      summary.netBalance = Math.round((summary.netBalance + Number.EPSILON) * 100) / 100;
    });
    
    return {
      asOfDate,
      generatedAt: new Date(),
      summary: Object.values(summaryByType),
      totals: trialBalance.totals,
      isBalanced: trialBalance.isBalanced
    };
  }
}

module.exports = new TrialBalanceService();

