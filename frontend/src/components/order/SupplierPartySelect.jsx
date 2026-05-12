import React, { useCallback } from 'react';
import { Phone } from 'lucide-react';
import { SearchableDropdown } from '@/components/SearchableDropdown';
import { getSupplierDisplayName } from '@/utils/partyDisplay';
import { getSupplierOutstanding } from '@/utils/partyBalance';

/**
 * Reusable supplier picker that wraps SearchableDropdown with the dropdown
 * row used by Purchase, PurchaseOrders, and PurchaseReturns. Renders
 * supplier name + outstanding balance line (when permission allows).
 */
export function SupplierPartySelect({
  items,
  selectedItem,
  onSelect,
  onSearch,
  loading,
  searchValue,
  className = '[&_input]:h-8',
  placeholder = 'Search suppliers by name, email, or business...',
  emptyMessage = 'No suppliers found',
  canViewBalance = false,
  canViewPhone = false,
  showSecondaryName = false,
  innerRef,
  renderExtra,
}) {
  const displayKey = useCallback(
    (supplier) => {
      if (!supplier) return null;
      const primaryName = getSupplierDisplayName(supplier, 'Unknown');
      const showSecondary =
        showSecondaryName &&
        supplier.name &&
        supplier.name !== primaryName;
      const outstanding = getSupplierOutstanding(supplier);

      return (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{primaryName}</span>
            {canViewBalance && (
              <span className="text-sm text-gray-600">
                {outstanding}
              </span>
            )}
          </div>
          {showSecondary && (
            <div className="text-xs text-gray-500">{supplier.name}</div>
          )}
          {canViewPhone && supplier.phone && (
            <div className="text-xs text-gray-500">Phone: {supplier.phone}</div>
          )}
          {typeof renderExtra === 'function' ? renderExtra(supplier) : null}
        </div>
      );
    },
    [canViewBalance, canViewPhone, showSecondaryName, renderExtra]
  );

  return (
    <SearchableDropdown
      ref={innerRef}
      className={className}
      placeholder={placeholder}
      items={items || []}
      onSelect={onSelect}
      onSearch={onSearch}
      displayKey={displayKey}
      selectedItem={selectedItem}
      loading={loading}
      emptyMessage={emptyMessage}
      value={searchValue}
    />
  );
}

/**
 * Compact supplier summary strip rendered next to the picker on Purchase
 * and PurchaseOrders. Shows name | type | outstanding | phone with the
 * same chip layout the customer strip uses.
 */
export function SupplierSummaryStrip({
  supplier,
  canViewBalance = false,
  canViewPhone = false,
  outstandingOverride,
  emptyPlaceholder = 'No supplier selected',
  className = 'lg:w-auto w-full lg:min-w-[360px] lg:max-w-xl lg:self-end',
  showEmptyPlaceholder = true,
  roundOutstanding = false,
}) {
  if (!supplier) {
    if (!showEmptyPlaceholder) return null;
    return (
      <div className={className}>
        <div className="hidden lg:flex items-center justify-center h-full px-8 border-2 border-dashed border-gray-100 rounded-xl">
          <span className="text-gray-400 text-sm font-medium italic">
            {emptyPlaceholder}
          </span>
        </div>
      </div>
    );
  }

  const name = getSupplierDisplayName(supplier, 'Unknown');
  const businessType = supplier.businessType || 'Wholesaler';
  const outstanding =
    outstandingOverride !== undefined && outstandingOverride !== null
      ? Number(outstandingOverride) || 0
      : getSupplierOutstanding(supplier);
  const formattedOutstanding = roundOutstanding
    ? Math.round(outstanding).toString()
    : outstanding.toFixed(2);

  return (
    <div className={className}>
      <div className="bg-gray-50 border border-gray-200 rounded-xl h-8 px-2 flex items-center">
        <div className="flex items-center gap-2 text-xs whitespace-nowrap overflow-hidden">
          <span className="font-bold text-gray-900 truncate">{name}</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600 capitalize">{businessType}</span>
          {canViewBalance && (
            <>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500 uppercase font-semibold">Outstanding</span>
              <span
                className={`font-bold ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}
              >
                {formattedOutstanding}
              </span>
            </>
          )}
          {canViewPhone && supplier.phone && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">|</span>
              <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500">{supplier.phone}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupplierPartySelect;
