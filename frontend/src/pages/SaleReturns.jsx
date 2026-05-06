import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
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
import { useDebouncedCustomerSearch } from '../hooks/useDebouncedCustomerSearch';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingTable } from '../components/LoadingSpinner';
import { useResponsive } from '../components/ResponsiveContainer';
import { useTab } from '../contexts/TabContext';
import { SearchableDropdown } from '../components/SearchableDropdown';
import CreateSaleReturnModal from '../components/CreateSaleReturnModal';
import ReturnDetailModal from '../components/ReturnDetailModal';
import DateFilter from '../components/DateFilter';
import { ClearConfirmationDialog } from '../components/ConfirmationDialog';
import { useClearConfirmation } from '../hooks/useConfirmation';
import { getCurrentDatePakistan } from '../utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGetBanksQuery } from '../store/services/banksApi';
import { ProductSelectionCartSection } from '../components/order/ProductSelectionCartSection';
import { CartItemsTableSection } from '../components/order/CartItemsTableSection';
import { ProductSearch } from '../components/sales/ProductSearch';

const SaleReturns = () => {
  const today = getCurrentDatePakistan();
  const [step, setStep] = useState('customer'); // used for API skip optimization
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
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
  const [refundMethod, setRefundMethod] = useState('cash');
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [returnAmount, setReturnAmount] = useState(0);
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
  const { getActiveTab, updateTabTitle } = useTab();

  const {
    customers,
    isLoading: customersLoading,
    isFetching: customersFetching,
  } = useDebouncedCustomerSearch(customerSearchTerm, { selectedCustomer });

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
  const { data: banksData } = useGetBanksQuery(
    { isActive: true },
    { staleTime: 5 * 60_000 }
  );
  const activeBanks = useMemo(
    () => {
      const banks = banksData?.data?.banks || banksData?.banks || [];
      return banks.filter((bank) => bank?.isActive !== false);
    },
    [banksData]
  );

  // Create return mutation
  const [createSaleReturn, { isLoading: isCreatingReturn }] = useCreateSaleReturnMutation();

  // Handle customer selection
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearchTerm(
      customer?.businessName ||
      customer?.business_name ||
      customer?.displayName ||
      customer?.name ||
      ''
    );
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
      productName: product?.name || 'Unknown Product',
      productImage: product?.imageUrl || '',
      currentStock: Number(product?.inventory?.currentStock ?? totalRemaining ?? 0)
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

  // Use Sales ProductSearch component UI while preserving return-specific validation/allocation rules.
  const handleAddFromSalesProductSearch = async ({ product, quantity = 1 }) => {
    if (!selectedCustomer?._id || !product) {
      showErrorToast('Please select customer first');
      return;
    }

    try {
      // Prefer pre-attached return data when product comes from customer-limited dropdown.
      const attachedReturnData = product.__returnProductData;
      if (attachedReturnData) {
        const qty = Math.max(1, Number(quantity) || 1);
        for (let i = 0; i < qty; i += 1) {
          handleAddToReturnCart(attachedReturnData);
        }
        return;
      }

      const result = await searchCustomerProducts({
        customerId: selectedCustomer._id,
        search: (product.name || '').trim()
      });

      const raw = result?.data?.data ?? result?.data ?? (Array.isArray(result?.data) ? result.data : []);
      const list = Array.isArray(raw) ? raw : (raw?.products ? raw.products : []);
      const productId = String(product._id || product.id || '');

      const matched = list.find((row) => {
        const p = row?.product ?? row;
        const id = String(p?._id || p?.id || '');
        return id && id === productId;
      });

      if (!matched) {
        showErrorToast('This product is not returnable for selected customer');
        return;
      }

      const qty = Math.max(1, Number(quantity) || 1);
      for (let i = 0; i < qty; i += 1) {
        handleAddToReturnCart(matched);
      }
    } catch (error) {
      handleApiError(error, 'Load returnable product');
    }
  };

  const customerSoldProductsForSearch = useMemo(
    () =>
      (searchSuggestions || [])
        .map((suggestion) => {
          const pd = suggestion?.productData;
          const p = pd?.product ?? pd;
          const pid = p?._id || p?.id || suggestion?.id;
          if (!pid) return null;
          const remaining = Number(suggestion?.remainingQuantity ?? pd?.remainingReturnableQuantity ?? pd?.remainingQuantity ?? 0);
          return {
            ...p,
            _id: p?._id || p?.id || pid,
            id: p?.id || p?._id || pid,
            name: suggestion?.name || p?.name || 'Unknown Product',
            sku: suggestion?.sku || p?.sku || '',
            barcode: suggestion?.barcode || p?.barcode || '',
            pricing: {
              ...(p?.pricing || {}),
              retail: Number(pd?.previousPrice ?? p?.pricing?.retail ?? 0) || 0,
              wholesale: Number(pd?.previousPrice ?? p?.pricing?.wholesale ?? 0) || 0,
            },
            inventory: {
              ...(p?.inventory || {}),
              currentStock: remaining,
              reorderPoint: Number(p?.inventory?.reorderPoint ?? 0) || 0,
            },
            __returnProductData: pd,
          };
        })
        .filter(Boolean),
    [searchSuggestions]
  );

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
      setRefundMethod('cash');
      setSelectedBankAccount('');
      setReturnAmount(0);
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

    const grossRefundTotal = expandedItems.reduce(
      (sum, item) => sum + (Number(item.originalPrice) || 0) * (Number(item.quantity) || 0),
      0
    );
    if (grossRefundTotal <= 0) {
      showErrorToast('Unable to calculate refund amount');
      return;
    }

    const requestedRaw = Number(returnAmount);
    // Important: explicit 0 means "no refund paid now", not "full refund".
    const requestedRefundTotal = Number.isFinite(requestedRaw)
      ? Math.max(0, Math.min(requestedRaw, grossRefundTotal))
      : grossRefundTotal;

    const normalizeRefundMethod = (method, bankId) => {
      if (bankId) return 'bank_transfer';
      if (method === 'bank' || method === 'bank_transfer') return 'bank_transfer';
      if (method === 'credit_card' || method === 'debit_card') return 'bank_transfer';
      if (method === 'check') return 'check';
      if (method === 'store_credit') return 'store_credit';
      if (method === 'deferred') return 'deferred';
      return 'cash';
    };
    const effectiveRefundMethod = normalizeRefundMethod(refundMethod, selectedBankAccount);

    try {
      const orderEntries = Object.entries(itemsByOrder);
      let allocatedSoFar = 0;

      for (let i = 0; i < orderEntries.length; i += 1) {
        const [orderId, items] = orderEntries[i];
        const orderGross = items.reduce(
          (sum, item) => sum + (Number(item.originalPrice) || 0) * (Number(item.quantity) || 0),
          0
        );
        if (orderGross <= 0) continue;

        // Distribute requested refund across multiple source orders proportionally.
        const targetOrderRefund = i === orderEntries.length - 1
          ? Math.max(0, requestedRefundTotal - allocatedSoFar)
          : Math.max(0, Number(((requestedRefundTotal * orderGross) / grossRefundTotal).toFixed(2)));
        allocatedSoFar += targetOrderRefund;

        const restockingFeePercent = Math.max(
          0,
          Math.min(100, Number((((orderGross - targetOrderRefund) / orderGross) * 100).toFixed(4)))
        );

        const returnData = {
          originalOrder: orderId,
          returnType: 'return',
          priority: 'normal',
          refundMethod: effectiveRefundMethod,
          ...(effectiveRefundMethod === 'bank_transfer' && selectedBankAccount ? { bankAccount: selectedBankAccount } : {}),
          returnAmount: targetOrderRefund,
          policy: { restockingFeePercent },
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
      setRefundMethod('cash');
      setSelectedBankAccount('');
      setReturnAmount(0);
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
    setCustomerSearchTerm('');
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
    setCustomerSearchTerm('');
    setProductSearchTerm('');
    setStep('customer');
    setReturnAmount(0);
  };

  useEffect(() => {
    const subtotal = returnCart.reduce((sum, item) => sum + (item.quantity || 1) * (item.originalPrice || 0), 0);
    setReturnAmount(subtotal);
  }, [returnCart]);

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
      {/* Header - same layout as Sales page */}
      <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start justify-between'} gap-4`}>
        <div>
          <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>Sale Returns</h1>
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

      {/* Customer Selection - styled to match Sales page */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-2">
          <div className="flex-1 min-w-0 sm:min-w-[300px] lg:max-w-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Select Customer
                </label>
                {selectedCustomer && (
                  <button
                    onClick={handleBackToCustomer}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider underline"
                    title="Change customer"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>
            {customersLoading ? (
              <LoadingSpinner />
            ) : (
              <SearchableDropdown
                className="[&_input]:h-8"
                placeholder="Search customer by name, phone, or email..."
                items={customers}
                onSelect={handleCustomerSelect}
                onSearch={setCustomerSearchTerm}
                value={customerSearchTerm}
                loading={customersLoading || customersFetching}
                emptyMessage="No customers found"
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
              />
            )}
          </div>

          <div className="lg:w-auto w-full lg:max-w-md lg:self-end">
            {selectedCustomer ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl h-8 px-2 flex items-center">
                {(() => {
                  const rawBalance = selectedCustomer.currentBalance !== undefined && selectedCustomer.currentBalance !== null
                    ? Number(selectedCustomer.currentBalance)
                    : (Number(selectedCustomer.pendingBalance ?? 0) - Number(selectedCustomer.advanceBalance ?? 0));
                  const currentBalance = isNaN(rawBalance) ? 0 : rawBalance;
                  const isPayable = currentBalance < 0;
                  const isReceivable = currentBalance > 0;
                  return (
                    <div className="flex items-center gap-2 text-xs whitespace-nowrap overflow-hidden">
                      <span className="text-gray-500 uppercase font-semibold">Balance</span>
                      <span className={`font-bold ${isPayable ? 'text-red-600' : isReceivable ? 'text-green-600' : 'text-gray-600'}`}>
                        {isPayable ? '-' : ''}{Math.abs(currentBalance).toFixed(2)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="hidden lg:flex items-center justify-center h-8 px-8 border-2 border-dashed border-gray-100 rounded-xl">
                <span className="text-gray-400 text-sm font-medium italic">No customer selected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Selection & Return Items - same layout as Sales "Product Selection & Cart" */}
      {selectedCustomer && (
        <ProductSelectionCartSection
          title="Product Selection & Return Items"
          searchSectionClassName="mb-2"
          searchSection={
            <ProductSearch
              onAddProduct={handleAddFromSalesProductSearch}
              selectedCustomer={selectedCustomer}
              showCostPrice={false}
              hasCostPricePermission={false}
              priceType="retail"
              allowOutOfStock={true}
              allowSaleWithoutProduct={false}
              allowManualCostPrice={false}
              itemsOverride={customerSoldProductsForSearch}
              loadingOverride={isSearching}
              emptyMessageOverride="No sold products found for this customer"
            />
          }
          isEmpty={returnCart.length === 0}
          emptyIcon={ShoppingCart}
          emptyText="No items in return cart"
        >
          <CartItemsTableSection className="pt-2">
            <div className="space-y-4">
              {/* Desktop Rows - match Sales compact cart style */}
                <div className="hidden md:block overflow-x-auto">
                  <div className="min-w-[980px] space-y-1">
                    {returnCart.map((item, index) => {
                      const total = (item.quantity || 1) * (item.originalPrice || 0);
                      return (
                        <div
                          key={`${item.product}-${index}`}
                          className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem] gap-x-1 items-center py-1"
                        >
                          <div className="min-w-0 flex justify-start">
                            <span className="text-sm font-medium px-0.5 py-1 rounded border block w-8 text-center h-8 flex items-center justify-center text-green-800 bg-green-100 border-green-300">
                              {index + 1}
                            </span>
                          </div>

                          <div className="min-w-0 flex items-center h-8 gap-2">
                            {item.productImage ? (
                              <div className="h-8 w-8 flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200">
                                <img src={item.productImage} alt="" className="h-full w-full object-cover shadow-sm" />
                              </div>
                            ) : null}
                            <span className="font-medium text-sm text-gray-900 truncate">{item.productName || 'Unknown'}</span>
                          </div>

                          <div className="min-w-0">
                            <span className="text-sm font-semibold px-2 py-1 rounded border block text-center h-8 flex items-center justify-center text-gray-400 bg-gray-50 border-gray-200">
                              -
                            </span>
                          </div>

                          <div className="min-w-0">
                            <span className={`text-sm font-semibold px-2 py-1 rounded border block text-center h-8 flex items-center justify-center ${(item.currentStock || 0) === 0
                              ? 'text-red-700 bg-red-50 border-red-200'
                              : (item.currentStock || 0) <= 5
                                ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                                : 'text-gray-700 bg-gray-100 border-gray-200'
                              }`}>
                              {item.currentStock ?? item.maxQuantity ?? 0}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <Input
                              type="number"
                              min={1}
                              max={item.maxQuantity || 999}
                              value={item.quantity || 1}
                              onChange={(e) => handleUpdateReturnQuantity(index, e.target.value)}
                              className="w-full min-w-0 text-center h-8 border border-gray-300 rounded px-2"
                            />
                          </div>

                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block w-full text-center h-8 flex items-center justify-center">
                              {(item.originalPrice || 0).toFixed(2)}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block w-full text-center h-8 flex items-center justify-center">
                              {total.toFixed(2)}
                            </span>
                          </div>

                          <div className="min-w-0 flex justify-end">
                            <Button
                              onClick={() => handleRemoveFromReturnCart(index)}
                              variant="destructive"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                            <Input
                              type="number"
                              min={1}
                              max={item.maxQuantity || 999}
                              value={item.quantity || 1}
                              onChange={(e) => handleUpdateReturnQuantity(index, e.target.value)}
                              className="text-center h-8 w-full"
                            />
                          </div>
                          <div><span className="text-gray-500">Rate:</span> <span className="font-medium">{formatCurrency(item.originalPrice)}</span></div>
                          <div className="col-span-2"><span className="text-gray-500">Total:</span> <span className="font-semibold">{formatCurrency(total)}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            </div>
          </CartItemsTableSection>
        </ProductSelectionCartSection>
      )}

      {/* Return Summary - compact style aligned with Sales Order Summary */}
      {returnCart.length > 0 && selectedCustomer && (() => {
        const subtotal = returnCart.reduce((sum, item) => sum + (item.quantity || 1) * (item.originalPrice || 0), 0);
        return (
          <div className="border border-slate-200 rounded-xl bg-slate-50 shadow-sm mt-4">
            <div className="flex items-center justify-between bg-white border-b border-slate-200 px-5 py-3">
              <h3 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Order Summary</h3>
              <div className="flex items-center gap-2">
                <LoadingButton
                  onClick={handleCompleteReturn}
                  isLoading={isCreatingReturn}
                  variant="default"
                  size="sm"
                  className="bg-slate-900 hover:bg-slate-800 text-white border-none h-8 px-4 font-bold"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Complete Return
                </LoadingButton>
                <Button
                  onClick={handleClearReturnCart}
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  title="Clear Return Items"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="px-5 py-4 sm:px-7 bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Subtotal</span>
                  <div className="h-8 flex items-center px-2 bg-white border border-gray-200 rounded-md text-xl font-semibold tabular-nums text-foreground">
                    {subtotal.toFixed(2)}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Return Amount</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={subtotal}
                    autoComplete="off"
                    value={returnAmount}
                    onChange={(e) => {
                      const next = parseFloat(e.target.value);
                      if (!Number.isFinite(next)) {
                        setReturnAmount(0);
                        return;
                      }
                      setReturnAmount(Math.max(0, Math.min(next, subtotal)));
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-full h-8 px-2 border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-primary-400 text-sm font-medium shadow-none"
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Notes</span>
                  <Input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    className="w-full h-8 px-2 border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-primary-400 text-sm shadow-none"
                    placeholder="Additional notes..."
                  />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Payment</span>
                    <select
                      value={refundMethod === 'bank' && selectedBankAccount ? `bank:${selectedBankAccount}` : refundMethod}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v.startsWith('bank:')) {
                          setRefundMethod('bank');
                          setSelectedBankAccount(v.slice(5));
                        } else {
                          setRefundMethod(v);
                          setSelectedBankAccount('');
                        }
                      }}
                      className="border-none bg-transparent p-0 text-[10px] font-bold text-primary-600 focus:ring-0 cursor-pointer max-w-[70px] overflow-hidden text-ellipsis"
                    >
                      <option value="cash">Cash</option>
                      <optgroup label="Banks">
                        {activeBanks.map((bank) => {
                          const bid = bank._id || bank.id;
                          if (!bid) return null;
                          const label = [bank.bankName, bank.accountNumber].filter(Boolean).join(' - ');
                          return <option key={bid} value={`bank:${bid}`}>{label}</option>;
                        })}
                      </optgroup>
                      <option value="credit_card">Card</option>
                      <option value="debit_card">Debit</option>
                      <option value="check">Check</option>
                    </select>
                  </div>
                  <div className="h-8 flex items-center px-2 bg-slate-50 border border-gray-200 rounded-md text-sm font-semibold text-foreground">
                    {refundMethod === 'bank'
                      ? (activeBanks.find((b) => (b._id || b.id) === selectedBankAccount)?.bankName || 'Bank Transfer')
                      : refundMethod === 'credit_card'
                        ? 'Card Refund'
                        : refundMethod === 'debit_card'
                          ? 'Debit Refund'
                          : refundMethod === 'check'
                            ? 'Check Refund'
                            : 'Cash Refund'}
                  </div>
                </div>
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
