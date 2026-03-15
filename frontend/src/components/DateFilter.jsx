import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react';
import { format } from 'date-fns';
import {
  formatDateForInput,
  getCurrentDatePakistan,
  getDateDaysAgo,
  getStartOfMonth,
  getEndOfMonth,
  getDatePresets
} from '../utils/dateUtils';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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
  const [popoverOpen, setPopoverOpen] = useState(false);

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

  // Convert YYYY-MM-DD strings to Date for calendar (start of day local)
  const dateFrom = startDate ? new Date(startDate + 'T00:00:00') : undefined;
  const dateTo = endDate ? new Date(endDate + 'T00:00:00') : undefined;
  const range = (dateFrom && dateTo) ? { from: dateFrom, to: dateTo } : dateFrom ? { from: dateFrom } : undefined;

  const handleRangeSelect = (selected) => {
    if (!selected?.from) {
      setStartDate('');
      setEndDate('');
      onDateChange?.('', '');
      return;
    }
    const fromStr = formatDateForInput(selected.from);
    setStartDate(fromStr);
    if (selected.to) {
      const toStr = formatDateForInput(selected.to);
      setEndDate(toStr);
      onDateChange?.(fromStr, toStr);
      setPopoverOpen(false);
    } else {
      setEndDate('');
      onDateChange?.(fromStr, '');
    }
  };

  return (
    <div className={compact ? `flex items-center gap-2 min-w-0 ${className}` : `space-y-3 ${className}`}>
      {/* Date Range Picker - Popover + Calendar design */}
      <div className={compact ? 'flex items-center gap-2 flex-1 min-w-0' : 'flex flex-col sm:flex-row items-stretch sm:items-center gap-3'}>
        <div className={compact ? 'flex-1 min-w-0' : 'flex-1 min-w-0'}>
          {!compact && (
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Date range {required && <span className="text-red-500">*</span>}
            </label>
          )}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal border-gray-300 bg-white hover:bg-gray-50',
                  compact ? 'h-10 text-sm' : 'h-11',
                  !startDate && !endDate && 'text-gray-500'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-gray-400 shrink-0" />
                {startDate && endDate && dateFrom && dateTo ? (
                  <span className="truncate">
                    {format(dateFrom, compact ? 'dd MMM yy' : 'LLL dd, y')} – {format(dateTo, compact ? 'dd MMM yy' : 'LLL dd, y')}
                  </span>
                ) : startDate && dateFrom ? (
                  format(dateFrom, compact ? 'dd MMM yy' : 'LLL dd, y')
                ) : (
                  <span>Pick a date range</span>
                )}
                <ChevronDown className="ml-auto h-4 w-4 text-gray-400 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-gray-200 shadow-lg" align="start">
              <Calendar
                mode="range"
                defaultMonth={dateFrom || new Date()}
                selected={range}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
                className="p-3"
              />
            </PopoverContent>
          </Popover>
        </div>

        {showClear && (startDate || endDate) && (
          <div className={compact ? 'flex-none' : 'flex-1 sm:flex-none'}>
            {!compact && (
              <label className="block text-sm font-medium text-gray-700 mb-1.5 opacity-0 pointer-events-none">
                Clear
              </label>
            )}
            <Button
              onClick={handleClear}
              variant="secondary"
              className={compact ? 'h-10 w-10 p-0 flex items-center justify-center border-gray-300' : 'w-full sm:w-auto h-11 flex items-center justify-center gap-2 px-4 border-gray-300'}
              type="button"
            >
              <X className="h-4 w-4" />
              {!compact && <span className="hidden sm:inline">Clear</span>}
            </Button>
          </div>
        )}
      </div>

      {/* Preset Buttons - hidden in compact mode */}
      {showPresets && !compact && (
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
