/**
 * Period Selector Component
 * Select comparison period type
 */

import React from 'react';
import DateFilter from './DateFilter';
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
          <DateFilter
            startDate={customStartDate || ''}
            endDate={customEndDate || ''}
            onDateChange={(start, end) => onCustomDateChange?.({ start, end })}
            compact
            showPresets={false}
            showClear={false}
            size="sm"
          />
        </div>
      )}
    </div>
  );
};

export default PeriodSelector;

