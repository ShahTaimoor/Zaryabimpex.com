/**
 * Filter Chips Component
 * Quick filter chips for common filters
 */

import React from 'react';
import { X } from 'lucide-react';

export const FilterChip = ({ label, value, onRemove, className = '' }) => {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800 ${className}`}>
      {label}
      {value && <span className="ml-1 text-primary-600">: {value}</span>}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-primary-200 focus:outline-none"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
};

export const FilterChips = ({ filters, onRemove, onClearAll, className = '' }) => {
  if (!filters || Object.keys(filters).length === 0) {
    return null;
  }

  const formatFilterValue = (key, value) => {
    if (Array.isArray(value)) {
      return value.length > 0 ? `${value.length} selected` : '';
    }
    if (typeof value === 'object' && value !== null) {
      if (value.from && value.to) {
        return `${value.from} - ${value.to}`;
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const formatFilterLabel = (key) => {
    const labels = {
      status: 'Status',
      category: 'Category',
      stockStatus: 'Stock',
      priceRange: 'Price',
      dateRange: 'Date',
      lowStock: 'Low Stock',
      businessType: 'Type',
      customerTier: 'Tier'
    };
    return labels[key] || key;
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {Object.entries(filters).map(([key, value]) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return null;
        
        const label = formatFilterLabel(key);
        const displayValue = formatFilterValue(key, value);

        return (
          <FilterChip
            key={key}
            label={label}
            value={displayValue}
            onRemove={() => onRemove?.(key)}
          />
        );
      })}
      
      {onClearAll && Object.keys(filters).length > 1 && (
        <button
          onClick={onClearAll}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
};

export default FilterChips;

