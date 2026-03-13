const { query } = require('../../config/postgres');

function toCamel(row) {
  if (!row) return null;
  const items = row.items || [];
  return {
    id: row.id,
    budgetId: row.budget_id,
    name: row.name,
    description: row.description,
    period: {
      startDate: row.period_start,
      endDate: row.period_end,
      type: row.period_type
    },
    periodStart: row.period_start,
    periodEnd: row.period_end,
    periodType: row.period_type,
    budgetType: row.budget_type,
    items: Array.isArray(items) ? items : (typeof items === 'string' ? (() => { try { return JSON.parse(items); } catch (_) { return []; } })() : []),
    totals: {
      sellingExpenses: parseFloat(row.totals_selling_expenses) || 0,
      administrativeExpenses: parseFloat(row.totals_administrative_expenses) || 0,
      totalExpenses: parseFloat(row.totals_total_expenses) || 0,
      totalRevenue: parseFloat(row.totals_total_revenue) || 0
    },
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class BudgetRepository {
  async findBudgetForPeriod(startDate, endDate, budgetType = 'expense') {
    const start = startDate instanceof Date ? startDate.toISOString().slice(0, 10) : startDate;
    const end = endDate instanceof Date ? endDate.toISOString().slice(0, 10) : endDate;
    const result = await query(
      `SELECT * FROM budgets
       WHERE budget_type = $1 AND status IN ('approved', 'active')
         AND period_start <= $2 AND period_end >= $3
       ORDER BY period_start DESC LIMIT 1`,
      [budgetType, end, start]
    );
    return toCamel(result.rows[0] || null);
  }

  getBudgetForCategory(budgetRow, category, expenseType = null) {
    const items = budgetRow?.items || [];
    const filtered = items.filter(item => {
      if (expenseType) return item.category === category && item.expenseType === expenseType;
      return item.category === category;
    });
    return filtered.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0);
  }

  async findById(id) {
    const result = await query('SELECT * FROM budgets WHERE id = $1', [id]);
    return toCamel(result.rows[0] || null);
  }

  async create(data) {
    const items = data.items || [];
    const selling = items.filter(i => (i.expenseType || i.expense_type) === 'selling').reduce((s, i) => s + (i.budgetedAmount ?? i.budgeted_amount ?? 0), 0);
    const administrative = items.filter(i => (i.expenseType || i.expense_type) === 'administrative').reduce((s, i) => s + (i.budgetedAmount ?? i.budgeted_amount ?? 0), 0);
    const totalExpenses = selling + administrative;

    const result = await query(
      `INSERT INTO budgets (budget_id, name, description, period_start, period_end, period_type, budget_type, items,
        totals_selling_expenses, totals_administrative_expenses, totals_total_expenses, totals_total_revenue, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        data.budgetId ?? data.budget_id ?? null,
        data.name,
        data.description ?? null,
        data.periodStart ?? data.period?.startDate ?? data.period_start,
        data.periodEnd ?? data.period?.endDate ?? data.period_end,
        data.periodType ?? data.period?.type ?? data.period_type ?? 'monthly',
        data.budgetType ?? data.budget_type ?? 'expense',
        JSON.stringify(items),
        selling,
        administrative,
        totalExpenses,
        data.totals?.totalRevenue ?? 0,
        data.status ?? 'draft',
        data.createdBy ?? data.created_by
      ]
    );
    return toCamel(result.rows[0]);
  }
}

module.exports = new BudgetRepository();
