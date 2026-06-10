import React, { useMemo, useState } from 'react';
import { SearchableDropdown } from './SearchableDropdown';
import { useDebouncedVariantSearch } from '@/hooks/useDebouncedVariantSearch';
import { useGetVariantQuery } from '@/store/services/productVariantsApi';

/**
 * Server-backed variant picker scoped to a base product.
 */
export function VariantSearchableSelect({
  label,
  baseProductId,
  value,
  onValueChange,
  placeholder = 'Search variant by name, SKU, barcode…',
  disabled = false,
  className = '',
  maxInitialItems = 20,
  searchLimit = 50,
  withinModal = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: selectedVariantResponse } = useGetVariantQuery(value, {
    skip: !value,
  });
  const selectedFromApi = useMemo(() => {
    const data = selectedVariantResponse;
    return data?.data?.variant ?? data?.variant ?? data?.data ?? data ?? null;
  }, [selectedVariantResponse]);

  const { variants, isLoading, isFetching } = useDebouncedVariantSearch(searchTerm, {
    baseProductId,
    selectedVariant: selectedFromApi,
    enabled: !!baseProductId,
    limit: searchLimit,
  });

  const selectedItem = useMemo(() => {
    if (value == null || value === '') return null;
    const v = String(value);
    const fromList = variants.find((x) => String(x._id ?? x.id) === v);
    if (fromList) return fromList;
    if (selectedFromApi && String(selectedFromApi._id ?? selectedFromApi.id) === v) {
      return selectedFromApi;
    }
    return null;
  }, [variants, value, selectedFromApi]);

  const displayKey = (x) => {
    if (!x) return '—';
    const name =
      x.displayName ??
      x.display_name ??
      x.variantName ??
      x.variant_name;
    if (name) return name;
    const t = [x.variantType ?? x.variant_type, x.variantValue ?? x.variant_value]
      .filter(Boolean)
      .join(' · ');
    return t || '—';
  };

  const rightContentKey = (x) => {
    const stock =
      x?.inventory?.currentStock ??
      x?.inventory_data?.current_stock ??
      x?.inventory_data?.currentStock ??
      0;
    const active =
      (x?.status ?? (x?.is_active === false ? 'inactive' : 'active')) === 'active';
    return `Stock: ${stock}${active ? '' : ' · inactive'}`;
  };

  const pickerDisabled = disabled || !baseProductId;

  return (
    <div className={className}>
      {label ? (
        <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      ) : null}
      <SearchableDropdown
        placeholder={baseProductId ? placeholder : 'Select a base product first…'}
        items={variants}
        displayKey={displayKey}
        valueKey="_id"
        selectedItem={selectedItem}
        onSelect={(item) =>
          onValueChange(item ? String(item._id ?? item.id ?? '') : '')
        }
        onSearch={setSearchTerm}
        loading={isLoading || isFetching}
        disabled={pickerDisabled}
        maxInitialItems={maxInitialItems}
        rightContentKey={rightContentKey}
        serverSideSearch
        withinModal={withinModal}
        className="w-full"
        openOnFocus
      />
    </div>
  );
}
