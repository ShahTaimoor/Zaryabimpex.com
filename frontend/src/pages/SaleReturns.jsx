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
  useGetSaleReturnsQuery,
  useGetCustomerInvoicesQuery,
  useCreateSaleReturnMutation,
  useGetSaleReturnStatsQuery,
  useLazySearchCustomerProductsQuery,
} from '../store/services/saleReturnsApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingTable } from '../components/LoadingSpinner';
import { useResponsive } from '../components/ResponsiveContainer';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../components/ComponentRegistry';
import { SearchableDropdown } from '../components/SearchableDropdown';
import CreateSaleReturnModal from '../components/CreateSaleReturnModal';
import ReturnDetailModal from '../components/ReturnDetailModal';
import DateFilter from '../components/DateFilter';
import { ClearConfirmationDialog } from '../components/ConfirmationDialog';
import { useClearConfirmation } from '../hooks/useConfirmation';
import { getCurrentDatePakistan } from '../utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SaleReturns = () => {
  const today = getCurrentDatePakistan();
  const [step, setStep] = useState('customer'); // used for API skip optimization
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestionsPosition, setSuggestionsPosition] = useState({ top: 0, left: 0, width: 300 });
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Return cart - items selected for return (mirrors Sales cart flow)
  const [returnCart, setReturnCart] = useState([]);
  const [returnNotes, setReturnNotes] = useState('');
  const { confirmation: clearConfirmation, confirmClear, handleConfirm: handleClearConfirm, handleCancel: handleClearCancel } = useClearConfirmation();

  // Date filter states using Pakistan timezone - default to today
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
  const { openTab, getActiveTab, updateTabTitle } = useTab();

  // Fetch customers for selection
  const { data: customersData, isLoading: customersLoading } = useGetCustomersQuery(
    { limit: 100 },
    { skip: false }
  );

  const customers = customersData?.data?.customers || customersData?.customers || customersData?.items || [];

  // Search products for customer
  const [searchCustomerProducts, {
    data: productsData,
    isLoading: productsLoading
  }] = useLazySearchCustomerProductsQuery();

  const products = productsData?.data || [];

  // Debounced search for suggestions (empty search = show all products)
  useEffect(() => {
    if (!selectedCustomer?._id) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timeoutId = setTimeout(() => {
      searchCustomerProducts({
        customerId: selectedCustomer._id,
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
  }, [productSearchTerm, selectedCustomer?._id, searchCustomerProducts]);

  // Calculate suggestions position (useLayoutEffect so position is correct before paint)
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

  // Fetch sale returns (use dates from filters)
  const {
    data: returnsData,
    isLoading: returnsLoading,
    error: returnsError,
    refetch: refetchReturns
  } = useGetSaleReturnsQuery({
    ...filters,
    dateFrom: filters.startDate || undefined,
    dateTo: filters.endDate || undefined
  }, {
    onError: (error) => {
      handleApiError(error, 'Fetch Sale Returns');
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
  } = useGetSaleReturnStatsQuery(
    filters.startDate && filters.endDate
      ? {
        startDate: filters.startDate,
        endDate: filters.endDate
      }
      : {}
  );

  const stats = statsData?.data || {};

  // Create return mutation
  const [createSaleReturn, { isLoading: isCreatingReturn }] = useCreateSaleReturnMutation();

  // Handle customer selection
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setStep('product-search');
    setProductSearchTerm('');
  };

  // Add product to return cart - one row per product, maxQuantity = total remaining across all order lines
  const handleAddToReturnCart = (productData) => {
    if (!productData) return;
    const totalRemaining = productData?.remainingReturnableQuantity ?? productData?.remainingQuantity ?? 0;
    if (totalRemaining <= 0) {
      showErrorToast('This product has no returnable quantity (stock/limit is 0)');
      return;
    }
    const product = productData?.product ?? productData;
    const sales = (productData?.sales ?? []).filter(s => (s.remainingQuantity ?? 0) > 0);
    if (!sales.length) {
      showErrorToast('No sale data for this product');
      return;
    }
    // maxQuantity = total remaining (soldQuantity - alreadyReturnedQuantity) across ALL order lines
    const maxQty = totalRemaining;
    const orderLines = sales.map(s => ({
      originalOrder: s.orderId || s.invoiceId,
      originalOrderItem: s.orderItemId || s.invoiceItemId,
      remainingQuantity: s.remainingQuantity ?? 0,
      price: s.price ?? productData.previousPrice ?? 0
    }));

    const returnItem = {
      product: product._id || product.id,
      originalOrder: orderLines[0]?.originalOrder,
      originalOrderItem: orderLines[0]?.originalOrderItem,
      quantity: 1,
      originalPrice: productData.previousPrice ?? sales[0]?.price ?? 0,
      returnReason: 'changed_mind',
      condition: 'good',
      action: 'refund',
      returnReasonDetail: '',
      refundAmount: 0,
      restockingFee: 0,
      maxQuantity: maxQty,
      orderLines,
      productName: product?.name || 'Unknown Product'
    };

    setReturnCart(prev => {
      const existingIdx = prev.findIndex(x => String(x.product) === String(returnItem.product));
      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        const mergedLines = mergeOrderLines(existing.orderLines ?? [buildLegacyOrderLine(existing)], orderLines);
        const newMax = mergedLines.reduce((s, l) => s + l.remainingQuantity, 0);
        const newQty = Math.min((existing.quantity ?? 1) + 1, newMax);
        const next = [...prev];
        next[existingIdx] = { ...existing, orderLines: mergedLines, maxQuantity: newMax, quantity: newQty };
        return next;
      }
      return [...prev, returnItem];
    });

    setShowSuggestions(false);
    setProductSearchTerm('');
    showSuccessToast('Product added to return');
  };

  const mergeOrderLines = (a, b) => {
    const map = new Map();
    for (const line of a) {
      const key = `${line.originalOrder}-${line.originalOrderItem}`;
      map.set(key, { ...line });
    }
    for (const line of b) {
      const key = `${line.originalOrder}-${line.originalOrderItem}`;
      if (!map.has(key)) map.set(key, { ...line });
    }
    return Array.from(map.values());
  };

  const buildLegacyOrderLine = (item) => ({
    originalOrder: item.originalOrder,
    originalOrderItem: item.originalOrderItem,
    remainingQuantity: item.maxQuantity ?? 999,
    price: item.originalPrice
  });

  // Handle suggestion selection - add directly to return cart (no modal)
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

    let cart = returnCart;
    const clamped = cart.map(item => {
      const max = item.maxQuantity ?? 999;
      const qty = Math.min(item.quantity ?? 1, max);
      return qty !== (item.quantity ?? 1) ? { ...item, quantity: qty } : item;
    });
    const hadOverflow = clamped.some((c, i) => (c.quantity ?? 1) !== (returnCart[i].quantity ?? 1));
    if (hadOverflow) {
      setReturnCart(clamped);
      showErrorToast('Quantities adjusted to available limits');
      return;
    }

    // Expand merged items: allocate quantity across order lines
    const expandedItems = [];
    for (const item of cart) {
      const qty = Math.max(1, item.quantity ?? 1);
      const lines = item.orderLines?.length ? item.orderLines : [buildLegacyOrderLine(item)];
      let remaining = qty;
      for (const line of lines) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, line.remainingQuantity ?? 999);
        if (take <= 0) continue;
        remaining -= take;
        expandedItems.push({
          product: item.product,
          originalOrder: line.originalOrder,
          originalOrderItem: line.originalOrderItem,
          quantity: take,
          originalPrice: item.originalPrice ?? line.price,
          returnReason: item.returnReason || 'changed_mind',
          condition: item.condition || 'good',
          action: item.action || 'refund',
          returnReasonDetail: item.returnReasonDetail || '',
          refundAmount: 0,
          restockingFee: 0
        });
      }
      if (remaining > 0) {
        showErrorToast(`Could not allocate full quantity for ${item.productName || 'item'}`);
        return;
      }
    }

    const itemsByOrder = {};
    expandedItems.forEach(item => {
      const orderId = (item.originalOrder?._id ?? item.originalOrder ?? item.originalOrderId)?.toString() ?? String(item.originalOrder);
      if (!itemsByOrder[orderId]) itemsByOrder[orderId] = [];
      itemsByOrder[orderId].push(item);
    });

    try {
      for (const [orderId, items] of Object.entries(itemsByOrder)) {
        const returnData = {
          originalOrder: orderId,
          returnType: 'return',
          priority: 'normal',
          refundMethod: 'deferred',
          items: items.map(({ productName, maxQuantity, orderLines, ...rest }) => rest),
          generalNotes: returnNotes,
          origin: 'sales',
          customerId: selectedCustomer?._id // For cache invalidation so remaining quantities refresh
        };
        await createSaleReturn(returnData).unwrap();
      }
      await refetchReturns();
      window.dispatchEvent(new CustomEvent('accountLedgerInvalidate'));
      showSuccessToast('Sale return(s) created successfully');
      setReturnCart([]);
      setReturnNotes('');
      // Refetch product list so remaining quantities update (e.g. 4 sold → return 3 → now shows 1)
      if (selectedCustomer?._id) {
        searchCustomerProducts({ customerId: selectedCustomer._id, search: productSearchTerm.trim() })
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
      handleApiError(error, 'Create Sale Return');
    }
  };

  // Handle return creation success (for old modal)
  const handleReturnCreated = async () => {
    await refetchReturns();
    window.dispatchEvent(new CustomEvent('accountLedgerInvalidate'));
    setShowCreateModal(false);
    setSelectedSale(null);
    setSelectedCustomer(null);
    setStep('customer');
    showSuccessToast('Sale return created successfully');
  };

  // Handle return detail view
  const handleReturnSelect = (returnItem) => {
    setSelectedReturn(returnItem);
    setShowDetailModal(true);
  };

  // Handle back to customer selection
  const handleBackToCustomer = () => {
    setSelectedCustomer(null);
    setProductSearchTerm('');
    setStep('customer');
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

  const handleNewReturn = () => {
    setSelectedCustomer(null);
    setProductSearchTerm('');
    setStep('customer');
  };

  return (
    <div className="space-y-4 lg:space-y-6 w-full max-w-full overflow-x-hidden px-2 sm:px-0">
      {/* Header - same layout as Sales page */}
      <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start justify-between'}`}>
        <div>
          <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>Sale Returns</h1>
          <p className="text-gray-600">Manage customer returns and refunds</p>
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
            onClick={() => {
              const componentInfo = getComponentInfo('/sale-returns');
              if (componentInfo) {
                const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                openTab({
                  title: 'Sale Returns',
                  path: '/sale-returns',
                  component: componentInfo.component,
                  icon: componentInfo.icon,
                  allowMultiple: true,
                  props: { tabId: newTabId }
                });
              } else {
                handleNewReturn();
              }
            }}
            variant="default"
            size="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Sale Return
          </Button>
        </div>
      </div>

      {/* Statistics Cards - Total Sale Return, Total Sale Return Refund, Total Average */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Sale Return</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalReturns || 0}</p>
            </div>
            <RotateCcw className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Sale Return Refund</p>
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

      {/* Customer Selection - same layout as Sales page */}
      <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start space-x-12'}`}>
        <div className={`${isMobile ? 'w-full' : 'w-[750px] flex-shrink-0'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Customer
              </label>
              {selectedCustomer && (
                <button
                  onClick={handleBackToCustomer}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                  title="Change customer"
                >
                  Change Customer
                </button>
              )}
            </div>
          </div>
          {customersLoading ? (
            <LoadingSpinner />
          ) : (
            <SearchableDropdown
              placeholder="Search customer by name, phone, or email..."
              items={customers}
              onSelect={handleCustomerSelect}
              displayKey={(customer) => {
                const name = customer.businessName || customer.business_name || customer.displayName || customer.name ||
                  `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown';
                return (
                  <div>
                    <div className="font-medium">{name}</div>
                    {customer.phone && (
                      <div className="text-xs text-gray-500">Phone: {customer.phone}</div>
                    )}
                  </div>
                );
              }}
              selectedItem={selectedCustomer}
              className="w-full"
            />
          )}
        </div>

        {/* Customer Information - Right Side (same as Sales) */}
        <div className={`${isMobile ? 'w-full' : 'flex-1'}`}>
          {selectedCustomer && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium">
                    {selectedCustomer.businessName || selectedCustomer.business_name || selectedCustomer.displayName || selectedCustomer.name ||
                      `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim() || 'Customer'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedCustomer.businessType ? `${selectedCustomer.businessType} • ` : ''}
                    {selectedCustomer.phone || 'No phone'}
                  </p>
                  <div className="mt-2">
                    {(() => {
                      const rawBalance = selectedCustomer.currentBalance !== undefined && selectedCustomer.currentBalance !== null
                        ? Number(selectedCustomer.currentBalance)
                        : (Number(selectedCustomer.pendingBalance ?? 0) - Number(selectedCustomer.advanceBalance ?? 0));
                      const currentBalance = isNaN(rawBalance) ? 0 : rawBalance;
                      const isPayable = currentBalance < 0;
                      const isReceivable = currentBalance > 0;
                      return (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">Balance:</span>
                          <span className={`text-sm font-medium ${isPayable ? 'text-red-600' : isReceivable ? 'text-green-600' : 'text-gray-600'}`}>
                            {isPayable ? '-' : ''}{Math.abs(currentBalance).toFixed(2)}
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

      {/* Product Selection & Return Items - same layout as Sales "Product Selection & Cart" */}
      {selectedCustomer && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Product Selection & Return Items</h3>
          </div>
          <div className="card-content">
            {/* Product Search */}
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">
                Search by Product Name, SKU, or Barcode (products previously sold to this customer)
              </p>
            <div className="flex gap-3 relative flex-col sm:flex-row">
              <div className="flex-1 relative">
                <Input
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
                  className="w-full"
                />
              </div>
            </div>
            {/* Suggestions Dropdown - Using Portal (renders to document.body) */}
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

            {/* Return Items - same table layout as Sales cart */}
            {returnCart.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border-t border-gray-200">
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2">No items in return cart</p>
              </div>
            ) : (
              <div className="space-y-4 border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-700">Return Items</h4>
                {/* Desktop Table */}
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
                          <tr key={`${item.product}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
                                <Input
                                  type="number"
                                  min={1}
                                  max={item.maxQuantity || 999}
                                  value={item.quantity || 1}
                                  onChange={(e) => handleUpdateReturnQuantity(index, e.target.value)}
                                  className="text-center h-8 w-20"
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
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {returnCart.map((item, index) => {
                    const total = (item.quantity || 1) * (item.originalPrice || 0);
                    return (
                      <div key={`${item.product}-${index}`} className="p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
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
                              <Input
                                type="number"
                                min={1}
                                max={item.maxQuantity || 999}
                                value={item.quantity || 1}
                                onChange={(e) => handleUpdateReturnQuantity(index, e.target.value)}
                                className="text-center h-8 w-16 flex-1"
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

      {/* Return Summary - same gradient layout as Sales Order Summary */}
      {returnCart.length > 0 && selectedCustomer && (() => {
        const subtotal = returnCart.reduce((sum, item) => sum + (item.quantity || 1) * (item.originalPrice || 0), 0);
        return (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg max-w-5xl ml-auto mt-4">
            {/* Return Details Section */}
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
            {/* Return Summary Section */}
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
              {/* Action Buttons - same style as Sales */}
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

      {/* Returns List - same card style as Sales */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Recent Sale Returns</h2>
        </div>
        <div className="card-content">
          {returnsLoading ? (
            <LoadingTable />
          ) : returns.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No sale returns found</p>
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
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Original Sale
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
                        {returnItem.customer?.businessName || returnItem.customer?.business_name ||
                          returnItem.customer?.displayName || returnItem.customer?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {returnItem.originalOrder?.orderNumber ||
                          returnItem.originalOrder?.soNumber ||
                          returnItem.originalOrder?.invoiceNumber ||
                          returnItem.originalOrder?.poNumber ||
                          (returnItem.originalOrder?._id ? `Order ${returnItem.originalOrder._id.toString().slice(-6)}` : 'N/A')}
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
      {showCreateModal && selectedSale && selectedCustomer && (
        <CreateSaleReturnModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedSale(null);
          }}
          onSuccess={handleReturnCreated}
          sale={selectedSale}
          customer={selectedCustomer}
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

export default SaleReturns;
