import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Search,
  Printer,
  Calendar,
  X,
  ChevronDown,
  Eye,
  User,
  Package
} from 'lucide-react';
import { useGetStockLedgerQuery } from '../store/services/inventoryApi';
import { useGetProductsQuery } from '../store/services/productsApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useGetSuppliersQuery } from '../store/services/suppliersApi';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { handleApiError } from '../utils/errorHandler';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getDateDaysAgo, formatDateForInput } from '../utils/dateUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import PageShell from '../components/PageShell';

/** Initial rows when opening customer/supplier dropdown (no search yet) */
const ENTITY_DROPDOWN_INITIAL_LIMIT = 20;
/** Server-side search; cap rows to avoid huge payloads (refine search if needed). */
const ENTITY_DROPDOWN_SEARCH_LIMIT = 500;

/** Postgres APIs return `id`; legacy Mongo-style responses may use `_id` */
const entityId = (row) => (row?.id != null ? row.id : row?._id);

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
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const debouncedCustomerSearch = useDebouncedValue(customerSearchQuery, 300);
  const debouncedSupplierSearch = useDebouncedValue(supplierSearchQuery, 300);
  const debouncedProductSearch = useDebouncedValue(productSearchQuery, 300);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const customerDropdownRef = useRef(null);
  const supplierDropdownRef = useRef(null);
  const productDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Customer/Supplier block: close both (single combined dropdown or either list)
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
        setShowSupplierDropdown(false);
      }
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target)) {
        setShowSupplierDropdown(false);
        setShowCustomerDropdown(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const customerListLimit = debouncedCustomerSearch.trim()
    ? ENTITY_DROPDOWN_SEARCH_LIMIT
    : ENTITY_DROPDOWN_INITIAL_LIMIT;

  const { data: customersData } = useGetCustomersQuery(
    {
      limit: customerListLimit,
      page: 1,
      ...(debouncedCustomerSearch.trim() ? { search: debouncedCustomerSearch.trim() } : {}),
    },
    { skip: !showCustomerDropdown }
  );

  const allCustomers = useMemo(() => {
    return customersData?.data?.customers || customersData?.customers || customersData?.data || [];
  }, [customersData]);

  const supplierListLimit = debouncedSupplierSearch.trim()
    ? ENTITY_DROPDOWN_SEARCH_LIMIT
    : ENTITY_DROPDOWN_INITIAL_LIMIT;

  const { data: suppliersData } = useGetSuppliersQuery(
    {
      limit: supplierListLimit,
      page: 1,
      ...(debouncedSupplierSearch.trim() ? { search: debouncedSupplierSearch.trim() } : {}),
    },
    { skip: !showSupplierDropdown }
  );

  const allSuppliers = useMemo(() => {
    return suppliersData?.data?.suppliers || suppliersData?.suppliers || suppliersData?.data || [];
  }, [suppliersData]);

  const productListLimit = debouncedProductSearch.trim()
    ? ENTITY_DROPDOWN_SEARCH_LIMIT
    : ENTITY_DROPDOWN_INITIAL_LIMIT;

  const { data: productsData } = useGetProductsQuery(
    {
      limit: productListLimit,
      page: 1,
      ...(debouncedProductSearch.trim() ? { search: debouncedProductSearch.trim() } : {}),
    },
    { skip: !showProductDropdown }
  );

  const allProducts = useMemo(() => {
    return productsData?.data?.products || productsData?.products || productsData?.data || [];
  }, [productsData]);

  const filteredCustomers = useMemo(() => {
    if (customerSearchQuery.trim()) return allCustomers;
    return allCustomers.slice(0, ENTITY_DROPDOWN_INITIAL_LIMIT);
  }, [allCustomers, customerSearchQuery]);

  const filteredSuppliers = useMemo(() => {
    if (supplierSearchQuery.trim()) return allSuppliers;
    return allSuppliers.slice(0, ENTITY_DROPDOWN_INITIAL_LIMIT);
  }, [allSuppliers, supplierSearchQuery]);

  const filteredProducts = useMemo(() => {
    if (productSearchQuery.trim()) return allProducts;
    return allProducts.slice(0, ENTITY_DROPDOWN_INITIAL_LIMIT);
  }, [allProducts, productSearchQuery]);

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
    if (field === 'customer') {
      const c = allCustomers.find((x) => String(entityId(x)) === String(value));
      setCustomerSearchQuery(value && c ? (c.businessName || c.business_name || c.displayName || c.name || '') : '');
    }
    if (field === 'supplier') {
      const s = allSuppliers.find((x) => String(entityId(x)) === String(value));
      setSupplierSearchQuery(value && s ? (s.companyName || s.company_name || s.businessName || s.business_name || s.displayName || s.name || '') : '');
    }
    if (field === 'product') {
      setProductSearchQuery(value ? (allProducts.find((p) => String(entityId(p)) === String(value))?.name || '') : '');
    }
  };

  const handleCustomerSelect = (customer) => {
    setFilters({ ...filters, customer: entityId(customer), supplier: '' });
    setCustomerSearchQuery(customer.businessName || customer.business_name || customer.displayName || customer.name || '');
    setShowCustomerDropdown(false);
    setSupplierSearchQuery('');
  };

  const handleSupplierSelect = (supplier) => {
    setFilters({ ...filters, supplier: entityId(supplier), customer: '' });
    setSupplierSearchQuery(supplier.companyName || supplier.company_name || supplier.businessName || supplier.business_name || supplier.displayName || supplier.name || '');
    setShowSupplierDropdown(false);
    setCustomerSearchQuery('');
  };

  const handleProductSelect = (product) => {
    setFilters({ ...filters, product: entityId(product) });
    setProductSearchQuery(product.name || '');
    setShowProductDropdown(false);
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

  return (
    <PageShell className="bg-slate-50/90 print:bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 print:px-4 print:py-4">
        {/* Page header — hidden when printing */}
        <header className="mb-8 print:hidden">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-600/20">
              <FileText className="h-6 w-6 text-white" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Stock Ledger</h1>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed max-w-2xl">
                View stock movement history with detailed filters and comprehensive reporting.
              </p>
            </div>
          </div>
        </header>

        {/* Filter card — hidden when printing */}
        <section className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm print:hidden">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <Search className="h-4 w-4 text-slate-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Filter Options</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
            {/* Invoice Type */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Invoice Type
              </label>
              <select
                value={filters.invoiceType}
                onChange={(e) => handleFilterChange('invoiceType', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300"
              >
                <option value="--All--">--All--</option>
                <option value="SALE">SALE</option>
                <option value="PURCHASE">PURCHASE</option>
                <option value="PURCHASE RETURN">PURCHASE RETURN</option>
                <option value="SALE RETURN">SALE RETURN</option>
                <option value="DEMAGE">DEMAGE</option>
              </select>
            </div>

            {/* Customer / Supplier */}
            <div className="relative" ref={customerDropdownRef}>
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Customer / Supplier
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Select customer or supplier..."
                  value={customerSearchQuery || supplierSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (filters.customer) {
                      setCustomerSearchQuery(value);
                      setShowCustomerDropdown(true);
                      setShowSupplierDropdown(false);
                    } else if (filters.supplier) {
                      setSupplierSearchQuery(value);
                      setShowSupplierDropdown(true);
                      setShowCustomerDropdown(false);
                    } else {
                      // Single search filters both: show one dropdown with customers + suppliers
                      setCustomerSearchQuery(value);
                      setSupplierSearchQuery(value);
                      setShowCustomerDropdown(true);
                      setShowSupplierDropdown(true);
                    }
                  }}
                  onFocus={() => {
                    if (filters.customer) {
                      setShowCustomerDropdown(true);
                      setShowSupplierDropdown(false);
                    } else if (filters.supplier) {
                      setShowSupplierDropdown(true);
                      setShowCustomerDropdown(false);
                    } else {
                      setShowCustomerDropdown(true);
                      setShowSupplierDropdown(true);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300"
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                {/* When a customer is already selected: show only customer list for re-search */}
                {showCustomerDropdown && filters.customer && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id || customer._id}
                        onClick={() => handleCustomerSelect(customer)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-sm font-semibold text-gray-900">
                          {customer.businessName || customer.business_name || customer.displayName || customer.name}
                        </div>
                        {customer.email && (
                          <div className="text-xs text-gray-500 mt-0.5">{customer.email}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* When a supplier is already selected: show only supplier list for re-search */}
                {showSupplierDropdown && filters.supplier && filteredSuppliers.length > 0 && (
                  <div className="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {filteredSuppliers.map((supplier) => (
                      <button
                        key={supplier.id || supplier._id}
                        onClick={() => handleSupplierSelect(supplier)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-sm font-semibold text-gray-900">
                          {supplier.companyName || supplier.company_name || supplier.businessName || supplier.business_name || supplier.displayName || supplier.name}
                        </div>
                        {supplier.email && (
                          <div className="text-xs text-gray-500 mt-0.5">{supplier.email}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* When neither selected: one combined dropdown with customers + suppliers filtered by search */}
                {!filters.customer && !filters.supplier && (showCustomerDropdown || showSupplierDropdown) && (filteredCustomers.length > 0 || filteredSuppliers.length > 0) && (
                  <div className="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {filteredCustomers.length > 0 && (
                      <>
                        <div className="px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky top-0">
                          Customers
                        </div>
                        {filteredCustomers.map((customer) => (
                          <button
                            key={`c-${customer.id || customer._id}`}
                            onClick={() => handleCustomerSelect(customer)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              {customer.businessName || customer.business_name || customer.displayName || customer.name}
                            </div>
                            {customer.email && (
                              <div className="text-xs text-gray-500 mt-0.5">{customer.email}</div>
                            )}
                          </button>
                        ))}
                      </>
                    )}
                    {filteredSuppliers.length > 0 && (
                      <>
                        <div className="px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky top-0">
                          Suppliers
                        </div>
                        {filteredSuppliers.map((supplier) => (
                          <button
                            key={`s-${supplier.id || supplier._id}`}
                            onClick={() => handleSupplierSelect(supplier)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              {supplier.companyName || supplier.company_name || supplier.businessName || supplier.business_name || supplier.displayName || supplier.name}
                            </div>
                            {supplier.email && (
                              <div className="text-xs text-gray-500 mt-0.5">{supplier.email}</div>
                            )}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              {(filters.customer || filters.supplier) && (
                <button
                  onClick={() => {
                    handleFilterChange('customer', '');
                    handleFilterChange('supplier', '');
                    setCustomerSearchQuery('');
                    setSupplierSearchQuery('');
                  }}
                  className="absolute right-3 top-11 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                  title="Clear selection"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Invoice No */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Invoice No
              </label>
              <input
                type="text"
                placeholder="Enter invoice number..."
                value={filters.invoiceNo}
                onChange={(e) => handleFilterChange('invoiceNo', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300"
              />
            </div>

            {/* Product */}
            <div className="relative" ref={productDropdownRef}>
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Package className="h-3.5 w-3.5 text-slate-400" />
                Product
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Select product..."
                  value={productSearchQuery}
                  onChange={(e) => {
                    setProductSearchQuery(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300"
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id || product._id}
                        onClick={() => handleProductSelect(product)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-sm font-semibold text-gray-900">{product.name}</div>
                        {product.sku && (
                          <div className="text-xs text-gray-500 mt-0.5">SKU: {product.sku}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {filters.product && (
                <button
                  onClick={() => {
                    handleFilterChange('product', '');
                    setProductSearchQuery('');
                  }}
                  className="absolute right-3 top-11 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                  title="Clear selection"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

          </div>

          {/* Date range + Clear + View Report: one row, shared card, aligned centers */}
          <div className="mt-5">
            <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Date Range
            </label>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <DateFilter
                    startDate={filters.dateFrom}
                    endDate={filters.dateTo}
                    onDateChange={(startDate, endDate) => {
                      setFilters({ ...filters, dateFrom: startDate, dateTo: endDate });
                    }}
                    compact={false}
                    showPresets={false}
                    showLabel={false}
                    className="!space-y-0"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleView}
                  disabled={isLoading || isFetching}
                  className="h-11 min-w-[160px] shrink-0 gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" />
                  {isLoading || isFetching ? 'Loading…' : 'View Report'}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Report */}
        {showReport && (
          <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
            {/* Print-only title (screen uses page header + blue bar below) */}
            <div className="hidden print:block print:px-2 print:pb-3 print:mb-2 print:border-b print:border-slate-300">
              <h1 className="text-center text-xl font-bold tracking-tight text-slate-900">Stock Ledger</h1>
            </div>
            {/* Report header bar — hidden on print (replaced by simple title above) */}
            <div className="flex items-start justify-between gap-4 bg-blue-600 px-5 py-4 sm:px-6 sm:py-5 print:hidden">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white print:text-slate-900 sm:text-xl">
                  <FileText className="h-5 w-5 shrink-0 text-white/95 print:text-slate-800" />
                  Stock Ledger Report
                </h2>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-blue-100 print:text-slate-600">
                  <Calendar className="h-4 w-4 shrink-0 opacity-90" />
                  <span>
                    From: {formatDateForReport(filters.dateFrom)} To: {formatDateForReport(filters.dateTo)}
                  </span>
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={handlePrint}
                className="h-10 w-10 shrink-0 rounded-lg border border-white/25 bg-blue-700 text-white hover:bg-blue-800 print:hidden"
                title="Print"
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>

            {/* Report Content */}
            {isLoading || isFetching ? (
              <div className="bg-slate-50/50 px-6 py-16 text-center">
                <div className="mx-auto mb-4 inline-flex rounded-full bg-blue-50 p-4">
                  <LoadingSpinner />
                </div>
                <p className="text-sm font-medium text-slate-600">Loading stock ledger data…</p>
              </div>
            ) : ledger.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-4 inline-flex rounded-full bg-slate-100 p-4">
                  <FileText className="h-10 w-10 text-slate-400" />
                </div>
                <p className="text-base font-semibold text-slate-800">No data found</p>
                <p className="mt-1 text-sm text-slate-500">Try adjusting your filters to see results.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/95">
                      {['S.No', 'Invoice Date', 'Invoice No', 'Invoice Type', 'Customer / Supplier', 'Price', 'Qty', 'Amount', 'Qty Left'].map((h) => (
                        <th
                          key={h}
                          className={cn(
                            'whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500',
                            ['Price', 'Qty', 'Amount', 'Qty Left'].includes(h) ? 'text-right' : 'text-left'
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledger.map((productGroup, groupIndex) => (
                      <React.Fragment key={productGroup.productId || groupIndex}>
                        <tr className="border-l-4 border-sky-400 bg-sky-50/90">
                          <td colSpan={8} className="px-4 py-2.5">
                            <div className="flex items-center gap-2 font-semibold text-sky-950">
                              <Package className="h-4 w-4 text-sky-700" />
                              {productGroup.productName}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-sky-950">
                            {productGroup.qtyLeft ?? '—'}
                          </td>
                        </tr>
                        {productGroup.entries.map((entry, entryIndex) => (
                          <tr
                            key={`${entry.referenceId}-${entryIndex}`}
                            className="bg-white transition-colors hover:bg-slate-50/90"
                          >
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-600 tabular-nums">
                              {entryIndex + 1}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                              {formatDate(entry.invoiceDate)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                              {entry.invoiceNo}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                  (() => {
                                    const t = String(entry.invoiceType || '');
                                    if (t.includes('RETURN')) return 'bg-amber-100 text-amber-900';
                                    if (t === 'SALE') return 'bg-emerald-100 text-emerald-800';
                                    if (t === 'PURCHASE') return 'bg-blue-100 text-blue-800';
                                    return 'bg-slate-100 text-slate-700';
                                  })()
                                )}
                              >
                                {entry.invoiceType}
                              </span>
                            </td>
                            <td className="max-w-[200px] truncate px-4 py-3 text-slate-800" title={entry.customerSupplier}>
                              {entry.customerSupplier}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-800">
                              {formatCurrency(entry.price)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                              {entry.quantity < 0 ? (
                                <span className="text-red-600">({Math.abs(entry.quantity)})</span>
                              ) : (
                                <span className="text-slate-900">{entry.quantity}</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                              {entry.amount < 0 ? (
                                <span className="text-red-600">({formatCurrency(Math.abs(entry.amount))})</span>
                              ) : (
                                <span className="text-slate-900">{formatCurrency(entry.amount)}</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-800">
                              {productGroup.qtyLeft != null ? productGroup.qtyLeft : '—'}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-sky-100/80 font-semibold text-sky-950">
                          <td colSpan={5} className="px-4 py-2.5">
                            Total of {productGroup.productName}
                          </td>
                          <td className="px-4 py-2.5 text-right" />
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {productGroup.totalQuantity < 0 ? (
                              <span className="text-red-700">({Math.abs(productGroup.totalQuantity)})</span>
                            ) : (
                              <span>{productGroup.totalQuantity}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {productGroup.totalAmount < 0 ? (
                              <span className="text-red-700">({formatCurrency(Math.abs(productGroup.totalAmount))})</span>
                            ) : (
                              <span>{formatCurrency(productGroup.totalAmount)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-blue-800">
                            {productGroup.qtyLeft ?? '—'}
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                    <tr className="bg-slate-900 text-sm font-bold text-white">
                      <td colSpan={5} className="px-4 py-3.5">
                        Grand Total
                      </td>
                      <td className="px-4 py-3.5 text-right" />
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {grandTotal.totalQuantity < 0 ? (
                          <span className="text-red-300">({Math.abs(grandTotal.totalQuantity)})</span>
                        ) : (
                          <span className="text-emerald-200">{grandTotal.totalQuantity}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {grandTotal.totalAmount < 0 ? (
                          <span className="text-red-300">({formatCurrency(Math.abs(grandTotal.totalAmount))})</span>
                        ) : (
                          <span className="text-emerald-200">{formatCurrency(grandTotal.totalAmount)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {ledger.length > 0 && (
              <footer className="flex flex-col gap-1 border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 print:border-slate-300">
                <span>
                  Print Date:{' '}
                  {new Date().toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  })}
                </span>
                <span className="tabular-nums">
                  Page: {pagination.current} of {pagination.pages}
                </span>
              </footer>
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
};

export default StockLedger;
