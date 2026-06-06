const { query } = require('../config/postgres');
const { getSystemAccountCodes } = require('../config/basicAccounts');
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
   * Calculate revenue for a period from Sales Revenue account
   */
  async calculateRevenue(startDate, endDate) {
    const { salesRevenue } = getSystemAccountCodes();
    const result = await query(
      `SELECT COALESCE(SUM(credit_amount - debit_amount), 0) AS revenue
       FROM account_ledger
       WHERE account_code = $1
         AND transaction_date >= $2
         AND transaction_date <= $3
         AND status = 'completed'
         AND reversed_at IS NULL`,
      [salesRevenue, startDate, endDate]
    );
    return parseFloat(result.rows[0]?.revenue || 0);
  }

  /**
   * Get COGS reversals (credits to COGS) from Sale Return entries in the period.
   */
  async getReturnCOGSReversals(startDate, endDate) {
    const { costOfGoodsSold } = getSystemAccountCodes();
    const result = await query(
      `SELECT COALESCE(SUM(credit_amount), 0) AS reversals
       FROM account_ledger
       WHERE account_code = $1
         AND reference_type IN ('Sale Return', 'return')
         AND transaction_date >= $2
         AND transaction_date <= $3
         AND status = 'completed'
         AND reversed_at IS NULL`,
      [costOfGoodsSold, startDate, endDate]
    );
    return parseFloat(result.rows[0]?.reversals || 0);
  }

  /**
   * Calculate cost of goods sold for a period
   */
  async calculateCOGS(startDate, endDate) {
    const { costOfGoodsSold } = getSystemAccountCodes();
    const result = await query(
      `SELECT COALESCE(SUM(al.debit_amount - al.credit_amount), 0) AS cogs
       FROM account_ledger al
       WHERE al.account_code = $1
         AND al.transaction_date >= $2
         AND al.transaction_date <= $3
         AND al.status = 'completed'
         AND al.reversed_at IS NULL
         AND NOT (al.reference_type = 'sale' AND al.reference_id::text IN (SELECT id::text FROM sales WHERE deleted_at IS NOT NULL))`,
      [costOfGoodsSold, startDate, endDate]
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
   * Get all expense account codes from chart of accounts (excluding COGS).
   */
  async getExpenseAccountCodes() {
    const { costOfGoodsSold } = getSystemAccountCodes();
    const result = await query(
      `SELECT account_code FROM chart_of_accounts
       WHERE account_type = 'expense' AND account_code != $1
         AND deleted_at IS NULL AND is_active = TRUE`,
      [costOfGoodsSold]
    );
    return (result.rows || []).map((r) => r.account_code);
  }

  /**
   * Calculate total expenses from ledger for ALL active expense-type accounts in period.
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
   * Calculate net income (includes user-added expense accounts; core chart has COGS only).
   */
  async calculateNetIncome(startDate, endDate) {
    const fromSales = await this.getRevenueAndCOGSFromSales(startDate, endDate);
    let salesRevenue = fromSales.revenue;
    let cogs = fromSales.cogs;
    const salesReturns = await this.calculateReturnRevenue(startDate, endDate);
    const totalRevenue = salesRevenue - salesReturns;
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
   */
  async generatePLStatement(startDate, endDate) {
    const rawStart = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const rawEnd = endDate ? new Date(endDate) : new Date();
    rawStart.setHours(0, 0, 0, 0);
    rawEnd.setHours(23, 59, 59, 999);
    const start = getStartOfDayPakistan(rawStart) || rawStart;
    const end = getEndOfDayPakistan(rawEnd) || rawEnd;

    const fromSales = await this.getRevenueAndCOGSFromSales(rawStart, rawEnd);
    let salesRevenue = fromSales.revenue;
    let cogs = fromSales.cogs;

    const salesReturns = await this.calculateReturnRevenue(start, end);

    if (salesReturns > 0) {
      const returnCogsReversals = await this.getReturnCOGSReversals(start, end);
      cogs = Math.max(0, cogs - returnCogsReversals);
    } else if (cogs === 0) {
      cogs = await this.calculateCOGS(start, end);
    }

    const totalRevenue = salesRevenue - salesReturns;
    const grossProfit = totalRevenue - cogs;
    const totalOperatingExpenses = await this.calculateTotalExpensesFromLedger(start, end);
    const netIncome = grossProfit - totalOperatingExpenses;

    return {
      period: {
        startDate: start,
        endDate: end
      },
      returns: {
        salesReturns,
        totalReturns: salesReturns
      },
      revenue: {
        salesRevenue,
        salesReturns,
        netSales: salesRevenue - salesReturns,
        otherIncome: 0,
        total: totalRevenue
      },
      costOfGoodsSold: {
        total: cogs
      },
      grossProfit,
      operatingExpenses: {
        salaries: 0,
        rent: 0,
        utilities: 0,
        depreciation: 0,
        otherOperating: totalOperatingExpenses,
        otherExpenseAccounts: 0,
        total: totalOperatingExpenses
      },
      otherExpenses: {
        total: 0
      },
      totalExpenses: totalOperatingExpenses,
      netIncome,
      generatedAt: new Date()
    };
  }

  /**
   * Sale return amounts posted to revenue accounts (debit reduces net sales).
   */
  async calculateReturnRevenue(startDate, endDate) {
    const result = await query(
      `SELECT COALESCE(SUM(al.debit_amount - al.credit_amount), 0) AS returns
       FROM account_ledger al
       JOIN chart_of_accounts coa ON UPPER(coa.account_code) = UPPER(al.account_code)
       WHERE coa.account_type = 'revenue'
         AND al.reference_type IN ('Sale Return', 'return')
         AND al.transaction_date >= $1
         AND al.transaction_date <= $2
         AND al.status = 'completed'
         AND al.reversed_at IS NULL`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0]?.returns || 0);
  }

  /**
   * Calculate revenue for a specific account (credit - debit).
   */
  async calculateAccountRevenue(accountCode, startDate, endDate) {
    const result = await query(
      `SELECT COALESCE(SUM(credit_amount - debit_amount), 0) AS revenue
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
