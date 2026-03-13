/**
 * Integrated Search and Filters Component
 * Combines advanced search, filter builder, presets, and chips
 */

import React, { useState } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp, Save } from 'lucide-react';
import AdvancedSearch from './AdvancedSearch';
import AdvancedFilterBuilder from './AdvancedFilterBuilder';
import FilterChips from './FilterChips';
import FilterPresets from './FilterPresets';
import { useAdvancedSearch } from '../hooks/useAdvancedSearch';

export const IntegratedSearchFilters = ({
  onSearch,
  onFiltersChange,
  searchFields = ['name', 'description'],
  availableFields = [],
  categories = [],
  statusOptions = [],
  quickFilters = [],
  className = ''
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState([]);
  
  const {
    searchTerm,
    activeFilters,
    filterPresets,
    setSearchTerm,
    applyFilter,
    removeFilter,
    clearAllFilters,
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    hasActiveFilters
  } = useAdvancedSearch({
    searchFields,
    onSearch: (term, filters) => {
      onSearch?.(term, filters);
    },
    enableHistory: true
  });

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    // Convert filter builder filters to active filters format
    const convertedFilters = {};
    newFilters.forEach(filter => {
      convertedFilters[filter.field] = filter.value;
    });
    onFiltersChange?.(convertedFilters);
  };

  const handleQuickFilter = (filterKey, filterValue) => {
    applyFilter(filterKey, filterValue);
  };

  const handleSavePreset = (name, currentFilters) => {
    saveFilterPreset(name, { ...activeFilters, ...currentFilters });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          <AdvancedSearch
            placeholder="Search by name, SKU, barcode, description..."
            onSearch={(term) => {
              setSearchTerm(term);
              onSearch?.(term, activeFilters);
            }}
            searchFields={searchFields}
            enableHistory={true}
          />
        </div>
        
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`px-4 py-2 border border-gray-300 rounded-md text-sm font-medium flex items-center ${
            hasActiveFilters || filters.length > 0
              ? 'bg-primary-50 text-primary-700 border-primary-300'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {(hasActiveFilters || filters.length > 0) && (
            <span className="ml-2 px-2 py-0.5 bg-primary-600 text-white rounded-full text-xs">
              {Object.keys(activeFilters).length + filters.length}
            </span>
          )}
          {showAdvancedFilters ? (
            <ChevronUp className="h-4 w-4 ml-2" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-2" />
          )}
        </button>
      </div>

      {/* Quick Filter Chips */}
      {quickFilters.length > 0 && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Quick filters:</span>
          {quickFilters.map(filter => (
            <button
              key={filter.key}
              onClick={() => handleQuickFilter(filter.key, filter.value)}
              className={`px-3 py-1 rounded-full text-sm ${
                activeFilters[filter.key] === filter.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Active Filter Chips */}
      {(hasActiveFilters || filters.length > 0) && (
        <FilterChips
          filters={{ ...activeFilters }}
          onRemove={removeFilter}
          onClearAll={clearAllFilters}
        />
      )}

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <AdvancedFilterBuilder
              filters={filters}
              onFiltersChange={handleFiltersChange}
              availableFields={availableFields}
              categories={categories}
              statusOptions={statusOptions}
            />
          </div>
          
          <div>
            <FilterPresets
              presets={filterPresets}
              currentFilters={{ ...activeFilters }}
              onLoadPreset={loadFilterPreset}
              onSavePreset={handleSavePreset}
              onDeletePreset={deleteFilterPreset}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedSearchFilters;

