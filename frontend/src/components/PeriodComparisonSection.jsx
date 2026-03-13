/**
 * Period Comparison Section Component
 * Complete section for period-over-period comparisons with Recharts
 */

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { BarChart3 } from 'lucide-react';
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

  const currentLabel = getPeriodLabel(periodType === 'custom' ? 'custom' : `current-${periodType}`, new Date());
  const previousLabel = getPeriodLabel(periodType === 'custom' ? 'custom' : `last-${periodType}`, new Date());

  // Combined chart data: one row per metric with current & previous
  const combinedChartData = comparisons.length > 0
    ? comparisons.map((c) => ({
        metric: c.title.replace('Total ', '').replace(' ', '\n'),
        current: c.currentValue,
        previous: c.previousValue
      }))
    : [];

  return (
    <div className={`space-y-5 ${className}`}>
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
              if (value !== 'custom') setCustomRange(null);
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
        <div className="text-xs sm:text-sm text-gray-600 flex items-center flex-wrap gap-x-2">
          <span><strong>Current:</strong> {currentLabel}</span>
          <span>vs</span>
          <span><strong>Previous:</strong> {previousLabel}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* Summary cards */}
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

          {/* Combined overview chart */}
          {combinedChartData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance overview</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={combinedChartData}
                  margin={{ top: 8, right: 16, left: 8, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="metric"
                    tick={{ fontSize: 11 }}
                    stroke="#6b7280"
                    interval={0}
                    textAnchor="middle"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" width={48} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value) => [Number(value).toLocaleString(), '']}
                    labelFormatter={(label) => label.replace(/\n/g, ' ')}
                  />
                  <Legend />
                  <Bar dataKey="previous" name={previousLabel} fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="current" name={currentLabel} fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Individual comparison charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {comparisons.slice(0, 4).map((comparison, index) => (
              <ComparisonChart
                key={index}
                title={comparison.title}
                currentPeriod={comparison.currentValue}
                previousPeriod={comparison.previousValue}
                currentLabel={currentLabel}
                previousLabel={previousLabel}
                format={comparison.format || 'currency'}
                height={200}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PeriodComparisonSection;

