/**
 * Period-over-period comparison chart — Recharts loads on demand.
 */
import React, { Suspense, lazy } from 'react';

const ComparisonChartLazy = lazy(() => import('./ComparisonChartCore'));

const ChartFallback = ({ height = 220 }) => (
  <div
    className="bg-gray-50 rounded-lg animate-pulse border border-gray-100"
    style={{ height }}
    aria-hidden
  />
);

export const ComparisonChart = (props) => (
  <Suspense fallback={<ChartFallback height={props.height} />}>
    <ComparisonChartLazy {...props} />
  </Suspense>
);

export default ComparisonChart;
