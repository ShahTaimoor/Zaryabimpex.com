import React, { useState } from 'react';
import { Search, Filter, X, Calendar } from 'lucide-react';
import DateFilter from './DateFilter';

const ReturnFilters = ({ filters, onFilterChange, isLoading }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleInputChange = (field, value) => {
    onFilterChange({ [field]: value });
  };

  const handleClearFilters = () => {
    onFilterChange({
      status: '',
      returnType: '',
      priority: '',
      search: '',
      startDate: '',
      endDate: '',
      page: 1
    });
  };

  const hasActiveFilters = filters.status || filters.returnType || filters.priority || 
                          filters.search || filters.startDate || filters.endDate;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
            >
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Return #, customer..."
                value={filters.search}
                onChange={(e) => handleInputChange('search', e.target.value)}
                className="input pl-10"
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
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="input"
              disabled={isLoading}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="processing">Processing</option>
              <option value="received">Received</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Return Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filters.returnType}
              onChange={(e) => handleInputChange('returnType', e.target.value)}
              className="input"
              disabled={isLoading}
            >
              <option value="">All Types</option>
              <option value="return">Return</option>
              <option value="exchange">Exchange</option>
              <option value="warranty">Warranty</option>
              <option value="recall">Recall</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={filters.priority}
              onChange={(e) => handleInputChange('priority', e.target.value)}
              className="input"
              disabled={isLoading}
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Date Range - Always Visible */}
        <div className="mb-4 border-t pt-4">
          <DateFilter
            startDate={filters.startDate}
            endDate={filters.endDate}
            onDateChange={(start, end) => {
              handleInputChange('startDate', start || '');
              handleInputChange('endDate', end || '');
            }}
            compact={true}
            showPresets={true}
          />
        </div>


        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap gap-2">
            {filters.status && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Status: {filters.status}
                <button
                  onClick={() => handleInputChange('status', '')}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.returnType && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Type: {filters.returnType}
                <button
                  onClick={() => handleInputChange('returnType', '')}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-green-400 hover:bg-green-200 hover:text-green-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.priority && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                Priority: {filters.priority}
                <button
                  onClick={() => handleInputChange('priority', '')}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-orange-400 hover:bg-orange-200 hover:text-orange-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.search && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Search: {filters.search}
                <button
                  onClick={() => handleInputChange('search', '')}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-purple-400 hover:bg-purple-200 hover:text-purple-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {(filters.startDate || filters.endDate) && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Date: {filters.startDate || 'Start'} - {filters.endDate || 'End'}
                <button
                  onClick={() => {
                    handleInputChange('startDate', '');
                    handleInputChange('endDate', '');
                  }}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnFilters;
