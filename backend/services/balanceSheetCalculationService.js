const { query } = require('../config/postgres');
const AccountingService = require('./accountingService');
const { getSystemAccountCodes } = require('../config/basicAccounts');
const { getEndOfDayPakistan } = require('../utils/dateFilter');

/**
 * Ledger "as of" cutoff for balance sheet accounts.
 */
function asOfCutoff(statementDate) {
  if (!statementDate) return null;
  return getEndOfDayPakistan(statementDate);
}

/**
 * Balance Sheet Calculation Service - PostgreSQL Implementation
 * Uses the minimal POS chart of accounts (cash, bank, AR, inventory, AP, owner capital).
 */
class BalanceSheetCalculationService {
  async calculateAccountBalance(accountCode, statementDate, opts = {}) {
    const asOf = asOfCutoff(statementDate);
    return await AccountingService.getAccountBalance(accountCode, asOf, opts);
  }

  async sumBalancesByAccountType(accountType, statementDate) {
    const codes = await this.getAccountCodesByType(accountType);
    let total = 0;
    for (const code of codes) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  async getAccountCodesByType(accountType) {
    const result = await query(
      `SELECT account_code FROM chart_of_accounts
       WHERE account_type = $1 AND deleted_at IS NULL AND is_active = TRUE`,
      [accountType]
    );
    return (result.rows || []).map((r) => r.account_code);
  }

  async getAssetCodesByCategory() {
    const result = await query(
      `SELECT account_code, account_category FROM chart_of_accounts
       WHERE account_type = 'asset' AND deleted_at IS NULL AND is_active = TRUE`
    );
    const current = (result.rows || [])
      .filter((r) => r.account_category === 'current_assets' || r.account_category === 'inventory')
      .map((r) => r.account_code);
    const fixed = (result.rows || [])
      .filter((r) => r.account_category === 'fixed_assets')
      .map((r) => r.account_code);
    return { current, fixed };
  }

  async calculateCurrentAssets(statementDate) {
    const codes = getSystemAccountCodes();
    const essential = [codes.cash, codes.bank, codes.accountsReceivable, codes.inventory];
    const { current } = await this.getAssetCodesByCategory();
    const codeSet = new Set([...essential, ...current]);
    let total = 0;
    for (const code of codeSet) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  async calculateFixedAssets(statementDate) {
    const { fixed } = await this.getAssetCodesByCategory();
    if (!fixed.length) return 0;
    let total = 0;
    for (const code of fixed) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  async calculateTotalAssets(statementDate) {
    return (await this.calculateCurrentAssets(statementDate)) + (await this.calculateFixedAssets(statementDate));
  }

  async getLiabilityCodesByCategory() {
    const result = await query(
      `SELECT account_code, account_category FROM chart_of_accounts
       WHERE account_type = 'liability' AND deleted_at IS NULL AND is_active = TRUE`
    );
    const current = (result.rows || [])
      .filter((r) => r.account_category === 'current_liabilities')
      .map((r) => r.account_code);
    const longTerm = (result.rows || [])
      .filter((r) => r.account_category === 'long_term_liabilities')
      .map((r) => r.account_code);
    return { current, longTerm };
  }

  async calculateCurrentLiabilities(statementDate) {
    const codes = getSystemAccountCodes();
    const { current } = await this.getLiabilityCodesByCategory();
    const codeSet = new Set([codes.accountsPayable, ...current]);
    let total = 0;
    for (const code of codeSet) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  async calculateLongTermLiabilities(statementDate) {
    const { longTerm } = await this.getLiabilityCodesByCategory();
    if (!longTerm.length) return 0;
    let total = 0;
    for (const code of longTerm) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  async calculateTotalLiabilities(statementDate) {
    return (await this.calculateCurrentLiabilities(statementDate)) + (await this.calculateLongTermLiabilities(statementDate));
  }

  async calculateTotalEquity(statementDate) {
    return await this.sumBalancesByAccountType('equity', statementDate);
  }

  async generateBalanceSheet(statementDate) {
    const date = statementDate || new Date();
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const plService = require('./plCalculationService');
    const asOf = asOfCutoff(date);
    const codes = getSystemAccountCodes();

    const cash = await this.calculateAccountBalance(codes.cash, date);
    const bank = await this.calculateAccountBalance(codes.bank, date);
    const ar = await this.calculateAccountBalance(codes.accountsReceivable, date);
    const inventory = await this.calculateAccountBalance(codes.inventory, date);
    const ap = await this.calculateAccountBalance(codes.accountsPayable, date);
    const ownerCapital = await this.calculateAccountBalance(codes.ownerCapital, date, { useDbFallback: true });
    const netIncome = await plService.calculateNetIncome(startOfYear, asOf);
    const openingOwnerCapital = await this.calculateAccountBalance(codes.ownerCapital, startOfYear, { useDbFallback: true });

    const currentAssets = cash + bank + ar + inventory;
    const totalFixedAssets = await this.calculateFixedAssets(date);
    const totalAssets = currentAssets + totalFixedAssets;

    const currentLiabilities = await this.calculateCurrentLiabilities(date);
    const longTermLiabilities = await this.calculateLongTermLiabilities(date);
    const totalLiabilities = currentLiabilities + longTermLiabilities;

    const equityFromLedger = ownerCapital;
    const requiredEquity = totalAssets - totalLiabilities;
    const imbalance = equityFromLedger - requiredEquity;
    const totalEquity = requiredEquity;

    const difference = Math.abs(imbalance);
    const isBalanced = difference < 0.01;

    if (!isBalanced && difference > 1.0) {
      console.warn(`Balance Sheet imbalance: ${difference.toFixed(2)}`);
    }

    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const quickAssets = currentAssets - inventory;
    const quickRatio = currentLiabilities > 0 ? quickAssets / currentLiabilities : 0;
    const cashRatio = currentLiabilities > 0 ? (cash + bank) / currentLiabilities : 0;
    const debtToEquity = totalEquity > 0 ? totalLiabilities / totalEquity : 0;
    const debtToAsset = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
    const equityRatio = totalAssets > 0 ? totalEquity / totalAssets : 0;

    return {
      statementDate: date,
      assets: {
        currentAssets: {
          cashAndCashEquivalents: { cash, bank, total: cash + bank },
          accountsReceivable: { netReceivables: ar },
          inventory: { total: inventory },
          prepaidExpenses: 0,
          totalCurrentAssets: currentAssets
        },
        fixedAssets: {
          propertyPlantEquipment: { total: totalFixedAssets },
          accumulatedDepreciation: 0,
          netPropertyPlantEquipment: totalFixedAssets,
          intangibleAssets: { total: 0 },
          longTermInvestments: 0,
          totalFixedAssets
        },
        total: totalAssets,
        totalAssets
      },
      liabilities: {
        currentLiabilities: {
          accountsPayable: { total: ap },
          accruedExpenses: { total: Math.max(0, currentLiabilities - ap) },
          shortTermDebt: { total: 0 },
          deferredRevenue: 0,
          totalCurrentLiabilities: currentLiabilities
        },
        longTermLiabilities: {
          longTermDebt: { total: longTermLiabilities },
          deferredTaxLiabilities: 0,
          pensionLiabilities: 0,
          totalLongTermLiabilities: longTermLiabilities
        },
        total: totalLiabilities,
        totalLiabilities
      },
      equity: {
        contributedCapital: {
          commonStock: ownerCapital,
          preferredStock: 0,
          additionalPaidInCapital: 0,
          total: ownerCapital
        },
        retainedEarnings: {
          beginningRetainedEarnings: openingOwnerCapital,
          currentPeriodEarnings: netIncome,
          dividendsPaid: 0,
          endingRetainedEarnings: totalEquity - ownerCapital
        },
        total: totalEquity,
        totalEquity
      },
      financialRatios: {
        liquidity: { currentRatio, quickRatio, cashRatio },
        leverage: { debtToEquityRatio: debtToEquity, debtToAssetRatio: debtToAsset, equityRatio }
      },
      validation: {
        isBalanced,
        difference,
        ledgerEquityVsRequired: imbalance,
        equation: `${totalAssets.toFixed(2)} = ${totalLiabilities.toFixed(2)} + ${totalEquity.toFixed(2)}`
      },
      generatedAt: new Date()
    };
  }
}

module.exports = new BalanceSheetCalculationService();
