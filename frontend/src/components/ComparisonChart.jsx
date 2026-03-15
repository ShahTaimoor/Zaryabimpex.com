/**
 * Comparison Chart Component
 * Visual comparison between two periods
 */

import React from 'react';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

export const ComparisonChart = ({
  title,
  currentPeriod,
  previousPeriod,
  currentLabel = 'Current',
  previousLabel = 'Previous',
  format = 'currency',
  height = 200,
  showTrend = true,
  className = ''
}) => {
  const formatValue = (value) => {
    if (value === null || value === undefined) return '0';
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return new Intl.NumberFormat('en-US').format(value);
      default:
        return value.toString();
    }
  };

  const maxValue = Math.max(currentPeriod || 0, previousPeriod || 0);
  const currentHeight = maxValue > 0 ? ((currentPeriod || 0) / maxValue) * 100 : 0;
  const previousHeight = maxValue > 0 ? ((previousPeriod || 0) / maxValue) * 100 : 0;

  const percentageChange = previousPeriod !== 0 && previousPeriod !== null
    ? ((currentPeriod - previousPeriod) / previousPeriod) * 100
    : currentPeriod > 0 ? 100 : 0;

  const isPositive = percentageChange >= 0;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        {showTrend && (
          <div className={`flex items-center space-x-1 ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className="text-xs font-medium">
              {isPositive ? '+' : ''}{percentageChange.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Chart Bars */}
        <div className="flex items-end space-x-4" style={{ height: `${height}px` }}>
          {/* Previous Period */}
          <div className="flex-1 flex flex-col items-center">
            <div className="w-full flex flex-col items-center justify-end" style={{ height: '100%' }}>
              <div
                className="w-full bg-gray-300 rounded-t transition-all duration-500 hover:opacity-80"
                style={{ height: `${previousHeight}%`, minHeight: previousHeight > 0 ? '4px' : '0' }}
              />
            </div>
            <div className="mt-2 text-center">
              <p className="text-xs text-gray-500">{previousLabel}</p>
              <p className="text-sm font-semibold text-gray-700 mt-1">
                {formatValue(previousPeriod)}
              </p>
            </div>
          </div>

          {/* Current Period */}
          <div className="flex-1 flex flex-col items-center">
            <div className="w-full flex flex-col items-center justify-end" style={{ height: '100%' }}>
              <div
                className={`w-full rounded-t transition-all duration-500 hover:opacity-80 ${
                  isPositive ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ height: `${currentHeight}%`, minHeight: currentHeight > 0 ? '4px' : '0' }}
              />
            </div>
            <div className="mt-2 text-center">
              <p className="text-xs text-gray-500">{currentLabel}</p>
              <p className="text-sm font-semibold text-gray-700 mt-1">
                {formatValue(currentPeriod)}
              </p>
            </div>
          </div>
        </div>

        {/* Comparison Summary */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Change</span>
            <span className={`text-sm font-semibold ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPositive ? '+' : ''}{formatValue(currentPeriod - previousPeriod)} ({isPositive ? '+' : ''}{percentageChange.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonChart;

