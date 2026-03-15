import React, { useState } from 'react';
import { 
  Filter, 
  X, 
  ChevronDown, 
  ChevronUp,
  Search,
  Building,
  Mail,
  Phone
} from 'lucide-react';

const SupplierFilters = ({ filters, onFiltersChange, onClearFilters }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleClearFilter = (key) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const handleClearAll = () => {
    onFiltersChange({});
    if (onClearFilters) onClearFilters();
  };

  const hasActiveFilters = Object.keys(filters).some(key => 
    filters[key] !== '' && filters[key] !== null && filters[key] !== undefined
  );

  const getActiveFiltersCount = () => {
    return Object.keys(filters).filter(key => 
      filters[key] !== '' && filters[key] !== null && filters[key] !== undefined
    ).length;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Filter Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <Filter className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-900">Filters</span>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
              {getActiveFiltersCount()} active
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Clear All
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Search Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="h-4 w-4 inline mr-1" />
                Search Suppliers
              </label>
              <input
                type="text"
                placeholder="Company name, contact..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="input text-sm"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="h-4 w-4 inline mr-1" />
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input text-sm"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Email Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="h-4 w-4 inline mr-1" />
                Email Status
              </label>
              <select
                value={filters.emailStatus || ''}
                onChange={(e) => handleFilterChange('emailStatus', e.target.value)}
                className="input text-sm"
              >
                <option value="">All Email Statuses</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
                <option value="no-email">No Email</option>
              </select>
            </div>

            {/* Phone Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="h-4 w-4 inline mr-1" />
                Phone Status
              </label>
              <select
                value={filters.phoneStatus || ''}
                onChange={(e) => handleFilterChange('phoneStatus', e.target.value)}
                className="input text-sm"
              >
                <option value="">All Phone Statuses</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
                <option value="no-phone">No Phone</option>
              </select>
            </div>

          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Active Filters:</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(filters).map(([key, value]) => {
                  if (!value || value === '') return null;
                  
                  let label, displayValue;
                  switch (key) {
                    case 'search':
                      label = 'Search';
                      displayValue = `"${value}"`;
                      break;
                    case 'status':
                      label = 'Status';
                      displayValue = value.charAt(0).toUpperCase() + value.slice(1);
                      break;
                    case 'emailStatus':
                      label = 'Email';
                      displayValue = value === 'verified' ? 'Verified' : 
                                   value === 'unverified' ? 'Unverified' : 
                                   value === 'no-email' ? 'No Email' : value;
                      break;
                    case 'phoneStatus':
                      label = 'Phone';
                      displayValue = value === 'verified' ? 'Verified' : 
                                   value === 'unverified' ? 'Unverified' : 
                                   value === 'no-phone' ? 'No Phone' : value;
                      break;
                    default:
                      label = key.charAt(0).toUpperCase() + key.slice(1);
                      displayValue = value;
                  }
                  
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {label}: {displayValue}
                      <button
                        onClick={() => handleClearFilter(key)}
                        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SupplierFilters;
