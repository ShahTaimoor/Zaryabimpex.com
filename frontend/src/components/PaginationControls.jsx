import React from 'react';

/**
 * PaginationControls - Reusable pagination UI
 *
 * Props:
 *   - page: number - Current page (1-based)
 *   - totalPages: number - Total number of pages
 *   - onPageChange: (page: number) => void - Called when page changes
 *   - totalItems: number - Optional total count for "Showing X to Y of Z" text
 *   - limit: number - Items per page (used with totalItems for display)
 *   - maxVisiblePages: number - Max page number buttons to show (default: 5)
 *   - showItemsInfo: boolean - Show "Showing X to Y of Z results" (default: true when totalItems provided)
 *   - className: string - Additional wrapper classes
 */
const PaginationControls = ({
  page,
  totalPages,
  onPageChange,
  totalItems,
  limit = 10,
  maxVisiblePages = 5,
  showItemsInfo = !!totalItems,
  className = ''
}) => {
  if (!totalPages || totalPages <= 1) return null;

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, totalItems ?? page * limit);

  const pageButtonClass = (isActive) =>
    `relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
      isActive
        ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
    }`;

  const navButtonClass =
    'relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';

  const visiblePages = Math.min(maxVisiblePages, totalPages);
  const startPage = Math.max(1, Math.min(page - Math.floor(visiblePages / 2), totalPages - visiblePages + 1));
  const pageNumbers = Array.from({ length: visiblePages }, (_, i) => startPage + i);

  return (
    <div className={`bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 ${className}`}>
      {/* Mobile: Prev/Next only */}
      <div className="flex-1 flex justify-between sm:hidden gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={navButtonClass}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={navButtonClass}
        >
          Next
        </button>
      </div>

      {/* Desktop: Full controls */}
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        {showItemsInfo && totalItems != null && (
          <div>
            <p className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">{startItem}</span> to{' '}
              <span className="font-medium">{endItem}</span> of{' '}
              <span className="font-medium">{totalItems}</span> results
            </p>
          </div>
        )}
        {!showItemsInfo && <div />}
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className={`${navButtonClass} rounded-l-md`}
              aria-label="Previous page"
            >
              Previous
            </button>
            {pageNumbers.map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={pageButtonClass(page === pageNum)}
              >
                {pageNum}
              </button>
            ))}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className={`${navButtonClass} rounded-r-md`}
              aria-label="Next page"
            >
              Next
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default PaginationControls;
