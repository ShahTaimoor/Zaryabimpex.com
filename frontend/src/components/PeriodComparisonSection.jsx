/**
 * Period Comparison Section Component
 * Complete section for period-over-period comparisons
 */

import React, { useState } from 'react';
import { BarChart3, TrendingUp, Calendar } from 'lucide-react';
import PeriodSelector from './PeriodSelector';
import PeriodComparisonCard from './PeriodComparisonCard';
import ComparisonChart from './ComparisonChart';
import { usePeriodComparison } from '../hooks/usePeriodComparison';
import { getPeriodLabel } from '../utils/periodComparisons';

export const PeriodComparisonSection = ({
  title = 'Period Comparison',
  metrics = [],
  fetchFunction,
  className = ''
}) => {
  const [periodType, setPeriodType] = useState('month');
  const [customRange, setCustomRange] = useState(null);

  // Use period comparison hook - fetch once for all metrics
  const mainComparison = usePeriodComparison(
    fetchFunction || (metrics[0]?.fetchFunction),
    periodType,
    customRange
  );

  // Extract values for each metric from the fetched data
  const extractValue = (data, field) => {
    if (!data) return 0;
    if (data.data?.data?.[field] !== undefined) return data.data.data[field];
    if (data.data?.[field] !== undefined) return data.data[field];
    if (data[field] !== undefined) return data[field];
    return 0;
  };

  // Field mapping for common metrics
  const fieldMap = {
    'Total Revenue': 'totalRevenue',
    'Total Orders': 'totalOrders',
    'Average Order Value': 'averageOrderValue',
    'Total Items Sold': 'totalItems',
    'Net Revenue': 'netRevenue',
    'Total Discounts': 'totalDiscounts'
  };

  const comparisons = metrics.map(metric => {
    const field = fieldMap[metric.title] || 'total';
    const currentValue = extractValue(mainComparison.currentData, field);
    const previousValue = extractValue(mainComparison.previousData, field);
    
    const percentageChange = previousValue !== 0 && previousValue !== null
      ? ((currentValue - previousValue) / previousValue) * 100
      : currentValue > 0 ? 100 : 0;

    return {
      ...metric,
      currentValue,
      previousValue,
      percentageChange,
      comparison: {
        current: currentValue,
        previous: previousValue,
        percentageChange,
        absoluteChange: currentValue - previousValue
      }
    };
  });

  const isLoading = mainComparison.isLoading;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        
        <div className="w-full sm:w-auto">
          <PeriodSelector
            value={periodType}
            onChange={(value) => {
              setPeriodType(value);
              if (value !== 'custom') {
                setCustomRange(null);
              }
            }}
            showCustomDatePicker={periodType === 'custom'}
            customStartDate={customRange?.start}
            customEndDate={customRange?.end}
            onCustomDateChange={setCustomRange}
          />
        </div>
      </div>

      {/* Period Labels */}
      {!isLoading && comparisons.length > 0 && (
        <div className="text-xs sm:text-sm text-gray-600 flex items-center flex-wrap">
          <span>
            <strong>Current:</strong> {getPeriodLabel(periodType === 'custom' ? 'custom' : `current-${periodType}`, new Date())}
          </span>
          <span className="mx-2">vs</span>
          <span>
            <strong>Previous:</strong> {getPeriodLabel(periodType === 'custom' ? 'custom' : `last-${periodType}`, new Date())}
          </span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}

      {/* Comparison Cards */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {comparisons.map((comparison, index) => (
            <PeriodComparisonCard
              key={index}
              title={comparison.title}
              currentValue={comparison.currentValue}
              previousValue={comparison.previousValue}
              targetValue={comparison.targetValue}
              format={comparison.format || 'currency'}
              icon={comparison.icon}
              iconColor={comparison.iconColor}
              showTarget={comparison.showTarget}
            />
          ))}
        </div>
      )}

      {/* Comparison Charts */}
      {!isLoading && comparisons.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {comparisons.slice(0, 4).map((comparison, index) => (
            <ComparisonChart
              key={index}
              title={comparison.title}
              currentPeriod={comparison.currentValue}
              previousPeriod={comparison.previousValue}
              currentLabel={getPeriodLabel(periodType === 'custom' ? 'custom' : `current-${periodType}`, new Date())}
              previousLabel={getPeriodLabel(periodType === 'custom' ? 'custom' : `last-${periodType}`, new Date())}
              format={comparison.format || 'currency'}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PeriodComparisonSection;

