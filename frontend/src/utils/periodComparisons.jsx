/**
 * Period Comparison Utilities
 * Calculate date ranges for period-over-period comparisons
 */

/**
 * Get date range for current month
 */
export const getCurrentMonth = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    startDate: start,
    endDate: end
  };
};

/**
 * Get date range for last month
 */
export const getLastMonth = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    startDate: start,
    endDate: end
  };
};

/**
 * Get date range for current year
 */
export const getCurrentYear = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    startDate: start,
    endDate: end
  };
};

/**
 * Get date range for last year
 */
export const getLastYear = () => {
  const now = new Date();
  const start = new Date(now.getFullYear() - 1, 0, 1);
  const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    startDate: start,
    endDate: end
  };
};

/**
 * Get date range for current quarter
 */
export const getCurrentQuarter = () => {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    startDate: start,
    endDate: end
  };
};

/**
 * Get date range for last quarter
 */
export const getLastQuarter = () => {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const prevQuarter = quarter === 0 ? 3 : quarter - 1;
  const year = quarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const start = new Date(year, prevQuarter * 3, 1);
  const end = new Date(year, (prevQuarter + 1) * 3, 0, 23, 59, 59, 999);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    startDate: start,
    endDate: end
  };
};

/**
 * Get date range for last N days
 */
export const getLastNDays = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    startDate: start,
    endDate: end
  };
};

/**
 * Get previous period for a given date range
 */
export const getPreviousPeriod = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - diffDays);
  
  return {
    start: prevStart.toISOString().split('T')[0],
    end: prevEnd.toISOString().split('T')[0],
    startDate: prevStart,
    endDate: prevEnd
  };
};

/**
 * Calculate percentage change between two values
 */
export const calculatePercentageChange = (current, previous) => {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
};

/**
 * Calculate absolute change between two values
 */
export const calculateAbsoluteChange = (current, previous) => {
  return current - previous;
};

/**
 * Format percentage change for display
 */
export const formatPercentageChange = (percentage, options = {}) => {
  const { showSign = true, decimals = 1, showColor = true } = options;
  const sign = percentage >= 0 ? '+' : '';
  const formatted = `${showSign ? sign : ''}${percentage.toFixed(decimals)}%`;
  
  if (showColor) {
    return {
      value: formatted,
      isPositive: percentage >= 0,
      isNegative: percentage < 0,
      color: percentage >= 0 ? 'text-green-600' : 'text-red-600'
    };
  }
  
  return formatted;
};

/**
 * Compare two periods and return comparison data
 */
export const comparePeriods = (currentData, previousData) => {
  const current = currentData || 0;
  const previous = previousData || 0;
  
  const absoluteChange = calculateAbsoluteChange(current, previous);
  const percentageChange = calculatePercentageChange(current, previous);
  const formattedChange = formatPercentageChange(percentageChange);
  
  return {
    current,
    previous,
    absoluteChange,
    percentageChange,
    formattedChange,
    isPositive: percentageChange >= 0,
    isNegative: percentageChange < 0,
    trend: percentageChange >= 0 ? 'up' : 'down'
  };
};

/**
 * Get period label for display
 */
export const getPeriodLabel = (periodType, date = new Date()) => {
  const labels = {
    'current-month': () => {
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    },
    'last-month': () => {
      const lastMonth = new Date(date.getFullYear(), date.getMonth() - 1);
      return lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    },
    'current-year': () => {
      return date.getFullYear().toString();
    },
    'last-year': () => {
      return (date.getFullYear() - 1).toString();
    },
    'current-quarter': () => {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `Q${quarter} ${date.getFullYear()}`;
    },
    'last-quarter': () => {
      const quarter = Math.floor(date.getMonth() / 3);
      const prevQuarter = quarter === 0 ? 4 : quarter;
      const year = quarter === 0 ? date.getFullYear() - 1 : date.getFullYear();
      return `Q${prevQuarter} ${year}`;
    },
    'custom': (start, end) => {
      return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
    }
  };
  
  if (labels[periodType]) {
    return labels[periodType]();
  }
  
  return periodType;
};

export default {
  getCurrentMonth,
  getLastMonth,
  getCurrentYear,
  getLastYear,
  getCurrentQuarter,
  getLastQuarter,
  getLastNDays,
  getPreviousPeriod,
  calculatePercentageChange,
  calculateAbsoluteChange,
  formatPercentageChange,
  comparePeriods,
  getPeriodLabel
};

