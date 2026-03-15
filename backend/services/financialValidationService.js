const ChartOfAccounts = require('../models/ChartOfAccounts');
const Transaction = require('../models/Transaction');
const BalanceSheet = require('../models/BalanceSheet');

/**
 * Financial Validation Service
 * Real-time validation of financial data and balance sheet reconciliation
 */
class FinancialValidationService {
  /**
   * Validate balance sheet equation: Assets = Liabilities + Equity
   */
  async validateBalanceSheetEquation(asOfDate = new Date()) {
    try {
      const assets = await this.calculateTotalAssets(asOfDate);
      const liabilities = await this.calculateTotalLiabilities(asOfDate);
      const equity = await this.calculateTotalEquity(asOfDate);
      
      const totalLiabilitiesAndEquity = liabilities + equity;
      const difference = Math.abs(assets - totalLiabilitiesAndEquity);
      
      const balanced = difference <= 0.01; // Allow small rounding differences
      
      return {
        balanced,
        assets,
        liabilities,
        equity,
        totalLiabilitiesAndEquity,
        difference,
        asOfDate,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error validating balance sheet equation:', error);
      throw error;
    }
  }
  
  /**
   * Calculate total assets
   */
  async calculateTotalAssets(asOfDate) {
    const assetAccounts = await ChartOfAccounts.find({
      accountType: 'asset',
      isActive: true
    });
    
    let totalAssets = 0;
    
    for (const account of assetAccounts) {
      const balance = await this.calculateAccountBalance(account.accountCode, asOfDate);
      totalAssets += balance;
    }
    
    return totalAssets;
  }
  
  /**
   * Calculate total liabilities
   */
  async calculateTotalLiabilities(asOfDate) {
    const liabilityAccounts = await ChartOfAccounts.find({
      accountType: 'liability',
      isActive: true
    });
    
    let totalLiabilities = 0;
    
    for (const account of liabilityAccounts) {
      const balance = await this.calculateAccountBalance(account.accountCode, asOfDate);
      totalLiabilities += balance;
    }
    
    return totalLiabilities;
  }
  
  /**
   * Calculate total equity
   */
  async calculateTotalEquity(asOfDate) {
    const equityAccounts = await ChartOfAccounts.find({
      accountType: 'equity',
      isActive: true
    });
    
    let totalEquity = 0;
    
    for (const account of equityAccounts) {
      const balance = await this.calculateAccountBalance(account.accountCode, asOfDate);
      totalEquity += balance;
    }
    
    return totalEquity;
  }
  
  /**
   * Calculate account balance as of specific date
   * Updated to match accountingService.getAccountBalance() logic:
   * - Includes opening balance
   * - Uses normalBalance field for accurate calculation
   * - Normalizes account code
   */
  async calculateAccountBalance(accountCode, asOfDate) {
    try {
      // Normalize account code to uppercase
      const normalizedAccountCode = accountCode ? accountCode.toString().trim().toUpperCase() : null;
      if (!normalizedAccountCode) {
        return 0;
      }

      // Get account to determine normal balance type and opening balance
      const account = await ChartOfAccounts.findOne({ 
        accountCode: normalizedAccountCode,
        isActive: true 
      });
      
      if (!account) {
        console.warn(`Account ${normalizedAccountCode} not found or inactive in validation service`);
        return 0;
      }

      // Get opening balance
      let balance = account.openingBalance || 0;
      
      const transactions = await Transaction.find({
        accountCode: normalizedAccountCode,
        status: 'completed',
        createdAt: { $lte: asOfDate }
      });
      
      // Calculate balance based on account normal balance type
      // For debit normal balance accounts (assets, expenses): Debits increase, Credits decrease
      // For credit normal balance accounts (liabilities, equity, revenue): Credits increase, Debits decrease
      transactions.forEach(transaction => {
        const debit = transaction.debitAmount || 0;
        const credit = transaction.creditAmount || 0;
        
        if (account.normalBalance === 'credit') {
          // Credit normal balance: credits increase, debits decrease
          balance = balance + credit - debit;
        } else {
          // Debit normal balance: debits increase, credits decrease
          balance = balance + debit - credit;
        }
      });
      
      return balance;
    } catch (error) {
      console.error('Error calculating account balance in validation service:', error);
      return 0;
    }
  }
  
  /**
   * Validate all account balances
   */
  async validateAllAccountBalances() {
    const accounts = await ChartOfAccounts.find({ isActive: true });
    const issues = [];
    
    for (const account of accounts) {
      try {
        // Calculate balance from transactions
        const calculatedBalance = await this.calculateAccountBalance(
          account.accountCode,
          new Date()
        );
        
        const storedBalance = account.currentBalance || 0;
        const difference = Math.abs(calculatedBalance - storedBalance);
        
        if (difference > 0.01) {
          issues.push({
            accountCode: account.accountCode,
            accountName: account.accountName,
            accountType: account.accountType,
            calculatedBalance,
            storedBalance,
            difference,
            severity: difference > 100 ? 'high' : 'medium'
          });
        }
      } catch (error) {
        issues.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          error: error.message,
          severity: 'high'
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Validate transaction before creation
   */
  async validateTransaction(transaction) {
    const issues = [];
    
    // Validate account exists and is active
    if (transaction.accountCode) {
      const account = await ChartOfAccounts.findOne({
        accountCode: transaction.accountCode,
        isActive: true
      });
      
      if (!account) {
        issues.push({
          type: 'invalid_account',
          accountCode: transaction.accountCode,
          severity: 'high'
        });
      } else {
        // Validate account allows direct posting
        if (!account.allowDirectPosting) {
          issues.push({
            type: 'account_not_allows_posting',
            accountCode: transaction.accountCode,
            accountName: account.accountName,
            severity: 'high'
          });
        }
      }
    }
    
    // Validate amounts are non-negative
    if (transaction.debitAmount !== undefined && transaction.debitAmount < 0) {
      issues.push({
        type: 'negative_debit_amount',
        debitAmount: transaction.debitAmount,
        severity: 'high'
      });
    }
    
    if (transaction.creditAmount !== undefined && transaction.creditAmount < 0) {
      issues.push({
        type: 'negative_credit_amount',
        creditAmount: transaction.creditAmount,
        severity: 'high'
      });
    }
    
    // Validate at least one amount is > 0
    const debitAmount = transaction.debitAmount || 0;
    const creditAmount = transaction.creditAmount || 0;
    
    if (debitAmount === 0 && creditAmount === 0) {
      issues.push({
        type: 'zero_amounts',
        transactionId: transaction.transactionId,
        severity: 'high'
      });
    }
    
    // Validate not both > 0
    if (debitAmount > 0 && creditAmount > 0) {
      issues.push({
        type: 'both_amounts_positive',
        debitAmount,
        creditAmount,
        severity: 'high'
      });
    }
    
    return issues;
  }
  
  /**
   * Validate double-entry integrity: every transaction group (by paymentId) must have
   * total debits = total credits. General Ledger is the only source of truth.
   * Call this before generating P&L or Balance Sheet; block reports if unbalanced.
   * @param {Date} asOfDate - Optional: only validate transactions on or before this date
   * @returns {Promise<{ valid: boolean, unbalancedGroups: Array, message?: string }>}
   */
  async validateLedgerDoubleEntry(asOfDate = null) {
    try {
      const match = {
        status: 'completed',
        $or: [
          { debitAmount: { $gt: 0 } },
          { creditAmount: { $gt: 0 } }
        ]
      };
      if (asOfDate) {
        match.createdAt = { $lte: asOfDate };
      }

      const groups = await Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$paymentId',
            totalDebit: { $sum: '$debitAmount' },
            totalCredit: { $sum: '$creditAmount' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            paymentId: '$_id',
            totalDebit: 1,
            totalCredit: 1,
            count: 1,
            difference: {
              $abs: { $subtract: ['$totalDebit', '$totalCredit'] }
            }
          }
        },
        { $match: { difference: { $gt: 0.01 } } }
      ]);

      const unbalancedGroups = groups.map(g => ({
        paymentId: g.paymentId?.toString?.() || g.paymentId,
        totalDebit: Math.round((g.totalDebit || 0) * 100) / 100,
        totalCredit: Math.round((g.totalCredit || 0) * 100) / 100,
        difference: Math.round((g.difference || 0) * 100) / 100
      }));

      return {
        valid: unbalancedGroups.length === 0,
        unbalancedGroups,
        message: unbalancedGroups.length > 0
          ? `Unbalanced transaction groups: ${unbalancedGroups.length}. Debits must equal Credits for each group.`
          : undefined
      };
    } catch (error) {
      console.error('Error validating ledger double-entry:', error);
      throw error;
    }
  }

  /**
   * Validate journal entry balances
   */
  async validateJournalEntryBalances(entries) {
    const issues = [];
    
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      issues.push({
        type: 'no_entries',
        severity: 'high'
      });
      return issues;
    }
    
    const totalDebits = entries.reduce((sum, e) => sum + (e.debitAmount || 0), 0);
    const totalCredits = entries.reduce((sum, e) => sum + (e.creditAmount || 0), 0);
    const difference = Math.abs(totalDebits - totalCredits);
    
    if (difference > 0.01) {
      issues.push({
        type: 'unbalanced_entry',
        totalDebits,
        totalCredits,
        difference,
        severity: 'high'
      });
    }
    
    return issues;
  }
  
  /**
   * Schedule real-time validation
   */
  scheduleValidation() {
    const cron = require('node-cron');
    
    // Validate balance sheet equation hourly
    cron.schedule('0 * * * *', async () => {
      try {
        const result = await this.validateBalanceSheetEquation(new Date());
        
        if (!result.balanced) {
          // Alert administrators
          console.error('Balance sheet imbalance detected:', result);
          
          // TODO: Send alert
          // await sendAlert({
          //   type: 'balance_sheet_imbalance',
          //   severity: 'critical',
          //   data: result
          // });
        }
      } catch (error) {
        console.error('Error in scheduled balance sheet validation:', error);
      }
    });
    
    // Validate all account balances daily at 1 AM
    cron.schedule('0 1 * * *', async () => {
      try {
        const issues = await this.validateAllAccountBalances();
        
        if (issues.length > 0) {
          const criticalIssues = issues.filter(i => i.severity === 'high');
          
          if (criticalIssues.length > 0) {
            console.error('Account balance mismatches detected:', criticalIssues);
            
            // TODO: Send alert
            // await sendAlert({
            //   type: 'account_balance_mismatch',
            //   severity: 'high',
            //   issues: criticalIssues
            // });
          }
        }
      } catch (error) {
        console.error('Error in scheduled account balance validation:', error);
      }
    });
  }
}

module.exports = new FinancialValidationService();

