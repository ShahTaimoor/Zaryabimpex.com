import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useQuery } from 'react-query';
import {
  Calendar,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,

  RefreshCw,
  ArrowUpDown,
  Printer,
  ShoppingCart,
  Package,
  User,
  TrendingUp,
  FileText,
  FileCheck,
  CheckCircle,
  Clock,
  XCircle,
  Receipt,
  Phone,
  X,
  Info,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  MoreHorizontal,
  FileSpreadsheet,
} from 'lucide-react';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { formatDate, formatCurrency } from '../utils/formatters';
import { LoadingButton, LoadingSpinner, LoadingInline } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  OrderCheckoutCard,
  OrderDetailsSection,
  OrderSummaryContent,
  OrderSummaryBar,
  OrderCheckoutActions,
} from '../components/order/OrderCheckoutLayout';
import { useGetCustomerQuery } from '../store/services/customersApi';
import { useDebouncedCustomerSearch } from '@/hooks/useDebouncedCustomerSearch';
import { productsApi, useLazyGetLastPurchasePriceQuery } from '../store/services/productsApi';
import { productVariantsApi } from '../store/services/productVariantsApi';
import { useGetSalesQuery, useLazyGetLastPricesQuery } from '../store/services/salesApi';
import {
  useGetSalesOrdersQuery,
  useLazyGetSalesOrdersQuery,
  useLazyGetStockStatusQuery,
  useCreateSalesOrderMutation,
  useUpdateSalesOrderMutation,
  useUpdateSalesOrderItemsConfirmationMutation,
  useDeleteSalesOrderMutation,
  useConfirmSalesOrderMutation,
  useCreateInvoiceFromSalesOrderMutation,
  useCancelSalesOrderMutation,
  useCloseSalesOrderMutation,
  useLazyGetSalesOrderQuery,
} from '../store/services/salesOrdersApi';
import {
  OrderConfirmationStatusBadge,
  OrderItemConfirmationCell,
  OrderConfirmSelectedActions,
  getItemConfirmationStatus,
} from '../components/OrderItemConfirmationCell';
import { DualUnitQuantityInput } from '../components/DualUnitQuantityInput';
import { ProductSearch } from '../components/sales/ProductSearch';
import { DuplicateLineItemMergeModal } from '../components/order/DuplicateLineItemMergeModal';
import { ProductImagePreviewModal } from '../components/order/ProductImagePreviewModal';
import { DocumentNumberField } from '../components/order/DocumentNumberField';
import { CustomerPartySelect, CustomerBalanceStrip } from '../components/order/CustomerPartySelect';
import { OrderNotesField } from '../components/order/OrderNotesField';
import { ApplyLastPricesButton } from '../components/order/ApplyLastPricesButton';
import { useApplyLastPrices } from '../hooks/useApplyLastPrices';
import { useListControls } from '../hooks/useListControls';
import {
  LineItemSerial,
  LineItemThumbnail,
  LineItemStockCell,
  LineItemTotalCell,
  LineItemRemoveButton,
  LineItemBoxInputCell,
  LineItemPriceStatusBadge,
} from '../components/order/CartLineItemAtoms';
import { CostPriceToggleButton, ProfitToggleButton } from '../components/order/CostPriceToggleButton';
import {
  formatPartyAddress as formatAddressForDisplay,
  getCustomerDisplayName,
  getProductDisplayName,
  getPartyDisplayName,
} from '../utils/partyDisplay';
import { computeSalesCheckoutPricing } from '../utils/orderPricing';
import { PriceTypeSelector } from '../components/order/PriceTypeSelector';
import {
  deriveInitialPriceType,
  mapPriceTypeToOrderType,
  normalizePriceType,
  priceTypeFromBusinessType,
  resolveOrderTypeForSave,
} from '../utils/priceTypeUtils';
import { CartTableHeader } from '../components/order/CartTableHeader';
import { hasDualUnit, piecesToBoxesAndPieces, getPiecesPerBox, formatStockDualLabel } from '../utils/dualUnitUtils';
import { useTab } from '../contexts/TabContext';
import { useSensitiveDataPermissions } from '../hooks/useSensitiveDataPermissions';
import PrintModal, { DirectPrintInvoice } from '../components/PrintModal';
import BaseModal from '../components/BaseModal';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import NotesPanel from '../components/NotesPanel';
import DateFilter from '../components/DateFilter';
import PaginationControls from '../components/PaginationControls';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';
import ExcelExportButton from '../components/ExcelExportButton';
import PdfExportButton from '../components/PdfExportButton';
import { useResponsive } from '../components/ResponsiveContainer';
import { getInvoicePdfPayload } from '../utils/invoicePdfUtils';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import { PageLayout } from '../components/layout/PageLayout';
import {
  getProductCostPrice,
  getProductDisplayCostPrice,
  getEffectiveCostForLossCheck,
} from '../utils/productCostUtils';


// Helper function to safely render values
const safeRender = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'object') {
    return getPartyDisplayName(value, JSON.stringify(value));
  }
  return String(value);
};

function getSoItemProductData(item) {
  if (item?.productData) return item.productData;
  if (item?.product && typeof item.product === 'object') return item.product;
  return null;
}

function getSoItemProductIdFromItem(item) {
  const raw = typeof item?.product === 'string'
    ? item.product
    : (item?.product?._id ?? item?.product?.id);
  return raw != null ? String(raw) : '';
}

function getSoLineLastPurchasePrice(item, lastPurchasePrices) {
  const lineId = getSoItemProductIdFromItem(item);
  if (lineId && lastPurchasePrices[lineId] !== undefined) {
    const value = Number(lastPurchasePrices[lineId]);
    if (Number.isFinite(value)) return value;
  }
  const productData = getSoItemProductData(item);
  if (productData?.isVariant) {
    const baseId = productData.baseProductId ?? productData.baseProduct?._id ?? productData.baseProduct?.id;
    const baseKey = baseId != null ? String(baseId) : '';
    if (baseKey && lastPurchasePrices[baseKey] !== undefined) {
      const value = Number(lastPurchasePrices[baseKey]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function getSoLineEffectiveCost(item, lastPurchasePrices) {
  return getEffectiveCostForLossCheck(
    getSoItemProductData(item),
    getSoLineLastPurchasePrice(item, lastPurchasePrices)
  );
}

// Address formatting moved to utils/partyDisplay.js (imported at top)

const SalesOrders = ({ tabId }) => {
  const { updateTabTitle, tabs, activeTabId } = useTab();
  const { isMobile } = useResponsive();
  const {
    confirmation: deleteConfirmation,
    confirmDelete,
    handleConfirm: handleDeleteConfirm,
    handleCancel: handleDeleteCancel,
  } = useDeleteConfirmation();
  const { companyInfo: companySettings } = useCompanyInfo();
  const resolvedCompanyName = companySettings.companyName || 'Company Name';
  const itemWiseConfirmationEnabled = companySettings.orderSettings?.salesOrderItemWiseConfirmation !== false;
  const showRemainingStockAfterSaleEnabled = companySettings.orderSettings?.showRemainingStockAfterSale !== false;
  const dualUnitShowBoxInputEnabled = companySettings.orderSettings?.dualUnitShowBoxInput === true;
  const dualUnitShowPiecesInputEnabled = companySettings.orderSettings?.dualUnitShowPiecesInput !== false;
  const allowSaleWithoutProductEnabled = companySettings.orderSettings?.allowSaleWithoutProduct === true;
  const allowManualCostPriceEnabled = companySettings.orderSettings?.allowManualCostPrice === true;
  const resolvedCompanyAddress = companySettings.address || companySettings.billingAddress || '';
  const resolvedCompanyPhone = companySettings.contactNumber || '';
  const taxSystemEnabled = companySettings.taxEnabled === true;
  const globalTaxPct = Math.min(100, Math.max(0, Number(companySettings.defaultTaxRate ?? 0)));
  const effectiveGlobalTaxPct = taxSystemEnabled ? globalTaxPct : 0;
  const [fetchSalesOrderById] = useLazyGetSalesOrderQuery();

  // Calculate default date range (14 days ago to today) using Pakistan timezone
  const today = getCurrentDatePakistan();
  const fromDateDefault = getDateDaysAgo(14);

  // State for filters and pagination
  // State for filters / pagination / sort lives in `useListControls`.
  const {
    filters,
    setFilters,
    pagination,
    setPagination,
    sortConfig,
    setFilter: handleFilterChange,
    toggleSort: handleSort,
  } = useListControls({
    initialFilters: {
      fromDate: fromDateDefault, // 14 days ago
      toDate: today, // Today
      orderNumber: '',
      customer: '',
      status: '',
      orderType: '',
    },
    initialSort: { key: 'createdAt', direction: 'desc' },
  });

  const [showNotes, setShowNotes] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [notesEntity, setNotesEntity] = useState(null);

  // Out-of-stock warning modal (shown before confirm when items lack stock)
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);
  const [outOfStockItems, setOutOfStockItems] = useState([]);
  const [pendingConfirmId, setPendingConfirmId] = useState(null);

  // State for modals (edit uses inline form, not a modal)
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrderData, setPrintOrderData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItemIndices, setSelectedItemIndices] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const excelExportRef = useRef(null);
  const pdfExportRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    orderType: 'wholesale',
    customer: '',
    items: [],
    notes: '',
    orderNumber: ''
  });
  const [autoGenerateOrderNumber, setAutoGenerateOrderNumber] = useState(true);
  const [showSalesOrderDetailsFields, setShowSalesOrderDetailsFields] = useState(false);

  const generateOrderNumber = useCallback(
    (customer) => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const time = String(now.getTime()).slice(-4); // Last 4 digits of timestamp

      const customerInitials = customer
        ? getCustomerDisplayName(customer, '')
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase())
          .join('')
          .substring(0, 3)
        : '';

      const prefix = 'SO';
      const initials = customerInitials || 'GEN';

      return `${prefix}-${initials}-${year}${month}${day}-${time}`;
    },
    []
  );

  // Price type selection
  const [priceType, setPriceTypeState] = useState('wholesale');
  // Wrap setPriceType so it also keeps formData.orderType in sync (unless
  // the order has been explicitly marked as 'return' or 'exchange', which
  // are workflow overrides that aren't pricing tiers).
  const setPriceType = useCallback((next) => {
    const value = normalizePriceType(next);
    setPriceTypeState(value);
    setFormData((prev) => {
      const cur = String(prev?.orderType || '').toLowerCase();
      if (cur === 'return' || cur === 'exchange') return prev;
      const mapped = mapPriceTypeToOrderType(value);
      if (cur === mapped) return prev;
      return { ...prev, orderType: mapped };
    });
  }, []);

  // Product selection state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customRate, setCustomRate] = useState('');
  const [calculatedRate, setCalculatedRate] = useState(0);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const [searchKey, setSearchKey] = useState(0); // Key to force re-render

  // Last prices state
  // Apply / Restore "last prices" state lives in the shared hook below.

  // Loading states for buttons
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isRemovingFromCart, setIsRemovingFromCart] = useState({});
  const [isSortingItems, setIsSortingItems] = useState(false);

  // Cost price state
  const [showCostPrice, setShowCostPrice] = useState(false); // Toggle to show/hide cost prices
  const [showProductImages, setShowProductImages] = useState(localStorage.getItem('showProductImagesUI') !== 'false');

  useEffect(() => {
    const handleConfigChange = () => {
      setShowProductImages(localStorage.getItem('showProductImagesUI') !== 'false');
    };
    window.addEventListener('productImagesConfigChanged', handleConfigChange);
    return () => window.removeEventListener('productImagesConfigChanged', handleConfigChange);
  }, []);

  const [lastPurchasePrice, setLastPurchasePrice] = useState(null); // Last purchase price for selected product
  const [lastPurchasePrices, setLastPurchasePrices] = useState({}); // Store last purchase prices for products in cart
  const [previewImageProduct, setPreviewImageProduct] = useState(null);

  const soCartScrollRef = useRef(null);
  const soCartLineElRefs = useRef(new Map());
  const [highlightedSoLineIndex, setHighlightedSoLineIndex] = useState(null);
  const soCartNeedsInnerScroll = formData.items.length > 10;

  const [soDuplicateMerge, setSoDuplicateMerge] = useState(null);
  const [soSearchResetKey, setSoSearchResetKey] = useState(0);
  const soProductSearchFocusFnRef = useRef(null);
  const handleSoProductSearchFocusReady = useCallback((fn) => {
    soProductSearchFocusFnRef.current = fn;
  }, []);
  const refocusSoProductSearch = useCallback((source) => {
    setTimeout(() => {
      if (source === 'inline') {
        productSearchRef.current?.focus({ preventScroll: true });
      } else {
        soProductSearchFocusFnRef.current?.();
      }
    }, 60);
  }, []);
  const soItemsRef = useRef(formData.items);
  useEffect(() => {
    soItemsRef.current = formData.items;
  }, [formData.items]);

  const getSoItemProductId = (item) => {
    const raw = typeof item?.product === 'string'
      ? item.product
      : (item?.product?._id ?? item?.product?.id);
    return raw != null ? String(raw) : '';
  };

  useLayoutEffect(() => {
    if (highlightedSoLineIndex === null) return;
    const idx = highlightedSoLineIndex;
    soCartScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (soCartNeedsInnerScroll) {
      soCartLineElRefs.current.get(idx)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      requestAnimationFrame(() => {
        soCartLineElRefs.current.get(idx)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      });
    }
  }, [highlightedSoLineIndex, soCartNeedsInnerScroll, formData.items.length]);

  useEffect(() => {
    if (formData.items.length === 0) setHighlightedSoLineIndex(null);
  }, [formData.items.length]);



  // Sensitive permission flags (Advanced tab) - centralized hook
  const {
    canViewProductCosts: canViewCostPrice,
    canViewBP,
    canApplyLastPrices,
    canViewCustomerBalance,
    canViewCustomerPhone,
    canViewStock,
    getPartyPermissions
  } = useSensitiveDataPermissions();
  const [showProfit, setShowProfit] = useState(false);

  const [autoPrint, setAutoPrint] = useState(false);
  const [directPrintOrder, setDirectPrintOrder] = useState(null);

  const totalProfit = useMemo(() => {
    if (!Array.isArray(formData.items) || formData.items.length === 0) return 0;

    return formData.items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const salePrice = Number(item.unitPrice) || 0;
      const productData = getSoItemProductData(item);

      const catalogCost = getProductCostPrice(productData);
      const profitPerUnit = salePrice - (Number.isFinite(catalogCost) ? catalogCost : 0);
      const lineProfit = profitPerUnit * quantity;

      return sum + (Number.isFinite(lineProfit) ? lineProfit : 0);
    }, 0);
  }, [formData.items]);

  // Modal-specific product selection state
  const [modalProductSearchTerm, setModalProductSearchTerm] = useState('');
  const [modalSelectedProduct, setModalSelectedProduct] = useState(null);
  const [modalSelectedSuggestionIndex, setModalSelectedSuggestionIndex] = useState(-1);

  // Refs
  const productSearchRef = useRef(null);
  const customerSearchRef = useRef(null);
  const modalCustomerSearchRef = useRef(null);
  const modalProductSearchRef = useRef(null);

  useEffect(() => {
    if (autoGenerateOrderNumber) {
      const newNumber = generateOrderNumber(selectedCustomer);
      setFormData((prev) =>
        prev.orderNumber === newNumber ? prev : { ...prev, orderNumber: newNumber }
      );
    }
  }, [autoGenerateOrderNumber, selectedCustomer, generateOrderNumber]);

  // Clear modal product state when cancelling edit
  useEffect(() => {
    if (!selectedOrder) {
      setModalProductSearchTerm('');
      setModalSelectedProduct(null);
      setModalSelectedSuggestionIndex(-1);
    }
  }, [selectedOrder]);

  // Safety mechanism: Always restore scroll on component unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Update tab title when selectedCustomer changes (same pattern as Sales page)
  useEffect(() => {
    const tabIdToUpdate = tabId || activeTabId;
    if (!updateTabTitle || !tabIdToUpdate) return;

    const newTitle = selectedCustomer
      ? `SO - ${getCustomerDisplayName(selectedCustomer, 'Unknown')}`
      : 'SO';

    updateTabTitle(tabIdToUpdate, newTitle);
  }, [selectedCustomer, updateTabTitle, tabId, activeTabId]);

  // Fetch sales orders
  const {
    data: salesOrdersData,
    isLoading,
    error,
    refetch,
  } = useGetSalesOrdersQuery({ ...filters, ...pagination, sortConfig }, { refetchOnMountOrArgChange: true });

  const [fetchSalesOrdersForExport] = useLazyGetSalesOrdersQuery();

  const [getLastPurchasePrice] = useLazyGetLastPurchasePriceQuery();
  const [getLastPrices] = useLazyGetLastPricesQuery();

  // ----- Apply / Restore "last prices" --------------------------------
  // Centralized in `useApplyLastPrices`; SalesOrders recomputes per-line
  // subtotal / tax / total inside `applyPriceToItem` so order rows stay
  // in sync.
  const fetchLastPricesForCustomer = useCallback(
    async (customerId) => {
      const { data: response } = await getLastPrices(customerId);
      const prices = response?.data?.prices ?? response?.prices ?? null;
      const orderNumber =
        response?.data?.orderNumber ?? response?.orderNumber ?? null;
      const orderDate =
        response?.data?.orderDate ?? response?.orderDate ?? null;
      if (!prices) return null;
      return { prices, orderNumber, orderDate };
    },
    [getLastPrices]
  );

  const recalcSalesOrderItem = useCallback(
    (item, lastPrice) => {
      const newSubtotal = lastPrice * item.quantity;
      const newTaxAmount = !taxSystemEnabled
        ? 0
        : (newSubtotal * effectiveGlobalTaxPct) / 100;
      const newTotal = newSubtotal - (item.discountAmount || 0) + newTaxAmount;
      return {
        ...item,
        unitPrice: lastPrice,
        subtotal: newSubtotal,
        taxAmount: newTaxAmount,
        total: newTotal,
      };
    },
    [taxSystemEnabled, effectiveGlobalTaxPct]
  );

  const setSalesOrderItems = useCallback(
    (next) =>
      setFormData((prev) => ({
        ...prev,
        items: typeof next === 'function' ? next(prev.items) : next,
      })),
    []
  );

  const {
    apply: handleApplyLastPrices,
    restore: handleRestoreCurrentPrices,
    isApplying: isLoadingLastPrices,
    setIsApplying: setIsLoadingLastPricesBusy,
    isRestoring: isRestoringPrices,
    setIsRestoring: setIsRestoringPrices,
    isApplied: isLastPricesApplied,
    setIsApplied: setIsLastPricesApplied,
    originalPrices,
    setOriginalPrices,
    priceStatus,
    setPriceStatus,
  } = useApplyLastPrices({
    items: formData.items,
    setItems: setSalesOrderItems,
    selectedCustomer,
    fetchLastPrices: fetchLastPricesForCustomer,
    getProductId: (item) => item.product?.toString(),
    applyPriceToItem: recalcSalesOrderItem,
  });

  const {
    customers,
    isLoading: customersLoading,
    isFetching: customersFetching,
  } = useDebouncedCustomerSearch(customerSearchTerm, { selectedCustomer });

  const selectedCustomerId = selectedCustomer?.id ?? selectedCustomer?._id ?? null;
  const { data: selectedCustomerDetail } = useGetCustomerQuery(selectedCustomerId, {
    skip: !selectedCustomerId,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true // Refetch when window regains focus
  });
  const customerWithBalance = selectedCustomerDetail?.data?.customer ?? selectedCustomerDetail?.customer ?? selectedCustomerDetail ?? selectedCustomer;
  // Prioritize balance from selectedCustomer (from list with bulk balances - already correct)
  // Then fallback to detail query if available
  // This ensures we use the balance that's already calculated correctly from the list
  const displayBalance = selectedCustomer?.currentBalance ?? customerWithBalance?.currentBalance ?? 0;
  const displayCreditLimit = selectedCustomer?.creditLimit ?? selectedCustomer?.credit_limit ?? customerWithBalance?.creditLimit ?? customerWithBalance?.credit_limit;

  const dispatch = useDispatch();
  const refreshProductCatalogCache = useCallback(() => {
    dispatch(
      productsApi.util.invalidateTags([
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
      ])
    );
    dispatch(productVariantsApi.util.invalidateTags([{ type: 'Products', id: 'VARIANTS_LIST' }]));
  }, [dispatch]);

  const [getStockStatus] = useLazyGetStockStatusQuery();

  // Mutations (RTK Query)
  const [createSalesOrderMutation, { isLoading: creating }] = useCreateSalesOrderMutation();
  const [updateSalesOrderMutation, { isLoading: updating }] = useUpdateSalesOrderMutation();
  const [deleteSalesOrderMutation, { isLoading: deleting }] = useDeleteSalesOrderMutation();
  const [confirmSalesOrderMutation, { isLoading: confirming }] = useConfirmSalesOrderMutation();
  const [updateItemsConfirmationMutation, { isLoading: updatingItemsConfirmation }] = useUpdateSalesOrderItemsConfirmationMutation();
  const [createInvoiceFromSOMutation, { isLoading: creatingInvoiceFromSO }] = useCreateInvoiceFromSalesOrderMutation();
  const [cancelSalesOrderMutation, { isLoading: cancelling }] = useCancelSalesOrderMutation();
  const [closeSalesOrderMutation, { isLoading: closing }] = useCloseSalesOrderMutation();

  const hasPendingSalesOrderLines = (order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items.some((i) => {
      const c = (i.confirmationStatus ?? i.confirmation_status ?? 'pending').toLowerCase();
      return c === 'pending';
    });
  };

  /** How to finish invoicing: confirm remaining SO lines, or post invoice when order is already fully confirmed at line level. */
  const getSalesOrderInvoiceCompleteAction = (order) => {
    if (!order) return null;
    const st = order.status;
    if (['fully_invoiced', 'cancelled', 'closed', 'draft'].includes(st)) return null;
    if (st === 'partially_invoiced') return 'confirmAll';
    if (st === 'confirmed') {
      if (hasPendingSalesOrderLines(order)) return 'confirmAll';
      return 'createInvoice';
    }
    return null;
  };

  // Helper functions
  const resetForm = () => {
    // Reset customer first to avoid using stale customer in orderNumber generation
    setSelectedCustomer(null);
    setCustomerSearchTerm('');

    // Reset product selection
    setSelectedProduct(null);
    setProductSearchTerm('');
    setSelectedProductIndex(-1);
    setQuantity(1);
    setCustomRate('');
    setCalculatedRate(0);
    setIsAddingProduct(false);
    setSearchKey(prev => prev + 1); // Force re-render of search components

    // Reset form data with empty order number (will be generated by useEffect)
    setFormData({
      orderType: 'wholesale',
      customer: '',
      items: [],
      notes: '',
      orderNumber: '' // Will be auto-generated by useEffect after customer is reset
    });
    setPriceTypeState('wholesale');
    setAutoGenerateOrderNumber(true);

    // Reset last prices state
    setOriginalPrices({});
    setIsLastPricesApplied(false);
    setPriceStatus({});

    // Reset cost price state
    setLastPurchasePrice(null);
    setLastPurchasePrices({});
    setHighlightedSoLineIndex(null);

    // Reset loading states
    setIsAddingToCart(false);
    setIsLoadingLastPricesBusy(false);
    setIsRestoringPrices(false);
    setIsRemovingFromCart({});
    setIsSortingItems(false);

    setAutoPrint(false);
    setDirectPrintOrder(null);

    // Tab title will be updated by useEffect when selectedCustomer changes
  };

  const handleCustomerSelect = (customer) => {
    // SearchableDropdown passes the full customer object, not just the ID
    const customerId = typeof customer === 'string' ? customer : customer._id;
    const customerObj = typeof customer === 'object' ? customer : customers?.find(c => c._id === customerId);

    setSelectedCustomer(customerObj);
    setFormData(prev => ({
      ...prev,
      customer: customerId,
      orderNumber: autoGenerateOrderNumber ? generateOrderNumber(customerObj) : prev.orderNumber
    }));
    setCustomerSearchTerm(getCustomerDisplayName(customerObj, ''));

    // Auto-set price type based on customer business type. Skip when
    // editing an existing order so we don't overwrite the price type
    // restored from the saved record.
    if (!selectedOrder) {
      const suggested = priceTypeFromBusinessType(customerObj?.businessType);
      if (suggested) setPriceType(suggested);
    }

    // Tab title will be updated by useEffect when selectedCustomer changes
  };

  const handleCustomerSearch = (searchTerm) => {
    setCustomerSearchTerm(searchTerm);

    if (searchTerm === '') {
      setSelectedCustomer(null);
      setFormData(prev => ({
        ...prev,
        customer: '',
        orderNumber: autoGenerateOrderNumber ? generateOrderNumber(null) : prev.orderNumber
      }));

      // Tab title will be updated by useEffect when selectedCustomer changes
    }
  };

  const calculatePrice = (product, priceType) => {
    if (!product) return 0;

    // Handle both regular products and variants
    const pricing = product.pricing || {};

    if (priceType === 'distributor') {
      return pricing.distributor || pricing.wholesale || pricing.retail || 0;
    } else if (priceType === 'wholesale') {
      return pricing.wholesale || pricing.retail || 0;
    } else if (priceType === 'retail') {
      return pricing.retail || 0;
    } else {
      // Custom - keep current rate or default to wholesale
      return pricing.wholesale || pricing.retail || 0;
    }
  };

  const handleProductSelect = async (product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setIsAddingProduct(true);

    // Show selected product/variant name in search field
    setProductSearchTerm(getProductDisplayName(product, ''));

    // Fetch last purchase price (always, for loss alerts)
    // For variants, use the base product ID to get purchase price
    const productIdForPrice = product.isVariant ? product.baseProductId : product._id;

    if (productIdForPrice) {
      try {
        const response = await getLastPurchasePrice(productIdForPrice).unwrap();
        if (response && response.lastPurchasePrice !== null) {
          setLastPurchasePrice(response.lastPurchasePrice);
        } else {
          setLastPurchasePrice(null);
        }
      } catch (error) {
        // Silently fail - last purchase price is optional
        setLastPurchasePrice(null);
      }
    } else {
      setLastPurchasePrice(null);
    }

    // Calculate the rate based on selected price type
    const calculatedPrice = calculatePrice(product, priceType);
    setCalculatedRate(calculatedPrice);
    setCustomRate(calculatedPrice.toString());
  };

  // Update rate when price type changes
  useEffect(() => {
    if (selectedProduct) {
      const calculatedPrice = calculatePrice(selectedProduct, priceType);
      setCalculatedRate(calculatedPrice);
      // Only update customRate if it matches the previous calculated rate (user hasn't manually changed it)
      const previousCalculated = calculatePrice(selectedProduct, priceType === 'wholesale' ? 'retail' : 'wholesale');
      if (!customRate || customRate === previousCalculated.toString() || customRate === calculatedRate.toString()) {
        setCustomRate(calculatedPrice.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: customRate and calculatedRate are intentionally excluded from deps to prevent infinite loops.
    // We only want to recalculate when priceType or selectedProduct changes.
  }, [priceType, selectedProduct]);

  const handleProductSearch = (searchTerm) => {
    setProductSearchTerm(searchTerm);
    setSelectedProductIndex(-1); // Reset selection when searching

    // Clear selected product if search term doesn't match the selected product name
    if (selectedProduct && searchTerm !== selectedProduct.name) {
      setSelectedProduct(null);
      setCustomRate('');
      setIsAddingProduct(false);
    }

    if (searchTerm === '') {
      setSelectedProduct(null);
      setCustomRate('');
      setIsAddingProduct(false);
    }
  };

  const handleModalProductSearch = (searchTerm) => {
    setModalProductSearchTerm(searchTerm);
    setModalSelectedSuggestionIndex(-1);
    if (searchTerm === '') {
      setModalSelectedProduct(null);
      setCustomRate('');
    }
  };

  const handleModalProductSelect = (product) => {
    if (!product) return;
    setModalSelectedProduct(product);
    setCustomRate(calculatePrice(product, priceType));
    setQuantity(1);
    setModalProductSearchTerm(getProductDisplayName(product, ''));
  };

  const handleProductKeyDown = (e) => {
    if (e.key === 'Enter' && isAddingProduct) {
      e.preventDefault();
      handleAddItem();
    } else if (e.key === 'Escape' && isAddingProduct) {
      e.preventDefault();
      setSelectedProduct(null);
      setQuantity(1);
      setCustomRate('');
      setCalculatedRate(0);
      setIsAddingProduct(false);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && selectedProduct) {
      e.preventDefault();
      handleAddItem();
    }
  };

  const productDisplayKey = useCallback((product) => {
    const inventory = product.inventory || {};
    const isLowStock = inventory.currentStock <= (inventory.reorderPoint || inventory.minStock || 0);
    const isOutOfStock = inventory.currentStock === 0;

    const displayName = getProductDisplayName(product, 'Product');

    // Get pricing based on selected price type
    const pricing = product.pricing || {};
    let unitPrice = pricing.wholesale || pricing.retail || 0;
    let priceLabel = 'Wholesale';

    if (priceType === 'wholesale') {
      unitPrice = pricing.wholesale || pricing.retail || 0;
      priceLabel = 'Wholesale';
    } else if (priceType === 'retail') {
      unitPrice = pricing.retail || 0;
      priceLabel = 'Retail';
    }

    // Show variant indicator
    const variantInfo = product.isVariant
      ? <span className="text-xs text-blue-600 font-semibold">({product.variantType}: {product.variantValue})</span>
      : null;

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <div className="font-medium">{displayName}</div>
          {variantInfo && <div className="text-xs text-gray-500">{variantInfo}</div>}
        </div>
        <div className="flex items-center space-x-4">
          {canViewStock && (
            <div className={`text-sm ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-orange-600' : 'text-gray-600'}`}>
              Stock: {inventory.currentStock || 0}
            </div>
          )}
          <div className="text-sm text-gray-600">Price: {Math.round(unitPrice)}</div>
        </div>
      </div>
    );
  }, [priceType, canViewStock]);

  const handleAddItem = async () => {
    if (!selectedProduct) return;

    // Validate that rate is filled
    if (!customRate || parseFloat(customRate) <= 0) {
      showErrorToast('Please enter a valid rate');
      return;
    }

    // Get display name for error messages
    const displayName = selectedProduct.isVariant
      ? (selectedProduct.displayName || selectedProduct.variantName || selectedProduct.name)
      : selectedProduct.name;

    // Allow adding products even when out of stock (user will be warned on confirm)
    setIsAddingToCart(true);
    try {
      // Use the rate from the input field
      const unitPrice = parseFloat(customRate) || calculatedRate;

      // Check if sale price is less than cost price (always check, regardless of showCostPrice)
      const costPrice = getEffectiveCostForLossCheck(selectedProduct, lastPurchasePrice);
      if (costPrice != null && unitPrice < costPrice) {
        const loss = costPrice - unitPrice;
        const lossPercent = ((loss / costPrice) * 100).toFixed(1);
        const shouldProceed = window.confirm(
          `⚠️ WARNING: Sale price (${unitPrice}) is below cost price (${Math.round(costPrice)}).\n\n` +
          `Loss per unit: ${Math.round(loss)} (${lossPercent}%)\n` +
          `Total loss: ${Math.round(loss * quantity)}\n\n` +
          `Do you want to proceed?`
        );
        if (!shouldProceed) {
          return;
        }
      }

      const subtotal = unitPrice * quantity;
      const discountAmount = 0; // Can be enhanced later
      const taxRate = effectiveGlobalTaxPct;
      const taxAmount = !taxSystemEnabled ? 0 : (subtotal * taxRate / 100);
      const total = subtotal - discountAmount + taxAmount;

      // Store last purchase price for this product/variant
      if (lastPurchasePrice !== null) {
        setLastPurchasePrices(prev => ({
          ...prev,
          [selectedProduct._id]: lastPurchasePrice
        }));
      }

      const productId = String(selectedProduct._id);
      const existingIndex = soItemsRef.current.findIndex(item => getSoItemProductId(item) === productId);

      if (existingIndex >= 0) {
        const existingItem = soItemsRef.current[existingIndex];
        setSoDuplicateMerge({
          productId,
          displayName: displayName || 'Product',
          currentQuantity: Number(existingItem.quantity) || 0,
          addQuantity: quantity,
          source: 'inline',
          incomingSnapshot: {
            quantity,
            unitPrice,
            taxRate,
            productData: selectedProduct,
          },
        });
        return;
      }

      const ppb = getPiecesPerBox(selectedProduct);
      const { boxes, pieces } = ppb ? piecesToBoxesAndPieces(quantity, ppb) : {};
      const newItem = {
        product: selectedProduct._id,
        productData: selectedProduct,
        quantity,
        ...(ppb && { boxes, pieces }),
        unitPrice: unitPrice,
        discountPercent: 0,
        taxRate: taxRate,
        subtotal,
        discountAmount,
        taxAmount,
        total
      };

      setFormData(prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }));

      // Reset form
      setSelectedProduct(null);
      setQuantity(1);
      setCustomRate('');
      setCalculatedRate(0);
      setIsAddingProduct(false);

      // Clear search term and force re-render
      setProductSearchTerm('');
      setSelectedProductIndex(-1);
      setSearchKey(prev => prev + 1);

      // Focus back to product search input
      setTimeout(() => {
        if (productSearchRef.current) {
          productSearchRef.current.focus({ preventScroll: true });
        }
      }, 100);

      // Show success message
      const priceLabel = selectedCustomer?.businessType === 'wholesale' ? 'wholesale' :
        selectedCustomer?.businessType === 'distributor' ? 'distributor' : 'wholesale';
      showSuccessToast(`${displayName} added to order at ${priceLabel} price: ${Math.round(unitPrice)}`);
    } catch (error) {
      handleApiError(error, 'Product Price Check');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const addToCartFromProductSearch = useCallback((payload) => {
    const product = payload?.product;
    if (!product?._id) return;

    const qty = Math.max(1, Number(payload.quantity) || 1);
    const unitPrice = Number(payload.unitPrice) || 0;
    const taxRate = effectiveGlobalTaxPct;
    const subtotal = unitPrice * qty;
    const discountAmount = 0;
    const taxAmount = !taxSystemEnabled ? 0 : (subtotal * taxRate / 100);
    const total = subtotal - discountAmount + taxAmount;
    const ppb = getPiecesPerBox(product);
    const derivedDual = ppb ? piecesToBoxesAndPieces(qty, ppb) : {};

    const productId = product._id.toString();
    const existingIndex = soItemsRef.current.findIndex((item) => getSoItemProductId(item) === productId);

    if (existingIndex >= 0) {
      const existingItem = soItemsRef.current[existingIndex];
      setSoDuplicateMerge({
        productId,
        displayName: getProductDisplayName(product, 'Product'),
        currentQuantity: Number(existingItem.quantity) || 0,
        addQuantity: qty,
        source: 'sharedSearch',
        incomingSnapshot: {
          quantity: qty,
          unitPrice,
          taxRate,
          productData: product,
          ...(payload.boxes !== undefined ? { boxes: payload.boxes } : {}),
          ...(payload.pieces !== undefined ? { pieces: payload.pieces } : {}),
        },
      });
      return 'duplicate';
    }

    let highlightLineIndex = null;

    setFormData((prev) => {
      highlightLineIndex = prev.items.length;

      const newItem = {
        product: product._id,
        productData: product,
        quantity: qty,
        ...(ppb && {
          boxes: payload.boxes ?? derivedDual.boxes,
          pieces: payload.pieces ?? derivedDual.pieces
        }),
        unitPrice,
        discountPercent: 0,
        taxRate,
        subtotal,
        discountAmount,
        taxAmount,
        total
      };

      return {
        ...prev,
        items: [...prev.items, newItem]
      };
    });

    if (highlightLineIndex !== null && highlightLineIndex >= 0) {
      setHighlightedSoLineIndex(highlightLineIndex);
    }
  }, [taxSystemEnabled, effectiveGlobalTaxPct]);

  const handleSoDuplicateMergeConfirm = () => {
    if (!soDuplicateMerge) return;
    const { productId, incomingSnapshot, source } = soDuplicateMerge;
    const { quantity: addQty, unitPrice, taxRate, productData, boxes: incBoxes, pieces: incPieces } = incomingSnapshot;
    const ppb = getPiecesPerBox(productData);

    let mergedIdx = null;
    setFormData((prev) => {
      const idx = prev.items.findIndex((row) => getSoItemProductId(row) === productId);
      if (idx < 0) {
        mergedIdx = prev.items.length;
        const subtotal = unitPrice * addQty;
        const taxAmount = !taxSystemEnabled ? 0 : (subtotal * (taxRate ?? 0)) / 100;
        const dual = ppb ? piecesToBoxesAndPieces(addQty, ppb) : {};
        const newItem = {
          product: productData._id,
          productData,
          quantity: addQty,
          ...(ppb && {
            boxes: incBoxes ?? dual.boxes,
            pieces: incPieces ?? dual.pieces,
          }),
          unitPrice,
          discountPercent: 0,
          taxRate: taxRate ?? effectiveGlobalTaxPct,
          subtotal,
          discountAmount: 0,
          taxAmount,
          total: subtotal + taxAmount,
        };
        return { ...prev, items: [...prev.items, newItem] };
      }

      mergedIdx = idx;
      const existingItem = prev.items[idx];
      const newQuantity = (Number(existingItem.quantity) || 0) + addQty;
      const newSubtotal = newQuantity * unitPrice;
      const newTaxAmount = !taxSystemEnabled ? 0 : (newSubtotal * effectiveGlobalTaxPct) / 100;
      const newTotal = newSubtotal - (existingItem.discountAmount || 0) + newTaxAmount;
      const dual = ppb ? piecesToBoxesAndPieces(newQuantity, ppb) : {};
      return {
        ...prev,
        items: prev.items.map((item, i) =>
          i === idx
            ? {
              ...item,
              quantity: newQuantity,
              ...(ppb && { boxes: dual.boxes, pieces: dual.pieces }),
              unitPrice,
              taxRate: item.taxRate || taxRate || effectiveGlobalTaxPct,
              subtotal: newSubtotal,
              taxAmount: newTaxAmount,
              total: newTotal,
            }
            : item
        ),
      };
    });

    setSoDuplicateMerge(null);

    if (source === 'inline') {
      setSelectedProduct(null);
      setQuantity(1);
      setCustomRate('');
      setCalculatedRate(0);
      setIsAddingProduct(false);
      setProductSearchTerm('');
      setSelectedProductIndex(-1);
      setSearchKey((prev) => prev + 1);
    } else if (source === 'sharedSearch') {
      setSoSearchResetKey((k) => k + 1);
    }
    refocusSoProductSearch(source);

    if (mergedIdx !== null && mergedIdx >= 0) {
      setHighlightedSoLineIndex(mergedIdx);
    }
  };

  const handleAddModalItem = async () => {
    if (!modalSelectedProduct) return;
    const unitPrice = parseFloat(customRate) || 0;
    if (unitPrice < 0) {
      showErrorToast('Please enter a valid rate');
      return;
    }
    const displayName = modalSelectedProduct.isVariant
      ? (modalSelectedProduct.displayName || modalSelectedProduct.variantName || modalSelectedProduct.name)
      : modalSelectedProduct.name;
    const productIdForPrice = modalSelectedProduct.isVariant ? modalSelectedProduct.baseProductId : modalSelectedProduct._id;
    let lastPrice = null;
    if (productIdForPrice) {
      try {
        const resp = await getLastPurchasePrice(productIdForPrice).unwrap();
        lastPrice = resp?.lastPurchasePrice ?? null;
      } catch {
        lastPrice = null;
      }
    }
    const effectiveCost = getEffectiveCostForLossCheck(modalSelectedProduct, lastPrice);
    if (effectiveCost != null && unitPrice < effectiveCost) {
      const ok = window.confirm(
        `⚠️ WARNING: Sale price (${unitPrice}) is below cost price (${Math.round(effectiveCost)}).\n\nDo you want to proceed?`
      );
      if (!ok) return;
    }
    const taxRate = effectiveGlobalTaxPct;
    const subtotal = unitPrice * quantity;
    const taxAmount = !taxSystemEnabled ? 0 : (subtotal * taxRate / 100);
    const ppb = getPiecesPerBox(modalSelectedProduct);
    const { boxes, pieces } = ppb ? piecesToBoxesAndPieces(quantity, ppb) : {};
    const newItem = {
      product: modalSelectedProduct._id,
      productData: modalSelectedProduct,
      quantity,
      ...(ppb && { boxes, pieces }),
      unitPrice,
      discountPercent: 0,
      taxRate,
      subtotal,
      discountAmount: 0,
      taxAmount,
      total: subtotal + taxAmount
    };
    setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
    if (lastPrice !== null) {
      setLastPurchasePrices(prev => ({ ...prev, [modalSelectedProduct._id]: lastPrice }));
    }
    setModalSelectedProduct(null);
    setModalProductSearchTerm('');
    setQuantity(1);
    setCustomRate('');
    setModalSelectedSuggestionIndex(-1);
    setTimeout(() => modalProductSearchRef?.current?.focus(), 100);
  };

  const handleRemoveItem = (index) => {
    // Get the item to be removed before updating state
    const itemToRemove = formData.items[index];
    const productId = itemToRemove?.product?.toString() || index.toString();

    setIsRemovingFromCart(prev => ({ ...prev, [productId]: true }));
    try {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));

      // If last prices were applied, update originalPrices when item is removed
      if (isLastPricesApplied && itemToRemove) {
        const productId = itemToRemove.product.toString();
        const newOriginalPrices = { ...originalPrices };
        delete newOriginalPrices[productId];
        setOriginalPrices(newOriginalPrices);

        const newPriceStatus = { ...priceStatus };
        delete newPriceStatus[productId];
        setPriceStatus(newPriceStatus);
      }

      // Clean up last purchase price for removed item
      if (itemToRemove) {
        const productId = itemToRemove.product.toString();
        const newLastPurchasePrices = { ...lastPurchasePrices };
        delete newLastPurchasePrices[productId];
        setLastPurchasePrices(newLastPurchasePrices);
      }
    } finally {
      setIsRemovingFromCart(prev => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
    }
  };

  const handleSortCartItems = () => {
    setIsSortingItems(true);
    try {
      setFormData(prev => {
        if (!prev.items || prev.items.length < 2) {
          return prev;
        }

        const getProductName = (item) => {
          const productData = item.productData || item.product;

          if (!productData) return '';

          if (typeof productData === 'string') {
            return productData;
          }

          return (
            productData.name ||
            productData.title ||
            productData.displayName ||
            productData.businessName ||
            productData.fullName ||
            ''
          );
        };

        const sortedItems = [...prev.items].sort((a, b) => {
          const nameA = getProductName(a).toString().toLowerCase();
          const nameB = getProductName(b).toString().toLowerCase();

          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        });

        return {
          ...prev,
          items: sortedItems
        };
      });
      showSuccessToast('Cart items sorted alphabetically');
    } finally {
      setIsSortingItems(false);
    }
  };

  const calculateTotals = () => {
    const lineDiscountTotal = formData.items.reduce(
      (sum, item) => sum + (item.discountAmount || 0),
      0
    );
    const { subtotal, totalDiscount, tax, total } = computeSalesCheckoutPricing({
      items: formData.items,
      lineDiscountTotal,
      taxRate: globalTaxPct,
      taxSystemEnabled,
    });
    return {
      subtotal,
      lineDiscountTotal,
      totalDiscount,
      totalTax: tax,
      total,
    };
  };


  const handleCreate = () => {
    if (formData.items.length === 0) {
      showErrorToast('Please add at least one item to the order');
      return;
    }

    // Calculate totals
    const { subtotal, totalDiscount, totalTax, total } = calculateTotals();

    const { payment: _payment, ...orderDataWithoutPayment } = formData;

    // Transform items to match backend expectations (quantity in pieces for stock)
    const transformedItems = formData.items.map(item => {
      const qty = Math.round(Number(item.quantity) || 1);
      const productId = typeof item.product === 'string' ? item.product : (item.product?.id || item.product?._id);
      const isManualLine =
        item.productData?.isManual === true ||
        (typeof productId === 'string' && productId.startsWith('manual_'));
      const base = {
        product: productId,
        name: item.productData?.name || item.productData?.displayName || item.name || item.displayName || '',
        sku: item.productData?.sku || item.sku || '',
        quantity: qty,
        unitPrice: item.unitPrice,
        totalPrice: item.total,
        invoicedQuantity: 0,
        remainingQuantity: qty
      };
      if (isManualLine) {
        base.isManual = true;
        const uc = Number(
          item.productData?.pricing?.cost ??
          item.productData?.pricing?.cost_price ??
          item.productData?.cost_price ??
          item.productData?.costPrice ??
          0
        );
        if (Number.isFinite(uc) && uc >= 0) {
          base.unitCost = uc;
        }
        if (item.productData?.imageUrl) {
          base.imageUrl = item.productData.imageUrl;
        }
      }
      if (item.boxes != null || item.pieces != null) {
        base.boxes = item.boxes;
        base.pieces = item.pieces;
      }
      return base;
    });

    const orderData = {
      ...orderDataWithoutPayment,
      isTaxExempt: !taxSystemEnabled,
      items: transformedItems,
      subtotal,
      tax: totalTax,
      total,
      discountAmount: totalDiscount > 0 ? totalDiscount : undefined,
    };

    createSalesOrderMutation(orderData)
      .unwrap()
      .then((result) => {
        if (autoPrint && result?.salesOrder) {
          const formatted = formatOrderForPrint(result.salesOrder);
          if (formatted) {
            setPrintOrderData(formatted);
            setShowPrintModal(true);
          }
        }
        resetForm();
        showSuccessToast('Sales order created successfully');
        // Tab title will be updated by useEffect when selectedCustomer is reset
        refetch();
      })
      .catch((error) => {
        showErrorToast(handleApiError(error));
      });
  };

  const handleUpdate = () => {
    // Extract product ID (backend expects UUID string, not object)
    const getProductId = (item) => {
      const p = item.product;
      if (!p) return null;
      if (typeof p === 'string') return p;
      return p.id || p._id || null;
    };
    // Extract customer ID (backend expects UUID string)
    const customerId = formData.customer
      ? (typeof formData.customer === 'object'
        ? (formData.customer?.id || formData.customer?._id)
        : formData.customer)
      : null;

    const cleanedData = {
      ...formData,
      isTaxExempt: !taxSystemEnabled,
      customer: customerId || undefined,
      items: formData.items.map(item => {
        const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
        const pid = getProductId(item);
        const isManualLine =
          item.productData?.isManual === true ||
          (typeof pid === 'string' && pid.startsWith('manual_'));
        const base = {
          product: pid,
          name: item.productData?.name || item.productData?.displayName || item.name || item.displayName || '',
          sku: item.productData?.sku || item.sku || '',
          quantity: qty,
          unitPrice: parseFloat(item.unitPrice) || 0,
          totalPrice: parseFloat(item.total) || parseFloat(item.unitPrice) * qty,
          invoicedQuantity: parseInt(item.invoicedQuantity, 10) || 0,
          remainingQuantity: parseInt(item.remainingQuantity, 10) ?? qty
        };
        if (isManualLine) {
          base.isManual = true;
          const uc = Number(
            item.productData?.pricing?.cost ??
            item.productData?.pricing?.cost_price ??
            item.productData?.cost_price ??
            item.productData?.costPrice ??
            0
          );
          if (Number.isFinite(uc) && uc >= 0) {
            base.unitCost = uc;
          }
          if (item.productData?.imageUrl) {
            base.imageUrl = item.productData.imageUrl;
          }
        }
        if (item.boxes != null || item.pieces != null) {
          base.boxes = item.boxes;
          base.pieces = item.pieces;
        }
        return base;
      }).filter(item => item.product)
    };

    updateSalesOrderMutation({ id: selectedOrder._id || selectedOrder.id, ...cleanedData })
      .unwrap()
      .then((result) => {
        if (autoPrint && result?.salesOrder) {
          const formatted = formatOrderForPrint(result.salesOrder);
          if (formatted) {
            setPrintOrderData(formatted);
            setShowPrintModal(true);
          }
        }
        setSelectedOrder(null);
        setModalProductSearchTerm('');
        setModalSelectedProduct(null);
        setModalSelectedSuggestionIndex(-1);
        resetForm();
        showSuccessToast('Sales order updated successfully');
        refetch();
      })
      .catch((error) => {
        const errorMessage = error?.data?.message || error?.message || 'Failed to update sales order';
        showErrorToast(errorMessage);
      });
  };

  const handleDelete = (idOrOrder) => {
    const id = typeof idOrOrder === 'object' ? (idOrOrder?.id ?? idOrOrder?._id) : idOrOrder;
    const label = (typeof idOrOrder === 'object' && (idOrOrder?.salesOrderNumber || idOrOrder?.orderNumber)) || `${id}`;
    confirmDelete(label, 'Sales Order', async () => {
      try {
        await deleteSalesOrderMutation(id).unwrap();
        showSuccessToast('Sales order deleted successfully');
        refetch();
      } catch (error) {
        showErrorToast(handleApiError(error));
        throw error;
      }
    });
  };

  const CREDIT_LIMIT_TOAST = 'Credit limit exceeded. Invoice cannot be created';

  const doConfirm = (id) => {
    confirmSalesOrderMutation(id)
      .unwrap()
      .then((response) => {
        setShowOutOfStockModal(false);
        setOutOfStockItems([]);
        setPendingConfirmId(null);
        if (response.invoiceError) {
          const errText = String(response.invoiceError || '');
          if (errText.includes('Credit limit') || errText.includes('credit limit')) {
            showErrorToast(CREDIT_LIMIT_TOAST);
          } else {
            showSuccessToast(`Sales order confirmed but failed to generate invoice: ${response.invoiceError}`);
          }
        } else {
          showSuccessToast('Sales order confirmed and invoice generated successfully');
        }
        refetch();
        refreshProductCatalogCache();
      })
      .catch((error) => {
        setShowOutOfStockModal(false);
        setOutOfStockItems([]);
        setPendingConfirmId(null);
        const apiMsg =
          error?.data?.message ||
          error?.response?.data?.message ||
          handleApiError(error);
        if (
          error?.data?.error === 'CREDIT_LIMIT_EXCEEDED' ||
          (typeof apiMsg === 'string' && apiMsg.includes('Credit limit'))
        ) {
          showErrorToast(CREDIT_LIMIT_TOAST);
        } else {
          showErrorToast(typeof apiMsg === 'string' ? apiMsg : handleApiError(error));
        }
      });
  };

  const handleConfirm = async (id) => {
    try {
      const result = await getStockStatus(id).unwrap();
      const res = result?.data ?? result;
      const outOfStock = res?.outOfStock ?? [];
      if (outOfStock.length > 0) {
        setOutOfStockItems(outOfStock);
        setPendingConfirmId(id);
        setShowOutOfStockModal(true);
        return;
      }
    } catch {
      // If stock check fails, proceed with normal confirm
    }
    if (window.confirm('Confirm this sales order? This will create a Sales Invoice (it will appear under Sales Invoices) and update inventory.')) {
      doConfirm(id);
    }
  };

  const handleConfirmProceedAnyway = () => {
    if (pendingConfirmId && window.confirm('The following products are out of stock or have insufficient quantity. Confirmation will likely fail. Do you want to try anyway?')) {
      doConfirm(pendingConfirmId);
    }
  };

  const handleCancel = (id) => {
    if (window.confirm('Are you sure you want to cancel this sales order? This action cannot be undone.')) {
      cancelSalesOrderMutation(id)
        .unwrap()
        .then(() => {
          showSuccessToast('Sales order cancelled successfully');
          refetch(); // Refetch sales orders list
          // Immediately refetch products to update stock levels (cancellation may restore stock)
          refreshProductCatalogCache();
        })
        .catch((error) => {
          showErrorToast(handleApiError(error));
        });
    }
  };

  const handleUpdateItemsConfirmation = (itemUpdates, confirmAll, cancelAll, orderOverride = null) => {
    const orderRef = orderOverride || selectedOrder;
    const id = orderRef?._id ?? orderRef?.id;
    if (!id) return;
    updateItemsConfirmationMutation({
      id,
      itemUpdates: itemUpdates ?? [],
      confirmAll,
      cancelAll,
    })
      .unwrap()
      .then((response) => {
        const msg = response?.sale
          ? 'Items confirmed and invoice created successfully'
          : response?.invoiceError
            ? 'Items confirmed but invoice creation failed'
            : 'Items confirmation updated';
        if (response?.invoiceError && String(response.invoiceError).includes('Credit limit')) {
          showErrorToast(CREDIT_LIMIT_TOAST);
        } else {
          showSuccessToast(msg);
        }
        if (response?.salesOrder) {
          setSelectedOrder(response.salesOrder);
        }
        setSelectedItemIndices([]);
        refetch();
        refreshProductCatalogCache();
      })
      .catch((error) => {
        const apiMsg =
          error?.data?.message ||
          error?.response?.data?.message ||
          handleApiError(error);
        if (
          error?.data?.error === 'CREDIT_LIMIT_EXCEEDED' ||
          (typeof apiMsg === 'string' && apiMsg.includes('Credit limit'))
        ) {
          showErrorToast(CREDIT_LIMIT_TOAST);
        } else {
          showErrorToast(typeof apiMsg === 'string' ? apiMsg : handleApiError(error));
        }
      });
  };

  const completeSalesOrderToFullInvoice = (order) => {
    const action = getSalesOrderInvoiceCompleteAction(order);
    if (!action) return;
    const id = order?.id ?? order?._id;
    if (!id) return;

    if (action === 'confirmAll') {
      if (!window.confirm('Confirm all remaining lines and create the full sales invoice?')) return;
      handleUpdateItemsConfirmation([], true, false, order);
      return;
    }

    if (
      !window.confirm(
        'Create the sales invoice now? Inventory was already reduced when this order was confirmed.'
      )
    ) {
      return;
    }

    createInvoiceFromSOMutation(id)
      .unwrap()
      .then((res) => {
        showSuccessToast(res?.message || 'Sales invoice created successfully');
        refetch();
        refreshProductCatalogCache();
        const updated = res?.salesOrder;
        if (updated && selectedOrder && (selectedOrder.id === id || selectedOrder._id === id)) {
          setSelectedOrder(updated);
        }
      })
      .catch((error) => {
        const apiMsg =
          error?.data?.message ||
          error?.response?.data?.message ||
          handleApiError(error);
        if (
          error?.data?.error === 'CREDIT_LIMIT_EXCEEDED' ||
          (typeof apiMsg === 'string' && apiMsg.includes('Credit limit'))
        ) {
          showErrorToast(CREDIT_LIMIT_TOAST);
        } else {
          showErrorToast(typeof apiMsg === 'string' ? apiMsg : handleApiError(error));
        }
      });
  };

  const toggleItemSelection = (index) => {
    setSelectedItemIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };



  const handleEdit = (order) => {
    setSelectedOrder(order);

    // Process items to ensure productData is available
    const processedItems = (order.items || []).map(item => ({
      ...item,
      productData: item.product || null // Use the populated product data
    }));

    setFormData({
      orderType: order.orderType,
      customer: order.customer?.id || order.customer?._id || '',
      items: processedItems,
      notes: order.notes || '',
      terms: order.terms || '',
      orderNumber: order.soNumber || order.orderNumber || order.invoiceNumber || ''
    });
    setAutoGenerateOrderNumber(!(order.soNumber || order.orderNumber || order.invoiceNumber));

    // Set the selected customer
    if (order.customer) {
      setSelectedCustomer(order.customer);
      setCustomerSearchTerm(getCustomerDisplayName(order.customer, ''));
    } else {
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
    }

    // Restore the Price Type so it round-trips correctly between create and
    // edit (e.g. selecting "Retail" for a wholesale customer is preserved).
    setPriceType(deriveInitialPriceType(order.orderType, order.customer));
  };

  const cancelEdit = () => {
    setSelectedOrder(null);
    setModalProductSearchTerm('');
    setModalSelectedProduct(null);
    setModalSelectedSuggestionIndex(-1);
    resetForm();
  };

  const handleView = (order) => {
    setSelectedOrder(order);
    setSelectedItemIndices([]);
    setShowViewModal(true);
  };

  const formatOrderForPrint = useCallback(
    (order) => {
      if (!order) return null;

      const customerData =
        order.customer ||
        selectedCustomer ||
        (order.customerInfo
          ? {
            displayName: order.customerInfo.name,
            email: order.customerInfo.email,
            phone: order.customerInfo.phone,
            address: order.customerInfo.address,
            pendingBalance: order.customerInfo.pendingBalance
          }
          : null);

      const formatAddressForPrint = (cust) => {
        if (!cust) return '';
        if (typeof cust.address === 'string' && cust.address.trim()) return cust.address.trim();
        const addrRaw = cust.address ?? cust.addresses;
        if (Array.isArray(addrRaw) && addrRaw.length > 0) {
          const a = addrRaw.find(x => x.isDefault) || addrRaw.find(x => x.type === 'billing' || x.type === 'both') || addrRaw[0];
          const parts = [a.street || a.address_line1 || a.addressLine1 || a.line1, a.city, a.state || a.province, a.country, a.zipCode || a.zip || a.postalCode || a.postal_code].filter(Boolean);
          return parts.join(', ');
        }
        if (addrRaw && typeof addrRaw === 'object' && !Array.isArray(addrRaw)) {
          const parts = [addrRaw.street || addrRaw.address_line1 || addrRaw.addressLine1 || addrRaw.line1, addrRaw.city, addrRaw.state || addrRaw.province, addrRaw.country, addrRaw.zipCode || addrRaw.zip || addrRaw.postalCode || addrRaw.postal_code].filter(Boolean);
          return parts.join(', ');
        }
        if (typeof cust.location === 'string' && cust.location.trim()) return cust.location.trim();
        if (typeof cust.companyAddress === 'string' && cust.companyAddress.trim()) return cust.companyAddress.trim();
        return '';
      };

      const customerInfo =
        order.customerInfo ||
        (customerData
          ? {
            name:
              customerData.displayName ||
              customerData.businessName ||
              customerData.name ||
              'Customer',
            email: customerData.email || '',
            phone: customerData.phone || '',
            address:
              (order.customerInfo?.address && typeof order.customerInfo.address === 'string')
                ? order.customerInfo.address
                : formatAddressForPrint(customerData) ||
                customerData.address ||
                customerData.location ||
                customerData.companyAddress ||
                ''
          }
          : null);

      const itemsSource = order.items || formData.items || [];
      const items = itemsSource.map((item) => {
        const productData =
          item.productData ||
          item.product ||
          item.productInfo ||
          item.productDetails ||
          {};
        const productName =
          (typeof productData === 'object' && productData !== null)
            ? (productData.name ||
              productData.displayName ||
              productData.display_name ||
              productData.variantName ||
              productData.variant_name ||
              productData.title ||
              item.productName)
            : item.productName;
        return {
          ...item,
          product: {
            name: productName || 'Product'
          },
          quantity: Number(item.quantity) || 0,
          unitPrice:
            Number(
              item.unitPrice !== undefined
                ? item.unitPrice
                : item.rate !== undefined
                  ? item.rate
                  : 0
            ) || 0,
          total: Number(item.totalPrice ?? item.total ?? 0) || 0,
          totalPrice: Number(item.totalPrice ?? item.total ?? 0) || 0
        };
      });

      const computedSubtotal = items.reduce(
        (sum, item) =>
          sum + (item.unitPrice || 0) * (item.quantity || 0),
        0
      );

      const subtotal =
        order.subtotal ??
        order.pricing?.subtotal ??
        computedSubtotal;
      const discountAmount =
        order.discount ??
        order.pricing?.discountAmount ??
        0;
      const total =
        order.total ??
        order.pricing?.total ??
        subtotal - discountAmount;

      const amountPaid = order.payment?.amountPaid || 0;
      const remainingBalance =
        order.payment?.remainingBalance ??
        total - amountPaid;

      return {
        ...order,
        orderNumber:
          order.soNumber ||
          order.orderNumber ||
          order.invoiceNumber ||
          formData.orderNumber ||
          generateOrderNumber(customerData),
        customer: customerData,
        customerInfo,
        items,
        pricing: {
          subtotal,
          discountAmount,
          total
        },
        payment: {
          amountPaid,
          remainingBalance
        },
        createdAt: order.createdAt || new Date().toISOString()
      };
    },
    [
      formData.items,
      formData.orderNumber,
      generateOrderNumber,
      selectedCustomer
    ]
  );

  const handlePrint = async (order) => {
    const orderId = order?._id || order?.id;
    let source = order;
    if (orderId) {
      try {
        const result = await fetchSalesOrderById(orderId).unwrap();
        source = result?.salesOrder || result?.data?.salesOrder || result || order;
      } catch {
        showErrorToast('Could not load full order — printing with available data');
      }
    }
    const formatted = formatOrderForPrint(source);
    if (!formatted) return;
    setPrintOrderData(formatted);
    setShowPrintModal(true);
  };

  const buildDraftSalesOrderPrintOrder = () => {
    const { subtotal, totalDiscount, totalTax, total } = calculateTotals();
    let customerAddress = '';
    if (selectedCustomer?.addresses?.length) {
      const addr = selectedCustomer.addresses.find((a) => a.isDefault)
        || selectedCustomer.addresses.find((a) => a.type === 'billing' || a.type === 'both')
        || selectedCustomer.addresses[0];
      if (addr) {
        customerAddress = [addr.street, addr.city, addr.state, addr.country, addr.zipCode || addr.zip]
          .filter(Boolean)
          .join(', ');
      }
    } else if (selectedCustomer?.address) {
      customerAddress = selectedCustomer.address;
    }
    return {
      soNumber: formData.orderNumber || `SO-${Date.now()}`,
      orderNumber: formData.orderNumber || `SO-${Date.now()}`,
      orderType: resolveOrderTypeForSave(priceType, formData.orderType),
      customer: selectedCustomer ?? undefined,
      customerInfo: selectedCustomer
        ? {
          name: selectedCustomer.businessName || selectedCustomer.business_name || selectedCustomer.displayName || selectedCustomer.name,
          email: selectedCustomer.email,
          phone: selectedCustomer.phone,
          businessName: selectedCustomer.businessName || selectedCustomer.business_name,
          address: customerAddress || undefined,
          currentBalance: selectedCustomer.currentBalance,
          pendingBalance: selectedCustomer.pendingBalance,
          advanceBalance: selectedCustomer.advanceBalance
        }
        : null,
      items: formData.items.map((item) => ({
        product: item.productData
          ? { name: item.productData.name || item.productData.displayName || 'Product' }
          : { name: 'Product' },
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.total
      })),
      pricing: {
        subtotal,
        discountAmount: totalDiscount,
        taxAmount: totalTax,
        isTaxExempt: !taxSystemEnabled,
        total
      },
      payment: {
        method: 'cash',
        bankAccount: null,
        amountPaid: 0,
        remainingBalance: total,
        isPartialPayment: false
      },
      notes: formData.notes,
      status: 'draft',
      createdAt: new Date().toISOString()
    };
  };


  /** Order lifecycle label + icon (distinct from per-line item “Confirmed”). */
  const getSalesOrderStatusPresentation = (order) => {
    const status = order?.status;
    switch (status) {
      case 'draft':
        return { icon: <Clock className="h-4 w-4 text-blue-500 shrink-0" />, label: 'Pending' };
      case 'confirmed':
        return {
          icon: <FileCheck className="h-4 w-4 text-amber-600 shrink-0" />,
          label: 'Order confirmed',
        };
      case 'partially_invoiced':
        return {
          icon: <Clock className="h-4 w-4 text-yellow-500 shrink-0" />,
          label: 'Partially invoiced',
        };
      case 'fully_invoiced':
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />,
          label: 'Fully invoiced',
        };
      case 'closed':
        return {
          icon: <CheckCircle className="h-4 w-4 text-gray-600 shrink-0" />,
          label: 'Closed',
        };
      case 'cancelled':
        return { icon: <XCircle className="h-4 w-4 text-red-500 shrink-0" />, label: 'Cancelled' };
      default:
        return {
          icon: <Clock className="h-4 w-4 text-gray-500 shrink-0" />,
          label: String(status ?? '—').replace(/_/g, ' '),
        };
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-100';
      case 'partial':
        return 'text-yellow-600 bg-yellow-100';
      case 'pending':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const salesOrders = salesOrdersData?.data?.salesOrders ?? salesOrdersData?.salesOrders ?? [];
  const paginationInfo = salesOrdersData?.data?.pagination ?? salesOrdersData?.pagination ?? {};

  const getExportData = useCallback(async () => {
    try {
      const res = await fetchSalesOrdersForExport({
        ...filters,
        sortConfig,
        all: true,
      }).unwrap();
      const allRows = res?.salesOrders ?? res?.data?.salesOrders ?? [];
      return {
        title: 'Sales Orders Report',
        filename: `Sales_Orders_${filters.fromDate}_to_${filters.toDate}.xlsx`,
        company: {
          name: companySettings?.companyName || 'ZARYAB IMPEX',
          address: companySettings?.address || companySettings?.billingAddress || '',
          contact: `${companySettings?.contactNumber || ''} ${companySettings?.email ? '| ' + companySettings.email : ''}`.trim()
        },
        columns: [
          { header: 'S.No', key: 'sno', width: 8, type: 'number' },
          { header: 'Image', key: 'imageUrl', width: 12, type: 'image' },
          { header: 'Order #', key: 'orderNumber', width: 25 },
          { header: 'Customer', key: 'customerName', width: 35 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Type', key: 'orderType', width: 15 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Total Amount', key: 'totalAmount', width: 15, type: 'currency' }
        ],
        data: allRows.map((order, i) => ({
          sno: i + 1,
          imageUrl: order.items?.[0]?.product?.imageUrl ?? order.items?.[0]?.productData?.imageUrl ?? null,
          orderNumber: order?.soNumber ?? order?.so_number ?? order?.orderNumber ?? order?.invoiceNumber ?? '—',
          customerName: getCustomerDisplayName(order?.customer, 'Walk-in'),
          date: formatDate(order?.orderDate ?? order?.order_date ?? order?.createdAt ?? order?.created_at),
          orderType: (order?.orderType || '—').toUpperCase(),
          status: (order?.status || '—').toUpperCase(),
          totalAmount: Number(order?.pricing?.totalAmount ?? order?.pricing?.total ?? order?.totalAmount ?? order?.total ?? 0)
        })),
        summary: {
          rows: [
            {
              label: 'GRAND TOTAL:',
              orderNumber: `${allRows.length} Orders`,
              totalAmount: allRows.reduce((sum, o) => sum + Number(o?.pricing?.totalAmount ?? o?.pricing?.total ?? o?.totalAmount ?? o?.total ?? 0), 0)
            }
          ]
        }
      };
    } catch (err) {
      showErrorToast(handleApiError(err).message || 'Could not load sales orders for export');
      return null;
    }
  }, [fetchSalesOrdersForExport, filters, sortConfig, companySettings]);

  const {
    subtotal,
    totalDiscount,
    totalTax,
    total,
  } = calculateTotals();

  return (
    <PageLayout className="w-full max-w-full overflow-x-hidden">
      {/* Modern Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
          {/* Title & Customer Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center flex-1 gap-3">
            <div className="flex-shrink-0">
              <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">Sales Orders</h1>
            </div>
            <div className="hidden sm:block h-7 w-px bg-gray-200"></div>
            <div className="flex-1 min-w-0 sm:min-w-[300px]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Select Customer
                  </label>
                  {selectedCustomer && (
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearchTerm('');
                        setFormData(prev => ({ ...prev, customer: '' }));
                        setOriginalPrices({});
                        setIsLastPricesApplied(false);
                        setPriceStatus({});
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider underline"
                    >
                      Change
                    </button>
                  )}
                </div>
                <PriceTypeSelector
                  id="salesOrderPriceType"
                  value={priceType}
                  onChange={setPriceType}
                />
              </div>
              <CustomerPartySelect
                innerRef={customerSearchRef}
                items={customers}
                selectedItem={selectedCustomer}
                onSelect={handleCustomerSelect}
                onSearch={handleCustomerSearch}
                searchValue={customerSearchTerm}
                loading={customersLoading || customersFetching}
                emptyMessage={customerSearchTerm.length > 0 ? "No customers found" : "Start typing to search customers..."}
                canViewBalance={canViewCustomerBalance}
                showSecondaryName
              />
            </div>
          </div>

          <CustomerBalanceStrip
            customer={selectedCustomer}
            canViewBalance={canViewCustomerBalance}
            balanceOverride={displayBalance}
            creditLimitOverride={displayCreditLimit}
          />
        </div>
      </div>

      {/* Combined Product Selection and Cart Section */}
      <div className="card">
        <div className="card-header">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <h3 className="text-lg font-medium text-gray-900">Product Selection & Cart</h3>
            <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
              {formData.items.length > 0 && (
                <LoadingButton
                  type="button"
                  onClick={handleSortCartItems}
                  isLoading={isSortingItems}
                  variant="secondary"
                  size="sm"
                  className="flex items-center space-x-2"
                  title="Sort products alphabetically"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span>Sort A-Z</span>
                </LoadingButton>
              )}
              <div className="flex items-center space-x-2">
                <CostPriceToggleButton
                  canView={canViewCostPrice}
                  enabled={showCostPrice}
                  onToggle={setShowCostPrice}
                  title={showCostPrice ? "Hide purchase cost prices" : "Show purchase cost prices"}
                />
                {formData.items.length > 0 && (
                  <ProfitToggleButton
                    canView={canViewBP}
                    enabled={showProfit}
                    onToggle={setShowProfit}
                    totalProfit={totalProfit}
                    showProfitValue
                    title="Toggle estimated profit (BP)"
                    formatProfit={formatCurrency}
                  />
                )}
              </div>
              <ApplyLastPricesButton
                canApply={canApplyLastPrices}
                hasCustomer={!!selectedCustomer}
                hasItems={formData.items.length > 0}
                isApplied={isLastPricesApplied}
                isApplying={isLoadingLastPrices}
                isRestoring={isRestoringPrices}
                onApply={handleApplyLastPrices}
                onRestore={handleRestoreCurrentPrices}
              />
            </div>
          </div>
        </div>
        <div className="card-content">
          {/* Product Search */}
          <div className="mb-2">
            <ProductSearch
              key={soSearchResetKey}
              onFocusReady={handleSoProductSearchFocusReady}
              onAddProduct={addToCartFromProductSearch}
              selectedCustomer={selectedCustomer}
              showCostPrice={showCostPrice}
              hasCostPricePermission={canViewCostPrice}
              priceType={priceType}
              dualUnitShowBoxInput={dualUnitShowBoxInputEnabled}
              dualUnitShowPiecesInput={dualUnitShowPiecesInputEnabled}
              allowOutOfStock={true}
              allowSaleWithoutProduct={allowSaleWithoutProductEnabled}
              allowManualCostPrice={allowManualCostPriceEnabled}
              onLastPurchasePriceFetched={(productId, price) => {
                setLastPurchasePrices(prev => ({
                  ...prev,
                  [productId]: price
                }));
              }}
            />
            {false && (() => {
              const dualSel = hasDualUnit(selectedProduct);
              const productSearchMdClass = dualSel
                ? (canViewCostPrice && showCostPrice ? 'md:col-span-4' : 'md:col-span-5')
                : (canViewCostPrice && showCostPrice ? 'md:col-span-6' : 'md:col-span-7');
              const qtyMdClass = dualSel ? 'col-span-6 md:col-span-3' : 'col-span-6 md:col-span-1';
              const previewAmount = isAddingProduct
                ? Math.round(quantity * parseFloat(customRate || 0))
                : 0;

              return (
                <div className="grid grid-cols-12 gap-4 items-end">
                </div>
              );
            })()}
          </div>

          {/* Cart Items */}
          {formData.items.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">No items in cart</p>
            </div>
          ) : (
            <div className="pt-2 overflow-x-hidden">
              {isLastPricesApplied && Object.keys(priceStatus).length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 mb-3 text-xs">
                  <span className="text-gray-600 font-medium">Price Status:</span>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-gray-600">Updated</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Info className="h-3 w-3 text-blue-600" />
                    <span className="text-gray-600">Same Price</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <AlertCircle className="h-3 w-3 text-yellow-600" />
                    <span className="text-gray-600">Not in Last Order</span>
                  </div>
                </div>
              )}
              <div
                ref={soCartScrollRef}
                className={
                  soCartNeedsInnerScroll
                    ? 'max-h-[min(70vh,860px)] overflow-y-auto -mx-1 px-1 [scrollbar-gutter:stable]'
                    : 'overflow-visible -mx-1 px-1'
                }
              >
                {formData.items.map((item, index) => {
                  const product = getSoItemProductData(item);
                  const totalPrice = item.unitPrice * item.quantity;
                  const isLowStock = product?.inventory?.currentStock <= (product?.inventory?.reorderPoint || 0);
                  const serialHighlight = highlightedSoLineIndex === index;
                  const lineDisplayCost = getProductDisplayCostPrice(product);
                  const lineEffectiveCost = getSoLineEffectiveCost(item, lastPurchasePrices);
                  const isBelowCost =
                    canViewCostPrice &&
                    lineEffectiveCost != null &&
                    item.unitPrice < lineEffectiveCost;

                  return (
                    <div
                      key={index}
                      ref={(node) => {
                        if (node) soCartLineElRefs.current.set(index, node);
                        else soCartLineElRefs.current.delete(index);
                      }}
                      className={`py-1 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      {/* Desktop Grid Layout */}
                      <div
                        className={`hidden md:grid gap-x-1 items-center ${dualUnitShowBoxInputEnabled
                          ? (
                            showCostPrice && canViewCostPrice
                              ? 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5rem_5.35rem_5.35rem_2.25rem]'
                              : 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
                          )
                          : (
                            showCostPrice && canViewCostPrice
                              ? 'grid-cols-[2.25rem_minmax(0,1fr)_5.35rem_5.35rem_5rem_5.35rem_5.35rem_2.25rem]'
                              : 'grid-cols-[2.25rem_minmax(0,1fr)_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
                          )
                          }`}
                      >
                        {/* Serial Number - 1 column */}
                        <div className="min-w-0 flex justify-start">
                          <LineItemSerial index={index} highlight={serialHighlight} />
                        </div>

                        {/* Product Name - reduced width to keep row alignment */}
                        <div className="min-w-0 flex items-center h-8 gap-2">
                          {showProductImages && (
                            <LineItemThumbnail
                              src={product?.imageUrl}
                              onClick={() => setPreviewImageProduct(product)}
                            />
                          )}
                          <div className="flex flex-col min-w-0 w-full">
                            <span className="font-medium text-sm truncate min-w-0">
                              {product?.isVariant
                                ? getProductDisplayName(product, 'Unknown Variant')
                                : (safeRender(product?.name) || 'Unknown Product')}
                              {isLowStock && <span className="text-yellow-600 text-xs ml-2">⚠️ Low Stock</span>}
                              {isBelowCost && (
                                  <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold" title={`Sale price below cost! Loss: ${Math.round(lineEffectiveCost - item.unitPrice)} per unit`}>
                                    ⚠️ Below Cost
                                  </span>
                                )}
                              {isLastPricesApplied && (
                                <LineItemPriceStatusBadge
                                  status={priceStatus[item.product?.toString()]}
                                  className="ml-2"
                                />
                              )}
                            </span>
                            {product?.isVariant && (
                              <span className="text-xs text-gray-500">
                                {product.variantType}: {product.variantValue}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Box column */}
                        {dualUnitShowBoxInputEnabled && (
                          <div className="min-w-0">
                            <LineItemBoxInputCell
                              product={product}
                              item={item}
                              onChange={(rawValue) => {
                                const nextBoxes = Math.max(0, parseInt(rawValue, 10) || 0);
                                const piecesPerBox = getPiecesPerBox(product) || 1;
                                const currentPieces = item.pieces != null
                                  ? Math.max(0, Number(item.pieces) || 0)
                                  : piecesToBoxesAndPieces(item.quantity, piecesPerBox).pieces;
                                const rawQty = nextBoxes * piecesPerBox + currentPieces;
                                const stockCap = Number(product?.inventory?.currentStock ?? 0);
                                if (rawQty > stockCap && stockCap >= 0) {
                                  toast.warning(`Warning: Quantity ${rawQty} exceeds available stock ${stockCap}`, { duration: 3000, icon: '⚠️' });
                                }
                                const nextQty = rawQty;
                                setFormData(prev => ({
                                  ...prev,
                                  items: prev.items.map((itm, i) => (
                                    i === index
                                      ? { ...itm, boxes: nextBoxes, quantity: nextQty, total: nextQty * itm.unitPrice }
                                      : itm
                                  ))
                                }));
                              }}
                            />
                          </div>
                        )}

                        {/* Stock - 1 column */}
                        <div className="min-w-0">
                          {canViewStock ? (
                            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
                              {product?.inventory?.currentStock || 0}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-300 block text-center h-8 flex items-center justify-center">—</span>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="min-w-0">
                          <DualUnitQuantityInput
                            product={product}
                            quantity={item.quantity}
                            onChange={(newQuantity, dual) => {
                              if (newQuantity <= 0) {
                                handleRemoveItem(index);
                                return;
                              }
                              const stockCap = Number(product?.inventory?.currentStock ?? 0);
                              if (newQuantity > stockCap && stockCap >= 0) {
                                toast.warning(`Warning: Quantity ${newQuantity} exceeds available stock ${stockCap}`, { duration: 3000, icon: '⚠️' });
                              }
                              const ppb = getPiecesPerBox(product);
                              const { boxes, pieces } = ppb && dual ? dual : (ppb ? piecesToBoxesAndPieces(newQuantity, ppb) : {});
                              setFormData(prev => ({
                                ...prev,
                                items: prev.items.map((itm, i) =>
                                  i === index ? {
                                    ...itm,
                                    quantity: newQuantity,
                                    ...(ppb && { boxes, pieces }),
                                    total: newQuantity * itm.unitPrice
                                  } : itm
                                )
                              }));
                            }}
                            min={1}
                            max={undefined}
                            stockPiecesForRemaining={product?.inventory?.currentStock ?? 0}

                            showBoxInput={dualUnitShowBoxInputEnabled && !hasDualUnit(product)}
                            showPiecesInput={dualUnitShowPiecesInputEnabled}
                            showPiecesUnitLabel={false}
                            inputClassName="input text-center h-8"
                            compact={hasDualUnit(product)}
                          />
                        </div>

                        {/* Purchase Price (Cost) - 1 column (conditional) - Between Quantity and Rate */}
                        {showCostPrice && canViewCostPrice && (
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 block text-center h-8 flex items-center justify-center" title="Cost Price">
                              {lineDisplayCost ?? 'N/A'}
                            </span>
                          </div>
                        )}

                        {/* Rate - 1 column */}
                        <div className="min-w-0">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value) || 0;
                              const costPrice = getSoLineEffectiveCost(item, lastPurchasePrices);

                              // Check if new price is below cost (always check, regardless of showCostPrice)
                              if (costPrice != null && newPrice < costPrice) {
                                const loss = costPrice - newPrice;
                                const lossPercent = ((loss / costPrice) * 100).toFixed(1);
                                const shouldProceed = window.confirm(
                                  `⚠️ WARNING: Sale price (${newPrice}) is below cost price (${Math.round(costPrice)}).\n\n` +
                                  `Loss per unit: ${Math.round(loss)} (${lossPercent}%)\n` +
                                  `Total loss: ${Math.round(loss * item.quantity)}\n\n` +
                                  `Do you want to proceed?`
                                );
                                if (!shouldProceed) {
                                  return;
                                }
                              }

                              setFormData(prev => ({
                                ...prev,
                                items: prev.items.map((itm, i) =>
                                  i === index ? { ...itm, unitPrice: newPrice, total: itm.quantity * newPrice } : itm
                                )
                              }));
                            }}
                            onFocus={(e) => e.target.select()}
                            className={`input text-center h-8 ${isBelowCost
                              ? 'border-red-500 bg-red-50'
                              : ''
                              }`}
                            title={
                              isBelowCost
                                ? `⚠️ WARNING: Sale price (${Math.round(item.unitPrice)}) is below cost price (${Math.round(lineEffectiveCost)})`
                                : ''
                            }
                            min="0"
                          />
                        </div>

                        {/* Total - 1 column */}
                        <div className="min-w-0">
                          <LineItemTotalCell value={Math.round(totalPrice)} />
                        </div>

                        {/* Delete Button - 1 column */}
                        <div className="min-w-0 flex justify-end">
                          <LineItemRemoveButton
                            onClick={() => handleRemoveItem(index)}
                            loading={isRemovingFromCart[formData.items[index]?.product?.toString() || index]}
                            className="h-8 w-8 p-0 flex-shrink-0"
                          />
                        </div>
                      </div>

                      {/* Mobile Card Layout */}
                      <div className="md:hidden p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                        {/* Product Name and Delete Button Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {showProductImages && (
                              <LineItemThumbnail
                                src={product?.imageUrl}
                                size="md"
                                onClick={() => setPreviewImageProduct(product)}
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <LineItemSerial
                                  index={index}
                                  highlight={serialHighlight}
                                  variant="mobile"
                                />
                              </div>
                              <h5 className="font-medium text-sm text-gray-900 truncate">
                                {safeRender(product?.name) || 'Unknown Product'}
                              </h5>
                              {isLowStock && <span className="text-yellow-600 text-xs text-nowrap">⚠️ Low Stock</span>}
                            </div>
                            {isBelowCost && (
                                <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">
                                  ⚠️ Below Cost
                                </span>
                              )}
                          </div>
                          <LineItemRemoveButton
                            onClick={() => handleRemoveItem(index)}
                            loading={isRemovingFromCart[formData.items[index]?.product?.toString() || index]}
                            className="flex-shrink-0"
                            title="Remove Item"
                          />
                        </div>

                        {/* Details Grid */}
                        <div className={`grid gap-2 ${canViewStock ? 'grid-cols-4' : 'grid-cols-3'}`}>
                          {canViewStock && (
                            <div className="min-w-0">
                              <p className="text-[10px] text-gray-500 mb-1 truncate">Stock</p>
                              <p className="text-xs font-medium text-gray-900 text-center bg-gray-100 border border-gray-200 rounded h-8 flex items-center justify-center px-1">
                                {product?.inventory?.currentStock || 0}
                              </p>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 mb-1 truncate">Quantity</p>
                            <DualUnitQuantityInput
                              product={product}
                              quantity={item.quantity}
                              onChange={(newQuantity, dual) => {
                                if (newQuantity <= 0) {
                                  handleRemoveItem(index);
                                  return;
                                }
                                const stockCap = Number(product?.inventory?.currentStock ?? 0);
                                if (newQuantity > stockCap && stockCap >= 0) {
                                  toast.warning(`Warning: Quantity ${newQuantity} exceeds available stock ${stockCap}`, { duration: 3000, icon: '⚠️' });
                                }
                                setFormData(prev => ({
                                  ...prev,
                                  items: prev.items.map((itm, i) =>
                                    i === index
                                      ? { ...itm, quantity: newQuantity, ...(dual || {}), total: newQuantity * itm.unitPrice }
                                      : itm
                                  )
                                }));
                              }}
                              min={1}
                              max={undefined}
                              stockPiecesForRemaining={product?.inventory?.currentStock ?? 0}
                              showRemainingAfterSale={showRemainingStockAfterSaleEnabled}
                              showBoxInput={dualUnitShowBoxInputEnabled && !hasDualUnit(product)}
                              showPiecesInput={dualUnitShowPiecesInputEnabled}
                              showPiecesUnitLabel={false}
                              inputClassName="input text-center h-8 text-sm w-full px-1"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 mb-1 truncate">Rate</p>
                            <input
                              type="number"
                              step="0.01"
                              autoComplete="off"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const newPrice = parseFloat(e.target.value) || 0;
                                const costPrice = getSoLineEffectiveCost(item, lastPurchasePrices);

                                if (costPrice != null && newPrice < costPrice) {
                                  const loss = costPrice - newPrice;
                                  const lossPercent = ((loss / costPrice) * 100).toFixed(1);
                                  const shouldProceed = window.confirm(
                                    `⚠️ WARNING: Sale price (${newPrice}) is below cost price (${Math.round(costPrice)}).\n\n` +
                                    `Loss per unit: ${Math.round(loss)} (${lossPercent}%)\n` +
                                    `Total loss: ${Math.round(loss * item.quantity)}\n\n` +
                                    `Do you want to proceed?`
                                  );
                                  if (!shouldProceed) {
                                    return;
                                  }
                                }

                                setFormData(prev => ({
                                  ...prev,
                                  items: prev.items.map((itm, i) =>
                                    i === index ? { ...itm, unitPrice: newPrice, total: itm.quantity * newPrice } : itm
                                  )
                                }));
                              }}
                              onFocus={(e) => e.target.select()}
                              className={`input text-center h-8 text-sm w-full px-1 ${isBelowCost
                                ? 'border-red-500 bg-red-50'
                                : ''
                                }`}
                              min="0"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 mb-1 truncate">Total</p>
                            <p className="text-xs font-semibold text-gray-900 bg-gray-100 px-1 py-1 rounded border border-gray-200 text-center h-8 flex items-center justify-center">
                              {Math.round(totalPrice)}
                            </p>
                          </div>
                        </div>

                        {/* Cost Price (if shown) */}
                        {showCostPrice && canViewCostPrice && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Cost</p>
                            <p className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
                              {lineDisplayCost ?? 'N/A'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sales Order Details + checkout (same two-card layout as Sales) */}
      {formData.items.length > 0 && (
        <div
          className={`mt-4 grid w-full min-w-0 grid-cols-1 gap-4 overflow-x-hidden lg:gap-5 lg:items-start ${showSalesOrderDetailsFields ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
            }`}
        >
          <OrderCheckoutCard
            className={`mt-0 ml-0 max-w-none min-w-0 w-full border-slate-200 bg-none bg-slate-50 shadow-sm ring-0 ${showSalesOrderDetailsFields ? 'order-1' : 'order-2'
              }`}
          >
            <OrderDetailsSection
              detailsTitle="Sales Order Details"
              showDetails={showSalesOrderDetailsFields}
              onShowDetailsChange={setShowSalesOrderDetailsFields}
              checkboxId="showSalesOrderDetailsFields"
            >
              {showSalesOrderDetailsFields && (
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-end justify-end">
                  {/* Order Type */}
                  <div className="flex flex-col w-full sm:w-44">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Order Type
                    </label>
                    <select
                      value={formData.orderType}
                      onChange={(e) => setFormData(prev => ({ ...prev, orderType: e.target.value }))}
                      className="input h-8 text-sm"
                    >
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="return">Return</option>
                      <option value="exchange">Exchange</option>
                    </select>
                  </div>

                  {/* Order Number */}
                  <DocumentNumberField
                    id="soAutoGenerateInvoice"
                    label="Order Number"
                    manualPlaceholder="Enter order number"
                    autoGenerate={autoGenerateOrderNumber}
                    onAutoGenerateChange={(checked) => {
                      setAutoGenerateOrderNumber(checked);
                      if (checked) {
                        const newNumber = generateOrderNumber(selectedCustomer);
                        setFormData((prev) => ({ ...prev, orderNumber: newNumber }));
                      }
                    }}
                    value={formData.orderNumber}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, orderNumber: value }))
                    }
                    onRegenerate={() => {
                      const newNumber = generateOrderNumber(selectedCustomer);
                      setFormData((prev) => ({ ...prev, orderNumber: newNumber }));
                    }}
                    containerClassName="flex flex-col w-full sm:w-72"
                  />

                  <OrderNotesField
                    value={formData.notes}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, notes: value }))
                    }
                    containerClassName="flex flex-col w-full sm:w-[28rem]"
                  />
                </div>
              )}
            </OrderDetailsSection>
          </OrderCheckoutCard>

          <OrderCheckoutCard
            className={`mt-0 ml-0 max-w-none min-w-0 w-full border-slate-200 bg-none bg-slate-50 shadow-sm ring-0 ${showSalesOrderDetailsFields ? 'order-2' : 'order-1'
              }`}
          >
            <OrderSummaryBar>
              <div className="flex items-center gap-3">
                {selectedOrder ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={cancelEdit}
                      variant="ghost"
                      size="sm"
                      className="h-8 text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </Button>
                    <LoadingButton
                      onClick={handleUpdate}
                      isLoading={updating}
                      disabled={updating || formData.items.length === 0}
                      variant="default"
                      size="sm"
                      className="bg-slate-900 hover:bg-slate-800 text-white border-none h-8 px-4 font-bold"
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      {updating ? 'Updating...' : 'Update SO'}
                    </LoadingButton>
                  </div>
                ) : (
                  <Button
                    onClick={handleCreate}
                    disabled={creating || formData.items.length === 0}
                    variant="default"
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 text-white border-none h-8 px-4 font-bold"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    {creating ? 'Creating...' : 'Create SO'}
                  </Button>
                )}

                <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                  {formData.items.length > 0 && (
                    <Button
                      onClick={resetForm}
                      variant="ghost"
                      size="icon-sm"
                      className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      title="Clear Cart"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {formData.items.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          title="Print Options"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setDirectPrintOrder(buildDraftSalesOrderPrintOrder());
                          }}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Print
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePrint(buildDraftSalesOrderPrintOrder())}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Print Preview
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </OrderSummaryBar>
            <OrderSummaryContent className="bg-none bg-slate-50">
              <div className="space-y-2">
                {totalDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Discount:</span>
                    <span className="text-xl font-semibold tabular-nums text-red-600">-{Math.round(totalDiscount)}</span>
                  </div>
                )}
                {taxSystemEnabled && totalTax > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Tax ({globalTaxPct}%):</span>
                    <span className="text-xl font-semibold tabular-nums text-foreground">{Math.round(totalTax)}</span>
                  </div>
                )}
                {selectedCustomer && (() => {
                  const ledgerBalance = selectedCustomer.currentBalance !== undefined && selectedCustomer.currentBalance !== null
                    ? Number(selectedCustomer.currentBalance)
                    : ((selectedCustomer.pendingBalance || 0) - (selectedCustomer.advanceBalance || 0));
                  const receivedAmount = 0;
                  const invoiceBalance = total - receivedAmount;
                  const previousBalance = selectedOrder ? ledgerBalance - invoiceBalance : ledgerBalance;
                  const totalReceivables = selectedOrder ? ledgerBalance : ledgerBalance + invoiceBalance;

                  return (
                    <div className="mt-2">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-4 md:gap-4">
                        <div className="flex items-center justify-between md:block">
                          <span className="text-sm font-medium text-muted-foreground">Subtotal:</span>
                          <div className="text-2xl font-semibold tabular-nums text-foreground md:mt-1">{Math.round(subtotal)}</div>
                        </div>
                        <div className="flex items-center justify-between md:block">
                          <span className="text-sm font-medium text-muted-foreground">Net Amount:</span>
                          <div className="text-2xl font-bold tabular-nums text-primary md:mt-1">{Number(total.toFixed(2))}</div>
                        </div>
                        {(previousBalance !== 0 || selectedOrder) && (
                          <div className="flex items-center justify-between md:block">
                            <span className="text-sm font-medium text-muted-foreground">Previous Balance:</span>
                            <div className={`text-2xl font-semibold tabular-nums md:mt-1 ${previousBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {previousBalance < 0 ? '-' : '+'}{Math.abs(Number(previousBalance.toFixed(2)))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between md:block">
                          <span className={`text-sm font-semibold ${totalReceivables < 0 ? 'text-red-700' : 'text-green-700'}`}>
                            Total Receivables:
                          </span>
                          <div className={`text-2xl font-bold tabular-nums md:mt-1 ${totalReceivables < 0 ? 'text-red-700' : 'text-green-700'}`}>
                            {totalReceivables < 0 ? '-' : '+'}{Math.abs(Number(totalReceivables.toFixed(2)))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {!selectedCustomer && (
                  <div className="mt-2 flex items-center justify-between border-t pt-3">
                    <span className="text-lg font-semibold text-primary">Total:</span>
                    <span className="text-3xl font-bold tabular-nums text-primary">{Math.round(total)}</span>
                  </div>
                )}
              </div>

            </OrderSummaryContent>
          </OrderCheckoutCard>
        </div>
      )}

      {/* Results: single header row — title, filters, actions */}
      <div className="card">
        <div className="card-header py-3">
          <div className="flex flex-col gap-3">
            {/* Row 1: Title, Records (desktop), and Refresh */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Sales Orders</h3>
                <span className="hidden sm:inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {paginationInfo.totalItems ?? paginationInfo.total ?? salesOrders.length} records
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="p-2 text-gray-400 transition-colors hover:text-gray-600 hover:bg-gray-100 rounded-full"
                  title="Refresh"
                >
                  {isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Content Row: Date, Toggle, Actions (One row on mobile/desktop) */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                {/* Primary Row: Date and All Action Buttons */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <DateFilter
                      startDate={filters.fromDate}
                      endDate={filters.toDate}
                      onDateChange={(start, end) => {
                        handleFilterChange('fromDate', start);
                        handleFilterChange('toDate', end);
                      }}
                      compact={true}
                      showPresets={true}
                      showLabel={false}
                    />
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowMobileFilters(!showMobileFilters)}
                      className={`h-10 w-10 p-0 lg:hidden border-gray-200 ${showMobileFilters ? 'bg-gray-100' : ''}`}
                      title="More Filters"
                    >
                      <Filter className={`h-4 w-4 ${showMobileFilters ? 'text-primary-600' : 'text-gray-500'}`} />
                    </Button>

                    <ExcelExportButton 
                      ref={excelExportRef}
                      getData={getExportData} 
                      label="" 
                      className="h-10 w-10 p-0 hidden sm:flex"
                    />
                    <PdfExportButton 
                      ref={pdfExportRef}
                      getData={getExportData} 
                      label="" 
                      className="h-10 w-10 p-0 hidden sm:flex"
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-10 w-10 p-0 sm:hidden border-gray-200"
                        >
                          <MoreHorizontal className="h-4 w-4 text-gray-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); excelExportRef.current?.handleExport(); }}>
                          <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                          Export to Excel
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); pdfExportRef.current?.handleExport(); }}>
                          <FileText className="h-4 w-4 mr-2 text-red-600" />
                          Export to PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      type="button"
                      variant="default"
                      onClick={() => refetch()}
                      className="h-10 px-3 sm:px-5 bg-slate-900 hover:bg-slate-800"
                    >
                      <span className="hidden sm:inline">Search</span>
                      <Search className="h-4 w-4 sm:hidden" />
                    </Button>
                  </div>
                </div>

                {/* Collapsible Filters: Search and Status Select */}
                <div className={`${showMobileFilters ? 'flex' : 'hidden'} lg:flex flex-col sm:flex-row items-center gap-2 flex-1`}>
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="so-list-order-number"
                      type="text"
                      placeholder="Order # / customer…"
                      value={filters.orderNumber}
                      onChange={(e) => handleFilterChange('orderNumber', e.target.value)}
                      className="input h-10 w-full pl-9 bg-gray-50 border-gray-200 focus:bg-white text-sm"
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <select
                      id="so-list-status"
                      value={filters.status}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                      className="input h-10 w-full bg-gray-50 border-gray-200 text-sm"
                    >
                      <option value="">All Statuses</option>
                      <option value="draft">Pending</option>
                      <option value="confirmed">Order confirmed</option>
                      <option value="partially_invoiced">Partially Invoiced</option>
                      <option value="fully_invoiced">Fully Invoiced</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="card-content p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <LoadingInline message="Loading sales orders..." />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <p>Error loading sales orders: {handleApiError(error).message}</p>
            </div>
          ) : salesOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No sales orders found for the selected criteria.</p>
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesOrders.map((order, index) => (
                      <tr key={order?.id ?? order?._id ?? `so-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(order?.order_date ?? order?.orderDate ?? order?.createdAt ?? order?.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {order?.so_number ?? order?.soNumber ?? order?.invoiceNumber ?? '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getCustomerDisplayName(order?.customer, 'Walk-in')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                          {order?.order_type ?? order?.orderType ?? '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {(() => {
                              const pres = getSalesOrderStatusPresentation(order);
                              return (
                                <>
                                  {pres.icon}
                                  <span className="text-sm">{pres.label}</span>
                                </>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(() => {
                            const items = Array.isArray(order?.items) ? order.items : [];
                            const fromItems = items.length > 0
                              ? items.reduce((sum, i) => sum + (Number(i.totalPrice ?? i.total ?? 0) || (Number(i.quantity || 0) * Number(i.unitPrice ?? i.unit_price ?? 0))), 0)
                              : null;
                            const stored = order?.total ?? order?.pricing?.total ?? 0;
                            return Math.round(fromItems != null && fromItems > 0 ? fromItems : stored);
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setNotesEntity({ type: 'SalesOrder', id: order?.id ?? order?._id, name: order?.so_number ?? order?.soNumber });
                                setShowNotes(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Notes"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handlePrint(order)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Print"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <ExcelExportButton
                              getData={async () => {
                                const printPerms = getPartyPermissions('customer');
                                try {
                                  const result = await fetchSalesOrderById(order.id || order._id).unwrap();
                                  const freshOrder = result?.order || result?.data?.salesOrder || result?.data || result || order;
                                  const payload = getInvoicePdfPayload(freshOrder, companySettings, 'Sales Order', 'Customer', null, printPerms);
                                  return {
                                    ...payload,
                                    filename: `Sales_Order_${order.soNumber || order.orderNumber || order._id}.xlsx`
                                  };
                                } catch (err) {
                                  return {
                                    ...getInvoicePdfPayload(order, companySettings, 'Sales Order', 'Customer', null, printPerms),
                                    filename: `Sales_Order_${order.soNumber || order.orderNumber || order._id}.xlsx`
                                  };
                                }
                              }}
                              label=""
                              className="p-1 bg-transparent border-none shadow-none hover:bg-transparent text-green-600 hover:text-green-800 px-1 py-1"
                            />
                            <PdfExportButton
                              getData={async () => {
                                const printPerms = getPartyPermissions('customer');
                                try {
                                  const result = await fetchSalesOrderById(order.id || order._id).unwrap();
                                  const freshOrder = result?.order || result?.data?.salesOrder || result?.data || result || order;
                                  return getInvoicePdfPayload(freshOrder, companySettings, 'Sales Order', 'Customer', null, printPerms);
                                } catch (err) {
                                  return getInvoicePdfPayload(order, companySettings, 'Sales Order', 'Customer', null, printPerms);
                                }
                              }}
                              label=""
                              className="p-1 bg-transparent border-none shadow-none hover:bg-transparent text-red-600 hover:text-red-800 px-1 py-1"
                            />
                            {getSalesOrderInvoiceCompleteAction(order) && (
                              <LoadingButton
                                type="button"
                                onClick={() => completeSalesOrderToFullInvoice(order)}
                                isLoading={updatingItemsConfirmation || creatingInvoiceFromSO}
                                size="icon-sm"
                                iconOnly
                                variant="ghost"
                                className="text-teal-600 hover:text-teal-900 shrink-0"
                                title={
                                  getSalesOrderInvoiceCompleteAction(order) === 'createInvoice'
                                    ? 'Create sales invoice (fully invoiced)'
                                    : 'Convert to full invoice'
                                }
                                disabled={updatingItemsConfirmation || creatingInvoiceFromSO}
                              >
                                <Receipt className="h-4 w-4" />
                              </LoadingButton>
                            )}
                            {order.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => handleEdit(order)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <LoadingButton
                                  onClick={() => handleConfirm(order?.id ?? order?._id)}
                                  isLoading={confirming}
                                  size="icon-sm"
                                  iconOnly
                                  variant="ghost"
                                  className="text-green-600 hover:text-green-900 shrink-0"
                                  title="Confirm & create sales invoice (this becomes a Sale)"
                                  disabled={confirming}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </LoadingButton>
                                <LoadingButton
                                  onClick={() => handleCancel(order?.id ?? order?._id)}
                                  isLoading={cancelling}
                                  size="icon-sm"
                                  iconOnly
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-900 shrink-0"
                                  title="Cancel Order"
                                  disabled={cancelling}
                                >
                                  <XCircle className="h-4 w-4" />
                                </LoadingButton>
                              </>
                            )}
                            {order.status === 'draft' && (
                              <LoadingButton
                                onClick={() => handleDelete(order)}
                                isLoading={deleting}
                                size="icon-sm"
                                iconOnly
                                variant="ghost"
                                className="text-red-600 hover:text-red-900 shrink-0"
                                title="Delete"
                                disabled={deleting}
                              >
                                <Trash2 className="h-4 w-4" />
                              </LoadingButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                page={Number(paginationInfo.current ?? pagination.page) || 1}
                totalPages={Math.max(1, Number(paginationInfo.pages) || 1)}
                onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
                totalItems={paginationInfo.total}
                limit={pagination.limit}
              />
            </>
          )}
        </div>
      </div>

      {/* View Modal - Bill Format */}
      <BaseModal
        isOpen={showViewModal && !!selectedOrder}
        onClose={() => {
          setShowViewModal(false);
          setSelectedOrder(null);
          setSelectedItemIndices([]);
        }}
        title="Sales Order"
        maxWidth="2xl"
        variant="scrollable"
        contentClassName="p-5"
        footer={
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 w-full">
            <div className="text-xs text-gray-500">
              Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {selectedOrder && getSalesOrderInvoiceCompleteAction(selectedOrder) && (
                <LoadingButton
                  type="button"
                  onClick={() => completeSalesOrderToFullInvoice(selectedOrder)}
                  isLoading={updatingItemsConfirmation || creatingInvoiceFromSO}
                  disabled={updatingItemsConfirmation || creatingInvoiceFromSO}
                  className="inline-flex items-center bg-teal-600 hover:bg-teal-700 text-white"
                  title={
                    getSalesOrderInvoiceCompleteAction(selectedOrder) === 'createInvoice'
                      ? 'Create sales invoice (fully invoiced)'
                      : 'Convert to full invoice'
                  }
                >
                  <Receipt className="h-4 w-4 mr-2 shrink-0" />
                  {getSalesOrderInvoiceCompleteAction(selectedOrder) === 'createInvoice'
                    ? 'Create sales invoice'
                    : 'Convert to full invoice'}
                </LoadingButton>
              )}
              <Button
                type="button"
                onClick={() => handlePrint(selectedOrder)}
                variant="default"
                className="inline-flex items-center"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedOrder(null);
                  setSelectedItemIndices([]);
                }}
                variant="secondary"
              >
                Close
              </Button>
            </div>
          </div>
        }
      >
        {selectedOrder && (
          <>
            {/* Company Info */}
            <div className="mb-6 text-center">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{resolvedCompanyName}</h4>
              {resolvedCompanyAddress && (
                <p className="text-sm text-gray-600">{resolvedCompanyAddress}</p>
              )}
              {resolvedCompanyPhone && (
                <p className="text-sm text-gray-600">Phone: {resolvedCompanyPhone}</p>
              )}
            </div>

            {/* SO Details */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h5 className="font-semibold text-gray-900 mb-2">Sales Order Details</h5>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">SO Number:</span> {selectedOrder.soNumber}</p>
                  <p><span className="font-medium">Date:</span> {formatDate(selectedOrder.createdAt)}</p>
                  <p><span className="font-medium">Order Type:</span> {selectedOrder.orderType || 'Standard'}</p>
                  <p><span className="font-medium">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${selectedOrder.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      selectedOrder.status === 'confirmed' ? 'bg-amber-100 text-amber-900' :
                        selectedOrder.status === 'partially_invoiced' ? 'bg-yellow-100 text-yellow-800' :
                          selectedOrder.status === 'fully_invoiced' ? 'bg-green-100 text-green-800' :
                            selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                      }`}>
                      {getSalesOrderStatusPresentation(selectedOrder).label}
                    </span>
                  </p>
                  {itemWiseConfirmationEnabled && (
                    <p><span className="font-medium">Confirmation:</span>
                      <OrderConfirmationStatusBadge order={selectedOrder} />
                    </p>
                  )}
                  {selectedOrder.expectedDelivery && (
                    <p><span className="font-medium">Expected Delivery:</span> {formatDate(selectedOrder.expectedDelivery)}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <h5 className="font-semibold text-gray-900 mb-2">Customer Details</h5>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Customer:</span> {getCustomerDisplayName(selectedOrder.customer, 'Walk-in')}</p>
                  {selectedOrder.customer?.email && (
                    <p><span className="font-medium">Email:</span> {safeRender(selectedOrder.customer.email)}</p>
                  )}
                  {selectedOrder.customer?.phone && (
                    <p><span className="font-medium">Phone:</span> {safeRender(selectedOrder.customer.phone)}</p>
                  )}
                  <p><span className="font-medium">Address:</span> {formatAddressForDisplay(selectedOrder.customer) || '—'}</p>
                  {selectedOrder.customer?.contactPerson && (
                    <p><span className="font-medium">Contact:</span> {safeRender(selectedOrder.customer.contactPerson)}</p>
                  )}
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <p className={`font-semibold ${(() => {
                      const customer = selectedOrder.customer || {};
                      const totalBalance = customer.currentBalance !== undefined
                        ? customer.currentBalance
                        : ((customer.pendingBalance || 0) - (customer.advanceBalance || 0));
                      return totalBalance < 0 ? 'text-red-600' : 'text-green-600';
                    })()}`}>
                      <span className="font-medium">Total Balance:</span> {(() => {
                        const customer = selectedOrder.customer || {};
                        const totalBalance = customer.currentBalance !== undefined
                          ? customer.currentBalance
                          : ((customer.pendingBalance || 0) - (customer.advanceBalance || 0));
                        return totalBalance < 0 ? '-' : '+';
                      })()}{Math.abs(Math.round((() => {
                        const customer = selectedOrder.customer || {};
                        return customer.currentBalance !== undefined
                          ? customer.currentBalance
                          : ((customer.pendingBalance || 0) - (customer.advanceBalance || 0));
                      })()))}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-6">
              <h5 className="font-semibold text-gray-900 mb-3">Items Ordered</h5>
              {itemWiseConfirmationEnabled && (
                <OrderConfirmSelectedActions
                  items={selectedOrder.items}
                  canEdit={selectedOrder.status !== 'cancelled'}
                  selectedIndices={selectedItemIndices}
                  onSelectAll={(indices) => setSelectedItemIndices(indices)}
                  onSelectNone={() => setSelectedItemIndices([])}
                  onConfirmSelected={(indices) => {
                    if (indices.length) {
                      handleUpdateItemsConfirmation(
                        indices.map((i) => ({ itemIndex: i, confirmationStatus: 'confirmed' })),
                        false,
                        false
                      );
                    }
                  }}
                  isUpdating={updatingItemsConfirmation}
                />
              )}
              <div className="table-scroll">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                        Product
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                        Total Price
                      </th>
                      {itemWiseConfirmationEnabled && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                          Confirmation
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedOrder.items && selectedOrder.items.map((item, index) => (
                      <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${(item.confirmationStatus ?? item.confirmation_status) === 'cancelled' ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                          <div>
                            <div className="font-medium">
                              {typeof item.product === 'object' && item.product !== null
                                ? getProductDisplayName(item.product, 'Unknown Product')
                                : (getProductDisplayName(item.productData, safeRender(item.product) || 'Unknown Product'))}
                            </div>
                            {item.product?.description && (
                              <div className="text-gray-500 text-xs">{safeRender(item.product.description)}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right border-b border-gray-200">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right border-b border-gray-200">
                          {Math.round(item.unitPrice || item.price || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right border-b border-gray-200">
                          {Math.round(item.totalPrice || (item.quantity * (item.unitPrice || item.price || 0)))}
                        </td>
                        {itemWiseConfirmationEnabled && (
                          <td className="px-4 py-3 text-sm border-b border-gray-200">
                            <OrderItemConfirmationCell
                              item={item}
                              itemIndex={index}
                              status={getItemConfirmationStatus(item)}
                              canEdit={selectedOrder.status !== 'cancelled'}
                              selected={selectedItemIndices.includes(index)}
                              onToggleSelect={toggleItemSelection}
                              onCancel={(idx) => handleUpdateItemsConfirmation([{ itemIndex: idx, confirmationStatus: 'cancelled' }], false, false)}
                              isUpdating={updatingItemsConfirmation}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-80">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{Math.round(selectedOrder.subtotal || 0)}</span>
                  </div>
                  {taxSystemEnabled &&
                    Number(selectedOrder.tax ?? selectedOrder.pricing?.taxAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax:</span>
                        <span className="font-medium">
                          {Math.round(Number(selectedOrder.tax ?? selectedOrder.pricing?.taxAmount ?? 0))}
                        </span>
                      </div>
                    )}
                  {selectedOrder.discount && selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount:</span>
                      <span className="font-medium text-green-600">-{Math.round(selectedOrder.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">SO Total:</span>
                    <span className="font-medium">{Math.round(selectedOrder.total || 0)}</span>
                  </div>
                  <div className="border-t border-gray-200 my-2 pt-2">
                    {(() => {
                      const customer = selectedOrder.customer || {};
                      const currentBal = customer.currentBalance !== undefined
                        ? customer.currentBalance
                        : ((customer.pendingBalance || 0) - (customer.advanceBalance || 0));

                      const orderTotal = selectedOrder.total || 0;
                      const paid = selectedOrder.payment?.amountPaid || 0;
                      // For legacy/simple orders without payment obj, assume unpaid if no payment info
                      const remaining = selectedOrder.payment?.remainingBalance ?? (orderTotal - paid);

                      const isDraft = ['draft', 'cancelled'].includes(selectedOrder.status);

                      // If draft, currentBal doesn't include this order yet -> Previous = Current
                      // If confirmed, currentBal includes this order -> Previous = Current - Remaining
                      const prevBal = isDraft ? currentBal : (currentBal - remaining);
                      const totalBal = isDraft ? (currentBal + remaining) : currentBal;

                      return (
                        <>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Previous Balance:</span>
                            <span className={`font-medium ${prevBal < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {prevBal < 0 ? '-' : '+'}{Math.round(Math.abs(prevBal))}
                            </span>
                          </div>
                          <div className="flex justify-between text-lg font-bold">
                            <span className="text-gray-900">Total Balance:</span>
                            <span className={`${totalBal < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {totalBal < 0 ? '-' : '+'}{Math.round(Math.abs(totalBal))}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            {selectedOrder.paymentMethod && (
              <div className="mb-6">
                <h5 className="font-semibold text-gray-900 mb-2">Payment Information</h5>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Payment Method:</span> {safeRender(selectedOrder.paymentMethod)}</p>
                  {selectedOrder.paymentStatus && (
                    <p><span className="font-medium">Payment Status:</span> {safeRender(selectedOrder.paymentStatus)}</p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedOrder.notes && (
              <div className="mb-6">
                <h5 className="font-semibold text-gray-900 mb-2">Notes</h5>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                  {safeRender(selectedOrder.notes)}
                </p>
              </div>
            )}

            {/* Terms */}
            {selectedOrder.terms && (
              <div className="mb-6">
                <h5 className="font-semibold text-gray-900 mb-2">Terms & Conditions</h5>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                  {safeRender(selectedOrder.terms)}
                </p>
              </div>
            )}

          </>
        )}
      </BaseModal>



      {/* Out-of-stock warning modal (before confirm) */}
      <BaseModal
        isOpen={showOutOfStockModal && outOfStockItems.length > 0}
        onClose={() => {
          setShowOutOfStockModal(false);
          setOutOfStockItems([]);
          setPendingConfirmId(null);
        }}
        title="Products out of stock"
        subtitle="The following products have insufficient stock. Confirmation will fail unless you add stock first."
        maxWidth="md"
        variant="centered"
        contentClassName="p-6 pt-2"
        headerExtra={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
        }
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowOutOfStockModal(false);
                setOutOfStockItems([]);
                setPendingConfirmId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmProceedAnyway}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Proceed anyway
            </Button>
          </div>
        }
      >
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {outOfStockItems.map((item, idx) => (
            <li key={idx} className="flex justify-between gap-2 text-sm bg-red-50 px-3 py-2 rounded border border-red-100">
              <span className="font-medium text-gray-900">{item.productName}</span>
              <span className="text-red-600 shrink-0 text-right">
                Need: {item.requestedQty} | Available: {item.availableStock}
              </span>
            </li>
          ))}
        </ul>
      </BaseModal>

      {directPrintOrder && (
        <DirectPrintInvoice
          orderData={directPrintOrder}
          documentTitle="Sales Order"
          partyLabel="Customer"
          onComplete={() => setDirectPrintOrder(null)}
        />
      )}

      <PrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setPrintOrderData(null);
        }}
        orderData={printOrderData}
        documentTitle="Sales Order"
        partyLabel="Customer"
      />

      {/* Notes Panel */}
      {showNotes && notesEntity && (
        <NotesPanel
          entityType={notesEntity.type}
          entityId={notesEntity.id}
          entityName={notesEntity.name}
          onClose={() => {
            setShowNotes(false);
            setNotesEntity(null);
          }}
        />
      )}

      <DuplicateLineItemMergeModal
        isOpen={!!soDuplicateMerge}
        onClose={() => {
          const src = soDuplicateMerge?.source;
          setSoDuplicateMerge(null);
          refocusSoProductSearch(src);
        }}
        onConfirm={handleSoDuplicateMergeConfirm}
        productName={soDuplicateMerge?.displayName ?? ''}
        currentQuantity={soDuplicateMerge?.currentQuantity ?? 0}
        quantityToAdd={soDuplicateMerge?.addQuantity ?? 0}
        newTotalQuantity={
          (soDuplicateMerge?.currentQuantity ?? 0) + (soDuplicateMerge?.addQuantity ?? 0)
        }
        title="Duplicate product"
        scopeLabel="sales order"
        confirmText="Update quantity"
      />

      <ProductImagePreviewModal
        product={previewImageProduct}
        onClose={() => setPreviewImageProduct(null)}
      />

      <DeleteConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        itemName={deleteConfirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Sales Order"
        isLoading={deleteConfirmation.isLoading}
      />

    </PageLayout>
  );
};

export default SalesOrders;