import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Search, ChevronLeft, ChevronRight, Store, Warehouse } from 'lucide-react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useGetWarehousesQuery } from '../../../store/services/warehousesApi';
import { useGetShopsQuery } from '../../../store/services/shopsApi';
import { useGetWarehouseStockQuery, useGetShopStockQuery } from '../../../store/services/stockTransfersApi';
import { getProductDisplayName } from '../../../utils/partyDisplay';
import { useWarehouseInventoryMode } from '../hooks/useWarehouseInventoryMode';
import { getLocationId, getPrimaryLocation, normalizeLocationList } from '../utils/inventoryHelpers';
import LocationSelectTabs from './LocationSelectTabs';
import { LoadingSpinner, LoadingInline } from '../../../components/LoadingSpinner';

const PAGE_SIZES = [50, 100, 200, 500];

const emptyReportContext = {
  rows: [],
  locationName: '',
  summary: { totalProducts: 0, inStockCount: 0, totalOnHand: 0, totalAvailable: 0 },
};

export default function LocationStockReportSection({
  active,
  locationType = 'warehouse',
  onReportDataChange,
}) {
  const { enabled: warehouseMode } = useWarehouseInventoryMode();
  const isWarehouse = locationType === 'warehouse';
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { data: warehousesData, isLoading: warehousesLoading } = useGetWarehousesQuery(
    { limit: 100, isActive: true },
    { skip: !active || !warehouseMode || !isWarehouse }
  );
  const { data: shopsData, isLoading: shopsLoading } = useGetShopsQuery(undefined, {
    skip: !active || !warehouseMode || isWarehouse,
  });

  const locations = useMemo(() => {
    if (isWarehouse) return normalizeLocationList(warehousesData, 'warehouses');
    return normalizeLocationList(shopsData, 'shops');
  }, [isWarehouse, warehousesData, shopsData]);

  const locationsLoading = isWarehouse ? warehousesLoading : shopsLoading;

  useEffect(() => {
    if (!active || !locations.length) return;
    const stillValid = locations.some((l) => getLocationId(l) === selectedLocationId);
    if (stillValid) return;
    setSelectedLocationId(getLocationId(getPrimaryLocation(locations)));
  }, [active, locations, selectedLocationId]);

  useEffect(() => {
    setPage(1);
  }, [selectedLocationId, debouncedSearch, pageSize, locationType]);

  const warehouseQuery = useGetWarehouseStockQuery(
    {
      warehouseId: selectedLocationId,
      page,
      limit: pageSize,
      search: debouncedSearch.trim() || undefined,
      allProducts: true,
    },
    { skip: !active || !warehouseMode || !isWarehouse || !selectedLocationId }
  );

  const shopQuery = useGetShopStockQuery(
    {
      shopId: selectedLocationId,
      page,
      limit: pageSize,
      search: debouncedSearch.trim() || undefined,
      allProducts: true,
    },
    { skip: !active || !warehouseMode || isWarehouse || !selectedLocationId }
  );

  const stockQuery = isWarehouse ? warehouseQuery : shopQuery;
  const stockRows = stockQuery.data?.stock ?? [];
  const locationInfo = isWarehouse ? stockQuery.data?.warehouse : stockQuery.data?.shop;
  const pagination = stockQuery.data?.pagination ?? {};
  const total = pagination.total ?? 0;
  const totalPages = Math.max(1, pagination.pages ?? 1);

  const pageSummary = useMemo(() => {
    const inStockCount = stockRows.filter((r) => Number(r.availableQuantity ?? 0) > 0).length;
    const totalOnHand = stockRows.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    const totalAvailable = stockRows.reduce((s, r) => s + Number(r.availableQuantity ?? 0), 0);
    return { inStockCount, totalOnHand, totalAvailable };
  }, [stockRows]);

  useEffect(() => {
    if (!active) {
      onReportDataChange?.(emptyReportContext);
      return;
    }
    onReportDataChange?.({
      rows: stockRows.map((row) => ({
        productName: row.productName,
        productSku: row.productSku,
        quantity: row.quantity,
        reservedQuantity: row.reservedQuantity,
        availableQuantity: row.availableQuantity,
      })),
      locationName: locationInfo?.name || '',
      warehouseName: isWarehouse ? locationInfo?.name || '' : '',
      shopName: !isWarehouse ? locationInfo?.name || '' : '',
      summary: {
        totalProducts: total,
        inStockCount: pageSummary.inStockCount,
        totalOnHand: pageSummary.totalOnHand,
        totalAvailable: pageSummary.totalAvailable,
      },
    });
  }, [active, stockRows, locationInfo?.name, total, pageSummary, onReportDataChange, isWarehouse]);

  const title = isWarehouse ? 'Warehouse Stock Report' : 'Shop Stock Report';
  const Icon = isWarehouse ? Warehouse : Store;

  if (!warehouseMode) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center">
        <Icon className="mx-auto h-10 w-10 text-amber-600 mb-3" />
        <p className="text-sm font-medium text-amber-900">Location inventory is disabled</p>
        <p className="text-xs text-amber-700 mt-1">
          Enable warehouse inventory in Settings → Advanced to view stock by location.
        </p>
      </div>
    );
  }

  if (locationsLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!locations.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-600">
        No active {isWarehouse ? 'warehouses' : 'shops'} found.
      </div>
    );
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(rangeStart + stockRows.length - 1, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Available stock for every product at the selected {isWarehouse ? 'warehouse' : 'shop'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => stockQuery.refetch()}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {stockQuery.isFetching ? (
            <LoadingSpinner size="sm" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      <LocationSelectTabs
        locations={locations}
        selectedId={selectedLocationId}
        onSelect={setSelectedLocationId}
        locationType={locationType}
      />

      <div className="flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-gray-400 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product by name or SKU..."
          className="input w-full text-sm h-9"
        />
      </div>

      <div className="overflow-x-auto border border-gray-100 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-14">S.No</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">SKU</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">On Hand</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Reserved</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Available</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stockQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <LoadingSpinner size="lg" className="mx-auto" />
                </td>
              </tr>
            ) : stockRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No products found{debouncedSearch ? ' matching your search' : ''}
                </td>
              </tr>
            ) : (
              stockRows.map((row, idx) => {
                const available = Number(row.availableQuantity ?? 0);
                return (
                  <tr key={row.productId || `${row.productSku}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500 text-right tabular-nums">{rangeStart + idx}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {getProductDisplayName(
                        { name: row.productName, sku: row.productSku },
                        row.productName || '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.productSku || '—'}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{Number(row.quantity ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-600">
                      {Number(row.reservedQuantity ?? 0).toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm text-right font-semibold tabular-nums ${
                        available > 0 ? 'text-emerald-700' : 'text-gray-400'
                      }`}
                    >
                      {available.toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <p className="text-sm text-gray-500">
            Showing {rangeStart}–{rangeEnd} of {total.toLocaleString()} products
            {locationInfo?.name ? ` in ${locationInfo.name}` : ''}
          </p>
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-sm text-gray-600 tabular-nums">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
