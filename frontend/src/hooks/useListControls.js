import { useCallback, useState } from 'react';

/**
 * Shared filter / pagination / sort state for list pages.
 *
 * Replaces the identical `useState` triplet (`filters`, `pagination`,
 * `sortConfig`) plus `handleFilterChange` / `handleSort` handlers that
 * were duplicated across SalesOrders, PurchaseOrders, BankReceipts,
 * BankPayments, CashReceipts, and CashPayments.
 *
 * Pages typically destructure with renames so existing JSX keeps
 * working unchanged:
 *
 *   const {
 *     filters, setFilters,
 *     pagination, setPagination,
 *     sortConfig, setSortConfig,
 *     setFilter: handleFilterChange,
 *     toggleSort: handleSort,
 *     setPage: handlePageChange,
 *     setLimit: handleLimitChange,
 *   } = useListControls({
 *     initialFilters: { fromDate: today, toDate: today },
 *     initialSort: { key: 'date', direction: 'desc' },
 *   });
 *
 * Behavioural rules (matching the original duplicated handlers):
 *   - `setFilter(key, value)` resets `pagination.page` to 1.
 *   - `setLimit(limit)` resets `pagination.page` to 1.
 *   - `toggleSort(key)` flips direction when the same key is clicked
 *     twice; otherwise sets direction to 'asc'.
 */
export function useListControls({
  initialFilters = {},
  initialPagination = { page: 1, limit: 50 },
  initialSort = { key: 'date', direction: 'desc' },
} = {}) {
  const [filters, setFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState(initialPagination);
  const [sortConfig, setSortConfig] = useState(initialSort);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const resetFilters = useCallback(
    (next = initialFilters) => {
      setFilters(next);
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    [initialFilters]
  );

  const toggleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const setPage = useCallback((page) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  return {
    filters,
    setFilters,
    setFilter,
    resetFilters,
    pagination,
    setPagination,
    setPage,
    setLimit,
    sortConfig,
    setSortConfig,
    toggleSort,
  };
}

export default useListControls;
