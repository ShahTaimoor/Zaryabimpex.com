import React, { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { 
  formatDateForInput, 
  getCurrentDatePakistan, 
  getDateDaysAgo,
  getStartOfMonth,
  getEndOfMonth,
  getDatePresets 
} from '../utils/dateUtils';

/**
 * Reusable Date Filter Component
 * 
 * Provides start and end date pickers with preset options.
 * All dates are handled in Pakistan Standard Time (Asia/Karachi).
 * 
 * @param {Object} props
 * @param {string} props.startDate - Initial start date (YYYY-MM-DD)
 * @param {string} props.endDate - Initial end date (YYYY-MM-DD)
 * @param {Function} props.onDateChange - Callback when dates change (startDate, endDate)
 * @param {boolean} props.showPresets - Show preset date range buttons (default: true)
 * @param {boolean} props.required - Require both dates to be selected (default: false)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.compact - Compact layout for smaller spaces (default: false)
 * @param {boolean} props.showClear - Show clear button (default: true)
 */
const DateFilter = ({
  startDate: initialStartDate,
  endDate: initialEndDate,
  onDateChange,
  showPresets = true,
  required = false,
  className = '',
  compact = false,
  showClear = true
}) => {
  const [startDate, setStartDate] = useState(initialStartDate || '');
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  // Update local state when props change
  useEffect(() => {
    if (initialStartDate !== undefined) {
      setStartDate(initialStartDate || '');
    }
  }, [initialStartDate]);

  useEffect(() => {
    if (initialEndDate !== undefined) {
      setEndDate(initialEndDate || '');
    }
  }, [initialEndDate]);

  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value;
    setStartDate(newStartDate);
    
    // Ensure end date is not before start date
    if (endDate && newStartDate > endDate) {
      setEndDate(newStartDate);
      onDateChange?.(newStartDate, newStartDate);
    } else {
      onDateChange?.(newStartDate, endDate);
    }
  };

  const handleEndDateChange = (e) => {
    const newEndDate = e.target.value;
    setEndDate(newEndDate);
    
    // Ensure start date is not after end date
    if (startDate && newEndDate < startDate) {
      setStartDate(newEndDate);
      onDateChange?.(newEndDate, newEndDate);
    } else {
      onDateChange?.(startDate, newEndDate);
    }
  };

  const handlePresetSelect = (preset) => {
    setStartDate(preset.startDate);
    setEndDate(preset.endDate);
    onDateChange?.(preset.startDate, preset.endDate);
    setShowPresetMenu(false);
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    onDateChange?.('', '');
  };

  const presets = getDatePresets();

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4 text-gray-500" />
          <input
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            className="input text-sm py-1.5 px-2"
            max={endDate || undefined}
          />
          <span className="text-gray-500 text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            className="input text-sm py-1.5 px-2"
            min={startDate || undefined}
          />
        </div>
        {showClear && (startDate || endDate) && (
          <button
            onClick={handleClear}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Clear dates"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Date Inputs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Start Date {required && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="input pl-10"
              max={endDate || undefined}
              required={required}
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            End Date {required && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className="input pl-10"
              min={startDate || undefined}
              required={required}
            />
          </div>
        </div>

        {showClear && (startDate || endDate) && (
          <div className="flex-1 sm:flex-none">
            <label className="block text-sm font-medium text-gray-700 mb-1.5 opacity-0 pointer-events-none">
              Clear
            </label>
            <button
              onClick={handleClear}
              className="w-full sm:w-auto btn btn-secondary h-[42px] flex items-center justify-center gap-2 px-4"
              type="button"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* Preset Buttons */}
      {showPresets && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handlePresetSelect(presets.today)}
            className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            type="button"
          >
            Today
          </button>
          <button
            onClick={() => handlePresetSelect(presets.yesterday)}
            className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            type="button"
          >
            Yesterday
          </button>
          <button
            onClick={() => handlePresetSelect(presets.last7Days)}
            className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            type="button"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => handlePresetSelect(presets.last30Days)}
            className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            type="button"
          >
            Last 30 Days
          </button>
          <button
            onClick={() => handlePresetSelect(presets.thisMonth)}
            className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            type="button"
          >
            This Month
          </button>
          <button
            onClick={() => handlePresetSelect(presets.lastMonth)}
            className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            type="button"
          >
            Last Month
          </button>
          <button
            onClick={() => handlePresetSelect(presets.thisYear)}
            className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            type="button"
          >
            This Year
          </button>
        </div>
      )}
    </div>
  );
};

export default DateFilter;
