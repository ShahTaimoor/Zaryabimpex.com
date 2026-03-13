/**
 * Advanced Search Component
 * Multi-field search with suggestions and history
 */

import React, { useRef, useEffect } from 'react';
import { Search, X, Clock } from 'lucide-react';
import { useAdvancedSearch } from '../hooks/useAdvancedSearch';

export const AdvancedSearch = ({
  placeholder = 'Search...',
  onSearch,
  searchFields = ['name', 'description'],
  suggestions = [],
  enableHistory = true,
  className = '',
  showFieldSelector = false,
  selectedFields = null,
  onFieldsChange = null,
  ...props
}) => {
  const {
    searchTerm,
    suggestions: searchSuggestions,
    showSuggestions,
    searchInputRef,
    setSearchTerm,
    selectSuggestion,
    clearSearch,
    setShowSuggestions,
    searchHistory
  } = useAdvancedSearch({
    searchFields,
    onSearch,
    suggestions,
    enableHistory
  });

  const containerRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowSuggestions]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Navigate down in suggestions
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Navigate up in suggestions
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchSuggestions.length > 0) {
        selectSuggestion(searchSuggestions[0]);
      } else if (searchTerm.trim()) {
        onSearch?.(searchTerm);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const displaySuggestions = showSuggestions && (searchSuggestions.length > 0 || searchHistory.length > 0);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          {...props}
        />

        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {displaySuggestions && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {/* Search Suggestions */}
          {searchSuggestions.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                Suggestions
              </div>
              {searchSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => selectSuggestion(suggestion)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                >
                  <Search className="inline-block h-4 w-4 mr-2 text-gray-400" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Search History */}
          {enableHistory && searchHistory.length > 0 && searchSuggestions.length === 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-t border-gray-200">
                Recent Searches
              </div>
              {searchHistory.slice(0, 5).map((item, index) => (
                <button
                  key={index}
                  onClick={() => selectSuggestion(item)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                >
                  <Clock className="inline-block h-4 w-4 mr-2 text-gray-400" />
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;

