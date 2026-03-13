/**
 * Period Comparison Card Component
 * Displays metric with period-over-period comparison
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { formatPercentageChange } from '../utils/periodComparisons';

export const PeriodComparisonCard = ({
  title,
  currentValue,
  previousValue,
  format = 'currency', // 'currency', 'number', 'percentage'
  icon: Icon,
  iconColor = 'bg-blue-500',
  showTarget = false,
  targetValue = null,
  className = '',
  size = 'default' // 'default', 'large', 'small'
}) => {
  const percentageChange = previousValue !== 0 && previousValue !== null
    ? ((currentValue - previousValue) / previousValue) * 100
    : currentValue > 0 ? 100 : 0;

  const formattedChange = formatPercentageChange(percentageChange);
  const isPositive = percentageChange >= 0;
  const isNegative = percentageChange < 0;
  const isNeutral = percentageChange === 0;

  // Format value based on type
  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return formatNumber(value);
      default:
        return value.toString();
    }
  };

  // Calculate target achievement
  const targetAchievement = targetValue && targetValue > 0
    ? (currentValue / targetValue) * 100
    : null;

  const sizeClasses = {
    default: {
      icon: 'h-6 w-6',
      value: 'text-2xl',
      title: 'text-sm',
      change: 'text-sm'
    },
    large: {
      icon: 'h-8 w-8',
      value: 'text-3xl',
      title: 'text-base',
      change: 'text-base'
    },
    small: {
      icon: 'h-5 w-5',
      value: 'text-xl',
      title: 'text-xs',
      change: 'text-xs'
    }
  };

  const classes = sizeClasses[size] || sizeClasses.default;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {Icon && (
            <div className={`${iconColor} p-2`}>
              <Icon className={`${classes.icon} text-white`} />
            </div>
          )}
          <div>
            <h3 className={`${classes.title} font-medium text-gray-700`}>{title}</h3>
            {showTarget && targetValue && (
              <p className="text-xs text-gray-500 mt-0.5">
                Target: {formatValue(targetValue)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {/* Current Value */}
        <div>
          <p className={`${classes.value} font-semibold text-gray-900`}>
            {formatValue(currentValue)}
          </p>
        </div>

        {/* Comparison */}
        <div className="flex items-center space-x-2">
          {isPositive && (
            <TrendingUp className="h-4 w-4 text-green-600" />
          )}
          {isNegative && (
            <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M3 8c1.5 0 2.5 1 2.5 2.5S4.5 13 3 13m4 0c1.5 0 2.5 1 2.5 2.5S8.5 18 7 18m4 0c1.5 0 2.5 1 2.5 2.5S12.5 23 11 23" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18 20l-2.5-2.5m2.5 2.5l-2.5 2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {isNeutral && (
            <Minus className="h-4 w-4 text-gray-400" />
          )}
          
          <span className={`${classes.change} font-medium ${formattedChange.color}`}>
            {formattedChange.value}
          </span>
          
          <span className={`${classes.change} text-gray-500`}>
            vs previous period
          </span>
        </div>

        {/* Previous Value */}
        {previousValue !== null && previousValue !== undefined && (
          <p className={`${classes.change} text-gray-500`}>
            Previous: {formatValue(previousValue)}
          </p>
        )}

        {/* Target Achievement */}
        {showTarget && targetAchievement !== null && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Target Achievement</span>
              <span className={`text-xs font-medium ${
                targetAchievement >= 100 ? 'text-green-600' :
                targetAchievement >= 80 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {targetAchievement.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  targetAchievement >= 100 ? 'bg-green-500' :
                  targetAchievement >= 80 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(targetAchievement, 100)}%` }}
              />
            </div>
            {targetAchievement < 100 && (
              <p className="text-xs text-gray-500 mt-1">
                {formatValue(targetValue - currentValue)} remaining to reach target
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PeriodComparisonCard;

