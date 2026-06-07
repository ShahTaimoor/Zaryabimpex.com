import React from 'react';
import { RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

/**
 * Standard "Results" card-header used by Bank/Cash Receipts/Payments and
 * other list pages. Encapsulates the title, optional date-range subtitle,
 * record-count chip, and refresh button.
 *
 * Replaces ~22 lines of duplicated JSX per page:
 *   <div className="card-header">
 *     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 *       <h3 ...>{title}<span ...>From: ... To: ...</span></h3>
 *       <div ...>
 *         <span ...>{count} records</span>
 *         <button onClick={onRefresh}><RefreshCw .../></button>
 *       </div>
 *     </div>
 *   </div>
 */
export function ListResultsHeader({
  title,
  subtitle,
  fromDate,
  toDate,
  formatDate,
  recordCount,
  onRefresh,
  refreshing = false,
  rightExtra,
  recordLabel = 'records',
}) {
  const computedSubtitle =
    subtitle ??
    (fromDate || toDate
      ? `From: ${formatDate ? formatDate(fromDate) : fromDate || ''} To: ${
          formatDate ? formatDate(toDate) : toDate || ''
        }`
      : null);

  return (
    <div className="card-header">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 leading-tight">
          {title}
          {computedSubtitle && (
            <span className="block sm:inline sm:ml-2 text-xs sm:text-sm font-normal text-gray-500 mt-1 sm:mt-0">
              {computedSubtitle}
            </span>
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {typeof recordCount === 'number' && (
            <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              <span className="font-semibold text-gray-700">
                {recordCount}
              </span>{' '}
              {recordLabel}
            </span>
          )}
          {rightExtra}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh"
            >
              {refreshing ? (
                <LoadingSpinner size="sm" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ListResultsHeader;
