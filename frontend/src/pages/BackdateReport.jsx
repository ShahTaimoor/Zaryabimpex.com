import React, { useState } from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useGetBackdateReportQuery } from '../store/services/reportsApi';
import { LoadingPage } from '../components/LoadingSpinner';

const BackdateReport = () => {
  const [filter, setFilter] = useState('all'); // all, backdate, future, recent
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: reportResponse, isLoading: loading, error: queryError, refetch } = useGetBackdateReportQuery();

  const reportData = reportResponse?.data || reportResponse;
  const error = queryError?.message || queryError?.data?.message || (queryError ? 'Failed to fetch report data' : null);

  const getDateTypeColor = (dateType) => {
    switch (dateType) {
      case 'Backdate':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Future Date':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Recent Entry':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Sales':
        return 'bg-green-100 text-green-800';
      case 'Purchase':
        return 'bg-blue-100 text-blue-800';
      case 'Sales Order':
        return 'bg-purple-100 text-purple-800';
      case 'Purchase Order':
        return 'bg-indigo-100 text-indigo-800';
      case 'Cash Receipt':
        return 'bg-emerald-100 text-emerald-800';
      case 'Cash Payment':
        return 'bg-orange-100 text-orange-800';
      case 'Bank Receipt':
        return 'bg-teal-100 text-teal-800';
      case 'Bank Payment':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEntries = reportData?.entries?.filter(entry => {
    const matchesDateFilter = filter === 'all' || entry.dateType === filter;
    const matchesTypeFilter = typeFilter === 'all' || entry.type === typeFilter;
    return matchesDateFilter && matchesTypeFilter;
  }) || [];

  if (loading) {
    return <LoadingPage message="Loading backdate report..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Report</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => refetch()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Backdate & Future Date Report</h1>
          <p className="text-gray-600">
            Entries with dates significantly different from their creation date
          </p>
        </div>

        {/* Summary Cards */}
        {reportData?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Entries</p>
                  <p className="text-2xl font-semibold text-gray-900">{reportData.summary.totalEntries}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Backdated</p>
                  <p className="text-2xl font-semibold text-gray-900">{reportData.summary.backdateEntries}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Future Dates</p>
                  <p className="text-2xl font-semibold text-gray-900">{reportData.summary.futureEntries}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(reportData.summary.totalAmount)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Type</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="Backdate">Backdated</option>
                <option value="Future Date">Future Dates</option>
                <option value="Recent Entry">Recent Entries</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="Sales">Sales</option>
                <option value="Purchase">Purchase</option>
                <option value="Sales Order">Sales Orders</option>
                <option value="Purchase Order">Purchase Orders</option>
                <option value="Cash Receipt">Cash Receipts</option>
                <option value="Cash Payment">Cash Payments</option>
                <option value="Bank Receipt">Bank Receipts</option>
                <option value="Bank Payment">Bank Payments</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => refetch()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Entries Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Entries ({filteredEntries.length})
            </h3>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No entries found</h3>
              <p className="text-gray-600">
                {filter === 'all' && typeFilter === 'all' 
                  ? 'No backdated or future dated entries found in the system.'
                  : 'No entries match the current filters.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Difference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer/Supplier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEntries.map((entry, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(entry.type)}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {entry.reference}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getDateTypeColor(entry.dateType)}`}>
                          {entry.dateType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={entry.daysDifference < 0 ? 'text-red-600' : entry.daysDifference > 0 ? 'text-yellow-600' : 'text-gray-600'}>
                          {entry.daysDifference > 0 ? '+' : ''}{entry.daysDifference} days
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(entry.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.customer || entry.supplier || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          entry.status === 'confirmed' || entry.status === 'paid' ? 'bg-green-100 text-green-800' :
                          entry.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          entry.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary by Type */}
        {reportData?.summary?.byType && Object.keys(reportData.summary.byType).length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Summary by Transaction Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(reportData.summary.byType).map(([type, data]) => (
                <div key={type} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">{type}</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span className="font-medium">{data.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span className="font-medium">{formatCurrency(data.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Backdated:</span>
                      <span className="font-medium text-red-600">{data.backdateCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Future:</span>
                      <span className="font-medium text-yellow-600">{data.futureCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackdateReport;
