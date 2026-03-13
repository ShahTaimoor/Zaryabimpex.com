/**
 * Advanced Search Hook
 * Provides multi-field search with history and suggestions
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Search history storage key
const SEARCH_HISTORY_KEY = 'searchHistory';
const MAX_HISTORY_ITEMS = 20;
const MAX_SUGGESTIONS = 10;

/**
 * useAdvancedSearch Hook
 * @param {Object} options - Search options
 * @param {Array} options.searchFields - Fields to search in
 * @param {Function} options.onSearch - Search callback
 * @param {Array} options.suggestions - Pre-populated suggestions
 * @param {boolean} options.enableHistory - Enable search history
 * @param {number} options.debounceMs - Debounce delay in ms
 */
export const useAdvancedSearch = (options = {}) => {
  const {
    searchFields = ['name', 'description'],
    onSearch = null,
    suggestions: initialSuggestions = [],
    enableHistory = true,
    debounceMs = 300
  } = options;

  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [filterPresets, setFilterPresets] = useState([]);
  
  const debounceTimerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load search history from localStorage
  useEffect(() => {
    if (enableHistory) {
      try {
        const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
        if (saved) {
          setSearchHistory(JSON.parse(saved));
        }
      } catch (error) {
        // Error loading search history - silent fail
      }
    }
  }, [enableHistory]);

  // Load filter presets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('filterPresets');
      if (saved) {
        setFilterPresets(JSON.parse(saved));
      }
    } catch (error) {
      // Error loading filter presets - silent fail
    }
  }, []);

  // Save search to history
  const saveToHistory = useCallback((term) => {
    if (!enableHistory || !term || term.trim().length === 0) return;

    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== term.toLowerCase());
      const updated = [term, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch (error) {
        // Error saving search history - silent fail
      }
      
      return updated;
    });
  }, [enableHistory]);

  // Generate suggestions from history and initial suggestions
  const generateSuggestions = useCallback((term) => {
    if (!term || term.trim().length === 0) {
      setSuggestions(searchHistory.slice(0, MAX_SUGGESTIONS));
      return;
    }

    const termLower = term.toLowerCase();
    const matched = [];

    // Match from history
    searchHistory.forEach(item => {
      if (item.toLowerCase().includes(termLower) && !matched.includes(item)) {
        matched.push(item);
      }
    });

    // Match from initial suggestions
    initialSuggestions.forEach(item => {
      const text = typeof item === 'string' ? item : (item.name || item.label || '');
      if (text.toLowerCase().includes(termLower) && !matched.includes(text)) {
        matched.push(text);
      }
    });

    setSuggestions(matched.slice(0, MAX_SUGGESTIONS));
  }, [searchHistory, initialSuggestions]);

  // Handle search term change
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    generateSuggestions(value);
    setShowSuggestions(true);

    // Debounce search execution
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (onSearch) {
        onSearch(value, activeFilters);
      }
      if (value.trim().length > 0) {
        saveToHistory(value);
      }
    }, debounceMs);
  }, [onSearch, activeFilters, debounceMs, saveToHistory, generateSuggestions]);

  // Select suggestion
  const selectSuggestion = useCallback((suggestion) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    if (onSearch) {
      onSearch(suggestion, activeFilters);
    }
    saveToHistory(suggestion);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [onSearch, activeFilters, saveToHistory]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setShowSuggestions(false);
    if (onSearch) {
      onSearch('', activeFilters);
    }
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [onSearch, activeFilters]);

  // Apply filter
  const applyFilter = useCallback((filterKey, filterValue) => {
    setActiveFilters(prev => {
      const updated = { ...prev, [filterKey]: filterValue };
      if (onSearch) {
        onSearch(searchTerm, updated);
      }
      return updated;
    });
  }, [searchTerm, onSearch]);

  // Remove filter
  const removeFilter = useCallback((filterKey) => {
    setActiveFilters(prev => {
      const updated = { ...prev };
      delete updated[filterKey];
      if (onSearch) {
        onSearch(searchTerm, updated);
      }
      return updated;
    });
  }, [searchTerm, onSearch]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
    if (onSearch) {
      onSearch(searchTerm, {});
    }
  }, [searchTerm, onSearch]);

  // Save filter preset
  const saveFilterPreset = useCallback((name, filters) => {
    const preset = {
      id: Date.now().toString(),
      name,
      filters: { ...filters },
      createdAt: new Date().toISOString()
    };

    setFilterPresets(prev => {
      const updated = [...prev, preset];
      try {
        localStorage.setItem('filterPresets', JSON.stringify(updated));
      } catch (error) {
        // Error saving filter preset - silent fail
      }
      return updated;
    });

    return preset;
  }, []);

  // Load filter preset
  const loadFilterPreset = useCallback((presetId) => {
    const preset = filterPresets.find(p => p.id === presetId);
    if (preset) {
      setActiveFilters(preset.filters);
      if (onSearch) {
        onSearch(searchTerm, preset.filters);
      }
    }
  }, [filterPresets, searchTerm, onSearch]);

  // Delete filter preset
  const deleteFilterPreset = useCallback((presetId) => {
    setFilterPresets(prev => {
      const updated = prev.filter(p => p.id !== presetId);
      try {
        localStorage.setItem('filterPresets', JSON.stringify(updated));
      } catch (error) {
        // Error deleting filter preset - silent fail
      }
      return updated;
    });
  }, []);

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      // Error clearing search history - silent fail
    }
  }, []);

  return {
    // State
    searchTerm,
    searchHistory,
    suggestions,
    showSuggestions,
    activeFilters,
    filterPresets,
    searchInputRef,

    // Actions
    setSearchTerm: handleSearchChange,
    selectSuggestion,
    clearSearch,
    applyFilter,
    removeFilter,
    clearAllFilters,
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    clearHistory,
    setShowSuggestions,

    // Helpers
    hasActiveFilters: Object.keys(activeFilters).length > 0,
    hasFilters: Object.keys(activeFilters).length > 0
  };
};

export default useAdvancedSearch;

