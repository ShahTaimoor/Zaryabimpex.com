import { useCallback, useEffect, useMemo, useState } from 'react';

export function useCursorPagination(deps = []) {
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorByPage, setCursorByPage] = useState({});

  useEffect(() => {
    setCurrentPage(1);
    setCursorByPage({});
  }, deps);

  const currentCursor = currentPage > 1 ? cursorByPage[currentPage] : undefined;

  const updateFromPagination = useCallback((pagination) => {
    const nextCursor = pagination?.nextCursor;
    if (!nextCursor) return;
    setCursorByPage((prev) => {
      if (prev[currentPage + 1] === nextCursor) return prev;
      return { ...prev, [currentPage + 1]: nextCursor };
    });
  }, [currentPage]);

  const getUiPagination = useCallback((pagination, limit) => {
    const mode = pagination?.mode || 'offset';
    if (mode !== 'keyset') {
      const current = Number(pagination?.current ?? pagination?.page ?? currentPage) || 1;
      const pages = Math.max(1, Number(pagination?.pages) || 1);
      const total = Number(pagination?.total) || 0;
      return {
        mode,
        current,
        pages,
        total,
        limit: Number(pagination?.limit) || limit,
        hasPrev: current > 1,
        hasNext: current < pages,
      };
    }

    const hasMore = Boolean(pagination?.hasMore ?? pagination?.hasNext);
    return {
      mode,
      current: currentPage,
      pages: currentPage + (hasMore ? 1 : 0),
      total: Number(pagination?.total) || 0,
      limit: Number(pagination?.limit) || limit,
      hasPrev: currentPage > 1,
      hasNext: hasMore,
    };
  }, [currentPage]);

  const canNavigateToPage = useCallback((page) => {
    if (page <= 1) return true;
    return Boolean(cursorByPage[page]);
  }, [cursorByPage]);

  const goToPage = useCallback((page, fallbackHasNext = false) => {
    if (page < 1) return;
    if (page === currentPage) return;
    if (page < currentPage) {
      setCurrentPage(page);
      return;
    }
    if (canNavigateToPage(page) || (page === currentPage + 1 && fallbackHasNext)) {
      setCurrentPage(page);
    }
  }, [canNavigateToPage, currentPage]);

  return useMemo(() => ({
    currentPage,
    setCurrentPage,
    currentCursor,
    updateFromPagination,
    getUiPagination,
    canNavigateToPage,
    goToPage,
  }), [
    currentPage,
    currentCursor,
    updateFromPagination,
    getUiPagination,
    canNavigateToPage,
    goToPage,
  ]);
}
