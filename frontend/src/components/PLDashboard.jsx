import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  TrendingUp,
  Percent,
  Calendar,
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import {
  useGetTrendsQuery,
  useGetLatestStatementQuery,
} from '../store/services/plStatementsApi';
import { handleApiError } from '../utils/errorHandler';
import { LoadingSpinner, LoadingCard } from '../components/LoadingSpinner';
import { ResponsiveContainer, ResponsiveGrid } from '../components/ResponsiveContainer';

// Simple Chart Component (placeholder for actual chart library)
const SimpleChart = ({ data, type = 'line', title, className = '' }) => {
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)));
  const minValue = Math.min(...data.map(d => Math.abs(d.value)));

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-64 flex items-end justify-between space-x-1">
        {data.map((item, index) => {
          const height = maxValue > 0 ? (Math.abs(item.value) / maxValue) * 100 : 0;
          const isPositive = item.value >= 0;
          
          return (
            <div key={index} className="flex flex-col items-center flex-1">
              <div
                className={`w-full rounded-t transition-all duration-300 ${
                  isPositive ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ height: `${height}%` }}
                title={`${item.label}: $${item.value.toLocaleString()}`}
              />
              <div className="mt-2 text-xs text-gray-600 text-center">
                <div className="font-medium">{item.label}</div>
                <div className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  ${item.value.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, change, changePercent, icon: Icon, color = 'blue', trend = 'up' }) => {
  const formatCurrency = (amount) => 
    `$${amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;

  const formatPercent = (value) => 
    `${value?.toFixed(1) || '0.0'}%`;

  const getColorClasses = (color) => {
    switch (color) {
      case 'green': return 'text-green-600 bg-green-50 border-green-200';
      case 'red': return 'text-red-600 bg-red-50 border-red-200';
      case 'blue': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'purple': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'orange': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const isPositive = change >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(value)}</p>
          {change !== undefined && (
            <div className="flex items-center mt-1">
              <TrendIcon className={`h-4 w-4 mr-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
              <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(change))} ({formatPercent(Math.abs(changePercent))})
              </span>
              <span className="text-sm text-gray-500 ml-1">vs last period</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg border ${getColorClasses(color)}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

// P&L Dashboard Component
const PLDashboard = ({ period = { months: 12 }, onPeriodChange }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  // Fetch P&L trends
  const { data: trendsData, isLoading: trendsLoading, error: trendsError } = useGetTrendsQuery(
    {
      months: selectedPeriod.months,
      type: selectedPeriod.type,
    }
  );

  // Fetch latest statement
  const { data: latestStatement, isLoading: latestLoading } = useGetLatestStatementQuery(
    { periodType: 'monthly' }
  );
  
  useEffect(() => {
    if (trendsError) {
      handleApiError(trendsError, 'P&L Trends');
    }
  }, [trendsError]);

  // Process trends data for charts
  const processTrendsData = (data) => {
    if (!data || !data.trends) return { revenue: [], profit: [], expenses: [] };

    const revenue = data.trends.map(item => ({
      label: new Date(item.period.startDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      value: item.totalRevenue,
    }));

    const profit = data.trends.map(item => ({
      label: new Date(item.period.startDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      value: item.netIncome,
    }));

    const expenses = data.trends.map(item => ({
      label: new Date(item.period.startDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      value: item.totalRevenue - item.grossProfit, // Simplified expense calculation
    }));

    return { revenue, profit, expenses };
  };

  // Calculate period comparisons
  const calculateComparisons = (trends) => {
    if (!trends || trends.length < 2) return null;

    const current = trends[trends.length - 1];
    const previous = trends[trends.length - 2];

    return {
      revenue: {
        value: current.totalRevenue,
        change: current.totalRevenue - previous.totalRevenue,
        changePercent: previous.totalRevenue !== 0 ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 : 0,
      },
      grossProfit: {
        value: current.grossProfit,
        change: current.grossProfit - previous.grossProfit,
        changePercent: previous.grossProfit !== 0 ? ((current.grossProfit - previous.grossProfit) / previous.grossProfit) * 100 : 0,
      },
      operatingIncome: {
        value: current.operatingIncome,
        change: current.operatingIncome - previous.operatingIncome,
        changePercent: previous.operatingIncome !== 0 ? ((current.operatingIncome - previous.operatingIncome) / previous.operatingIncome) * 100 : 0,
      },
      netIncome: {
        value: current.netIncome,
        change: current.netIncome - previous.netIncome,
        changePercent: previous.netIncome !== 0 ? ((current.netIncome - previous.netIncome) / previous.netIncome) * 100 : 0,
      },
    };
  };

  const { revenue: revenueChart, profit: profitChart, expenses: expensesChart } = processTrendsData(trendsData);
  const comparisons = calculateComparisons(trendsData?.trends);

  // Period selector
  const periodOptions = [
    { value: 6, label: '6 Months', type: 'monthly' },
    { value: 12, label: '12 Months', type: 'monthly' },
    { value: 4, label: '4 Quarters', type: 'quarterly' },
    { value: 3, label: '3 Years', type: 'yearly' },
  ];

  const handlePeriodChange = (months, type) => {
    const newPeriod = { months, type };
    setSelectedPeriod(newPeriod);
    if (onPeriodChange) onPeriodChange(newPeriod);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">P&L Dashboard</h1>
          <p className="text-gray-600">Financial performance overview and trends</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={`${selectedPeriod.months}-${selectedPeriod.type}`}
            onChange={(e) => {
              const [months, type] = e.target.value.split('-');
              handlePeriodChange(parseInt(months), type);
            }}
            className="input"
          >
            {periodOptions.map(option => (
              <option key={`${option.value}-${option.type}`} value={`${option.value}-${option.type}`}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {(trendsLoading || latestLoading) && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Error State */}
      {trendsError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">Failed to load P&L dashboard data. Please try again.</p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {comparisons && (
        <ResponsiveGrid cols={{ default: 1, sm: 2, lg: 4 }} gap={6}>
          <MetricCard
            title="Total Revenue"
            value={comparisons.revenue.value}
            change={comparisons.revenue.change}
            changePercent={comparisons.revenue.changePercent}
            icon={TrendingUp}
            color="blue"
          />
          <MetricCard
            title="Gross Profit"
            value={comparisons.grossProfit.value}
            change={comparisons.grossProfit.change}
            changePercent={comparisons.grossProfit.changePercent}
            icon={TrendingUp}
            color="green"
          />
          <MetricCard
            title="Operating Income"
            value={comparisons.operatingIncome.value}
            change={comparisons.operatingIncome.change}
            changePercent={comparisons.operatingIncome.changePercent}
            icon={Activity}
            color="purple"
          />
          <MetricCard
            title="Net Income"
            value={comparisons.netIncome.value}
            change={comparisons.netIncome.change}
            changePercent={comparisons.netIncome.changePercent}
            icon={BarChart3}
            color={comparisons.netIncome.value >= 0 ? 'green' : 'red'}
          />
        </ResponsiveGrid>
      )}

      {/* Charts */}
      <ResponsiveGrid cols={{ default: 1, lg: 2 }} gap={6}>
        <SimpleChart
          data={revenueChart}
          type="bar"
          title="Revenue Trend"
          icon={TrendingUp}
        />
        <SimpleChart
          data={profitChart}
          type="line"
          title="Net Income Trend"
          icon={TrendingUp}
        />
      </ResponsiveGrid>

      {/* Additional Charts */}
      <ResponsiveGrid cols={{ default: 1, lg: 3 }} gap={6}>
        <SimpleChart
          data={expensesChart}
          type="bar"
          title="Expenses Trend"
          icon={TrendingDown}
        />
        
        {/* Margin Trends */}
        {trendsData?.trends && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Percent className="h-5 w-5 text-purple-500 mr-2" />
              Margin Trends
            </h3>
            <div className="space-y-4">
              {trendsData.trends.slice(-6).map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {new Date(item.period.startDate).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <div className="flex space-x-4 text-sm">
                    <span className="text-green-600 font-medium">
                      GP: {item.grossProfitMargin?.toFixed(1) || '0.0'}%
                    </span>
                    <span className="text-purple-600 font-medium">
                      OP: {item.operatingMargin?.toFixed(1) || '0.0'}%
                    </span>
                    <span className={`font-medium ${item.netMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      NP: {item.netMargin?.toFixed(1) || '0.0'}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latest Statement Summary */}
        {latestStatement && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 text-blue-500 mr-2" />
              Latest Statement
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Period:</span>
                <span className="text-sm font-medium">
                  {new Date(latestStatement.period.startDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Revenue:</span>
                <span className="text-sm font-medium text-blue-600">
                  ${latestStatement.revenue?.totalRevenue?.amount?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Net Income:</span>
                <span className={`text-sm font-medium ${latestStatement.netIncome?.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${latestStatement.netIncome?.amount?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Net Margin:</span>
                <span className={`text-sm font-medium ${latestStatement.netIncome?.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {latestStatement.netIncome?.margin?.toFixed(1) || '0.0'}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <div className="flex items-center">
                  {latestStatement.status === 'published' ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
                  )}
                  <span className="text-sm font-medium capitalize">{latestStatement.status}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </ResponsiveGrid>

      {/* Performance Indicators */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="h-5 w-5 text-indigo-500 mr-2" />
          Performance Indicators
        </h3>
        
        {trendsData?.trends && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {trendsData.trends.filter(t => t.netIncome >= 0).length}
              </div>
              <div className="text-sm text-gray-600">Profitable Periods</div>
              <div className="text-xs text-gray-500">
                {((trendsData.trends.filter(t => t.netIncome >= 0).length / trendsData.trends.length) * 100).toFixed(1)}% of periods
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                ${trendsData.trends.reduce((sum, t) => sum + t.totalRevenue, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="text-xs text-gray-500">
                Over {selectedPeriod.months} {selectedPeriod.type}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {trendsData.trends.length > 1 ? 
                  ((trendsData.trends[trendsData.trends.length - 1].totalRevenue - trendsData.trends[0].totalRevenue) / trendsData.trends[0].totalRevenue * 100).toFixed(1) : 
                  '0.0'
                }%
              </div>
              <div className="text-sm text-gray-600">Revenue Growth</div>
              <div className="text-xs text-gray-500">
                Since period start
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                ${trendsData.trends.reduce((sum, t) => sum + t.netIncome, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Net Income</div>
              <div className="text-xs text-gray-500">
                Over {selectedPeriod.months} {selectedPeriod.type}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PLDashboard;
