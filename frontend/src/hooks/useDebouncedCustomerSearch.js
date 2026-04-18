import { useState, useEffect, useMemo } from 'react';
import { useLazyGetCustomersQuery } from '@/store/services/customersApi';

const DEBOUNCE_MS = 280;
const DEFAULT_LIMIT = 120;

function mergeSelected(list, selected) {
  const id = selected?.id || selected?._id;
  if (!id) return list;
  const has = list.some((c) => (c.id || c._id) === id);
  if (has) return list;
  return [selected, ...list];
}

/**
 * Debounced server-side customer list for dropdowns (cash/bank, sales, etc.).
 * Empty search loads the first `limit` rows (API default sort).
 */
export function useDebouncedCustomerSearch(searchTerm, options = {}) {
  const { selectedCustomer = null, enabled = true, limit = DEFAULT_LIMIT } = options;
  const [debounced, setDebounced] = useState('');
  const [trigger, result] = useLazyGetCustomersQuery();

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

  const customers = useMemo(() => {
    const data = result.data;
    const list =
      data?.data?.customers ?? data?.customers ?? (Array.isArray(data) ? data : []);
    return mergeSelected(list, selectedCustomer);
  }, [result.data, selectedCustomer]);

  return {
    customers,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
  };
}
