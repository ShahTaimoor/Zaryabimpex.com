/**
 * Budget Comparison Service
 * 
 * This service provides budget vs actual comparison for expenses
 * and calculates variances for P&L reporting.
 */

const Budget = require('../models/Budget');
const FinancialStatement = require('../models/FinancialStatement');

class BudgetComparisonService {
  /**
   * Compare actual expenses with budget
   * @param {Object} actualExpenses - Actual expense data from P&L
   * @param {Object} period - Period object with startDate and endDate
   * @returns {Object} - Budget comparison data
   */
  async compareExpensesWithBudget(actualExpenses, period) {
    // Find budget for the period
    const budget = await Budget.findBudgetForPeriod(period.startDate, period.endDate, 'expense');
    
    if (!budget) {
      return {
        hasBudget: false,
        message: 'No budget found for this period'
      };
    }

    const comparison = {
      hasBudget: true,
      budgetId: budget.budgetId,
      budgetName: budget.name,
      period: budget.period,
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
          selling: Object.values(actualExpenses.selling).reduce((sum, val) => sum + val, 0),
          administrative: Object.values(actualExpenses.administrative).reduce((sum, val) => sum + val, 0),
          total: 0
        },
        budget: {
          selling: budget.totals.sellingExpenses,
          administrative: budget.totals.administrativeExpenses,
          total: budget.totals.totalExpenses
        },
        variance: {
          selling: 0,
          administrative: 0,
          total: 0
        },
        variancePercent: {
          selling: 0,
          administrative: 0,
          total: 0
        }
      }
    };

    // Calculate totals
    comparison.totals.actual.total = 
      comparison.totals.actual.selling + comparison.totals.actual.administrative;
    
    comparison.totals.variance.selling = 
      comparison.totals.actual.selling - comparison.totals.budget.selling;
    comparison.totals.variance.administrative = 
      comparison.totals.actual.administrative - comparison.totals.budget.administrative;
    comparison.totals.variance.total = 
      comparison.totals.actual.total - comparison.totals.budget.total;

    // Calculate variance percentages
    if (comparison.totals.budget.selling > 0) {
      comparison.totals.variancePercent.selling = 
        (comparison.totals.variance.selling / comparison.totals.budget.selling) * 100;
    }
    if (comparison.totals.budget.administrative > 0) {
      comparison.totals.variancePercent.administrative = 
        (comparison.totals.variance.administrative / comparison.totals.budget.administrative) * 100;
    }
    if (comparison.totals.budget.total > 0) {
      comparison.totals.variancePercent.total = 
        (comparison.totals.variance.total / comparison.totals.budget.total) * 100;
    }

    return comparison;
  }

  /**
   * Compare category expenses with budget
   * @param {Object} actualCategories - Actual expenses by category
   * @param {Object} budget - Budget document
   * @param {string} expenseType - 'selling' or 'administrative'
   * @returns {Object} - Category comparison data
   */
  compareCategoryExpenses(actualCategories, budget, expenseType) {
    const comparison = {};
    
    // Get all unique categories from actual expenses
    const allCategories = new Set(Object.keys(actualCategories));
    
    // Add categories from budget
    budget.items
      .filter(item => item.expenseType === expenseType)
      .forEach(item => allCategories.add(item.category));

    // Compare each category
    allCategories.forEach(category => {
      const actualAmount = actualCategories[category] || 0;
      const budgetAmount = budget.getBudgetForCategory(category, expenseType);
      const variance = actualAmount - budgetAmount;
      const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

      comparison[category] = {
        actual: actualAmount,
        budget: budgetAmount,
        variance: variance,
        variancePercent: variancePercent,
        status: this.getVarianceStatus(variancePercent)
      };
    });

    return comparison;
  }

  /**
   * Get variance status based on percentage
   * @param {number} variancePercent - Variance percentage
   * @returns {string} - 'favorable', 'unfavorable', or 'on_target'
   */
  getVarianceStatus(variancePercent) {
    const threshold = 5; // 5% threshold
    
    if (Math.abs(variancePercent) <= threshold) {
      return 'on_target';
    } else if (variancePercent < 0) {
      return 'favorable'; // Under budget (spent less)
    } else {
      return 'unfavorable'; // Over budget (spent more)
    }
  }

  /**
   * Get budget comparison for P&L statement
   * @param {Object} plStatement - P&L statement document
   * @returns {Object} - Budget comparison data
   */
  async getBudgetComparisonForPL(plStatement) {
    const actualExpenses = {
      selling: {},
      administrative: {}
    };

    // Extract actual expenses from P&L statement
    if (plStatement.operatingExpenses?.sellingExpenses?.details) {
      plStatement.operatingExpenses.sellingExpenses.details.forEach(detail => {
        actualExpenses.selling[detail.category] = detail.amount;
      });
    }

    if (plStatement.operatingExpenses?.administrativeExpenses?.details) {
      plStatement.operatingExpenses.administrativeExpenses.details.forEach(detail => {
        actualExpenses.administrative[detail.category] = detail.amount;
      });
    }

    return await this.compareExpensesWithBudget(actualExpenses, plStatement.period);
  }

  /**
   * Add budget comparison to expense details
   * @param {Array} expenseDetails - Expense transaction details
   * @param {Object} budget - Budget document
   * @param {string} expenseType - 'selling' or 'administrative'
   * @returns {Array} - Expense details with budget comparison
   */
  addBudgetToExpenseDetails(expenseDetails, budget, expenseType) {
    if (!budget) return expenseDetails;

    return expenseDetails.map(detail => {
      const budgetAmount = budget.getBudgetForCategory(detail.category, expenseType);
      const variance = detail.amount - budgetAmount;
      const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

      return {
        ...detail,
        budget: {
          amount: budgetAmount,
          variance: variance,
          variancePercent: variancePercent,
          status: this.getVarianceStatus(variancePercent)
        }
      };
    });
  }
}

module.exports = new BudgetComparisonService();

