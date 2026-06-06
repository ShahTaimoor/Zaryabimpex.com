import { useState, useEffect, useMemo } from 'react';
import { useLazyGetProductsQuery } from '@/store/services/productsApi';
import { PRODUCT_SEARCH_DROPDOWN_LIMIT } from '@/constants/listPagination';

const DEBOUNCE_MS = 280;
const DEFAULT_LIMIT = PRODUCT_SEARCH_DROPDOWN_LIMIT;
const EMPTY_PARAMS = {};

function mergeSelected(list, selected) {
  const id = selected?.id || selected?._id;
  if (!id) return list;
  const has = list.some((p) => (p.id || p._id) === id);
  if (has) return list;
  return [selected, ...list];
}

/**
 * Debounced server-side product list for pickers (variants, transformations, filters).
 * Empty search loads the first `limit` rows from GET /api/products?search=&page=1&limit=20.
 */
export function useDebouncedProductSearch(searchTerm, options = {}) {
  const {
    selectedProduct = null,
    enabled = true,
    limit = DEFAULT_LIMIT,
    listMode = 'minimal',
    extraParams = EMPTY_PARAMS,
  } = options;
  const [debounced, setDebounced] = useState('');
  const [trigger, result] = useLazyGetProductsQuery();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(String(searchTerm ?? '').trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (!enabled) return;
    const params = { limit, listMode, ...extraParams };
    if (debounced.length > 0) params.search = debounced;
    trigger(params, true);
  }, [debounced, enabled, limit, listMode, extraParams, trigger]);

  const products = useMemo(() => {
    const data = result.data;
    const list =
      data?.data?.products ?? data?.products ?? (Array.isArray(data) ? data : []);
    return mergeSelected(list, selectedProduct);
  }, [result.data, selectedProduct]);

  return {
    products,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
  };
}
