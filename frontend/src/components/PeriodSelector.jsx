/**
 * Period Selector Component
 * Select comparison period type
 */

import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export const PeriodSelector = ({
  value,
  onChange,
  options = [
    { value: 'month', label: 'This Month vs Last Month' },
    { value: 'year', label: 'This Year vs Last Year' },
    { value: 'quarter', label: 'This Quarter vs Last Quarter' },
    { value: 'custom', label: 'Custom Range' }
  ],
  showCustomDatePicker = false,
  customStartDate,
  customEndDate,
  onCustomDateChange,
  className = ''
}) => {
  const [showCustomPicker, setShowCustomPicker] = React.useState(false);

  return (
    <div className={className}>
      <div className="flex items-center space-x-2">
        <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
        <select
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value === 'custom') {
              setShowCustomPicker(true);
            } else {
              setShowCustomPicker(false);
            }
          }}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {showCustomPicker && value === 'custom' && showCustomDatePicker && (
        <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate || ''}
                onChange={(e) => onCustomDateChange?.({ start: e.target.value, end: customEndDate })}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate || ''}
                onChange={(e) => onCustomDateChange?.({ start: customStartDate, end: e.target.value })}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodSelector;

