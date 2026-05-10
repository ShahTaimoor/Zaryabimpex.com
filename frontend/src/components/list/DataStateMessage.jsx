import React from 'react';
import { RefreshCw } from 'lucide-react';
import { handleApiError } from '@/utils/errorHandler';

/**
 * Dispatcher component for the standard 3-state list shell:
 *   isLoading   -> spinner + loading text
 *   error       -> red error message
 *   isEmpty     -> grey empty message
 *   otherwise   -> renders children (the actual table/list)
 *
 * Replaces the duplicated 12-line ternary across BankReceipts /
 * BankPayments / CashReceipts / CashPayments etc.:
 *
 *   {isLoading ? (...) : error ? (...) : items.length === 0 ? (...) : ( <table/> )}
 *
 * Usage:
 *   <DataStateMessage
 *     isLoading={isLoading}
 *     error={error}
 *     isEmpty={items.length === 0}
 *     loadingLabel="Loading bank receipts..."
 *     errorPrefix="Error loading bank receipts"
 *     emptyLabel="No bank receipts found for the selected criteria."
 *   >
 *     <table>...</table>
 *   </DataStateMessage>
 */
export function DataStateMessage({
  isLoading,
  error,
  isEmpty,
  loadingLabel = 'Loading...',
  errorPrefix = 'Error loading data',
  emptyLabel = 'No records found.',
  className = 'p-8 text-center',
  children,
}) {
  if (isLoading) {
    return (
      <div className={className}>
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
        <p className="mt-2 text-gray-500">{loadingLabel}</p>
      </div>
    );
  }

  if (error) {
    const message = (() => {
      try {
        return handleApiError(error)?.message;
      } catch (_) {
        return error?.message || String(error);
      }
    })();
    return (
      <div className={`${className} text-red-600`}>
        <p>
          {errorPrefix}: {message}
        </p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={`${className} text-gray-500`}>
        <p>{emptyLabel}</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default DataStateMessage;
