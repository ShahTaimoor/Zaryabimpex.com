import React, { useState } from 'react';
import { RefreshCw, Printer } from 'lucide-react';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { useGetPurchaseBySupplierReportQuery } from '../store/services/reportsApi';
import { useLazySearchSuppliersQuery, useGetSuppliersQuery, useGetSupplierQuery } from '../store/services/suppliersApi';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import DateFilter from '../components/DateFilter';
import { LoadingPage } from '../components/LoadingSpinner';
import { getDateDaysAgo, getCurrentDatePakistan } from '../utils/dateUtils';

const supplierDisplayKey = (s) =>
  s?.companyName || s?.company_name || s?.businessName || s?.name || '';

export default function PurchaseBySupplierReport() {
  const [dateRange, setDateRange] = useState({
    from: getDateDaysAgo(90),
    to: getCurrentDatePakistan(),
  });
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [includeCustomersSold, setIncludeCustomersSold] = useState(false);
  const [searchSuppliers, { data: suppliersSearchData }] = useLazySearchSuppliersQuery();
  const { data: suppliersListData } = useGetSuppliersQuery({ limit: 500 }, { skip: supplierSearchTerm.length > 0 });

  React.useEffect(() => {
    if (supplierSearchTerm.length > 0) {
      searchSuppliers(supplierSearchTerm);
    }
  }, [supplierSearchTerm, searchSuppliers]);

  const suppliers =
    supplierSearchTerm.length > 0
      ? suppliersSearchData?.suppliers || suppliersSearchData?.data?.suppliers || []
      : suppliersListData?.suppliers || suppliersListData?.data?.suppliers || [];

  const { data: selectedSupplierData } = useGetSupplierQuery(selectedSupplierId, { skip: !selectedSupplierId });
  const fetchedSupplier = selectedSupplierData?.supplier || selectedSupplierData?.data;

  const selectedSupplier =
    suppliers.find((s) => (s.id || s._id) === selectedSupplierId) ||
    (fetchedSupplier ? { ...fetchedSupplier, id: fetchedSupplier.id || fetchedSupplier._id } : null);

  const {
    data: reportData,
    isLoading,
    refetch,
  } = useGetPurchaseBySupplierReportQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    supplier: selectedSupplierId || undefined,
    includeCustomersSold: includeCustomersSold ? 'true' : undefined,
  });

  const rows = reportData?.data || [];
  const summary = reportData?.summary || {};

  const filteredRows = useFuzzySearch(rows, searchTerm, ['productName', 'supplierName'], {
    threshold: 0.4,
    minScore: 0.3,
  });

  if (isLoading && !reportData) {
    return <LoadingPage message="Loading purchase report..." />;
  }

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      <div>
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Products Purchased by Supplier</h1>
        <p className="text-gray-600 text-sm">
          View how much quantity of each product was purchased from each supplier. Same product from different suppliers shown separately.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-end gap-4">
        <DateFilter
          startDate={dateRange.from}
          endDate={dateRange.to}
          onDateChange={(from, to) => setDateRange({ from: from || '', to: to || '' })}
          compact
          showPresets
        />
        <div className="min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Supplier</label>
          <div className="flex gap-1 items-center">
            <div className="flex-1">
              <SearchableDropdown
                placeholder="All suppliers..."
                items={suppliers}
                onSelect={(s) => setSelectedSupplierId(s ? (s.id || s._id) : '')}
                onSearch={setSupplierSearchTerm}
                displayKey={supplierDisplayKey}
                selectedItem={selectedSupplier}
                emptyMessage="Type to search suppliers"
              />
            </div>
            {selectedSupplierId && (
              <button
                type="button"
                onClick={() => setSelectedSupplierId('')}
                className="text-xs text-blue-600 hover:underline whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search Product/Supplier</label>
          <input
            type="text"
            placeholder="Search products or suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-full"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          title="Refresh"
        >
          <RefreshCw className="h-5 w-5 text-gray-600" />
        </button>
        {/* Print options - visible in filter row */}
        <div className="flex items-end gap-2 flex-wrap print:hidden border-l border-gray-200 pl-4 ml-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeCustomersSold}
              onChange={(e) => setIncludeCustomersSold(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Customers sold to</span>
          </label>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Products</div>
          <div className="text-xl font-semibold text-gray-900">{summary.totalProducts ?? '-'}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Suppliers</div>
          <div className="text-xl font-semibold text-gray-900">{summary.totalSuppliers ?? '-'}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Quantity</div>
          <div className="text-xl font-semibold text-gray-900">
            {summary.totalQuantity != null ? Number(summary.totalQuantity).toLocaleString() : '-'}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Amount</div>
          <div className="text-xl font-semibold text-gray-900">
            {summary.totalAmount != null ? Math.round(summary.totalAmount).toLocaleString() : '-'}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border print:rounded">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity Purchased</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                {includeCustomersSold && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customers sold to</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={includeCustomersSold ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                    No purchase data found for the selected period.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={`${row.productId}-${row.supplierId}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.productName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.supplierName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {row.totalQuantity > 0
                        ? (Number(row.totalAmount || 0) / Number(row.totalQuantity || 1)).toFixed(2)
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {Number(row.totalQuantity || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {Math.round(row.totalAmount || 0).toLocaleString()}
                    </td>
                    {includeCustomersSold && (
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {row.customersSold?.length ? (
                          <span className="block max-w-xs">
                            {row.customersSold.map((c, i) => (
                              <span key={i}>
                                {c.customerName} ({Number(c.quantity || 0).toLocaleString()}){i < row.customersSold.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
