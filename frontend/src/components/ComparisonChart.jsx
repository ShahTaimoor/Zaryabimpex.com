/**
 * Comparison Chart Component
 * Period-over-period comparison using Recharts
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

const formatValue = (value, format) => {
  if (value === null || value === undefined) return '0';
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    case 'percentage':
      return `${Number(value).toFixed(1)}%`;
    case 'number':
      return new Intl.NumberFormat('en-US').format(value);
    default:
      return String(value);
  }
};

export const ComparisonChart = ({
  title,
  currentPeriod,
  previousPeriod,
  currentLabel = 'Current',
  previousLabel = 'Previous',
  format = 'currency',
  height = 220,
  showTrend = true,
  className = ''
}) => {
  const data = [
    { period: previousLabel, value: previousPeriod ?? 0 },
    { period: currentLabel, value: currentPeriod ?? 0 }
  ];
  const percentageChange = previousPeriod !== 0 && previousPeriod != null
    ? ((currentPeriod - previousPeriod) / previousPeriod) * 100
    : currentPeriod > 0 ? 100 : 0;
  const isPositive = percentageChange >= 0;
  const barColors = ['#94a3b8', isPositive ? '#22c55e' : '#ef4444'];

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    const period = item.payload?.period || item.name;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
        <p className="font-medium text-gray-900">{period}</p>
        <p className="text-gray-700 font-semibold">
          {formatValue(item.value, format)}
        </p>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {showTrend && (
          <div className={`flex items-center gap-1.5 text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>{isPositive ? '+' : ''}{percentageChange.toFixed(1)}%</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: 12, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#6b7280" />
          <YAxis tickFormatter={(v) => formatValue(v, format)} tick={{ fontSize: 11 }} stroke="#6b7280" width={56} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="value" name={title} radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={barColors[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="px-4 pb-4 pt-1 flex justify-between text-xs text-gray-500 border-t border-gray-100">
        <span>{previousLabel}: {formatValue(previousPeriod, format)}</span>
        <span className="font-medium text-gray-700">{currentLabel}: {formatValue(currentPeriod, format)}</span>
      </div>
    </div>
  );
};

export default ComparisonChart;
