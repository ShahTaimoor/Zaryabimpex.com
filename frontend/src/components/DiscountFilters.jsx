import React, { useState } from 'react';
import { Search, Filter, X, Calendar, Tag, Percent, TrendingUp } from 'lucide-react';
import DateFilter from './DateFilter';

const DiscountFilters = ({ filters, onFilterChange, isLoading }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleFilterChange = (field, value) => {
    onFilterChange({ [field]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      status: '',
      type: '',
      isActive: '',
      search: '',
      validFrom: '',
      validUntil: '',
      page: 1
    });
  };

  const hasActiveFilters = filters.status || filters.type || filters.isActive !== '' || filters.search || filters.validFrom || filters.validUntil;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          <div className="flex space-x-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
              >
                <X className="h-4 w-4 mr-1" />
                Clear all
              </button>
            )}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
            >
              <Filter className="h-4 w-4 mr-1" />
              {showAdvanced ? 'Hide' : 'Show'} advanced
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                placeholder="Search name, code..."
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isLoading}
            >
              <option value="">All Types</option>
              <option value="percentage">Percentage</option>
              <option value="fixed_amount">Fixed Amount</option>
            </select>
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="scheduled">Scheduled</option>
              <option value="expired">Expired</option>
              <option value="exhausted">Exhausted</option>
            </select>
          </div>

          {/* Results per page */}
          <div>
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

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Advanced Filters</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Active Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Active Status
                </label>
                <select
                  value={filters.isActive}
                  onChange={(e) => handleFilterChange('isActive', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={isLoading}
                >
                  <option value="">All</option>
                  <option value="true">Active Only</option>
                  <option value="false">Inactive Only</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="col-span-2">
                <DateFilter
                  startDate={filters.validFrom}
                  endDate={filters.validUntil}
                  onDateChange={(start, end) => {
                    handleFilterChange('validFrom', start || '');
                    handleFilterChange('validUntil', end || '');
                  }}
                  compact={true}
                  showPresets={true}
                />
              </div>
            </div>

            {/* Sort Options */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={isLoading}
                >
                  <option value="createdAt">Created Date</option>
                  <option value="name">Name</option>
                  <option value="code">Code</option>
                  <option value="type">Type</option>
                  <option value="value">Value</option>
                  <option value="priority">Priority</option>
                  <option value="validFrom">Valid From</option>
                  <option value="validUntil">Valid Until</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={isLoading}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Active Filters</h4>
            <div className="flex flex-wrap gap-2">
              {filters.type && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {filters.type === 'percentage' ? <Percent className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
                  Type: {filters.type.replace('_', ' ')}
                  <button
                    onClick={() => handleFilterChange('type', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.status && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <Tag className="h-3 w-3 mr-1" />
                  Status: {filters.status}
                  <button
                    onClick={() => handleFilterChange('status', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-green-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.isActive !== '' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Active: {filters.isActive === 'true' ? 'Yes' : 'No'}
                  <button
                    onClick={() => handleFilterChange('isActive', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-purple-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.search && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Search: {filters.search}
                  <button
                    onClick={() => handleFilterChange('search', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-yellow-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.validFrom && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  From: {new Date(filters.validFrom).toLocaleDateString()}
                  <button
                    onClick={() => handleFilterChange('validFrom', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.validUntil && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  To: {new Date(filters.validUntil).toLocaleDateString()}
                  <button
                    onClick={() => handleFilterChange('validUntil', '')}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-200"
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

export default DiscountFilters;
