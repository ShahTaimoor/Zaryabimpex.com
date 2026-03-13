const BudgetRepository = require('../repositories/BudgetRepository');

/**
 * Budget Comparison Service (Postgres)
 * Uses BudgetRepository for findBudgetForPeriod and getBudgetForCategory.
 */
class BudgetComparisonService {
  async compareExpensesWithBudget(actualExpenses, period) {
    const budget = await BudgetRepository.findBudgetForPeriod(
      period?.startDate ?? period?.start,
      period?.endDate ?? period?.end,
      'expense'
    );

    if (!budget) {
      return {
        hasBudget: false,
        message: 'No budget found for this period'
      };
    }

    const comparison = {
      hasBudget: true,
      budgetId: budget.budgetId ?? budget.id,
      budgetName: budget.name,
      period: budget.period || { startDate: budget.periodStart, endDate: budget.periodEnd },
      sellingExpenses: this.compareCategoryExpenses(
        actualExpenses.selling,
        budget,
        'selling'
      ),
      administrativeExpenses: this.compareCategoryExpenses(
        actualExpenses.administrative,
        budget,
        'administrative'
      ),
      totals: {
        actual: {
          selling: Object.values(actualExpenses.selling || {}).reduce((sum, val) => sum + val, 0),
          administrative: Object.values(actualExpenses.administrative || {}).reduce((sum, val) => sum + val, 0),
          total: 0
        },
        budget: {
          selling: budget.totals?.sellingExpenses ?? 0,
          administrative: budget.totals?.administrativeExpenses ?? 0,
          total: budget.totals?.totalExpenses ?? 0
        },
        variance: { selling: 0, administrative: 0, total: 0 },
        variancePercent: { selling: 0, administrative: 0, total: 0 }
      }
    };

    comparison.totals.actual.total = comparison.totals.actual.selling + comparison.totals.actual.administrative;
    comparison.totals.variance.selling = comparison.totals.actual.selling - comparison.totals.budget.selling;
    comparison.totals.variance.administrative = comparison.totals.actual.administrative - comparison.totals.budget.administrative;
    comparison.totals.variance.total = comparison.totals.actual.total - comparison.totals.budget.total;
    if (comparison.totals.budget.selling > 0) {
      comparison.totals.variancePercent.selling = (comparison.totals.variance.selling / comparison.totals.budget.selling) * 100;
    }
    if (comparison.totals.budget.administrative > 0) {
      comparison.totals.variancePercent.administrative = (comparison.totals.variance.administrative / comparison.totals.budget.administrative) * 100;
    }
    if (comparison.totals.budget.total > 0) {
      comparison.totals.variancePercent.total = (comparison.totals.variance.total / comparison.totals.budget.total) * 100;
    }

    return comparison;
  }

  compareCategoryExpenses(actualCategories, budget, expenseType) {
    const comparison = {};
    const allCategories = new Set(Object.keys(actualCategories || {}));
    if (budget && budget.items) {
      budget.items
        .filter(item => (item.expenseType || item.expense_type) === expenseType)
        .forEach(item => allCategories.add(item.category));
    }
    allCategories.forEach(category => {
      const actualAmount = (actualCategories || {})[category] || 0;
      const budgetAmount = BudgetRepository.getBudgetForCategory(budget, category, expenseType);
      const variance = actualAmount - budgetAmount;
      const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;
      comparison[category] = {
        actual: actualAmount,
        budget: budgetAmount,
        variance,
        variancePercent,
        status: this.getVarianceStatus(variancePercent)
      };
    });
    return comparison;
  }

  getVarianceStatus(variancePercent) {
    const threshold = 5;
    if (Math.abs(variancePercent) <= threshold) return 'on_target';
    if (variancePercent < 0) return 'favorable';
    return 'unfavorable';
  }

  async getBudgetComparisonForPL(plStatement) {
    const actualExpenses = { selling: {}, administrative: {} };
    if (plStatement?.operatingExpenses?.sellingExpenses?.details) {
      plStatement.operatingExpenses.sellingExpenses.details.forEach(detail => {
        actualExpenses.selling[detail.category] = detail.amount;
      });
    }
    if (plStatement?.operatingExpenses?.administrativeExpenses?.details) {
      plStatement.operatingExpenses.administrativeExpenses.details.forEach(detail => {
        actualExpenses.administrative[detail.category] = detail.amount;
      });
    }
    return this.compareExpensesWithBudget(actualExpenses, plStatement?.period || {});
  }

  addBudgetToExpenseDetails(expenseDetails, budget, expenseType) {
    if (!budget) return expenseDetails || [];
    return (expenseDetails || []).map(detail => {
      const budgetAmount = BudgetRepository.getBudgetForCategory(budget, detail.category, expenseType);
      const variance = (detail.amount || 0) - budgetAmount;
      const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;
      return {
        ...detail,
        budget: {
          amount: budgetAmount,
          variance,
          variancePercent,
          status: this.getVarianceStatus(variancePercent)
        }
      };
    });
  }
}

module.exports = new BudgetComparisonService();
