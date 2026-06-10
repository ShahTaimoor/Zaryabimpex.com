import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SearchableDropdown } from './SearchableDropdown';
import { Button } from '@/components/ui/button';
import { useDebouncedProductSearch } from '@/hooks/useDebouncedProductSearch';
import { useGetProductQuery } from '@/store/services/productsApi';
import { PRODUCT_SEARCH_DROPDOWN_LIMIT } from '@/constants/listPagination';

/**
 * Server-backed searchable product picker (GET /api/products?search=&page=1&limit=20).
 */
export function ProductSearchableSelect({
  label,
  value,
  onValueChange,
  placeholder = 'Search by name, SKU, or barcode…',
  disabled = false,
  className = '',
  showStock = true,
  maxInitialItems = 20,
  allowClear = false,
  clearLabel = 'Clear',
  listMode = 'minimal',
  searchLimit = PRODUCT_SEARCH_DROPDOWN_LIMIT,
  withinModal = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: selectedProductResponse } = useGetProductQuery(value, {
    skip: !value,
  });
  const selectedFromApi = useMemo(() => {
    const data = selectedProductResponse;
    return data?.data?.product ?? data?.product ?? data?.data ?? data ?? null;
  }, [selectedProductResponse]);

  const { products, isLoading, isFetching } = useDebouncedProductSearch(searchTerm, {
    selectedProduct: selectedFromApi,
    limit: searchLimit,
    listMode,
  });

  const selectedItem = useMemo(() => {
    if (value == null || value === '') return null;
    const v = String(value);
    const fromList = products.find((p) => String(p._id ?? p.id) === v);
    if (fromList) return fromList;
    if (selectedFromApi && String(selectedFromApi._id ?? selectedFromApi.id) === v) {
      return selectedFromApi;
    }
    return null;
  }, [products, value, selectedFromApi]);

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
            onSearch={setSearchTerm}
            loading={isLoading || isFetching}
            disabled={disabled}
            maxInitialItems={maxInitialItems}
            rightContentKey={rightContentKey}
            serverSideSearch
            withinModal={withinModal}
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
