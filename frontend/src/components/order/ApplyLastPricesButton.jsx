import React from 'react';
import { History, RotateCcw, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { LoadingButton } from '@/components/LoadingSpinner';

/**
 * Reusable Apply / Restore "last prices" button used by Sales and
 * SalesOrders. Renders nothing if there's no customer selected, the cart
 * is empty, or the user lacks permission. Toggles label / icon based on
 * `isApplied` state.
 */
export function ApplyLastPricesButton({
  isApplied,
  isApplying = false,
  isRestoring = false,
  onApply,
  onRestore,
  hasCustomer,
  hasItems,
  canApply = true,
  applyLabel = 'Apply Last Prices',
  restoreLabel = 'Restore Current Prices',
  size = 'sm',
  className,
}) {
  if (!canApply || !hasCustomer || !hasItems) return null;
  const baseCls = 'flex items-center space-x-2';

  if (!isApplied) {
    return (
      <LoadingButton
        onClick={onApply}
        isLoading={isApplying}
        variant="secondary"
        size={size}
        className={className ?? baseCls}
        title="Apply prices from last order for this customer"
      >
        <History className="h-4 w-4 mr-2" />
        {applyLabel}
      </LoadingButton>
    );
  }

  return (
    <LoadingButton
      onClick={onRestore}
      isLoading={isRestoring}
      variant="secondary"
      size={size}
      className={className ?? baseCls}
      title="Restore original/current prices"
    >
      <RotateCcw className="h-4 w-4 mr-2" />
      {restoreLabel}
    </LoadingButton>
  );
}

/**
 * Inline legend showing the status icons (Updated / Same Price / Not in
 * Last Order) used above the cart when last prices are applied.
 */
export function LastPricesStatusLegend({ className = '' }) {
  return (
    <div className={`flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs ${className}`}>
      <span className="text-gray-600 font-medium">Price Status:</span>
      <div className="flex items-center space-x-1">
        <CheckCircle className="h-3 w-3 text-green-600" />
        <span className="text-gray-600">Updated</span>
      </div>
      <div className="flex items-center space-x-1">
        <Info className="h-3 w-3 text-blue-600" />
        <span className="text-gray-600">Same Price</span>
      </div>
      <div className="flex items-center space-x-1">
        <AlertCircle className="h-3 w-3 text-yellow-600" />
        <span className="text-gray-600">Not in Last Order</span>
      </div>
    </div>
  );
}

export default ApplyLastPricesButton;
