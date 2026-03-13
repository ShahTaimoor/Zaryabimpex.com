import React, { useState } from 'react';
import { X, Calendar, Filter, RotateCcw } from 'lucide-react';

const InventoryReportFilters = ({ filters, onFilterChange, onClose }) => {
  const [localFilters, setLocalFilters] = useState(filters);

  const handleFilterChange = (field, value) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
  };

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onClose();
  };

  const handleResetFilters = () => {
    const resetFilters = {
      page: 1,
      limit: 10,
      reportType: '',
      status: '',
      generatedBy: '',
      startDate: '',
      endDate: '',
      sortBy: 'generatedAt',
      sortOrder: 'desc'
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const reportTypes = [
    { value: '', label: 'All Types' },
    { value: 'stock_levels', label: 'Stock Levels' },
    { value: 'turnover_rates', label: 'Turnover Rates' },
    { value: 'aging_analysis', label: 'Aging Analysis' },
    { value: 'comprehensive', label: 'Comprehensive' },
    { value: 'custom', label: 'Custom' }
  ];

  const statuses = [
    { value: '', label: 'All Statuses' },
    { value: 'generating', label: 'Generating' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'archived', label: 'Archived' }
  ];

  const sortOptions = [
    { value: 'generatedAt', label: 'Generated Date' },
    { value: 'reportName', label: 'Report Name' },
    { value: 'status', label: 'Status' },
    { value: 'viewCount', label: 'View Count' }
  ];

  const sortOrders = [
    { value: 'desc', label: 'Descending' },
    { value: 'asc', label: 'Ascending' }
  ];

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900 flex items-center">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={handleResetFilters}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Report Type Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Report Type
          </label>
          <select
            value={localFilters.reportType}
            onChange={(e) => handleFilterChange('reportType', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {reportTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={localFilters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={localFilters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* End Date Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={localFilters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Sort By Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Sort By
          </label>
          <select
            value={localFilters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Order Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Sort Order
          </label>
          <select
            value={localFilters.sortOrder}
            onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {sortOrders.map((order) => (
              <option key={order.value} value={order.value}>
                {order.label}
              </option>
            ))}
          </select>
        </div>

        {/* Limit Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Results Per Page
          </label>
          <select
            value={localFilters.limit}
            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Quick Date Filters */}
      <div className="mt-4">
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Quick Date Filters
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Today', days: 0 },
            { label: 'Last 7 days', days: 7 },
            { label: 'Last 30 days', days: 30 },
            { label: 'Last 90 days', days: 90 },
            { label: 'This year', days: 365 }
          ].map((filter) => {
            const endDate = new Date();
            const startDate = new Date();
            if (filter.days > 0) {
              startDate.setDate(endDate.getDate() - filter.days);
            } else if (filter.days === 0) {
              startDate.setHours(0, 0, 0, 0);
              endDate.setHours(23, 59, 59, 999);
            } else {
              startDate.setFullYear(endDate.getFullYear(), 0, 1);
              endDate.setFullYear(endDate.getFullYear(), 11, 31);
            }

            return (
              <button
                key={filter.label}
                type="button"
                onClick={() => {
                  handleFilterChange('startDate', startDate.toISOString().split('T')[0]);
                  handleFilterChange('endDate', endDate.toISOString().split('T')[0]);
                }}
                className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          onClick={handleApplyFilters}
          className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};

export default InventoryReportFilters;
