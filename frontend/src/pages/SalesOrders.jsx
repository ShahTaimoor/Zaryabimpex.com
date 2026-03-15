import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from 'react-query';
import {
  Calendar,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  ArrowUpDown,
  RotateCcw,
  Printer,
  Save,
  ShoppingCart,
  Package,
  User,
  TrendingUp,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Phone,
  Receipt,
  X,
  History,
  Info,
  AlertCircle,
  EyeOff,
  Calculator,
  MessageSquare
} from 'lucide-react';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { formatDate, formatCurrency } from '../utils/formatters';
import { LoadingButton } from '../components/LoadingSpinner';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useGetProductsQuery, useLazyGetLastPurchasePriceQuery } from '../store/services/productsApi';
import { useGetVariantsQuery } from '../store/services/productVariantsApi';
import { useGetSalesQuery, useLazyGetLastPricesQuery } from '../store/services/salesApi';
import {
  useGetSalesOrdersQuery,
  useCreateSalesOrderMutation,
  useUpdateSalesOrderMutation,
  useDeleteSalesOrderMutation,
  useConfirmSalesOrderMutation,
  useCancelSalesOrderMutation,
  useCloseSalesOrderMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} from '../store/services/salesOrdersApi';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { useTab } from '../contexts/TabContext';
import { useAuth } from '../contexts/AuthContext';
import PrintModal from '../components/PrintModal';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import NotesPanel from '../components/NotesPanel';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';

// Helper function to safely render values
const safeRender = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'object') {
    return value.name || value.title || value.fullName || value.companyName || value.displayName || value.businessName || JSON.stringify(value);
  }
  return String(value);
};

const SalesOrders = () => {
  const { updateTabTitle, tabs, activeTabId, openTab } = useTab();
  const { companyInfo: companySettings } = useCompanyInfo();
  const resolvedCompanyName = companySettings.companyName || 'Company Name';
  const resolvedCompanyAddress = companySettings.address || companySettings.billingAddress || '';
  const resolvedCompanyPhone = companySettings.contactNumber || '';

  // Calculate default date range (14 days ago to today) using Pakistan timezone
  const today = getCurrentDatePakistan();
  const fromDateDefault = getDateDaysAgo(14);

  // State for filters and pagination
  const [filters, setFilters] = useState({
    fromDate: fromDateDefault, // 14 days ago
    toDate: today, // Today
    orderNumber: '',
    customer: '',
    status: '',
    orderType: ''
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 999999 // Get all sales orders without pagination
  });

  const [sortConfig, setSortConfig] = useState({
    key: 'createdAt',
    direction: 'desc'
  });

  const [showNotes, setShowNotes] = useState(false);
  const [notesEntity, setNotesEntity] = useState(null);

  // State for modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrderData, setPrintOrderData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    orderType: 'wholesale',
    customer: '',
    items: [],
    notes: '',
    isTaxExempt: true,
    orderNumber: ''
  });
  const [autoGenerateOrderNumber, setAutoGenerateOrderNumber] = useState(true);

  const generateOrderNumber = useCallback(
    (customer) => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const time = String(now.getTime()).slice(-4); // Last 4 digits of timestamp

      const customerInitials = customer
        ? (customer.businessName || customer.name || customer.displayName || '')
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
  const [priceType, setPriceType] = useState('wholesale'); // Price type: 'retail' or 'wholesale' or 'custom'

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
  const [isLoadingLastPrices, setIsLoadingLastPrices] = useState(false);
  const [originalPrices, setOriginalPrices] = useState({}); // Store original prices before applying last prices
  const [isLastPricesApplied, setIsLastPricesApplied] = useState(false);
  const [priceStatus, setPriceStatus] = useState({}); // Track price change status: 'updated', 'not-found', 'unchanged'

  // Loading states for buttons
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isRestoringPrices, setIsRestoringPrices] = useState(false);
  const [isRemovingFromCart, setIsRemovingFromCart] = useState({});
  const [isSortingItems, setIsSortingItems] = useState(false);

  // Cost price state
  const [showCostPrice, setShowCostPrice] = useState(false); // Toggle to show/hide cost prices
  const [lastPurchasePrice, setLastPurchasePrice] = useState(null); // Last purchase price for selected product
  const [lastPurchasePrices, setLastPurchasePrices] = useState({}); // Store last purchase prices for products in cart

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [isExporting, setIsExporting] = useState(false);

  // Auth context for permissions
  const { hasPermission, user } = useAuth();
  const canViewCostPrice = hasPermission('view_cost_prices');
  const [showProfit, setShowProfit] = useState(false);

  const totalProfit = useMemo(() => {
    if (!Array.isArray(formData.items) || formData.items.length === 0) return 0;

    const getProductIdFromItem = (item) => {
      if (!item) return null;
      if (item.product?._id) return item.product._id;
      if (typeof item.product === 'string') return item.product;
      if (item.productData?._id) return item.productData._id;
      return null;
    };

    const getProductData = (item) => {
      if (!item) return null;
      if (item.productData) return item.productData;
      if (item.product && typeof item.product === 'object') return item.product;
      return null;
    };

    return formData.items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const salePrice = Number(item.unitPrice) || 0;
      const productId = getProductIdFromItem(item);
      const productData = getProductData(item);

      const lastCost =
        productId && lastPurchasePrices[productId] !== undefined
          ? Number(lastPurchasePrices[productId])
          : null;

      const fallbackCostCandidates = [
        lastCost,
        Number(productData?.pricing?.cost),
        Number(productData?.pricing?.purchasePrice),
        Number(productData?.pricing?.wholesaleCost),
        Number(productData?.costPrice),
        Number(productData?.purchasePrice),
      ];

      const cost = fallbackCostCandidates.find(
        (value) => value !== null && value !== undefined && Number.isFinite(value)
      ) || 0;

      const profitPerUnit = salePrice - cost;
      const lineProfit = profitPerUnit * quantity;

      return sum + (Number.isFinite(lineProfit) ? lineProfit : 0);
    }, 0);
  }, [formData.items, lastPurchasePrices]);

  // Modal-specific product selection state
  const [modalProductSearchTerm, setModalProductSearchTerm] = useState('');
  const [modalSelectedProduct, setModalSelectedProduct] = useState(null);
  const [modalSelectedSuggestionIndex, setModalSelectedSuggestionIndex] = useState(-1);

  // Refs
  const productSearchRef = useRef(null);
  const customerSearchRef = useRef(null);

  useEffect(() => {
    if (autoGenerateOrderNumber) {
      const newNumber = generateOrderNumber(selectedCustomer);
      setFormData((prev) =>
        prev.orderNumber === newNumber ? prev : { ...prev, orderNumber: newNumber }
      );
    }
  }, [autoGenerateOrderNumber, selectedCustomer, generateOrderNumber]);

  // Focus management for edit modal
  useEffect(() => {
    if (showEditModal) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      // Focus on the first input field in the modal after a short delay
      const timer = setTimeout(() => {
        const modalInput = document.querySelector('.modal-product-search');
        if (modalInput) {
          modalInput.focus();
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = 'unset';
      };
    } else {
      // Ensure body scroll is restored when modal is closed
      document.body.style.overflow = 'unset';
      // Clear modal state when modal is closed
      setModalProductSearchTerm('');
      setModalSelectedProduct(null);
      setModalSelectedSuggestionIndex(-1);
    }
  }, [showEditModal]);

  // Safety mechanism: Always restore scroll on component unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Update tab title when selectedCustomer changes (after render)
  useEffect(() => {
    if (!updateTabTitle || !activeTabId) return;

    let newTitle;
    if (selectedCustomer) {
      newTitle = `SO - ${selectedCustomer.businessName || selectedCustomer.name || 'Unknown'}`;
    } else if (!showEditModal) {
      // Only reset to 'SO' if not in edit modal
      newTitle = 'SO';
    } else {
      return; // Don't update title when in edit modal
    }

    // Only update if we have a valid tab ID
    if (activeTabId) {
      updateTabTitle(activeTabId, newTitle);
    }
  }, [selectedCustomer, updateTabTitle, activeTabId, showEditModal]);

  // Fetch sales orders
  const {
    data: salesOrdersData,
    isLoading,
    error,
    refetch,
  } = useGetSalesOrdersQuery({ ...filters, ...pagination, sortConfig }, { refetchOnMountOrArgChange: true });

  const [getLastPurchasePrice] = useLazyGetLastPurchasePriceQuery();
  const [getLastPrices] = useLazyGetLastPricesQuery();

  // Fetch customers for dropdown
  const { data: customersData, isLoading: customersLoading } = useGetCustomersQuery(
    { limit: 999999 },
    {
      staleTime: 0, // Always consider data stale to get fresh credit information
      refetchOnMountOrArgChange: true // Refetch when component mounts or params change
    }
  );
  const customers = React.useMemo(() => {
    return customersData?.data?.customers || customersData?.customers || customersData?.data || customersData || [];
  }, [customersData]);

  // Fetch all active products for client-side fuzzy search
  const { data: allProductsData, isLoading: productsLoading, refetch: refetchProducts } = useGetProductsQuery(
    { limit: 999999, status: 'active' },
    {
      keepPreviousData: true,
      staleTime: 0, // Always consider data stale to get fresh stock levels
      refetchOnMountOrArgChange: true, // Refetch when component mounts or params change
    }
  );

  // Fetch all variants for search
  const { data: variantsData, isLoading: variantsLoading } = useGetVariantsQuery(
    { status: 'active' },
    {
      keepPreviousData: true,
      staleTime: 0,
      refetchOnMountOrArgChange: true,
    }
  );

  // Extract products array from RTK Query response (same pattern as Sales page)
  const allProducts = React.useMemo(() => {
    if (!allProductsData) return [];
    if (Array.isArray(allProductsData)) return allProductsData;
    if (allProductsData?.data?.products) return allProductsData.data.products;
    if (allProductsData?.products) return allProductsData.products;
    if (allProductsData?.data?.data?.products) return allProductsData.data.data.products;
    return [];
  }, [allProductsData]);

  // Extract variants array from RTK Query response
  const allVariants = React.useMemo(() => {
    if (!variantsData) return [];
    if (Array.isArray(variantsData)) return variantsData;
    if (variantsData?.data?.variants) return variantsData.data.variants;
    if (variantsData?.variants) return variantsData.variants;
    return [];
  }, [variantsData]);

  // Combine products and variants for search, marking variants with isVariant flag
  const allItems = React.useMemo(() => {
    const productsList = allProducts.map(p => ({ ...p, isVariant: false }));
    const variantsList = allVariants
      .filter(v => v.status === 'active')
      .map(v => ({
        ...v,
        isVariant: true,
        // Use variant's display name for search, but keep variant data
        name: v.displayName || v.variantName || `${v.baseProduct?.name || ''} - ${v.variantValue || ''}`,
        // Use variant pricing and inventory
        pricing: v.pricing || { retail: 0, wholesale: 0, cost: 0 },
        inventory: v.inventory || { currentStock: 0, reorderPoint: 0 },
        // Keep reference to base product
        baseProductId: v.baseProduct?._id || v.baseProduct,
        baseProductName: v.baseProduct?.name || '',
        variantType: v.variantType,
        variantValue: v.variantValue,
        variantName: v.variantName,
      }));
    return [...productsList, ...variantsList];
  }, [allProducts, allVariants]);

  const productsData = useFuzzySearch(
    allItems,
    productSearchTerm,
    ['name', 'description', 'brand', 'displayName', 'variantValue', 'variantName'],
    {
      threshold: 0.4,
      minScore: 0.3,
      limit: null // Show unlimited products
    }
  );

  // Apply fuzzy search for modal product search
  const modalProductsData = useFuzzySearch(
    allItems,
    modalProductSearchTerm,
    ['name', 'description', 'brand', 'displayName', 'variantValue', 'variantName'],
    {
      threshold: 0.4,
      minScore: 0.3,
      limit: null // Show unlimited products
    }
  );
  const modalProductsLoading = productsLoading || variantsLoading;

  // Mutations (RTK Query)
  const [createSalesOrderMutation, { isLoading: creating }] = useCreateSalesOrderMutation();
  const [updateSalesOrderMutation, { isLoading: updating }] = useUpdateSalesOrderMutation();
  const [deleteSalesOrderMutation, { isLoading: deleting }] = useDeleteSalesOrderMutation();
  const [confirmSalesOrderMutation, { isLoading: confirming }] = useConfirmSalesOrderMutation();
  const [cancelSalesOrderMutation, { isLoading: cancelling }] = useCancelSalesOrderMutation();
  const [closeSalesOrderMutation, { isLoading: closing }] = useCloseSalesOrderMutation();
  const [exportExcelMutation] = useExportExcelMutation();
  const [exportCSVMutation] = useExportCSVMutation();
  const [exportPDFMutation] = useExportPDFMutation();
  const [exportJSONMutation] = useExportJSONMutation();
  const [downloadFileMutation] = useDownloadFileMutation();

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
      isTaxExempt: true,
      orderNumber: '' // Will be auto-generated by useEffect after customer is reset
    });
    setAutoGenerateOrderNumber(true);

    // Reset last prices state
    setOriginalPrices({});
    setIsLastPricesApplied(false);
    setPriceStatus({});

    // Reset cost price state
    setLastPurchasePrice(null);
    setLastPurchasePrices({});

    // Reset loading states
    setIsAddingToCart(false);
    setIsRestoringPrices(false);
    setIsRemovingFromCart({});
    setIsSortingItems(false);

    // Tab title will be updated by useEffect when selectedCustomer changes
  };

  const customerDisplayKey = useCallback((customer) => {
    // Calculate total balance: currentBalance (which is net balance)
    const totalBalance = customer.currentBalance !== undefined
      ? customer.currentBalance
      : ((customer.pendingBalance || 0) - (customer.advanceBalance || 0));
    const hasBalance = totalBalance !== 0;
    const isPayable = totalBalance < 0;
    const isReceivable = totalBalance > 0;

    return (
      <div>
        <div className="font-medium">{customer.displayName || customer.businessName || customer.name || 'Unknown'}</div>
        {hasBalance ? (
          <div className={`text-sm ${isPayable ? 'text-red-600' : 'text-green-600'}`}>
            Total Balance: {isPayable ? '-' : '+'}{Math.abs(totalBalance).toFixed(2)}
          </div>
        ) : null}
      </div>
    );
  }, []);

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
    setCustomerSearchTerm(customerObj?.displayName || customerObj?.businessName || customerObj?.name || '');

    // Auto-set price type based on customer business type
    if (customerObj?.businessType) {
      if (customerObj.businessType === 'retail' || customerObj.businessType === 'individual') {
        setPriceType('retail');
      } else if (customerObj.businessType === 'wholesale') {
        setPriceType('wholesale');
      } else if (customerObj.businessType === 'distributor') {
        setPriceType('distributor');
      }
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
    const displayName = product.isVariant
      ? (product.displayName || product.variantName || product.name)
      : product.name;
    setProductSearchTerm(displayName);

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

    // Get display name - use variant display name if it's a variant
    const displayName = product.isVariant
      ? (product.displayName || product.variantName || product.name)
      : product.name;

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
          <div className={`text-sm ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-orange-600' : 'text-gray-600'}`}>
            Stock: {inventory.currentStock || 0}
          </div>
          <div className="text-sm text-gray-600">Price: {Math.round(unitPrice)}</div>
        </div>
      </div>
    );
  }, [priceType]);

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

    // Check if product/variant is out of stock
    const currentStock = selectedProduct.inventory?.currentStock || 0;
    if (currentStock === 0) {
      showErrorToast(`${displayName} is out of stock and cannot be added to the order.`);
      return;
    }

    // Check if requested quantity exceeds available stock
    if (quantity > currentStock) {
      showErrorToast(`Cannot add ${quantity} units. Only ${currentStock} units available in stock.`);
      return;
    }

    setIsAddingToCart(true);
    try {
      // Use the rate from the input field
      const unitPrice = parseFloat(customRate) || calculatedRate;

      // Check if sale price is less than cost price (always check, regardless of showCostPrice)
      if (lastPurchasePrice !== null && unitPrice < lastPurchasePrice) {
        const loss = lastPurchasePrice - unitPrice;
        const lossPercent = ((loss / lastPurchasePrice) * 100).toFixed(1);
        const shouldProceed = window.confirm(
          `⚠️ WARNING: Sale price (${unitPrice}) is below cost price (${Math.round(lastPurchasePrice)}).\n\n` +
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
      // For variants, use base product's tax settings if available, otherwise default to 0
      const taxRate = selectedProduct.isVariant
        ? (selectedProduct.baseProduct?.taxSettings?.taxRate || 0)
        : (selectedProduct.taxSettings?.taxRate || 0);
      const taxAmount = formData.isTaxExempt ? 0 : (subtotal * taxRate / 100);
      const total = subtotal - discountAmount + taxAmount;

      // Store last purchase price for this product/variant
      if (lastPurchasePrice !== null) {
        setLastPurchasePrices(prev => ({
          ...prev,
          [selectedProduct._id]: lastPurchasePrice
        }));
      }

      const newItem = {
        product: selectedProduct._id,
        productData: selectedProduct, // Store full product/variant data for display
        quantity,
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
          productSearchRef.current.focus();
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

  const handleApplyLastPrices = async () => {
    if (!selectedCustomer) {
      showErrorToast('Please select a customer first');
      return;
    }

    if (formData.items.length === 0) {
      showErrorToast('Please add products to cart first');
      return;
    }

    setIsLoadingLastPrices(true);
    try {
      const { data: response } = await getLastPrices(selectedCustomer._id);
      const { prices, orderNumber, orderDate } = response.data;

      if (!prices || Object.keys(prices).length === 0) {
        showErrorToast('No previous order found for this customer');
        setIsLoadingLastPrices(false);
        return;
      }

      // Store original prices before applying last prices
      const originalPricesMap = {};
      const priceStatusMap = {};
      formData.items.forEach(item => {
        const productId = item.product.toString();
        originalPricesMap[productId] = item.unitPrice;
      });
      setOriginalPrices(originalPricesMap);

      // Apply last prices to matching products in cart
      let updatedCount = 0;
      let unchangedCount = 0;
      let notFoundCount = 0;
      const updatedItems = formData.items.map(item => {
        const productId = item.product.toString();
        if (prices[productId]) {
          const lastPrice = prices[productId].unitPrice;
          const currentPrice = item.unitPrice;

          if (lastPrice !== currentPrice) {
            // Price changed
            updatedCount++;
            priceStatusMap[productId] = 'updated';
            const newSubtotal = lastPrice * item.quantity;
            const newTaxAmount = formData.isTaxExempt ? 0 : (newSubtotal * (item.taxRate || 0) / 100);
            const newTotal = newSubtotal - (item.discountAmount || 0) + newTaxAmount;

            return {
              ...item,
              unitPrice: lastPrice,
              subtotal: newSubtotal,
              taxAmount: newTaxAmount,
              total: newTotal
            };
          } else {
            // Price is the same
            unchangedCount++;
            priceStatusMap[productId] = 'unchanged';
            return item;
          }
        } else {
          // Product not found in last order
          notFoundCount++;
          priceStatusMap[productId] = 'not-found';
          return item;
        }
      });

      setFormData(prev => ({
        ...prev,
        items: updatedItems
      }));
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
      const restoredItems = formData.items.map(item => {
        const productId = item.product.toString();
        if (originalPrices[productId] !== undefined) {
          restoredCount++;
          const restoredPrice = originalPrices[productId];
          const newSubtotal = restoredPrice * item.quantity;
          const newTaxAmount = formData.isTaxExempt ? 0 : (newSubtotal * (item.taxRate || 0) / 100);
          const newTotal = newSubtotal - (item.discountAmount || 0) + newTaxAmount;

          return {
            ...item,
            unitPrice: restoredPrice,
            subtotal: newSubtotal,
            taxAmount: newTaxAmount,
            total: newTotal
          };
        }
        return item;
      });

      setFormData(prev => ({
        ...prev,
        items: restoredItems
      }));
      setIsLastPricesApplied(false);
      setOriginalPrices({});
      setPriceStatus({});

      if (restoredCount > 0) {
        showSuccessToast(`Restored original prices for ${restoredCount} product(s).`);
      }
    } finally {
      setIsRestoringPrices(false);
    }
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalDiscount = formData.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    const totalTax = formData.isTaxExempt ? 0 : subtotal * 0.08; // 8% tax if not exempt
    const total = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, total };
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleCreate = () => {
    if (formData.items.length === 0) {
      showErrorToast('Please add at least one item to the order');
      return;
    }

    // Calculate totals
    const { subtotal, totalDiscount, totalTax, total } = calculateTotals();

    // Remove payment field as sales orders don't have payment information
    const { payment, ...orderDataWithoutPayment } = formData;

    // Transform items to match backend expectations
    const transformedItems = formData.items.map(item => ({
      product: item.product,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.total,
      invoicedQuantity: 0, // Default to 0 for new sales orders
      remainingQuantity: item.quantity // Initially all quantity is remaining
    }));

    const orderData = {
      ...orderDataWithoutPayment,
      items: transformedItems,
      subtotal: subtotal,
      tax: totalTax,
      total: total
    };

    createSalesOrderMutation(orderData)
      .unwrap()
      .then(() => {
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
    // Clean the form data before sending to backend
    const cleanedData = {
      ...formData,
      items: formData.items.map(item => ({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.total,
        invoicedQuantity: item.invoicedQuantity || 0,
        remainingQuantity: item.remainingQuantity || item.quantity
      }))
    };

    updateSalesOrderMutation({ id: selectedOrder._id, ...cleanedData })
      .unwrap()
      .then(() => {
        setShowEditModal(false);
        setSelectedOrder(null);
        setModalProductSearchTerm('');
        setModalSelectedProduct(null);
        setModalSelectedSuggestionIndex(-1);
        resetForm();
        showSuccessToast('Sales order updated successfully');
        // Tab title will be updated by useEffect when selectedCustomer is reset
        refetch();
      })
      .catch((error) => {
        const errorMessage = error?.data?.message || error?.message || 'Failed to update sales order';
        showErrorToast(errorMessage);
      });
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this sales order?')) {
      deleteSalesOrderMutation(id)
        .unwrap()
        .then(() => {
          showSuccessToast('Sales order deleted successfully');
          refetch();
        })
        .catch((error) => {
          showErrorToast(handleApiError(error));
        });
    }
  };

  const handleConfirm = (id) => {
    if (window.confirm('Are you sure you want to confirm this sales order? This will automatically generate a sales invoice and update inventory.')) {
      confirmSalesOrderMutation(id)
        .unwrap()
        .then((response) => {
          if (response.invoiceError) {
            showSuccessToast(`Sales order confirmed but failed to generate invoice: ${response.invoiceError}`);
          } else {
            showSuccessToast('Sales order confirmed and invoice generated successfully');
            // Automatically navigate to the Sales Invoices page to show the generated record
            openTab({
              path: '/orders',
              title: 'Sales Invoices'
            });
          }
          refetch(); // Refetch sales orders list
          // Immediately refetch products to update stock levels
          if (refetchProducts && typeof refetchProducts === 'function') {
            refetchProducts();
          }
        })
        .catch((error) => {
          showErrorToast(handleApiError(error));
        });
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
          if (refetchProducts && typeof refetchProducts === 'function') {
            refetchProducts();
          }
        })
        .catch((error) => {
          showErrorToast(handleApiError(error));
        });
    }
  };

  const handleExportConfirm = async () => {
    setIsExporting(true);
    try {
      // Build filters based on current filters
      const exportFilters = {
        dateFrom: filters.fromDate,
        dateTo: filters.toDate,
        status: filters.status,
        customer: filters.customer,
        orderNumber: filters.orderNumber,
        orderType: filters.orderType
      };

      let response;
      if (exportFormat === 'excel') {
        response = await exportExcelMutation(exportFilters).unwrap();
      } else if (exportFormat === 'csv') {
        response = await exportCSVMutation(exportFilters).unwrap();
      } else if (exportFormat === 'json') {
        response = await exportJSONMutation(exportFilters).unwrap();
      } else if (exportFormat === 'pdf') {
        response = await exportPDFMutation(exportFilters).unwrap();
      }

      if (response?.filename) {
        const filename = response.filename;

        try {
          // Add a small delay to ensure file is written (PDF generation is async)
          if (exportFormat === 'pdf') {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Download the file
          let downloadResponse;
          try {
            downloadResponse = await downloadFileMutation(filename).unwrap();
          } catch (downloadErr) {
            showErrorToast('Download failed');
            return;
          }

          // Check if response is successful
          if (!downloadResponse) {
            showErrorToast('Download failed: No response received');
            return;
          }

          // Check if data exists
          if (!downloadResponse) {
            showErrorToast('Download failed: No data received from server');
            return;
          }

          if (exportFormat === 'pdf') {
            // For PDF, open in new tab for preview
            const blob = downloadResponse;

            // Check if blob is valid
            if (!blob || !(blob instanceof Blob)) {
              // Handle different response types
              if (typeof blob === 'string') {
                showErrorToast(`Server error: ${blob.substring(0, 100)}`);
              } else if (blob && typeof blob === 'object') {
                // Try to extract error message from object
                let errorMsg = blob.message || blob.error;

                // If no message property, try to stringify but check if it's meaningful
                if (!errorMsg) {
                  try {
                    const stringified = JSON.stringify(blob);
                    // If stringified is just "{}" or empty, try to get more info
                    if (stringified === '{}' || stringified === 'null' || stringified === '') {
                      // Check if it's an error object with other properties
                      errorMsg = blob.statusText || blob.status || 'Unknown server error';
                      // Error response from server
                    } else {
                      errorMsg = stringified.substring(0, 150);
                    }
                  } catch (e) {
                    errorMsg = 'Invalid response format';
                  }
                }

                showErrorToast(`Server error: ${errorMsg || 'Unknown error'}`);
              } else {
                showErrorToast('Invalid PDF file received - expected Blob. Response type: ' + typeof blob);
              }
              return;
            }

            // Check if content type indicates an error (JSON/HTML response)
            const contentType = blob.type || '';
            if (contentType.includes('application/json') || contentType.includes('text/html')) {
              // Read the blob to see the error message
              const reader = new FileReader();
              reader.onload = () => {
                const text = reader.result;
                try {
                  const errorData = JSON.parse(text);
                  showErrorToast(errorData.message || 'File not found or generation failed');
                } catch {
                  showErrorToast('Server returned error instead of PDF. Please try again.');
                }
              };
              reader.readAsText(blob);
              return;
            }

            // Check if blob has content
            if (blob.size === 0) {
              showErrorToast('PDF file is empty');
              return;
            }

            // Check if blob type is PDF (or at least not HTML/JSON error)
            if (blob.type && !blob.type.includes('pdf') && !blob.type.includes('application/octet-stream')) {
              // Might be an error response, try to read it
              const reader = new FileReader();
              reader.onload = () => {
                const text = reader.result;
                if (text.includes('<!DOCTYPE') || text.includes('{"error"') || text.includes('{"message"')) {
                  showErrorToast('Server returned an error instead of PDF file');
                } else {
                  // Try to open anyway
                  const url = URL.createObjectURL(blob);
                  const newWindow = window.open(url, '_blank');
                  if (!newWindow) {
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showSuccessToast('PDF downloaded (popup was blocked)');
                  } else {
                    showSuccessToast('PDF opened in new tab');
                  }
                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                }
              };
              reader.readAsText(blob.slice(0, 100)); // Read first 100 bytes to check
              return;
            }

            // Valid PDF blob, proceed with opening
            const url = URL.createObjectURL(blob);
            const newWindow = window.open(url, '_blank');

            if (!newWindow) {
              // Popup blocked, fallback to download
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              showSuccessToast('PDF downloaded (popup was blocked)');
            } else {
              showSuccessToast('PDF opened in new tab');
            }

            // Revoke URL after a delay to ensure it loads
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          } else {
            // For other formats, download directly
            const blob = downloadResponse instanceof Blob
              ? downloadResponse
              : new Blob([downloadResponse], {
                type: exportFormat === 'excel'
                  ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  : exportFormat === 'csv'
                    ? 'text/csv'
                    : 'application/json'
              });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showSuccessToast(`${exportFormat.toUpperCase()} file downloaded successfully`);
          }
        } catch (downloadError) {
          // Handle download errors
          if (downloadError.response) {
            // Server returned an error status
            if (downloadError.response.data instanceof Blob) {
              // Error response is a blob, try to read it
              const reader = new FileReader();
              reader.onload = () => {
                const text = reader.result;
                try {
                  const errorData = JSON.parse(text);
                  showErrorToast(errorData.message || 'Download failed');
                } catch {
                  showErrorToast('Download failed: ' + text.substring(0, 100));
                }
              };
              reader.readAsText(downloadError.response.data);
            } else {
              showErrorToast(downloadError.response.data?.message || `Download failed: ${downloadError.response.status}`);
            }
          } else {
            showErrorToast('Download failed: ' + (downloadError.message || 'Unknown error'));
          }
          return;
        }
      }

      setShowExportModal(false);
    } catch (error) {
      handleApiError(error, 'Export');
    } finally {
      setIsExporting(false);
    }
  };

  const handleEdit = (order) => {
    setSelectedOrder(order);
    setShowEditModal(true);

    // Process items to ensure productData is available
    const processedItems = (order.items || []).map(item => ({
      ...item,
      productData: item.product || null // Use the populated product data
    }));

    setFormData({
      orderType: order.orderType,
      customer: order.customer?._id || '',
      items: processedItems,
      notes: order.notes || '',
      terms: order.terms || '',
      isTaxExempt: order.pricing?.isTaxExempt || false,
      orderNumber: order.soNumber || order.orderNumber || order.invoiceNumber || ''
    });
    setAutoGenerateOrderNumber(!(order.soNumber || order.orderNumber || order.invoiceNumber));

    // Set the selected customer
    if (order.customer) {
      setSelectedCustomer(order.customer);
      setCustomerSearchTerm(order.customer.businessName || order.customer.name || '');
      // Tab title will be updated by useEffect when selectedCustomer changes
    } else {
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
      // Tab title will be updated by useEffect when selectedCustomer changes
    }

    setShowEditModal(true);
  };

  const handleView = (order) => {
    setSelectedOrder(order);
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
        return {
          ...item,
          product: {
            name:
              productData.name ||
              item.productName ||
              productData.title ||
              'Product'
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

  const handlePrint = (order) => {
    const formatted = formatOrderForPrint(order);
    if (!formatted) return;
    setPrintOrderData(formatted);
    setShowPrintModal(true);
  };


  const getStatusIcon = (status) => {
    switch (status) {
      case 'closed':
      case 'fully_invoiced':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'confirmed':
      case 'partially_invoiced':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'draft':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
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

  const salesOrders = salesOrdersData?.salesOrders || [];
  const paginationInfo = salesOrdersData?.pagination || {};
  const { subtotal, totalDiscount, totalTax, total } = calculateTotals();

  return (
    <div className="space-y-4 lg:space-y-6 w-full max-w-full overflow-x-hidden px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sales Orders</h1>
          <p className="text-sm sm:text-base text-gray-600">Process sales order transactions</p>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={() => setShowExportModal(true)}
            className="btn btn-secondary btn-sm sm:btn-md flex-1 sm:flex-none"
            title="Export sales orders data"
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={resetForm}
            className="btn btn-primary btn-sm sm:btn-md flex-1 sm:flex-none"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">New Sales Order</span>
            <span className="sm:hidden">New Order</span>
          </button>
        </div>
      </div>

      {/* Customer Selection and Information Row */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-4">
        {/* Customer Selection */}
        <div className="w-full lg:w-[500px] lg:flex-shrink-0">
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
                    setFormData(prev => ({ ...prev, customer: '' }));

                    // Reset last prices state when customer is cleared
                    setOriginalPrices({});
                    setIsLastPricesApplied(false);
                    setPriceStatus({});

                    // Tab title will be updated by useEffect when selectedCustomer changes
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
            ref={customerSearchRef}
            placeholder="Search customers by name, email, or business..."
            items={customers}
            onSelect={handleCustomerSelect}
            onSearch={handleCustomerSearch}
            displayKey={customerDisplayKey}
            selectedItem={selectedCustomer}
            loading={customersLoading}
            emptyMessage={customerSearchTerm.length > 0 ? "No customers found" : "Start typing to search customers..."}
            value={customerSearchTerm}
            rightContentKey="city"
          />
        </div>

        {/* Customer Information - Right Side */}
        <div className="flex-1">
          {selectedCustomer ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium">{selectedCustomer.displayName || selectedCustomer.businessName || selectedCustomer.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-600 capitalize">
                    {selectedCustomer.businessType || 'Business'} • {selectedCustomer.phone || 'No phone'}
                  </p>
                  <div className="flex items-center space-x-4 mt-2">
                    {(() => {
                      // Calculate total balance: currentBalance (which is net balance)
                      const totalBalance = selectedCustomer.currentBalance !== undefined
                        ? selectedCustomer.currentBalance
                        : ((selectedCustomer.pendingBalance || 0) - (selectedCustomer.advanceBalance || 0));
                      const hasBalance = totalBalance !== 0;
                      const isPayable = totalBalance < 0;
                      const isReceivable = totalBalance > 0;

                      return hasBalance ? (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">Total Balance:</span>
                          <span className={`text-sm font-medium ${isPayable ? 'text-red-600' : isReceivable ? 'text-green-600' : 'text-gray-600'
                            }`}>
                            {isPayable ? '-' : '+'}{Math.abs(totalBalance).toFixed(2)}
                          </span>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">Credit Limit:</span>
                      <span className={`text-sm font-medium ${selectedCustomer.creditLimit > 0 ? (
                        (selectedCustomer.currentBalance || 0) >= selectedCustomer.creditLimit * 0.9
                          ? 'text-red-600'
                          : (selectedCustomer.currentBalance || 0) >= selectedCustomer.creditLimit * 0.7
                            ? 'text-yellow-600'
                            : 'text-blue-600'
                      ) : 'text-gray-600'
                        }`}>
                        {(selectedCustomer.creditLimit || 0).toFixed(2)}
                      </span>
                      {selectedCustomer.creditLimit > 0 &&
                        (selectedCustomer.currentBalance || 0) >= selectedCustomer.creditLimit * 0.9 && (
                          <span className="text-xs text-red-600 font-bold ml-1">⚠️</span>
                        )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">Available Credit:</span>
                      <span className={`text-sm font-medium ${selectedCustomer.creditLimit > 0 ? (
                        (selectedCustomer.creditLimit - (selectedCustomer.currentBalance || 0)) <= selectedCustomer.creditLimit * 0.1
                          ? 'text-red-600'
                          : (selectedCustomer.creditLimit - (selectedCustomer.currentBalance || 0)) <= selectedCustomer.creditLimit * 0.3
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      ) : 'text-gray-600'
                        }`}>
                        {(selectedCustomer.creditLimit - (selectedCustomer.currentBalance || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden lg:block">
              {/* Empty space to maintain layout consistency */}
            </div>
          )}
        </div>
      </div>

      {/* Combined Product Selection and Cart Section */}
      <div className="card">
        <div className="card-header">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <h3 className="text-lg font-medium text-gray-900">Product Selection & Cart</h3>
            <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
              {/* Show/Hide Cost Price Toggle Button */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowCostPrice(!showCostPrice)}
                  className="btn btn-secondary btn-sm flex items-center space-x-2"
                  title={showCostPrice ? "Hide purchase cost prices" : "Show purchase cost prices"}
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
                </button>
                {user?.role === 'admin' && formData.items.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowProfit(prev => !prev)}
                      className="btn btn-secondary btn-sm flex items-center space-x-2"
                      title="Toggle estimated profit (BP)"
                    >
                      <Calculator className="h-4 w-4" />
                      <span>{showProfit ? 'Hide BP' : 'Show BP'}</span>
                    </button>
                    {showProfit && (
                      <span
                        className={`text-sm font-semibold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                      >
                        {formatCurrency(totalProfit || 0)}
                      </span>
                    )}
                  </>
                )}
              </div>
              {selectedCustomer && formData.items.length > 0 && (
                <>
                  {!isLastPricesApplied ? (
                    <LoadingButton
                      onClick={handleApplyLastPrices}
                      isLoading={isLoadingLastPrices}
                      className="btn btn-secondary btn-sm flex items-center space-x-2"
                      title="Apply prices from last order for this customer"
                    >
                      <History className="h-4 w-4 mr-2" />
                      Apply Last Prices
                    </LoadingButton>
                  ) : (
                    <LoadingButton
                      onClick={handleRestoreCurrentPrices}
                      isLoading={isRestoringPrices}
                      className="btn btn-secondary btn-sm flex items-center space-x-2"
                      title="Restore original/current prices"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore Current Prices
                    </LoadingButton>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="card-content">
          {/* Product Search */}
          <div className="mb-6">
            {(() => {
              const productSearchMdClass = canViewCostPrice && showCostPrice ? 'md:col-span-6' : 'md:col-span-7';
              const previewAmount = isAddingProduct
                ? Math.round(quantity * parseFloat(customRate || 0))
                : 0;

              return (
                <div className="grid grid-cols-12 gap-4 items-end">
                  <div className={`col-span-12 ${productSearchMdClass}`}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Search
                    </label>
                    <SearchableDropdown
                      key={searchKey}
                      ref={productSearchRef}
                      placeholder="Search or select product..."
                      items={productsData || []}
                      onSelect={handleProductSelect}
                      onSearch={handleProductSearch}
                      displayKey={productDisplayKey}
                      selectedItem={selectedProduct}
                      loading={productsLoading}
                      emptyMessage="No products found"
                      value={productSearchTerm}
                    />
                  </div>

                  <div className="col-span-6 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stock
                    </label>
                    <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
                      {selectedProduct ? selectedProduct.inventory?.currentStock || 0 : '0'}
                    </span>
                  </div>

                  <div className="col-span-6 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedProduct?.inventory?.currentStock}
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      onKeyDown={handleInputKeyDown}
                      onFocus={(e) => e.target.select()}
                      className="input text-center"
                      placeholder="1 (Enter to add & focus search)"
                      autoFocus={isAddingProduct}
                    />
                  </div>

                  {showCostPrice && canViewCostPrice && (
                    <div className="col-span-6 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cost
                      </label>
                      <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 block text-center h-10 flex items-center justify-center" title="Last Purchase Price">
                        {lastPurchasePrice !== null ? `${Math.round(lastPurchasePrice)}` : selectedProduct ? 'N/A' : '0'}
                      </span>
                    </div>
                  )}

                  <div className="col-span-6 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rate
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={customRate}
                      onChange={(e) => setCustomRate(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onFocus={(e) => e.target.select()}
                      className="input text-center"
                      placeholder="0 (Enter to add & focus search)"
                      required
                    />
                  </div>

                  <div className="col-span-6 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount
                    </label>
                    <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
                      {previewAmount}
                    </span>
                  </div>

                  <div className="col-span-6 md:col-span-1 flex items-end">
                    <LoadingButton
                      type="button"
                      onClick={handleAddItem}
                      isLoading={isAddingToCart}
                      className="btn btn-primary w-full flex items-center justify-center px-3 py-2"
                      disabled={!selectedProduct || isAddingToCart}
                      title="Add to cart (or press Enter in Quantity/Rate fields - focus returns to search)"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </LoadingButton>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Cart Items */}
          {formData.items.length === 0 ? (
            <div className="p-8 text-center text-gray-500 border-t border-gray-200">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">No items in cart</p>
            </div>
          ) : (
            <div className="space-y-4 border-t border-gray-200 pt-6 overflow-x-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <h4 className="text-md font-medium text-gray-700">Cart Items</h4>
                <div className="flex items-center flex-wrap gap-2">
                  <LoadingButton
                    type="button"
                    onClick={handleSortCartItems}
                    isLoading={isSortingItems}
                    className="btn btn-secondary btn-sm flex items-center space-x-2"
                    title="Sort products alphabetically"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    <span className="hidden sm:inline">Sort A-Z</span>
                    <span className="sm:hidden">Sort</span>
                  </LoadingButton>
                  {isLastPricesApplied && Object.keys(priceStatus).length > 0 && (
                    <div className="flex items-center space-x-3 text-xs">
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
                </div>
              </div>
              {formData.items.map((item, index) => {
                const product = item.productData || item.product; // Use stored product data or fallback to product
                const totalPrice = item.unitPrice * item.quantity;
                const isLowStock = product?.inventory?.currentStock <= (product?.inventory?.reorderPoint || 0);

                return (
                  <div key={index} className={`py-1 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    {/* Desktop Grid Layout */}
                    <div className="hidden lg:grid grid-cols-12 gap-3 xl:gap-4 items-center">
                      {/* Serial Number - 1 column */}
                      <div className="col-span-1">
                        <span className="text-sm font-medium text-gray-700 bg-gray-50 px-0.5 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
                          {index + 1}
                        </span>
                      </div>

                      {/* Product Name - 5 columns (reduced from 6 to accommodate Cost column when shown) */}
                      <div className={`${showCostPrice && canViewCostPrice ? 'col-span-5' : 'col-span-6'} flex items-center h-8`}>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm truncate">
                            {product?.isVariant
                              ? (safeRender(product?.displayName || product?.variantName || product?.name) || 'Unknown Variant')
                              : (safeRender(product?.name) || 'Unknown Product')}
                            {isLowStock && <span className="text-yellow-600 text-xs ml-2">⚠️ Low Stock</span>}
                            {lastPurchasePrices[item.product?.toString()] !== undefined &&
                              item.unitPrice < lastPurchasePrices[item.product?.toString()] && (
                                <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold" title={`Sale price below cost! Loss: ${Math.round(lastPurchasePrices[item.product?.toString()] - item.unitPrice)} per unit`}>
                                  ⚠️ Below Cost
                                </span>
                              )}
                            {isLastPricesApplied && priceStatus[item.product?.toString()] && (
                              <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${priceStatus[item.product?.toString()] === 'updated'
                                ? 'bg-green-100 text-green-700'
                                : priceStatus[item.product?.toString()] === 'unchanged'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                {priceStatus[item.product?.toString()] === 'updated'
                                  ? 'Updated'
                                  : priceStatus[item.product?.toString()] === 'unchanged'
                                    ? 'Same Price'
                                    : 'Not in Last Order'}
                              </span>
                            )}
                          </span>
                          {product?.isVariant && (
                            <span className="text-xs text-gray-500">
                              {product.variantType}: {product.variantValue}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock - 1 column */}
                      <div className="col-span-1">
                        <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
                          {product?.inventory?.currentStock || 0}
                        </span>
                      </div>

                      {/* Quantity - 1 column */}
                      <div className="col-span-1">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQuantity = parseInt(e.target.value) || 1;
                            if (newQuantity <= 0) {
                              handleRemoveItem(index);
                              return;
                            }
                            setFormData(prev => ({
                              ...prev,
                              items: prev.items.map((itm, i) =>
                                i === index ? { ...itm, quantity: newQuantity, total: newQuantity * itm.unitPrice } : itm
                              )
                            }));
                          }}
                          className="input text-center h-8"
                          min="1"
                        />
                      </div>

                      {/* Purchase Price (Cost) - 1 column (conditional) - Between Quantity and Rate */}
                      {showCostPrice && canViewCostPrice && (
                        <div className="col-span-1">
                          <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 block text-center h-8 flex items-center justify-center" title="Last Purchase Price">
                            {lastPurchasePrices[item.product?.toString()] !== undefined
                              ? `${Math.round(lastPurchasePrices[item.product?.toString()])}`
                              : 'N/A'}
                          </span>
                        </div>
                      )}

                      {/* Rate - 1 column */}
                      <div className="col-span-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const newPrice = parseFloat(e.target.value) || 0;
                            const costPrice = lastPurchasePrices[item.product?.toString()];

                            // Check if new price is below cost (always check, regardless of showCostPrice)
                            if (costPrice !== undefined && newPrice < costPrice) {
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
                          className={`input text-center h-8 ${lastPurchasePrices[item.product?.toString()] !== undefined &&
                            item.unitPrice < lastPurchasePrices[item.product?.toString()]
                            ? 'border-red-500 bg-red-50'
                            : ''
                            }`}
                          title={
                            lastPurchasePrices[item.product?.toString()] !== undefined &&
                              item.unitPrice < lastPurchasePrices[item.product?.toString()]
                              ? `⚠️ WARNING: Sale price (${Math.round(item.unitPrice)}) is below cost price (${Math.round(lastPurchasePrices[item.product?.toString()])})`
                              : ''
                          }
                          min="0"
                        />
                      </div>

                      {/* Total - 1 column */}
                      <div className="col-span-1">
                        <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
                          {Math.round(totalPrice)}
                        </span>
                      </div>

                      {/* Delete Button - 1 column */}
                      <div className="col-span-1 min-w-0">
                        <LoadingButton
                          onClick={() => handleRemoveItem(index)}
                          isLoading={isRemovingFromCart[formData.items[index]?.product?.toString() || index]}
                          className="btn btn-danger btn-sm h-8 w-full flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </LoadingButton>
                      </div>
                    </div>

                    {/* Mobile Card Layout */}
                    <div className="lg:hidden p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                      {/* Product Name and Delete Button Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-sm text-gray-900 truncate">
                            {safeRender(product?.name) || 'Unknown Product'}
                          </h5>
                          {isLowStock && <span className="text-yellow-600 text-xs">⚠️ Low Stock</span>}
                          {lastPurchasePrices[item.product?.toString()] !== undefined &&
                            item.unitPrice < lastPurchasePrices[item.product?.toString()] && (
                              <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">
                                ⚠️ Below Cost
                              </span>
                            )}
                        </div>
                        <LoadingButton
                          onClick={() => handleRemoveItem(index)}
                          isLoading={isRemovingFromCart[formData.items[index]?.product?.toString() || index]}
                          className="btn btn-danger btn-sm flex-shrink-0"
                          title="Remove Item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </LoadingButton>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Stock</p>
                          <p className="text-sm font-medium text-gray-900">
                            {product?.inventory?.currentStock || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Quantity</p>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const newQuantity = parseInt(e.target.value) || 1;
                              if (newQuantity <= 0) {
                                handleRemoveItem(index);
                                return;
                              }
                              setFormData(prev => ({
                                ...prev,
                                items: prev.items.map((itm, i) =>
                                  i === index ? { ...itm, quantity: newQuantity, total: newQuantity * itm.unitPrice } : itm
                                )
                              }));
                            }}
                            className="input text-center h-8 text-sm w-full"
                            min="1"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Rate</p>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value) || 0;
                              const costPrice = lastPurchasePrices[item.product?.toString()];

                              if (costPrice !== undefined && newPrice < costPrice) {
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
                            className={`input text-center h-8 text-sm w-full ${lastPurchasePrices[item.product?.toString()] !== undefined &&
                              item.unitPrice < lastPurchasePrices[item.product?.toString()]
                              ? 'border-red-500 bg-red-50'
                              : ''
                              }`}
                            min="0"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Total</p>
                          <p className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded border border-gray-200 text-center h-8 flex items-center justify-center">
                            {Math.round(totalPrice)}
                          </p>
                        </div>
                      </div>

                      {/* Cost Price (if shown) */}
                      {showCostPrice && canViewCostPrice && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Last Purchase Price</p>
                          <p className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
                            {lastPurchasePrices[item.product?.toString()] !== undefined
                              ? `${Math.round(lastPurchasePrices[item.product?.toString()])}`
                              : 'N/A'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sales Order Details */}
      {formData.items.length > 0 && !showEditModal && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg max-w-5xl ml-auto mt-4 w-full overflow-x-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-blue-200">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 text-right mb-4">
              Sales Order Details
            </h3>
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

              {/* Tax Exemption Option */}
              <div className="flex flex-col w-full sm:w-40">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tax Status
                </label>
                <div className="flex items-center space-x-1 px-2 py-1 border border-gray-200 rounded h-8">
                  <input
                    type="checkbox"
                    id="taxExempt"
                    checked={formData.isTaxExempt}
                    onChange={(e) => setFormData(prev => ({ ...prev, isTaxExempt: e.target.checked }))}
                    className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label htmlFor="taxExempt" className="text-xs font-medium text-gray-700 cursor-pointer">
                      Tax Exempt
                    </label>
                  </div>
                  {formData.isTaxExempt && (
                    <div className="text-green-600 text-xs font-medium">
                      ✓
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Number */}
              <div className="flex flex-col w-full sm:w-72">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <label className="block text-xs font-medium text-gray-700 m-0">
                    Invoice Number
                  </label>
                  <label
                    htmlFor="soAutoGenerateInvoice"
                    className="flex items-center space-x-1 text-[11px] text-gray-600 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      id="soAutoGenerateInvoice"
                      checked={autoGenerateOrderNumber}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAutoGenerateOrderNumber(checked);
                        if (checked) {
                          const newNumber = generateOrderNumber(selectedCustomer);
                          setFormData((prev) => ({ ...prev, orderNumber: newNumber }));
                        }
                      }}
                      className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span>Auto-generate</span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.orderNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, orderNumber: e.target.value }))}
                    className="w-full input pr-16 h-8 text-sm"
                    placeholder={autoGenerateOrderNumber ? 'Auto-generated' : 'Enter invoice number'}
                    disabled={autoGenerateOrderNumber}
                  />
                  {autoGenerateOrderNumber && (
                    <button
                      type="button"
                      onClick={() => {
                        const newNumber = generateOrderNumber(selectedCustomer);
                        setFormData((prev) => ({ ...prev, orderNumber: newNumber }));
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[11px] text-primary-600 hover:text-primary-800 font-medium"
                    >
                      Regenerate
                    </button>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col w-full sm:w-[28rem]">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="input h-8 text-sm"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 sm:px-6 py-4">
            <h3 className="text-base sm:text-lg font-semibold text-white">Order Summary</h3>
          </div>

          <div className="px-4 sm:px-6 py-4">
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-semibold">Subtotal:</span>
                <span className="text-xl font-bold text-gray-900">{Math.round(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-semibold">Discount:</span>
                  <span className="text-xl font-bold text-red-600">-{Math.round(totalDiscount)}</span>
                </div>
              )}
              {!formData.isTaxExempt && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-semibold">Tax (8%):</span>
                  <span className="text-xl font-bold text-gray-900">{Math.round(totalTax)}</span>
                </div>
              )}
              {selectedCustomer && (() => {
                // Calculate total balance: currentBalance (which is net balance)
                const totalBalance = selectedCustomer.currentBalance !== undefined
                  ? selectedCustomer.currentBalance
                  : ((selectedCustomer.pendingBalance || 0) - (selectedCustomer.advanceBalance || 0));
                const hasPreviousBalance = totalBalance !== 0;

                if (!hasPreviousBalance) return null;

                return (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-800 font-semibold">
                      Previous Total Balance:
                    </span>
                    <span className={`text-xl font-bold ${totalBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {totalBalance < 0 ? '-' : '+'}{Math.abs(Math.round(totalBalance))}
                    </span>
                  </div>
                );
              })()}
              <div className="flex justify-between items-center text-xl font-bold border-t-2 border-blue-400 pt-3 mt-2">
                <span className="text-blue-900">Total:</span>
                <span className="text-blue-900 text-3xl">{Math.round(total)}</span>
              </div>
              {selectedCustomer && (() => {
                // Calculate total balance: currentBalance (which is net balance)
                const totalBalance = selectedCustomer.currentBalance !== undefined
                  ? selectedCustomer.currentBalance
                  : ((selectedCustomer.pendingBalance || 0) - (selectedCustomer.advanceBalance || 0));
                const hasPreviousBalance = totalBalance !== 0;

                if (!hasPreviousBalance) return null;

                const totalBalanceAfterOrder = total + totalBalance;
                const isPayable = totalBalanceAfterOrder < 0;

                return (
                  <div className="flex justify-between items-center text-lg font-bold border-t-2 border-red-400 pt-3 mt-2">
                    <span className={isPayable ? 'text-red-700' : 'text-green-700'}>
                      Total Balance After Order:
                    </span>
                    <span className={`text-2xl ${isPayable ? 'text-red-700' : 'text-green-700'}`}>
                      {isPayable ? '-' : '+'}{Math.abs(Math.round(totalBalanceAfterOrder))}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6 px-4 sm:px-6 pb-6">
            <button
              onClick={resetForm}
              className="btn btn-secondary flex-1 w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Clear Cart</span>
              <span className="sm:hidden">Clear</span>
            </button>
            <button
              onClick={() => {
                const tempOrder = {
                  soNumber: formData.orderNumber || `SO-${Date.now()}`,
                  orderNumber: formData.orderNumber || `SO-${Date.now()}`,
                  customer: selectedCustomer,
                  items: formData.items.map(item => ({
                    product: item.productData,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.total
                  })),
                  subtotal: subtotal,
                  discount: totalDiscount,
                  tax: totalTax,
                  total: total,
                  orderType: formData.orderType || 'wholesale',
                  status: 'draft',
                  paymentMethod: formData.paymentMethod,
                  isTaxExempt: formData.isTaxExempt,
                  notes: formData.notes,
                  createdAt: new Date().toISOString()
                };
                handlePrint(tempOrder);
              }}
              className="btn btn-secondary flex-1 w-full sm:w-auto"
            >
              <Receipt className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Print Preview</span>
              <span className="sm:hidden">Print</span>
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || formData.items.length === 0}
              className="btn btn-primary btn-md sm:btn-lg flex-2 w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{creating ? 'Creating...' : 'Create Sales Order'}</span>
              <span className="sm:hidden">{creating ? 'Creating...' : 'Create Order'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Sales Order Modal */}
      {showEditModal && selectedOrder && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false);
              setSelectedOrder(null);
              setModalProductSearchTerm('');
              setModalSelectedProduct(null);
              setModalSelectedSuggestionIndex(-1);
              resetForm();
            }
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Edit Sales Order Details</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedOrder(null);
                  setModalProductSearchTerm('');
                  setModalSelectedProduct(null);
                  setModalSelectedSuggestionIndex(-1);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Customer Selection */}
              <div className="mb-4">
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Selection</label>
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Customer Suggestions */}
                  {customerSearchTerm && customersData?.customers?.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                      {customersData.customers.slice(0, 5).map((customer) => {
                        // Get city from addresses
                        const defaultAddress = customer.addresses?.find(addr => addr.isDefault) || customer.addresses?.[0];
                        const city = defaultAddress?.city || '';

                        return (
                          <div
                            key={customer._id}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, customer: customer._id }));
                              setCustomerSearchTerm(customer.businessName || customer.name);
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{customer.businessName || customer.name}</div>
                              <div className="text-sm text-gray-600">{customer.email}</div>
                            </div>
                            {city && (
                              <div className="text-xs text-gray-500 ml-2">{city}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Details */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Order Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Type</label>
                  <select
                    value={formData.orderType}
                    onChange={(e) => setFormData(prev => ({ ...prev, orderType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="return">Return</option>
                    <option value="exchange">Exchange</option>
                  </select>
                </div>

                {/* Tax Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Status</label>
                  <div className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md">
                    <input
                      type="checkbox"
                      id="taxExempt"
                      checked={formData.isTaxExempt}
                      onChange={(e) => setFormData(prev => ({ ...prev, isTaxExempt: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="taxExempt" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Tax Exempt
                    </label>
                  </div>
                </div>
              </div>

              {/* Notes and Terms */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any notes or comments..."
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Terms & Conditions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                  <textarea
                    value={formData.terms}
                    onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                    placeholder="Add terms and conditions..."
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Product Selection & Cart Items */}
              <div className="px-6 py-4 border-t border-blue-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Product Selection & Cart Items</h4>
                <div className="mb-4">
                  <div className="grid grid-cols-12 gap-4 items-end">
                    {/* Product Search - 6 columns */}
                    <div className="col-span-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Product Search</label>
                      <input
                        type="text"
                        placeholder="Search or type product name..."
                        value={modalProductSearchTerm}
                        onChange={(e) => {
                          e.stopPropagation();
                          setModalProductSearchTerm(e.target.value);
                          setModalSelectedSuggestionIndex(-1); // Reset selection when typing
                        }}
                        onFocus={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();

                          if (!modalProductsData?.length) return;

                          const maxIndex = Math.min(modalProductsData.length - 1, 4); // Max 5 suggestions

                          switch (e.key) {
                            case 'ArrowDown':
                              e.preventDefault();
                              setModalSelectedSuggestionIndex(prev =>
                                prev < maxIndex ? prev + 1 : 0
                              );
                              break;
                            case 'ArrowUp':
                              e.preventDefault();
                              setModalSelectedSuggestionIndex(prev =>
                                prev > 0 ? prev - 1 : maxIndex
                              );
                              break;
                            case 'Enter':
                              e.preventDefault();
                              if (modalSelectedSuggestionIndex >= 0 && modalProductsData[modalSelectedSuggestionIndex]) {
                                const product = modalProductsData[modalSelectedSuggestionIndex];
                                setModalSelectedProduct(product);
                                setCustomRate(product.pricing?.retail || 0);
                                setQuantity(1);
                                setModalProductSearchTerm(product.name);
                                setModalSelectedSuggestionIndex(-1);

                                // Move focus to quantity field after selecting product
                                setTimeout(() => {
                                  const quantityInput = document.querySelector('.modal-quantity-input');
                                  if (quantityInput) {
                                    quantityInput.focus();
                                  }
                                }, 100);
                              }
                              break;
                            case 'Escape':
                              e.preventDefault();
                              setModalSelectedSuggestionIndex(-1);
                              break;
                          }
                        }}
                        className="modal-product-search w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      {/* Product Suggestions */}
                      {modalProductSearchTerm && modalProductsData?.length > 0 && (
                        <div className="mt-2 max-h-96 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                          {modalProductsData
                            .map((product, index) => (
                              <div
                                key={product._id}
                                onClick={() => {
                                  setModalSelectedProduct(product);
                                  setCustomRate(product.pricing?.retail || 0);
                                  setQuantity(1);
                                  setModalProductSearchTerm(product.name);
                                  setModalSelectedSuggestionIndex(-1);

                                  // Move focus to quantity field after selecting product
                                  setTimeout(() => {
                                    const quantityInput = document.querySelector('.modal-quantity-input');
                                    if (quantityInput) {
                                      quantityInput.focus();
                                    }
                                  }, 100);
                                }}
                                className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${modalSelectedSuggestionIndex === index
                                  ? 'bg-blue-100 border-blue-200'
                                  : 'hover:bg-gray-100'
                                  }`}
                              >
                                <div className="flex flex-col">
                                  <div className="font-medium">
                                    {product.isVariant
                                      ? (product.displayName || product.variantName || product.name)
                                      : product.name}
                                  </div>
                                  {product.isVariant && (
                                    <div className="text-xs text-gray-500">
                                      {product.variantType}: {product.variantValue}
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">
                                  Stock: {product.inventory?.currentStock || 0} |
                                  Price: {product.pricing?.retail || 0}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Quantity - 2 columns */}
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="modal-quantity-input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="1"
                      />
                    </div>

                    {/* Sale Price Per Unit - 2 columns */}
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sale Price Per Unit</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customRate}
                        onChange={(e) => setCustomRate(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Add Button - 2 columns */}
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (modalSelectedProduct && quantity > 0 && customRate >= 0) {
                            const newItem = {
                              product: modalSelectedProduct._id,
                              quantity: quantity,
                              unitPrice: customRate,
                              subtotal: quantity * customRate,
                              productData: modalSelectedProduct
                            };
                            setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
                            setModalSelectedProduct(null);
                            setModalProductSearchTerm('');
                            setQuantity(1);
                            setCustomRate('');
                            setModalSelectedSuggestionIndex(-1);
                          }
                        }}
                        disabled={!modalSelectedProduct || quantity <= 0 || customRate < 0}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Add Product
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Items */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Current Items:</h5>
                {formData.items.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No items in this order</p>
                ) : (
                  formData.items.map((item, index) => (
                    <div key={index} className="flex items-center p-3 bg-white border border-gray-200 rounded-lg">
                      {/* Product Name */}
                      <div className="font-medium text-gray-900 min-w-[200px] mr-4">
                        {item.productData?.name || 'Unknown Product'}
                      </div>

                      {/* Quantity, Price, Total and Delete - Grouped Together */}
                      <div className="flex items-center space-x-3 ml-auto">
                        {/* Quantity Field */}
                        <div className="flex items-center space-x-1">
                          <label className="text-xs text-gray-600">Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...formData.items];
                              const newQuantity = Math.max(1, parseInt(e.target.value) || 1);
                              newItems[index].quantity = newQuantity;
                              newItems[index].subtotal = newQuantity * newItems[index].unitPrice;
                              setFormData(prev => ({ ...prev, items: newItems }));
                            }}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* Sale Price Field */}
                        <div className="flex items-center space-x-1">
                          <label className="text-xs text-gray-600">× Sale Price:</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const newItems = [...formData.items];
                              const newPrice = parseFloat(e.target.value) || 0;
                              newItems[index].unitPrice = newPrice;
                              newItems[index].subtotal = newItems[index].quantity * newPrice;
                              setFormData(prev => ({ ...prev, items: newItems }));
                            }}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* Total Display */}
                        <div className="flex items-center space-x-1">
                          <label className="text-xs text-gray-600">=</label>
                          <span className="text-sm font-medium text-gray-900 min-w-[60px]">
                            {item.subtotal?.toFixed(2) || (item.quantity * item.unitPrice).toFixed(2)}
                          </span>
                        </div>

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = formData.items.filter((_, i) => i !== index);
                            setFormData(prev => ({ ...prev, items: newItems }));
                          }}
                          className="px-2 py-1 text-sm bg-red-200 text-red-700 rounded hover:bg-red-300 ml-2"
                          title="Remove item"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedOrder(null);
                  setModalProductSearchTerm('');
                  setModalSelectedProduct(null);
                  setModalSelectedSuggestionIndex(-1);
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <LoadingButton
                onClick={handleUpdate}
                isLoading={updating}
                disabled={updating || formData.items.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Update Sales Order
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          </div>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <DateFilter
                startDate={filters.fromDate}
                endDate={filters.toDate}
                onDateChange={(start, end) => {
                  handleFilterChange('fromDate', start);
                  handleFilterChange('toDate', end);
                }}
                compact={true}
                showPresets={true}
              />
            </div>

            {/* Order Number Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Number
              </label>
              <input
                type="text"
                placeholder="Contains..."
                value={filters.orderNumber}
                onChange={(e) => handleFilterChange('orderNumber', e.target.value)}
                className="input h-[42px]"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input h-[42px]"
              >
                <option value="">All Statuses</option>
                <option value="draft">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="partially_invoiced">Partially Invoiced</option>
                <option value="fully_invoiced">Fully Invoiced</option>
                <option value="cancelled">Cancelled</option>
                <option value="closed">Closed</option>
              </select>
            </div>


            {/* Search Button */}
            <div className="flex items-end">
              <button
                onClick={() => refetch()}
                className="btn btn-primary w-full flex items-center justify-center space-x-2 h-[42px]"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Sales Orders From: {formatDate(filters.fromDate)} To: {formatDate(filters.toDate)}
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {paginationInfo.totalItems || 0} records
              </span>
              <button
                onClick={() => refetch()}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="card-content p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">Loading sales orders...</p>
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
            <div className="overflow-x-auto">
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
                    <tr key={order._id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.soNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.customer?.displayName || order.customer?.businessName || order.customer?.name || 'Walk-in'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                        {order.orderType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(order.status)}
                          <span className="capitalize">
                            {order.status === 'draft' ? 'Pending' : order.status.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Math.round(order.total || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setNotesEntity({ type: 'SalesOrder', id: order._id, name: order.soNumber });
                              setShowNotes(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="Notes"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleView(order)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePrint(order)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Print"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
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
                                onClick={() => handleConfirm(order._id)}
                                isLoading={confirming}
                                className="text-green-600 hover:text-green-900"
                                title="Confirm Order"
                                disabled={confirming}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </LoadingButton>
                              <LoadingButton
                                onClick={() => handleCancel(order._id)}
                                isLoading={cancelling}
                                className="text-red-600 hover:text-red-900"
                                title="Cancel Order"
                                disabled={cancelling}
                              >
                                <XCircle className="h-4 w-4" />
                              </LoadingButton>
                            </>
                          )}
                          {order.status === 'draft' && (
                            <LoadingButton
                              onClick={() => handleDelete(order._id)}
                              isLoading={deleting}
                              className="text-red-600 hover:text-red-900"
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
          )}
        </div>
      </div>

      {/* View Modal - Bill Format */}
      {showViewModal && selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Sales Order</h3>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedOrder(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

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
                        selectedOrder.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          selectedOrder.status === 'partially_invoiced' ? 'bg-yellow-100 text-yellow-800' :
                            selectedOrder.status === 'fully_invoiced' ? 'bg-green-100 text-green-800' :
                              selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                        }`}>
                        {selectedOrder.status === 'draft' ? 'Pending' : selectedOrder.status.replace('_', ' ')}
                      </span>
                    </p>
                    {selectedOrder.expectedDelivery && (
                      <p><span className="font-medium">Expected Delivery:</span> {formatDate(selectedOrder.expectedDelivery)}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <h5 className="font-semibold text-gray-900 mb-2">Customer Details</h5>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Customer:</span> {safeRender(selectedOrder.customer?.displayName || selectedOrder.customer?.businessName || selectedOrder.customer?.name) || 'Walk-in'}</p>
                    {selectedOrder.customer?.email && (
                      <p><span className="font-medium">Email:</span> {safeRender(selectedOrder.customer.email)}</p>
                    )}
                    {selectedOrder.customer?.phone && (
                      <p><span className="font-medium">Phone:</span> {safeRender(selectedOrder.customer.phone)}</p>
                    )}
                    {selectedOrder.customer?.address && (
                      <p><span className="font-medium">Address:</span> {safeRender(selectedOrder.customer.address)}</p>
                    )}
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
                <div className="overflow-x-auto">
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
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedOrder.items && selectedOrder.items.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                            <div>
                              <div className="font-medium">{safeRender(item.product) || 'Unknown Product'}</div>
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
                    {selectedOrder.tax && selectedOrder.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax:</span>
                        <span className="font-medium">{Math.round(selectedOrder.tax)}</span>
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

              {/* Footer */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-xs text-gray-500">
                  Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handlePrint(selectedOrder)}
                    className="btn btn-primary flex items-center"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </button>
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      setSelectedOrder(null);
                    }}
                    className="btn btn-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Format Selection Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Export Sales Orders</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {/* Export Format */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Export Format
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="format"
                        value="pdf"
                        checked={exportFormat === 'pdf'}
                        onChange={(e) => setExportFormat(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">PDF</div>
                        <div className="text-sm text-gray-500">Print-ready format</div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="format"
                        value="excel"
                        checked={exportFormat === 'excel'}
                        onChange={(e) => setExportFormat(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Excel</div>
                        <div className="text-sm text-gray-500">Spreadsheet format</div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="format"
                        value="csv"
                        checked={exportFormat === 'csv'}
                        onChange={(e) => setExportFormat(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">CSV</div>
                        <div className="text-sm text-gray-500">Comma-separated values</div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="format"
                        value="json"
                        checked={exportFormat === 'json'}
                        onChange={(e) => setExportFormat(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">JSON</div>
                        <div className="text-sm text-gray-500">Data format</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowExportModal(false)}
                    className="btn btn-secondary"
                    disabled={isExporting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportConfirm}
                    className="btn btn-primary"
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default SalesOrders;