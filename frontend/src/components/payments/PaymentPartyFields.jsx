import React, { useCallback, useMemo } from 'react';
import { CustomerPartySelect } from '@/components/order/CustomerPartySelect';
import { SupplierPartySelect } from '@/components/order/SupplierPartySelect';
import { SearchableDropdown } from '@/components/SearchableDropdown';
import { getCustomerDisplayName, getSupplierDisplayName } from '@/utils/partyDisplay';
import { PaymentFormField } from '@/components/payments/PaymentFormLayout';

const DROPDOWN_INPUT_CLASS = '[&_input]:h-11 [&_input]:rounded-lg [&_input]:border-neutral-200 [&_input]:shadow-sm';

export function PaymentCustomerField({
  label = 'Customer',
  required = false,
  customers,
  selectedCustomer,
  onSelect,
  onSearch,
  searchValue,
  loading = false,
  canViewBalance = false,
  placeholder = 'Search or select customer...',
}) {
  const handleSelect = useCallback(
    (customer) => onSelect?.(customer),
    [onSelect]
  );

  const emptyMessage = searchValue?.trim()
    ? 'No customers found'
    : 'Start typing to search customers...';

  return (
    <PaymentFormField label={label} required={required}>
      <CustomerPartySelect
        items={customers}
        selectedItem={selectedCustomer}
        onSelect={handleSelect}
        onSearch={onSearch}
        searchValue={searchValue}
        loading={loading}
        canViewBalance={canViewBalance}
        showSecondaryName
        serverSideSearch
        className={DROPDOWN_INPUT_CLASS}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
      />
    </PaymentFormField>
  );
}

export function PaymentSupplierField({
  label = 'Supplier',
  required = false,
  suppliers,
  selectedSupplier,
  onSelect,
  onSearch,
  searchValue,
  loading = false,
  canViewBalance = false,
  canViewPhone = false,
  placeholder = 'Search or select supplier...',
}) {
  const handleSelect = useCallback(
    (supplier) => onSelect?.(supplier),
    [onSelect]
  );

  const emptyMessage = searchValue?.trim()
    ? 'No suppliers found'
    : 'Start typing to search suppliers...';

  return (
    <PaymentFormField label={label} required={required}>
      <SupplierPartySelect
        items={suppliers}
        selectedItem={selectedSupplier}
        onSelect={handleSelect}
        onSearch={onSearch}
        searchValue={searchValue}
        loading={loading}
        canViewBalance={canViewBalance}
        canViewPhone={canViewPhone}
        showSecondaryName
        serverSideSearch
        className={DROPDOWN_INPUT_CLASS}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
      />
    </PaymentFormField>
  );
}

/** Expense account picker for cash/bank payment expense lines. */
export function PaymentExpenseAccountField({
  label = 'Expense Account',
  required = false,
  accounts = [],
  selectedAccount,
  onSelect,
  onSearch,
  searchValue,
  placeholder = 'Search expense account...',
}) {
  const displayKey = useCallback((account) => {
    if (!account) return null;
    const name = account.accountName || account.name || 'Unknown';
    const code = account.accountCode || account.code;
    return (
      <div>
        <div className="font-medium text-neutral-900">{name}</div>
        {code ? <div className="text-xs text-neutral-500">{code}</div> : null}
      </div>
    );
  }, []);

  const filteredAccounts = useMemo(() => {
    const term = String(searchValue ?? '').trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((account) => {
      const name = String(account.accountName || account.name || '').toLowerCase();
      const code = String(account.accountCode || account.code || '').toLowerCase();
      return name.includes(term) || code.includes(term);
    });
  }, [accounts, searchValue]);

  const emptyMessage = searchValue?.trim()
    ? 'No expense accounts found'
    : 'Start typing to search expense accounts...';

  return (
    <PaymentFormField label={label} required={required}>
      <SearchableDropdown
        className={DROPDOWN_INPUT_CLASS}
        placeholder={placeholder}
        items={filteredAccounts}
        onSelect={(account) => onSelect?.(account)}
        onSearch={onSearch}
        displayKey={displayKey}
        selectedItem={selectedAccount}
        value={searchValue}
        valueKey="id"
        emptyMessage={emptyMessage}
      />
    </PaymentFormField>
  );
}

/** Normalize party select handlers that previously accepted only an id string. */
export function partyIdFromSelect(party) {
  if (!party) return null;
  if (typeof party === 'string') return party;
  return party.id || party._id || null;
}

export function customerSearchLabel(customer) {
  return getCustomerDisplayName(customer, '');
}

export function supplierSearchLabel(supplier) {
  return getSupplierDisplayName(supplier, '');
}
