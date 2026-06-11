import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { formatDateForInput, getDatePresets } from '../utils/dateUtils';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Unified date picker — same popover/calendar design across the POS.
 *
 * mode="range" (default) — start + end date, presets (Dashboard, reports, filters)
 *   startDate, endDate, onDateChange(start, end)
 *
 * mode="single" — one date (Business Date, Bill Date, voucher date, etc.)
 *   value, onChange(date), label, max, min
 */
const DateFilter = (props) => {
  if (props.mode === 'single') {
    return <SingleDatePicker {...props} />;
  }
  return <RangeDatePicker {...props} />;
};

function SingleDatePicker({
  label,
  value,
  onChange,
  required = false,
  placeholder = 'Pick a date',
  className = '',
  showLabel = true,
  size = 'md',
  max,
  min,
  disabled = false,
  id,
}) {
  const isSmall = size === 'sm';
  const triggerHeightClass = isSmall ? 'h-9 text-sm' : 'h-11';
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(`${value}T00:00:00`) : undefined;

  const handleSelect = (date) => {
    if (!date) {
      onChange?.('');
      return;
    }
    onChange?.(formatDateForInput(date));
    setOpen(false);
  };

  const isDateDisabled = (date) => {
    const dateStr = formatDateForInput(date);
    if (max && dateStr > max) return true;
    if (min && dateStr < min) return true;
    return false;
  };

  return (
    <div className={cn('min-w-0', className)}>
      {label != null && label !== '' && showLabel && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal border-gray-300 bg-white hover:bg-gray-50',
              triggerHeightClass,
              !value && 'text-gray-500'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-gray-400 shrink-0" />
            {selectedDate ? (
              <span className="truncate text-gray-900">
                {format(selectedDate, isSmall ? 'dd MMM yy' : 'LLL dd, y')}
              </span>
            ) : (
              <span>{placeholder}</span>
            )}
            <ChevronDown className="ml-auto h-4 w-4 text-gray-400 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-gray-200 shadow-lg" align="start">
          <Calendar
            mode="single"
            defaultMonth={selectedDate || new Date()}
            selected={selectedDate}
            onSelect={handleSelect}
            disabled={isDateDisabled}
            className="p-3"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RangeDatePicker({
  startDate: initialStartDate,
  endDate: initialEndDate,
  onDateChange,
  showPresets = true,
  required = false,
  className = '',
  compact = false,
  showClear = true,
  showLabel = true,
  size = 'md',
}) {
  const isSmall = size === 'sm';
  const triggerHeightClass = isSmall ? 'h-9 text-sm' : compact ? 'h-10 text-sm' : 'h-11';
  const clearHeightClass = isSmall ? 'h-9' : compact ? 'h-10' : 'h-11';
  const [startDate, setStartDate] = useState(initialStartDate || '');
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [popoverOpen, setPopoverOpen] = useState(false);

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

  const handlePresetSelect = (preset) => {
    setStartDate(preset.startDate);
    setEndDate(preset.endDate);
    onDateChange?.(preset.startDate, preset.endDate);
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    onDateChange?.('', '');
  };

  const presets = getDatePresets();

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
      <div className={compact ? 'flex items-center gap-2 flex-1 min-w-0' : 'flex flex-col sm:flex-row items-stretch sm:items-center gap-3'}>
        <div className={compact ? 'flex-1 min-w-0' : 'flex-1 min-w-0'}>
          {!compact && showLabel && (
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
                  triggerHeightClass,
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
            {!compact && showLabel && (
              <label className="block text-sm font-medium text-gray-700 mb-1.5 opacity-0 pointer-events-none">
                Clear
              </label>
            )}
            <Button
              onClick={handleClear}
              variant="outline"
              className={cn(
                'flex shrink-0 items-center justify-center gap-1.5 border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50',
                clearHeightClass,
                compact || isSmall ? 'w-auto' : 'w-full sm:w-auto px-4'
              )}
              type="button"
            >
              <X className="h-4 w-4" />
              {(compact || isSmall) && <span>Clear</span>}
              {!compact && !isSmall && <span className="hidden sm:inline">Clear</span>}
            </Button>
          </div>
        )}
      </div>

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
}

export default DateFilter;
