import { useState, useEffect, useMemo } from 'react';
import { useLazyGetVariantsQuery } from '@/store/services/productVariantsApi';

const DEBOUNCE_MS = 280;
const DEFAULT_LIMIT = 50;

function mergeSelected(list, selected) {
  const id = selected?.id || selected?._id;
  if (!id) return list;
  const has = list.some((v) => (v.id || v._id) === id);
  if (has) return list;
  return [selected, ...list];
}

/**
 * Debounced server-side variant list for pickers (scoped to a base product when provided).
 */
export function useDebouncedVariantSearch(searchTerm, options = {}) {
  const {
    baseProductId = null,
    selectedVariant = null,
    enabled = true,
    limit = DEFAULT_LIMIT,
    status = 'active',
  } = options;
  const [debounced, setDebounced] = useState('');
  const [trigger, result] = useLazyGetVariantsQuery();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(String(searchTerm ?? '').trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (!enabled || !baseProductId) return;
    const params = { limit, status, baseProduct: baseProductId };
    if (debounced.length > 0) params.search = debounced;
    trigger(params, true);
  }, [debounced, enabled, baseProductId, limit, status, trigger]);

  const variants = useMemo(() => {
    const data = result.data;
    const list =
      data?.data?.variants ?? data?.variants ?? (Array.isArray(data) ? data : []);
    return mergeSelected(list, selectedVariant);
  }, [result.data, selectedVariant]);

  return {
    variants,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
  };
}
