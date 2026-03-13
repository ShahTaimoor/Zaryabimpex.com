/**
 * Target Benchmark Component
 * Compare performance against targets
 */

import React from 'react';
import { Target, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/formatters';

export const TargetBenchmark = ({
  title,
  currentValue,
  targetValue,
  format = 'currency',
  period = 'month',
  className = ''
}) => {
  if (!targetValue || targetValue === 0) {
    return null;
  }

  const achievement = (currentValue / targetValue) * 100;
  const remaining = Math.max(0, targetValue - currentValue);
  const isAchieved = achievement >= 100;
  const isClose = achievement >= 80 && achievement < 100;
  const isFar = achievement < 80;

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

  const getStatusColor = () => {
    if (isAchieved) return 'text-green-600 bg-green-50 border-green-200';
    if (isClose) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getStatusIcon = () => {
    if (isAchieved) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (isClose) return <TrendingUp className="h-5 w-5 text-yellow-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Target className="h-5 w-5 text-gray-600" />
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        </div>
        <span className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor()}`}>
          {achievement.toFixed(1)}%
        </span>
      </div>

      <div className="space-y-3">
        {/* Current vs Target */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Current</p>
            <p className="text-lg font-semibold text-gray-900">{formatValue(currentValue)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Target</p>
            <p className="text-lg font-semibold text-gray-700">{formatValue(targetValue)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                isAchieved ? 'bg-green-500' :
                isClose ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.min(achievement, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Progress</span>
            <span className={`font-medium ${
              isAchieved ? 'text-green-600' :
              isClose ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {achievement.toFixed(1)}% of target
            </span>
          </div>
        </div>

        {/* Status Message */}
        <div className={`flex items-center space-x-2 p-2 rounded ${getStatusColor()}`}>
          {getStatusIcon()}
          <div className="flex-1">
            {isAchieved ? (
              <p className="text-sm font-medium">Target achieved! 🎉</p>
            ) : isClose ? (
              <p className="text-sm font-medium">
                Close to target - {formatValue(remaining)} remaining
              </p>
            ) : (
              <p className="text-sm font-medium">
                {formatValue(remaining)} remaining to reach target
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetBenchmark;

