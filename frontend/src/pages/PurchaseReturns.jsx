import React, { useState, useEffect, useMemo } from 'react';
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
  Receipt,
  Printer
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
import { LoadingSpinner, LoadingCard, LoadingTable, LoadingButton, LoadingInline } from '../components/LoadingSpinner';
import { useResponsive } from '../components/ResponsiveContainer';
import { SupplierPartySelect } from '../components/order/SupplierPartySelect';
import CreatePurchaseReturnModal from '../components/CreatePurchaseReturnModal';
import ReturnDetailModal from '../components/ReturnDetailModal';
import DateFilter from '../components/DateFilter';
import { EntityStatusBadge } from '../components/order/EntityStatusBadge';
import {
  LineItemSerialStatic,
  LineItemThumbnail,
  LineItemStockCell,
  LineItemTotalCell,
  LineItemRemoveButton,
  LineItemPlaceholderCell,
} from '../components/order/CartLineItemAtoms';
import { ClearConfirmationDialog } from '../components/ConfirmationDialog';
import { useClearConfirmation } from '../hooks/useConfirmation';
import { PageLayout } from '../components/layout/PageLayout';
import { getCurrentDatePakistan } from '../utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGetBanksQuery } from '../store/services/banksApi';
import { ProductSearch } from '../components/sales/ProductSearch';
import { useSensitiveDataPermissions } from '../hooks/useSensitiveDataPermissions';

const PurchaseReturns = () => {
  const { canViewSupplierPhone } = useSensitiveDataPermissions();
  const today = getCurrentDatePakistan();
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [autoOpenPrint, setAutoOpenPrint] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Return cart - items selected for return (same as Sale Returns)
  const [returnCart, setReturnCart] = useState([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [returnAmount, setReturnAmount] = useState(0);
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
  const { data: banksData } = useGetBanksQuery(
    { isActive: true, all: 'true' },
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
      productName: product?.name || 'Unknown Product',
      productImage: product?.imageUrl || '',
      currentStock: Number(product?.inventory?.currentStock ?? remaining ?? 0)
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

    setProductSearchTerm('');
    showSuccessToast('Product added to return');
  };

  const handleAddFromPurchaseProductSearch = async ({ product, quantity = 1 }) => {
    if (!selectedSupplier?._id || !product) {
      showErrorToast('Please select supplier first');
      return;
    }

    const attachedReturnData = product.__returnProductData;
    if (attachedReturnData) {
      const qty = Math.max(1, Number(quantity) || 1);
      for (let i = 0; i < qty; i += 1) {
        handleAddToReturnCart(attachedReturnData);
      }
      return;
    }
  };

  const supplierPurchasedProductsForSearch = useMemo(
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
              cost: Number(pd?.previousPrice ?? p?.pricing?.cost ?? 0) || 0,
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
        const returnData = {
          originalOrder: orderId,
          returnType: 'return',
          priority: 'normal',
          refundMethod: effectiveRefundMethod,
          ...(effectiveRefundMethod === 'bank_transfer' && selectedBankAccount ? { bankAccount: selectedBankAccount } : {}),
          returnAmount: Math.max(0, Number(returnAmount) || 0),
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
      setRefundMethod('cash');
      setSelectedBankAccount('');
      setReturnAmount(0);
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
    setAutoOpenPrint(false);
    setSelectedReturn(returnItem);
    setShowDetailModal(true);
  };

  const handleReturnPrint = (returnItem) => {
    setAutoOpenPrint(true);
    setSelectedReturn(returnItem);
    setShowDetailModal(true);
  };

  // Handle back to supplier selection
  const handleBackToSupplier = () => {
    setSelectedSupplier(null);
    setSupplierSearchTerm('');
    setProductSearchTerm('');
    setReturnAmount(0);
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
  const getStatusBadge = (status) => (
    <EntityStatusBadge type="return" status={status} />
  );

  return (
    <PageLayout className="w-full max-w-full overflow-x-hidden">
      {/* Header - same layout as Sale Returns */}
      <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start justify-between'} gap-4`}>
        <div>
          <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>Purchase Returns</h1>
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

      {/* Supplier Selection - compact modern header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-2">
          <div className="flex-1 min-w-0 sm:min-w-[300px] lg:max-w-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Select Supplier
                </label>
                {selectedSupplier && (
                  <button
                    onClick={handleBackToSupplier}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider underline"
                    title="Change supplier"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>
            {suppliersLoading ? (
              <LoadingInline message="Loading suppliers..." />
            ) : (
              <SupplierPartySelect
                placeholder="Search supplier by name, phone, or email..."
                items={suppliers}
                selectedItem={selectedSupplier}
                onSelect={handleSupplierSelect}
                onSearch={setSupplierSearchTerm}
                searchValue={supplierSearchTerm}
                loading={suppliersLoading || suppliersFetching}
                canViewPhone={canViewSupplierPhone}
              />
            )}
          </div>
          <div className="lg:w-auto w-full lg:max-w-md lg:self-end">
            {selectedSupplier ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl h-8 px-2 flex items-center">
                {(() => {
                  const rawBalance = selectedSupplier.currentBalance !== undefined && selectedSupplier.currentBalance !== null
                    ? Number(selectedSupplier.currentBalance)
                    : (Number(selectedSupplier.pendingBalance ?? 0) - Number(selectedSupplier.advanceBalance ?? 0));
                  const currentBalance = isNaN(rawBalance) ? 0 : rawBalance;
                  const isPayable = currentBalance > 0;
                  const isReceivable = currentBalance < 0;
                  return (
                    <div className="flex items-center gap-2 text-xs whitespace-nowrap overflow-hidden">
                      <span className="font-bold text-gray-900 truncate">
                        {selectedSupplier.companyName || selectedSupplier.businessName || selectedSupplier.name || 'Supplier'}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-500 uppercase font-semibold">Balance</span>
                      <span className={`font-bold ${isPayable ? 'text-red-600' : isReceivable ? 'text-green-600' : 'text-gray-600'}`}>
                        {isPayable ? '' : '-'}{Math.abs(currentBalance).toFixed(2)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="hidden lg:flex items-center justify-center h-8 px-8 border-2 border-dashed border-gray-100 rounded-xl">
                <span className="text-gray-400 text-sm font-medium italic">No supplier selected</span>
              </div>
            )}
          </div>
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
              <ProductSearch
                onAddProduct={handleAddFromPurchaseProductSearch}
                selectedCustomer={selectedSupplier}
                showCostPrice={false}
                hasCostPricePermission={false}
                priceType="cost"
                allowOutOfStock={true}
                allowSaleWithoutProduct={false}
                allowManualCostPrice={false}
                itemsOverride={supplierPurchasedProductsForSearch}
                loadingOverride={isSearching}
                emptyMessageOverride="No purchased products found for this supplier"
              />
            </div>

            {returnCart.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border-t border-gray-200">
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2">No items in return cart</p>
              </div>
            ) : (
              <div className="space-y-4 border-t border-gray-200 pt-2">
                <div className="hidden md:block overflow-x-auto">
                  <div className="min-w-[980px] space-y-1">
                    {returnCart.map((item, index) => {
                      const total = (item.quantity || 1) * (item.originalPrice || 0);
                      return (
                        <div
                          key={`${item.product}-${item.originalOrder}-${index}`}
                          className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem] gap-x-1 items-center py-1"
                        >
                          <div className="min-w-0 flex justify-start">
                            <LineItemSerialStatic index={index} />
                          </div>

                          <div className="min-w-0 flex items-center h-8 gap-2">
                            <LineItemThumbnail src={item.productImage} variant="static" />
                            <span className="font-medium text-sm text-gray-900 truncate">{item.productName || 'Unknown'}</span>
                          </div>

                          <div className="min-w-0">
                            <LineItemPlaceholderCell symbol="-" />
                          </div>

                          <div className="min-w-0">
                            <LineItemStockCell
                              currentStock={item.currentStock ?? item.maxQuantity ?? 0}
                              reorderPoint={5}
                            />
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
                            <LineItemTotalCell value={(item.originalPrice || 0).toFixed(2)} />
                          </div>

                          <div className="min-w-0">
                            <LineItemTotalCell value={total.toFixed(2)} />
                          </div>

                          <div className="min-w-0 flex justify-end">
                            <LineItemRemoveButton
                              onClick={() => handleRemoveFromReturnCart(index)}
                              title="Remove"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                          <LineItemRemoveButton onClick={() => handleRemoveFromReturnCart(index)} />
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
            )}
          </div>
        </div>
      )}

      {/* Return Summary - compact style aligned with Sale Returns */}
      {returnCart.length > 0 && selectedSupplier && (() => {
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
            <div className="table-scroll">
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReturnSelect(returnItem)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </button>
                          <button
                            onClick={() => handleReturnPrint(returnItem)}
                            className="text-green-600 hover:text-green-800 flex items-center gap-1"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
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
            setAutoOpenPrint(false);
          }}
          returnData={selectedReturn}
          onUpdate={refetchReturns}
          autoOpenPrint={autoOpenPrint}
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
    </PageLayout>
  );
};

export default PurchaseReturns;
