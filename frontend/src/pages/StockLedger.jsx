import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Calendar,
  Eye,
  Package,
  RotateCcw,
  Hash,
  Boxes,
} from 'lucide-react';
import { useGetStockLedgerQuery } from '../store/services/inventoryApi';
import { LoadingButton, LoadingInline } from '../components/LoadingSpinner';
import { handleApiError } from '../utils/errorHandler';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedCustomerSearch } from '../hooks/useDebouncedCustomerSearch';
import { useDebouncedSupplierSearch } from '../hooks/useDebouncedSupplierSearch';
import { CustomerPartySelect } from '../components/order/CustomerPartySelect';
import { SupplierPartySelect } from '../components/order/SupplierPartySelect';
import { ProductSearchableSelect } from '../components/ProductSearchableSelect';
import PageShell from '../components/PageShell';
import { PageHeader } from '../components/layout/PageHeader';

/** Postgres APIs return `id`; legacy Mongo-style responses may use `_id` */
const entityId = (row) => (row?.id != null ? row.id : row?._id);

const INVOICE_TYPE_BADGE = {
  SALE: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80',
  PURCHASE: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/80',
  'SALE RETURN': 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80',
  'PURCHASE RETURN': 'bg-orange-50 text-orange-800 ring-1 ring-orange-200/80',
  DEMAGE: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80',
};

const FILTER_FIELD_CLASS = '[&_input]:h-9 [&_input]:text-sm [&_input]:border-gray-300 [&_input]:rounded-md';
const SELECT_CLASS =
  'w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 hover:border-gray-400';

export const StockLedger = () => {
  const defaultDateTo = getCurrentDatePakistan();
  const defaultDateFrom = getDateDaysAgo(365); // Default to 1 year

  // State
  const [filters, setFilters] = useState({
    invoiceType: '--All--',
    customer: '',
    supplier: '',
    product: '',
    invoiceNo: '',
    dateFrom: defaultDateFrom,
    dateTo: defaultDateTo
  });

  const [showReport, setShowReport] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');

  const {
    customers: customerOptions,
    isLoading: customersLoading,
    isFetching: customersFetching,
  } = useDebouncedCustomerSearch(customerSearchTerm, { selectedCustomer });

  const {
    suppliers: supplierOptions,
    isLoading: suppliersLoading,
    isFetching: suppliersFetching,
  } = useDebouncedSupplierSearch(supplierSearchTerm, { selectedSupplier });

  // Fetch data
  const { data: ledgerData, isLoading, isFetching } = useGetStockLedgerQuery(
    {
      invoiceType: filters.invoiceType === '--All--' ? undefined : filters.invoiceType,
      customer: filters.customer || undefined,
      supplier: filters.supplier || undefined,
      product: filters.product || undefined,
      invoiceNo: filters.invoiceNo || undefined,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: currentPage,
      limit: 1000
    },
    {
      skip: !showReport,
      onError: (error) => handleApiError(error, 'Stock Ledger')
    }
  );

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleCustomerSearch = (searchTerm) => {
    setCustomerSearchTerm(searchTerm);
    if (!searchTerm) {
      setSelectedCustomer(null);
      setFilters((prev) => ({ ...prev, customer: '' }));
    }
  };

  const handleSupplierSearch = (searchTerm) => {
    setSupplierSearchTerm(searchTerm);
    if (!searchTerm) {
      setSelectedSupplier(null);
      setFilters((prev) => ({ ...prev, supplier: '' }));
    }
  };

  const handleCustomerSelect = (customer) => {
    if (!customer) {
      setSelectedCustomer(null);
      setFilters((prev) => ({ ...prev, customer: '' }));
      setCustomerSearchTerm('');
      return;
    }
    setSelectedCustomer(customer);
    setSelectedSupplier(null);
    setSupplierSearchTerm('');
    setFilters((prev) => ({
      ...prev,
      customer: String(entityId(customer)),
      supplier: '',
    }));
  };

  const handleSupplierSelect = (supplier) => {
    if (!supplier) {
      setSelectedSupplier(null);
      setFilters((prev) => ({ ...prev, supplier: '' }));
      setSupplierSearchTerm('');
      return;
    }
    setSelectedSupplier(supplier);
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
    setFilters((prev) => ({
      ...prev,
      supplier: String(entityId(supplier)),
      customer: '',
    }));
  };

  const handleProductChange = (productId) => {
    setFilters((prev) => ({ ...prev, product: productId || '' }));
  };

  const handleClearFilters = () => {
    setFilters({
      invoiceType: '--All--',
      customer: '',
      supplier: '',
      product: '',
      invoiceNo: '',
      dateFrom: defaultDateFrom,
      dateTo: defaultDateTo,
    });
    setSelectedCustomer(null);
    setSelectedSupplier(null);
    setCustomerSearchTerm('');
    setSupplierSearchTerm('');
    setShowReport(false);
    setCurrentPage(1);
  };

  const handleView = () => {
    // Check if at least one filter is selected
    const hasFilters = filters.invoiceType !== '--All--' || 
                      filters.customer || 
                      filters.supplier || 
                      filters.product || 
                      filters.invoiceNo ||
                      filters.dateFrom ||
                      filters.dateTo;
    
    if (!hasFilters) {
      toast.error('Please select at least one filter to view the report');
      return;
    }

    setShowReport(true);
    setCurrentPage(1);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateForReport = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const ledger = ledgerData?.data?.ledger || [];
  const grandTotal = ledgerData?.data?.grandTotal || { totalQuantity: 0, totalAmount: 0 };
  const pagination = ledgerData?.data?.pagination || { current: 1, pages: 1, total: 0 };
  const productGroupCount = ledger.length;
  const entryCount = ledger.reduce((sum, g) => sum + (g.entries?.length || 0), 0);

  const getInvoiceTypeBadge = (type) => {
    const key = String(type || '');
    if (INVOICE_TYPE_BADGE[key]) return INVOICE_TYPE_BADGE[key];
    if (key.includes('RETURN')) return INVOICE_TYPE_BADGE['SALE RETURN'];
    return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200/80';
  };

  return (
    <PageShell className="bg-gray-50 print:bg-white" contentClassName="px-4 sm:px-6 py-6 space-y-6" maxWidthClassName="max-w-[1600px]">
      <header className="bg-white border border-gray-200 rounded-lg shadow-sm px-6 py-5 print:hidden">
        <PageHeader
          title="Stock Ledger"
          subtitle="Track stock movements by product, party, and invoice with a clear audit trail."
          icon={FileText}
          actions={
            showReport && ledger.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
            ) : null
          }
        />
      </header>

      {/* Filters */}
      <section className="bg-white border border-gray-200 rounded-lg shadow-sm print:hidden">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-gray-900">Report filters</h2>
          <p className="mt-0.5 text-xs text-gray-500">Narrow results by document, party, product, or date range.</p>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Invoice type</label>
              <select
                value={filters.invoiceType}
                onChange={(e) => handleFilterChange('invoiceType', e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="--All--">All types</option>
                <option value="SALE">Sale</option>
                <option value="PURCHASE">Purchase</option>
                <option value="PURCHASE RETURN">Purchase return</option>
                <option value="SALE RETURN">Sale return</option>
                <option value="DEMAGE">Damage</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Invoice no.</label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="e.g. INV-1024"
                  value={filters.invoiceNo}
                  onChange={(e) => handleFilterChange('invoiceNo', e.target.value)}
                  className="h-9 pl-9 border-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Customer</label>
              <CustomerPartySelect
                items={customerOptions}
                selectedItem={selectedCustomer}
                onSelect={handleCustomerSelect}
                onSearch={handleCustomerSearch}
                searchValue={customerSearchTerm}
                loading={customersLoading || customersFetching}
                serverSideSearch
                showSecondaryName
                placeholder="Search customer..."
                className={FILTER_FIELD_CLASS}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Supplier</label>
              <SupplierPartySelect
                items={supplierOptions}
                selectedItem={selectedSupplier}
                onSelect={handleSupplierSelect}
                onSearch={handleSupplierSearch}
                searchValue={supplierSearchTerm}
                loading={suppliersLoading || suppliersFetching}
                serverSideSearch
                showSecondaryName
                placeholder="Search supplier..."
                className={FILTER_FIELD_CLASS}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Product</label>
              <ProductSearchableSelect
                value={filters.product || ''}
                onValueChange={handleProductChange}
                placeholder="Search by name, SKU, or barcode..."
                showStock={false}
                className={FILTER_FIELD_CLASS}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Date range</label>
              <DateFilter
                startDate={filters.dateFrom}
                endDate={filters.dateTo}
                onDateChange={(startDate, endDate) => {
                  setFilters({ ...filters, dateFrom: startDate, dateTo: endDate });
                }}
                compact
                size="sm"
                showPresets={false}
                showLabel={false}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClearFilters}
              className="h-9 gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Clear filters
            </Button>
            <LoadingButton
              type="button"
              onClick={handleView}
              isLoading={isLoading || isFetching}
              className="h-9 min-w-[140px] gap-2 bg-gray-900 px-5 text-sm font-medium text-white hover:bg-gray-800"
            >
              <>
                <Eye className="h-4 w-4" />
                View report
              </>
            </LoadingButton>
          </div>
        </div>
      </section>

      {/* Report */}
      {showReport && (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="hidden print:block print:px-4 print:pb-3 print:mb-2 print:border-b print:border-gray-300">
            <h1 className="text-center text-lg font-bold text-gray-900">Stock Ledger</h1>
            <p className="text-center text-sm text-gray-600 mt-1">
              {formatDateForReport(filters.dateFrom)} – {formatDateForReport(filters.dateTo)}
            </p>
          </div>

          <div className="border-b border-gray-200 px-5 py-4 sm:px-6 print:hidden">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Stock ledger report</h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(filters.dateFrom)} – {formatDate(filters.dateTo)}
                  </span>
                  {filters.invoiceType !== '--All--' && (
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {filters.invoiceType}
                    </span>
                  )}
                </p>
              </div>
              {!isLoading && !isFetching && ledger.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 min-w-[120px]">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Products</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{productGroupCount}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 min-w-[120px]">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Movements</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{entryCount}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 min-w-[140px]">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Net qty</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">
                      {grandTotal.totalQuantity < 0
                        ? `(${Math.abs(grandTotal.totalQuantity)})`
                        : grandTotal.totalQuantity}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 min-w-[140px]">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Net amount</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">
                      {grandTotal.totalAmount < 0
                        ? `(${formatCurrency(Math.abs(grandTotal.totalAmount))})`
                        : formatCurrency(grandTotal.totalAmount)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isLoading || isFetching ? (
            <div className="px-6 py-20 text-center">
              <LoadingInline message="Loading stock ledger…" />
            </div>
          ) : ledger.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Boxes className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-900">No movements found</p>
              <p className="mt-1 text-sm text-gray-500">Adjust your filters and run the report again.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-y border-gray-200 bg-gray-50">
                    {['S.No', 'Date', 'Invoice', 'Type', 'Customer / Supplier', 'Price', 'Qty', 'Amount', 'Qty left'].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          'whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500',
                          ['Price', 'Qty', 'Amount', 'Qty left'].includes(h) ? 'text-right' : 'text-left'
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((productGroup, groupIndex) => (
                    <React.Fragment key={productGroup.productId || groupIndex}>
                      <tr className="border-t-2 border-gray-200 bg-gray-100/80">
                        <td colSpan={8} className="px-4 py-2">
                          <div className="flex items-center gap-2 font-semibold text-gray-900">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white border border-gray-200 shadow-sm">
                              <Package className="h-3.5 w-3.5 text-gray-600" />
                            </span>
                            <span>{productGroup.productName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <span className="text-gray-900 tabular-nums">{productGroup.qtyLeft ?? '—'}</span>
                        </td>
                      </tr>
                      {productGroup.entries.map((entry, entryIndex) => (
                        <tr
                          key={`${entry.referenceId}-${entryIndex}`}
                          className="border-b border-gray-100 bg-white hover:bg-gray-50/80 transition-colors"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 text-gray-500 tabular-nums">
                            {entryIndex + 1}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                            {formatDate(entry.invoiceDate)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                            {entry.invoiceNo}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                                getInvoiceTypeBadge(entry.invoiceType)
                              )}
                            >
                              {entry.invoiceType}
                            </span>
                          </td>
                          <td className="max-w-[220px] truncate px-4 py-2.5 text-gray-700" title={entry.customerSupplier}>
                            {entry.customerSupplier}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-700">
                            {formatCurrency(entry.price)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-medium">
                            {entry.quantity < 0 ? (
                              <span className="text-red-600">({Math.abs(entry.quantity)})</span>
                            ) : (
                              <span className="text-gray-900">{entry.quantity}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-medium">
                            {entry.amount < 0 ? (
                              <span className="text-red-600">({formatCurrency(Math.abs(entry.amount))})</span>
                            ) : (
                              <span className="text-gray-900">{formatCurrency(entry.amount)}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-500">
                            {productGroup.qtyLeft != null ? productGroup.qtyLeft : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-medium text-gray-800">
                        <td colSpan={5} className="px-4 py-2 text-sm">
                          Subtotal — {productGroup.productName}
                        </td>
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2 text-right tabular-nums">
                          {productGroup.totalQuantity < 0 ? (
                            <span className="text-red-600">({Math.abs(productGroup.totalQuantity)})</span>
                          ) : (
                            productGroup.totalQuantity
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {productGroup.totalAmount < 0 ? (
                            <span className="text-red-600">({formatCurrency(Math.abs(productGroup.totalAmount))})</span>
                          ) : (
                            formatCurrency(productGroup.totalAmount)
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-gray-900">
                          {productGroup.qtyLeft ?? '—'}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                  <tr className="border-t-2 border-gray-300 bg-gray-900 text-white">
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold">
                      Grand total
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {grandTotal.totalQuantity < 0 ? (
                        <span className="text-red-300">({Math.abs(grandTotal.totalQuantity)})</span>
                      ) : (
                        grandTotal.totalQuantity
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {grandTotal.totalAmount < 0 ? (
                        <span className="text-red-300">({formatCurrency(Math.abs(grandTotal.totalAmount))})</span>
                      ) : (
                        formatCurrency(grandTotal.totalAmount)
                      )}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {ledger.length > 0 && (
            <footer className="flex flex-col gap-1 border-t border-gray-200 bg-gray-50 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span>
                Generated{' '}
                {new Date().toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
              <span className="tabular-nums">
                Page {pagination.current} of {pagination.pages}
              </span>
            </footer>
          )}
        </section>
      )}
    </PageShell>
  );
};

export default StockLedger;
