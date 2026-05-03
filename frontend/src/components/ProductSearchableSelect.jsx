import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { SearchableDropdown } from './SearchableDropdown';
import { Button } from '@/components/ui/button';

/**
 * Searchable product picker (name / SKU / barcode filter via SearchableDropdown).
 * Use with `useGetProductsQuery({ limit: 10000 })` so the full catalog is available.
 * Dropdown lists **maxInitialItems** rows until the user types; then **all** matching products are shown.
 */
export function ProductSearchableSelect({
  label,
  products = [],
  value,
  onValueChange,
  placeholder = 'Search by name, SKU, or barcode…',
  disabled = false,
  loading = false,
  className = '',
  showStock = true,
  /** When not searching, show this many rows (default 20). Type to search the full `products` list. */
  maxInitialItems = 20,
  allowClear = false,
  clearLabel = 'Clear',
}) {
  const selectedItem = useMemo(() => {
    if (value == null || value === '') return null;
    const v = String(value);
    return products.find((p) => String(p._id ?? p.id) === v) ?? null;
  }, [products, value]);

  const displayKey = (p) => p?.name ?? p?.productName ?? '—';

  const rightContentKey = showStock
    ? (p) => {
        const stock =
          p?.inventory?.currentStock ??
          p?.stockQuantity ??
          p?.stock_quantity ??
          0;
        return `Stock: ${stock}`;
      }
    : undefined;

  return (
    <div className={className}>
      {label ? (
        <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      ) : null}
      <div className="flex gap-2 items-start">
        <div className="flex-1 min-w-0">
          <SearchableDropdown
            placeholder={placeholder}
            items={products}
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
        {allowClear && value ? (
          <Button
            type="button"
            variant="outline"
            size="default"
            className="flex-shrink-0 h-10 px-3"
            onClick={() => onValueChange('')}
            title={clearLabel}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
