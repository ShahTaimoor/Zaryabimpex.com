import React from 'react';
import { Search, X } from 'lucide-react';

const BalanceSheetFilters = ({ filters, onFilterChange, isLoading }) => {
  const handleFilterChange = (field, value) => {
    onFilterChange({ [field]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      status: '',
      periodType: '',
      search: '',
      startDate: '',
      endDate: '',
      page: 1
    });
  };

  const hasActiveFilters = filters.status || filters.periodType || filters.search || filters.startDate || filters.endDate;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
            >
              <X className="h-4 w-4 mr-1" />
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Date range: From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From date
            </label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value || '')}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isLoading}
            />
          </div>

          {/* Date range: To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To date
            </label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value || '')}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isLoading}
            />
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search statement number..."
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isLoading}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
              <option value="final">Final</option>
            </select>
          </div>

          {/* Period Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period Type
            </label>
            <select
              value={filters.periodType}
              onChange={(e) => handleFilterChange('periodType', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isLoading}
            >
              <option value="">All Periods</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Results per page - move to second row on small screens via full width */}
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Per Page
            </label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isLoading}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Active Filters</h4>
            <div className="flex flex-wrap gap-2">
              {filters.status && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Status: {filters.status}
                  <button
                    onClick={() => handleFilterChange('status', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.periodType && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Period: {filters.periodType}
                  <button
                    onClick={() => handleFilterChange('periodType', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-green-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.search && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Search: {filters.search}
                  <button
                    onClick={() => handleFilterChange('search', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-purple-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.startDate && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  From: {new Date(filters.startDate).toLocaleDateString()}
                  <button
                    onClick={() => handleFilterChange('startDate', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-yellow-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.endDate && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  To: {new Date(filters.endDate).toLocaleDateString()}
                  <button
                    onClick={() => handleFilterChange('endDate', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-yellow-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceSheetFilters;
