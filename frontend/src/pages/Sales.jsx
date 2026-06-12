import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ShoppingCart,
  Search,
  Filter,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  TrendingUp,
  Receipt,
  Edit,
  Printer,
  RefreshCw,
  Eye,
  XCircle,
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import BaseModal from '../components/BaseModal';
import { useLazyGetLastPurchasePriceQuery, useGetLastPurchasePricesMutation } from '../store/services/productsApi';
import { useGetCustomerQuery } from '../store/services/customersApi';
import { useDebouncedCustomerSearch } from '../hooks/useDebouncedCustomerSearch';
import {
  useCreateSaleMutation,
  useGetOrdersQuery,
  useLazyGetOrdersQuery,
  useLazyGetOrderByIdQuery,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
  useLazyGetLastPricesQuery,

} from '../store/services/salesApi';
import { useCheckApplicableDiscountsMutation } from '../store/services/discountsApi';
import { useGetBanksQuery } from '../store/services/banksApi';
import { DualUnitQuantityInput } from '../components/DualUnitQuantityInput';
import {
  usePostJournalMutation,
  useGetTrialBalanceQuery,
  useGetUnifiedBalanceQuery
} from '../store/services/accountingApi';
import {
  hasDualUnit,
  getPiecesPerBox,
  piecesToBoxesAndPieces,
  computeTotalPieces,
  formatStockDualLabel,
} from '../utils/dualUnitUtils';
import { handleApiError, showSuccessToast, showErrorToast, getErrorMessage } from '../utils/errorHandler';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  OrderCheckoutCard,
  OrderDetailsSection,
  OrderSummaryContent,
  OrderSummaryBar,
  OrderInsetPanel,
  OrderCheckoutActions,
} from '../components/order/OrderCheckoutLayout';
import { ProductSelectionCartSection } from '../components/order/ProductSelectionCartSection';
import { CartItemsTableSection } from '../components/order/CartItemsTableSection';
import { CartTableHeader } from '../components/order/CartTableHeader';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import AsyncErrorBoundary from '../components/AsyncErrorBoundary';
import { PageLayout } from '../components/layout/PageLayout';
import { ClearConfirmationDialog } from '../components/ConfirmationDialog';
import { useClearConfirmation } from '../hooks/useConfirmation';
import PaymentModal from '../components/PaymentModal';
import PrintModal, { DirectPrintInvoice } from '../components/PrintModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useResponsive, ResponsiveGrid } from '../components/ResponsiveContainer';
import { useTab } from '../contexts/TabContext';
import { useAuth } from '../contexts/AuthContext';
import { useSensitiveDataPermissions } from '../hooks/useSensitiveDataPermissions';
import { useCompanyInfo } from '../hooks/useCompanyInfo';

import { PERMISSIONS } from '../config/rbacConfig';
import { getLocalDateString, getCurrentDatePakistan } from '../utils/dateUtils';
import { formatDate } from '../utils/formatters';
import { getCustomerDisplayName, getProductDisplayName } from '../utils/partyDisplay';
import DateFilter from '../components/DateFilter';
import PaginationControls from '../components/PaginationControls';
import ExcelExportButton from '../components/ExcelExportButton';
import PdfExportButton from '../components/PdfExportButton';
import { getInvoicePdfPayload } from '../utils/invoicePdfUtils';
import { buildCartInvoiceOrder } from '../utils/buildCartInvoiceOrder';
import {
  computeLedgerPrintBalances,
  computePostSaveLedgerBalance,
  computePostSavePreviousBalance,
} from '../utils/printBalanceUtils';
import { accountingApi } from '../store/services/accountingApi';
import WhatsAppShareButton from '../components/invoice/WhatsAppShareButton';

import { ProductSearch } from '../components/sales/ProductSearch';
import { DuplicateLineItemMergeModal } from '../components/order/DuplicateLineItemMergeModal';
import { ProductImagePreviewModal } from '../components/order/ProductImagePreviewModal';
import { DocumentNumberField } from '../components/order/DocumentNumberField';
import { CustomerPartySelect, CustomerBalanceStrip } from '../components/order/CustomerPartySelect';
import { OrderNotesField } from '../components/order/OrderNotesField';
import { ApplyLastPricesButton, LastPricesStatusLegend } from '../components/order/ApplyLastPricesButton';
import { PaymentMethodSelect } from '../components/order/PaymentMethodSelect';
import { CostPriceToggleButton, ProfitToggleButton } from '../components/order/CostPriceToggleButton';
import {
  LineItemSerial,
  LineItemThumbnail,
  LineItemStockCell,
  LineItemTotalCell,
  LineItemRemoveButton,
  LineItemBoxInputCell,
  LineItemPriceStatusBadge,
  LineItemPriceStatusIcon,
  priceStatusInputClasses,
} from '../components/order/CartLineItemAtoms';
import { useApplyLastPrices } from '../hooks/useApplyLastPrices';
import { computeSalesCheckoutPricing } from '../utils/orderPricing';
import { PriceTypeSelector } from '../components/order/PriceTypeSelector';
import {
  deriveInitialPriceType,
  mapPriceTypeToOrderType,
  normalizePriceType,
  priceTypeFromBusinessType,
  resolveOrderTypeForSave,
} from '../utils/priceTypeUtils';
import {
  getProductCostPrice,
  getProductDisplayCostPrice,
  getEffectiveCostForLossCheck,
} from '../utils/productCostUtils';

function normalizeCartProductId(product) {
  if (!product) return '';
  const id = product._id ?? product.id;
  return id != null ? String(id) : '';
}

function getCartLineLastPurchasePrice(product, lastPurchasePrices) {
  const id = normalizeCartProductId(product);
  if (!id || lastPurchasePrices[id] === undefined) return null;
  const value = Number(lastPurchasePrices[id]);
  return Number.isFinite(value) ? value : null;
}

function getCartLineEffectiveCost(product, lastPurchasePrices) {
  return getEffectiveCostForLossCheck(
    product,
    getCartLineLastPurchasePrice(product, lastPurchasePrices)
  );
}

/** Cart → print payload: names, optional manual photo, dual-unit qty for invoice/PDF. */
function mapCartItemsForInvoicePrint(cart) {
  if (!Array.isArray(cart)) return [];
  return cart.map((item) => {
    const p = item.product || {};
    const line = {
      product: {
        name: p.name,
        ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
      },
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      name: p.name,
    };
    if (p.imageUrl) line.imageUrl = p.imageUrl;
    if (item.boxes != null || item.pieces != null) {
      line.boxes = item.boxes;
      line.pieces = item.pieces;
    }
    return line;
  });
}

export const Sales = ({ tabId, editData }) => {
  const dispatch = useDispatch();

  // Store refetch function from ProductSearch component
  const [refetchProducts, setRefetchProducts] = useState(null);

  const [cart, setCart] = useState([]);
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const [duplicateCartMerge, setDuplicateCartMerge] = useState(null);
  /** Remount ProductSearch after merging duplicate lines so its internal form resets. */
  const [productSearchResetKey, setProductSearchResetKey] = useState(0);
  const productSearchFocusFnRef = useRef(null);
  const handleProductSearchFocusReady = useCallback((fn) => {
    productSearchFocusFnRef.current = fn;
  }, []);
  const refocusProductSearch = useCallback(() => {
    setTimeout(() => productSearchFocusFnRef.current?.(), 60);
  }, []);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [directPrintOrder, setDirectPrintOrder] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [appliedDiscounts, setAppliedDiscounts] = useState([]);
  const [directDiscount, setDirectDiscount] = useState({ type: 'amount', value: 0 });
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(true);
  const [showSalesDetailsFields, setShowSalesDetailsFields] = useState(false);
  const [billDate, setBillDate] = useState(getLocalDateString()); // Default to current date for backdating invoices
  const [notes, setNotes] = useState('');
  // Apply / Restore "last prices" state lives in `useApplyLastPrices` below.
  const [isClearingCart, setIsClearingCart] = useState(false);
  const [isRemovingFromCart, setIsRemovingFromCart] = useState({});
  const [previewImageProduct, setPreviewImageProduct] = useState(null);
  const [showCostPrice, setShowCostPrice] = useState(false); // Toggle to show/hide cost prices
  const [showProductImages, setShowProductImages] = useState(localStorage.getItem('showProductImagesUI') !== 'false');
  const [savedInvoiceSearchTerm, setSavedInvoiceSearchTerm] = useState('');
  const [savedInvoiceStatus, setSavedInvoiceStatus] = useState('');
  const excelExportRef = useRef(null);
  const pdfExportRef = useRef(null);
  const [savedInvoiceFromDate, setSavedInvoiceFromDate] = useState(() => getCurrentDatePakistan());
  const [savedInvoiceToDate, setSavedInvoiceToDate] = useState(() => getCurrentDatePakistan());
  const [savedInvoicePage, setSavedInvoicePage] = useState(1);
  const savedInvoiceLimit = 20;
  const [showSavedInvoicePrintModal, setShowSavedInvoicePrintModal] = useState(false);
  const [savedInvoicePrintOrder, setSavedInvoicePrintOrder] = useState(null);
  const [inlineEditData, setInlineEditData] = useState(null);
  const [invoiceDeleteTarget, setInvoiceDeleteTarget] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const activeEditData = inlineEditData?.isEditMode ? inlineEditData : editData;
  /** Net − paid when the invoice was loaded into edit mode; drives live balance preview. */
  const [editSavedInvoiceRemaining, setEditSavedInvoiceRemaining] = useState(null);

  useEffect(() => {
    const handleConfigChange = () => {
      setShowProductImages(localStorage.getItem('showProductImagesUI') !== 'false');
    };
    window.addEventListener('productImagesConfigChanged', handleConfigChange);
    return () => window.removeEventListener('productImagesConfigChanged', handleConfigChange);
  }, []);

  const [lastPurchasePrices, setLastPurchasePrices] = useState({}); // Store last purchase prices for products
  const [priceType, setPriceType] = useState('wholesale'); // Price type: 'retail' or 'wholesale' or 'custom'


  // Calculate default date range (one month ago to today)

  const { isMobile, isTablet } = useResponsive();
  const { activeTabId, updateTabTitle, getActiveTab } = useTab();
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const { getPartyPermissions } = useSensitiveDataPermissions();
  const { companyInfo: companySettings } = useCompanyInfo();

  const allowSaleWithoutProductEnabled = companySettings.orderSettings?.allowSaleWithoutProduct === true;
  const allowManualCostPriceEnabled = companySettings.orderSettings?.allowManualCostPrice === true;
  const globalShowCostPriceAllowed = companySettings.orderSettings?.showCostPrice !== false && hasPermission(PERMISSIONS.VIEW_PRODUCT_COSTS);

  const dualUnitShowBoxInputEnabled = companySettings.orderSettings?.dualUnitShowBoxInput === true;
  const dualUnitShowPiecesInputEnabled = companySettings.orderSettings?.dualUnitShowPiecesInput !== false;
  const showSalesDiscountCodeEnabled = companySettings.orderSettings?.showSalesDiscountCode === true;
  const autoPrintEnabled = companySettings.printSettings?.autoPrintAfterSale !== false;
  const taxSystemEnabled = companySettings.taxEnabled === true;
  const globalTaxPercent = Math.min(100, Math.max(0, Number(companySettings.defaultTaxRate ?? 0)));
  const [showProfit, setShowProfit] = useState(false);

  // Sync state with global setting if it changes
  useEffect(() => {
    if (!globalShowCostPriceAllowed) {
      setShowCostPrice(false);
    }
  }, [globalShowCostPriceAllowed]);
  const totalProfit = useMemo(() => {
    if (!Array.isArray(cart) || cart.length === 0) return 0;

    return cart.reduce((sum, item) => {
      if (!item?.product) return sum;

      const productId = item.product._id ?? item.product.id;
      const quantity = Number(item.quantity) || 0;
      const salePrice = Number(item.unitPrice) || 0;

      const catalogCost = getProductCostPrice(item.product);
      const profitPerUnit = salePrice - (Number.isFinite(catalogCost) ? catalogCost : 0);
      const lineProfit = profitPerUnit * quantity;

      return sum + (Number.isFinite(lineProfit) ? lineProfit : 0);
    }, 0);
  }, [cart]);

  // Generate invoice number
  const generateInvoiceNumber = (customer) => {
    const customerId = customer?.id || customer?._id;
    if (!customerId) return '';

    // Check if sequential numbering is enabled
    const orderSettings = companySettings.orderSettings || {};
    if (orderSettings.invoiceSequenceEnabled) {
      const prefix = orderSettings.invoiceSequencePrefix || 'INV-';
      const nextNum = orderSettings.invoiceSequenceNext || 1;
      const padding = orderSettings.invoiceSequencePadding || 3;
      return `${prefix}${String(nextNum).padStart(padding, '0')}`;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getTime()).slice(-4); // Last 4 digits of timestamp

    // Format: CUSTOMER-INITIALS-YYYYMMDD-XXXX (displayName may be missing from API; use businessName/name fallback)
    const nameStr = getCustomerDisplayName(customer, 'CUST');
    const customerInitials = String(nameStr)
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3) || 'CUS';

    return `INV-${customerInitials}-${year}${month}${day}-${time}`;
  };

  // Handle edit data when component is opened for editing
  useEffect(() => {
    if (activeEditData && activeEditData.isEditMode && activeEditData.orderId) {
      // Set the customer
      if (activeEditData.customer) {
        setSelectedCustomer(activeEditData.customer);
        setCustomerSearchTerm(getCustomerDisplayName(activeEditData.customer, ''));
      }

      // Set the invoice number
      if (activeEditData.orderNumber) {
        setInvoiceNumber(activeEditData.orderNumber);
        setAutoGenerateInvoice(false); // Don't auto-generate when editing
      }

      // Set the notes
      if (activeEditData.notes) {
        setNotes(activeEditData.notes);
      }

      // Set the cart items
      if (activeEditData.items && activeEditData.items.length > 0) {
        const formattedItems = activeEditData.items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice || item.price || (item.product?.pricing?.retail || 0),
          totalPrice: item.totalPrice || (item.quantity * (item.unitPrice || item.price || (item.product?.pricing?.retail || 0)))
        }));
        setCart(formattedItems);
      }

      // Restore existing discounts in edit mode (code + manual)
      const rawAppliedDiscounts = Array.isArray(activeEditData.appliedDiscounts)
        ? activeEditData.appliedDiscounts
        : Array.isArray(activeEditData.applied_discounts)
          ? activeEditData.applied_discounts
          : [];
      const hydratedAppliedDiscounts = rawAppliedDiscounts
        .map((d) => ({
          code: String(d.code || d.discountCode || d.discount_code || '').trim(),
          amount: Number(d.amount ?? 0) || 0,
          discountId: d.discountId || d.discount_id || d.id || d._id || null,
          type: d.type,
          value: d.value
        }))
        .filter((d) => d.code);
      setAppliedDiscounts(hydratedAppliedDiscounts);

      const invoiceDiscountRaw = Number(
        activeEditData.discountAmount ??
        activeEditData.discount ??
        activeEditData.pricing?.discountAmount ??
        activeEditData.pricing?.discount ??
        0
      ) || 0;
      const appliedDiscountTotal = hydratedAppliedDiscounts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      const manualDiscountForEdit = Math.max(0, invoiceDiscountRaw - appliedDiscountTotal);
      setDirectDiscount({ type: 'amount', value: manualDiscountForEdit });

      // Amount received: prefer persisted sale.amount_paid (authoritative) over enriched payment.*,
      // because workflow payment_status can be `paid` for cash while nothing was collected yet.
      const rootPaidRaw = activeEditData.amount_paid ?? activeEditData.amountPaid;
      const hasRootPaid =
        rootPaidRaw !== undefined && rootPaidRaw !== null && rootPaidRaw !== '';

      if (hasRootPaid) {
        const rp = Number(rootPaidRaw);
        setAmountPaid(Number.isFinite(rp) && rp >= 0 ? rp : 0);
      }

      // Set payment method and bank (amount paid handled above when DB column is present)
      if (activeEditData.payment) {
        setPaymentMethod(activeEditData.payment.method || 'cash');
        if (!hasRootPaid) {
          // IMPORTANT:
          // When the invoice is pending, Amount Paid should NOT be derived from amountReceived.
          // Some backend payloads may include `amountReceived` even when payment was never made,
          // which incorrectly pre-fills the full sale amount in edit mode.
          const paymentStatusRaw =
            activeEditData.payment.status ??
            activeEditData.paymentStatus ??
            activeEditData.payment_status ??
            'pending';
          const normalizedPaymentStatus = String(paymentStatusRaw).toLowerCase();

          const orderStatusRaw =
            activeEditData.orderStatus ??
            activeEditData.status ??
            activeEditData.order_status ??
            '';
          const normalizedOrderStatus = String(orderStatusRaw).toLowerCase();

          // Important: the UI "Pending" label comes from the invoice/order status, not payment.status.
          // If the invoice is pending (e.g. "confirmed_pending"), Amount Paid must be 0 in edit mode.
          const isInvoicePending =
            normalizedOrderStatus.includes('pending') || normalizedOrderStatus.includes('draft');

          const paidFromPayload = isInvoicePending
            ? 0
            : (normalizedPaymentStatus === 'pending'
              ? 0
              : (activeEditData.payment.amountPaid ??
                activeEditData.payment.amountReceived ??
                activeEditData.amountPaid ??
                0));
          const normalizedPaid = Number(paidFromPayload);
          setAmountPaid(Number.isFinite(normalizedPaid) && normalizedPaid >= 0 ? normalizedPaid : 0);
        }
        if (activeEditData.payment.method === 'bank') {
          setSelectedBankAccount(activeEditData.payment.bankAccount || activeEditData.payment.bank_id || '');
        } else {
          setSelectedBankAccount('');
        }
      }

      // Restore the Price Type so it always matches what was saved on the
      // existing order. Combine the saved orderType with the customer's
      // businessType to recover collapsed values like distributor.
      setPriceType(
        deriveInitialPriceType(
          activeEditData.orderType,
          activeEditData.customer ?? activeEditData.customerInfo
        )
      );
      // Bill date: when editing, show the existing invoice date
      if (activeEditData.billDate) {
        const d = activeEditData.billDate instanceof Date ? activeEditData.billDate : new Date(activeEditData.billDate);
        setBillDate(!isNaN(d.getTime()) ? getLocalDateString(d) : getLocalDateString());
      } else {
        setBillDate(getLocalDateString());
      }

      const savedTotal = Number(
        activeEditData.total ??
        activeEditData.pricing?.total ??
        0
      ) || 0;
      const savedPaid = Number(
        activeEditData.amount_paid ??
        activeEditData.amountPaid ??
        activeEditData.payment?.amountPaid ??
        activeEditData.payment?.amountReceived ??
        0
      ) || 0;
      setEditSavedInvoiceRemaining(Math.max(0, savedTotal - savedPaid));

      // Data loaded successfully (no toast needed as Orders already shows opening message)
    } else {
      setEditSavedInvoiceRemaining(null);
    }
  }, [activeEditData?.orderId]); // Only depend on orderId to prevent multiple executions

  // RTK Query hooks
  const { data: banksData, isLoading: banksLoading } = useGetBanksQuery(
    { isActive: true, all: 'true' },
    { staleTime: 5 * 60_000 }
  );

  const { customers, isLoading: customersLoading, isFetching: customersFetching } = useDebouncedCustomerSearch(
    customerSearchTerm,
    { selectedCustomer }
  );

  // Lazy query hooks for fetching last purchase prices
  const [getLastPurchasePrice] = useLazyGetLastPurchasePriceQuery();
  const [getLastPurchasePrices] = useGetLastPurchasePricesMutation();

  // Sales mutations
  const [createSale, { isLoading: isCreatingSale }] = useCreateSaleMutation();
  const [updateOrder, { isLoading: isUpdatingOrder }] = useUpdateOrderMutation();
  const [deleteOrder] = useDeleteOrderMutation();
  const [fetchOrderById] = useLazyGetOrderByIdQuery();
  const [fetchOrdersForExport] = useLazyGetOrdersQuery();
  const [getLastPrices] = useLazyGetLastPricesQuery();

  // ----- Apply / Restore "last prices" --------------------------------
  // Centralized in `useApplyLastPrices`. Sales' lazy query response can
  // be wrapped in either `result.data.prices` or `result.data.data.prices`,
  // so the wrapper normalises both shapes (and surfaces explicit errors).
  const fetchLastPricesForCustomer = useCallback(
    async (customerId) => {
      const result = await getLastPrices(customerId);
      if (result?.error) {
        const err = new Error(
          result.error?.data?.message || 'Failed to retrieve last prices'
        );
        err.cause = result.error;
        throw err;
      }
      const response = result?.data;
      if (!response) return null;
      const prices = response?.prices ?? response?.data?.prices ?? null;
      const orderNumber =
        response?.orderNumber ?? response?.data?.orderNumber ?? null;
      const orderDate =
        response?.orderDate ?? response?.data?.orderDate ?? null;
      if (!prices) return null;
      return { prices, orderNumber, orderDate };
    },
    [getLastPrices]
  );

  const {
    apply: handleApplyLastPrices,
    restore: handleRestoreCurrentPrices,
    isApplying: isLoadingLastPrices,
    isRestoring: isRestoringPrices,
    isApplied: isLastPricesApplied,
    setIsApplied: setIsLastPricesApplied,
    originalPrices,
    setOriginalPrices,
    priceStatus,
    setPriceStatus,
  } = useApplyLastPrices({
    items: cart,
    setItems: setCart,
    selectedCustomer,
    fetchLastPrices: fetchLastPricesForCustomer,
    getProductId: (item) => item.product._id.toString(),
  });

  const [checkApplicableDiscounts] = useCheckApplicableDiscountsMutation();
  const [applicableDiscountList, setApplicableDiscountList] = useState([]);
  const {
    data: savedInvoicesResponse,
    isLoading: isSavedInvoicesLoading,
    error: savedInvoicesError,
    refetch: refetchSavedInvoices,
  } = useGetOrdersQuery(
    {
      search: savedInvoiceSearchTerm || undefined,
      status: savedInvoiceStatus || undefined,
      dateFrom: savedInvoiceFromDate || undefined,
      dateTo: savedInvoiceToDate || undefined,
      page: savedInvoicePage,
      limit: savedInvoiceLimit,
    },
    { refetchOnMountOrArgChange: 120 }
  );

  const savedInvoices = useMemo(() => {
    if (!savedInvoicesResponse) return [];
    if (Array.isArray(savedInvoicesResponse?.data?.orders)) return savedInvoicesResponse.data.orders;
    if (Array.isArray(savedInvoicesResponse?.orders)) return savedInvoicesResponse.orders;
    if (Array.isArray(savedInvoicesResponse?.data?.data?.orders)) return savedInvoicesResponse.data.data.orders;
    if (Array.isArray(savedInvoicesResponse?.items)) return savedInvoicesResponse.items;
    return [];
  }, [savedInvoicesResponse]);

  const savedInvoicesPagination = useMemo(
    () => savedInvoicesResponse?.data?.pagination ?? savedInvoicesResponse?.pagination ?? {},
    [savedInvoicesResponse]
  );

  const handleEditSavedInvoice = useCallback(async (invoice) => {
    try {
      const result = await fetchOrderById(invoice?._id || invoice?.id).unwrap();
      const full = result?.order || result?.data?.order || result || invoice;
      setInlineEditData({
        orderId: full._id || full.id,
        isEditMode: true,
        customer: full.customer || full.customerInfo,
        orderNumber: full.order_number ?? full.orderNumber,
        notes: full.notes || '',
        items: (full.items || []).map((item) => ({
          product: item.product && typeof item.product === 'object'
            ? item.product
            : { _id: item.product_id || item.product, name: item.name || item.productName || 'Product' },
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice ?? item.unit_price ?? 0,
          totalPrice: item.total ?? (item.quantity * (item.unitPrice ?? item.unit_price ?? 0)),
        })),
        payment: full.payment || {},
        orderStatus: full.status ?? full.order_status,
        paymentStatus: full.payment?.status ?? full.payment_status,
        // Persisted column — preferred when hydrating Amount Paid (see edit-mode effect).
        amount_paid: full.amount_paid ?? full.amountPaid,
        amountPaid: full.amount_paid ?? full.amountPaid ?? full.payment?.amountPaid ?? full.payment?.amountReceived ?? 0,
        orderType: full.orderType ?? full.order_type,
        billDate: full.billDate ?? full.sale_date ?? full.createdAt ?? full.created_at,
        discountAmount: full.discountAmount ?? full.discount ?? full.pricing?.discountAmount ?? 0,
        appliedDiscounts: full.appliedDiscounts ?? full.applied_discounts ?? [],
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showSuccessToast('Invoice loaded for inline edit');
    } catch (err) {
      handleApiError(err, 'Loading invoice for edit');
    }
  }, [fetchOrderById]);

  /** Saved-invoice list uses minimal rows (no line items); load full sale before print preview. */
  const fetchFreshSavedInvoice = useCallback(
    async (invoice) => {
      const id = invoice?._id || invoice?.id;
      if (!id) return invoice;
      try {
        const result = await fetchOrderById(id).unwrap();
        return result?.order || result?.data?.order || result || invoice;
      } catch {
        return invoice;
      }
    },
    [fetchOrderById]
  );

  const openSavedInvoicePrintPreview = useCallback(
    async (invoice) => {
      const id = invoice?._id || invoice?.id;
      if (!id) {
        setSavedInvoicePrintOrder(invoice);
        setShowSavedInvoicePrintModal(true);
        return;
      }
      try {
        const full = await fetchFreshSavedInvoice(invoice);
        setSavedInvoicePrintOrder(full);
        setShowSavedInvoicePrintModal(true);
      } catch (err) {
        handleApiError(err, 'Loading invoice for print');
        setSavedInvoicePrintOrder(invoice);
        setShowSavedInvoicePrintModal(true);
      }
    },
    [fetchFreshSavedInvoice]
  );

  const handleDeleteSavedInvoice = useCallback(async (invoice) => {
    const target = invoice ?? invoiceDeleteTarget;
    const id = target?._id || target?.id;
    if (!id) return;
    try {
      await deleteOrder(id).unwrap();
      showSuccessToast('Sales invoice deleted successfully');
      refetchSavedInvoices();
      setInvoiceDeleteTarget(null);
    } catch (err) {
      handleApiError(err, 'Sales Invoice Deletion');
    }
  }, [deleteOrder, refetchSavedInvoices, invoiceDeleteTarget]);

  const getDerivedPaymentStatus = useCallback((invoice) => {
    const total = Number(invoice?.pricing?.total ?? invoice?.total ?? 0) || 0;
    const paid = Number(
      invoice?.payment?.amountPaid ??
      invoice?.payment?.amountReceived ??
      invoice?.amount_paid ??
      invoice?.amountPaid ??
      invoice?.amount_received ??
      invoice?.amountReceived ??
      0
    ) || 0;
    if (total <= 0) return 'pending';
    if (paid <= 0) return 'pending';
    if (paid + 0.01 >= total) return 'paid';
    return 'partial';
  }, []);

  const getPaymentStatusBadgeClass = useCallback((status) => {
    switch (String(status || '').toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }, []);

  const getSavedInvoicesExportData = useCallback(async () => {
    try {
      const res = await fetchOrdersForExport({
        search: savedInvoiceSearchTerm || undefined,
        status: savedInvoiceStatus || undefined,
        dateFrom: savedInvoiceFromDate || undefined,
        dateTo: savedInvoiceToDate || undefined,
        page: 1,
        limit: 10000,
      }).unwrap();

      let allRows = [];
      if (Array.isArray(res?.data?.orders)) allRows = res.data.orders;
      else if (Array.isArray(res?.orders)) allRows = res.orders;
      else if (Array.isArray(res?.data?.data?.orders)) allRows = res.data.data.orders;
      else if (Array.isArray(res?.items)) allRows = res.items;

      const customerNameOf = (invoice) =>
        invoice?.customer?.business_name ??
        invoice?.customer?.businessName ??
        invoice?.customer?.displayName ??
        invoice?.customer?.name ??
        invoice?.customerInfo?.businessName ??
        invoice?.customerInfo?.business_name ??
        invoice?.customerInfo?.name ??
        'Walk-in';

      const fnFrom = savedInvoiceFromDate || 'all';
      const fnTo = savedInvoiceToDate || 'all';

      return {
        title: 'Sales Invoices Report',
        filename: `Sales_Invoices_${fnFrom}_to_${fnTo}.xlsx`,
        company: {
          name: companySettings?.companyName || 'ZARYAB IMPEX',
          address: companySettings?.address || companySettings?.billingAddress || '',
          contact: `${companySettings?.contactNumber || ''} ${companySettings?.email ? '| ' + companySettings.email : ''}`.trim(),
        },
        columns: [
          { header: 'S.No', key: 'sno', width: 8, type: 'number' },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Invoice #', key: 'invoiceNumber', width: 22 },
          { header: 'Customer', key: 'customerName', width: 35 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Total Amount', key: 'totalAmount', width: 15, type: 'currency' },
        ],
        data: allRows.map((invoice, i) => ({
          sno: i + 1,
          date: formatDate(invoice?.sale_date ?? invoice?.billDate ?? invoice?.order_date ?? invoice?.created_at ?? invoice?.createdAt),
          invoiceNumber: invoice?.order_number ?? invoice?.orderNumber ?? invoice?.invoiceNumber ?? '—',
          customerName: customerNameOf(invoice),
          status: String(getDerivedPaymentStatus(invoice)).toUpperCase(),
          totalAmount: Number(invoice?.pricing?.total ?? invoice?.total ?? 0),
        })),
        summary: {
          rows: [
            {
              label: 'GRAND TOTAL:',
              invoiceNumber: `${allRows.length} Invoices`,
              totalAmount: allRows.reduce((sum, inv) => sum + Number(inv?.pricing?.total ?? inv?.total ?? 0), 0),
            },
          ],
        },
      };
    } catch (err) {
      showErrorToast(handleApiError(err).message || 'Could not load sales invoices for export');
      return null;
    }
  }, [
    fetchOrdersForExport,
    savedInvoiceSearchTerm,
    savedInvoiceStatus,
    savedInvoiceFromDate,
    savedInvoiceToDate,
    companySettings,
    getDerivedPaymentStatus,
  ]);

  // Duplicate prevention: use BOTH ref (synchronous check) and state (button disable)
  const isSubmittingRef = useRef(false); // For immediate synchronous checks
  const [isSubmitting, setIsSubmitting] = useState(false); // For button disabled state

  const cartScrollRef = useRef(null);
  /** Row roots for scroll-into-view after add (virtualized lines). */
  const cartLineElRefs = useRef(new Map());
  /** Line index (0-based) for green S.NO; cleared when cart empties or after checkout / clear cart. */
  const [highlightedCartLineIndex, setHighlightedCartLineIndex] = useState(null);
  /** Inner cart scrollbar only after 10 lines; first 10 rows grow with the page. */
  const cartNeedsInnerScroll = cart.length > 10;
  const cartVirtualizer = useVirtualizer({
    count: cart.length,
    getScrollElement: () => cartScrollRef.current,
    estimateSize: () => 96,
    overscan: 6,
  });

  useLayoutEffect(() => {
    if (highlightedCartLineIndex === null) return;
    const idx = highlightedCartLineIndex;
    cartScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (cartNeedsInnerScroll) {
      cartVirtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' });
    } else {
      requestAnimationFrame(() => {
        cartLineElRefs.current.get(idx)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      });
    }
  }, [highlightedCartLineIndex, cartNeedsInnerScroll, cart.length, cartVirtualizer]);

  useEffect(() => {
    if (activeTabId === tabId && cartVirtualizer) {
      // Re-measure when tab becomes active to fix 0-height issues from display:none
      cartVirtualizer.measure();
    }
  }, [activeTabId, tabId, cartVirtualizer]);

  /** Green S.NO stays until the next add highlights another line, or cart is cleared / sold. */
  useEffect(() => {
    if (cart.length === 0) setHighlightedCartLineIndex(null);
  }, [cart.length]);

  // Helper function to reset submitting state (ensures both ref and state are reset)
  const resetSubmittingState = useCallback(() => {
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  }, []);

  const selectedCustomerId = selectedCustomer?.id ?? selectedCustomer?._id ?? null;
  const { data: selectedCustomerDetail } = useGetCustomerQuery(selectedCustomerId, {
    skip: !selectedCustomerId,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true // Refetch when window regains focus
  });

  // Use centralized unified balance instead of entity-specific balance
  const { data: unifiedBalanceData } = useGetUnifiedBalanceQuery({
    type: 'customer',
    id: selectedCustomerId
  }, {
    skip: !selectedCustomerId,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  const customerWithBalance = selectedCustomerDetail?.data?.customer ?? selectedCustomerDetail?.customer ?? selectedCustomerDetail ?? selectedCustomer;
  // Override balance with centralized ledger balance if available
  const currentBalanceNum = unifiedBalanceData?.balance ?? (
    customerWithBalance?.currentBalance !== undefined ? Number(customerWithBalance.currentBalance) :
      (Number(customerWithBalance?.pendingBalance ?? 0) - Number(customerWithBalance?.advanceBalance ?? 0))
  );

  const activeBanks = useMemo(
    () => {
      const banks = banksData?.data?.banks || banksData?.banks || [];
      return banks.filter((bank) => bank.isActive !== false);
    },
    [banksData]
  );

  useEffect(() => {
    if (activeEditData?.isEditMode) return;
    if (paymentMethod !== 'bank' || selectedBankAccount) return;
    const first = activeBanks[0];
    const id = first?._id || first?.id;
    if (id) setSelectedBankAccount(id);
  }, [paymentMethod, selectedBankAccount, activeBanks, activeEditData?.isEditMode]);

  // Update selected customer when customers data changes (e.g., after cash receipt updates balance)
  useEffect(() => {
    if (selectedCustomer && customers && customers.length > 0) {
      const updatedCustomer = customers.find(
        c => c._id === selectedCustomer._id
      );
      if (updatedCustomer && (
        updatedCustomer.pendingBalance !== selectedCustomer.pendingBalance ||
        updatedCustomer.advanceBalance !== selectedCustomer.advanceBalance ||
        updatedCustomer.currentBalance !== selectedCustomer.currentBalance
      )) {
        setSelectedCustomer(updatedCustomer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: selectedCustomer is intentionally excluded from deps to prevent infinite loops.
    // We only want to sync when the customers list updates, not when selectedCustomer changes.
  }, [customers]);

  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const discountCheckItems = useMemo(
    () =>
      cart.map((item) => ({
        product: item.product?._id ?? item.product?.id ?? item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    [cart]
  );
  const codeDiscountAmount = appliedDiscounts.reduce((sum, discount) => sum + discount.amount, 0);

  // Fetch applicable discount codes when cart subtotal or customer changes
  useEffect(() => {
    if (subtotal <= 0) {
      setApplicableDiscountList([]);
      return;
    }
    let cancelled = false;
    checkApplicableDiscounts({
      orderData: { total: subtotal, items: discountCheckItems },
      customerData: selectedCustomer ? { id: selectedCustomer._id || selectedCustomer.id } : null
    })
      .unwrap()
      .then((res) => {
        if (cancelled) return;
        const list = res?.applicableDiscounts ?? res?.data?.applicableDiscounts ?? [];
        setApplicableDiscountList(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setApplicableDiscountList([]);
      });
    return () => { cancelled = true; };
  }, [subtotal, discountCheckItems, selectedCustomer?._id, selectedCustomer?.id]);

  const {
    directDiscountAmount,
    totalDiscount: totalDiscountAmount,
    subtotalAfterDiscount,
    tax,
    total,
  } = computeSalesCheckoutPricing({
    items: cart,
    directDiscount,
    codeDiscountAmount,
    taxRate: globalTaxPercent,
    taxSystemEnabled,
  });
  const change = amountPaid - total;
  const manualDiscountDisplay = Math.max(0, Math.round(directDiscountAmount || 0));

  const checkoutPartyBalances = useMemo(() => {
    if (!selectedCustomer) {
      return {
        previousBalance: 0,
        totalReceivables: 0,
        projectedLedger: 0,
        invoiceRemaining: 0,
      };
    }

    const ledgerBalance = Number.isFinite(Number(currentBalanceNum))
      ? Number(currentBalanceNum)
      : (selectedCustomer.currentBalance !== undefined && selectedCustomer.currentBalance !== null
        ? Number(selectedCustomer.currentBalance)
        : ((selectedCustomer.pendingBalance || 0) - (selectedCustomer.advanceBalance || 0)));

    const isEditMode = Boolean(activeEditData?.orderId);
    const invoiceRemaining = Math.max(0, Number(total) - (Number(amountPaid) || 0));

    const printBalances = computeLedgerPrintBalances({
      ledgerBalance,
      totalValue: total,
      receivedAmount: amountPaid || 0,
      orderData: isEditMode
        ? { id: activeEditData.orderId, isEditMode: true }
        : null,
    });

    return {
      previousBalance: printBalances.previousBalance,
      totalReceivables: printBalances.combinedRemainingBalance,
      projectedLedger: printBalances.combinedRemainingBalance,
      invoiceRemaining,
    };
  }, [
    selectedCustomer,
    currentBalanceNum,
    total,
    amountPaid,
    activeEditData?.orderId,
    cart.length,
    subtotal,
  ]);

  // The orderType sent to the backend always reflects the user-selected
  // Price Type so the value round-trips correctly between create and edit.
  // We also preserve return/exchange overrides if the order was loaded as
  // such in edit mode.
  const resolvedOrderTypeForSave = () =>
    resolveOrderTypeForSave(priceType, activeEditData?.orderType);

  const createdByUser = useMemo(
    () =>
      user
        ? {
            firstName: user.firstName,
            lastName: user.lastName,
            name:
              user.displayName ||
              `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
              'Admin',
          }
        : { name: 'Admin' },
    [user]
  );

  const patchCustomerLedgerCache = useCallback((customerId, balance) => {
    if (!customerId || !Number.isFinite(Number(balance))) return;
    dispatch(
      accountingApi.util.upsertQueryData(
        'getUnifiedBalance',
        { type: 'customer', id: customerId },
        {
          success: true,
          type: 'customer',
          id: customerId,
          balance: Number(balance),
          timestamp: new Date().toISOString(),
        }
      )
    );
  }, [dispatch]);

  const enrichOrderForPrint = useCallback((
    order,
    paidAmount = amountPaid,
    serverLedgerBalance = null,
    serverPreviousBalance = null,
  ) => {
    if (!order) return order;

    const paid = Number(paidAmount) || 0;
    const orderId = order.id || order._id;
    const invoiceRemaining = Math.max(0, total - paid);
    const wasEdit = Boolean(activeEditData?.orderId);
    const ledgerBalance = Number.isFinite(Number(serverLedgerBalance))
      ? Number(serverLedgerBalance)
      : computePostSaveLedgerBalance({
        ledgerBalanceBefore: currentBalanceNum,
        totalValue: total,
        receivedAmount: paid,
        savedInvoiceRemaining: editSavedInvoiceRemaining,
        isNewSale: !wasEdit,
      });
    const previousBalance = Number.isFinite(Number(serverPreviousBalance))
      ? Number(serverPreviousBalance)
      : computePostSavePreviousBalance({
        ledgerBalanceAfter: ledgerBalance,
        totalValue: total,
        receivedAmount: paid,
        ledgerBalanceBefore: currentBalanceNum,
        isNewSale: !wasEdit,
      });

    return {
      ...order,
      isEditMode: true,
      id: orderId,
      _id: orderId,
      ledgerBalance,
      previousBalance,
      ledgerBalanceFresh: true,
      payment: {
        ...(order.payment || {}),
        amountPaid: paid,
        amountReceived: paid,
        remainingBalance: invoiceRemaining,
      },
    };
  }, [activeEditData?.orderId, amountPaid, currentBalanceNum, total, editSavedInvoiceRemaining]);

  const buildSalesCartOrder = useCallback(() => {
    const base = buildCartInvoiceOrder({
      selectedParty: selectedCustomer,
      partyType: 'customer',
      cartItems: mapCartItemsForInvoicePrint(cart),
      pricing: {
        subtotal,
        discountAmount: totalDiscountAmount,
        taxAmount: tax,
        isTaxExempt: !taxSystemEnabled,
        total,
      },
      payment: {
        method: paymentMethod,
        bankAccount: paymentMethod === 'bank' ? selectedBankAccount : null,
        amountPaid,
        remainingBalance: total - amountPaid,
        isPartialPayment: amountPaid < total,
        isAdvancePayment,
        advanceAmount: isAdvancePayment ? amountPaid - total : 0,
      },
      invoiceNumber,
      orderType: resolvedOrderTypeForSave(),
      createdByUser,
      isEditMode: Boolean(activeEditData?.orderId),
    });

    if (activeEditData?.orderId) {
      return {
        ...base,
        _id: activeEditData.orderId,
        id: activeEditData.orderId,
        orderNumber: activeEditData.orderNumber || invoiceNumber,
        invoiceNumber: activeEditData.orderNumber || invoiceNumber,
      };
    }
    return base;
  }, [
    selectedCustomer,
    cart,
    subtotal,
    totalDiscountAmount,
    tax,
    taxSystemEnabled,
    total,
    paymentMethod,
    selectedBankAccount,
    amountPaid,
    isAdvancePayment,
    invoiceNumber,
    createdByUser,
    activeEditData,
    priceType,
  ]);

  const handleCustomerSearch = (searchTerm) => {
    setCustomerSearchTerm(searchTerm);
    if (searchTerm === '') {
      setSelectedCustomer(null);
    }
  };

  const handleCustomerSelect = async (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearchTerm(getCustomerDisplayName(customer, ''));

    // Reset price states when customer changes
    setOriginalPrices({});
    setIsLastPricesApplied(false);
    setPriceStatus({});

    // Auto-set price type based on customer business type. Skip in edit
    // mode so the freshly-selected customer doesn't overwrite the price
    // type already restored from the saved order.
    if (!activeEditData?.isEditMode) {
      const suggested = priceTypeFromBusinessType(customer?.businessType);
      if (suggested) setPriceType(suggested);
    }

    // Auto-generate invoice number if enabled
    if (autoGenerateInvoice && customer) {
      setInvoiceNumber(generateInvoiceNumber(customer));
    }

    // Update tab title to show customer name
    const activeTab = getActiveTab();
    if (activeTab && customer) {
      updateTabTitle(activeTab.id, `Sales - ${getCustomerDisplayName(customer, 'Customer')}`);
    }
  };

  // Update product rates when price type changes
  useEffect(() => {
    // This will trigger ProductSearch to recalculate rates when priceType changes
    // The ProductSearch component handles the rate update internally
  }, [priceType]);

  // Fetch last purchase prices for products in cart (always, not just when cost is visible)
  useEffect(() => {
    const fetchLastPurchasePrices = async () => {
      if (cart.length === 0) return;

      const productIds = cart.map((item) => item?.product?._id ?? item?.product?.id).filter(Boolean);
      if (productIds.length === 0) return;

      try {
        const response = await getLastPurchasePrices({ productIds }).unwrap();
        if (response && response.prices) {
          const pricesMap = {};
          Object.keys(response.prices).forEach(productId => {
            pricesMap[productId] = response.prices[productId].lastPurchasePrice;
          });
          setLastPurchasePrices(prev => ({ ...prev, ...pricesMap }));
        }
      } catch (error) {
        // Silently fail - last purchase prices are optional
      }
    };

    fetchLastPurchasePrices();
  }, [cart]);

  const addToCart = async (newItem) => {
    // Normalize: accept either { product, quantity, unitPrice } or product directly
    const item = newItem?.product
      ? newItem
      : { product: newItem, quantity: 1, unitPrice: newItem?.selling_price ?? newItem?.sellingPrice ?? newItem?.pricing?.retail ?? 0 };
    const product = item?.product;
    if (!product) return;

    const productId = normalizeCartProductId(product);
    const existingIndex = cartRef.current.findIndex(
      (c) => normalizeCartProductId(c.product) === productId
    );

    if (existingIndex >= 0) {
      setDuplicateCartMerge({
        productId,
        pendingItem: item,
        displayName: getProductDisplayName(product, 'Product'),
      });
      return 'duplicate';
    }

    let highlightLineIndex = null;

    setCart(prevCart => {
      highlightLineIndex = prevCart.length;

      // New item added - fetch its last purchase price (always, for loss alerts)
      // For variants, use base product ID to get purchase price
      const productIdForPrice = product.isVariant
        ? product.baseProductId
        : (product._id ?? product.id);

      if (productIdForPrice) {
        getLastPurchasePrice(productIdForPrice)
          .unwrap()
          .then((response) => {
            if (response && response.lastPurchasePrice !== null) {
              setLastPurchasePrices(prev => ({
                ...prev,
                [productId]: response.lastPurchasePrice
              }));
            }
          })
          .catch(() => {
            // Silently fail - last purchase price is optional
          });
      }

      return [...prevCart, item];
    });

    if (highlightLineIndex !== null && highlightLineIndex >= 0) {
      setHighlightedCartLineIndex(highlightLineIndex);
    }
  };

  const handleDuplicateCartMergeConfirm = () => {
    if (!duplicateCartMerge) return;
    const { productId, pendingItem } = duplicateCartMerge;
    const item = pendingItem;
    const product = item.product;

    let mergedLineIndex = null;
    setCart(prevCart => {
      const idx = prevCart.findIndex((c) => normalizeCartProductId(c.product) === productId);
      if (idx < 0) {
        mergedLineIndex = prevCart.length;
        return [...prevCart, item];
      }

      mergedLineIndex = idx;
      const existingItem = prevCart[idx];
      const combinedQuantity = existingItem.quantity + item.quantity;
      const availableStock = product.inventory?.currentStock || 0;

      if (combinedQuantity > availableStock) {
        toast.warning(`Stock for ${getProductDisplayName(product, 'Product')} is insufficient. Adding ${item.quantity} units anyway.`);
      }

      const newQty = existingItem.quantity + item.quantity;
      const ppb = getPiecesPerBox(product);
      const { boxes, pieces } = ppb ? piecesToBoxesAndPieces(newQty, ppb) : {};
      return prevCart.map((c) =>
        normalizeCartProductId(c.product) === productId
          ? { ...c, quantity: newQty, ...(ppb && { boxes, pieces }), unitPrice: item.unitPrice }
          : c
      );
    });

    setDuplicateCartMerge(null);
    setProductSearchResetKey((k) => k + 1);
    refocusProductSearch();

    if (mergedLineIndex !== null && mergedLineIndex >= 0) {
      setHighlightedCartLineIndex(mergedLineIndex);
    }
  };

  const updateCartBoxCount = (productId, newBoxes) => {
    const boxes = Math.max(0, parseInt(String(newBoxes), 10) || 0);
    const cartItem = cart.find((item) => item.product._id === productId);
    if (!cartItem) return;
    const ppb = getPiecesPerBox(cartItem.product);
    if (!ppb) return;

    const pieces =
      cartItem.pieces != null ? cartItem.pieces : piecesToBoxesAndPieces(cartItem.quantity, ppb).pieces;
    const total = computeTotalPieces(boxes, pieces, ppb);
    const availableStock = cartItem.product.inventory?.currentStock || 0;

    if (total > availableStock) {
      toast.warning(
        `Stock is insufficient. Setting quantity to ${total} pcs anyway.`
      );
    }

    if (total <= 0) {
      removeFromCart(productId);
      return;
    }

    const { boxes: nb, pieces: np } = piecesToBoxesAndPieces(total, ppb);
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product._id === productId ? { ...item, quantity: total, boxes: nb, pieces: np } : item
      )
    );
  };

  const updateQuantity = async (productId, newQuantity, dual = null) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart => {
      const cartItem = prevCart.find(item => item.product._id === productId);
      if (!cartItem) return prevCart;

      const availableStock = cartItem.product.inventory?.currentStock || 0;
      if (Number(newQuantity) > availableStock) {
        toast.warning(
          `Stock is insufficient. Setting quantity to ${newQuantity} anyway.`
        );
      }

      const ppb = getPiecesPerBox(cartItem.product);
      const { boxes, pieces } = ppb && dual ? dual : (ppb ? piecesToBoxesAndPieces(newQuantity, ppb) : {});
      return prevCart.map(item =>
        item.product._id === productId
          ? { ...item, quantity: newQuantity, ...(ppb && { boxes, pieces }) }
          : item
      );
    });
  };

  const updateUnitPrice = (productId, newPrice) => {
    if (newPrice < 0) return;

    // Check if sale price is less than cost price (always check, regardless of showCostPrice)
    const cartItem = cart.find(item => item.product._id === productId);
    if (cartItem) {
      const costPrice = getCartLineEffectiveCost(cartItem.product, lastPurchasePrices);
      if (costPrice !== undefined && costPrice !== null && newPrice < costPrice) {
        const loss = costPrice - newPrice;
        const lossPercent = ((loss / costPrice) * 100).toFixed(1);
        toast.error(
          `Warning: Sale price (${newPrice}) is below cost price (${Math.round(costPrice)}). Loss: ${Math.round(loss)} (${lossPercent}%)`,
          {
            duration: 5000,
            position: 'top-center',
            icon: '⚠️'
          }
        );
      }
    }

    setCart(prevCart =>
      prevCart.map(cartItem =>
        cartItem.product._id === productId
          ? { ...cartItem, unitPrice: newPrice }
          : cartItem
      )
    );
    // Note: We don't update originalPrices here because "Restore Current Prices"
    // should always restore to the prices that were there BEFORE applying last prices,
    // not the prices after manual edits
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => {
      const newCart = prevCart.filter(item => item.product._id !== productId);
      // If cart becomes empty or if this was the last item with original price, reset states
      if (newCart.length === 0) {
        setOriginalPrices({});
        setIsLastPricesApplied(false);
        setPriceStatus({});
      } else {
        // Remove the product's original price and status if they exist
        setOriginalPrices(prev => {
          const updated = { ...prev };
          delete updated[productId.toString()];
          // If no more original prices, reset the flag
          if (Object.keys(updated).length === 0) {
            setIsLastPricesApplied(false);
            setPriceStatus({});
          }
          return updated;
        });
        setPriceStatus(prev => {
          const updated = { ...prev };
          delete updated[productId.toString()];
          return updated;
        });
      }
      return newCart;
    });
  };

  const handleSortCartItems = () => {
    setCart(prevCart => {
      if (!prevCart || prevCart.length < 2) {
        return prevCart;
      }

      const getProductName = (item) => {
        const productData = item.product;

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

      const sortedCart = [...prevCart].sort((a, b) => {
        const nameA = getProductName(a).toString().toLowerCase();
        const nameB = getProductName(b).toString().toLowerCase();

        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      return sortedCart;
    });
  };

  const { confirmation: clearConfirmation, confirmClear, handleConfirm: handleClearConfirm, handleCancel: handleClearCancel } = useClearConfirmation();

  const applyDiscountFromItem = (match) => {
    const discount = match.discount || {};
    const code = (discount.code || discount.discount_code || '').toString().toUpperCase();
    if (!code) return;
    if (appliedDiscounts.some((d) => (d.code || '').toUpperCase() === code)) {
      showErrorToast('This discount is already applied');
      return;
    }
    const amount = match.calculatedAmount ?? (discount.type === 'percentage' ? (subtotal * (discount.value || 0)) / 100 : Math.min(discount.value || 0, subtotal));
    setAppliedDiscounts((prev) => [
      ...prev,
      {
        code: discount.code || discount.discount_code || code,
        amount: Number(amount) || 0,
        discountId: discount.id || discount._id,
        type: discount.type,
        value: discount.value
      }
    ]);
    showSuccessToast(`Discount ${code} applied`);
  };

  const handleSelectDiscountFromDropdown = (e) => {
    const value = e.target.value;
    if (!value) return;
    const match = applicableDiscountList.find(
      (item) => (item.discount?.code || item.discount?.discount_code || '').toString().toUpperCase() === value
    );
    if (match) applyDiscountFromItem(match);
    e.target.value = '';
  };

  const handleRemoveDiscountCode = (code) => {
    setAppliedDiscounts((prev) => prev.filter((d) => (d.code || '').toUpperCase() !== (code || '').toUpperCase()));
  };

  const handleClearCart = () => {
    if (cart.length > 0) {
      setIsClearingCart(true);
      confirmClear(cart.length, 'items', async () => {
        try {
          setCart([]);
          setHighlightedCartLineIndex(null);
          setSelectedCustomer(null);
          setCustomerSearchTerm('');
          setAppliedDiscounts([]);
          setDirectDiscount({ type: 'amount', value: 0 });
          setIsAdvancePayment(false);
          setInvoiceNumber('');
          setPaymentMethod('cash');
          setSelectedBankAccount('');
          setAmountPaid(0);
          setOriginalPrices({});
          setIsLastPricesApplied(false);
          setPriceStatus({});
          setPriceType(normalizePriceType('wholesale'));

          // Reset tab title to default
          const activeTab = getActiveTab();
          if (activeTab) {
            updateTabTitle(activeTab.id, 'Sales');
          }

          toast.success('Cart cleared');
        } finally {
          setIsClearingCart(false);
        }
      });
    }
  };

  const resetSaleDraft = useCallback(({ resetBillDate = false } = {}) => {
    setCart([]);
    setHighlightedCartLineIndex(null);
    setAmountPaid(0);
    setAppliedDiscounts([]);
    setDirectDiscount({ type: 'amount', value: 0 });
    setNotes('');
    setInvoiceNumber('');
    setAutoGenerateInvoice(true);
    if (resetBillDate) {
      setBillDate(getLocalDateString());
    }
    setLastPurchasePrices({});
    setOriginalPrices({});
    setIsLastPricesApplied(false);
    setPriceStatus({});
    setInlineEditData(null);
    setEditSavedInvoiceRemaining(null);
    setDuplicateCartMerge(null);
    setProductSearchResetKey((k) => k + 1);
  }, []);

  const handleCreateOrder = useCallback(async (orderData) => {
    // Double-check: prevent duplicate calls even if handleCheckout guard fails
    if (isSubmittingRef.current) {
      // Silently ignore duplicate calls - this is expected behavior
      return;
    }

    // Set flag immediately before async operation
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await createSale({ payload: orderData }).unwrap();
      showSuccessToast('Sale created successfully');

      // Force refresh product search cache so stock quantities reflect immediately
      // even when browser print dialog temporarily interrupts UI lifecycle.
      try {
        refetchProducts?.();
      } catch {
        // ignore cache refresh errors; sale has already been completed
      }

      // RTK Query invalidatesTags will automatically refetch Products and Customers
      // No need to manually refetch - it happens automatically via cache invalidation
      // This prevents React warnings about updating components during render

      const serverLedger = result?.customerLedgerBalance;
      const serverPrevious = result?.customerPreviousBalance;
      const customerId =
        result?.order?.customer_id ||
        result?.order?.customerId ||
        selectedCustomer?.id ||
        selectedCustomer?._id;
      if (customerId && serverLedger != null) {
        patchCustomerLedgerCache(customerId, serverLedger);
      }

      if (result?.order && autoPrintEnabled) {
        setDirectPrintOrder(enrichOrderForPrint(result.order, amountPaid, serverLedger, serverPrevious));
      } else {
        // No print flow: complete and clear immediately.
        resetSaleDraft({ resetBillDate: true });
      }
      setEditSavedInvoiceRemaining(Math.max(0, total - (Number(amountPaid) || 0)));
      resetSubmittingState();
    } catch (error) {
      // Handle duplicate request errors gracefully (409)
      if (error?.status === 409 || error?.data?.error?.code === 'DUPLICATE_REQUEST') {
        const retryAfter = error?.data?.error?.retryAfter || 1;
        toast(
          `Your request is being processed. Please wait ${retryAfter} second${retryAfter > 1 ? 's' : ''}...`,
          {
            duration: 3000,
            icon: 'ℹ️'
          }
        );
        // Don't reset submitting flag immediately for duplicate requests
        // The request might complete successfully, wait a bit longer
        setTimeout(() => {
          resetSubmittingState();
        }, (retryAfter + 2) * 1000);
      } else if (error?.data?.code === 'DAY_ALREADY_CLOSED') {
        toast.error(error?.data?.message || 'This business day is already closed.');
        resetSubmittingState();
      } else {
        handleApiError(error, 'Create Sale');
        resetSubmittingState();
      }
    }
  }, [createSale, resetSubmittingState, autoPrintEnabled, resetSaleDraft, refetchProducts, enrichOrderForPrint, amountPaid, total, patchCustomerLedgerCache, selectedCustomer]);

  const handleUpdateOrder = useCallback(async (orderId, updateData) => {
    // Double-check: prevent duplicate calls even if handleCheckout guard fails
    if (isSubmittingRef.current) {
      // Silently ignore duplicate calls - this is expected behavior
      return;
    }

    // Set flag immediately before async operation
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await updateOrder({ id: orderId, ...updateData }).unwrap();
      showSuccessToast('Order updated successfully');

      // Keep product stock in sync immediately after update/create actions.
      try {
        refetchProducts?.();
      } catch {
        // ignore cache refresh errors; order update already succeeded
      }

      // RTK Query invalidatesTags will automatically refetch Products and Customers
      // No need to manually refetch - it happens automatically via cache invalidation
      // This prevents React warnings about updating components during render

      const paidAfterUpdate = Number(updateData?.amountReceived ?? amountPaid) || 0;
      const serverLedger = result?.customerLedgerBalance;
      const serverPrevious = result?.customerPreviousBalance;
      const customerId =
        result?.order?.customer_id ||
        result?.order?.customerId ||
        updateData?.customer ||
        selectedCustomer?.id ||
        selectedCustomer?._id;
      if (customerId && serverLedger != null) {
        patchCustomerLedgerCache(customerId, serverLedger);
      }

      if (result?.order && autoPrintEnabled) {
        setDirectPrintOrder(enrichOrderForPrint(result.order, paidAfterUpdate, serverLedger, serverPrevious));
        setEditSavedInvoiceRemaining(Math.max(0, total - paidAfterUpdate));
      } else {
        // No print flow: complete and clear immediately.
        resetSaleDraft();
        setEditSavedInvoiceRemaining(Math.max(0, total - paidAfterUpdate));
      }
      resetSubmittingState();
    } catch (error) {
      // Handle duplicate request errors gracefully (409)
      if (error?.status === 409 || error?.data?.error?.code === 'DUPLICATE_REQUEST') {
        const retryAfter = error?.data?.error?.retryAfter || 1;
        toast(
          `Your request is being processed. Please wait ${retryAfter} second${retryAfter > 1 ? 's' : ''}...`,
          {
            duration: 3000,
            icon: 'ℹ️'
          }
        );
        // Don't reset submitting flag immediately for duplicate requests
        setTimeout(() => {
          resetSubmittingState();
        }, (retryAfter + 2) * 1000);
      } else if (error?.data?.code === 'DAY_ALREADY_CLOSED') {
        toast.error(error?.data?.message || 'This business day is already closed.');
        resetSubmittingState();
      } else {
        handleApiError(error, 'Update Order');
        resetSubmittingState();
      }
    }
  }, [updateOrder, resetSubmittingState, isSubmittingRef, autoPrintEnabled, resetSaleDraft, refetchProducts, enrichOrderForPrint, amountPaid, total, patchCustomerLedgerCache, selectedCustomer]);

  const handleCheckout = useCallback((e) => {
    // Prevent default and stop propagation to avoid any event bubbling issues
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Prevent duplicate submissions - check ref FIRST (synchronous, no delay)
    if (isSubmittingRef.current || isSubmitting || isCreatingSale || isUpdatingOrder) {
      // Silently ignore duplicate calls - this is expected behavior
      return;
    }

    // NOTE: Don't set flags here - let handleCreateOrder/handleUpdateOrder set them
    // This prevents the double-check guard in those functions from triggering

    if (cart.length === 0) {
      // No need to reset state since we don't set it in handleCheckout
      showErrorToast({ message: 'Cart is empty' });
      return;
    }

    // Check credit limit before proceeding
    const custCreditLimit = Number(selectedCustomer?.creditLimit ?? selectedCustomer?.credit_limit ?? 0) || 0;
    if (selectedCustomer && custCreditLimit > 0) {
      const currentPaymentMethod = paymentMethod || 'cash';
      const currentAmountPaid = amountPaid || 0;
      const unpaidAmount = total - currentAmountPaid;

      // For account payments or partial payments, check credit limit
      if (currentPaymentMethod === 'account' || unpaidAmount > 0) {
        const currentBalance = Number(selectedCustomer.currentBalance ?? selectedCustomer.current_balance ?? 0) || 0;
        const totalOutstanding = currentBalance;
        const newBalanceAfterOrder = totalOutstanding + unpaidAmount;
        const availableCredit = Math.max(0, custCreditLimit - totalOutstanding);

        if (newBalanceAfterOrder > custCreditLimit) {
          toast.error(`Your credit limit is full. Credit limit: ${custCreditLimit.toFixed(2)}. Please collect payment or reduce the order amount.`, {
            duration: 8000,
            position: 'top-center',
            icon: '⚠️'
          });
          return;
        } else if (availableCredit - unpaidAmount < (custCreditLimit * 0.1)) {
          const warningMessage = `Warning: ${selectedCustomer.businessName || selectedCustomer.business_name || selectedCustomer.displayName || selectedCustomer.name} is near credit limit. ` +
            `Available credit: ${availableCredit.toFixed(2)}, ` +
            `After this order: ${(Math.max(0, availableCredit - unpaidAmount)).toFixed(2)} remaining.`;

          toast.warning(warningMessage, {
            duration: 6000,
            position: 'top-center'
          });
        }
      }
    }

    if (paymentMethod === 'bank' && !selectedBankAccount) {
      // Don't reset state here since we never set it in handleCheckout
      showErrorToast({ message: 'Please select a bank account for bank payments' });
      return;
    }

    const totalNum = Number(total) || 0;
    const isAccountInvoice = paymentMethod === 'account';
    const isSplit = paymentMethod === 'split';
    const effectivePaid = Number(amountPaid) || 0;

    const orderData = {
      orderType: resolvedOrderTypeForSave(),
      customer: selectedCustomer?.id || selectedCustomer?._id,
      items: cart.map(item => {
        const productId = item.product?._id ?? item.product?.id;
        const isManualLine =
          item.product?.isManual === true ||
          (typeof productId === 'string' && productId.startsWith('manual_'));
        const base = {
          product: productId,
          quantity: Math.round(item.quantity),
          unitPrice: item.unitPrice,
          isManual: isManualLine,
          name: item.product?.name
        };
        if (isManualLine) {
          const uc = Number(
            item.product?.pricing?.cost ??
            item.product?.pricing?.cost_price ??
            item.product?.cost_price ??
            item.product?.costPrice ??
            0
          );
          if (Number.isFinite(uc) && uc >= 0) {
            base.unitCost = uc;
          }
        }
        if (item.product?.imageUrl) {
          base.imageUrl = item.product.imageUrl;
        }
        if (item.boxes != null || item.pieces != null) {
          base.boxes = item.boxes;
          base.pieces = item.pieces;
        }
        return base;
      }),
      appliedDiscounts: appliedDiscounts,
      directDiscount: directDiscount,
      subtotal: subtotal,
      discountAmount: totalDiscountAmount,
      tax: tax,
      isTaxExempt: !taxSystemEnabled,
      total: total,
      invoiceNumber: invoiceNumber,
      billDate: billDate || undefined, // Include billDate for backdating (invoice number will be based on this)
      notes: notes?.trim() || '',
      payment: {
        method: paymentMethod,
        bankAccount: paymentMethod === 'bank' ? selectedBankAccount : null,
        amount: effectivePaid,
        amountPaid: effectivePaid,
        amountReceived: effectivePaid,
        remainingBalance: totalNum - effectivePaid,
        isPartialPayment: totalNum - effectivePaid > 0.01,
        isAdvancePayment: isAdvancePayment,
        advanceAmount: isAdvancePayment ? (effectivePaid - totalNum) : 0
      }
    };

    // Use appropriate mutation based on edit mode
    if (activeEditData?.isEditMode) {
      const orderId = activeEditData.orderId;
      // For updates, send items with all required fields according to orderItemSchema
      const updateData = {
        orderType: resolvedOrderTypeForSave(),
        customer: selectedCustomer?.id || selectedCustomer?._id,
        items: cart.map(item => {
          const productId = item.product?._id ?? item.product?.id;
          const isManualLine =
            item.product?.isManual === true ||
            (typeof productId === 'string' && productId.startsWith('manual_'));
          const itemSubtotal = item.quantity * item.unitPrice;
          const itemDiscountAmount = 0; // Can be calculated if needed
          const itemTaxAmount = 0; // Can be calculated if needed
          const itemTotal = itemSubtotal - itemDiscountAmount + itemTaxAmount;

          const base = {
            product: productId,
            quantity: Math.round(item.quantity),
            unitPrice: item.unitPrice,
            isManual: isManualLine,
            name: item.product?.name,
            discountPercent: 0,
            taxRate: 0,
            subtotal: itemSubtotal,
            discountAmount: itemDiscountAmount,
            taxAmount: itemTaxAmount,
            total: itemTotal
          };
          if (item.product?.imageUrl) {
            base.imageUrl = item.product.imageUrl;
          }
          if (isManualLine) {
            const uc = Number(
              item.product?.pricing?.cost ??
              item.product?.pricing?.cost_price ??
              item.product?.cost_price ??
              item.product?.costPrice ??
              0
            );
            if (Number.isFinite(uc) && uc >= 0) {
              base.unitCost = uc;
            }
          }
          if (item.boxes != null || item.pieces != null) {
            base.boxes = item.boxes;
            base.pieces = item.pieces;
          }
          return base;
        }),
        notes: notes || '',
        amountReceived: amountPaid ?? 0,
        paymentMethod: paymentMethod,
        bankAccount: paymentMethod === 'bank' ? selectedBankAccount : null,
        billDate: billDate || undefined,
        discount: totalDiscountAmount > 0 ? totalDiscountAmount : undefined
      };
      handleUpdateOrder(orderId, updateData);
    } else {
      handleCreateOrder(orderData);
    }
  }, [
    isSubmitting,
    isCreatingSale,
    isUpdatingOrder,
    cart,
    selectedCustomer,
    paymentMethod,
    amountPaid,
    total,
    appliedDiscounts,
    directDiscount,
    subtotal,
    totalDiscountAmount,
    tax,
    taxSystemEnabled,
    invoiceNumber,
    billDate,
    notes,
    selectedBankAccount,
    isAdvancePayment,
    activeEditData,
    resetSubmittingState,
    handleCreateOrder,
    handleUpdateOrder
  ]);

  const handlePaymentSuccess = async (paymentResult) => {
    // Handle payment success
  };

  const handlePaymentError = (error) => {
    handleApiError(error, 'Payment processing');
    setShowPaymentModal(false);
    setCurrentOrder(null);
  };

  return (
    <AsyncErrorBoundary>
      <PageLayout className="space-y-4 lg:space-y-6">
        {/* Modern Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
            {/* Title & Customer Selection */}
            <div className="flex flex-col sm:flex-row sm:items-center flex-1 gap-3">
              <div className="flex-shrink-0">
                <h1 className={`${isMobile ? 'text-base' : 'text-xl'} font-bold text-gray-900`}>Point of Sales</h1>
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
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider underline"
                      >
                        Change
                      </button>
                    )}
                  </div>
                  <PriceTypeSelector
                    id="salesPriceType"
                    value={priceType}
                    onChange={setPriceType}
                  />
                </div>
                <CustomerPartySelect
                  items={customers}
                  selectedItem={selectedCustomer}
                  onSelect={handleCustomerSelect}
                  onSearch={handleCustomerSearch}
                  searchValue={customerSearchTerm}
                  loading={customersLoading || customersFetching}
                  serverSideSearch
                  canViewBalance={hasPermission(PERMISSIONS.VIEW_CUSTOMER_BALANCE)}
                />
              </div>
            </div>

            <CustomerBalanceStrip
              customer={selectedCustomer}
              canViewBalance={hasPermission(PERMISSIONS.VIEW_CUSTOMER_BALANCE)}
              balanceOverride={checkoutPartyBalances.projectedLedger}
              creditLimitOverride={
                selectedCustomer?.creditLimit ??
                selectedCustomer?.credit_limit ??
                customerWithBalance?.creditLimit ??
                customerWithBalance?.credit_limit
              }
            />
          </div>
        </div>

        {/* Combined Product Selection and Cart Section */}
        <ProductSelectionCartSection
          searchSectionClassName="mb-2"
          headerActions={
            <>
              <div className="flex flex-wrap items-center gap-2">
                {cart.length > 0 && (
                  <Button
                    type="button"
                    onClick={handleSortCartItems}
                    variant="secondary"
                    size="sm"
                    className="flex items-center space-x-2"
                    title="Sort products alphabetically"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    <span>Sort A-Z</span>
                  </Button>
                )}
                <div className="flex items-center space-x-2">
                  <CostPriceToggleButton
                    canView={hasPermission(PERMISSIONS.VIEW_PRODUCT_COSTS)}
                    enabled={showCostPrice}
                    onToggle={setShowCostPrice}
                    title={showCostPrice ? "Hide buying price (cost)" : "Show buying price (cost)"}
                  />
                  <ProfitToggleButton
                    canView={hasPermission(PERMISSIONS.VIEW_BP)}
                    enabled={showProfit}
                    onToggle={setShowProfit}
                    totalProfit={totalProfit}
                    showProfitValue
                  />
                </div>
              </div>
              <ApplyLastPricesButton
                canApply={hasPermission(PERMISSIONS.APPLY_LAST_PRICES)}
                hasCustomer={!!selectedCustomer}
                hasItems={cart.length > 0}
                isApplied={isLastPricesApplied}
                isApplying={isLoadingLastPrices}
                isRestoring={isRestoringPrices}
                onApply={handleApplyLastPrices}
                onRestore={handleRestoreCurrentPrices}
              />
            </>
          }
          searchSection={
            <ProductSearch
              key={productSearchResetKey}
              onFocusReady={handleProductSearchFocusReady}
              onAddProduct={addToCart}
              selectedCustomer={selectedCustomer}
              showCostPrice={showCostPrice && globalShowCostPriceAllowed}
              hasCostPricePermission={hasPermission(PERMISSIONS.VIEW_PRODUCT_COSTS)}
              priceType={priceType}
              dualUnitShowBoxInput={dualUnitShowBoxInputEnabled}
              dualUnitShowPiecesInput={dualUnitShowPiecesInputEnabled}
              onRefetchReady={setRefetchProducts}
              allowSaleWithoutProduct={allowSaleWithoutProductEnabled}
              allowManualCostPrice={allowManualCostPriceEnabled}
              onLastPurchasePriceFetched={(productId, price) => {
                setLastPurchasePrices(prev => ({
                  ...prev,
                  [productId]: price
                }));
              }}
            />
          }
          isEmpty={cart.length === 0}
          emptyIcon={ShoppingCart}
          emptyText="No items in cart"
        >
          <CartItemsTableSection
            className="pt-2"
            topContent={isLastPricesApplied && Object.keys(priceStatus).length > 0 ? (
              <LastPricesStatusLegend className="mb-3" />
            ) : null}
            desktopHeader={null}
          >
            <div
              ref={cartScrollRef}
              className={
                cartNeedsInnerScroll
                  ? 'max-h-[min(70vh,860px)] overflow-y-auto -mx-1 px-1 [scrollbar-gutter:stable]'
                  : 'overflow-visible -mx-1 px-1'
              }
            >
              <div
                className="relative w-full"
                style={{ height: `${cartVirtualizer.getTotalSize()}px` }}
              >
                {cartVirtualizer.getVirtualItems().map((virtualRow) => {
                  const item = cart[virtualRow.index];
                  const index = virtualRow.index;
                  const totalPrice = item.unitPrice * item.quantity;
                  const isLowStock = item.product.inventory?.currentStock <= item.product.inventory?.reorderPoint;

                  const serialHighlight = highlightedCartLineIndex === index;
                  const lineDisplayCost = getProductDisplayCostPrice(item.product);
                  const lineEffectiveCost = getCartLineEffectiveCost(item.product, lastPurchasePrices);
                  const isBelowCost =
                    hasPermission(PERMISSIONS.VIEW_PRODUCT_COSTS) &&
                    lineEffectiveCost != null &&
                    item.unitPrice < lineEffectiveCost;

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={(node) => {
                        cartVirtualizer.measureElement(node);
                        if (node) cartLineElRefs.current.set(index, node);
                        else cartLineElRefs.current.delete(index);
                      }}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      {/* Mobile Card View */}
                      <div className="lg:hidden mb-4 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0 flex items-center gap-3">
                            {showProductImages && (
                              <LineItemThumbnail
                                src={item.product?.imageUrl}
                                size="md"
                                onClick={() => setPreviewImageProduct(item.product)}
                                crossOrigin="anonymous"
                              />
                            )}
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <LineItemSerial
                                  index={index}
                                  highlight={serialHighlight}
                                  variant="mobile"
                                />
                                <span className="font-medium text-sm truncate">
                                  {getProductDisplayName(item.product, 'Product')}
                                </span>
                              </div>
                              {item.product.isVariant && (
                                <span className="text-xs text-gray-500 block">
                                  {item.product.variantType}: {item.product.variantValue}
                                </span>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {isLowStock && <span className="text-yellow-600 text-xs">⚠️ Low Stock</span>}
                                {isBelowCost && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">
                                      ⚠️ Loss
                                    </span>
                                  )}
                                {isLastPricesApplied && (
                                  <LineItemPriceStatusBadge status={priceStatus[item.product._id]} />
                                )}
                              </div>
                            </div>
                          </div>
                          <LineItemRemoveButton
                            onClick={() => removeFromCart(item.product._id)}
                            loading={isRemovingFromCart[item.product._id]}
                            className="h-8 w-8 p-0 flex-shrink-0 ml-2"
                          />
                        </div>
                        <div
                          className={`grid gap-2 ${
                            hasDualUnit(item.product) && dualUnitShowBoxInputEnabled
                              ? 'grid-cols-5'
                              : 'grid-cols-4'
                          }`}
                        >
                          {hasDualUnit(item.product) && dualUnitShowBoxInputEnabled && (
                            <div className="min-w-0">
                              <label className="block text-[10px] font-medium text-gray-500 mb-1 truncate">Box</label>
                              <LineItemBoxInputCell
                                product={item.product}
                                item={item}
                                onChange={(value) => updateCartBoxCount(item.product._id, value)}
                                className="px-1 text-xs"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <label className="block text-[10px] font-medium text-gray-500 mb-1 truncate">Stock</label>
                            <LineItemStockCell
                              currentStock={item.product.inventory?.currentStock}
                              reorderPoint={item.product.inventory?.reorderPoint}
                              textSize="text-xs"
                              className="px-1"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[10px] font-medium text-gray-500 mb-1 truncate">Total</label>
                            <LineItemTotalCell
                              value={Math.round(totalPrice)}
                              textSize="text-xs"
                              className="px-1"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[10px] font-medium text-gray-500 mb-1 truncate">Quantity</label>
                            <DualUnitQuantityInput
                              product={item.product}
                              quantity={item.quantity}
                              onChange={(q, dual) => updateQuantity(item.product._id, q, dual)}
                              min={1}
                              max={999999}
                              stockPiecesForRemaining={item.product.inventory?.currentStock ?? 0}
                              showRemainingAfterSale={false}
                              showPiecesUnitLabel={false}
                              showBoxInput={dualUnitShowBoxInputEnabled && !hasDualUnit(item.product)}
                              showPiecesInput={dualUnitShowPiecesInputEnabled}
                              inputClassName="w-full min-w-0 text-center h-8 border border-gray-300 rounded px-1 text-sm"
                              compact={hasDualUnit(item.product)}
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[10px] font-medium text-gray-500 mb-1 truncate">Rate</label>
                            <Input
                              type="number"
                              step="1"
                              autoComplete="off"
                              value={Math.round(item.unitPrice)}
                              onChange={(e) => updateUnitPrice(item.product._id, parseInt(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              className={`text-center h-8 w-full px-1 text-sm ${isBelowCost
                                ? 'bg-red-50 border-red-400 ring-2 ring-red-300'
                                : ''
                                }`}
                              min="0"
                            />
                          </div>
                          {showCostPrice && hasPermission(PERMISSIONS.VIEW_PRODUCT_COSTS) && (
                            <div
                              className={
                                hasDualUnit(item.product) && dualUnitShowBoxInputEnabled
                                  ? 'col-span-5'
                                  : 'col-span-4'
                              }
                            >
                              <label className="block text-xs font-medium text-gray-500 mb-1">Cost</label>
                              <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 block text-center">
                                {lineDisplayCost ?? 'N/A'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Desktop Table Row */}
                      <div className={`hidden lg:block py-1 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <div
                          className={`grid gap-x-1 items-center ${dualUnitShowBoxInputEnabled
                            ? (
                              showCostPrice && hasPermission(PERMISSIONS.VIEW_PRODUCT_COSTS)
                                ? 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5rem_5.35rem_5.35rem_2.25rem]'
                                : 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
                            )
                            : (
                              showCostPrice && hasPermission(PERMISSIONS.VIEW_PRODUCT_COSTS)
                                ? 'grid-cols-[2.25rem_minmax(0,1fr)_5.35rem_5.35rem_5rem_5.35rem_5.35rem_2.25rem]'
                                : 'grid-cols-[2.25rem_minmax(0,1fr)_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
                            )
                            }`}
                        >
                          {/* Serial Number - 1 column */}
                          <div className="min-w-0 flex justify-start">
                            <LineItemSerial index={index} highlight={serialHighlight} />
                          </div>

                          {/* Product Name - mirror Sales Order layout (6 columns normally, 5 when cost column shown) */}
                          <div className="min-w-0 flex items-center h-8 gap-2">
                            {showProductImages && (
                              <LineItemThumbnail
                                src={item.product?.imageUrl}
                                onClick={() => setPreviewImageProduct(item.product)}
                                crossOrigin="anonymous"
                              />
                            )}
                            <div className="flex flex-col min-w-0 w-full">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="font-medium text-sm truncate min-w-0"
                                  title={item.product.isVariant
                                    ? (item.product.displayName || item.product.variantName || item.product.name)
                                    : item.product.name}
                                >
                                  {getProductDisplayName(item.product, 'Product')}
                                </span>
                                {isLowStock && <span className="text-yellow-600 text-xs whitespace-nowrap">⚠️ Low Stock</span>}
                                {/* Warning if sale price is below cost price (only if has permission) */}
                                {isBelowCost && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold whitespace-nowrap" title={`Sale price below cost! Loss: ${Math.round(lineEffectiveCost - item.unitPrice)} per unit`}>
                                      ⚠️ Loss
                                    </span>
                                  )}
                                {isLastPricesApplied && (
                                  <LineItemPriceStatusBadge
                                    status={priceStatus[item.product._id]}
                                    className="whitespace-nowrap"
                                  />
                                )}
                              </div>
                              {item.product.isVariant && (
                                <span className="text-xs text-gray-500 truncate">
                                  {item.product.variantType}: {item.product.variantValue}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Box — dual-unit boxes only; hidden fully when box input setting is off */}
                          {dualUnitShowBoxInputEnabled && (
                            <div className="min-w-0">
                              <LineItemBoxInputCell
                                product={item.product}
                                item={item}
                                onChange={(value) => updateCartBoxCount(item.product._id, value)}
                              />
                            </div>
                          )}

                          {/* Stock - 1 column */}
                          <div className="min-w-0">
                            <LineItemStockCell
                              currentStock={item.product.inventory?.currentStock}
                              reorderPoint={item.product.inventory?.reorderPoint}
                            />
                          </div>

                          {/* Quantity */}
                          <div className="min-w-0">
                            <DualUnitQuantityInput
                              product={item.product}
                              quantity={item.quantity}
                              onChange={(q, dual) => updateQuantity(item.product._id, q, dual)}
                              min={1}
                              max={999999}
                              stockPiecesForRemaining={item.product.inventory?.currentStock ?? 0}
                              showRemainingAfterSale={false}
                              showPiecesUnitLabel={false}
                              showBoxInput={dualUnitShowBoxInputEnabled && !hasDualUnit(item.product)}
                              showPiecesInput={dualUnitShowPiecesInputEnabled}
                              inputClassName="w-full min-w-0 text-center h-8 border border-gray-300 rounded px-2"
                              compact={hasDualUnit(item.product)}
                            />
                          </div>

                          {/* Purchase Price (Cost) - 1 column (conditional) - Between Quantity and Rate */}
                          {showCostPrice && hasPermission(PERMISSIONS.VIEW_PRODUCT_COSTS) && (
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 block text-center h-8 flex items-center justify-center" title="Cost Price">
                                {lineDisplayCost ?? 'N/A'}
                              </span>
                            </div>
                          )}

                          {/* Rate - 1 column */}
                          <div className="min-w-0 relative">
                            <Input
                              type="number"
                              step="1"
                              autoComplete="off"
                              value={Math.round(item.unitPrice)}
                              onChange={(e) => updateUnitPrice(item.product._id, parseInt(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              className={`text-center h-8 ${
                                isBelowCost
                                  ? 'bg-red-50 border-red-400 ring-2 ring-red-300'
                                  : priceStatusInputClasses(priceStatus[item.product._id])
                                }`}
                              min="0"
                              title={
                                isBelowCost
                                  ? `⚠️ WARNING: Sale price ($${Math.round(item.unitPrice)}) is below cost price ($${Math.round(lineEffectiveCost)})`
                                  : ''
                              }
                            />
                            {isLastPricesApplied && (
                              <LineItemPriceStatusIcon status={priceStatus[item.product._id]} />
                            )}
                          </div>

                          {/* Total - 1 column */}
                          <div className="min-w-0">
                            <LineItemTotalCell value={Math.round(totalPrice)} />
                          </div>

                          {/* Delete Button - 1 column */}
                          <div className="min-w-0 flex justify-end">
                            <LineItemRemoveButton
                              onClick={() => removeFromCart(item.product._id)}
                              loading={isRemovingFromCart[item.product._id]}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CartItemsTableSection>
        </ProductSelectionCartSection>

        {/* Sales Details (left) + totals & payment (right) on lg+; full width of card */}
        {cart.length > 0 && (
          <div
            className={`mt-4 grid w-full min-w-0 grid-cols-1 gap-4 lg:gap-5 lg:items-start ${showSalesDetailsFields ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
              }`}
          >
            <OrderCheckoutCard className={`mt-0 ml-0 max-w-none min-w-0 w-full border-slate-200 bg-none bg-slate-50 shadow-sm ring-0 ${showSalesDetailsFields ? 'order-1' : 'order-2'}`}>
              <OrderDetailsSection
                detailsTitle="Sales Details"
                showDetails={showSalesDetailsFields}
                onShowDetailsChange={setShowSalesDetailsFields}
                checkboxId="showSalesDetailsFields"
              >
                {/* Mobile Layout - Stacked */}
                {showSalesDetailsFields && (
                  <div className="md:hidden space-y-3">
                    {/* Order Type */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Order Type
                      </label>
                      {/*
                    In edit mode, show the invoice's saved order type.
                    Previously this UI was tied to `selectedCustomer.businessType`, which could differ from
                    what was used when the invoice was created (causing the "price type" mismatch).
                  */}
                      <select
                        value={resolveOrderTypeForSave(priceType, activeEditData?.orderType)}
                        className="h-10 text-sm w-full"
                        disabled
                      >
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="return">Return</option>
                        <option value="exchange">Exchange</option>
                      </select>
                    </div>

                    {/* Invoice Number */}
                    <DocumentNumberField
                      id="autoGenerateInvoiceMobile"
                      label="Invoice Number"
                      manualPlaceholder="Enter invoice number"
                      autoGenerate={autoGenerateInvoice}
                      onAutoGenerateChange={(checked) => {
                        setAutoGenerateInvoice(checked);
                        if (checked && selectedCustomer) {
                          setInvoiceNumber(generateInvoiceNumber(selectedCustomer));
                        }
                      }}
                      value={invoiceNumber}
                      onChange={setInvoiceNumber}
                      onRegenerate={() => {
                        if (selectedCustomer) {
                          setInvoiceNumber(generateInvoiceNumber(selectedCustomer));
                        }
                      }}
                      containerClassName=""
                      inputClassName="w-full pr-20 h-10 text-sm"
                    />

                    {/* Bill Date (for backdating) */}
                    <DateFilter mode="single"
                      label={<>Bill Date <span className="text-gray-500 font-normal">(Optional - for backdating)</span></>}
                      value={billDate}
                      onChange={setBillDate}
                      size="sm"
                      placeholder="Today"
                    />

                    <OrderNotesField
                      value={notes}
                      onChange={setNotes}
                      density="comfortable"
                    />
                  </div>
                )}

                {/* Desktop Layout — wrap & start-align so half-width column uses full width */}
                {showSalesDetailsFields && (
                  <div className="hidden md:flex flex-wrap gap-3 items-end justify-start">
                    {/* Order Type */}
                    <div className="flex flex-col w-44">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Order Type
                      </label>
                      <select
                        value={resolveOrderTypeForSave(priceType, activeEditData?.orderType)}
                        className="h-8 text-sm"
                        disabled
                      >
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="return">Return</option>
                        <option value="exchange">Exchange</option>
                      </select>
                    </div>

                    {/* Invoice Number */}
                    <DocumentNumberField
                      id="autoGenerateInvoice"
                      label="Invoice Number"
                      manualPlaceholder="Enter invoice number"
                      autoGenerate={autoGenerateInvoice}
                      onAutoGenerateChange={(checked) => {
                        setAutoGenerateInvoice(checked);
                        if (checked && selectedCustomer) {
                          setInvoiceNumber(generateInvoiceNumber(selectedCustomer));
                        }
                      }}
                      value={invoiceNumber}
                      onChange={setInvoiceNumber}
                      onRegenerate={() => {
                        if (selectedCustomer) {
                          setInvoiceNumber(generateInvoiceNumber(selectedCustomer));
                        }
                      }}
                    />

                    {/* Bill Date (for backdating) - Desktop */}
                    <div className="w-44">
                      <DateFilter mode="single"
                        label={<>Bill Date <span className="text-gray-500 font-normal">(Optional)</span></>}
                        value={billDate}
                        onChange={setBillDate}
                        size="sm"
                        placeholder="Today"
                      />
                    </div>

                    <OrderNotesField
                      value={notes}
                      onChange={setNotes}
                    />
                  </div>
                )}
              </OrderDetailsSection>
            </OrderCheckoutCard>

            <OrderCheckoutCard className={`mt-0 ml-0 max-w-none min-w-0 w-full border-slate-200 bg-none bg-slate-50 shadow-sm ring-0 ${showSalesDetailsFields ? 'order-2' : 'order-1'}`}>
              <OrderSummaryBar>
                <div className="flex items-center gap-3">
                  <LoadingButton
                    onClick={handleCheckout}
                    isLoading={isSubmitting || isCreatingSale || isUpdatingOrder}
                    disabled={isSubmitting || isCreatingSale || isUpdatingOrder}
                    variant="default"
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 text-white border-none h-8 px-4 font-bold"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    {activeEditData?.isEditMode
                      ? (amountPaid === 0 ? 'Update Invoice' : 'Update Sale')
                      : (amountPaid === 0 ? 'Create Invoice' : 'Complete Sale')
                    }
                  </LoadingButton>

                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                    {cart.length > 0 && (
                      <LoadingButton
                        onClick={handleClearCart}
                        isLoading={isClearingCart}
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        title="Clear Cart"
                      >
                        <Trash2 className="h-4 w-4" />
                      </LoadingButton>
                    )}
                    {cart.length > 0 && (
                      <div className="flex items-center gap-1">
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
                              onClick={() => setDirectPrintOrder(buildSalesCartOrder())}
                            >
                              <Printer className="h-4 w-4 mr-2" />
                              Print
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCurrentOrder(buildSalesCartOrder());
                                setShowPrintModal(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Print Preview
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <WhatsAppShareButton
                          orderData={buildSalesCartOrder()}
                          documentTitle="Sales Invoice"
                          partyLabel="Customer"
                          requireSaved={!activeEditData?.orderId}
                          showLabel={false}
                          size="sm"
                          className="h-8 w-8 border-none shadow-none bg-transparent hover:bg-green-50"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </OrderSummaryBar>
              <OrderSummaryContent className="bg-none bg-slate-50">
                <div className="space-y-2">
                  {totalDiscountAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Discount:</span>
                      <span className="text-xl font-semibold tabular-nums text-red-600">-{Math.round(totalDiscountAmount)}</span>
                    </div>
                  )}
                  {taxSystemEnabled && tax > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Tax ({globalTaxPercent}%):</span>
                      <span className="text-xl font-semibold tabular-nums text-foreground">{Math.round(tax)}</span>
                    </div>
                  )}
                  {selectedCustomer && (() => {
                    const { previousBalance, totalReceivables } = checkoutPartyBalances;

                    return (
                      <div className="mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
                          {/* 1. Subtotal */}
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Subtotal</span>
                            <div className="h-8 flex items-center px-2 bg-slate-50 border border-gray-200 rounded-md text-xl font-semibold tabular-nums text-foreground">
                              {Math.round(subtotal)}
                            </div>
                          </div>

                          {/* 2. Manual Discount */}
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Discount</label>
                              <select
                                value={directDiscount.type}
                                onChange={(e) => {
                                  const nextType = e.target.value;
                                  setDirectDiscount((prev) => {
                                    const raw = Number(prev.value) || 0;
                                    const nextValue = nextType === 'percentage'
                                      ? Math.min(Math.max(raw, 0), 100)
                                      : Math.min(Math.max(raw, 0), Math.max(0, Math.round(subtotal)));
                                    return { ...prev, type: nextType, value: nextValue };
                                  });
                                }}
                                className="border-none bg-transparent p-0 text-[10px] font-bold text-primary-600 focus:ring-0 cursor-pointer"
                              >
                                <option value="amount">Amt</option>
                                <option value="percentage">%</option>
                              </select>
                            </div>
                            <Input
                              type="number"
                              placeholder="0"
                              value={directDiscount.value || ''}
                              onChange={(e) => {
                                const raw = parseInt(e.target.value, 10) || 0;
                                const value = directDiscount.type === 'percentage'
                                  ? Math.min(Math.max(raw, 0), 100)
                                  : Math.min(Math.max(raw, 0), Math.max(0, Math.round(subtotal)));
                                setDirectDiscount((prev) => ({ ...prev, value }));
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-full h-8 px-2 border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-primary-400 text-sm font-medium shadow-none"
                            />
                          </div>

                          {/* 3. Net Amount */}
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Net Amount</span>
                            <div className="h-8 flex items-center px-2 bg-slate-50 border border-gray-200 rounded-md text-xl font-bold tabular-nums text-primary">
                              {Number(total.toFixed(2))}
                            </div>
                          </div>

                          {/* 4. Previous Balance */}
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Prev. Bal</span>
                            <div className="h-8 flex items-center px-2 bg-slate-50 border border-gray-200 rounded-md text-xl font-semibold tabular-nums text-foreground">
                              {previousBalance < 0 ? '-' : '+'}{Math.abs(Number(previousBalance.toFixed(2)))}
                            </div>
                          </div>

                          {/* 5. Payment Method & Amount Paid */}
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Payment</label>
                              <PaymentMethodSelect
                                value={paymentMethod}
                                bankAccountId={selectedBankAccount}
                                banks={activeBanks}
                                showSelectBankPlaceholder
                                onChange={(method, bankId) => {
                                  setPaymentMethod(method);
                                  setSelectedBankAccount(bankId);
                                }}
                              />
                            </div>
                            <Input
                              type="number"
                              step="1"
                              autoComplete="off"
                              value={Math.round(amountPaid)}
                              onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              className="w-full h-8 px-2 border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-primary-400 text-sm font-medium shadow-none"
                              placeholder="0"
                            />
                          </div>

                          {/* 6. Total Receivables — same formula as invoice print Remaining Balance */}
                          <div className="flex flex-col">
                            <span className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${totalReceivables < 0 ? 'text-red-700' : 'text-green-700'}`}>
                              Receivables
                            </span>
                            <div className={`h-8 flex items-center px-2 bg-slate-50 border border-gray-200 rounded-md text-xl font-bold tabular-nums ${totalReceivables < 0 ? 'text-red-700' : 'text-green-700'}`}>
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

                {/* Payment and Discount Section - One Row */}
                {showSalesDiscountCodeEnabled && (
                  <OrderInsetPanel>
                    {/* Discount code (from Discount Management) */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Discount code
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value=""
                          onChange={handleSelectDiscountFromDropdown}
                          disabled={subtotal <= 0 || applicableDiscountList.length === 0}
                          className="h-10 px-3 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-medium text-foreground min-w-[180px] max-w-full"
                          title="Choose an applicable discount"
                        >
                          <option value="">
                            {subtotal <= 0
                              ? 'Add items to see discounts'
                              : applicableDiscountList.length === 0
                                ? 'No applicable discounts'
                                : 'Select discount code...'}
                          </option>
                          {applicableDiscountList
                            .filter(
                              (item) =>
                                !appliedDiscounts.some(
                                  (d) =>
                                    (d.code || '').toUpperCase() ===
                                    (item.discount?.code || item.discount?.discount_code || '').toString().toUpperCase()
                                )
                            )
                            .map((item) => {
                              const d = item.discount || {};
                              const code = (d.code || d.discount_code || '').toString();
                              const amt = item.calculatedAmount ?? 0;
                              const label =
                                d.type === 'percentage'
                                  ? `${code} - ${d.value}% off (${typeof amt === 'number' ? amt.toFixed(2) : amt})`
                                  : `${code} - ${typeof amt === 'number' ? amt.toFixed(2) : amt} off`;
                              return (
                                <option key={code} value={code}>
                                  {label}
                                </option>
                              );
                            })}
                        </select>
                      </div>
                      {appliedDiscounts.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {appliedDiscounts.map((d) => (
                            <span
                              key={d.code}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium"
                            >
                              {d.code} -{typeof d.amount === 'number' ? d.amount.toFixed(2) : d.amount}
                              <button
                                type="button"
                                onClick={() => handleRemoveDiscountCode(d.code)}
                                className="ml-1 text-green-600 hover:text-green-900"
                                aria-label="Remove"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </OrderInsetPanel>
                )}

                {/* Action Buttons */}
              </OrderSummaryContent>
            </OrderCheckoutCard>
          </div>
        )}

        {/* Sales Invoices: single header row — title, filters, and actions */}
        <div className="mt-4 card">
          <div className="card-header py-3">
            <div className="flex flex-col gap-3">
              {/* Row 1: Title, Records (desktop), and Refresh */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Sales Invoices</h3>
                  <span className="hidden sm:inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    {savedInvoicesPagination.total ?? savedInvoices.length} records
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => refetchSavedInvoices()}
                    className="p-2 text-gray-400 transition-colors hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    title="Refresh"
                  >
                    {isSavedInvoicesLoading ? (
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
                        startDate={savedInvoiceFromDate}
                        endDate={savedInvoiceToDate}
                        onDateChange={(start, end) => {
                          setSavedInvoiceFromDate(start || '');
                          setSavedInvoiceToDate(end || '');
                          setSavedInvoicePage(1);
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
                        getData={getSavedInvoicesExportData} 
                        label="" 
                        className="h-10 w-10 p-0 hidden sm:flex"
                      />
                      <PdfExportButton 
                        ref={pdfExportRef}
                        getData={getSavedInvoicesExportData} 
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
                        onClick={() => refetchSavedInvoices()}
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
                        id="saved-invoice-search"
                        type="text"
                        placeholder="Invoice / customer…"
                        value={savedInvoiceSearchTerm}
                        onChange={(e) => {
                          setSavedInvoiceSearchTerm(e.target.value);
                          setSavedInvoicePage(1);
                        }}
                        className="input h-10 w-full pl-9 bg-gray-50 border-gray-200 focus:bg-white text-sm"
                      />
                    </div>
                    <div className="w-full sm:w-48">
                      <select
                        id="saved-invoice-status"
                        value={savedInvoiceStatus}
                        onChange={(e) => {
                          setSavedInvoiceStatus(e.target.value);
                          setSavedInvoicePage(1);
                        }}
                        className="input h-10 w-full bg-gray-50 border-gray-200 text-sm"
                      >
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="received">Received</option>
                        <option value="paid">Paid</option>
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
            {isSavedInvoicesLoading ? (
              <div className="p-8 text-center">
                <LoadingInline message="Loading sales invoices..." />
              </div>
            ) : savedInvoicesError ? (
              <div className="p-8 text-center text-red-600">
                <p>{getErrorMessage(savedInvoicesError) || 'Error loading sales invoices'}</p>
              </div>
            ) : savedInvoices.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No sales invoices found for the selected criteria.</p>
              </div>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {savedInvoices.map((invoice, index) => {
                        const invoiceId = invoice?._id ?? invoice?.id ?? `saved-invoice-${index}`;
                        const invoiceNumber = invoice?.order_number ?? invoice?.orderNumber ?? invoice?.invoiceNumber ?? '—';
                        const customerName =
                          invoice?.customer?.business_name ??
                          invoice?.customer?.businessName ??
                          invoice?.customer?.displayName ??
                          invoice?.customer?.name ??
                          invoice?.customerInfo?.businessName ??
                          invoice?.customerInfo?.business_name ??
                          invoice?.customerInfo?.name ??
                          'Walk-in';
                        const invoiceDate = invoice?.sale_date ?? invoice?.billDate ?? invoice?.order_date ?? invoice?.created_at ?? invoice?.createdAt;
                        const totalValue = Number(invoice?.pricing?.total ?? invoice?.total ?? 0) || 0;
                        return (
                          <tr key={invoiceId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {invoiceDate ? new Date(invoiceDate).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{invoiceNumber}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{customerName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                              {(() => {
                                const paymentStatus = getDerivedPaymentStatus(invoice);
                                return (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPaymentStatusBadgeClass(paymentStatus)}`}>
                                    {paymentStatus}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Math.round(totalValue)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => openSavedInvoicePrintPreview(invoice)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Print"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                <WhatsAppShareButton
                                  getOrderData={() => fetchFreshSavedInvoice(invoice)}
                                  documentTitle="Sales Invoice"
                                  partyLabel="Customer"
                                  requireSaved
                                  showLabel={false}
                                  size="sm"
                                  className="border-none shadow-none bg-transparent hover:bg-green-50 p-0 h-auto w-auto"
                                />
                                <ExcelExportButton
                                  getData={async () => {
                                    const printPerms = getPartyPermissions('customer');
                                    try {
                                      const result = await fetchOrderById(invoice?._id || invoice?.id).unwrap();
                                      const freshOrder = result?.order || result?.data?.order || result || invoice;
                                      const payload = getInvoicePdfPayload(freshOrder, companySettings, 'Sales Invoice', 'Customer', null, printPerms);
                                      return {
                                        ...payload,
                                        filename: `Sales_Invoice_${invoiceNumber}.xlsx`,
                                      };
                                    } catch (err) {
                                      return {
                                        ...getInvoicePdfPayload(invoice, companySettings, 'Sales Invoice', 'Customer', null, printPerms),
                                        filename: `Sales_Invoice_${invoiceNumber}.xlsx`,
                                      };
                                    }
                                  }}
                                  label=""
                                  className="p-1 bg-transparent border-none shadow-none hover:bg-transparent text-emerald-600 hover:text-emerald-800 px-1 py-1"
                                />
                                <PdfExportButton
                                  getData={async () => {
                                    const printPerms = getPartyPermissions('customer');
                                    try {
                                      const result = await fetchOrderById(invoice?._id || invoice?.id).unwrap();
                                      const freshOrder = result?.order || result?.data?.order || result || invoice;
                                      return getInvoicePdfPayload(freshOrder, companySettings, 'Sales Invoice', 'Customer', null, printPerms);
                                    } catch (err) {
                                      return getInvoicePdfPayload(invoice, companySettings, 'Sales Invoice', 'Customer', null, printPerms);
                                    }
                                  }}
                                  label=""
                                  className="p-1 bg-transparent border-none shadow-none hover:bg-transparent text-red-600 hover:text-red-800 px-1 py-1"
                                />
                                <button
                                  onClick={() => handleEditSavedInvoice(invoice)}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setInvoiceDeleteTarget(invoice)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  page={Number(savedInvoicesPagination.current ?? savedInvoicePage) || 1}
                  totalPages={Math.max(1, Number(savedInvoicesPagination.pages) || 1)}
                  onPageChange={(p) => setSavedInvoicePage(p)}
                  totalItems={savedInvoicesPagination.total}
                  limit={savedInvoiceLimit}
                />
              </>
            )}
          </div>
        </div>
      </PageLayout>

      {/* Clear Cart Confirmation Dialog */}
      <ClearConfirmationDialog
        isOpen={clearConfirmation.isOpen}
        onClose={handleClearCancel}
        onConfirm={handleClearConfirm}
        itemCount={cart.length}
        itemType="items"
        isLoading={false}
      />

      <DuplicateLineItemMergeModal
        isOpen={!!duplicateCartMerge}
        onClose={() => {
          setDuplicateCartMerge(null);
          refocusProductSearch();
        }}
        onConfirm={handleDuplicateCartMergeConfirm}
        productName={duplicateCartMerge?.displayName ?? ''}
        currentQuantity={
          duplicateCartMerge
            ? cart.find((c) => normalizeCartProductId(c.product) === duplicateCartMerge.productId)?.quantity ?? 0
            : 0
        }
        quantityToAdd={duplicateCartMerge?.pendingItem?.quantity ?? 0}
        newTotalQuantity={
          duplicateCartMerge
            ? (cart.find((c) => normalizeCartProductId(c.product) === duplicateCartMerge.productId)?.quantity ?? 0) +
              (duplicateCartMerge?.pendingItem?.quantity ?? 0)
            : 0
        }
        scopeLabel="invoice"
        title="Duplicate product"
        confirmText="Update quantity"
      />

      <BaseModal
        isOpen={!!invoiceDeleteTarget}
        onClose={() => setInvoiceDeleteTarget(null)}
        title="Delete Sales Invoice"
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button type="button" variant="secondary" onClick={() => setInvoiceDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => handleDeleteSavedInvoice()}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-700">
          Are you sure you want to delete invoice{' '}
          <span className="font-semibold">
            {invoiceDeleteTarget?.order_number ?? invoiceDeleteTarget?.orderNumber ?? invoiceDeleteTarget?._id ?? invoiceDeleteTarget?.id}
          </span>
          ? This action cannot be undone.
        </p>
      </BaseModal>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setCurrentOrder(null);
        }}
        orderData={currentOrder}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentError={handlePaymentError}
      />

      {/* Direct Print - no modal, opens print dialog immediately */}
      {directPrintOrder && (
        <DirectPrintInvoice
          orderData={directPrintOrder}
          documentTitle="Sales Invoice"
          partyLabel="Customer"
          onComplete={() => {
            const isTemp = directPrintOrder?.orderNumber?.startsWith('TEMP-');
            if (!isTemp) {
              resetSaleDraft({ resetBillDate: true });
            }
            setDirectPrintOrder(null);
          }}
        />
      )}

      {/* Print Preview Modal */}
      <PrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setCurrentOrder(null);
        }}
        orderData={currentOrder}
        documentTitle="Sales Invoice"
        partyLabel="Customer"
      />

      <PrintModal
        isOpen={showSavedInvoicePrintModal}
        onClose={() => {
          setShowSavedInvoicePrintModal(false);
          setSavedInvoicePrintOrder(null);
        }}
        orderData={savedInvoicePrintOrder}
        documentTitle="Sales Invoice"
        partyLabel="Customer"
      />

      <ProductImagePreviewModal
        product={previewImageProduct}
        onClose={() => setPreviewImageProduct(null)}
      />

    </AsyncErrorBoundary>
  );
};
