import React, { useMemo } from 'react';
import { SearchableDropdown } from './SearchableDropdown';

/**
 * Searchable picker for product variants (same UX as ProductSearchableSelect).
 * Pass variants for one base product; initial list capped; typing searches full list.
 */
export function VariantSearchableSelect({
  label,
  variants = [],
  value,
  onValueChange,
  placeholder = 'Search variant by name, SKU, barcode…',
  disabled = false,
  loading = false,
  className = '',
  maxInitialItems = 20,
}) {
  const selectedItem = useMemo(() => {
    if (value == null || value === '') return null;
    const v = String(value);
    return variants.find((x) => String(x._id ?? x.id) === v) ?? null;
  }, [variants, value]);

  const displayKey = (x) => {
    if (!x) return '—';
    const label =
      x.displayName ??
      x.display_name ??
      x.variantName ??
      x.variant_name;
    if (label) return label;
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

  return (
    <div className={className}>
      {label ? (
        <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      ) : null}
      <SearchableDropdown
        placeholder={placeholder}
        items={variants}
        displayKey={displayKey}
        valueKey="_id"
        selectedItem={selectedItem}
        onSelect={(item) =>
          onValueChange(item ? String(item._id ?? item.id ?? '') : '')
        }
        loading={loading}
        disabled={disabled}
        maxInitialItems={maxInitialItems}
        rightContentKey={rightContentKey}
        className="w-full"
        openOnFocus
      />
    </div>
  );
}
