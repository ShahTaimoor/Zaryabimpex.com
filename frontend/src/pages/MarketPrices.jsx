import React, { useMemo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useGetProductsQuery } from '../store/services/productsApi';
import {
  useApplyMarketPriceImportMutation,
  useCreateManualMarketPriceMutation,
  useGetMarketPriceHistoryQuery,
  usePreviewMarketPriceImportMutation,
} from '../store/services/marketPricesApi';

const defaultMapping = {
  productName: 1,
  purchasePrice: 2,
  effectiveDate: 3,
};

export default function MarketPrices() {
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState(null);
  const [mapping, setMapping] = useState(defaultMapping);
  const [previewData, setPreviewData] = useState(null);

  const { data: productsData } = useGetProductsQuery({ search, limit: 50, listMode: 'minimal' });
  const { data: historyData, refetch: refetchHistory } = useGetMarketPriceHistoryQuery({ page: 1, limit: 50 });
  const [manualUpdate, { isLoading: manualLoading }] = useCreateManualMarketPriceMutation();
  const [previewImport, { isLoading: previewLoading }] = usePreviewMarketPriceImportMutation();
  const [applyImport, { isLoading: applyLoading }] = useApplyMarketPriceImportMutation();

  const products = productsData?.products || [];
  const history = historyData?.history || [];

  const selectedProduct = useMemo(
    () => products.find((p) => (p.id || p._id) === selectedProductId),
    [products, selectedProductId]
  );

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) return toast.error('Please select a product');
    if (purchasePrice === '') return toast.error('Please enter purchase price');
    try {
      await manualUpdate({
        productId: selectedProductId,
        purchasePrice: Number(purchasePrice),
        effectiveDate,
      }).unwrap();
      toast.success('Market purchase price updated');
      setPurchasePrice('');
      await refetchHistory();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update market price');
    }
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mapping', JSON.stringify(mapping));
    return fd;
  };

  const handlePreview = async () => {
    if (!file) return toast.error('Please select an Excel file');
    try {
      const result = await previewImport(buildFormData()).unwrap();
      setPreviewData(result);
      toast.success('Preview generated');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to preview import');
    }
  };

  const handleApply = async () => {
    if (!file) return toast.error('Please select an Excel file');
    try {
      const result = await applyImport(buildFormData()).unwrap();
      toast.success(`Imported ${result.imported || 0} market prices`);
      setPreviewData(null);
      setFile(null);
      await refetchHistory();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to import market prices');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Current Purchase Market Prices</h2>
        <p className="text-sm text-gray-600">Manual update for a single product purchase price.</p>
        <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5" onSubmit={handleManualSubmit}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product"
            className="rounded border px-2 py-2 text-sm"
          />
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="rounded border px-2 py-2 text-sm"
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id || p._id} value={p.id || p._id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="Purchase price"
            className="rounded border px-2 py-2 text-sm"
          />
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="rounded border px-2 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={manualLoading}
            className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {manualLoading ? 'Saving...' : 'Update Price'}
          </button>
        </form>
        {selectedProduct ? (
          <p className="mt-2 text-xs text-gray-500">
            Selected: {selectedProduct.name} ({selectedProduct.sku || selectedProduct.barcode || 'N/A'})
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Excel Import</h3>
          <a
            href={`${import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5000/api'}/market-prices/template`}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
          >
            <Download className="h-4 w-4" /> Template
          </a>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="rounded border px-2 py-2 text-sm"
          />
          {Object.keys(mapping).map((key) => (
            <label key={key} className="text-xs">
              {key}
              <input
                type="number"
                min={1}
                value={mapping[key]}
                onChange={(e) => setMapping((prev) => ({ ...prev, [key]: Number(e.target.value || 1) }))}
                className="mt-1 w-full rounded border px-2 py-2 text-sm"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading}
            className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm"
          >
            <Upload className="h-4 w-4" /> {previewLoading ? 'Previewing...' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={applyLoading}
            className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {applyLoading ? 'Applying...' : 'Apply Import'}
          </button>
        </div>

        {previewData ? (
          <div className="mt-4 rounded border p-3 text-sm">
            <p>Total: {previewData.summary?.totalRows || 0}</p>
            <p>Valid: {previewData.summary?.validRows || 0}</p>
            <p>Invalid: {previewData.summary?.invalidRows || 0}</p>
            <p>Duplicates: {previewData.summary?.duplicateRows || 0}</p>
            {previewData.errorReport?.length ? (
              <div className="mt-2 max-h-40 overflow-auto rounded border bg-red-50 p-2 text-xs">
                {previewData.errorReport.slice(0, 40).map((err) => (
                  <div key={err.rowNumber}>
                    Row {err.rowNumber}: {err.errors.join(', ')}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-lg font-semibold">Import / Update History</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Date</th>
                <th className="py-2">User</th>
                <th className="py-2">Product</th>
                <th className="py-2">Old Price</th>
                <th className="py-2">New Price</th>
                <th className="py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b">
                  <td className="py-2">{new Date(h.created_at).toLocaleString()}</td>
                  <td className="py-2">{h.changedByName}</td>
                  <td className="py-2">{h.product_name}</td>
                  <td className="py-2">{h.old_purchase_price ?? '-'}</td>
                  <td className="py-2">{h.new_purchase_price}</td>
                  <td className="py-2">{h.source}</td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td className="py-3 text-gray-500" colSpan={6}>No history found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
