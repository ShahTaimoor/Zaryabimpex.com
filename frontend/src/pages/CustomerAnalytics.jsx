import React, { useState } from 'react';
import { 
  Users, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Target,
  PieChart,
  BarChart3,
  Filter,
  Download,
  Crown,
  Star,
  Heart,
  User,
  Clock,
  XCircle,
  Sparkles
} from 'lucide-react';
import { useGetSummaryQuery, useGetAnalyticsQuery } from '../store/services/customerAnalyticsApi';
import { formatCurrency } from '../utils/formatters';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showErrorToast, handleApiError } from '../utils/errorHandler';

const CustomerAnalytics = () => {
  const [filters, setFilters] = useState({
    segment: '',
    churnRisk: '',
    minOrders: 0
  });

  // Fetch analytics summary
  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary, error: summaryError } = useGetSummaryQuery(undefined, {
    pollingInterval: 300000, // Refetch every 5 minutes
    skip: false,
  });

  // Fetch full analytics with filters
  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics, error: analyticsError } = useGetAnalyticsQuery({
    segment: filters.segment || undefined,
    churnRisk: filters.churnRisk || undefined,
    minOrders: filters.minOrders || undefined
  }, {
    pollingInterval: 300000,
    skip: false,
  });

  // Handle errors
  React.useEffect(() => {
    if (summaryError) {
      showErrorToast(handleApiError(summaryError));
    }
  }, [summaryError]);

  React.useEffect(() => {
    if (analyticsError) {
      showErrorToast(handleApiError(analyticsError));
    }
  }, [analyticsError]);


  const summary = summaryData?.data || summaryData || {};
  const analytics = analyticsData?.data || analyticsData || {};

  const segmentColors = {
    VIP: 'bg-purple-100 text-purple-800 border-purple-300',
    champion: 'bg-green-100 text-green-800 border-green-300',
    loyal: 'bg-blue-100 text-blue-800 border-blue-300',
    regular: 'bg-gray-100 text-gray-800 border-gray-300',
    new: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    at_risk: 'bg-orange-100 text-orange-800 border-orange-300',
    churned: 'bg-red-100 text-red-800 border-red-300'
  };

  const segmentIcons = {
    VIP: Crown,
    champion: Star,
    loyal: Heart,
    regular: User,
    new: Sparkles,
    at_risk: AlertTriangle,
    churned: XCircle
  };

  const riskColors = {
    very_low: 'bg-green-100 text-green-800',
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    very_high: 'bg-red-100 text-red-800'
  };

  if (summaryLoading || analyticsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Customer Analytics</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">AI-powered customer segmentation, CLV prediction, and churn risk analysis</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Total Customers</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{summary.totalCustomers || 0}</p>
            </div>
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-purple-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Total Predicted CLV</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                {formatCurrency(summary.summary?.totalCLV || 0)}
              </p>
            </div>
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-600 truncate">At-Risk Customers</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{summary.summary?.highRiskCount || 0}</p>
            </div>
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-orange-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Churned Customers</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{summary.summary?.churnedCount || 0}</p>
            </div>
            <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-400 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      {/* Segment Distribution */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Customer Segments</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          {Object.entries(summary.segmentCounts || {}).map(([segment, count]) => {
            const Icon = segmentIcons[segment] || User;
            return (
              <div
                key={segment}
                className={`p-4 rounded-lg border-2 ${segmentColors[segment] || segmentColors.regular}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className="h-5 w-5" />
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <p className="text-xs font-medium capitalize">
                  {segment.replace('_', ' ')}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          <select
            value={filters.segment}
            onChange={(e) => setFilters({ ...filters, segment: e.target.value })}
            className="input"
          >
            <option value="">All Segments</option>
            <option value="VIP">VIP</option>
            <option value="champion">Champion</option>
            <option value="loyal">Loyal</option>
            <option value="regular">Regular</option>
            <option value="new">New</option>
            <option value="at_risk">At-Risk</option>
            <option value="churned">Churned</option>
          </select>
          <select
            value={filters.churnRisk}
            onChange={(e) => setFilters({ ...filters, churnRisk: e.target.value })}
            className="input"
          >
            <option value="">All Risk Levels</option>
            <option value="very_low">Very Low</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="very_high">Very High</option>
          </select>
          <input
            type="number"
            placeholder="Min Orders"
            value={filters.minOrders}
            onChange={(e) => setFilters({ ...filters, minOrders: parseInt(e.target.value) || 0 })}
            className="input"
            min="0"
          />
          <button
            onClick={() => setFilters({ segment: '', churnRisk: '', minOrders: 0 })}
            className="btn btn-secondary btn-md w-full sm:w-auto"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Top Customers by CLV */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Top Customers by Predicted CLV</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Segment
                </th>
                <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Predicted CLV
                </th>
                <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Churn Risk
                </th>
                <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RFM Score
                </th>
                <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Purchase
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(summary.topCustomers || []).map((customer) => (
                <tr key={customer.customer._id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {customer.customer.businessName || customer.customer.name}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500 truncate">{customer.customer.email}</div>
                    </div>
                  </td>
                  <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      segmentColors[customer.segment] || segmentColors.regular
                    }`}>
                      {customer.segment}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">
                      {formatCurrency(customer.clv)}
                    </div>
                  </td>
                  <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      riskColors[customer.churnRisk] || riskColors.medium
                    }`}>
                      {customer.churnRisk.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                    {/* RFM score would be here if available in summary */}
                    -
                  </td>
                  <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                    {/* Last purchase date would be here if available in summary */}
                    -
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Customer List */}
      {analytics.customers && analytics.customers.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Customer Details ({analytics.filteredCount || analytics.customers.length} customers)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Segment
                  </th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RFM
                  </th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Predicted CLV
                  </th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Churn Risk
                  </th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.customers.slice(0, 50).map((item) => (
                  <tr key={item.customer._id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.customer.businessName || item.customer.name}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 truncate">{item.customer.email}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          segmentColors[item.segment.segment] || segmentColors.regular
                        }`}>
                          {item.segment.segmentName}
                        </span>
                        <p className="text-xs text-gray-500 mt-1 truncate">{item.segment.description}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm">
                        <div className="font-medium">R{item.rfm.recencyScore} F{item.rfm.frequencyScore} M{item.rfm.monetaryScore}</div>
                        <div className="text-xs text-gray-500">
                          {item.rfm.recency} days ago
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-gray-900">
                          {formatCurrency(item.clv.predictedCLV)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.clv.confidence} confidence
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          riskColors[item.churnRisk.riskLevel] || riskColors.medium
                        }`}>
                          {item.churnRisk.riskLevel.replace('_', ' ')}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          Score: {item.churnRisk.riskScore}%
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                      <button
                        className="text-primary-600 hover:text-primary-800"
                        title="View Details"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerAnalytics;

