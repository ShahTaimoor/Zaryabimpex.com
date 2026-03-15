import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Download,
  XCircle,
  ArrowUpDown
} from 'lucide-react';
import { useGetProductsQuery, useLazyGetLastPurchasePriceQuery, useGetLastPurchasePricesMutation } from '../store/services/productsApi';
import { useGetVariantsQuery, useGetVariantsByBaseProductQuery } from '../store/services/productVariantsApi';
import { useGetCustomersQuery, useLazySearchCustomersQuery } from '../store/services/customersApi';
import { useCreateSaleMutation, useUpdateOrderMutation, useLazyGetLastPricesQuery } from '../store/services/salesApi';
import { useGetBanksQuery } from '../store/services/banksApi';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import toast from 'react-hot-toast';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import AsyncErrorBoundary from '../components/AsyncErrorBoundary';
import { ClearConfirmationDialog } from '../components/ConfirmationDialog';
import { useClearConfirmation } from '../hooks/useConfirmation';
import PaymentModal from '../components/PaymentModal';
import PrintModal from '../components/PrintModal';
import { useResponsive, ResponsiveGrid } from '../components/ResponsiveContainer';
import RecommendationSection from '../components/RecommendationSection';
import useBehaviorTracking from '../hooks/useBehaviorTracking';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../components/ComponentRegistry';
import { useAuth } from '../contexts/AuthContext';
import BarcodeScanner from '../components/BarcodeScanner';
import { Camera } from 'lucide-react';

// Helper function to get local date in YYYY-MM-DD format (avoids timezone issues with toISOString)
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ProductSearch Component
const ProductSearch = ({ onAddProduct, selectedCustomer, showCostPrice, onLastPurchasePriceFetched, hasCostPricePermission, priceType, onRefetchReady }) => {
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [customRate, setCustomRate] = useState('');
  const [calculatedRate, setCalculatedRate] = useState(0);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [searchKey, setSearchKey] = useState(0); // Key to force re-render
  const [lastPurchasePrice, setLastPurchasePrice] = useState(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const productSearchRef = useRef(null);

  // Fetch all products (or a larger set) for client-side fuzzy search
  const [getLastPurchasePrice] = useLazyGetLastPurchasePriceQuery();
  const [getLastPurchasePrices] = useGetLastPurchasePricesMutation();

  const { data: productsData, isLoading: productsLoading, error: productsError, refetch: refetchProducts } = useGetProductsQuery(
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

  // Expose refetch function to parent component via callback
  useEffect(() => {
    if (onRefetchReady && refetchProducts && typeof refetchProducts === 'function') {
      onRefetchReady(refetchProducts);
    }
  }, [onRefetchReady, refetchProducts]);

  // Extract products array from RTK Query response
  const allProducts = React.useMemo(() => {
    if (!productsData) return [];
    if (Array.isArray(productsData)) return productsData;
    if (productsData?.data?.products) return productsData.data.products;
    if (productsData?.products) return productsData.products;
    if (productsData?.data?.data?.products) return productsData.data.data.products;
    return [];
  }, [productsData]);

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

  const products = useFuzzySearch(
    allItems,
    productSearchTerm,
    ['name', 'description', 'brand', 'displayName', 'variantValue', 'variantName'],
    {
      threshold: 0.4,
      minScore: 0.3,
      limit: null // Show unlimited products
    }
  );

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
          if (onLastPurchasePriceFetched) {
            onLastPurchasePriceFetched(productIdForPrice, response.lastPurchasePrice);
          }
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

  const handleAddToCart = async () => {
    if (!selectedProduct) return;

    // Validate that rate is filled
    if (!customRate || parseInt(customRate) <= 0) {
      toast.error('Please enter a valid rate');
      return;
    }

    // Get display name for error messages
    const displayName = selectedProduct.isVariant
      ? (selectedProduct.displayName || selectedProduct.variantName || selectedProduct.name)
      : selectedProduct.name;

    // Check if product/variant is out of stock
    const currentStock = selectedProduct.inventory?.currentStock || 0;
    if (currentStock === 0) {
      toast.error(`${displayName} is out of stock and cannot be added to the invoice.`);
      return;
    }

    // Check if requested quantity exceeds available stock
    if (quantity > currentStock) {
      toast.error(`Cannot add ${quantity} units. Only ${currentStock} units available in stock.`);
      return;
    }

    setIsAddingToCart(true);
    try {
      // Use the rate from the input field
      const unitPrice = parseInt(customRate) || Math.round(calculatedRate);

      // Check if sale price is less than cost price (always check, regardless of showCostPrice)
      if (lastPurchasePrice !== null && unitPrice < lastPurchasePrice) {
        const loss = lastPurchasePrice - unitPrice;
        const lossPercent = ((loss / lastPurchasePrice) * 100).toFixed(1);
        const shouldProceed = window.confirm(
          `⚠️ WARNING: Sale price (${unitPrice}) is below cost price (${Math.round(lastPurchasePrice)}).\n\n` +
          `Loss per unit: ${Math.round(loss)} (${lossPercent}%)\n` +
          `Total loss for ${quantity} unit(s): ${Math.round(loss * quantity)}\n\n` +
          `Do you want to proceed?`
        );
        if (!shouldProceed) {
          return;
        }
        // Show warning toast even if proceeding
        toast.warning(
          `Product added with loss: ${Math.round(loss)} per unit (${lossPercent}%)`,
          { duration: 6000 }
        );
      }

      onAddProduct({
        product: selectedProduct,
        quantity: quantity,
        unitPrice: unitPrice
      });

      // Reset form
      setSelectedProduct(null);
      setQuantity(1);
      setCustomRate('');
      setCalculatedRate(0);
      setIsAddingProduct(false);

      // Clear search term and force re-render
      setProductSearchTerm('');
      setSearchKey(prev => prev + 1);

      // Focus back to product search input
      setTimeout(() => {
        if (productSearchRef.current) {
          productSearchRef.current.focus();
        }
      }, 100);

      // Show success message
      const priceLabel = selectedCustomer?.businessType === 'wholesale' ? 'wholesale' :
        selectedCustomer?.businessType === 'distributor' ? 'distributor' : 'retail';
      toast.success(`${selectedProduct.name} added to cart at ${priceLabel} price: ${Math.round(unitPrice)}`);
    } catch (error) {
      handleApiError(error, 'Product Price Check');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isAddingProduct) {
      e.preventDefault();
      handleAddToCart();
    } else if (e.key === 'Escape' && isAddingProduct) {
      e.preventDefault();
      setSelectedProduct(null);
      setQuantity(1);
      setCustomRate('');
      setCalculatedRate(0);
      setIsAddingProduct(false);
    }
  };

  const productDisplayKey = (product) => {
    const inventory = product.inventory || {};
    const isLowStock = inventory.currentStock <= inventory.reorderPoint;
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

    const purchasePrice = pricing?.cost || 0;

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
          {showCostPrice && hasCostPricePermission && purchasePrice > 0 && (
            <div className="text-sm text-red-600 font-medium">Cost: {Math.round(purchasePrice)}</div>
          )}
          <div className="text-sm text-gray-600">Price: {Math.round(unitPrice)}</div>
        </div>
      </div>
    );
  };

  const searchColClass = showCostPrice && hasCostPricePermission ? 'col-span-6' : 'col-span-7';

  return (
    <div className="space-y-4">
      {/* Product Selection - Responsive Layout */}
      <div>
        {/* Mobile Layout */}
        <div className="md:hidden space-y-3">
          {/* Product Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Search
            </label>
            <div className="relative flex space-x-2">
              <div className="flex-1">
                <SearchableDropdown
                  key={searchKey}
                  ref={productSearchRef}
                  placeholder="Search or select product..."
                  items={products || []}
                  onSelect={handleProductSelect}
                  onSearch={setProductSearchTerm}
                  displayKey={productDisplayKey}
                  selectedItem={selectedProduct}
                  loading={productsLoading || variantsLoading}
                  emptyMessage={productSearchTerm.length > 0 ? "No products found" : "Start typing to search products..."}
                  value={productSearchTerm}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowBarcodeScanner(true)}
                className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center flex-shrink-0"
                title="Scan barcode to search product"
              >
                <Camera className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Fields Grid - 2 columns on mobile */}
          <div className="grid grid-cols-2 gap-3">
            {/* Stock */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Stock
              </label>
              <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-2 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
                {selectedProduct ? selectedProduct.inventory.currentStock : '0'}
              </span>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Amount
              </label>
              <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-2 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
                {isAddingProduct ? Math.round(quantity * parseInt(customRate || 0)) : 0}
              </span>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                max={selectedProduct?.inventory.currentStock}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.target.select()}
                className="input text-center h-10"
                placeholder="1"
                autoFocus={isAddingProduct}
              />
            </div>

            {/* Rate */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rate
              </label>
              <input
                type="number"
                step="1"
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.target.select()}
                className="input text-center h-10"
                placeholder="0"
                required
              />
            </div>

            {/* Cost - Full width if shown */}
            {showCostPrice && hasCostPricePermission && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Cost
                </label>
                <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-2 rounded border border-red-200 block text-center h-10 flex items-center justify-center" title="Cost Price">
                  {lastPurchasePrice !== null
                    ? `${Math.round(lastPurchasePrice)}`
                    : selectedProduct?.pricing?.cost
                      ? `${Math.round(selectedProduct.pricing.cost)}`
                      : selectedProduct ? 'N/A' : '0'}
                </span>
              </div>
            )}
          </div>

          {/* Add Button - Full width on mobile */}
          <div>
            <LoadingButton
              type="button"
              onClick={handleAddToCart}
              isLoading={isAddingToCart}
              className="w-full btn btn-primary flex items-center justify-center px-4 py-2.5 h-11"
              disabled={!selectedProduct || isAddingToCart}
              title="Add to cart (or press Enter in Quantity/Rate fields - focus returns to search)"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </LoadingButton>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:grid grid-cols-12 gap-4 items-end">
          {/* Product Search - 7 columns */}
          <div className={searchColClass}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Search
            </label>
            <div className="relative flex space-x-2">
              <div className="flex-1">
                <SearchableDropdown
                  key={searchKey}
                  ref={productSearchRef}
                  placeholder="Search or select product..."
                  items={products || []}
                  onSelect={handleProductSelect}
                  onSearch={setProductSearchTerm}
                  displayKey={productDisplayKey}
                  selectedItem={selectedProduct}
                  loading={productsLoading || variantsLoading}
                  emptyMessage={productSearchTerm.length > 0 ? "No products found" : "Start typing to search products..."}
                  value={productSearchTerm}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowBarcodeScanner(true)}
                className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center"
                title="Scan barcode to search product"
              >
                <Camera className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Stock - 1 column */}
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock
            </label>
            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
              {selectedProduct ? selectedProduct.inventory.currentStock : '0'}
            </span>
          </div>

          {/* Quantity - 1 column */}
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              max={selectedProduct?.inventory.currentStock}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              onKeyDown={handleKeyDown}
              onFocus={(e) => e.target.select()}
              className="input text-center"
              placeholder="1 (Enter to add & focus search)"
              autoFocus={isAddingProduct}
            />
          </div>

          {/* Purchase Price - 1 column (conditional) - Between Quantity and Rate */}
          {showCostPrice && hasCostPricePermission && (
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost
              </label>
              <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 block text-center h-10 flex items-center justify-center" title="Cost Price">
                {lastPurchasePrice !== null
                  ? `${Math.round(lastPurchasePrice)}`
                  : selectedProduct?.pricing?.cost
                    ? `${Math.round(selectedProduct.pricing.cost)}`
                    : selectedProduct ? 'N/A' : '0'}
              </span>
            </div>
          )}

          {/* Rate - 1 column (reduced from 2) */}
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rate
            </label>
            <input
              type="number"
              step="1"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={(e) => e.target.select()}
              className="input text-center"
              placeholder="0 (Enter to add & focus search)"
              required
            />
          </div>

          {/* Amount - 1 column */}
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount
            </label>
            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
              {isAddingProduct ? Math.round(quantity * parseInt(customRate || 0)) : 0}
            </span>
          </div>

          {/* Add Button - 1 column */}
          <div className="col-span-1 flex items-end">
            <LoadingButton
              type="button"
              onClick={handleAddToCart}
              isLoading={isAddingToCart}
              className="w-full btn btn-primary flex items-center justify-center px-3 py-2"
              disabled={!selectedProduct || isAddingToCart}
              title="Add to cart (or press Enter in Quantity/Rate fields - focus returns to search)"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={(barcodeValue) => {
          // Search for product by barcode
          const foundProduct = allProducts.find(p =>
            p.barcode === barcodeValue || p.sku === barcodeValue
          );

          if (foundProduct) {
            handleProductSelect(foundProduct);
            toast.success(`Product found: ${foundProduct.name}`);
          } else {
            // If not found by barcode, search by name/description
            setProductSearchTerm(barcodeValue);
            toast(`Searching for: ${barcodeValue}`, { icon: 'ℹ️' });
          }
          setShowBarcodeScanner(false);
        }}
        scanMode="both"
      />
    </div>
  );
};

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
  const [currentOrder, setCurrentOrder] = useState(null);
  const [appliedDiscounts, setAppliedDiscounts] = useState([]);
  const [isTaxExempt, setIsTaxExempt] = useState(true);
  const [directDiscount, setDirectDiscount] = useState({ type: 'amount', value: 0 });
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(true);
  const [billDate, setBillDate] = useState(getLocalDateString()); // Default to current date for backdating invoices
  const [notes, setNotes] = useState('');
  const [isLoadingLastPrices, setIsLoadingLastPrices] = useState(false);
  const [isRestoringPrices, setIsRestoringPrices] = useState(false);
  const [isClearingCart, setIsClearingCart] = useState(false);
  const [isRemovingFromCart, setIsRemovingFromCart] = useState({});
  const [originalPrices, setOriginalPrices] = useState({}); // Store original prices before applying last prices
  const [isLastPricesApplied, setIsLastPricesApplied] = useState(false);
  const [priceStatus, setPriceStatus] = useState({}); // Track price change status: 'updated', 'not-found', 'unchanged'
  const [showCostPrice, setShowCostPrice] = useState(false); // Toggle to show/hide cost prices
  const [lastPurchasePrices, setLastPurchasePrices] = useState({}); // Store last purchase prices for products
  const [priceType, setPriceType] = useState('wholesale'); // Price type: 'retail' or 'wholesale' or 'custom'
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [isExporting, setIsExporting] = useState(false);

  // Calculate default date range (one month ago to today)
  const getDefaultDateRange = () => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      from: formatDate(oneMonthAgo),
      to: formatDate(today)
    };
  };

  const defaultDateRange = getDefaultDateRange();
  const [exportDateFrom, setExportDateFrom] = useState(defaultDateRange.from);
  const [exportDateTo, setExportDateTo] = useState(defaultDateRange.to);
  const { isMobile, isTablet } = useResponsive();
  const { trackAddToCart, trackProductView, trackPageView } = useBehaviorTracking();
  const { updateTabTitle, getActiveTab, openTab } = useTab();
  const { hasPermission, user } = useAuth();
  const [showProfit, setShowProfit] = useState(false);
  const totalProfit = useMemo(() => {
    if (!Array.isArray(cart) || cart.length === 0) return 0;

    return cart.reduce((sum, item) => {
      if (!item?.product) return sum;

      const productId = item.product._id;
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
    if (!customer) return '';

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getTime()).slice(-4); // Last 4 digits of timestamp

    // Format: CUSTOMER-INITIALS-YYYYMMDD-XXXX
    const customerInitials = customer.displayName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3);

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

      // Set payment method and amount paid if available
      if (editData.payment) {
        setPaymentMethod(editData.payment.method || 'cash');
        setAmountPaid(editData.payment.amount || 0);
        if (editData.payment.method === 'bank') {
          setSelectedBankAccount(editData.payment.bankAccount || '');
        } else {
          setSelectedBankAccount('');
        }
      }

      // Set order type
      if (editData.orderType) {
        // Order type is handled by customer selection
      }

      // Data loaded successfully (no toast needed as Orders already shows opening message)
    }
  }, [editData?.orderId]); // Only depend on orderId to prevent multiple executions

  // RTK Query hooks
  const { data: banksData, isLoading: banksLoading } = useGetBanksQuery(
    { isActive: true },
    { staleTime: 5 * 60_000 }
  );

  const { data: customersData, isLoading: customersLoading, refetch: refetchCustomers } = useGetCustomersQuery(
    { limit: 999999 },
    {
      staleTime: 0, // Always consider data stale to get fresh credit information
      refetchOnMountOrArgChange: true // Refetch when component mounts or params change
    }
  );

  // Lazy query hooks for fetching last purchase prices
  const [getLastPurchasePrice] = useLazyGetLastPurchasePriceQuery();
  const [getLastPurchasePrices] = useGetLastPurchasePricesMutation();

  // Sales mutations
  const [createSale, { isLoading: isCreatingSale }] = useCreateSaleMutation();
  const [updateOrder, { isLoading: isUpdatingOrder }] = useUpdateOrderMutation();
  const [getLastPrices] = useLazyGetLastPricesQuery();

  // Duplicate prevention: use BOTH ref (synchronous check) and state (button disable)
  const isSubmittingRef = useRef(false); // For immediate synchronous checks
  const [isSubmitting, setIsSubmitting] = useState(false); // For button disabled state

  // Helper function to reset submitting state (ensures both ref and state are reset)
  const resetSubmittingState = useCallback(() => {
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  }, []);

  // Extract customers array from RTK Query response
  const customers = useMemo(() => {
    return customersData?.data?.customers || customersData?.customers || customersData?.data || customersData || [];
  }, [customersData]);

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

  // Map businessType to orderType
  // businessType: ['retail', 'wholesale', 'distributor', 'individual']
  // orderType: ['retail', 'wholesale', 'return', 'exchange']
  const mapBusinessTypeToOrderType = (businessType) => {
    if (!businessType) return 'retail';
    if (businessType === 'retail' || businessType === 'wholesale') return businessType;
    if (businessType === 'distributor') return 'wholesale'; // Distributors are wholesale customers
    if (businessType === 'individual') return 'retail'; // Individuals are retail customers
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
      updateTabTitle(activeTab.id, `Sales - ${customer.displayName}`);
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

      const productIds = cart.map(item => item.product._id);
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
    setCart(prevCart => {
      // For variants, use variant _id; for products, use product _id
      const itemId = newItem.product._id;
      const existingItem = prevCart.find(item => item.product._id === itemId);

      if (existingItem) {
        // Check if combined quantity exceeds available stock
        const combinedQuantity = existingItem.quantity + newItem.quantity;
        const availableStock = newItem.product.inventory?.currentStock || 0;

        if (combinedQuantity > availableStock) {
          const displayName = newItem.product.isVariant
            ? (newItem.product.displayName || newItem.product.variantName || newItem.product.name)
            : newItem.product.name;
          toast.error(`Cannot add ${newItem.quantity} more units. Only ${availableStock - existingItem.quantity} additional units available (${existingItem.quantity} already in cart).`);
          return prevCart; // Return unchanged cart
        }

        // If this is an existing item and we have original price stored, keep it
        // Otherwise, if last prices were applied and original price exists, preserve it
        const updatedCart = prevCart.map(item =>
          item.product._id === itemId
            ? { ...item, quantity: item.quantity + newItem.quantity, unitPrice: newItem.unitPrice }
            : item
        );

        return updatedCart;
      }

      // New item added - fetch its last purchase price (always, for loss alerts)
      // For variants, use base product ID to get purchase price
      const productIdForPrice = newItem.product.isVariant
        ? newItem.product.baseProductId
        : newItem.product._id;

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
      return [...prevCart, newItem];
    });
  };

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart => {
      const cartItem = prevCart.find(item => item.product._id === productId);
      if (!cartItem) return prevCart;

      // Check if new quantity exceeds available stock
      const availableStock = cartItem.product.inventory?.currentStock || 0;

      if (newQuantity > availableStock) {
        toast.error(`Cannot set quantity to ${newQuantity}. Only ${availableStock} units available in stock.`);
        return prevCart; // Return unchanged cart
      }

      return prevCart.map(item =>
        item.product._id === productId
          ? { ...item, quantity: newQuantity }
          : item
      );
    });
  };

  const updateUnitPrice = (productId, newPrice) => {
    if (newPrice < 0) return;

    // Check if sale price is less than cost price (always check, regardless of showCostPrice)
    const cartItem = cart.find(item => item.product._id === productId);
    if (cartItem) {
      const costPrice = lastPurchasePrices[productId];
      if (costPrice !== undefined && newPrice < costPrice) {
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

  const handleClearCart = () => {
    if (cart.length > 0) {
      setIsClearingCart(true);
      confirmClear(cart.length, 'items', async () => {
        try {
          setCart([]);
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

  const handleExport = () => {
    setShowExportModal(true);
  };

  const handleExportConfirm = async () => {
    setIsExporting(true);
    try {
      // Build filters based on current view (if any filters exist)
      const filters = {
        // Include customer filter if a customer is selected
        ...(selectedCustomer?._id && { customer: selectedCustomer._id }),
        // Include date range if selected
        ...(exportDateFrom && { dateFrom: exportDateFrom }),
        ...(exportDateTo && { dateTo: exportDateTo }),
      };

      let response;
      if (exportFormat === 'excel') {
        response = await salesAPI.exportExcel(filters);
      } else if (exportFormat === 'csv') {
        response = await salesAPI.exportCSV(filters);
      } else if (exportFormat === 'json') {
        response = await salesAPI.exportJSON(filters);
      } else if (exportFormat === 'pdf') {
        response = await salesAPI.exportPDF(filters);
      }

      if (response?.data?.filename) {
        const filename = response.data.filename;

        try {
          // Add a small delay to ensure file is written (PDF generation is async)
          if (exportFormat === 'pdf') {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Download the file
          let downloadResponse;
          try {
            downloadResponse = await salesAPI.downloadFile(filename);
          } catch (downloadErr) {
            // Handle axios errors
            if (downloadErr.response) {
              // Server returned an error status
              const errorData = downloadErr.response.data;
              if (errorData instanceof Blob) {
                // Error response is a blob, try to read it
                const reader = new FileReader();
                reader.onload = () => {
                  const text = reader.result;
                  try {
                    const parsedError = JSON.parse(text);
                    showErrorToast(parsedError.message || `Download failed: ${downloadErr.response.status}`);
                  } catch {
                    showErrorToast(`Download failed: ${downloadErr.response.status}`);
                  }
                };
                reader.readAsText(errorData);
              } else if (typeof errorData === 'object' && errorData !== null) {
                showErrorToast(errorData.message || `Download failed: ${downloadErr.response.status}`);
              } else {
                showErrorToast(`Download failed: ${downloadErr.response.status}`);
              }
            } else {
              showErrorToast('Download failed: ' + (downloadErr.message || 'Network error'));
            }
            return;
          }

          // Check if response is successful
          if (!downloadResponse) {
            showErrorToast('Download failed: No response received');
            return;
          }

          if (downloadResponse.status !== 200) {
            showErrorToast(`Download failed with status ${downloadResponse.status}`);
            return;
          }

          // Check if data exists
          if (!downloadResponse.data) {
            showErrorToast('Download failed: No data received from server');
            return;
          }

          // Check content type from headers
          const contentType = downloadResponse.headers?.['content-type'] || downloadResponse.headers?.['Content-Type'] || '';

          if (exportFormat === 'pdf') {
            // For PDF, open in new tab for preview
            const blob = downloadResponse.data;

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

            // Check if content type indicates an error (JSON error response)
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
            const blob = new Blob([downloadResponse.data], {
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

      // Show print modal if order was created
      if (result?.order) {
        setCurrentOrder(result.order);
        setShowPrintModal(true);
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

      // Show print modal if order was updated
      if (result?.order) {
        setCurrentOrder(result.order);
        setShowPrintModal(true);
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
    if (selectedCustomer && selectedCustomer.creditLimit > 0) {
      const currentPaymentMethod = paymentMethod || 'cash';
      const currentAmountPaid = amountPaid || 0;
      const unpaidAmount = total - currentAmountPaid;

      // For account payments or partial payments, check credit limit
      if (currentPaymentMethod === 'account' || unpaidAmount > 0) {
        const currentBalance = selectedCustomer.currentBalance || 0;
        const pendingBalance = selectedCustomer.pendingBalance || 0;
        const totalOutstanding = currentBalance;
        const newBalanceAfterOrder = totalOutstanding + unpaidAmount;
        const availableCredit = selectedCustomer.creditLimit - totalOutstanding;

        if (newBalanceAfterOrder > selectedCustomer.creditLimit) {
          // Show simple and clear message when credit limit is exceeded
          toast.error(`Your credit limit is full. Credit limit: ${selectedCustomer.creditLimit.toFixed(2)}. Please collect payment or reduce the order amount.`, {
            duration: 8000,
            position: 'top-center',
            icon: '⚠️'
          });
          return;
        } else if (availableCredit - unpaidAmount < (selectedCustomer.creditLimit * 0.1)) {
          // Warning when credit limit is almost reached (within 10%)
          const warningMessage = `Warning: ${selectedCustomer.displayName || selectedCustomer.name} is near credit limit. ` +
            `Available credit: ${availableCredit.toFixed(2)}, ` +
            `After this order: ${(availableCredit - unpaidAmount).toFixed(2)} remaining.`;

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

    const orderData = {
      orderType: mapBusinessTypeToOrderType(selectedCustomer?.businessType),
      customer: selectedCustomer?._id,
      items: cart.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      })),
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
        amount: amountPaid,
        remainingBalance: total - amountPaid,
        isPartialPayment: amountPaid < total,
        isAdvancePayment: isAdvancePayment,
        advanceAmount: isAdvancePayment ? (amountPaid - total) : 0
      }
    };

    // Use appropriate mutation based on edit mode
    if (editData?.isEditMode) {
      const orderId = editData.orderId;
      // For updates, send items with all required fields according to orderItemSchema
      const updateData = {
        orderType: mapBusinessTypeToOrderType(selectedCustomer?.businessType),
        customer: selectedCustomer?._id,
        items: cart.map(item => {
          const itemSubtotal = item.quantity * item.unitPrice;
          const itemDiscountAmount = 0; // Can be calculated if needed
          const itemTaxAmount = 0; // Can be calculated if needed
          const itemTotal = itemSubtotal - itemDiscountAmount + itemTaxAmount;

          return {
            product: item.product._id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: 0,
            taxRate: 0,
            subtotal: itemSubtotal,
            discountAmount: itemDiscountAmount,
            taxAmount: itemTaxAmount,
            total: itemTotal
          };
        }),
        notes: notes || ''
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
            <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>Point of Sale</h1>
            <p className="text-gray-600">Process sales transactions</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExport}
              className="btn btn-secondary btn-md"
              title="Export Sales Report"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Sales Report
            </button>
            <button
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
              className="btn btn-primary btn-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Sales
            </button>
          </div>
        </div>

        {/* Customer Selection and Information Row */}
        <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start space-x-4'}`}>
          {/* Customer Selection */}
          <div className={`${isMobile ? 'w-full' : 'w-[500px] flex-shrink-0'}`}>
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
                // Calculate total balance: currentBalance (which is net balance)
                const totalBalance = customer.currentBalance !== undefined
                  ? customer.currentBalance
                  : ((customer.pendingBalance || 0) - (customer.advanceBalance || 0));
                const hasBalance = totalBalance !== 0;
                const isPayable = totalBalance < 0;
                const isReceivable = totalBalance > 0;

                return (
                  <div>
                    <div className="font-medium">{customer.displayName}</div>
                    {hasBalance ? (
                      <div className={`text-sm ${isPayable ? 'text-red-600' : 'text-green-600'}`}>
                        Total Balance: {isPayable ? '-' : '+'}{Math.abs(totalBalance).toFixed(2)}
                      </div>
                    ) : null}
                  </div>
                );
              }}
              loading={customersLoading}
              emptyMessage="No customers found"
            />
          </div>

          {/* Customer Information - Right Side */}
          <div className={`${isMobile ? 'w-full' : 'flex-1'}`}>
            {selectedCustomer ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="font-medium">{selectedCustomer.displayName}</p>
                    <p className="text-sm text-gray-600 capitalize">
                      {selectedCustomer.businessType} • {selectedCustomer.phone || 'No phone'}
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      {(() => {
                        // Calculate total balance: currentBalance (which is the net total balance)
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
                  {user?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => setShowProfit((prev) => !prev)}
                        className="btn btn-secondary btn-sm flex items-center space-x-2"
                        title="Show estimated profit (BP)"
                      >
                        <Calculator className="h-4 w-4" />
                        <span>{showProfit ? 'Hide BP' : 'Show BP'}</span>
                      </button>
                      {showProfit && (
                        <span
                          className={`text-sm font-semibold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                        >
                          {new Intl.NumberFormat('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(totalProfit || 0)}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {selectedCustomer && cart.length > 0 && (
                  <>
                    {!isLastPricesApplied ? (
                      <LoadingButton
                        onClick={handleApplyLastPrices}
                        isLoading={isLoadingLastPrices}
                        className="btn btn-secondary btn-sm"
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
                        <RotateCcw className="h-4 w-4" />
                        <span>Restore Current Prices</span>
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
              <ProductSearch
                onAddProduct={addToCart}
                selectedCustomer={selectedCustomer}
                showCostPrice={showCostPrice}
                hasCostPricePermission={hasPermission('view_cost_prices')}
                priceType={priceType}
                onRefetchReady={setRefetchProducts}
                onLastPurchasePriceFetched={(productId, price) => {
                  setLastPurchasePrices(prev => ({
                    ...prev,
                    [productId]: price
                  }));
                }}
              />
            </div>

            {/* Cart Items */}
            {cart.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border-t border-gray-200">
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2">No items in cart</p>
              </div>
            ) : (
              <div className="space-y-4 border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-700">Cart Items</h4>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={handleSortCartItems}
                      className="btn btn-secondary btn-sm flex items-center space-x-2"
                      title="Sort products alphabetically"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      <span>Sort A-Z</span>
                    </button>
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

                {/* Desktop Table Header Row */}
                <div className="hidden md:grid grid-cols-12 gap-4 items-center pb-2 border-b border-gray-300 mb-2">
                  <div className="col-span-1">
                    <span className="text-xs font-semibold text-gray-600 uppercase">#</span>
                  </div>
                  <div className={`${showCostPrice && hasPermission('view_cost_prices') ? 'col-span-5' : 'col-span-6'}`}>
                    <span className="text-xs font-semibold text-gray-600 uppercase">Product</span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Stock</span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Qty</span>
                  </div>
                  {showCostPrice && hasPermission('view_cost_prices') && (
                    <div className="col-span-1">
                      <span className="text-xs font-semibold text-gray-600 uppercase">Cost</span>
                    </div>
                  )}
                  <div className="col-span-1">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Rate</span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Total</span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Action</span>
                  </div>
                </div>

                {cart.map((item, index) => {
                  const totalPrice = item.unitPrice * item.quantity;
                  const isLowStock = item.product.inventory?.currentStock <= item.product.inventory?.reorderPoint;

                  return (
                    <div key={item.product._id}>
                      {/* Mobile Card View */}
                      <div className="md:hidden mb-4 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{index + 1}</span>
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
                          <LoadingButton
                            onClick={() => removeFromCart(item.product._id)}
                            isLoading={isRemovingFromCart[item.product._id]}
                            className="btn btn-danger btn-sm h-8 w-8 p-0 flex-shrink-0 ml-2"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </LoadingButton>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
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
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product._id, parseInt(e.target.value) || 1)}
                              className="input text-center h-8 w-full"
                              min="1"
                              max={item.product.inventory?.currentStock || 999999}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Rate</label>
                            <input
                              type="number"
                              step="1"
                              value={Math.round(item.unitPrice)}
                              onChange={(e) => updateUnitPrice(item.product._id, parseInt(e.target.value) || 0)}
                              className={`input text-center h-8 w-full ${(lastPurchasePrices[item.product._id] !== undefined &&
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
                        <div className="grid grid-cols-12 gap-4 items-center">
                          {/* Serial Number - 1 column */}
                          <div className="col-span-1">
                            <span className="text-sm font-medium text-gray-700 bg-gray-50 px-0.5 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
                              {index + 1}
                            </span>
                          </div>

                          {/* Product Name - mirror Sales Order layout (6 columns normally, 5 when cost column shown) */}
                          <div className={`${showCostPrice && hasPermission('view_cost_prices') ? 'col-span-5' : 'col-span-6'} flex items-center h-8`}>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm truncate">
                                {item.product.isVariant
                                  ? (item.product.displayName || item.product.variantName || item.product.name)
                                  : item.product.name}
                                {isLowStock && <span className="text-yellow-600 text-xs ml-2">⚠️ Low Stock</span>}
                                {/* Warning if sale price is below cost price (always show, regardless of showCostPrice) */}
                                {lastPurchasePrices[item.product._id] !== undefined &&
                                  item.unitPrice < lastPurchasePrices[item.product._id] && (
                                    <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold" title={`Sale price below cost! Loss: ${Math.round(lastPurchasePrices[item.product._id] - item.unitPrice)} per unit`}>
                                      ⚠️ Loss
                                    </span>
                                  )}
                                {isLastPricesApplied && priceStatus[item.product._id] && (
                                  <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${priceStatus[item.product._id] === 'updated'
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
                              </span>
                              {item.product.isVariant && (
                                <span className="text-xs text-gray-500">
                                  {item.product.variantType}: {item.product.variantValue}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stock - 1 column */}
                          <div className="col-span-1">
                            <span className={`text-sm font-semibold px-2 py-1 rounded border block text-center h-8 flex items-center justify-center ${(item.product.inventory?.currentStock || 0) === 0
                              ? 'text-red-700 bg-red-50 border-red-200'
                              : (item.product.inventory?.currentStock || 0) <= (item.product.inventory?.reorderPoint || 0)
                                ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                                : 'text-gray-700 bg-gray-100 border-gray-200'
                              }`}>
                              {item.product.inventory?.currentStock || 0}
                            </span>
                          </div>

                          {/* Quantity - 1 column */}
                          <div className="col-span-1">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product._id, parseInt(e.target.value) || 1)}
                              className="input text-center h-8"
                              min="1"
                              max={item.product.inventory?.currentStock || 999999}
                              title={`Maximum available: ${item.product.inventory?.currentStock || 0}`}
                            />
                          </div>

                          {/* Purchase Price (Cost) - 1 column (conditional) - Between Quantity and Rate */}
                          {showCostPrice && hasPermission('view_cost_prices') && (
                            <div className="col-span-1">
                              <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 block text-center h-8 flex items-center justify-center" title="Last Purchase Price">
                                {lastPurchasePrices[item.product._id] !== undefined
                                  ? `${Math.round(lastPurchasePrices[item.product._id])}`
                                  : 'N/A'}
                              </span>
                            </div>
                          )}

                          {/* Rate - 1 column */}
                          <div className="col-span-1 relative">
                            <input
                              type="number"
                              step="1"
                              value={Math.round(item.unitPrice)}
                              onChange={(e) => updateUnitPrice(item.product._id, parseInt(e.target.value) || 0)}
                              className={`input text-center h-8 ${
                                // Check if sale price is less than cost price - highest priority styling (always check)
                                (lastPurchasePrices[item.product._id] !== undefined &&
                                  item.unitPrice < lastPurchasePrices[item.product._id])
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
                                (lastPurchasePrices[item.product._id] !== undefined &&
                                  item.unitPrice < lastPurchasePrices[item.product._id])
                                  ? `⚠️ WARNING: Sale price ($${Math.round(item.unitPrice)}) is below cost price ($${Math.round(lastPurchasePrices[item.product._id])})`
                                  : ''
                              }
                            />
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
                          <div className="col-span-1">
                            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
                              {Math.round(totalPrice)}
                            </span>
                          </div>

                          {/* Delete Button - 1 column */}
                          <div className="col-span-1">
                            <LoadingButton
                              onClick={() => removeFromCart(item.product._id)}
                              isLoading={isRemovingFromCart[item.product._id]}
                              className="btn btn-danger btn-sm h-8 w-full"
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
            )}
          </div>
        </div>

        {/* Combined Sales Details and Order Summary */}
        {cart.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg max-w-5xl ml-auto mt-4">
            {/* Sales Details Section */}
            <div className="px-4 sm:px-6 py-4 border-b border-blue-200">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 text-left sm:text-right mb-4">Sales Details</h3>

              {/* Mobile Layout - Stacked */}
              <div className="md:hidden space-y-3">
                {/* Order Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Order Type
                  </label>
                  <select
                    value={selectedCustomer?.businessType || 'wholesale'}
                    className="input h-10 text-sm w-full"
                    disabled
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="return">Return</option>
                    <option value="exchange">Exchange</option>
                  </select>
                </div>

                {/* Tax Exemption Option */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tax Status
                  </label>
                  <div className="flex items-center space-x-2 px-3 py-2 border border-gray-200 rounded h-10">
                    <input
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
                      <input
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
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full input pr-20 h-10 text-sm"
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
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="input h-10 text-sm w-full"
                    max={getLocalDateString()} // Prevent future dates
                  />
                  {billDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Invoice number will be generated based on this date
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input h-10 text-sm w-full"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              {/* Desktop Layout - Horizontal */}
              <div className="hidden md:flex flex-nowrap gap-3 items-end justify-end">
                {/* Order Type */}
                <div className="flex flex-col w-44">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Order Type
                  </label>
                  <select
                    value={selectedCustomer?.businessType || 'wholesale'}
                    className="input h-8 text-sm"
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
                    <input
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
                      <input
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
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full input pr-16 h-8 text-sm"
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
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="input h-8 text-sm"
                    max={getLocalDateString()} // Prevent future dates
                  />
                  {billDate && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Invoice number based on this date
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="flex flex-col w-[28rem]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input h-8 text-sm"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            </div>

            {/* Order Summary Section */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">Order Summary</h3>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-semibold">Subtotal:</span>
                  <span className="text-xl font-bold text-gray-900">{Math.round(subtotal)}</span>
                </div>
                {totalDiscountAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-800 font-semibold">Discount:</span>
                    <span className="text-xl font-bold text-red-600">-{Math.round(totalDiscountAmount)}</span>
                  </div>
                )}
                {!isTaxExempt && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-800 font-semibold">Tax (8%):</span>
                    <span className="text-xl font-bold text-gray-900">{Math.round(tax)}</span>
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

              {/* Payment and Discount Section - One Row */}
              <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
                  {/* Apply Discount */}
                  <div className="flex flex-col">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Apply Discount
                    </label>
                    <div className="flex space-x-2">
                      <select
                        value={directDiscount.type}
                        onChange={(e) => setDirectDiscount({ ...directDiscount, type: e.target.value })}
                        className="px-3 py-2 border-2 border-blue-200 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium h-[42px]"
                      >
                        <option value="amount">Amount</option>
                        <option value="percentage">%</option>
                      </select>
                      <input
                        type="number"
                        placeholder={directDiscount.type === 'amount' ? 'Enter amount...' : 'Enter percentage...'}
                        value={directDiscount.value || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setDirectDiscount({ ...directDiscount, value });
                        }}
                        className="flex-1 px-3 py-2 border-2 border-blue-200 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-900 h-[42px]"
                        min="0"
                        step={directDiscount.type === 'percentage' ? '1' : '1'}
                      />
                    </div>
                    {directDiscount.value > 0 && (
                      <div className="text-sm text-green-700 font-semibold mt-2 bg-green-50 px-2 py-1 rounded">
                        {directDiscount.type === 'percentage'
                          ? `${directDiscount.value}% = ${Math.round(directDiscountAmount)} off`
                          : `${Math.round(directDiscount.value)} off`
                        }
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="flex flex-col md:col-start-2 md:row-start-1 w-full">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
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
                      className="w-full px-3 py-2 border-2 border-blue-200 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-900 h-[42px]"
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
                          className="w-full px-3 py-2 border-2 border-blue-200 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-900 h-[42px]"
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
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Amount Paid
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={Math.round(amountPaid)}
                      onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border-2 border-blue-200 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-900 text-lg h-[42px]"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Clear Discount Button */}
                {directDiscount.value > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setDirectDiscount({ type: 'amount', value: 0 })}
                      className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                    >
                      Clear Discount
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                {cart.length > 0 && (
                  <LoadingButton
                    onClick={handleClearCart}
                    isLoading={isClearingCart}
                    className="btn btn-secondary flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Cart
                  </LoadingButton>
                )}
                {cart.length > 0 && (
                  <button
                    onClick={() => {
                      // Format address from customer for print (same logic as backend/PrintDocument)
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
                          name: selectedCustomer.displayName,
                          email: selectedCustomer.email,
                          phone: selectedCustomer.phone,
                          businessName: selectedCustomer.businessName,
                          address: customerAddress || undefined,
                          currentBalance: selectedCustomer.currentBalance,
                          pendingBalance: selectedCustomer.pendingBalance,
                          advanceBalance: selectedCustomer.advanceBalance
                        } : null,
                        items: cart.map(item => ({
                          product: {
                            name: item.product.name
                          },
                          quantity: item.quantity,
                          unitPrice: item.unitPrice
                        })),
                        pricing: {
                          subtotal: subtotal,
                          discountAmount: totalDiscountAmount,
                          taxAmount: tax,
                          isTaxExempt: isTaxExempt,
                          total: total
                        },
                        payment: {
                          method: paymentMethod,
                          bankAccount: paymentMethod === 'bank' ? selectedBankAccount : null,
                          amountPaid: amountPaid,
                          remainingBalance: total - amountPaid,
                          isPartialPayment: amountPaid < total,
                          isAdvancePayment: isAdvancePayment,
                          advanceAmount: isAdvancePayment ? (amountPaid - total) : 0
                        },
                        createdAt: new Date(),
                        createdBy: user ? {
                          firstName: user.firstName,
                          lastName: user.lastName,
                          name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin'
                        } : { name: 'Admin' },
                        invoiceNumber: invoiceNumber
                      };
                      setCurrentOrder(tempOrder);
                      setShowPrintModal(true);
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Preview
                  </button>
                )}
                <LoadingButton
                  onClick={handleCheckout}
                  isLoading={isSubmitting || isCreatingSale || isUpdatingOrder}
                  disabled={isSubmitting || isCreatingSale || isUpdatingOrder}
                  className="btn btn-primary btn-lg flex-2"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  {editData?.isEditMode
                    ? (amountPaid === 0 ? 'Update Invoice' : 'Update Sale')
                    : (amountPaid === 0 ? 'Create Invoice' : 'Complete Sale')
                  }
                </LoadingButton>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations Section */}
        {cart.length > 0 && (
          <div className="mt-4 max-w-5xl ml-auto">
            <RecommendationSection
              title="Customers Also Bought"
              algorithm="frequently_bought"
              context={{
                page: 'sales',
                currentProducts: cart.map(item => item.product._id),
                customerTier: selectedCustomer?.customerTier,
                businessType: selectedCustomer?.businessType,
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

      {/* Print Modal */}
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

      {/* Export Format Selection Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Export Sales Report</h2>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportDateFrom(defaultDateRange.from);
                  setExportDateTo(defaultDateRange.to);
                }}
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

                {/* Date Range Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Date Range (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">From Date</label>
                      <input
                        type="date"
                        value={exportDateFrom}
                        onChange={(e) => setExportDateFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">To Date</label>
                      <input
                        type="date"
                        value={exportDateTo}
                        onChange={(e) => setExportDateTo(e.target.value)}
                        min={exportDateFrom}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                  {(exportDateFrom || exportDateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setExportDateFrom(defaultDateRange.from);
                        setExportDateTo(defaultDateRange.to);
                      }}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                    >
                      Reset to default
                    </button>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportModal(false);
                      setExportDateFrom(defaultDateRange.from);
                      setExportDateTo(defaultDateRange.to);
                    }}
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
                        <LoadingSpinner className="h-4 w-4 mr-2" />
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
    </AsyncErrorBoundary>
  );
};
