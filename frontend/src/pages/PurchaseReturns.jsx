import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  RotateCcw,
  Search,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Package,
  Users,
  FileText,
  ArrowLeft,
  Calendar,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import {
  useGetPurchaseReturnsQuery,
  useGetSupplierInvoicesQuery,
  useCreatePurchaseReturnMutation,
  useGetPurchaseReturnStatsQuery,
  useLazySearchSupplierProductsQuery,
} from '../store/services/purchaseReturnsApi';
import { useGetSuppliersQuery } from '../store/services/suppliersApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingCard, LoadingTable } from '../components/LoadingSpinner';
import { useResponsive } from '../components/ResponsiveContainer';
import { SearchableDropdown } from '../components/SearchableDropdown';
import CreatePurchaseReturnModal from '../components/CreatePurchaseReturnModal';
import ReturnDetailModal from '../components/ReturnDetailModal';
import ProductSelectionModal from '../components/ProductSelectionModal';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan } from '../utils/dateUtils';

const PurchaseReturns = () => {
  const today = getCurrentDatePakistan();
  const [step, setStep] = useState('supplier'); // 'supplier', 'product-search'
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0, width: 0 });
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Date filter states using Pakistan timezone
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    search: '',
    startDate: today,
    endDate: today
  });

  // Handle date change from DateFilter component
  const handleDateChange = (newStartDate, newEndDate) => {
    setStartDate(newStartDate || '');
    setEndDate(newEndDate || '');
    setFilters(prev => ({
      ...prev,
      startDate: newStartDate || '',
      endDate: newEndDate || '',
      page: 1 // Reset to first page when date changes
    }));
  };

  const { isMobile } = useResponsive();

  // Fetch suppliers for selection
  const { data: suppliersData, isLoading: suppliersLoading } = useGetSuppliersQuery(
    { limit: 100 },
    { skip: step !== 'supplier' }
  );

  const suppliers = suppliersData?.data?.suppliers || suppliersData?.suppliers || suppliersData?.items || [];

  // Search products for supplier
  const [searchSupplierProducts, {
    data: productsData,
    isLoading: productsLoading
  }] = useLazySearchSupplierProductsQuery();

  const products = productsData?.data || [];

  // Debounced search for suggestions
  useEffect(() => {
    // Don't show suggestions if modal is open
    if (showProductModal) {
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    if (!selectedSupplier?._id || !productSearchTerm.trim() || productSearchTerm.length < 1) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowSuggestions(true);

    const timeoutId = setTimeout(() => {
      searchSupplierProducts({
        supplierId: selectedSupplier._id,
        search: productSearchTerm.trim()
      }).then((result) => {
        if (result.data?.data) {
          const suggestions = result.data.data.map(productData => ({
            id: productData.product._id,
            name: productData.product.name || 'Unknown Product',
            sku: productData.product.sku || '',
            barcode: productData.product.barcode || '',
            remainingQuantity: productData.remainingReturnableQuantity
          }));
          setSearchSuggestions(suggestions);
        } else {
          setSearchSuggestions([]);
        }
      }).catch(() => {
        setSearchSuggestions([]);
      }).finally(() => {
        setIsSearching(false);
      });
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timeoutId);
      setIsSearching(false);
    };
  }, [productSearchTerm, selectedSupplier?._id, searchSupplierProducts, showProductModal]);

  // Calculate suggestions position
  useEffect(() => {
    if (showSuggestions && searchInputRef.current) {
      const updatePosition = () => {
        if (searchInputRef.current) {
          const rect = searchInputRef.current.getBoundingClientRect();
          setSuggestionsPosition({
            top: rect.bottom + window.scrollY + 4, // 4px margin
            left: rect.left + window.scrollX,
            width: rect.width
          });
        }
      };

      updatePosition();

      // Update position on scroll or resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [showSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    if (!showSuggestions) return;

    const handleClickOutside = (event) => {
      const target = event.target;
      const isClickInSuggestions = suggestionsRef.current?.contains(target);
      const isClickInInput = searchInputRef.current?.contains(target);

      if (!isClickInSuggestions && !isClickInInput) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);

  // Fetch purchase returns (use dates from filters)
  const {
    data: returnsData,
    isLoading: returnsLoading,
    error: returnsError,
    refetch: refetchReturns
  } = useGetPurchaseReturnsQuery({
    ...filters,
    dateFrom: filters.startDate || undefined,
    dateTo: filters.endDate || undefined
  }, {
    onError: (error) => {
      handleApiError(error, 'Fetch Purchase Returns');
    }
  });

  const returns = returnsData?.data || [];
  const pagination = returnsData?.pagination || {};

  // Fetch return statistics (use dates from filters)
  const {
    data: statsData,
    isLoading: statsLoading
  } = useGetPurchaseReturnStatsQuery(
    filters.startDate && filters.endDate
      ? {
        startDate: filters.startDate,
        endDate: filters.endDate
      }
      : {}
  );

  const stats = statsData?.data || {};

  // Create return mutation
  const [createPurchaseReturn, { isLoading: isCreatingReturn }] = useCreatePurchaseReturnMutation();

  // Handle supplier selection
  const handleSupplierSelect = (supplier) => {
    setSelectedSupplier(supplier);
    setStep('product-search');
    setProductSearchTerm('');
  };

  // Handle product search
  const handleProductSearch = (searchTerm = null) => {
    const term = searchTerm || productSearchTerm;
    if (!selectedSupplier?._id) {
      showErrorToast('Please select a supplier first');
      return;
    }
    if (!term.trim()) {
      showErrorToast('Please enter a search term');
      return;
    }
    setShowSuggestions(false); // Hide suggestions before opening modal
    searchSupplierProducts({
      supplierId: selectedSupplier._id,
      search: term.trim()
    });
    setShowProductModal(true);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion) => {
    setProductSearchTerm(suggestion.name);
    setShowSuggestions(false);
    handleProductSearch(suggestion.name);
  };

  // Handle product selection confirmation
  const handleProductSelectionConfirm = async (returnItems) => {
    if (returnItems.length === 0) {
      showErrorToast('Please select at least one product');
      return;
    }

    // Group items by originalOrder
    const itemsByOrder = {};
    returnItems.forEach(item => {
      const orderId = item.originalOrder.toString();
      if (!itemsByOrder[orderId]) {
        itemsByOrder[orderId] = [];
      }
      itemsByOrder[orderId].push(item);
    });

    // For now, create return for the first order (we can enhance this later)
    const firstOrderId = Object.keys(itemsByOrder)[0];
    const itemsForReturn = itemsByOrder[firstOrderId];

    try {
      const returnData = {
        originalOrder: firstOrderId,
        returnType: 'return',
        priority: 'normal',
        refundMethod: 'original_payment',
        items: itemsForReturn,
        generalNotes: '',
        origin: 'purchase'
      };

      await createPurchaseReturn(returnData).unwrap();
      showSuccessToast('Purchase return created successfully');
      setShowProductModal(false);
      setProductSearchTerm('');
      setSelectedSupplier(null);
      setStep('supplier');
      refetchReturns();
    } catch (error) {
      handleApiError(error, 'Create Purchase Return');
    }
  };

  // Handle return creation success (for old modal)
  const handleReturnCreated = () => {
    setShowCreateModal(false);
    setSelectedPurchase(null);
    setSelectedSupplier(null);
    setStep('supplier');
    refetchReturns();
    showSuccessToast('Purchase return created successfully');
  };

  // Handle return detail view
  const handleReturnSelect = (returnItem) => {
    setSelectedReturn(returnItem);
    setShowDetailModal(true);
  };

  // Handle back to supplier selection
  const handleBackToSupplier = () => {
    setSelectedSupplier(null);
    setProductSearchTerm('');
    setStep('supplier');
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date (handle timezone properly - show date only, no time)
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      // Parse the date string and extract just the date part
      const date = new Date(dateString);
      // Get local date components to avoid timezone issues
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();

      // Create a new date with local components
      const localDate = new Date(year, month, day);
      return localDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
      approved: { bg: 'bg-blue-100', text: 'text-blue-800', icon: CheckCircle },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
      processing: { bg: 'bg-purple-100', text: 'text-purple-800', icon: Package },
      received: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: Package },
      completed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: XCircle },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-4 lg:space-y-6 w-full max-w-full overflow-x-hidden px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Purchase Returns</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage supplier returns and refunds</p>
        </div>

        {/* Date Filter using DateFilter component */}
        <div className="w-full sm:w-auto">
          <DateFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
            compact={true}
            showPresets={true}
            className="w-full"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Returns</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalReturns || 0}</p>
            </div>
            <RotateCcw className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats?.pendingReturns || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Refund</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats?.netRefundAmount || 0)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Refund</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.averageRefundAmount || 0)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Step 1: Supplier Selection */}
      {step === 'supplier' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Step 1: Select Supplier</h2>
              <p className="text-sm text-gray-600">Choose a supplier to view their purchases and create a return</p>
            </div>

            <div className="flex-1 md:max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Supplier
              </label>
              {suppliersLoading ? (
                <LoadingSpinner />
              ) : (
                <SearchableDropdown
                  placeholder="Search supplier by name, phone, or email..."
                  items={suppliers}
                  onSelect={handleSupplierSelect}
                  displayKey={(supplier) => {
                    const name = supplier.companyName || supplier.businessName || supplier.name || 'Unknown';
                    return (
                      <div>
                        <div className="font-medium">{name}</div>
                        {supplier.phone && (
                          <div className="text-xs text-gray-500">Phone: {supplier.phone}</div>
                        )}
                      </div>
                    );
                  }}
                  selectedItem={selectedSupplier}
                  className="w-full"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Product Search */}
      {step === 'product-search' && selectedSupplier && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <button
                  onClick={handleBackToSupplier}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Change Supplier
                </button>
                <h2 className="text-lg font-semibold text-gray-900">
                  Step 2: Search Products
                </h2>
                <p className="text-sm text-gray-600">
                  Supplier: <span className="font-medium">
                    {selectedSupplier.companyName || selectedSupplier.businessName || selectedSupplier.name || 'N/A'}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Search by Product Name, SKU, or Barcode
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3 relative">
              <div className="flex-1 relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={productSearchTerm}
                  onChange={(e) => {
                    setProductSearchTerm(e.target.value);
                    if (e.target.value.trim().length >= 1) {
                      setShowSuggestions(true);
                    } else {
                      setShowSuggestions(false);
                    }
                  }}
                  onFocus={() => {
                    if (searchSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleProductSearch();
                    }
                  }}
                  placeholder="Enter product name, SKU, or barcode..."
                  className="input w-full"
                />
              </div>
              <button
                onClick={() => handleProductSearch()}
                disabled={!productSearchTerm.trim()}
                className="btn btn-primary"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
            </div>
          </div>

          {/* Suggestions Dropdown - Using Portal */}
          {showSuggestions && createPortal(
            <div
              ref={suggestionsRef}
              className="fixed z-[9999] bg-white shadow-lg max-h-96 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-gray-200"
              style={{
                top: `${suggestionsPosition.top}px`,
                left: `${suggestionsPosition.left}px`,
                width: `${suggestionsPosition.width}px`
              }}
            >
              {isSearching ? (
                <div className="px-4 py-8 text-center">
                  <LoadingSpinner size="sm" />
                  <p className="text-sm text-gray-500 mt-2">Searching...</p>
                </div>
              ) : searchSuggestions.length > 0 ? (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                    Suggestions ({searchSuggestions.length})
                  </div>
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium">{suggestion.name}</div>
                      <div className="flex gap-4 text-xs text-gray-500 mt-1">
                        {suggestion.sku && <span>SKU: {suggestion.sku}</span>}
                        {suggestion.barcode && <span>Barcode: {suggestion.barcode}</span>}
                        <span className="text-green-600">Available: {suggestion.remainingQuantity}</span>
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  No products found
                </div>
              )}
            </div>,
            document.body
          )}
        </div>
      )}

      {/* Returns List */}
      {step === 'supplier' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Purchase Returns</h2>
          </div>

          {returnsLoading ? (
            <LoadingTable />
          ) : returns.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No purchase returns found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Return Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Original Purchase
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {returns.map((returnItem) => (
                    <tr key={returnItem._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {returnItem.returnNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {returnItem.supplier?.companyName || returnItem.supplier?.businessName ||
                          returnItem.supplier?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {returnItem.originalOrder?.invoiceNumber ||
                          returnItem.originalOrder?.poNumber ||
                          (returnItem.originalOrder?._id ? `Invoice ${returnItem.originalOrder._id.toString().slice(-6)}` : 'N/A')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(returnItem.netRefundAmount || 0)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getStatusBadge(returnItem.status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(returnItem.returnDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleReturnSelect(returnItem)}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Product Selection Modal */}
      {showProductModal && selectedSupplier && (
        <ProductSelectionModal
          isOpen={showProductModal}
          onClose={() => {
            setShowProductModal(false);
            setProductSearchTerm('');
          }}
          products={products}
          isLoading={productsLoading}
          type="purchase"
          onConfirm={handleProductSelectionConfirm}
        />
      )}

      {/* Create Return Modal (legacy - kept for backward compatibility) */}
      {showCreateModal && selectedPurchase && selectedSupplier && (
        <CreatePurchaseReturnModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedPurchase(null);
          }}
          onSuccess={handleReturnCreated}
          purchaseInvoice={selectedPurchase}
          supplier={selectedSupplier}
        />
      )}

      {/* Return Detail Modal */}
      {showDetailModal && selectedReturn && (
        <ReturnDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReturn(null);
          }}
          returnData={selectedReturn}
          onUpdate={refetchReturns}
        />
      )}
    </div>
  );
};

export default PurchaseReturns;
