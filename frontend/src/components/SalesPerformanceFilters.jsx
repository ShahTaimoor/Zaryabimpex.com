import React, { useState } from 'react';
import {
  X,
  Calendar,
  User,
  Tag,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';

const SalesPerformanceFilters = ({ filters, onFilterChange, onClose }) => {
  const [localFilters, setLocalFilters] = useState(filters);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value, page: 1 };
    setLocalFilters(newFilters);
  };

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
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
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const handleResetFilters = () => {
    setLocalFilters(filters);
  };

  const reportTypes = [
    { value: '', label: 'All Types' },
    { value: 'top_products', label: 'Top Products' },
    { value: 'top_customers', label: 'Top Customers' },
    { value: 'top_sales_reps', label: 'Top Sales Reps' },
    { value: 'comprehensive', label: 'Comprehensive' }
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'generating', label: 'Generating' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'archived', label: 'Archived' }
  ];

  const sortOptions = [
    { value: 'generatedAt', label: 'Date Created' },
    { value: 'reportName', label: 'Report Name' },
    { value: 'status', label: 'Status' },
    { value: 'viewCount', label: 'View Count' }
  ];

  const sortOrderOptions = [
    { value: 'desc', label: 'Descending' },
    { value: 'asc', label: 'Ascending' }
  ];

  const periodOptions = [
    { value: '', label: 'All Periods' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'custom', label: 'Custom' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Filter className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Filter Reports</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Report Type */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
            Report Type
          </label>
          <select
            value={localFilters.reportType || ''}
            onChange={(e) => handleFilterChange('reportType', e.target.value)}
            className="input"
          >
            {reportTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={localFilters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="input"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Period Type */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
            Period Type
          </label>
          <select
            value={localFilters.periodType || ''}
            onChange={(e) => handleFilterChange('periodType', e.target.value)}
            className="input"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
            Start Date
          </label>
          <input
            type="date"
            value={localFilters.startDate || ''}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
            End Date
          </label>
          <input
            type="date"
            value={localFilters.endDate || ''}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="input"
          />
        </div>

        {/* Generated By */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
            Generated By
          </label>
          <input
            type="text"
            placeholder="Search by user..."
            value={localFilters.generatedBy || ''}
            onChange={(e) => handleFilterChange('generatedBy', e.target.value)}
            className="input"
          />
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
            Sort By
          </label>
          <select
            value={localFilters.sortBy || 'generatedAt'}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="input"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Order */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
            Sort Order
          </label>
          <select
            value={localFilters.sortOrder || 'desc'}
            onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
            className="input"
          >
            {sortOrderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Limit */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
            Results Per Page
          </label>
          <select
            value={localFilters.limit || 10}
            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
            className="input"
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Filters</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleFilterChange('status', 'completed')}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              localFilters.status === 'completed'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            Completed Only
          </button>
          <button
            onClick={() => handleFilterChange('status', 'generating')}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              localFilters.status === 'generating'
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            Generating Only
          </button>
          <button
            onClick={() => {
              const today = new Date();
              const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
              handleFilterChange('startDate', lastWeek.toISOString().split('T')[0]);
              handleFilterChange('endDate', today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => {
              const today = new Date();
              const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
              handleFilterChange('startDate', lastMonth.toISOString().split('T')[0]);
              handleFilterChange('endDate', today.toISOString().split('T')[0]);
            }}
            className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
          >
            Last 30 Days
          </button>
          <button
            onClick={() => handleFilterChange('reportType', 'comprehensive')}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              localFilters.reportType === 'comprehensive'
                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            Comprehensive Reports
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row sm:justify-between gap-3">
        <div className="flex space-x-3">
          <button
            onClick={handleClearFilters}
            className="btn btn-secondary btn-md"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear All
          </button>
          <button
            onClick={handleResetFilters}
            className="btn btn-secondary btn-md"
          >
            Reset
          </button>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="btn btn-secondary btn-md"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyFilters}
            className="btn btn-primary btn-md"
          >
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesPerformanceFilters;
