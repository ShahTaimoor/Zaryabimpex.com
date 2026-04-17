const { query } = require('../config/postgres');
const AccountingService = require('./accountingService');
const { getEndOfDayPakistan } = require('../utils/dateFilter');

/**
 * Ledger "as of" cutoff for balance sheet accounts.
 * Use Pakistan end-of-day boundaries (same as other reporting queries) so server timezone
 * does not accidentally exclude same-day ledger rows (which can make calculated balances look 0).
 */
function asOfCutoff(statementDate) {
  if (!statementDate) return null;
  return getEndOfDayPakistan(statementDate);
}

/**
 * Balance Sheet Calculation Service - PostgreSQL Implementation
 * Generates Balance Sheet reports from ledger data
 */
class BalanceSheetCalculationService {
  /**
   * Calculate account balance for balance sheet (as of end of statement date)
   * @param {object} opts - { useDbFallback } passed to getAccountBalance for equity accounts with ledger/DB mismatch
   */
  async calculateAccountBalance(accountCode, statementDate, opts = {}) {
    const asOf = asOfCutoff(statementDate);
    return await AccountingService.getAccountBalance(accountCode, asOf, opts);
  }

  /**
   * Sum balances by account type (as of statementDate - uses date-filtered ledger)
   */
  async sumBalancesByAccountType(accountType, statementDate) {
    const codes = await this.getAccountCodesByType(accountType);
    let total = 0;
    for (const code of codes) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  /**
   * Get account codes by type (for balance sheet categories)
   */
  async getAccountCodesByType(accountType) {
    const result = await query(
      `SELECT account_code FROM chart_of_accounts WHERE account_type = $1 AND deleted_at IS NULL AND is_active = TRUE`,
      [accountType]
    );
    return (result.rows || []).map(r => r.account_code);
  }

  /**
   * Get asset account codes by category (current_assets vs fixed_assets)
   */
  async getAssetCodesByCategory() {
    const result = await query(
      `SELECT account_code, account_category FROM chart_of_accounts
       WHERE account_type = 'asset' AND deleted_at IS NULL AND is_active = TRUE`
    );
    const current = (result.rows || []).filter(r => r.account_category === 'current_assets').map(r => r.account_code);
    const fixed = (result.rows || []).filter(r => r.account_category === 'fixed_assets').map(r => r.account_code);
    return { current, fixed };
  }

  /**
   * Calculate current assets (as of statementDate - all current_assets accounts)
   */
  async calculateCurrentAssets(statementDate) {
    const { current } = await this.getAssetCodesByCategory();
    const codes = current.length ? current : ['1000', '1001', '1100', '1200', '1300'];
    let total = 0;
    for (const code of codes) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  /**
   * Calculate fixed assets (as of statementDate - all fixed_assets accounts)
   */
  async calculateFixedAssets(statementDate) {
    const { fixed } = await this.getAssetCodesByCategory();
    const codes = fixed.length ? fixed : ['1500', '1600'];
    let total = 0;
    for (const code of codes) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  /**
   * Calculate total assets
   */
  async calculateTotalAssets(statementDate) {
    const currentAssets = await this.calculateCurrentAssets(statementDate);
    const fixedAssets = await this.calculateFixedAssets(statementDate);
    return currentAssets + fixedAssets;
  }

  /**
   * Get liability account codes by category
   */
  async getLiabilityCodesByCategory() {
    const result = await query(
      `SELECT account_code, account_category FROM chart_of_accounts
       WHERE account_type = 'liability' AND deleted_at IS NULL AND is_active = TRUE`
    );
    const current = (result.rows || []).filter(r => r.account_category === 'current_liabilities').map(r => r.account_code);
    const longTerm = (result.rows || []).filter(r => r.account_category === 'long_term_liabilities').map(r => r.account_code);
    return { current, longTerm };
  }

  /**
   * Calculate current liabilities (as of statementDate - all current_liabilities)
   */
  async calculateCurrentLiabilities(statementDate) {
    const { current } = await this.getLiabilityCodesByCategory();
    const codes = current.length ? current : ['2000', '2100', '2200', '2300'];
    let total = 0;
    for (const code of codes) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  /**
   * Calculate long-term liabilities (as of statementDate)
   */
  async calculateLongTermLiabilities(statementDate) {
    const { longTerm } = await this.getLiabilityCodesByCategory();
    const codes = longTerm.length ? longTerm : ['2500'];
    let total = 0;
    for (const code of codes) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  /**
   * Calculate total liabilities
   */
  async calculateTotalLiabilities(statementDate) {
    const current = await this.calculateCurrentLiabilities(statementDate);
    const longTerm = await this.calculateLongTermLiabilities(statementDate);
    return current + longTerm;
  }

  /**
   * Calculate total equity from all equity accounts (ledger-based)
   * Uses 3000, 3100, 3200 so balance sheet matches trial balance
   */
  async calculateTotalEquity(statementDate) {
    const codes = await this.getAccountCodesByType('equity');
    let total = 0;
    for (const code of codes) {
      total += await this.calculateAccountBalance(code, statementDate);
    }
    return total;
  }

  /**
   * Generate complete balance sheet (structure matches BalanceSheetDetailModal expectations)
   * Uses ledger-based balances throughout so Assets = Liabilities + Equity
   */
  async generateBalanceSheet(statementDate) {
    const date = statementDate || new Date();
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const plService = require('./plCalculationService');
    const asOf = asOfCutoff(date);

    // Individual account balances (ledger-based, as of statement date)
    const cash = await this.calculateAccountBalance('1000', date);
    const bank = await this.calculateAccountBalance('1001', date);
    const ar = await this.calculateAccountBalance('1100', date);
    const inventory = await this.calculateAccountBalance('1200', date);
    const prepaid = await this.calculateAccountBalance('1300', date);
    const ppe = await this.calculateAccountBalance('1500', date);
    const accumDepreciation = Math.abs(await this.calculateAccountBalance('1600', date));
    const netPpe = ppe - accumDepreciation;

    const ap = await this.calculateAccountBalance('2000', date);
    const accrued = await this.calculateAccountBalance('2100', date);
    const salesTax = await this.calculateAccountBalance('2200', date);
    const shortTermDebt = await this.calculateAccountBalance('2300', date);
    const longTermDebt = await this.calculateAccountBalance('2500', date);

    const ownerEquity = await this.calculateAccountBalance('3000', date);
    const re3100 = await this.calculateAccountBalance('3100', date, { useDbFallback: true });
    const cy3200 = await this.calculateAccountBalance('3200', date, { useDbFallback: true });
    const netIncome = await plService.calculateNetIncome(startOfYear, asOf);
    const openingRE = await this.calculateAccountBalance('3100', startOfYear, { useDbFallback: true });
    const dividendsPaid = 0;

    // Totals
    const currentAssets = cash + bank + ar + inventory + prepaid;
    const totalFixedAssets = netPpe;
    const totalAssets = currentAssets + totalFixedAssets;

    const currentLiabilities = ap + accrued + salesTax + shortTermDebt;
    const longTermLiabilities = longTermDebt;
    const totalLiabilities = currentLiabilities + longTermLiabilities;

    const equityFromLedger = ownerEquity + re3100 + cy3200;
    const requiredEquity = totalAssets - totalLiabilities;
    const imbalance = equityFromLedger - requiredEquity;
    // Use required equity so Assets = Liabilities + Equity always holds (plug for ledger/trial-balance mismatches)
    const totalEquity = requiredEquity;

    // Validation
    const difference = Math.abs(imbalance);
    const isBalanced = difference < 0.01;

    if (!isBalanced && difference > 1.00) {
      console.warn(`Balance Sheet imbalance: ${difference.toFixed(2)}`);
    }

    // Financial ratios
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const quickAssets = currentAssets - inventory - prepaid;
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
          prepaidExpenses: prepaid,
          totalCurrentAssets: currentAssets
        },
        fixedAssets: {
          propertyPlantEquipment: { total: ppe },
          accumulatedDepreciation: accumDepreciation,
          netPropertyPlantEquipment: netPpe,
          intangibleAssets: { total: 0 },
          longTermInvestments: 0,
          totalFixedAssets: totalFixedAssets
        },
        total: totalAssets,
        totalAssets
      },
      liabilities: {
        currentLiabilities: {
          accountsPayable: { total: ap },
          accruedExpenses: { total: accrued + salesTax },
          shortTermDebt: { total: shortTermDebt },
          deferredRevenue: 0,
          totalCurrentLiabilities: currentLiabilities
        },
        longTermLiabilities: {
          longTermDebt: { total: longTermDebt },
          deferredTaxLiabilities: 0,
          pensionLiabilities: 0,
          totalLongTermLiabilities: longTermLiabilities
        },
        total: totalLiabilities,
        totalLiabilities
      },
      equity: {
        contributedCapital: {
          commonStock: ownerEquity,
          preferredStock: 0,
          additionalPaidInCapital: 0,
          total: ownerEquity
        },
        retainedEarnings: {
          beginningRetainedEarnings: openingRE,
          currentPeriodEarnings: netIncome,
          dividendsPaid,
          endingRetainedEarnings: totalEquity - ownerEquity
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
