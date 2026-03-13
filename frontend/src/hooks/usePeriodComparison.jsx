/**
 * Period Comparison Hook
 * Fetches and compares data between two periods
 */

import { useQuery } from 'react-query';
import { useState, useMemo } from 'react';
import {
  getCurrentMonth,
  getLastMonth,
  getCurrentYear,
  getLastYear,
  getCurrentQuarter,
  getLastQuarter,
  getPreviousPeriod,
  comparePeriods
} from '../utils/periodComparisons';

export const usePeriodComparison = (fetchFunction, periodType = 'month', customRange = null) => {
  const [comparisonPeriod, setComparisonPeriod] = useState(periodType);

  // Get date ranges based on period type
  const getDateRanges = () => {
    switch (comparisonPeriod) {
      case 'month':
        return {
          current: getCurrentMonth(),
          previous: getLastMonth()
        };
      case 'year':
        return {
          current: getCurrentYear(),
          previous: getLastYear()
        };
      case 'quarter':
        return {
          current: getCurrentQuarter(),
          previous: getLastQuarter()
        };
      case 'custom':
        if (customRange) {
          return {
            current: {
              start: customRange.start,
              end: customRange.end,
              startDate: new Date(customRange.start),
              endDate: new Date(customRange.end)
            },
            previous: getPreviousPeriod(customRange.start, customRange.end)
          };
        }
        return {
          current: getCurrentMonth(),
          previous: getLastMonth()
        };
      default:
        return {
          current: getCurrentMonth(),
          previous: getLastMonth()
        };
    }
  };

  const dateRanges = useMemo(() => getDateRanges(), [comparisonPeriod, customRange]);

  // Fetch current period data
  const { data: currentData, isLoading: currentLoading, error: currentError } = useQuery(
    ['periodComparison', 'current', comparisonPeriod, dateRanges.current.start, dateRanges.current.end],
    () => fetchFunction({
      dateFrom: dateRanges.current.start,
      dateTo: dateRanges.current.end
    }),
    {
      enabled: !!fetchFunction,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  );

  // Fetch previous period data
  const { data: previousData, isLoading: previousLoading, error: previousError } = useQuery(
    ['periodComparison', 'previous', comparisonPeriod, dateRanges.previous.start, dateRanges.previous.end],
    () => fetchFunction({
      dateFrom: dateRanges.previous.start,
      dateTo: dateRanges.previous.end
    }),
    {
      enabled: !!fetchFunction,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  );

  // Extract values from data (assuming data structure)
  const extractValue = (data, field = 'total') => {
    if (!data) return 0;
    if (typeof data === 'number') return data;
    // Handle API response structure: { data: { data: { totalRevenue: ... } } }
    if (data.data) {
      if (typeof data.data === 'number') return data.data;
      if (data.data.data && typeof data.data.data === 'number') return data.data.data;
      if (data.data.data && data.data.data[field]) return data.data.data[field];
      if (data.data[field]) return data.data[field];
      if (data.data.summary && data.data.summary[field]) return data.data.summary[field];
    }
    if (data[field]) return data[field];
    if (data.summary && data.summary[field]) return data.summary[field];
    return 0;
  };

  const currentValue = useMemo(() => extractValue(currentData), [currentData]);
  const previousValue = useMemo(() => extractValue(previousData), [previousData]);

  // Calculate comparison
  const comparison = useMemo(() => {
    return comparePeriods(currentValue, previousValue);
  }, [currentValue, previousValue]);

  return {
    // Data
    currentData,
    previousData,
    currentValue,
    previousValue,
    
    // Date ranges
    currentPeriod: dateRanges.current,
    previousPeriod: dateRanges.previous,
    
    // Comparison
    comparison,
    
    // Loading states
    isLoading: currentLoading || previousLoading,
    currentLoading,
    previousLoading,
    
    // Errors
    error: currentError || previousError,
    currentError,
    previousError,
    
    // Controls
    comparisonPeriod,
    setComparisonPeriod
  };
};

export default usePeriodComparison;

