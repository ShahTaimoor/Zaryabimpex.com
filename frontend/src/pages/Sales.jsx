import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  TrendingUp,
  Calculator,
  Receipt,
  Printer,
  History,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Info,
  Eye,
  EyeOff,
  XCircle,
  ArrowUpDown,
  ChevronDown,
  Camera
} from 'lucide-react';
import BaseModal from '../components/BaseModal';
import { useLazyGetLastPurchasePriceQuery, useGetLastPurchasePricesMutation } from '../store/services/productsApi';
import { useGetCustomerQuery, useLazySearchCustomersQuery } from '../store/services/customersApi';
import { useDebouncedCustomerSearch } from '../hooks/useDebouncedCustomerSearch';
import {
  useCreateSaleMutation,
  useUpdateOrderMutation,
  useLazyGetLastPricesQuery,

} from '../store/services/salesApi';
import { useCheckApplicableDiscountsMutation } from '../store/services/discountsApi';
import { useGetBanksQuery } from '../store/services/banksApi';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { DualUnitQuantityInput } from '../components/DualUnitQuantityInput';
import {
  hasDualUnit,
  getPiecesPerBox,
  piecesToBoxesAndPieces,
  computeTotalPieces,
  formatStockDualLabel,
} from '../utils/dualUnitUtils';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  OrderCheckoutCard,
  OrderDetailsSection,
  OrderSummaryContent,
  OrderInsetPanel,
  OrderCheckoutActions,
} from '../components/order/OrderCheckoutLayout';
import { ProductSelectionCartSection } from '../components/order/ProductSelectionCartSection';
import { CartItemsTableSection } from '../components/order/CartItemsTableSection';
import { CartTableHeader } from '../components/order/CartTableHeader';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import AsyncErrorBoundary from '../components/AsyncErrorBoundary';
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
import RecommendationSection from '../components/RecommendationSection';
import useBehaviorTracking from '../hooks/useBehaviorTracking';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../components/ComponentRegistry';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyInfo } from '../hooks/useCompanyInfo';

import { getLocalDateString } from '../utils/dateUtils';

import { ProductSearch } from '../components/sales/ProductSearch';

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
  // Store refetch function from ProductSearch component
  const [refetchProducts, setRefetchProducts] = useState(null);

  const [cart, setCart] = useState([]);
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
  const [isTaxExempt, setIsTaxExempt] = useState(true);
  const [directDiscount, setDirectDiscount] = useState({ type: 'amount', value: 0 });
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false); // Default to false as requested
  const [showSalesDetailsFields, setShowSalesDetailsFields] = useState(false);
  const [billDate, setBillDate] = useState(getLocalDateString()); // Default to current date for backdating invoices
  const [notes, setNotes] = useState('');
  const [isLoadingLastPrices, setIsLoadingLastPrices] = useState(false);
  const [isRestoringPrices, setIsRestoringPrices] = useState(false);
  const [isClearingCart, setIsClearingCart] = useState(false);
  const [isRemovingFromCart, setIsRemovingFromCart] = useState({});
  const [originalPrices, setOriginalPrices] = useState({}); // Store original prices before applying last prices
  const [isApplyingLastPrices, setIsApplyingLastPrices] = useState(false);
  const [isLastPricesApplied, setIsLastPricesApplied] = useState(false);
  const [priceStatus, setPriceStatus] = useState({}); // Track price change status: 'updated', 'not-found', 'unchanged'
  const [previewImageProduct, setPreviewImageProduct] = useState(null);
  const [showCostPrice, setShowCostPrice] = useState(false); // Toggle to show/hide cost prices
  const [showProductImages, setShowProductImages] = useState(localStorage.getItem('showProductImagesUI') !== 'false');

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
  const { trackAddToCart, trackProductView, trackPageView } = useBehaviorTracking();
  const { activeTabId, updateTabTitle, getActiveTab, openTab } = useTab();
  const { hasPermission, user } = useAuth();
  const { companyInfo: companySettings } = useCompanyInfo();

  const allowSaleWithoutProductEnabled = companySettings.orderSettings?.allowSaleWithoutProduct === true;
  const allowManualCostPriceEnabled = companySettings.orderSettings?.allowManualCostPrice === true;
  const globalShowCostPriceAllowed = companySettings.orderSettings?.showCostPrice !== false; // Default to true if not set

  const dualUnitShowBoxInputEnabled = companySettings.orderSettings?.dualUnitShowBoxInput !== false;
  const dualUnitShowPiecesInputEnabled = companySettings.orderSettings?.dualUnitShowPiecesInput !== false;
  const showSalesDiscountCodeEnabled = companySettings.orderSettings?.showSalesDiscountCode === true;
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

      const lastPurchaseCost =
        productId && lastPurchasePrices[productId] !== undefined
          ? Number(lastPurchasePrices[productId])
          : null;

      const fallbackCost =
        lastPurchaseCost ??
        Number(item.product.pricing?.cost) ??
        Number(item.product.pricing?.purchasePrice) ??
        Number(item.product.pricing?.wholesaleCost) ??
        0;

      const profitPerUnit = salePrice - (Number.isFinite(fallbackCost) ? fallbackCost : 0);
      const lineProfit = profitPerUnit * quantity;

      return sum + (Number.isFinite(lineProfit) ? lineProfit : 0);
    }, 0);
  }, [cart, lastPurchasePrices]);

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
    const nameStr = customer.displayName ?? customer.businessName ?? customer.name ?? 'CUST';
    const customerInitials = String(nameStr)
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3) || 'CUS';

    return `INV-${customerInitials}-${year}${month}${day}-${time}`;
  };

  // Handle edit data when component is opened for editing
  useEffect(() => {
    if (editData && editData.isEditMode && editData.orderId) {
      // Set the customer
      if (editData.customer) {
        setSelectedCustomer(editData.customer);
      }

      // Set the invoice number
      if (editData.orderNumber) {
        setInvoiceNumber(editData.orderNumber);
        setAutoGenerateInvoice(false); // Don't auto-generate when editing
      }

      // Set the notes
      if (editData.notes) {
        setNotes(editData.notes);
      }

      // Set the cart items
      if (editData.items && editData.items.length > 0) {
        const formattedItems = editData.items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice || item.price || (item.product?.pricing?.retail || 0),
          totalPrice: item.totalPrice || (item.quantity * (item.unitPrice || item.price || (item.product?.pricing?.retail || 0)))
        }));
        setCart(formattedItems);
      }

      // Set tax exempt status
      if (editData.isTaxExempt !== undefined) {
        setIsTaxExempt(editData.isTaxExempt);
      }

      // Restore existing discounts in edit mode (code + manual)
      const rawAppliedDiscounts = Array.isArray(editData.appliedDiscounts)
        ? editData.appliedDiscounts
        : Array.isArray(editData.applied_discounts)
          ? editData.applied_discounts
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
        editData.discountAmount ??
        editData.discount ??
        editData.pricing?.discountAmount ??
        editData.pricing?.discount ??
        0
      ) || 0;
      const appliedDiscountTotal = hydratedAppliedDiscounts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      const manualDiscountForEdit = Math.max(0, invoiceDiscountRaw - appliedDiscountTotal);
      setDirectDiscount({ type: 'amount', value: manualDiscountForEdit });

      // Set payment method and amount paid if available
      if (editData.payment) {
        setPaymentMethod(editData.payment.method || 'cash');
        // IMPORTANT:
        // When the invoice is pending, Amount Paid should NOT be derived from amountReceived.
        // Some backend payloads may include `amountReceived` even when payment was never made,
        // which incorrectly pre-fills the full sale amount in edit mode.
        const paymentStatusRaw =
          editData.payment.status ??
          editData.paymentStatus ??
          editData.payment_status ??
          'pending';
        const normalizedPaymentStatus = String(paymentStatusRaw).toLowerCase();

        const orderStatusRaw =
          editData.orderStatus ??
          editData.status ??
          editData.order_status ??
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
            : (editData.payment.amountPaid ??
              editData.payment.amountReceived ??
              editData.amountPaid ??
              0));
        const normalizedPaid = Number(paidFromPayload);
        setAmountPaid(Number.isFinite(normalizedPaid) && normalizedPaid >= 0 ? normalizedPaid : 0);
        if (editData.payment.method === 'bank') {
          setSelectedBankAccount(editData.payment.bankAccount || '');
        } else {
          setSelectedBankAccount('');
        }
      }

      // Set price type from order type (so user can see and change it in edit mode)
      if (editData.orderType) {
        const ot = String(editData.orderType).toLowerCase();
        if (ot === 'retail' || ot === 'wholesale' || ot === 'distributor' || ot === 'custom') {
          setPriceType(ot);
        }
      }
      // Bill date: when editing, show the existing invoice date
      if (editData.billDate) {
        const d = editData.billDate instanceof Date ? editData.billDate : new Date(editData.billDate);
        setBillDate(!isNaN(d.getTime()) ? getLocalDateString(d) : getLocalDateString());
      } else {
        setBillDate(getLocalDateString());
      }

      // Data loaded successfully (no toast needed as Orders already shows opening message)
    }
  }, [editData?.orderId]); // Only depend on orderId to prevent multiple executions

  // RTK Query hooks
  const { data: banksData, isLoading: banksLoading } = useGetBanksQuery(
    { isActive: true },
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
  const [getLastPrices] = useLazyGetLastPricesQuery();

  const [checkApplicableDiscounts] = useCheckApplicableDiscountsMutation();
  const [applicableDiscountList, setApplicableDiscountList] = useState([]);

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
  const customerWithBalance = selectedCustomerDetail?.data?.customer ?? selectedCustomerDetail?.customer ?? selectedCustomerDetail ?? selectedCustomer;

  const activeBanks = useMemo(
    () => {
      const banks = banksData?.data?.banks || banksData?.banks || [];
      return banks.filter((bank) => bank.isActive !== false);
    },
    [banksData]
  );

  useEffect(() => {
    if (paymentMethod === 'bank' && !selectedBankAccount) {
      const defaultBank = activeBanks.find((bank) => bank?.isDefault) || activeBanks[0];
      if (defaultBank?._id) {
        setSelectedBankAccount(defaultBank._id);
      }
    }
  }, [paymentMethod, selectedBankAccount, activeBanks]);

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
  const codeDiscountAmount = appliedDiscounts.reduce((sum, discount) => sum + discount.amount, 0);

  // Fetch applicable discount codes when cart subtotal or customer changes
  useEffect(() => {
    if (subtotal <= 0) {
      setApplicableDiscountList([]);
      return;
    }
    let cancelled = false;
    checkApplicableDiscounts({
      orderData: { total: subtotal },
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
  }, [subtotal, selectedCustomer?._id, selectedCustomer?.id]);

  let directDiscountAmount = 0;
  if (directDiscount.value > 0) {
    if (directDiscount.type === 'percentage') {
      directDiscountAmount = (subtotal * directDiscount.value) / 100;
    } else {
      directDiscountAmount = Math.min(directDiscount.value, subtotal);
    }
  }

  const totalDiscountAmount = codeDiscountAmount + directDiscountAmount;
  const subtotalAfterDiscount = subtotal - totalDiscountAmount;
  const tax = isTaxExempt ? 0 : subtotalAfterDiscount * 0.08;
  const total = subtotalAfterDiscount + tax;
  const change = amountPaid - total;
  const manualDiscountDisplay = Math.max(0, Math.round(directDiscountAmount || 0));

  // Map businessType to orderType
  // businessType: ['retail', 'wholesale', 'distributor', 'individual']
  // orderType: ['retail', 'wholesale', 'return', 'exchange']
  const mapBusinessTypeToOrderType = (bt) => {
    // If bt is not provided, use selectedCustomer's type as fallback
    const businessType = bt || selectedCustomer?.business_type || selectedCustomer?.businessType;
    if (!businessType) return 'retail';

    const type = String(businessType).toLowerCase();
    if (type === 'retail' || type === 'wholesale') return type;
    if (type === 'distributor') return 'wholesale'; // Distributors are wholesale customers
    if (type === 'individual') return 'retail'; // Individuals are retail customers
    return 'retail'; // Default fallback
  };

  const handleCustomerSelect = async (customer) => {
    setSelectedCustomer(customer);

    // Reset price states when customer changes
    setOriginalPrices({});
    setIsLastPricesApplied(false);
    setPriceStatus({});

    // Auto-set price type based on customer business type
    if (customer?.businessType) {
      if (customer.businessType === 'retail' || customer.businessType === 'individual') {
        setPriceType('retail');
      } else if (customer.businessType === 'wholesale') {
        setPriceType('wholesale');
      } else if (customer.businessType === 'distributor') {
        setPriceType('distributor');
      }
    }

    // Auto-generate invoice number if enabled
    if (autoGenerateInvoice && customer) {
      setInvoiceNumber(generateInvoiceNumber(customer));
    }

    // Update tab title to show customer name
    const activeTab = getActiveTab();
    if (activeTab && customer) {
      const customerLabel = customer.businessName ?? customer.business_name ?? customer.displayName ?? customer.name ?? 'Customer';
      updateTabTitle(activeTab.id, `Sales - ${customerLabel}`);
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

    let highlightLineIndex = null;

    setCart(prevCart => {
      // For variants, use variant _id; for products, use product _id
      const itemId = product._id ?? product.id;
      const existingItem = prevCart.find(c => (c.product?._id ?? c.product?.id) === itemId);

      if (existingItem) {
        highlightLineIndex = prevCart.findIndex(c => (c.product?._id ?? c.product?.id) === itemId);
        // Check if combined quantity exceeds available stock
        const combinedQuantity = existingItem.quantity + item.quantity;
        const availableStock = product.inventory?.currentStock || 0;

        if (combinedQuantity > availableStock) {
          const displayName = product.isVariant
            ? (product.displayName || product.variantName || product.name)
            : product.name;
          toast.warning(`Stock for ${displayName} is insufficient. Adding ${item.quantity} units anyway.`);
        }

        const newQty = existingItem.quantity + item.quantity;
        const ppb = getPiecesPerBox(product);
        const { boxes, pieces } = ppb ? piecesToBoxesAndPieces(newQty, ppb) : {};
        const updatedCart = prevCart.map(c =>
          (c.product?._id ?? c.product?.id) === itemId
            ? { ...c, quantity: newQty, ...(ppb && { boxes, pieces }), unitPrice: item.unitPrice }
            : c
        );

        return updatedCart;
      }

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
                [itemId]: response.lastPurchasePrice
              }));
            }
          })
          .catch(() => {
            // Silently fail - last purchase price is optional
          });
      }

      // New item added - don't store in originalPrices since it wasn't there before
      // applying last prices, so there's nothing to restore
      return [...prevCart, item];
    });

    if (highlightLineIndex !== null && highlightLineIndex >= 0) {
      setHighlightedCartLineIndex(highlightLineIndex);
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
      const costPrice = lastPurchasePrices[productId] !== undefined
        ? lastPurchasePrices[productId]
        : cartItem.product.pricing?.cost;
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

  const handleApplyLastPrices = async () => {
    if (!selectedCustomer) {
      showErrorToast('Please select a customer first');
      return;
    }

    if (cart.length === 0) {
      showErrorToast('Please add products to cart first');
      return;
    }

    setIsLoadingLastPrices(true);
    try {
      const result = await getLastPrices(selectedCustomer._id);

      // Check if there was an error in the request
      if (result.error) {
        showErrorToast(result.error?.data?.message || 'Failed to retrieve last prices');
        setIsLoadingLastPrices(false);
        return;
      }

      // Check if the request was successful and has data
      if (!result || !result.data) {
        showErrorToast('No previous order found for this customer');
        setIsLoadingLastPrices(false);
        return;
      }

      // The API returns data directly: { success, prices, orderNumber, orderDate }
      const response = result.data;

      // Handle both possible response structures
      const prices = response?.prices || (response?.data && response.data.prices);
      const orderNumber = response?.orderNumber || (response?.data && response.data.orderNumber);
      const orderDate = response?.orderDate || (response?.data && response.data.orderDate);

      if (!prices || (typeof prices === 'object' && Object.keys(prices).length === 0)) {
        showErrorToast('No previous order found for this customer');
        setIsLoadingLastPrices(false);
        return;
      }

      // Store original prices before applying last prices
      const originalPricesMap = {};
      const priceStatusMap = {};
      cart.forEach(cartItem => {
        const productId = cartItem.product._id.toString();
        originalPricesMap[productId] = cartItem.unitPrice;
      });
      setOriginalPrices(originalPricesMap);

      // Apply last prices to matching products in cart
      let updatedCount = 0;
      let unchangedCount = 0;
      let notFoundCount = 0;
      const updatedCart = cart.map(cartItem => {
        const productId = cartItem.product._id.toString();
        if (prices[productId]) {
          const lastPrice = prices[productId].unitPrice;
          const currentPrice = cartItem.unitPrice;

          if (lastPrice !== currentPrice) {
            // Price changed
            updatedCount++;
            priceStatusMap[productId] = 'updated';
            return {
              ...cartItem,
              unitPrice: lastPrice
            };
          } else {
            // Price is the same
            unchangedCount++;
            priceStatusMap[productId] = 'unchanged';
            return cartItem;
          }
        } else {
          // Product not found in last order
          notFoundCount++;
          priceStatusMap[productId] = 'not-found';
          return cartItem;
        }
      });

      setCart(updatedCart);
      setPriceStatus(priceStatusMap);
      setIsLastPricesApplied(true);

      const orderDateStr = orderDate ? new Date(orderDate).toLocaleDateString() : 'previous order';
      if (updatedCount > 0) {
        let message = `Applied prices from ${orderNumber || 'previous order'} (${orderDateStr}). Updated ${updatedCount} product(s).`;
        if (unchangedCount > 0) {
          message += ` ${unchangedCount} product(s) had same price.`;
        }
        if (notFoundCount > 0) {
          message += ` ${notFoundCount} product(s) not found in previous order.`;
        }
        showSuccessToast(message);
      } else if (unchangedCount > 0) {
        showSuccessToast(`All products already have the same prices as in ${orderNumber || 'previous order'} (${orderDateStr}).`);
      } else {
        showErrorToast('No matching products found in previous order');
      }
    } catch (error) {
      handleApiError(error, 'Apply Last Prices');
    } finally {
      setIsLoadingLastPrices(false);
    }
  };

  const handleRestoreCurrentPrices = () => {
    if (Object.keys(originalPrices).length === 0) {
      showErrorToast('No original prices to restore');
      return;
    }

    setIsRestoringPrices(true);
    try {
      // Restore original prices
      let restoredCount = 0;
      const restoredCart = cart.map(cartItem => {
        const productId = cartItem.product._id.toString();
        if (originalPrices[productId] !== undefined) {
          restoredCount++;
          return {
            ...cartItem,
            unitPrice: originalPrices[productId]
          };
        }
        return cartItem;
      });

      setCart(restoredCart);
      setIsLastPricesApplied(false);
      setOriginalPrices({});
      setPriceStatus({});

      if (restoredCount > 0) {
        showSuccessToast(`Restored original prices for ${restoredCount} product(s).`);
      } else {
        showErrorToast('No matching products found to restore');
      }
    } finally {
      setIsRestoringPrices(false);
    }
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
          setIsTaxExempt(true);
          setDirectDiscount({ type: 'amount', value: 0 });
          setIsAdvancePayment(false);
          setInvoiceNumber('');
          setPaymentMethod('cash');
          setSelectedBankAccount('');
          setAmountPaid(0);
          setOriginalPrices({});
          setIsLastPricesApplied(false);
          setPriceStatus({});
          setPriceType('wholesale');

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

      // RTK Query invalidatesTags will automatically refetch Products and Customers
      // No need to manually refetch - it happens automatically via cache invalidation
      // This prevents React warnings about updating components during render

      // Reset cart and form
      setCart([]);
      setHighlightedCartLineIndex(null);
      // Don't reset selectedCustomer immediately - let it update from refetched data
      // setSelectedCustomer(null);
      setAmountPaid(0);
      setAppliedDiscounts([]);
      setDirectDiscount({ type: 'amount', value: 0 });
      setNotes('');
      setInvoiceNumber('');
      setBillDate(getLocalDateString()); // Reset to current date
      setLastPurchasePrices({});
      setOriginalPrices({});
      setIsLastPricesApplied(false);
      setPriceStatus({});

      // Show print modal if order was created and autoPrint is enabled
      if (result?.order) {
        if (autoPrint) {
          setCurrentOrder(result.order);
          setShowPrintModal(true);
        }
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
        // The request might complete successfully, wait a bit longer
        setTimeout(() => {
          resetSubmittingState();
        }, (retryAfter + 2) * 1000);
      } else {
        handleApiError(error, 'Create Sale');
        resetSubmittingState();
      }
    }
  }, [createSale, resetSubmittingState]);

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

      // RTK Query invalidatesTags will automatically refetch Products and Customers
      // No need to manually refetch - it happens automatically via cache invalidation
      // This prevents React warnings about updating components during render

      // Reset cart and form
      setCart([]);
      setHighlightedCartLineIndex(null);
      // Don't reset selectedCustomer immediately - let it update from refetched data
      // setSelectedCustomer(null);
      setAmountPaid(0);
      setAppliedDiscounts([]);
      setDirectDiscount({ type: 'amount', value: 0 });
      setNotes('');
      setInvoiceNumber('');
      setLastPurchasePrices({});
      setOriginalPrices({});
      setIsLastPricesApplied(false);
      setPriceStatus({});

      // Show print modal if order was updated and autoPrint is enabled
      if (result?.order) {
        if (autoPrint) {
          setCurrentOrder(result.order);
          setShowPrintModal(true);
        }
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
      } else {
        handleApiError(error, 'Update Order');
        resetSubmittingState();
      }
    }
  }, [updateOrder, resetSubmittingState, isSubmittingRef]);

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
      orderType: mapBusinessTypeToOrderType(selectedCustomer?.businessType),
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
      isTaxExempt: isTaxExempt,
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
    if (editData?.isEditMode) {
      const orderId = editData.orderId;
      // For updates, send items with all required fields according to orderItemSchema
      const updateData = {
        orderType: mapBusinessTypeToOrderType(selectedCustomer?.businessType),
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
    isTaxExempt,
    invoiceNumber,
    billDate,
    notes,
    selectedBankAccount,
    isAdvancePayment,
    editData,
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
      <div className="space-y-4 lg:space-y-6">
        <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start justify-between'}`}>
          <div>
            <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>Point of Sales</h1>
            <p className="text-gray-600">Process sales transactions</p>
          </div>
          <div className="flex items-center space-x-2">

            <Button
              onClick={() => {
                const componentInfo = getComponentInfo('/sales');
                if (componentInfo) {
                  const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  openTab({
                    title: 'Sales',
                    path: '/sales',
                    component: componentInfo.component,
                    icon: componentInfo.icon,
                    allowMultiple: true,
                    props: { tabId: newTabId }
                  });
                }
              }}
              variant="default"
              size="default"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Sales
            </Button>
          </div>
        </div>

        {/* Customer Selection and Information Row */}
        <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start space-x-12'}`}>
          {/* Customer Selection */}
          <div className={`${isMobile ? 'w-full' : 'w-[750px] flex-shrink-0'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Customer
                </label>
                {selectedCustomer && (
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearchTerm('');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                    title="Change customer"
                  >
                    Change Customer
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                  <label className="text-xs font-normal text-gray-400">Price Type:</label>
                  <select
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value)}
                    className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400"
                  >
                    <option value="wholesale">Wholesale</option>
                    <option value="retail">Retail</option>
                    <option value="distributor">Distributor</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
            </div>
            <SearchableDropdown
              placeholder="Search customers by name, email, or business..."
              items={customers || []}
              onSelect={handleCustomerSelect}
              onSearch={setCustomerSearchTerm}
              selectedItem={selectedCustomer}
              rightContentKey="city"
              displayKey={(customer) => {
                const name = customer?.displayName ?? customer?.display_name ?? customer?.businessName ?? customer?.business_name ?? customer?.name ?? 'Customer';
                const totalBalance = customer?.currentBalance !== undefined && customer?.currentBalance !== null
                  ? Number(customer.currentBalance)
                  : (Number(customer?.pendingBalance ?? 0) - Number(customer?.advanceBalance ?? 0));
                const hasBalance = totalBalance !== 0 && !Number.isNaN(totalBalance);
                const isPayable = totalBalance < 0;
                const isReceivable = totalBalance > 0;

                return (
                  <div>
                    <div className="font-medium">{name}</div>
                    {hasBalance ? (
                      <div className={`text-sm ${isPayable ? 'text-red-600' : 'text-green-600'}`}>
                        Total Balance: {isPayable ? '-' : '+'}{Math.abs(totalBalance).toFixed(2)}
                      </div>
                    ) : null}
                  </div>
                );
              }}
              loading={customersLoading || customersFetching}
              emptyMessage="No customers found"
            />
          </div>

          {/* Customer Information - Right Side */}
          <div className={`${isMobile ? 'w-full' : 'flex-1'}`}>
            {selectedCustomer ? (() => {
              // Prioritize balance from selectedCustomer (from list with bulk balances - already correct)
              // Then fallback to customerWithBalance (from detail query) if needed
              const balanceSource = selectedCustomer ?? customerWithBalance;
              const creditLimitNum = Math.max(0, Number(selectedCustomer?.creditLimit ?? selectedCustomer?.credit_limit ?? balanceSource?.creditLimit ?? balanceSource?.credit_limit ?? 0) || 0);
              // Use currentBalance from selectedCustomer first (already correct from bulk query)
              const rawBalance = selectedCustomer?.currentBalance !== undefined && selectedCustomer?.currentBalance !== null
                ? Number(selectedCustomer.currentBalance)
                : (balanceSource?.currentBalance !== undefined && balanceSource?.currentBalance !== null
                  ? Number(balanceSource.currentBalance)
                  : (Number(balanceSource?.pendingBalance ?? 0) - Number(balanceSource?.advanceBalance ?? 0)));
              const currentBalanceNum = (isNaN(rawBalance) || rawBalance === null || rawBalance === undefined) ? 0 : rawBalance;
              const availableCreditNum = Math.max(0, creditLimitNum - currentBalanceNum);
              return (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">{selectedCustomer.businessName || selectedCustomer.business_name || selectedCustomer.displayName || selectedCustomer.name}</p>
                      <p className="text-sm text-gray-600 capitalize">
                        {selectedCustomer.businessType ?? '—'} • {selectedCustomer.phone || 'No phone'}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 flex-wrap gap-y-1">
                        {(() => {
                          const isPayable = currentBalanceNum < 0;
                          const isReceivable = currentBalanceNum > 0;
                          return (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-gray-500">Balance:</span>
                              <span className={`text-sm font-medium ${isPayable ? 'text-red-600' : isReceivable ? 'text-green-600' : 'text-gray-600'}`}>
                                {isPayable ? '-' : ''}{Math.abs(currentBalanceNum).toFixed(2)}
                              </span>
                            </div>
                          );
                        })()}
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">Credit Limit:</span>
                          <span className={`text-sm font-medium ${(creditLimitNum > 0) ? (
                            currentBalanceNum >= creditLimitNum * 0.9
                              ? 'text-red-600'
                              : currentBalanceNum >= creditLimitNum * 0.7
                                ? 'text-yellow-600'
                                : 'text-blue-600'
                          ) : 'text-gray-600'
                            }`}>
                            {creditLimitNum.toFixed(2)}
                          </span>
                          {creditLimitNum > 0 && currentBalanceNum >= creditLimitNum * 0.9 && (
                            <span className="text-xs text-red-600 font-bold ml-1">⚠️</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">Available Credit:</span>
                          <span className={`text-sm font-medium ${creditLimitNum > 0 ? (
                            availableCreditNum <= creditLimitNum * 0.1
                              ? 'text-red-600'
                              : availableCreditNum <= creditLimitNum * 0.3
                                ? 'text-yellow-600'
                                : 'text-green-600'
                          ) : 'text-gray-600'
                            }`}>
                            {availableCreditNum.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="hidden lg:block">
                {/* Empty space to maintain layout consistency */}
              </div>
            )}
          </div>
        </div>

        {/* Combined Product Selection and Cart Section */}
        <ProductSelectionCartSection
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
                  {globalShowCostPriceAllowed && (
                    <Button
                      type="button"
                      onClick={() => setShowCostPrice((prev) => !prev)}
                      variant="secondary"
                      size="sm"
                      className="flex items-center space-x-2"
                      title={showCostPrice ? "Hide buying price (cost)" : "Show buying price (cost)"}
                    >
                      {showCostPrice ? (
                        <>
                          <EyeOff className="h-4 w-4" />
                          <span>Hide Cost</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          <span>Show Cost</span>
                        </>
                      )}
                    </Button>
                  )}
                  {user?.role === 'admin' && (
                    <>
                      <Button
                        type="button"
                        onClick={() => setShowProfit((prev) => !prev)}
                        variant="secondary"
                        size="sm"
                        className="flex items-center space-x-2"
                        title="Show estimated profit (BP)"
                      >
                        <Calculator className="h-4 w-4" />
                        <span>{showProfit ? 'Hide BP' : 'Show BP'}</span>
                      </Button>
                      {showProfit && (
                        <span className={`text-sm font-semibold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {new Intl.NumberFormat('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(totalProfit || 0)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              {selectedCustomer && cart.length > 0 && (
                <>
                  {!isLastPricesApplied ? (
                    <LoadingButton
                      onClick={handleApplyLastPrices}
                      isLoading={isLoadingLastPrices}
                      variant="secondary"
                      size="sm"
                      title="Apply prices from last order for this customer"
                    >
                      <History className="h-4 w-4 mr-2" />
                      Apply Last Prices
                    </LoadingButton>
                  ) : (
                    <LoadingButton
                      onClick={handleRestoreCurrentPrices}
                      isLoading={isRestoringPrices}
                      variant="secondary"
                      size="sm"
                      className="flex items-center space-x-2"
                      title="Restore original/current prices"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Restore Current Prices</span>
                    </LoadingButton>
                  )}
                </>
              )}
            </>
          }
          searchSection={
            <ProductSearch
              onAddProduct={addToCart}
              selectedCustomer={selectedCustomer}
              showCostPrice={showCostPrice && globalShowCostPriceAllowed}
              hasCostPricePermission={hasPermission('view_cost_prices')}
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
            topContent={isLastPricesApplied && Object.keys(priceStatus).length > 0 ? (
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
            ) : null}
            desktopHeader={(
              <CartTableHeader
                className={`hidden md:grid gap-x-1 items-center pb-2 border-b border-gray-300 mb-2 ${dualUnitShowBoxInputEnabled
                  ? (
                    showCostPrice && hasPermission('view_cost_prices')
                      ? 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5rem_5.35rem_5.35rem_2.25rem]'
                      : 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
                  )
                  : (
                    showCostPrice && hasPermission('view_cost_prices')
                      ? 'grid-cols-[2.25rem_minmax(0,1fr)_5.35rem_5.35rem_5rem_5.35rem_5.35rem_2.25rem]'
                      : 'grid-cols-[2.25rem_minmax(0,1fr)_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
                  )
                  }`}
                columns={[
                  { key: 'sno', label: 'S.NO', labelClassName: 'text-xs font-semibold text-gray-600 uppercase text-left' },
                  { key: 'product', label: 'Product' },
                  ...(dualUnitShowBoxInputEnabled ? [{ key: 'box', label: 'Box' }] : []),
                  { key: 'stock', label: 'Stock' },
                  { key: 'qty', label: 'Qty' },
                  ...(showCostPrice && hasPermission('view_cost_prices') ? [{ key: 'cost', label: 'Cost' }] : []),
                  { key: 'rate', label: 'Rate' },
                  { key: 'total', label: 'Total', labelClassName: 'text-xs font-semibold text-gray-600 uppercase block text-center' },
                  { key: 'action', label: 'Action', wrapperClassName: 'min-w-0 flex justify-end', labelClassName: 'text-xs font-semibold text-gray-600 uppercase text-right' },
                ]}
              />
            )}
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
                  <div className="md:hidden mb-4 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        {item.product?.imageUrl && showProductImages && (
                          <div
                            className="h-10 w-10 flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200 cursor-pointer hover:border-primary-500 transition-colors group relative"
                            onClick={() => setPreviewImageProduct(item.product)}
                            title="Click to view full size"
                          >
                            <img src={item.product.imageUrl} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                              <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors duration-300 ${
                                serialHighlight
                                  ? 'bg-green-100 text-green-800 border border-green-400 ring-2 ring-green-300/80'
                                  : 'text-gray-500 bg-gray-100'
                              }`}
                            >
                              #{index + 1}
                            </span>
                            <span className="font-medium text-sm truncate">
                              {item.product.isVariant
                                ? (item.product.displayName || item.product.variantName || item.product.name)
                                : item.product.name}
                            </span>
                          </div>
                          {item.product.isVariant && (
                            <span className="text-xs text-gray-500 block">
                              {item.product.variantType}: {item.product.variantValue}
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {isLowStock && <span className="text-yellow-600 text-xs">⚠️ Low Stock</span>}
                            {lastPurchasePrices[item.product._id] !== undefined &&
                              item.unitPrice < lastPurchasePrices[item.product._id] && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">
                                  ⚠️ Loss
                                </span>
                              )}
                            {isLastPricesApplied && priceStatus[item.product._id] && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${priceStatus[item.product._id] === 'updated'
                                ? 'bg-green-100 text-green-700'
                                : priceStatus[item.product._id] === 'unchanged'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                {priceStatus[item.product._id] === 'updated'
                                  ? 'Updated'
                                  : priceStatus[item.product._id] === 'unchanged'
                                    ? 'Same Price'
                                    : 'Not in Last Order'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <LoadingButton
                        onClick={() => removeFromCart(item.product._id)}
                        isLoading={isRemovingFromCart[item.product._id]}
                        variant="destructive"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0 ml-2"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </LoadingButton>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {hasDualUnit(item.product) && dualUnitShowBoxInputEnabled && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Box</label>
                          {(() => {
                            const ppb = getPiecesPerBox(item.product);
                            const boxVal =
                              item.boxes != null
                                ? item.boxes
                                : ppb
                                  ? piecesToBoxesAndPieces(item.quantity, ppb).boxes
                                  : 0;
                            return (
                              <input
                                type="number"
                                min={0}
                                value={item.quantity === 0 ? '' : boxVal}
                                onChange={(e) =>
                                  updateCartBoxCount(item.product._id, e.target.value)
                                }
                                onFocus={(e) => e.target.select()}
                                className={`text-sm font-semibold w-full rounded border px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-primary-500/35 ${(item.product.inventory?.currentStock || 0) === 0
                                  ? 'text-red-700 bg-red-50 border-red-200'
                                  : (item.product.inventory?.currentStock || 0) <=
                                    (item.product.inventory?.reorderPoint || 0)
                                    ? 'text-yellow-800 bg-yellow-50 border-yellow-200'
                                    : 'text-gray-700 bg-gray-100 border-gray-200'
                                  }`}
                                title="Full boxes"
                              />
                            );
                          })()}
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Stock</label>
                        <span className={`text-sm font-semibold px-2 py-1 rounded border block text-center ${(item.product.inventory?.currentStock || 0) === 0
                          ? 'text-red-700 bg-red-50 border-red-200'
                          : (item.product.inventory?.currentStock || 0) <= (item.product.inventory?.reorderPoint || 0)
                            ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                            : 'text-gray-700 bg-gray-100 border-gray-200'
                          }`}>
                          {item.product.inventory?.currentStock || 0}
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>
                        <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center">
                          {Math.round(totalPrice)}
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
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
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Rate</label>
                        <Input
                          type="number"
                          step="1"
                          autoComplete="off"
                          value={Math.round(item.unitPrice)}
                          onChange={(e) => updateUnitPrice(item.product._id, parseInt(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          className={`text-center h-8 w-full ${(lastPurchasePrices[item.product._id] !== undefined &&
                            item.unitPrice < lastPurchasePrices[item.product._id])
                            ? 'bg-red-50 border-red-400 ring-2 ring-red-300'
                            : ''
                            }`}
                          min="0"
                        />
                      </div>
                      {showCostPrice && hasPermission('view_cost_prices') && (
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Cost</label>
                          <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 block text-center">
                            {lastPurchasePrices[item.product._id] !== undefined
                              ? `${Math.round(lastPurchasePrices[item.product._id])}`
                              : 'N/A'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Desktop Table Row */}
                  <div className={`hidden md:block py-1 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <div
                      className={`grid gap-x-1 items-center ${dualUnitShowBoxInputEnabled
                        ? (
                          showCostPrice && hasPermission('view_cost_prices')
                            ? 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5rem_5.35rem_5.35rem_2.25rem]'
                            : 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
                        )
                        : (
                          showCostPrice && hasPermission('view_cost_prices')
                            ? 'grid-cols-[2.25rem_minmax(0,1fr)_5.35rem_5.35rem_5rem_5.35rem_5.35rem_2.25rem]'
                            : 'grid-cols-[2.25rem_minmax(0,1fr)_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
                        )
                        }`}
                    >
                      {/* Serial Number - 1 column */}
                      <div className="min-w-0 flex justify-start">
                        <span
                          className={`text-sm font-medium px-0.5 py-1 rounded border block w-8 text-center h-8 flex items-center justify-center transition-colors duration-300 ${
                            serialHighlight
                              ? 'bg-green-100 text-green-800 border-green-400 ring-2 ring-green-300/80'
                              : 'text-gray-700 bg-gray-50 border-gray-200'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </div>

                      {/* Product Name - mirror Sales Order layout (6 columns normally, 5 when cost column shown) */}
                      <div className="min-w-0 flex items-center h-8 gap-2">
                        {item.product?.imageUrl && showProductImages && (
                          <div
                            className="h-8 w-8 flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200 cursor-pointer hover:border-primary-500 transition-colors group relative"
                            onClick={() => setPreviewImageProduct(item.product)}
                            title="Click to view full size"
                          >
                            <img src={item.product.imageUrl} alt="" crossOrigin="anonymous" className="h-full w-full object-cover shadow-sm" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                              <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 w-full">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="font-medium text-sm truncate min-w-0"
                              title={item.product.isVariant
                                ? (item.product.displayName || item.product.variantName || item.product.name)
                                : item.product.name}
                            >
                              {item.product.isVariant
                                ? (item.product.displayName || item.product.variantName || item.product.name)
                                : item.product.name}
                            </span>
                            {isLowStock && <span className="text-yellow-600 text-xs whitespace-nowrap">⚠️ Low Stock</span>}
                            {/* Warning if sale price is below cost price (always show, regardless of showCostPrice) */}
                            {lastPurchasePrices[item.product._id] !== undefined &&
                              item.unitPrice < lastPurchasePrices[item.product._id] && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold whitespace-nowrap" title={`Sale price below cost! Loss: ${Math.round(lastPurchasePrices[item.product._id] - item.unitPrice)} per unit`}>
                                  ⚠️ Loss
                                </span>
                              )}
                            {isLastPricesApplied && priceStatus[item.product._id] && (
                              <span className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${priceStatus[item.product._id] === 'updated'
                                ? 'bg-green-100 text-green-700'
                                : priceStatus[item.product._id] === 'unchanged'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                {priceStatus[item.product._id] === 'updated'
                                  ? 'Updated'
                                  : priceStatus[item.product._id] === 'unchanged'
                                    ? 'Same Price'
                                    : 'Not in Last Order'}
                              </span>
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
                          {hasDualUnit(item.product) ? (
                            (() => {
                              const ppb = getPiecesPerBox(item.product);
                              const boxVal =
                                item.boxes != null
                                  ? item.boxes
                                  : ppb
                                    ? piecesToBoxesAndPieces(item.quantity, ppb).boxes
                                    : 0;
                              return (
                                <input
                                  type="number"
                                  min={0}
                                  value={item.quantity === 0 ? '' : boxVal}
                                  onChange={(e) =>
                                    updateCartBoxCount(item.product._id, e.target.value)
                                  }
                                  onFocus={(e) => e.target.select()}
                                  className={`text-sm font-semibold w-full min-w-0 rounded border px-2 py-1 text-center h-8 focus:outline-none focus:ring-2 focus:ring-primary-500/35 ${(item.product.inventory?.currentStock || 0) === 0
                                    ? 'text-red-700 bg-red-50 border-red-200'
                                    : (item.product.inventory?.currentStock || 0) <=
                                      (item.product.inventory?.reorderPoint || 0)
                                      ? 'text-yellow-800 bg-yellow-50 border-yellow-200'
                                      : 'text-gray-700 bg-gray-100 border-gray-200'
                                    }`}
                                  title="Full boxes"
                                />
                              );
                            })()
                          ) : (
                            <span
                              className="text-sm font-semibold px-2 py-1 rounded border block text-center h-8 flex items-center justify-center text-gray-400 bg-gray-50 border-gray-200"
                              title="Not applicable"
                            >
                              —
                            </span>
                          )}
                        </div>
                      )}

                      {/* Stock - 1 column */}
                      <div className="min-w-0">
                        <span className={`text-sm font-semibold px-2 py-1 rounded border block text-center h-8 flex items-center justify-center ${(item.product.inventory?.currentStock || 0) === 0
                          ? 'text-red-700 bg-red-50 border-red-200'
                          : (item.product.inventory?.currentStock || 0) <= (item.product.inventory?.reorderPoint || 0)
                            ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                            : 'text-gray-700 bg-gray-100 border-gray-200'
                          }`}>
                          {item.product.inventory?.currentStock || 0}
                        </span>
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
                      {showCostPrice && hasPermission('view_cost_prices') && (
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 block text-center h-8 flex items-center justify-center" title="Cost Price">
                            {lastPurchasePrices[item.product._id] !== undefined
                              ? `${Math.round(lastPurchasePrices[item.product._id])}`
                              : item.product.pricing?.cost !== undefined
                                ? `${Math.round(item.product.pricing.cost)}`
                                : 'N/A'}
                          </span>
                        </div>
                      )}

                      {/* Rate - 1 column */}
                      <div className="min-w-0 relative">
                        {(() => {
                          const effectiveCost = lastPurchasePrices[item.product._id] !== undefined
                            ? lastPurchasePrices[item.product._id]
                            : item.product.pricing?.cost;
                          const isBelowCost = effectiveCost !== undefined && effectiveCost !== null && item.unitPrice < effectiveCost;

                          return (
                            <Input
                              type="number"
                              step="1"
                              autoComplete="off"
                              value={Math.round(item.unitPrice)}
                              onChange={(e) => updateUnitPrice(item.product._id, parseInt(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              className={`text-center h-8 ${
                                // Check if sale price is less than cost price - highest priority styling (always check)
                                isBelowCost
                                  ? 'bg-red-50 border-red-400 ring-2 ring-red-300'
                                  : priceStatus[item.product._id] === 'updated'
                                    ? 'bg-green-50 border-green-300 ring-1 ring-green-200'
                                    : priceStatus[item.product._id] === 'not-found'
                                      ? 'bg-yellow-50 border-yellow-300 ring-1 ring-yellow-200'
                                      : priceStatus[item.product._id] === 'unchanged'
                                        ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                                        : ''
                                }`}
                              min="0"
                              title={
                                isBelowCost
                                  ? `⚠️ WARNING: Sale price ($${Math.round(item.unitPrice)}) is below cost price ($${Math.round(effectiveCost)})`
                                  : ''
                              }
                            />
                          );
                        })()}
                        {isLastPricesApplied && priceStatus[item.product._id] && (
                          <div
                            className="absolute -right-7 top-1/2 transform -translate-y-1/2 flex items-center z-10"
                            title={
                              priceStatus[item.product._id] === 'updated'
                                ? 'Price updated from last order'
                                : priceStatus[item.product._id] === 'unchanged'
                                  ? 'Price same as last order'
                                  : 'Product not found in previous order'
                            }
                          >
                            {priceStatus[item.product._id] === 'updated' && (
                              <CheckCircle className="h-4 w-4 text-green-600 bg-white rounded-full" />
                            )}
                            {priceStatus[item.product._id] === 'unchanged' && (
                              <Info className="h-4 w-4 text-blue-600 bg-white rounded-full" />
                            )}
                            {priceStatus[item.product._id] === 'not-found' && (
                              <AlertCircle className="h-4 w-4 text-yellow-600 bg-white rounded-full" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Total - 1 column */}
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block w-full min-w-0 text-center h-8 flex items-center justify-center">
                          {Math.round(totalPrice)}
                        </span>
                      </div>

                      {/* Delete Button - 1 column */}
                      <div className="min-w-0 flex justify-end">
                        <LoadingButton
                          onClick={() => removeFromCart(item.product._id)}
                          isLoading={isRemovingFromCart[item.product._id]}
                          variant="destructive"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </LoadingButton>
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
                      {(() => {
                        const editOrderType = editData?.isEditMode ? editData?.orderType : null;
                        const normalizedEditOrderType = editOrderType ? String(editOrderType).toLowerCase() : null;
                        const allowed = new Set(['retail', 'wholesale', 'return', 'exchange']);
                        const valueToShow =
                          normalizedEditOrderType && allowed.has(normalizedEditOrderType)
                            ? normalizedEditOrderType
                            : mapBusinessTypeToOrderType(selectedCustomer?.businessType);
                        return (
                          <select
                            value={valueToShow}
                            className="h-10 text-sm w-full"
                            disabled
                          >
                            <option value="retail">Retail</option>
                            <option value="wholesale">Wholesale</option>
                            <option value="return">Return</option>
                            <option value="exchange">Exchange</option>
                          </select>
                        );
                      })()}
                    </div>

                    {/* Tax Exemption Option */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Tax Status
                      </label>
                      <div className="flex items-center space-x-2 px-3 py-2 border border-gray-200 rounded h-10">
                        <Input
                          type="checkbox"
                          id="taxExemptMobile"
                          checked={isTaxExempt}
                          onChange={(e) => setIsTaxExempt(e.target.checked)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <label htmlFor="taxExemptMobile" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Tax Exempt
                          </label>
                        </div>
                        {isTaxExempt && (
                          <div className="text-green-600 text-sm font-medium">
                            ✓
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Invoice Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-gray-700">
                          Invoice Number
                        </label>
                        <label
                          htmlFor="autoGenerateInvoiceMobile"
                          className="flex items-center space-x-1 text-xs text-gray-600 cursor-pointer select-none"
                        >
                          <Input
                            type="checkbox"
                            id="autoGenerateInvoiceMobile"
                            checked={autoGenerateInvoice}
                            onChange={(e) => {
                              setAutoGenerateInvoice(e.target.checked);
                              if (e.target.checked && selectedCustomer) {
                                setInvoiceNumber(generateInvoiceNumber(selectedCustomer));
                              }
                            }}
                            className="h-3.5 w-3.5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span>Auto-generate</span>
                        </label>
                      </div>
                      <div className="relative">
                        <Input
                          type="text"
                          autoComplete="off"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                          className="w-full pr-20 h-10 text-sm"
                          placeholder={autoGenerateInvoice ? 'Auto-generated' : 'Enter invoice number'}
                          disabled={autoGenerateInvoice}
                        />
                        {autoGenerateInvoice && (
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedCustomer) {
                                setInvoiceNumber(generateInvoiceNumber(selectedCustomer));
                              }
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-primary-600 hover:text-primary-800 font-medium"
                          >
                            Regenerate
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bill Date (for backdating) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Bill Date <span className="text-gray-500">(Optional - for backdating)</span>
                      </label>
                      <Input
                        type="date"
                        autoComplete="off"
                        value={billDate}
                        onChange={(e) => setBillDate(e.target.value)}
                        className="h-10 text-sm w-full"
                        max={getLocalDateString()} // Prevent future dates
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <Input
                        type="text"
                        autoComplete="off"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="h-10 text-sm w-full"
                        placeholder="Additional notes..."
                      />
                    </div>
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
                        value={
                          (() => {
                            const editOrderType = editData?.isEditMode ? editData?.orderType : null;
                            const normalizedEditOrderType = editOrderType ? String(editOrderType).toLowerCase() : null;
                            const allowed = new Set(['retail', 'wholesale', 'return', 'exchange']);
                            return (
                              normalizedEditOrderType && allowed.has(normalizedEditOrderType)
                                ? normalizedEditOrderType
                                : mapBusinessTypeToOrderType(selectedCustomer?.businessType)
                            );
                          })()
                        }
                        className="h-8 text-sm"
                        disabled
                      >
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="return">Return</option>
                        <option value="exchange">Exchange</option>
                      </select>
                    </div>

                    {/* Tax Exemption Option */}
                    <div className="flex flex-col w-40">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Tax Status
                      </label>
                      <div className="flex items-center space-x-1 px-2 py-1 border border-gray-200 rounded h-8">
                        <Input
                          type="checkbox"
                          id="taxExempt"
                          checked={isTaxExempt}
                          onChange={(e) => setIsTaxExempt(e.target.checked)}
                          className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <label htmlFor="taxExempt" className="text-xs font-medium text-gray-700 cursor-pointer">
                            Tax Exempt
                          </label>
                        </div>
                        {isTaxExempt && (
                          <div className="text-green-600 text-xs font-medium">
                            ✓
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Invoice Number */}
                    <div className="flex flex-col w-72">
                      <div className="flex items-center gap-3 mb-1">
                        <label className="block text-xs font-medium text-gray-700 m-0">
                          Invoice Number
                        </label>
                        <label
                          htmlFor="autoGenerateInvoice"
                          className="flex items-center space-x-1 text-[11px] text-gray-600 cursor-pointer select-none"
                        >
                          <Input
                            type="checkbox"
                            id="autoGenerateInvoice"
                            checked={autoGenerateInvoice}
                            onChange={(e) => {
                              setAutoGenerateInvoice(e.target.checked);
                              if (e.target.checked && selectedCustomer) {
                                setInvoiceNumber(generateInvoiceNumber(selectedCustomer));
                              }
                            }}
                            className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span>Auto-generate</span>
                        </label>
                      </div>
                      <div className="relative">
                        <Input
                          type="text"
                          autoComplete="off"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                          className="w-full pr-16 h-8 text-sm"
                          placeholder={autoGenerateInvoice ? 'Auto-generated' : 'Enter invoice number'}
                          disabled={autoGenerateInvoice}
                        />
                        {autoGenerateInvoice && (
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedCustomer) {
                                setInvoiceNumber(generateInvoiceNumber(selectedCustomer));
                              }
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[11px] text-primary-600 hover:text-primary-800 font-medium"
                          >
                            Regenerate
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bill Date (for backdating) - Desktop */}
                    <div className="flex flex-col w-44">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Bill Date <span className="text-gray-500">(Optional)</span>
                      </label>
                      <Input
                        type="date"
                        autoComplete="off"
                        value={billDate}
                        onChange={(e) => setBillDate(e.target.value)}
                        className="h-8 text-sm"
                        max={getLocalDateString()} // Prevent future dates
                      />
                    </div>

                    {/* Notes */}
                    <div className="flex min-w-0 flex-1 flex-col basis-[min(100%,20rem)]">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <Input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="h-8 w-full min-w-0 text-sm"
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                )}
              </OrderDetailsSection>
            </OrderCheckoutCard>

            <OrderCheckoutCard className={`mt-0 ml-0 max-w-none min-w-0 w-full border-slate-200 bg-none bg-slate-50 shadow-sm ring-0 ${showSalesDetailsFields ? 'order-2' : 'order-1'}`}>
              <OrderSummaryContent className="bg-none bg-slate-50">
                <div className="space-y-2">
                  {totalDiscountAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Discount:</span>
                      <span className="text-xl font-semibold tabular-nums text-red-600">-{Math.round(totalDiscountAmount)}</span>
                    </div>
                  )}
                  {!isTaxExempt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Tax (8%):</span>
                      <span className="text-xl font-semibold tabular-nums text-foreground">{Math.round(tax)}</span>
                    </div>
                  )}
                  {selectedCustomer && (() => {
                    // Match Print logic: invoiceBalance = net amount - received; previousBalance = ledger - invoiceBalance; totalReceivables = ledger
                    const ledgerBalance = selectedCustomer.currentBalance !== undefined && selectedCustomer.currentBalance !== null
                      ? Number(selectedCustomer.currentBalance)
                      : ((selectedCustomer.pendingBalance || 0) - (selectedCustomer.advanceBalance || 0));
                    const receivedAmount = amountPaid || 0;
                    const invoiceBalance = total - receivedAmount;
                    // In edit mode, ledger already includes this invoice; in new sale, it does not
                    const previousBalance = editData?.isEditMode
                      ? ledgerBalance - invoiceBalance
                      : ledgerBalance;
                    const totalReceivables = editData?.isEditMode
                      ? ledgerBalance
                      : ledgerBalance + invoiceBalance;

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
                          {(previousBalance !== 0 || editData?.isEditMode) && (
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

                {/* Payment and Discount Section - One Row */}
                <OrderInsetPanel>
                  {/* Discount code (from Discount Management) */}
                  {showSalesDiscountCodeEnabled && (
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
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start">
                    {/* Manual discount (amount or %) */}
                    <div className="flex flex-col">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Apply Discount (manual)
                      </label>
                      <div className="flex space-x-2">
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
                          className="h-10 px-3 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                        >
                          <option value="amount">Amount</option>
                          <option value="percentage">%</option>
                        </select>
                        <Input
                          type="number"
                          placeholder={directDiscount.type === 'amount' ? 'Enter amount...' : 'Enter percentage...'}
                          value={directDiscount.value || ''}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value, 10) || 0;
                            const value = directDiscount.type === 'percentage'
                              ? Math.min(Math.max(raw, 0), 100)
                              : Math.min(Math.max(raw, 0), Math.max(0, Math.round(subtotal)));
                            setDirectDiscount((prev) => ({ ...prev, value }));
                          }}
                          onFocus={(e) => e.target.select()}
                          className="flex-1 h-10 px-3 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-medium text-foreground"
                          min="0"
                          step={directDiscount.type === 'percentage' ? '1' : '1'}
                        />
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="flex flex-col md:col-start-2 md:row-start-1 w-full">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => {
                          const method = e.target.value;
                          setPaymentMethod(method);
                          if (method !== 'bank') {
                            setSelectedBankAccount('');
                          }
                        }}
                        className="w-full h-10 px-3 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-medium text-foreground"
                      >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="debit_card">Debit Card</option>
                        <option value="check">Check</option>
                        <option value="account">Account</option>
                        <option value="split">Split Payment</option>
                      </select>
                      {paymentMethod === 'bank' && (
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Bank Account
                          </label>
                          <select
                            value={selectedBankAccount}
                            onChange={(e) => setSelectedBankAccount(e.target.value)}
                            className="w-full h-10 px-3 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-medium text-foreground"
                          >
                            <option value="">Select bank account...</option>
                            {activeBanks.map((bank) => (
                              <option key={bank._id} value={bank._id}>
                                {bank.bankName} - {bank.accountNumber}
                                {bank.accountName ? ` (${bank.accountName})` : ''}
                              </option>
                            ))}
                          </select>
                          {banksLoading && (
                            <p className="text-xs text-gray-500 mt-1">Loading bank accounts...</p>
                          )}
                          {!banksLoading && activeBanks.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">
                              No bank accounts available. Add one in Banks.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Amount Paid */}
                    <div className="flex flex-col">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Amount Paid
                      </label>
                      <Input
                        type="number"
                        step="1"
                        value={Math.round(amountPaid)}
                        onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        className="w-full h-10 px-3 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-medium text-foreground text-lg"
                        placeholder="0"
                      />
                    </div>
                  </div>

                </OrderInsetPanel>

                {/* Action Buttons */}
                <OrderCheckoutActions>
                  {cart.length > 0 && (
                    <LoadingButton
                      onClick={handleClearCart}
                      isLoading={isClearingCart}
                      variant="secondary"
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Cart
                    </LoadingButton>
                  )}
                  {cart.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" className="flex-1">
                          <Printer className="h-4 w-4 mr-2" />
                          Print
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => {
                            let customerAddress = '';
                            if (selectedCustomer?.addresses?.length) {
                              const addr = selectedCustomer.addresses.find(a => a.isDefault) || selectedCustomer.addresses.find(a => a.type === 'billing' || a.type === 'both') || selectedCustomer.addresses[0];
                              if (addr) customerAddress = [addr.street, addr.city, addr.state, addr.country, addr.zipCode || addr.zip].filter(Boolean).join(', ');
                            } else if (selectedCustomer?.address) customerAddress = selectedCustomer.address;
                            const tempOrder = {
                              orderNumber: `TEMP-${Date.now()}`,
                              orderType: mapBusinessTypeToOrderType(selectedCustomer?.businessType),
                              customer: selectedCustomer ?? undefined,
                              customerInfo: selectedCustomer ? {
                                name: selectedCustomer.businessName || selectedCustomer.business_name || selectedCustomer.displayName || selectedCustomer.name,
                                email: selectedCustomer.email,
                                phone: selectedCustomer.phone,
                                businessName: selectedCustomer.businessName || selectedCustomer.business_name,
                                address: customerAddress || undefined,
                                currentBalance: selectedCustomer.currentBalance,
                                pendingBalance: selectedCustomer.pendingBalance,
                                advanceBalance: selectedCustomer.advanceBalance
                              } : null,
                              items: mapCartItemsForInvoicePrint(cart),
                              pricing: { subtotal, discountAmount: totalDiscountAmount, taxAmount: tax, isTaxExempt, total },
                              payment: {
                                method: paymentMethod,
                                bankAccount: paymentMethod === 'bank' ? selectedBankAccount : null,
                                amountPaid,
                                remainingBalance: total - amountPaid,
                                isPartialPayment: amountPaid < total,
                                isAdvancePayment,
                                advanceAmount: isAdvancePayment ? (amountPaid - total) : 0
                              },
                              createdAt: new Date(),
                              createdBy: user ? { firstName: user.firstName, lastName: user.lastName, name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin' } : { name: 'Admin' },
                              invoiceNumber
                            };
                            setDirectPrintOrder(tempOrder);
                          }}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Print
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            let customerAddress = '';
                            if (selectedCustomer?.addresses?.length) {
                              const addr = selectedCustomer.addresses.find(a => a.isDefault) || selectedCustomer.addresses.find(a => a.type === 'billing' || a.type === 'both') || selectedCustomer.addresses[0];
                              if (addr) customerAddress = [addr.street, addr.city, addr.state, addr.country, addr.zipCode || addr.zip].filter(Boolean).join(', ');
                            } else if (selectedCustomer?.address) customerAddress = selectedCustomer.address;
                            const tempOrder = {
                              orderNumber: `TEMP-${Date.now()}`,
                              orderType: mapBusinessTypeToOrderType(selectedCustomer?.businessType),
                              customer: selectedCustomer ?? undefined,
                              customerInfo: selectedCustomer ? {
                                name: selectedCustomer.businessName || selectedCustomer.business_name || selectedCustomer.displayName || selectedCustomer.name,
                                email: selectedCustomer.email,
                                phone: selectedCustomer.phone,
                                businessName: selectedCustomer.businessName || selectedCustomer.business_name,
                                address: customerAddress || undefined,
                                currentBalance: selectedCustomer.currentBalance,
                                pendingBalance: selectedCustomer.pendingBalance,
                                advanceBalance: selectedCustomer.advanceBalance
                              } : null,
                              items: mapCartItemsForInvoicePrint(cart),
                              pricing: { subtotal, discountAmount: totalDiscountAmount, taxAmount: tax, isTaxExempt, total },
                              payment: {
                                method: paymentMethod,
                                bankAccount: paymentMethod === 'bank' ? selectedBankAccount : null,
                                amountPaid,
                                remainingBalance: total - amountPaid,
                                isPartialPayment: amountPaid < total,
                                isAdvancePayment,
                                advanceAmount: isAdvancePayment ? (amountPaid - total) : 0
                              },
                              createdAt: new Date(),
                              createdBy: user ? { firstName: user.firstName, lastName: user.lastName, name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin' } : { name: 'Admin' },
                              invoiceNumber
                            };
                            setCurrentOrder(tempOrder);
                            setShowPrintModal(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Print Preview
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <div className="flex items-center space-x-2 px-2">
                    <Input
                      type="checkbox"
                      id="autoPrint"
                      checked={autoPrint}
                      onChange={(e) => setAutoPrint(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="autoPrint" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Print after sale
                    </label>
                  </div>
                  <LoadingButton
                    onClick={handleCheckout}
                    isLoading={isSubmitting || isCreatingSale || isUpdatingOrder}
                    disabled={isSubmitting || isCreatingSale || isUpdatingOrder}
                    variant="default"
                    size="lg"
                    className="flex-2"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    {editData?.isEditMode
                      ? (amountPaid === 0 ? 'Update Invoice' : 'Update Sale')
                      : (amountPaid === 0 ? 'Create Invoice' : 'Complete Sale')
                    }
                  </LoadingButton>
                </OrderCheckoutActions>
              </OrderSummaryContent>
            </OrderCheckoutCard>
          </div>
        )}

        {/* Recommendations Section */}
        {cart.length > 0 && (
          <div className="mt-4 w-full min-w-0">
            <RecommendationSection
              title="Customers Also Bought"
              algorithm="frequently_bought"
              context={{
                page: 'sales',
                currentProduct: cart[0]?.product?._id ?? cart[0]?.product?.id,
                currentProducts: cart.map((item) => item?.product?._id ?? item?.product?.id).filter(Boolean),
                customerTier: selectedCustomer?.customerTier,
                businessType: selectedCustomer?.businessType,
                limit: 4,
              }}
              limit={4}
              onAddToCart={addToCart}
              onViewProduct={(product) => {
                trackProductView(product);
              }}
            />
          </div>
        )}
      </div>

      {/* Clear Cart Confirmation Dialog */}
      <ClearConfirmationDialog
        isOpen={clearConfirmation.isOpen}
        onClose={handleClearCancel}
        onConfirm={handleClearConfirm}
        itemCount={cart.length}
        itemType="items"
        isLoading={false}
      />

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
          onComplete={() => setDirectPrintOrder(null)}
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

      {/* Product Image Preview Modal */}
      <BaseModal
        isOpen={!!previewImageProduct}
        onClose={() => setPreviewImageProduct(null)}
        title={previewImageProduct?.displayName || previewImageProduct?.variantName || previewImageProduct?.name || 'Product Image'}
      >
        <div className="flex justify-center items-center bg-gray-50 rounded-lg overflow-hidden min-h-[300px] p-4">
          {previewImageProduct?.imageUrl ? (
            <img
              src={previewImageProduct.imageUrl}
              alt="Product Preview"
              className="max-w-full max-h-[70vh] object-contain"
            />
          ) : (
            <div className="text-gray-400">No image available</div>
          )}
        </div>
      </BaseModal>

    </AsyncErrorBoundary>
  );
};
