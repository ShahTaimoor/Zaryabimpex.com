import React, { useState } from 'react';
import { 
  Filter, 
  X, 
  ChevronDown, 
  ChevronUp,
  Search,
  Package,
  Tag,
  AlertTriangle
} from 'lucide-react';

const ProductFilters = ({ filters, onFiltersChange, categories = [], onClearFilters }) => {
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
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap">
          <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          <span className="text-sm sm:text-base font-medium text-gray-900">Filters</span>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
              {getActiveFiltersCount()} active
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="text-xs sm:text-sm text-red-600 hover:text-red-800 font-medium btn-md"
            >
              Clear All
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Search Filter */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                <Search className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                Search Products
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Product name or description..."
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="input pl-8"
                />
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                {filters.search && (
                  <button
                    onClick={() => handleClearFilter('search')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                <Package className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                <Tag className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                Category
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="input"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Status Filter */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                Stock Status
              </label>
              <select
                value={filters.stockStatus || ''}
                onChange={(e) => handleFilterChange('stockStatus', e.target.value)}
                className="input"
              >
                <option value="">All Stock Levels</option>
                <option value="lowStock">Low Stock</option>
                <option value="outOfStock">Out of Stock</option>
                <option value="inStock">In Stock</option>
              </select>
            </div>

          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">Active Filters:</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(filters).map(([key, value]) => {
                  if (!value || value === '') return null;
                  
                  let displayValue = value;
                  let label = key;
                  
                  // Format display values
                  switch (key) {
                    case 'status':
                      label = 'Status';
                      displayValue = value.charAt(0).toUpperCase() + value.slice(1);
                      break;
                    case 'category':
                      label = 'Category';
                      const category = categories.find(c => c._id === value);
                      displayValue = category ? category.name : value;
                      break;
                    case 'stockStatus':
                      label = 'Stock';
                      displayValue = value === 'lowStock' ? 'Low Stock' : 
                                   value === 'outOfStock' ? 'Out of Stock' : 
                                   value === 'inStock' ? 'In Stock' : value;
                      break;
                    case 'search':
                      label = 'Search';
                      displayValue = `"${value}"`;
                      break;
                    default:
                      label = key.charAt(0).toUpperCase() + key.slice(1);
                  }
                  
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {label}: {displayValue}
                      <button
                        onClick={() => handleClearFilter(key)}
                        className="ml-1 hover:text-blue-600"
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

export default ProductFilters;
