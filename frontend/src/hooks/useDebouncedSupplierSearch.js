import { useState, useEffect, useMemo } from 'react';
import { useLazyGetSuppliersQuery } from '@/store/services/suppliersApi';

const DEBOUNCE_MS = 280;
const DEFAULT_LIMIT = 120;

function mergeSelected(list, selected) {
  const id = selected?.id || selected?._id;
  if (!id) return list;
  const has = list.some((s) => (s.id || s._id) === id);
  if (has) return list;
  return [selected, ...list];
}

/**
 * Debounced server-side supplier list for dropdowns.
 */
export function useDebouncedSupplierSearch(searchTerm, options = {}) {
  const { selectedSupplier = null, enabled = true, limit = DEFAULT_LIMIT } = options;
  const [debounced, setDebounced] = useState('');
  const [trigger, result] = useLazyGetSuppliersQuery();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(String(searchTerm ?? '').trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (!enabled) return;
    const params = { limit };
    if (debounced.length > 0) params.search = debounced;
    trigger(params, true);
  }, [debounced, enabled, limit, trigger]);

  const suppliers = useMemo(() => {
    const data = result.data;
    const list =
      data?.data?.suppliers ?? data?.suppliers ?? (Array.isArray(data) ? data : []);
    return mergeSelected(list, selectedSupplier);
  }, [result.data, selectedSupplier]);

  return {
    suppliers,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
  };
}
