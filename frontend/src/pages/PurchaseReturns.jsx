import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  RotateCcw,
  Plus,
  Minus,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  User,
  ShoppingCart,
  Trash2,
  Receipt
} from 'lucide-react';
import {
  useGetPurchaseReturnsQuery,
  useGetSupplierInvoicesQuery,
  useCreatePurchaseReturnMutation,
  useGetPurchaseReturnStatsQuery,
  useLazySearchSupplierProductsQuery,
} from '../store/services/purchaseReturnsApi';
import { useDebouncedSupplierSearch } from '../hooks/useDebouncedSupplierSearch';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingCard, LoadingTable, LoadingButton } from '../components/LoadingSpinner';
import { useResponsive } from '../components/ResponsiveContainer';
import { SearchableDropdown } from '../components/SearchableDropdown';
import CreatePurchaseReturnModal from '../components/CreatePurchaseReturnModal';
import ReturnDetailModal from '../components/ReturnDetailModal';
import DateFilter from '../components/DateFilter';
import { ClearConfirmationDialog } from '../components/ConfirmationDialog';
import { useClearConfirmation } from '../hooks/useConfirmation';
import { getCurrentDatePakistan } from '../utils/dateUtils';
import { Button } from '@/components/ui/button';

const PurchaseReturns = () => {
  const today = getCurrentDatePakistan();
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0, width: 300 });
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Return cart - items selected for return (same as Sale Returns)
  const [returnCart, setReturnCart] = useState([]);
  const [returnNotes, setReturnNotes] = useState('');
  const { confirmation: clearConfirmation, confirmClear, handleConfirm: handleClearConfirm, handleCancel: handleClearCancel } = useClearConfirmation();

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

  const {
    suppliers,
    isLoading: suppliersLoading,
    isFetching: suppliersFetching,
  } = useDebouncedSupplierSearch(supplierSearchTerm, { selectedSupplier });

  // Search products for supplier
  const [searchSupplierProducts, {
    data: productsData,
    isLoading: productsLoading
  }] = useLazySearchSupplierProductsQuery();

  const products = productsData?.data || [];

  // Debounced search for suggestions (empty search = show all products)
  useEffect(() => {
    if (!selectedSupplier?._id) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timeoutId = setTimeout(() => {
      searchSupplierProducts({
        supplierId: selectedSupplier._id,
        search: productSearchTerm.trim() // empty = all products
      }).then((result) => {
        const raw = result?.data?.data ?? result?.data ?? (Array.isArray(result?.data) ? result.data : []);
        const list = Array.isArray(raw) ? raw : (raw?.products ? raw.products : []);
        if (list.length > 0) {
          const suggestions = list.map(productData => {
            const product = productData?.product ?? productData;
            const id = product?._id ?? product?.id;
            const remaining = productData?.remainingReturnableQuantity ?? productData?.remainingQuantity ?? 0;
            return {
              id: id,
              name: product?.name || 'Unknown Product',
              sku: product?.sku || '',
              barcode: product?.barcode || '',
              remainingQuantity: remaining,
              productData
            };
          }).filter(s => s.id && (s.remainingQuantity ?? 0) > 0); // Do not show products with 0 available
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
  }, [productSearchTerm, selectedSupplier?._id, searchSupplierProducts]);

  // Calculate suggestions position (useLayoutEffect for correct position before paint)
  useLayoutEffect(() => {
    if (showSuggestions && searchInputRef.current) {
      const updatePosition = () => {
        if (searchInputRef.current) {
          const rect = searchInputRef.current.getBoundingClientRect();
          setSuggestionsPosition({
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, 280)
          });
        }
      };

      updatePosition();

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
    },
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
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
    setSupplierSearchTerm(
      supplier?.companyName || supplier?.businessName || supplier?.name || ''
    );
    setProductSearchTerm('');
  };

  // Add product directly to return cart (no modal)
  const handleAddToReturnCart = (productData) => {
    if (!productData) return;
    const remaining = productData?.remainingReturnableQuantity ?? productData?.remainingQuantity ?? 0;
    if (remaining <= 0) {
      showErrorToast('This product has no returnable quantity (stock/limit is 0)');
      return;
    }
    const product = productData?.product ?? productData;
    const firstPurchase = productData?.purchases?.[0];
    if (!firstPurchase) {
      showErrorToast('No purchase data for this product');
      return;
    }
    // Use firstPurchase.remainingQuantity (per invoice line), NOT productData.remainingReturnableQuantity (total)
    const maxForThisInvoice = firstPurchase.remainingQuantity ?? productData.remainingReturnableQuantity ?? productData.remainingQuantity ?? 999;
    const returnItem = {
      product: product._id || product.id,
      originalOrder: firstPurchase.invoiceId,
      originalOrderItem: firstPurchase.invoiceItemId,
      quantity: 1,
      originalPrice: productData.previousPrice || firstPurchase.price || 0,
      returnReason: 'defective',
      condition: 'good',
      action: 'refund',
      returnReasonDetail: '',
      refundAmount: 0,
      restockingFee: 0,
      maxQuantity: maxForThisInvoice,
      productName: product?.name || 'Unknown Product'
    };

    setReturnCart(prev => {
      const key = `${returnItem.product}-${returnItem.originalOrder}-${returnItem.originalOrderItem}`;
      const existingIdx = prev.findIndex(
        x => `${x.product}-${x.originalOrder}-${x.originalOrderItem}` === key
      );
      if (existingIdx >= 0) {
        const max = Math.min(prev[existingIdx].maxQuantity ?? 999, returnItem.maxQuantity ?? 999);
        const combinedQty = Math.min((prev[existingIdx].quantity || 0) + 1, max);
        const next = [...prev];
        next[existingIdx] = { ...prev[existingIdx], quantity: combinedQty };
        return next;
      }
      return [...prev, returnItem];
    });

    setShowSuggestions(false);
    setProductSearchTerm('');
    showSuccessToast('Product added to return');
  };

  const handleSuggestionSelect = (suggestion) => {
    if (!suggestion?.productData) return;
    handleAddToReturnCart(suggestion.productData);
  };

  const handleRemoveFromReturnCart = (idx) => {
    setReturnCart(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateReturnQuantity = (idx, newQuantity) => {
    setReturnCart(prev => {
      const item = prev[idx];
      const maxQty = item.maxQuantity || 999;
      const qty = Math.max(1, Math.min(maxQty, parseInt(newQuantity) || 1));
      const next = [...prev];
      next[idx] = { ...item, quantity: qty };
      return next;
    });
  };

  const handleClearReturnCart = () => {
    if (returnCart.length === 0) return;
    confirmClear(returnCart.length, 'return items', () => {
      setReturnCart([]);
      setReturnNotes('');
    });
  };

  const handleCompleteReturn = async () => {
    if (returnCart.length === 0) {
      showErrorToast('Please add at least one product to return');
      return;
    }

    // Clamp quantities to max (per invoice line) - prevents "Cannot return X items. Only Y available" error
    let cart = returnCart;
    const clamped = cart.map(item => {
      const max = item.maxQuantity ?? 999;
      const qty = Math.min(item.quantity || 1, max);
      if (qty !== (item.quantity || 1)) return { ...item, quantity: qty };
      return item;
    });
    const hadOverflow = clamped.some((c, i) => (c.quantity || 1) !== (returnCart[i].quantity || 1));
    if (hadOverflow) {
      setReturnCart(clamped);
      showErrorToast('Quantities adjusted to available limits per invoice');
      return;
    }

    const itemsByOrder = {};
    cart.forEach(item => {
      const orderId = (item.originalOrder?._id || item.originalOrder || item.originalOrderId)?.toString() || String(item.originalOrder);
      if (!itemsByOrder[orderId]) {
        itemsByOrder[orderId] = [];
      }
      itemsByOrder[orderId].push(item);
    });

    try {
      for (const [orderId, items] of Object.entries(itemsByOrder)) {
        const returnData = {
          originalOrder: orderId,
          returnType: 'return',
          priority: 'normal',
          refundMethod: 'original_payment',
          items: items.map(({ productName, maxQuantity, ...rest }) => rest),
          generalNotes: returnNotes,
          origin: 'purchase',
          supplierId: selectedSupplier?._id // For cache invalidation so remaining quantities refresh
        };
        await createPurchaseReturn(returnData).unwrap();
      }
      await refetchReturns();
      window.dispatchEvent(new CustomEvent('accountLedgerInvalidate'));
      showSuccessToast('Purchase return(s) created successfully');
      setReturnCart([]);
      setReturnNotes('');
      // Refetch product list so remaining quantities update
      if (selectedSupplier?._id) {
        searchSupplierProducts({ supplierId: selectedSupplier._id, search: productSearchTerm.trim() })
          .then((result) => {
            const raw = result?.data?.data ?? result?.data ?? (Array.isArray(result?.data) ? result.data : []);
            const list = Array.isArray(raw) ? raw : (raw?.products ? raw.products : []);
            const suggestions = list.map(productData => {
              const product = productData?.product ?? productData;
              const id = product?._id ?? product?.id;
              const remaining = productData?.remainingReturnableQuantity ?? productData?.remainingQuantity ?? 0;
              return { id, name: product?.name || 'Unknown Product', sku: product?.sku || '', barcode: product?.barcode || '', remainingQuantity: remaining, productData };
            }).filter(s => s.id && (s.remainingQuantity ?? 0) > 0);
            setSearchSuggestions(suggestions);
          })
          .catch(() => setSearchSuggestions([]));
      }
    } catch (error) {
      handleApiError(error, 'Create Purchase Return');
    }
  };

  // Handle return creation success (for old modal)
  const handleReturnCreated = async () => {
    await refetchReturns();
    window.dispatchEvent(new CustomEvent('accountLedgerInvalidate'));
    setShowCreateModal(false);
    setSelectedPurchase(null);
    setSelectedSupplier(null);
    setSupplierSearchTerm('');
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
    setSupplierSearchTerm('');
    setProductSearchTerm('');
  };

  const handleNewReturn = () => {
    setSelectedSupplier(null);
    setSupplierSearchTerm('');
    setProductSearchTerm('');
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
      processed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
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
      {/* Header - same layout as Sale Returns */}
      <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start justify-between'}`}>
        <div>
          <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>Purchase Returns</h1>
          <p className="text-gray-600">Manage supplier returns and refunds</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
            compact={true}
            showPresets={true}
            className="w-full sm:w-auto"
          />
          <Button
            onClick={handleNewReturn}
            variant="default"
            size="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Purchase Return
          </Button>
        </div>
      </div>

      {/* Statistics Cards - Total Purchase Return, Total Purchase Return Refund, Total Average */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Purchase Return</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalReturns || 0}</p>
            </div>
            <RotateCcw className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Purchase Return Refund</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats?.netRefundAmount || 0)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Average</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.averageRefundAmount || 0)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Supplier Selection - same layout as Sale Returns customer selection */}
      <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start space-x-12'}`}>
        <div className={`${isMobile ? 'w-full' : 'w-[750px] flex-shrink-0'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Supplier
              </label>
              {selectedSupplier && (
                <button
                  onClick={handleBackToSupplier}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                  title="Change supplier"
                >
                  Change Supplier
                </button>
              )}
            </div>
          </div>
          {suppliersLoading ? (
            <LoadingSpinner />
          ) : (
            <SearchableDropdown
              placeholder="Search supplier by name, phone, or email..."
              items={suppliers}
              onSelect={handleSupplierSelect}
              onSearch={setSupplierSearchTerm}
              value={supplierSearchTerm}
              loading={suppliersLoading || suppliersFetching}
              emptyMessage="No suppliers found"
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

        {/* Supplier Information - Right Side */}
        <div className={`${isMobile ? 'w-full' : 'flex-1'}`}>
          {selectedSupplier && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium">
                    {selectedSupplier.companyName || selectedSupplier.businessName || selectedSupplier.name || 'Supplier'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedSupplier.phone || 'No phone'}
                  </p>
                  <div className="mt-2">
                    {(() => {
                      const rawBalance = selectedSupplier.currentBalance !== undefined && selectedSupplier.currentBalance !== null
                        ? Number(selectedSupplier.currentBalance)
                        : (Number(selectedSupplier.pendingBalance ?? 0) - Number(selectedSupplier.advanceBalance ?? 0));
                      const currentBalance = isNaN(rawBalance) ? 0 : rawBalance;
                      const isPayable = currentBalance > 0;
                      const isReceivable = currentBalance < 0;
                      return (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">Balance:</span>
                          <span className={`text-sm font-medium ${isPayable ? 'text-red-600' : isReceivable ? 'text-green-600' : 'text-gray-600'}`}>
                            {isPayable ? '' : '-'}{Math.abs(currentBalance).toFixed(2)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Selection & Return Items */}
      {selectedSupplier && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Product Selection & Return Items</h3>
          </div>
          <div className="card-content">
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">
                Search by Product Name, SKU, or Barcode (products previously purchased from this supplier)
              </p>
              <div className="flex gap-3 relative flex-col sm:flex-row">
                <div className="flex-1 relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      setShowSuggestions(true); // Show all products on focus (even without typing)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (searchSuggestions.length > 0) {
                          handleSuggestionSelect(searchSuggestions[0]);
                        }
                      }
                    }}
                    placeholder="Search product name, SKU, or barcode - click suggestion to add"
                    className="input w-full"
                  />
                </div>
              </div>
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

            {returnCart.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border-t border-gray-200">
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2">No items in return cart</p>
              </div>
            ) : (
              <div className="space-y-4 border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-700">Return Items</h4>
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Rate</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Total</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {returnCart.map((item, index) => {
                        const total = (item.quantity || 1) * (item.originalPrice || 0);
                        return (
                          <tr key={`${item.product}-${item.originalOrder}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-700">{index + 1}</td>
                            <td className="px-4 py-3 font-medium text-sm text-gray-900">{item.productName || 'Unknown'}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReturnQuantity(index, (item.quantity || 1) - 1)}
                                  disabled={(item.quantity || 1) <= 1}
                                  className="p-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Decrease quantity"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.maxQuantity || 999}
                                  value={item.quantity || 1}
                                  onChange={(e) => handleUpdateReturnQuantity(index, e.target.value)}
                                  className="input text-center h-8 w-20"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReturnQuantity(index, (item.quantity || 1) + 1)}
                                  disabled={(item.quantity || 1) >= (item.maxQuantity || 999)}
                                  className="p-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Increase quantity"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">{formatCurrency(item.originalPrice)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(total)}</td>
                            <td className="px-4 py-3">
                              <Button
                                onClick={() => handleRemoveFromReturnCart(index)}
                                variant="destructive"
                                size="sm"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-3">
                  {returnCart.map((item, index) => {
                    const total = (item.quantity || 1) * (item.originalPrice || 0);
                    return (
                      <div key={`${item.product}-${item.originalOrder}-${index}`} className="p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{index + 1}</span>
                            <span className="ml-2 font-medium text-sm">{item.productName || 'Unknown'}</span>
                          </div>
                          <Button
                            onClick={() => handleRemoveFromReturnCart(index)}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <div>
                            <span className="text-gray-500 block mb-1">Qty:</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateReturnQuantity(index, (item.quantity || 1) - 1)}
                                disabled={(item.quantity || 1) <= 1}
                                className="p-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={item.maxQuantity || 999}
                                value={item.quantity || 1}
                                onChange={(e) => handleUpdateReturnQuantity(index, e.target.value)}
                                className="input text-center h-8 w-16 flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateReturnQuantity(index, (item.quantity || 1) + 1)}
                                disabled={(item.quantity || 1) >= (item.maxQuantity || 999)}
                                className="p-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div><span className="text-gray-500">Rate:</span> <span className="font-medium">{formatCurrency(item.originalPrice)}</span></div>
                          <div className="col-span-2"><span className="text-gray-500">Total:</span> <span className="font-semibold">{formatCurrency(total)}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Return Summary - gradient panel */}
      {returnCart.length > 0 && selectedSupplier && (() => {
        const subtotal = returnCart.reduce((sum, item) => sum + (item.quantity || 1) * (item.originalPrice || 0), 0);
        return (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg max-w-5xl ml-auto mt-4">
            <div className="px-4 sm:px-6 py-4 border-b border-blue-200">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 text-left sm:text-right mb-4">Return Details</h3>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="input h-10 text-sm w-full md:max-w-md ml-auto block md:float-right"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">Return Summary</h3>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-semibold">Subtotal:</span>
                  <span className="text-xl font-bold text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-xl font-bold border-t-2 border-blue-400 pt-3 mt-2">
                  <span className="text-blue-900">Total Refund:</span>
                  <span className="text-blue-900 text-3xl">{formatCurrency(subtotal)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-6">
                <LoadingButton
                  onClick={handleClearReturnCart}
                  isLoading={false}
                  variant="secondary"
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Return Items
                </LoadingButton>
                <LoadingButton
                  onClick={handleCompleteReturn}
                  isLoading={isCreatingReturn}
                  variant="default"
                  className="flex-2"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Complete Return
                </LoadingButton>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Returns List - always visible */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">
            Purchase Returns From: {filters.startDate || startDate || today} To: {filters.endDate || endDate || today}
          </h2>
        </div>
        <div className="card-content">
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
                          returnItem.supplier?.name ||
                          returnItem.originalOrder?.supplier?.companyName ||
                          returnItem.originalOrder?.supplier?.businessName ||
                          returnItem.originalOrder?.supplier?.name ||
                          returnItem.originalOrder?.supplier?.company_name ||
                          returnItem.originalOrder?.supplier?.name ||
                          'N/A'}
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
      </div>

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

      {/* Clear Return Cart Confirmation */}
      <ClearConfirmationDialog
        isOpen={clearConfirmation.isOpen}
        onClose={handleClearCancel}
        onConfirm={handleClearConfirm}
        itemCount={returnCart.length}
        itemType="return items"
        isLoading={false}
      />
    </div>
  );
};

export default PurchaseReturns;
