import { useMemo } from 'react';
import { fuzzySearch, quickSearch } from '../utils/fuzzySearch';

/**
 * Custom hook for fuzzy search functionality
 * @param {Array} items - Items to search through
 * @param {string} searchTerm - Search term
 * @param {Function|string|Array} searchFields - Field(s) to search in
 * @param {Object} options - Search options
 * @returns {Array} - Filtered and sorted results
 */
export const useFuzzySearch = (items, searchTerm, searchFields, options = {}) => {
  return useMemo(() => {
    if (!items || !Array.isArray(items)) return [];
    if (!searchTerm || searchTerm.trim().length === 0) return items;
    
    return fuzzySearch(items, searchTerm, searchFields, options);
  }, [items, searchTerm, searchFields, options]);
};

/**
 * Quick fuzzy search hook for common use cases
 * @param {Array} items - Items to search
 * @param {string} searchTerm - Search term
 * @param {Array} fields - Fields to search (default: ['name'])
 * @returns {Array} - Filtered results
 */
export const useQuickFuzzySearch = (items, searchTerm, fields = ['name']) => {
  return useMemo(() => {
    if (!items || !Array.isArray(items)) return [];
    if (!searchTerm || searchTerm.trim().length === 0) return items;
    
    return quickSearch(items, searchTerm, fields);
  }, [items, searchTerm, fields]);
};

