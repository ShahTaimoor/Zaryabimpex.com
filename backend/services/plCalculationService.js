const { query } = require('../config/postgres');
const AccountingService = require('./accountingService');
const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

/**
 * Profit & Loss Calculation Service - PostgreSQL Implementation
 * Generates P&L statements from ledger data, with fallback to sales table when ledger is empty
 */
class PLCalculationService {
  /**
   * Get revenue and COGS from sales table for period.
   * Excludes cancelled/returned so it matches Sales Invoices list.
   * Used as primary source for P&L sales revenue so it matches Sale Invoice totals.
   */
  async getRevenueAndCOGSFromSales(startDate, endDate) {
    // Use Pakistan date range so P&L matches Sales Invoices list (same dates)
    const start = startDate ? getStartOfDayPakistan(startDate) : null;
    const end = endDate ? getEndOfDayPakistan(endDate) : null;
    if (!start || !end) return { revenue: 0, cogs: 0 };
    const baseWhere = `deleted_at IS NULL AND sale_date >= $1 AND sale_date <= $2
       AND (status IS NULL OR status NOT IN ('cancelled', 'returned'))`;
    const revenueResult = await query(
      `SELECT COALESCE(SUM(total), 0) AS revenue
       FROM sales
       WHERE ${baseWhere}`,
      [start, end]
    );
    const revenue = parseFloat(revenueResult.rows[0]?.revenue || 0);
    const salesRows = await query(
      `SELECT items FROM sales WHERE ${baseWhere}`,
      [start, end]
    );
    let cogs = 0;
    for (const r of salesRows.rows || []) {
      const items = typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []);
      for (const it of items) {
        const qty = Number(it.quantity) || 0;
        const cost = Number(it.unitCost ?? it.cost_price ?? it.costPrice ?? it.cost ?? 0);
        cogs += qty * cost;
      }
    }
    return { revenue, cogs };
  }

  /**
   * Calculate revenue for a period
   */
  async calculateRevenue(startDate, endDate) {
    const result = await query(
      `SELECT COALESCE(SUM(credit_amount - debit_amount), 0) AS revenue
       FROM account_ledger
       WHERE account_code IN ('4000', '4200')
         AND transaction_date >= $1
         AND transaction_date <= $2
         AND status = 'completed'
         AND reversed_at IS NULL`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0]?.revenue || 0);
  }

  /**
   * Get COGS reversals (credits to 5000) from Sale Return entries in the period.
   * Used to compute net COGS = sales COGS - return reversals when ledger sale debits may be missing.
   */
  async getReturnCOGSReversals(startDate, endDate) {
    const result = await query(
      `SELECT COALESCE(SUM(credit_amount), 0) AS reversals
       FROM account_ledger
       WHERE account_code = '5000'
         AND reference_type IN ('Sale Return', 'return')
         AND transaction_date >= $1
         AND transaction_date <= $2
         AND status = 'completed'
         AND reversed_at IS NULL`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0]?.reversals || 0);
  }

  /**
   * Calculate cost of goods sold for a period
   */
  async calculateCOGS(startDate, endDate) {
    const result = await query(
      `SELECT COALESCE(SUM(al.debit_amount - al.credit_amount), 0) AS cogs
       FROM account_ledger al
       WHERE al.account_code = '5000'
         AND al.transaction_date >= $1
         AND al.transaction_date <= $2
         AND al.status = 'completed'
         AND al.reversed_at IS NULL
         AND NOT (al.reference_type = 'sale' AND al.reference_id::text IN (SELECT id::text FROM sales WHERE deleted_at IS NOT NULL))`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0]?.cogs || 0);
  }

  /**
   * Calculate gross profit
   */
  async calculateGrossProfit(startDate, endDate) {
    const revenue = await this.calculateRevenue(startDate, endDate);
    const cogs = await this.calculateCOGS(startDate, endDate);
    return revenue - cogs;
  }

  /**
   * Calculate operating expenses for a period
   */
  async calculateOperatingExpenses(startDate, endDate) {
    const result = await query(
      `SELECT COALESCE(SUM(debit_amount - credit_amount), 0) AS expenses
       FROM account_ledger
       WHERE account_code IN ('5100', '5200', '5300', '5400', '5500')
         AND transaction_date >= $1
         AND transaction_date <= $2
         AND status = 'completed'
         AND reversed_at IS NULL`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0]?.expenses || 0);
  }

  /**
   * Calculate other expenses (account 5600 only)
   */
  async calculateOtherExpenses(startDate, endDate) {
    const result = await query(
      `SELECT COALESCE(SUM(debit_amount - credit_amount), 0) AS expenses
       FROM account_ledger
       WHERE account_code = '5600'
         AND transaction_date >= $1
         AND transaction_date <= $2
         AND status = 'completed'
         AND reversed_at IS NULL`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0]?.expenses || 0);
  }

  /**
   * Get all expense account codes from chart of accounts (excluding COGS 5000).
   * Used so Record Expense and any expense account impact P&L.
   */
  async getExpenseAccountCodes() {
    const result = await query(
      `SELECT account_code FROM chart_of_accounts
       WHERE account_type = 'expense' AND account_code != '5000'
         AND deleted_at IS NULL AND is_active = TRUE`,
      []
    );
    return (result.rows || []).map((r) => r.account_code);
  }

  /**
   * Calculate total expenses from ledger for ALL expense-type accounts in period.
   * Ensures Record Expense (and any expense account) impacts P&L.
   */
  async calculateTotalExpensesFromLedger(startDate, endDate) {
    const codes = await this.getExpenseAccountCodes();
    if (codes.length === 0) return 0;
    const result = await query(
      `SELECT COALESCE(SUM(debit_amount - credit_amount), 0) AS total
       FROM account_ledger
       WHERE account_code = ANY($1)
         AND transaction_date >= $2
         AND transaction_date <= $3
         AND status = 'completed'
         AND reversed_at IS NULL`,
      [codes, startDate, endDate]
    );
    return parseFloat(result.rows[0]?.total || 0);
  }

  /**
   * Calculate net income (includes all expense accounts so Record Expense impacts P&L).
   * Uses sales table for revenue (matches Sale Invoices) and ledger for returns, other income, expenses.
   */
  async calculateNetIncome(startDate, endDate) {
    const fromSales = await this.getRevenueAndCOGSFromSales(startDate, endDate);
    let salesRevenue = fromSales.revenue;
    let cogs = fromSales.cogs;
    const salesReturns = await this.calculateAccountRevenue('4100', startDate, endDate);
    const otherIncome = await this.calculateAccountRevenue('4200', startDate, endDate);
    const totalRevenue = salesRevenue - salesReturns + otherIncome;
    if (salesReturns > 0) {
      const returnCogsReversals = await this.getReturnCOGSReversals(startDate, endDate);
      cogs = Math.max(0, cogs - returnCogsReversals);
    } else if (cogs === 0) {
      cogs = await this.calculateCOGS(startDate, endDate);
    }
    const totalExpenses = await this.calculateTotalExpensesFromLedger(startDate, endDate);
    return totalRevenue - cogs - totalExpenses;
  }

  /**
   * Generate complete P&L statement
   * Uses sales table for revenue (matches Sale Invoice totals); ledger for returns, other income, COGS fallback, expenses
   */
  async generatePLStatement(startDate, endDate) {
    const rawStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const rawEnd = endDate ? new Date(endDate) : new Date();
    rawStart.setHours(0, 0, 0, 0);
    rawEnd.setHours(23, 59, 59, 999);
    // Use Pakistan date range for ALL sources (sales, returns, COGS) so period is consistent
    const start = getStartOfDayPakistan(rawStart) || rawStart;
    const end = getEndOfDayPakistan(rawEnd) || rawEnd;

    // Sales revenue: use sales table as primary source so P&L matches Sale Invoice totals
    const fromSales = await this.getRevenueAndCOGSFromSales(rawStart, rawEnd);
    let salesRevenue = fromSales.revenue;
    let cogs = fromSales.cogs;

    // Sales returns and other income from ledger (not in sales table)
    const salesReturns = await this.calculateAccountRevenue('4100', start, end);
    const otherIncome = await this.calculateAccountRevenue('4200', start, end);

    // COGS: when sale returns exist, use net = sales COGS - return reversals.
    // Pure ledger COGS can be wrong when sale debits are in another period (date mismatch) or missing,
    // leaving only return credits → negative COGS. Hybrid formula avoids that.
    if (salesReturns > 0) {
      const returnCogsReversals = await this.getReturnCOGSReversals(start, end);
      cogs = Math.max(0, cogs - returnCogsReversals);
    } else if (cogs === 0) {
      cogs = await this.calculateCOGS(start, end);
    }

    const totalRevenue = salesRevenue - salesReturns + otherIncome;
    const grossProfit = totalRevenue - cogs;

    // Operating Expenses (breakdown by standard accounts)
    const salaries = await this.calculateAccountExpense('5200', start, end);
    const rent = await this.calculateAccountExpense('5300', start, end);
    const utilities = await this.calculateAccountExpense('5400', start, end);
    const depreciation = await this.calculateAccountExpense('5500', start, end);
    const otherOperating = await this.calculateAccountExpense('5100', start, end);
    const standardOperatingTotal = salaries + rent + utilities + depreciation + otherOperating;

    // Other Expenses (5600)
    const otherExpenses = await this.calculateOtherExpenses(start, end);

    // Total expenses from ALL expense accounts in ledger (so Record Expense impacts P&L)
    const totalExpensesFromLedger = await this.calculateTotalExpensesFromLedger(start, end);
    const otherExpenseAccounts = Math.max(0, totalExpensesFromLedger - standardOperatingTotal - otherExpenses);
    const totalOperatingExpenses = standardOperatingTotal + otherExpenseAccounts;

    // Net Income (uses full expense total so every recorded expense is included)
    const totalExpensesForNet = totalOperatingExpenses + otherExpenses;
    const netIncome = grossProfit - totalExpensesForNet;

    return {
      period: {
        startDate: start,
        endDate: end
      },
      returns: {
        salesReturns: salesReturns,
        totalReturns: salesReturns
      },
      revenue: {
        salesRevenue: salesRevenue,
        salesReturns: salesReturns,
        netSales: salesRevenue - salesReturns,
        otherIncome: otherIncome,
        total: totalRevenue
      },
      costOfGoodsSold: {
        total: cogs
      },
      grossProfit: grossProfit,
      operatingExpenses: {
        salaries: salaries,
        rent: rent,
        utilities: utilities,
        depreciation: depreciation,
        otherOperating: otherOperating,
        otherExpenseAccounts: otherExpenseAccounts,
        total: totalOperatingExpenses
      },
      otherExpenses: {
        total: otherExpenses
      },
      totalExpenses: totalExpensesForNet,
      netIncome: netIncome,
      generatedAt: new Date()
    };
  }

  /**
   * Calculate revenue for a specific account.
   * For Sales Revenue (4000), Other Income (4200): credit - debit (credits increase revenue).
   * For Sales Returns (4100) contra-revenue: debit - credit (debits = returns, we need positive amount to subtract).
   */
  async calculateAccountRevenue(accountCode, startDate, endDate) {
    const isContraRevenue = accountCode === '4100'; // Sales Returns
    const sign = isContraRevenue ? 'debit_amount - credit_amount' : 'credit_amount - debit_amount';
    const result = await query(
      `SELECT COALESCE(SUM(${sign}), 0) AS revenue
       FROM account_ledger
       WHERE account_code = $1
         AND transaction_date >= $2
         AND transaction_date <= $3
         AND status = 'completed'
         AND reversed_at IS NULL`,
      [accountCode, startDate, endDate]
    );
    return parseFloat(result.rows[0]?.revenue || 0);
  }

  /**
   * Calculate expense for a specific account
   */
  async calculateAccountExpense(accountCode, startDate, endDate) {
    const result = await query(
      `SELECT COALESCE(SUM(debit_amount - credit_amount), 0) AS expense
       FROM account_ledger
       WHERE account_code = $1
         AND transaction_date >= $2
         AND transaction_date <= $3
         AND status = 'completed'
         AND reversed_at IS NULL`,
      [accountCode, startDate, endDate]
    );
    return parseFloat(result.rows[0]?.expense || 0);
  }
}

module.exports = new PLCalculationService();
