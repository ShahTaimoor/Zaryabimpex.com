import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Plus, Package, Warehouse, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoadingPage, LoadingButton } from '../components/LoadingSpinner';
import BaseModal from '../components/BaseModal';
import { useGetWarehousesQuery } from '../store/services/warehousesApi';
import { useGetShopsQuery } from '../store/services/shopsApi';
import {
  useGetStockTransfersQuery,
  useCreateStockTransferMutation,
  useLazyGetWarehouseStockQuery,
} from '../store/services/stockTransfersApi';
import { useLazyGetProductsQuery } from '../store/services/productsApi';
import AsyncSelect from 'react-select/async';
import { useNavigate } from 'react-router-dom';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { isWarehouseInventoryEnabled } from '../utils/warehouseInventory';
import { PageLayout } from '../components/layout/PageLayout';
import { PageHeader } from '../components/layout/PageHeader';

const asyncSelectStyles = {
  control: (base) => ({ ...base, minHeight: '2.5rem' }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

export default function StockTransfers() {
  const navigate = useNavigate();
  const { companyInfo, isLoading: settingsLoading } = useCompanyInfo();
  const warehouseMode = isWarehouseInventoryEnabled(companyInfo);

  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toShopId, setToShopId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ product: null, quantity: '' }]);

  const { data: transfersData, isLoading } = useGetStockTransfersQuery({ page, limit: 20 });
  const { data: warehousesData } = useGetWarehousesQuery({ limit: 100, isActive: true });
  const { data: shopsData } = useGetShopsQuery();
  const [createTransfer, { isLoading: isCreating }] = useCreateStockTransferMutation();
  const [fetchWarehouseStock] = useLazyGetWarehouseStockQuery();
  const [searchProducts] = useLazyGetProductsQuery();
  const [warehouseStockOptions, setWarehouseStockOptions] = useState([]);
  const [loadingStockOptions, setLoadingStockOptions] = useState(false);

  const transfers = transfersData?.data?.transfers ?? transfersData?.transfers ?? [];
  const pagination = transfersData?.data?.pagination ?? {};
  const warehouses = warehousesData?.data?.warehouses ?? warehousesData?.warehouses ?? [];
  const shops = shopsData?.data?.shops ?? shopsData?.shops ?? [];

  const primaryWarehouse = useMemo(
    () => warehouses.find((w) => w.is_primary || w.isPrimary) || warehouses[0],
    [warehouses]
  );
  const primaryShop = useMemo(
    () => shops.find((s) => s.is_primary || s.isPrimary) || shops[0],
    [shops]
  );

  const mapStockRowToOption = useCallback((row) => {
    const available = Number(row.availableQuantity ?? row.quantity ?? 0);
    const sku = row.productSku || row.product_sku;
    const name = row.productName || row.product_name || 'Product';
    return {
      value: row.productId || row.product_id,
      label: `${name}${sku ? ` (${sku})` : ''} — avail: ${available}`,
      product: {
        id: row.productId || row.product_id,
        name,
        sku,
      },
      availableQuantity: available,
    };
  }, []);

  const mapProductToOption = useCallback((p) => ({
    value: p.id || p._id,
    label: `${p.name}${p.sku ? ` (${p.sku})` : ''}`,
    product: p,
    availableQuantity: Number(p.inventory?.availableStock ?? p.inventory?.currentStock ?? 0),
  }), []);

  const loadWarehouseStockOptions = useCallback(async (warehouseId, search = '') => {
    if (!warehouseId) return [];
    setLoadingStockOptions(true);
    try {
      const result = await fetchWarehouseStock({
        warehouseId,
        search: search.trim() || undefined,
        limit: 100,
        page: 1,
      }).unwrap();
      const stock = result?.stock ?? result?.data?.stock ?? [];
      const options = stock
        .filter((row) => Number(row.availableQuantity ?? row.quantity ?? 0) > 0)
        .map(mapStockRowToOption)
        .filter((opt) => opt.value);
      if (!search.trim()) {
        setWarehouseStockOptions(options);
      }
      return options;
    } catch (err) {
      if (!search.trim()) setWarehouseStockOptions([]);
      return [];
    } finally {
      setLoadingStockOptions(false);
    }
  }, [fetchWarehouseStock, mapStockRowToOption]);

  const loadProductOptions = useCallback(async (inputValue) => {
    const term = String(inputValue ?? '').trim();
    if (!fromWarehouseId) return [];

    const warehouseOptions = await loadWarehouseStockOptions(fromWarehouseId, term);
    if (warehouseOptions.length > 0) return warehouseOptions;
    if (term.length < 2) return [];

    // Fallback: search catalog when warehouse has no matching stock rows yet
    try {
      const result = await searchProducts({
        search: term,
        status: 'active',
        limit: 50,
        page: 1,
        listMode: 'minimal',
      }).unwrap();
      const products = result?.products ?? result?.data?.products ?? [];
      return products.map(mapProductToOption).filter((opt) => opt.value);
    } catch {
      return [];
    }
  }, [fromWarehouseId, loadWarehouseStockOptions, searchProducts, mapProductToOption]);

  useEffect(() => {
    if (!showModal || !fromWarehouseId) return;
    loadWarehouseStockOptions(fromWarehouseId);
  }, [showModal, fromWarehouseId, loadWarehouseStockOptions]);

  const handleAddLine = () => setLines((prev) => [...prev, { product: null, quantity: '' }]);

  const handleLineChange = (index, field, value) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  };

  const handleRemoveLine = (index) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const openModal = () => {
    setFromWarehouseId(primaryWarehouse?.id || primaryWarehouse?._id || '');
    setToShopId(primaryShop?.id || primaryShop?.shopId || '');
    setNotes('');
    setLines([{ product: null, quantity: '' }]);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payloadLines = lines
      .filter((l) => l.product && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.product.value,
        quantity: Number(l.quantity),
      }));

    if (!payloadLines.length) {
      toast.error('Add at least one product with quantity');
      return;
    }

    const overLimit = lines.find(
      (l) =>
        l.product &&
        Number(l.quantity) > 0 &&
        l.product.availableQuantity != null &&
        Number(l.quantity) > Number(l.product.availableQuantity)
    );
    if (overLimit) {
      toast.error(
        `Quantity exceeds warehouse stock for ${overLimit.product.label || overLimit.product.product?.name}`
      );
      return;
    }

    try {
      await createTransfer({
        fromWarehouseId: fromWarehouseId || undefined,
        toShopId: toShopId || undefined,
        notes: notes || undefined,
        lines: payloadLines,
      }).unwrap();
      toast.success('Stock transfer completed');
      setShowModal(false);
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Transfer failed');
    }
  };

  if (settingsLoading) return <LoadingPage />;

  if (!warehouseMode) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <ArrowRightLeft className="h-12 w-12 text-gray-300 mx-auto" />
        <h1 className="text-xl font-semibold text-gray-900">Warehouse inventory is disabled</h1>
        <p className="text-sm text-gray-500">
          Enable <strong>Enable Warehouse Inventory</strong> in Settings to use stock transfers and warehouse → shop flow.
        </p>
        <Button variant="outline" onClick={() => navigate('/settings')}>
          Open Settings
        </Button>
      </div>
    );
  }

  if (isLoading && !transfers.length) return <LoadingPage />;

  return (
    <PageLayout>
      <PageHeader
        title="Stock Transfers"
        subtitle="Move bulk stock from warehouse to shop. Sales use shop inventory only."
        icon={ArrowRightLeft}
        actions={
          <Button onClick={openModal} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            New Transfer
          </Button>
        }
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm table-scroll">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Transfer #</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No transfers yet. Create one to move stock warehouse → shop.
                </td>
              </tr>
            ) : (
              transfers.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.transferNumber}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <Warehouse className="h-3.5 w-3.5 text-gray-400" />
                      {t.warehouseName || t.warehouseCode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <Store className="h-3.5 w-3.5 text-gray-400" />
                      {t.shopName || t.shopCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.transferredAt ? new Date(t.transferredAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800">
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="self-center text-sm text-gray-600">
            Page {page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <BaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Warehouse → Shop Transfer"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">From Warehouse</label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={fromWarehouseId}
                onChange={(e) => {
                  setFromWarehouseId(e.target.value);
                  setLines([{ product: null, quantity: '' }]);
                }}
              >
                {warehouses.map((w) => (
                  <option key={w.id || w._id} value={w.id || w._id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">To Shop</label>
              <select
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={toShopId}
                onChange={(e) => setToShopId(e.target.value)}
              >
                {shops.map((s) => (
                  <option key={s.id || s.shopId} value={s.id || s.shopId}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Package className="h-4 w-4" />
                Products
              </label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                Add line
              </Button>
            </div>
            {fromWarehouseId && warehouseStockOptions.length === 0 && !loadingStockOptions && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                No stock in this warehouse yet. Receive a purchase first, or search by product name (min. 2 characters).
              </p>
            )}
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-8">
                  <AsyncSelect
                    key={`${fromWarehouseId}-${index}`}
                    cacheOptions
                    defaultOptions={warehouseStockOptions}
                    loadOptions={loadProductOptions}
                    value={line.product}
                    onChange={(val) => handleLineChange(index, 'product', val)}
                    placeholder="Search product..."
                    isLoading={loadingStockOptions}
                    isClearable
                    menuPortalTarget={document.body}
                    styles={asyncSelectStyles}
                    noOptionsMessage={({ inputValue }) =>
                      String(inputValue ?? '').trim().length < 2
                        ? 'Type 2+ characters to search, or pick from warehouse stock'
                        : 'No products found in this warehouse'
                    }
                    className="text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                  />
                </div>
                <div className="md:col-span-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveLine(index)}>
                    ×
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1"
              placeholder="Optional notes for audit trail"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <LoadingButton type="submit" loading={isCreating}>
              Complete Transfer
            </LoadingButton>
          </div>
        </form>
      </BaseModal>
    </PageLayout>
  );
}
