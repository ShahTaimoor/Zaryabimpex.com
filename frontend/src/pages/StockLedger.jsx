import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Search,
  Printer,
  Download,
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
import toast from 'react-hot-toast';

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

  // Fetch customers
  const { data: customersData } = useGetCustomersQuery(
    { search: customerSearchQuery, limit: 100 },
    { skip: !showCustomerDropdown }
  );

  const allCustomers = useMemo(() => {
    return customersData?.data?.customers || customersData?.customers || customersData?.data || [];
  }, [customersData]);

  // Fetch suppliers
  const { data: suppliersData } = useGetSuppliersQuery(
    { search: supplierSearchQuery, limit: 100 },
    { skip: !showSupplierDropdown }
  );

  const allSuppliers = useMemo(() => {
    return suppliersData?.data?.suppliers || suppliersData?.suppliers || suppliersData?.data || [];
  }, [suppliersData]);

  // Fetch products
  const { data: productsData } = useGetProductsQuery(
    { search: productSearchQuery, limit: 100 },
    { skip: !showProductDropdown }
  );

  const allProducts = useMemo(() => {
    return productsData?.data?.products || productsData?.products || productsData?.data || [];
  }, [productsData]);

  // Filter customers for dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return allCustomers.slice(0, 50);
    const query = customerSearchQuery.toLowerCase();
    return allCustomers.filter(customer => {
      const name = (customer.businessName || customer.name || '').toLowerCase();
      const email = (customer.email || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    }).slice(0, 50);
  }, [allCustomers, customerSearchQuery]);

  // Filter suppliers for dropdown
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery.trim()) return allSuppliers.slice(0, 50);
    const query = supplierSearchQuery.toLowerCase();
    return allSuppliers.filter(supplier => {
      const name = (supplier.companyName || supplier.name || '').toLowerCase();
      const email = (supplier.email || '').toLowerCase();
      const phone = (supplier.phone || '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    }).slice(0, 50);
  }, [allSuppliers, supplierSearchQuery]);

  // Filter products for dropdown
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return allProducts.slice(0, 50);
    const query = productSearchQuery.toLowerCase();
    return allProducts.filter(product => {
      const name = (product.name || '').toLowerCase();
      const sku = (product.sku || '').toLowerCase();
      return name.includes(query) || sku.includes(query);
    }).slice(0, 50);
  }, [allProducts, productSearchQuery]);

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
    if (field === 'customer') {
      setCustomerSearchQuery(value ? (allCustomers.find(c => c._id === value)?.businessName || allCustomers.find(c => c._id === value)?.name || '') : '');
    }
    if (field === 'supplier') {
      setSupplierSearchQuery(value ? (allSuppliers.find(s => s._id === value)?.companyName || allSuppliers.find(s => s._id === value)?.name || '') : '');
    }
    if (field === 'product') {
      setProductSearchQuery(value ? (allProducts.find(p => p._id === value)?.name || '') : '');
    }
  };

  const handleCustomerSelect = (customer) => {
    setFilters({ ...filters, customer: customer._id, supplier: '' });
    setCustomerSearchQuery(customer.businessName || customer.name || '');
    setShowCustomerDropdown(false);
    setSupplierSearchQuery('');
  };

  const handleSupplierSelect = (supplier) => {
    setFilters({ ...filters, supplier: supplier._id, customer: '' });
    setSupplierSearchQuery(supplier.companyName || supplier.name || '');
    setShowSupplierDropdown(false);
    setCustomerSearchQuery('');
  };

  const handleProductSelect = (product) => {
    setFilters({ ...filters, product: product._id });
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Stock Ledger</h1>
          </div>
          <p className="ml-14 text-sm text-gray-600">View stock movement history with detailed filters and comprehensive reporting</p>
        </div>

        {/* Filter Section */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
            <Search className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filter Options</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Invoice Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2.5 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                Invoice Type
              </label>
              <select
                value={filters.invoiceType}
                onChange={(e) => handleFilterChange('invoiceType', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:border-gray-400"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2.5 flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
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
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:border-gray-400"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                {/* When a customer is already selected: show only customer list for re-search */}
                {showCustomerDropdown && filters.customer && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer._id}
                        onClick={() => handleCustomerSelect(customer)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-sm font-semibold text-gray-900">
                          {customer.businessName || customer.name}
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
                  <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredSuppliers.map((supplier) => (
                      <button
                        key={supplier._id}
                        onClick={() => handleSupplierSelect(supplier)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-sm font-semibold text-gray-900">
                          {supplier.companyName || supplier.name}
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
                  <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredCustomers.length > 0 && (
                      <>
                        <div className="px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky top-0">
                          Customers
                        </div>
                        {filteredCustomers.map((customer) => (
                          <button
                            key={`c-${customer._id}`}
                            onClick={() => handleCustomerSelect(customer)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              {customer.businessName || customer.name}
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
                            key={`s-${supplier._id}`}
                            onClick={() => handleSupplierSelect(supplier)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              {supplier.companyName || supplier.name}
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
              <label className="block text-sm font-semibold text-gray-700 mb-2.5 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                Invoice No
              </label>
              <input
                type="text"
                placeholder="Enter invoice number..."
                value={filters.invoiceNo}
                onChange={(e) => handleFilterChange('invoiceNo', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:border-gray-400"
              />
            </div>

            {/* Product */}
            <div className="relative" ref={productDropdownRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2.5 flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
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
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:border-gray-400"
                />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredProducts.map((product) => (
                      <button
                        key={product._id}
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

            {/* Date Range */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2.5 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                Date Range
              </label>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <DateFilter
                  startDate={filters.dateFrom}
                  endDate={filters.dateTo}
                  onDateChange={(startDate, endDate) => {
                    setFilters({ ...filters, dateFrom: startDate, dateTo: endDate });
                  }}
                  compact={false}
                  showPresets={true}
                />
              </div>
            </div>

            {/* View Button */}
            <div className="flex items-end">
              <button
                onClick={handleView}
                disabled={isLoading || isFetching}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Eye className="h-5 w-5" />
                {isLoading || isFetching ? 'Loading...' : 'View Report'}
              </button>
            </div>
          </div>
        </div>

        {/* Report Section */}
        {showReport && (
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 print:shadow-none print:border-none overflow-hidden">
            {/* Report Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 print:bg-white print:from-white print:to-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white print:text-gray-900 flex items-center gap-3">
                    <FileText className="h-6 w-6" />
                    Stock Ledger Report
                  </h2>
                  <p className="text-sm text-blue-100 print:text-gray-600 mt-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    From: {formatDateForReport(filters.dateFrom)} To: {formatDateForReport(filters.dateTo)}
                  </p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button
                    onClick={handlePrint}
                    className="p-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all hover:scale-105 shadow-lg"
                    title="Print"
                  >
                    <Printer className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Report Content */}
            {isLoading || isFetching ? (
              <div className="p-16 text-center bg-gray-50">
                <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
                  <LoadingSpinner />
                </div>
                <p className="text-gray-600 font-medium">Loading stock ledger data...</p>
              </div>
            ) : ledger.length === 0 ? (
              <div className="p-16 text-center bg-gradient-to-br from-gray-50 to-blue-50">
                <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                  <FileText className="h-12 w-12 text-gray-400" />
                </div>
                <p className="text-gray-600 font-semibold text-lg mb-2">No data found</p>
                <p className="text-gray-500">Try adjusting your filters to see results.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                        S.No
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                        Invoice Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                        Invoice No
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                        Invoice Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                        Customer / Supplier
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                        Price
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                        QTY
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ledger.map((productGroup, groupIndex) => (
                      <React.Fragment key={productGroup.productId || groupIndex}>
                        {/* Product Header */}
                        <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 font-bold border-t-2 border-blue-200">
                          <td colSpan="8" className="px-6 py-3 text-sm text-blue-900">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              {productGroup.productName}
                            </div>
                          </td>
                        </tr>
                        {/* Product Entries */}
                        {productGroup.entries.map((entry, entryIndex) => (
                          <tr key={`${entry.referenceId}-${entryIndex}`} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                              {entryIndex + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(entry.invoiceDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                              {entry.invoiceNo}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                entry.invoiceType === 'SALE' ? 'bg-green-100 text-green-800' :
                                entry.invoiceType === 'PURCHASE' ? 'bg-blue-100 text-blue-800' :
                                entry.invoiceType.includes('RETURN') ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {entry.invoiceType}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {entry.customerSupplier}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                              {formatCurrency(entry.price)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                              {entry.quantity < 0 ? (
                                <span className="text-red-600">({Math.abs(entry.quantity)})</span>
                              ) : (
                                <span className="text-green-600">{entry.quantity}</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                              {entry.amount < 0 ? (
                                <span className="text-red-600">({formatCurrency(Math.abs(entry.amount))})</span>
                              ) : (
                                <span className="text-green-600">{formatCurrency(entry.amount)}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {/* Product Total */}
                        <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 font-bold border-t-2 border-blue-300">
                          <td colSpan="5" className="px-6 py-3 text-sm text-blue-900">
                            Total of {productGroup.productName}
                          </td>
                          <td className="px-6 py-3 text-sm text-right text-blue-900"></td>
                          <td className="px-6 py-3 text-sm text-right text-blue-900">
                            {productGroup.totalQuantity < 0 ? (
                              <span className="text-red-700">({Math.abs(productGroup.totalQuantity)})</span>
                            ) : (
                              <span className="text-green-700">{productGroup.totalQuantity}</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-sm text-right text-blue-900">
                            {productGroup.totalAmount < 0 ? (
                              <span className="text-red-700">({formatCurrency(Math.abs(productGroup.totalAmount))})</span>
                            ) : (
                              <span className="text-green-700">{formatCurrency(productGroup.totalAmount)}</span>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                    {/* Grand Total */}
                    <tr className="bg-gradient-to-r from-gray-800 to-gray-900 font-bold text-white border-t-4 border-gray-700">
                      <td colSpan="5" className="px-6 py-4 text-sm">
                        Grand Total
                      </td>
                      <td className="px-6 py-4 text-sm text-right"></td>
                      <td className="px-6 py-4 text-sm text-right">
                        {grandTotal.totalQuantity < 0 ? (
                          <span className="text-red-300">({Math.abs(grandTotal.totalQuantity)})</span>
                        ) : (
                          <span className="text-green-300">{grandTotal.totalQuantity}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        {grandTotal.totalAmount < 0 ? (
                          <span className="text-red-300">({formatCurrency(Math.abs(grandTotal.totalAmount))})</span>
                        ) : (
                          <span className="text-green-300">{formatCurrency(grandTotal.totalAmount)}</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Report Footer */}
            {ledger.length > 0 && (
              <div className="p-4 border-t border-gray-200 text-sm text-gray-600 print:border-t-2">
                <div className="flex justify-between items-center">
                  <div>
                    Print Date: {new Date().toLocaleString('en-GB', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </div>
                  <div>
                    Page: {pagination.current} of {pagination.pages}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockLedger;
