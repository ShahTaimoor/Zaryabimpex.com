import React, { useCallback } from 'react';
import { SearchableDropdown } from '@/components/SearchableDropdown';
import {
  getCustomerDisplayName,
} from '@/utils/partyDisplay';
import {
  getCustomerBalance,
  getCustomerCreditLimit,
} from '@/utils/partyBalance';

/**
 * Reusable customer picker that wraps SearchableDropdown with a consistent
 * dropdown row renderer (name + total balance line). Replaces the
 * `displayKey` blocks duplicated across Sales, SalesOrders, and
 * SaleReturns.
 *
 * Pass `canViewBalance` to control whether the per-row balance hint is
 * rendered. Use the companion <CustomerBalanceStrip /> component for the
 * detailed balance/credit strip that some pages render alongside.
 */
export function CustomerPartySelect({
  items,
  selectedItem,
  onSelect,
  onSearch,
  loading,
  searchValue,
  className = '[&_input]:h-8',
  placeholder = 'Search customers by name, email, or business...',
  emptyMessage = 'No customers found',
  rightContentKey = 'city',
  canViewBalance = false,
  showSecondaryName = false,
  innerRef,
  renderExtra,
}) {
  const displayKey = useCallback(
    (customer) => {
      if (!customer) return null;
      const primaryName = getCustomerDisplayName(customer, 'Unknown');
      const showSecondary =
        showSecondaryName &&
        customer.name &&
        customer.name !== primaryName;
      const totalBalance = getCustomerBalance(customer);
      const hasBalance = totalBalance !== 0;
      const isPayable = totalBalance < 0;

      return (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{primaryName}</span>
            {canViewBalance && hasBalance ? (
              <span className={`text-sm ${isPayable ? 'text-red-600' : 'text-green-600'}`}>
                {isPayable ? '-' : '+'}{Math.abs(totalBalance)}
              </span>
            ) : null}
          </div>
          {showSecondary && (
            <div className="text-xs text-gray-500">{customer.name}</div>
          )}
          {typeof renderExtra === 'function' ? renderExtra(customer) : null}
        </div>
      );
    },
    [canViewBalance, showSecondaryName, renderExtra]
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
      rightContentKey={rightContentKey}
      value={searchValue}
    />
  );
}

/**
 * Compact balance / credit / available strip rendered next to the customer
 * picker on Sales and SalesOrders. Renders nothing when `canViewBalance`
 * is false. Pass `placeholder` to render the dashed "No customer selected"
 * placeholder when no customer is chosen.
 */
export function CustomerBalanceStrip({
  customer,
  canViewBalance = false,
  showCredit = true,
  balanceOverride,
  creditLimitOverride,
  emptyPlaceholder = 'No customer selected',
  className = 'lg:w-auto w-full lg:max-w-md lg:self-end',
  showEmptyPlaceholder = true,
}) {
  if (!customer || !canViewBalance) {
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

  const totalBalance =
    balanceOverride !== undefined && balanceOverride !== null
      ? Number(balanceOverride) || 0
      : getCustomerBalance(customer);
  const isPayable = totalBalance < 0;
  const isReceivable = totalBalance > 0;
  const creditLimit =
    creditLimitOverride !== undefined && creditLimitOverride !== null
      ? Math.max(0, Number(creditLimitOverride) || 0)
      : getCustomerCreditLimit(customer);
  const availableCredit = Math.max(0, creditLimit - totalBalance);

  const balanceColor = isPayable
    ? 'text-red-600'
    : isReceivable
    ? 'text-green-600'
    : 'text-gray-600';

  const creditColor =
    creditLimit > 0
      ? totalBalance >= creditLimit * 0.9
        ? 'text-red-600'
        : totalBalance >= creditLimit * 0.7
        ? 'text-yellow-600'
        : 'text-blue-600'
      : 'text-gray-600';

  const availableColor =
    creditLimit > 0
      ? availableCredit <= creditLimit * 0.1
        ? 'text-red-600'
        : availableCredit <= creditLimit * 0.3
        ? 'text-yellow-600'
        : 'text-green-600'
      : 'text-gray-600';

  return (
    <div className={className}>
      <div className="bg-gray-50 border border-gray-200 rounded-xl h-8 px-2 flex items-center">
        <div className="flex items-center gap-2 text-xs whitespace-nowrap overflow-hidden">
          <span className="text-gray-500 uppercase font-semibold">Balance</span>
          <span className={`font-bold ${balanceColor}`}>
            {isPayable ? '-' : ''}
            {Math.abs(totalBalance).toFixed(2)}
          </span>
          {showCredit && (
            <>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500 uppercase font-semibold">Credit</span>
              <span className={`font-bold ${creditColor}`}>
                {creditLimit.toFixed(2)}
                {creditLimit > 0 && totalBalance >= creditLimit * 0.9 && (
                  <span className="ml-1">⚠️</span>
                )}
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500 uppercase font-semibold">Available</span>
              <span className={`font-bold ${availableColor}`}>
                {availableCredit.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerPartySelect;
