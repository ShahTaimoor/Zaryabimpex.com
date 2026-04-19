/**
 * Overview bar chart for PeriodComparisonSection — lazy-loaded so recharts is not in the main Dashboard chunk.
 */
import React from 'react';
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

export default function PeriodOverviewBarChart({ combinedChartData, currentLabel, previousLabel }) {
  if (!combinedChartData?.length) return null;
  return (
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
  );
}
