import React, { useState, useEffect, useRef } from 'react';
import { X, Search, RefreshCw, Calendar, ArrowUpDown } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils/formatters';
import DateFilter from './DateFilter';

const DashboardReportModal = ({ 
  isOpen, 
  onClose, 
  title, 
  columns, 
  data = [], 
  isLoading = false,
  dateFrom,
  dateTo,
  onDateChange,
  filters = {},
  onFilterChange
}) => {
  const [localFilters, setLocalFilters] = useState(() => filters || {});
  const [localDateFrom, setLocalDateFrom] = useState(() => dateFrom);
  const [localDateTo, setLocalDateTo] = useState(() => dateTo);

  // Use refs to track previous values and avoid unnecessary updates
  const prevFiltersRef = useRef(JSON.stringify(filters || {}));
  const prevDateFromRef = useRef(dateFrom);
  const prevDateToRef = useRef(dateTo);

  useEffect(() => {
    // Only update if dateFrom actually changed
    if (dateFrom !== prevDateFromRef.current) {
      setLocalDateFrom(dateFrom);
      prevDateFromRef.current = dateFrom;
    }
  }, [dateFrom]);

  useEffect(() => {
    // Only update if dateTo actually changed
    if (dateTo !== prevDateToRef.current) {
      setLocalDateTo(dateTo);
      prevDateToRef.current = dateTo;
    }
  }, [dateTo]);

  useEffect(() => {
    // Only update if filters object actually changed (deep comparison using JSON)
    const currentFiltersStr = JSON.stringify(filters || {});
    const prevFiltersStr = prevFiltersRef.current;
    
    if (currentFiltersStr !== prevFiltersStr) {
      setLocalFilters(filters || {});
      prevFiltersRef.current = currentFiltersStr;
    }
  }, [filters]);

  if (!isOpen) return null;

  const handleSearch = () => {
    if (onDateChange) {
      onDateChange(localDateFrom, localDateTo);
    }
    if (onFilterChange) {
      onFilterChange(localFilters);
    }
  };

  const handleFilterChange = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const getFilterInput = (column) => {
    if (column.filterType === 'date') {
      return (
        <input
          type="date"
          value={localFilters[column.key] || ''}
          onChange={(e) => handleFilterChange(column.key, e.target.value)}
          className="input text-xs w-full"
          placeholder="Equals:"
        />
      );
    } else if (column.filterType === 'number') {
      return (
        <input
          type="number"
          value={localFilters[column.key] || ''}
          onChange={(e) => handleFilterChange(column.key, e.target.value)}
          className="input text-xs w-full"
          placeholder="Equals:"
        />
      );
    } else {
      return (
        <input
          type="text"
          value={localFilters[column.key] || ''}
          onChange={(e) => handleFilterChange(column.key, e.target.value)}
          className="input text-xs w-full"
          placeholder="Contains:"
        />
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-2 sm:top-4 md:top-10 mx-auto p-3 sm:p-4 md:p-6 border w-[98%] sm:w-[95%] max-w-7xl shadow-lg rounded-lg bg-white my-2 sm:my-4 md:my-10">
        {/* Header */}
        <div className="mb-4 sm:mb-5 md:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 break-words">{title}</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
              From: {formatDate(localDateFrom)} To: {formatDate(localDateTo)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 p-1"
            title="Close"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Date Range and Filters */}
        <div className="mb-3 sm:mb-4 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 md:gap-4">
            <div className="w-full sm:w-auto flex-1">
              <DateFilter
                startDate={localDateFrom}
                endDate={localDateTo}
                onDateChange={(start, end) => {
                  setLocalDateFrom(start);
                  setLocalDateTo(end);
                }}
                compact={true}
                showPresets={true}
                className="w-full"
              />
            </div>
            <button
              onClick={handleSearch}
              className="btn btn-primary flex items-center justify-center gap-x-1 sm:gap-x-2 px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto whitespace-nowrap"
            >
              <Search className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Search</span>
            </button>
          </div>

        </div>

        {/* Grouping Hint */}
        <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-gray-50 border border-gray-200 rounded text-xs sm:text-sm text-gray-600 break-words">
          Drag a column here to group by this column.
        </div>

        {/* Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[50vh] sm:max-h-[55vh] md:max-h-[60vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex items-center space-x-0.5 sm:space-x-1">
                        <span className="break-words">{column.label}</span>
                        {column.sortable && (
                          <ArrowUpDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={columns.length} className="px-3 sm:px-4 md:px-6 py-6 sm:py-8 text-center">
                      <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto text-gray-400" />
                      <p className="mt-2 text-xs sm:text-sm text-gray-500">Loading data...</p>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-3 sm:px-4 md:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500 break-words">
                      No data found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  data.map((row, index) => (
                    <tr
                      key={row._id || row.id || index}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className="px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-[10px] sm:text-xs md:text-sm text-gray-900 break-words sm:whitespace-nowrap"
                        >
                          {column.render
                            ? column.render(row[column.key], row)
                            : column.format === 'currency'
                            ? formatCurrency(row[column.key] || 0)
                            : column.format === 'date'
                            ? formatDate(row[column.key])
                            : row[column.key] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-4">
          <p className="text-xs sm:text-sm text-gray-600 break-words text-center sm:text-left">
            Showing {data.length} record{data.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={onClose}
            className="btn btn-secondary w-full sm:w-auto px-4 py-2 text-xs sm:text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardReportModal;
