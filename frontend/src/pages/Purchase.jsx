import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package,
  Search,
  Plus,
  Minus,
  Trash2,
  Building,
  Truck,
  Calculator,
  Save,
  Receipt,
  User,
  Phone,
  Mail,
  MapPin,
  ArrowUpDown,
  Download,
  XCircle
} from 'lucide-react';
import { useGetProductsQuery } from '../store/services/productsApi';
import { useGetVariantsQuery } from '../store/services/productVariantsApi';
import {
  useGetSupplierQuery,
  useLazySearchSuppliersQuery,
} from '../store/services/suppliersApi';
import {
  useCreatePurchaseInvoiceMutation,
  useUpdatePurchaseInvoiceMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} from '../store/services/purchaseInvoicesApi';
import { useGetBanksQuery } from '../store/services/banksApi';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { SearchableDropdown } from '../components/SearchableDropdown';
import toast from 'react-hot-toast';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import PrintModal from '../components/PrintModal';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../components/ComponentRegistry';

const PurchaseItem = ({ item, index, onUpdateQuantity, onUpdateCost, onRemove }) => {
  const totalPrice = item.costPerUnit * item.quantity;
  const product = item.product || {};
  const inventory = product.inventory || {};
  const currentStock = inventory.currentStock || 0;
  const reorderPoint = inventory.reorderPoint || inventory.minStock || 0;
  const isLowStock = currentStock <= reorderPoint;

  // Get display name for variants
  const displayName = product.isVariant
    ? (product.displayName || product.variantName || product.name || 'Unknown Variant')
    : (product.name || 'Unknown Product');

  return (
    <div className={`py-2 sm:py-1 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3 p-3 border border-gray-200 rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{index + 1}</span>
              {isLowStock && <span className="text-yellow-600 text-xs">⚠️ Low Stock</span>}
            </div>
            <p className="font-medium text-sm truncate">{displayName}</p>
            {product.isVariant && (
              <p className="text-xs text-gray-500 mt-0.5">
                {product.variantType}: {product.variantValue}
              </p>
            )}
          </div>
          <button
            onClick={() => onRemove(item.product?._id)}
            className="btn btn-danger btn-sm p-1 flex-shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stock</label>
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center">
              {currentStock}
            </span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Total</label>
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center">
              {totalPrice.toFixed(2)}
            </span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => onUpdateQuantity(item.product?._id, parseInt(e.target.value) || 1)}
              className="input text-center text-sm h-8"
              min="1"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cost</label>
            <input
              type="number"
              step="0.01"
              value={item.costPerUnit}
              onChange={(e) => onUpdateCost(item.product?._id, parseFloat(e.target.value) || 0)}
              className="input text-center text-sm h-8"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:grid grid-cols-12 gap-3 sm:gap-4 items-center">
        {/* Serial Number - 1 column */}
        <div className="col-span-1">
          <span className="text-xs sm:text-sm font-medium text-gray-700 bg-gray-50 px-0.5 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
            {index + 1}
          </span>
        </div>

        {/* Product Name - 6 columns */}
        <div className="col-span-6 flex items-center h-8 min-w-0">
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-medium text-xs sm:text-sm truncate">
              {displayName}
              {isLowStock && <span className="text-yellow-600 text-xs ml-2">⚠️ Low Stock</span>}
            </span>
            {product.isVariant && (
              <span className="text-xs text-gray-500 truncate">
                {product.variantType}: {product.variantValue}
              </span>
            )}
          </div>
        </div>

        {/* Stock - 1 column */}
        <div className="col-span-1">
          <span className="text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
            {currentStock}
          </span>
        </div>

        {/* Quantity - 1 column */}
        <div className="col-span-1">
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => onUpdateQuantity(item.product?._id, parseInt(e.target.value) || 1)}
            className="input text-center text-xs sm:text-sm h-8"
            min="1"
          />
        </div>

        {/* Cost - 1 column */}
        <div className="col-span-1">
          <input
            type="number"
            step="0.01"
            value={item.costPerUnit}
            onChange={(e) => onUpdateCost(item.product?._id, parseFloat(e.target.value) || 0)}
            className="input text-center text-xs sm:text-sm h-8"
            min="0"
          />
        </div>

        {/* Total - 1 column */}
        <div className="col-span-1">
          <span className="text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
            {totalPrice.toFixed(2)}
          </span>
        </div>

        {/* Delete Button - 1 column */}
        <div className="col-span-1">
          <button
            onClick={() => onRemove(item.product?._id)}
            className="btn btn-danger btn-sm h-8 w-full"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// NOTE: SupplierSearch component removed - functionality moved to main Purchase component
// This was using react-query instead of RTK Query, causing conflicts

const ProductSearch = ({ onAddProduct, onRefetchReady }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [costPerUnit, setCostPerUnit] = useState('0');

  // Ref for the product search input to focus after adding to cart
  const productSearchRef = useRef(null);

  // Focus on product search field only after adding to cart
  // Removed auto-focus on mount to let supplier selection be focused first

  // Fetch all active products for client-side fuzzy search
  const { data: productsData, isLoading, error, refetch: refetchProducts } = useGetProductsQuery(
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

  const filteredProducts = useFuzzySearch(
    allItems,
    searchTerm,
    ['name', 'description', 'brand', 'barcode', 'sku', 'displayName', 'variantValue', 'variantName'],
    {
      threshold: 0.4,
      minScore: 0.3,
      limit: null // Show unlimited products
    }
  );

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    // Use variant pricing if it's a variant
    const cost = product.pricing?.cost || 0;
    setCostPerUnit(cost.toString());
    // Keep the product/variant name visible in the search field until it's added to cart
    const displayName = product.isVariant
      ? (product.displayName || product.variantName || product.name)
      : product.name;
    setSearchTerm(displayName);
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    // Validate that cost is filled
    if (!costPerUnit || parseFloat(costPerUnit) <= 0) {
      toast.error('Please enter a valid cost per unit');
      return;
    }

    onAddProduct({
      product: selectedProduct,
      quantity: quantity,
      costPerUnit: parseFloat(costPerUnit)
    });

    // Reset form
    setSelectedProduct(null);
    setQuantity(1);
    setCostPerUnit('0');
    setSearchTerm('');

    // Focus back to product search field for next product selection
    setTimeout(() => {
      if (productSearchRef.current) {
        productSearchRef.current.focus();
      }
    }, 100);
  };

  const productDisplayKey = (product) => {
    const inventory = product.inventory || {};
    const pricing = product.pricing || {};

    // Get display name - use variant display name if it's a variant
    const displayName = product.isVariant
      ? (product.displayName || product.variantName || product.name)
      : product.name;

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
          <div className={`text-sm ${inventory.currentStock === 0 ? 'text-red-600' : inventory.currentStock <= (inventory.reorderPoint || inventory.minStock || 0) ? 'text-orange-600' : 'text-gray-600'}`}>
            Stock: {inventory.currentStock || 0}
          </div>
          <div className="text-sm text-gray-600">Cost: {Math.round(pricing.cost || 0)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Product Selection - Same format as Sales */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-end">
        {/* Product Search - 7 columns (increased from 6) */}
        <div className="col-span-1 sm:col-span-7">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Product Search
          </label>
          <SearchableDropdown
            ref={productSearchRef}
            placeholder="Search or select product..."
            items={filteredProducts || []}
            onSelect={handleProductSelect}
            onSearch={(term) => {
              setSearchTerm(term);
              // Clear selected product if user starts typing a new search (different from selected product name)
              if (selectedProduct && term !== selectedProduct.name) {
                setSelectedProduct(null);
                setCostPerUnit('0');
              }
            }}
            displayKey={productDisplayKey}
            selectedItem={selectedProduct}
            loading={isLoading}
            emptyMessage={searchTerm.length > 0 ? "No products found" : "Start typing to search products..."}
            value={selectedProduct ? selectedProduct.name : searchTerm}
            showSelected={true}
          />
        </div>

        {/* Stock - 1 column */}
        <div className="col-span-1 sm:col-span-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Stock
          </label>
          <span className="text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
            {selectedProduct ? (selectedProduct.inventory?.currentStock || 0) : '0'}
          </span>
        </div>

        {/* Quantity - 1 column */}
        <div className="col-span-1 sm:col-span-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Quantity
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && selectedProduct) {
                e.preventDefault();
                handleAddToCart();
              }
            }}
            className="input text-center text-sm sm:text-base"
            placeholder="1 (Enter to add & focus search)"
          />
        </div>

        {/* Cost - 1 column (reduced from 2) */}
        <div className="col-span-1 sm:col-span-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Cost
          </label>
          <input
            type="number"
            step="1"
            value={costPerUnit}
            onChange={(e) => setCostPerUnit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && selectedProduct) {
                e.preventDefault();
                handleAddToCart();
              }
            }}
            className="input text-center text-sm sm:text-base"
            placeholder="0 (Enter to add & focus search)"
            required
          />
        </div>

        {/* Amount - 1 column */}
        <div className="col-span-1 sm:col-span-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            Amount
          </label>
          <input
            type="text"
            value={selectedProduct ? Math.round(quantity * parseFloat(costPerUnit || 0)) : ''}
            className="input text-center font-medium text-sm sm:text-base"
            disabled
            placeholder=""
          />
        </div>

        {/* Add Button - 1 column */}
        <div className="col-span-1 sm:col-span-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            &nbsp;
          </label>
          <button
            type="button"
            onClick={handleAddToCart}
            className="w-full btn btn-primary btn-md flex items-center justify-center gap-2"
            disabled={!selectedProduct}
            title="Add to cart (or press Enter in Quantity/Cost fields - focus returns to search)"
          >
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const Purchase = ({ tabId, editData }) => {
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(true);
  const [expectedDelivery, setExpectedDelivery] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]); // Default to current date for backdating/postdating
  const [notes, setNotes] = useState('');
  const [taxExempt, setTaxExempt] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Ref for supplier selection field to focus on page load
  const supplierSearchRef = useRef(null);

  // Payment and discount state variables (matching Sales component)
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState(0);
  const [directDiscount, setDirectDiscount] = useState({ type: 'amount', value: 0 });

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

  // Export modal state
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

  const { updateTabTitle, getActiveTab, openTab } = useTab();

  // Store refetch function from ProductSearch component
  const [refetchProducts, setRefetchProducts] = useState(null);

  // RTK Query hooks
  const [searchSuppliers, { data: suppliersSearchResult, isLoading: suppliersLoading, refetch: refetchSuppliers }] = useLazySearchSuppliersQuery();
  const { data: banksData } = useGetBanksQuery();
  const [createPurchaseInvoice] = useCreatePurchaseInvoiceMutation();
  const [updatePurchaseInvoice] = useUpdatePurchaseInvoiceMutation();
  const [exportExcel] = useExportExcelMutation();
  const [exportCSV] = useExportCSVMutation();
  const [exportPDF] = useExportPDFMutation();
  const [exportJSON] = useExportJSONMutation();
  const [downloadFile] = useDownloadFileMutation();

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Focus on supplier selection field when component mounts
  useEffect(() => {
    if (supplierSearchRef.current) {
      supplierSearchRef.current.focus();
    }
  }, []);

  // Handle edit data when component is opened for editing
  useEffect(() => {
    if (editData && editData.isEditMode && editData.invoiceId) {
      // Set the supplier (will be updated with complete data if available)
      if (editData.supplier) {
        setSelectedSupplier(editData.supplier);
      }

      // Set the invoice number
      if (editData.invoiceNumber) {
        setInvoiceNumber(editData.invoiceNumber);
        setAutoGenerateInvoice(false); // Don't auto-generate when editing
      }

      // Set the notes
      if (editData.notes) {
        setNotes(editData.notes);
      }

      // Set invoice date if available (for backdating/postdating)
      if (editData.invoiceDate) {
        const formatDateForInput = (date) => {
          if (!date) return '';
          const d = new Date(date);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        setInvoiceDate(formatDateForInput(editData.invoiceDate));
      } else if (editData.createdAt) {
        // Use createdAt as default if invoiceDate not set
        const formatDateForInput = (date) => {
          if (!date) return '';
          const d = new Date(date);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        setInvoiceDate(formatDateForInput(editData.createdAt));
      }

      // Set the purchase items
      if (editData.items && editData.items.length > 0) {
        const formattedItems = editData.items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          costPerUnit: item.unitCost || item.costPerUnit,
          totalCost: item.totalCost || (item.quantity * (item.unitCost || item.costPerUnit))
        }));
        setPurchaseItems(formattedItems);
      }

      // Data loaded successfully (no toast needed as PurchaseInvoices already shows opening message)
    }
  }, [editData?.invoiceId]); // Only depend on invoiceId to prevent multiple executions

  // Fetch complete supplier data when supplier is selected (for immediate balance updates)
  const { data: completeSupplierData, refetch: refetchSupplier } = useGetSupplierQuery(
    selectedSupplier?._id,
    {
      skip: !selectedSupplier?._id,
      staleTime: 0, // Always consider data stale to get fresh balance information
      refetchOnMountOrArgChange: true, // Refetch when component mounts or params change
    }
  );

  // Update supplier with complete data when fetched
  useEffect(() => {
    if (completeSupplierData?.data) {
      setSelectedSupplier(completeSupplierData.data);
    }
  }, [completeSupplierData]);

  // Trigger search when supplier search term changes
  useEffect(() => {
    if (supplierSearchTerm.length > 0) {
      searchSuppliers(supplierSearchTerm);
    }
  }, [supplierSearchTerm, searchSuppliers]);

  // Extract suppliers from search result
  const suppliers = React.useMemo(() => {
    if (!suppliersSearchResult) return { data: { suppliers: [] } };
    return suppliersSearchResult;
  }, [suppliersSearchResult]);

  // Update selected supplier when suppliers data changes (e.g., after cash/bank payment updates balance)
  useEffect(() => {
    if (selectedSupplier && suppliers?.data?.suppliers) {
      const updatedSupplier = suppliers.data.suppliers.find(
        s => s._id === selectedSupplier._id
      );
      if (updatedSupplier && (
        updatedSupplier.pendingBalance !== selectedSupplier.pendingBalance ||
        updatedSupplier.advanceBalance !== selectedSupplier.advanceBalance ||
        updatedSupplier.currentBalance !== selectedSupplier.currentBalance
      )) {
        setSelectedSupplier(updatedSupplier);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: selectedSupplier is intentionally excluded from deps to prevent infinite loops.
    // We only want to sync when the suppliers list updates, not when selectedSupplier changes.
  }, [suppliers?.data?.suppliers]);


  // Generate invoice number
  const generateInvoiceNumber = (supplier) => {
    if (!supplier) return '';

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getTime()).slice(-6); // Last 6 digits of timestamp for better uniqueness
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // Add random component

    // Format: SUPPLIER-INITIALS-YYYYMMDD-XXXXXX-XXX
    // Use supplier name or companyName, fallback to 'SUP' if both are empty
    const supplierName = supplier.companyName || supplier.name || 'SUP';
    const supplierInitials = supplierName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3);

    const invoiceNum = `PO-${supplierInitials}-${year}${month}${day}-${time}-${random}`;
    return invoiceNum;
  };

  const supplierDisplayKey = (supplier) => {
    return (
      <div>
        <div className="font-medium">{supplier.displayName || supplier.companyName || supplier.name || 'Unknown'}</div>
        <div className="text-sm text-gray-600">
          Outstanding Balance: {(supplier.pendingBalance || 0).toFixed(2)}
        </div>
      </div>
    );
  };

  const handleSupplierSelect = (supplier) => {
    // SearchableDropdown passes the full supplier object
    setSelectedSupplier(supplier);

    // Auto-generate invoice number if enabled
    if (autoGenerateInvoice && supplier) {
      setInvoiceNumber(generateInvoiceNumber(supplier));
    }

    // Update tab title to show supplier name
    const activeTab = getActiveTab();
    if (activeTab && supplier) {
      updateTabTitle(activeTab.id, `Purchase - ${supplier.displayName || supplier.companyName || supplier.name || 'Unknown'}`);
    }

    // Clear cart when supplier changes (only in new purchase mode, not in edit mode)
    if (purchaseItems.length > 0 && !editData?.isEditMode) {
      setPurchaseItems([]);
      toast.success('Purchase items cleared due to supplier change. Please re-add products.');
    }
  };

  // Handler functions for purchase invoice mutations
  const handleCreatePurchaseInvoice = async (invoiceData) => {
    try {
      const result = await createPurchaseInvoice(invoiceData).unwrap();

      // Handle different response structures
      const invoiceNumber = result?.invoice?.invoiceNumber || result?.data?.invoice?.invoiceNumber || 'Unknown';
      const inventoryUpdates = result?.inventoryUpdates || result?.data?.inventoryUpdates || [];
      const successCount = inventoryUpdates.filter(update => update.success).length;

      toast.success(`Purchase invoice created successfully! Invoice ${invoiceNumber} created and ${successCount} products added to inventory.`);

      // Immediately refetch products to update stock and prices
      if (refetchProducts && typeof refetchProducts === 'function') {
        try {
          refetchProducts();
        } catch (error) {
          // Failed to refetch products - silent fail
        }
      }

      // Immediately refetch supplier to update outstanding balance (BEFORE clearing supplier)
      if (refetchSupplier && typeof refetchSupplier === 'function') {
        try {
          refetchSupplier().then((result) => {
            // Update supplier state immediately with fresh data
            if (result?.data?.data) {
              setSelectedSupplier(result.data.data);
            }
          }).catch((error) => {
            // Failed to refetch supplier - silent fail
          });
        } catch (error) {
          // Failed to call refetchSupplier - silent fail
        }
      }

      // Also trigger supplier search to update suppliers list (for the useEffect that syncs balances)
      if (selectedSupplier && searchSuppliers) {
        const searchTerm = selectedSupplier.companyName || selectedSupplier.name || '';
        if (searchTerm) {
          searchSuppliers(searchTerm);
        }
      }

      setPurchaseItems([]);
      // Don't clear selectedSupplier immediately - let it update from refetched data
      // setSelectedSupplier(null);
      setAmountPaid(0);
      setPaymentMethod('cash');
      setInvoiceNumber('');
      setExpectedDelivery(new Date().toISOString().split('T')[0]);
      setInvoiceDate(new Date().toISOString().split('T')[0]); // Reset to current date
      setNotes('');

      // Reset tab title to default
      const activeTab = getActiveTab();
      if (activeTab) {
        updateTabTitle(activeTab.id, 'Purchase');
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to complete purchase');
    }
  };

  const handleUpdatePurchaseInvoice = async (invoiceId, invoiceData) => {
    try {
      const result = await updatePurchaseInvoice({ id: invoiceId, ...invoiceData }).unwrap();

      // Handle different response structures
      const invoiceNumber = result?.invoice?.invoiceNumber || result?.data?.invoice?.invoiceNumber || 'Unknown';
      const inventoryUpdates = result?.inventoryUpdates || result?.data?.inventoryUpdates || [];
      const successCount = inventoryUpdates.filter(update => update.success).length;

      toast.success(`Purchase invoice updated successfully! Invoice ${invoiceNumber} updated and ${successCount} products adjusted in inventory.`);

      // Immediately refetch products to update stock and prices
      if (refetchProducts && typeof refetchProducts === 'function') {
        try {
          refetchProducts();
        } catch (error) {
          // Failed to refetch products - silent fail
        }
      }

      // Immediately refetch supplier to update outstanding balance
      // Only refetch if supplier is selected (query is not skipped)
      if (selectedSupplier?._id && refetchSupplier && typeof refetchSupplier === 'function') {
        try {
          refetchSupplier().then((result) => {
            // Update supplier state immediately with fresh data
            if (result?.data?.data) {
              setSelectedSupplier(result.data.data);
            }
          }).catch((error) => {
            // Ignore "Cannot refetch a query that has not been started yet" errors
            if (!error?.message?.includes('has not been started')) {
              // Failed to refetch supplier - silent fail
            }
          });
        } catch (error) {
          // Ignore "Cannot refetch a query that has not been started yet" errors
          if (!error?.message?.includes('has not been started')) {
            // Failed to call refetchSupplier - silent fail
          }
        }
      }

      // Also trigger supplier search to update suppliers list (for the useEffect that syncs balances)
      if (selectedSupplier && searchSuppliers) {
        try {
          const searchTerm = selectedSupplier.companyName || selectedSupplier.name || '';
          if (searchTerm) {
            searchSuppliers(searchTerm);
          }
        } catch (error) {
          // Failed to search suppliers - silent fail
        }
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to update purchase');
    }
  };

  // Calculate tax based on supplier and business rules
  const calculateTax = () => {
    // If tax exempt is enabled, return 0
    if (taxExempt) return 0;

    if (!selectedSupplier) return 0;

    const subtotal = purchaseItems.reduce((sum, item) => sum + (item.costPerUnit * item.quantity), 0);

    // Tax rules based on supplier type and business type
    let taxRate = 0;

    // Different tax rates for different supplier types
    switch (selectedSupplier.businessType) {
      case 'manufacturer':
        taxRate = 0.06; // 6% for manufacturers
        break;
      case 'distributor':
        taxRate = 0.07; // 7% for distributors
        break;
      case 'wholesaler':
        taxRate = 0.08; // 8% for wholesalers
        break;
      case 'dropshipper':
        taxRate = 0.05; // 5% for dropshippers
        break;
      default:
        taxRate = 0.08; // Default 8%
    }

    // Check if supplier has tax-exempt status (could be added to supplier model)
    // For now, we'll use a simple rule based on supplier rating
    if (selectedSupplier.rating >= 5 && selectedSupplier.reliability === 'excellent') {
      taxRate *= 0.5; // 50% tax reduction for excellent suppliers
    }

    return subtotal * taxRate;
  };

  const subtotal = purchaseItems.reduce((sum, item) => sum + (item.costPerUnit * item.quantity), 0);
  const tax = calculateTax();

  // Calculate discount amount
  const directDiscountAmount = directDiscount.type === 'percentage'
    ? (subtotal * directDiscount.value / 100)
    : directDiscount.value;

  const total = subtotal + tax - directDiscountAmount;
  const supplierOutstanding = selectedSupplier?.pendingBalance || 0;
  const totalPayables = total + supplierOutstanding;

  const addToPurchase = (newItem) => {
    setPurchaseItems(prevItems => {
      const existingItem = prevItems.find(item => item.product?._id === newItem.product?._id);
      if (existingItem) {
        // Get display name for confirmation message
        const product = newItem.product || {};
        const displayName = product.isVariant
          ? (product.displayName || product.variantName || product.name || 'Unknown Variant')
          : (product.name || 'Unknown Product');

        // Show confirmation dialog for existing product
        const confirmAdd = window.confirm(
          `"${displayName}" is already in the cart (Qty: ${existingItem.quantity}).\n\nDo you want to add ${newItem.quantity} more units?`
        );

        if (!confirmAdd) {
          // User chose not to add, return current cart unchanged
          return prevItems;
        }

        // User confirmed, update existing item quantity and cost
        return prevItems.map(item =>
          item.product?._id === newItem.product?._id
            ? { ...item, quantity: item.quantity + newItem.quantity, costPerUnit: newItem.costPerUnit }
            : item
        );
      }
      return [...prevItems, newItem];
    });
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromPurchase(productId);
      return;
    }
    setPurchaseItems(prevItems =>
      prevItems.map(item =>
        item.product?._id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const updateCost = (productId, newCost) => {
    setPurchaseItems(prevItems =>
      prevItems.map(item =>
        item.product?._id === productId
          ? { ...item, costPerUnit: newCost }
          : item
      )
    );
  };

  const removeFromPurchase = (productId) => {
    setPurchaseItems(prevItems => prevItems.filter(item => item.product?._id !== productId));
  };

  const handleSortPurchaseItems = () => {
    setPurchaseItems(prevItems => {
      if (!prevItems || prevItems.length < 2) {
        return prevItems;
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

      const sortedItems = [...prevItems].sort((a, b) => {
        const nameA = getProductName(a).toString().toLowerCase();
        const nameB = getProductName(b).toString().toLowerCase();

        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      return sortedItems;
    });
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const handleExportConfirm = async () => {
    setIsExporting(true);
    try {
      // Build filters based on current view (if any filters exist)
      const filters = {
        // Include supplier filter if a supplier is selected
        ...(selectedSupplier?._id && { supplier: selectedSupplier._id }),
        // Include date range if selected
        ...(exportDateFrom && { dateFrom: exportDateFrom }),
        ...(exportDateTo && { dateTo: exportDateTo }),
      };

      let response;
      if (exportFormat === 'excel') {
        response = await exportExcel(filters).unwrap();
      } else if (exportFormat === 'csv') {
        response = await exportCSV(filters).unwrap();
      } else if (exportFormat === 'json') {
        response = await exportJSON(filters).unwrap();
      } else if (exportFormat === 'pdf') {
        response = await exportPDF(filters).unwrap();
      }

      if (response?.filename || response?.data?.filename) {
        const filename = response.filename || response.data.filename;

        try {
          // Add a small delay to ensure file is written (PDF generation is async)
          if (exportFormat === 'pdf') {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Download the file
          let downloadResponse;
          try {
            downloadResponse = await downloadFile(filename).unwrap();
          } catch (downloadErr) {
            const errorData = downloadErr?.data || downloadErr?.response?.data;
            if (errorData instanceof Blob) {
              const reader = new FileReader();
              reader.onload = () => {
                const text = reader.result;
                try {
                  const parsedError = JSON.parse(text);
                  toast.error(parsedError.message || 'Download failed');
                } catch {
                  toast.error('Download failed');
                }
              };
              reader.readAsText(errorData);
            } else if (typeof errorData === 'object' && errorData !== null) {
              toast.error(errorData.message || 'Download failed');
            } else {
              toast.error(downloadErr?.message || 'Download failed');
            }
            return;
          }

          if (!downloadResponse) {
            toast.error('Download failed: No data received from server');
            return;
          }

          // RTK Query returns the blob directly for blob responses
          const blob = downloadResponse instanceof Blob ? downloadResponse : downloadResponse.data;

          if (exportFormat === 'pdf') {

            if (!blob || !(blob instanceof Blob)) {
              toast.error('Invalid PDF file received');
              return;
            }

            if (blob.size === 0) {
              toast.error('PDF file is empty');
              return;
            }

            // Check if blob is actually an error JSON
            if (blob.type && (blob.type.includes('application/json') || blob.type.includes('text/html'))) {
              const reader = new FileReader();
              reader.onload = () => {
                const text = reader.result;
                try {
                  const errorData = JSON.parse(text);
                  toast.error(errorData.message || 'File not found or generation failed');
                } catch {
                  toast.error('Server returned error instead of PDF. Please try again.');
                }
              };
              reader.readAsText(blob);
              return;
            }

            const url = URL.createObjectURL(blob);
            const newWindow = window.open(url, '_blank');

            if (!newWindow) {
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success('PDF downloaded (popup was blocked)');
            } else {
              toast.success('PDF opened in new tab');
            }
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          } else {
            // For Excel, CSV, JSON - download directly
            const blob = downloadResponse instanceof Blob ? downloadResponse : downloadResponse.data;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
            toast.success(`${exportFormat.toUpperCase()} file downloaded successfully`);
          }

          setShowExportModal(false);
        } catch (downloadError) {
          toast.error('Failed to download file');
        }
      } else {
        toast.error('Export failed: No filename received');
      }
    } catch (error) {
      toast.error('Failed to export purchase data: ' + (error?.data?.message || error?.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleProcessPurchase = useCallback(() => {
    if (purchaseItems.length === 0) {
      toast.error('No items to purchase');
      return;
    }

    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }

    // Ensure invoice number is set (auto-generate if empty and auto-generate is enabled)
    // If auto-generate is enabled, let backend generate invoice number based on invoiceDate
    // Otherwise, use the manually entered invoice number
    let finalInvoiceNumber = autoGenerateInvoice ? undefined : invoiceNumber;

    // If manual invoice number is empty and auto-generate is disabled, generate one as fallback
    if (!autoGenerateInvoice && (!finalInvoiceNumber || finalInvoiceNumber.trim() === '')) {
      finalInvoiceNumber = generateInvoiceNumber(selectedSupplier);
      setInvoiceNumber(finalInvoiceNumber);
    }

    // Create purchase invoice data
    const invoiceData = {
      supplier: selectedSupplier._id,
      supplierInfo: {
        name: selectedSupplier.name,
        email: selectedSupplier.email,
        phone: selectedSupplier.phone,
        companyName: selectedSupplier.companyName,
        address: selectedSupplier.address
      },
      items: purchaseItems.map(item => ({
        product: item.product?._id,
        quantity: item.quantity,
        unitCost: item.costPerUnit,
        totalCost: item.quantity * item.costPerUnit
      })),
      pricing: {
        subtotal: subtotal,
        discountAmount: 0,
        taxAmount: tax,
        isTaxExempt: taxExempt,
        total: total
      },
      payment: {
        method: paymentMethod,
        amount: amountPaid,
        remainingBalance: Math.max(0, total - amountPaid),
        isPartialPayment: amountPaid > 0 && amountPaid < total,
        status: amountPaid >= total ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending')
      },
      ...(finalInvoiceNumber ? { invoiceNumber: finalInvoiceNumber } : {}), // Only include if provided - backend will auto-generate based on invoiceDate
      expectedDelivery: expectedDelivery,
      invoiceDate: invoiceDate || undefined, // Include invoiceDate for backdating/postdating (invoice number will be based on this)
      notes: notes,
      terms: ''
    };

    // Use appropriate mutation based on edit mode
    if (editData?.isEditMode) {
      handleUpdatePurchaseInvoice(editData.invoiceId, invoiceData);
    } else {
      handleCreatePurchaseInvoice(invoiceData);
    }
  }, [purchaseItems, selectedSupplier, invoiceNumber, autoGenerateInvoice, expectedDelivery, notes, taxExempt, subtotal, tax, total, directDiscountAmount, paymentMethod, amountPaid, editData, handleCreatePurchaseInvoice, handleUpdatePurchaseInvoice]);


  return (
    <>
      <div className="space-y-4 lg:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Purchase</h1>
            <p className="text-sm sm:text-base text-gray-600">Process purchase transactions</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2 w-full sm:w-auto">
            <button
              onClick={handleExport}
              className="btn btn-secondary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
              title="Export Purchase Report"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Purchase Report</span>
              <span className="sm:hidden">Export</span>
            </button>
            <button
              onClick={() => {
                const componentInfo = getComponentInfo('/purchase');
                if (componentInfo) {
                  const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  openTab({
                    title: 'Purchase',
                    path: '/purchase',
                    component: componentInfo.component,
                    icon: componentInfo.icon,
                    allowMultiple: true,
                    props: { tabId: newTabId }
                  });
                }
              }}
              className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              <span>New Purchase</span>
            </button>
          </div>
        </div>

        {/* Supplier Selection and Information Row */}
        <div className="flex flex-col lg:flex-row items-start gap-4 lg:space-x-4">
          {/* Supplier Selection */}
          <div className="w-full lg:w-[500px] lg:flex-shrink-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700">
                Select Supplier
              </label>
              <div className="flex items-center space-x-2">
                {selectedSupplier && (
                  <button
                    onClick={() => {
                      setSelectedSupplier(null);
                      setSupplierSearchTerm('');
                      // Focus on the supplier search field after clearing
                      setTimeout(() => {
                        if (supplierSearchRef.current) {
                          supplierSearchRef.current.focus();
                        }
                      }, 100);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                    title="Change supplier"
                  >
                    Change Supplier
                  </button>
                )}
                <button
                  onClick={() => refetchSuppliers()}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                  title="Refresh supplier data"
                >
                  Refresh
                </button>
              </div>
            </div>
            <SearchableDropdown
              ref={supplierSearchRef}
              placeholder="Search suppliers by name, email, or business..."
              items={suppliers?.data?.suppliers || suppliers?.suppliers || []}
              onSelect={handleSupplierSelect}
              onSearch={setSupplierSearchTerm}
              displayKey={supplierDisplayKey}
              selectedItem={selectedSupplier}
              loading={suppliersLoading}
              emptyMessage={supplierSearchTerm.length > 0 ? "No suppliers found" : "Start typing to search suppliers..."}
            />
          </div>

          {/* Supplier Information - Right Side */}
          <div className="w-full lg:flex-1">
            {selectedSupplier ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-start sm:items-center space-x-3">
                  <Building className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0 mt-1 sm:mt-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">{selectedSupplier.displayName || selectedSupplier.name || selectedSupplier.companyName || 'Unknown Supplier'}</p>
                    <p className="text-xs sm:text-sm text-gray-600 capitalize mt-1">
                      {selectedSupplier.businessType && selectedSupplier.reliability
                        ? `${selectedSupplier.businessType} • ${selectedSupplier.reliability}`
                        : selectedSupplier.businessType || selectedSupplier.reliability || 'Supplier Information'
                      }
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-4 mt-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">Outstanding Balance:</span>
                        <span className={`text-xs sm:text-sm font-medium ${(selectedSupplier.pendingBalance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {Math.round(selectedSupplier.pendingBalance || 0)}
                        </span>
                      </div>
                      {selectedSupplier.phone && (
                        <div className="flex items-center space-x-1">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500 truncate">{selectedSupplier.phone}</span>
                        </div>
                      )}
                      {selectedSupplier.email && (
                        <div className="flex items-center space-x-1 min-w-0">
                          <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-500 truncate">{selectedSupplier.email}</span>
                        </div>
                      )}
                    </div>
                    {selectedSupplier.address && (
                      <div className="flex items-start space-x-1 mt-1">
                        <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-gray-500 break-words">{selectedSupplier.address}</span>
                      </div>
                    )}
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
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Product Selection & Cart</h3>
          </div>
          <div className="card-content">
            {/* Product Search */}
            <div className="mb-4 sm:mb-6">
              <ProductSearch onAddProduct={addToPurchase} onRefetchReady={setRefetchProducts} />
            </div>

            {/* Cart Items */}
            {purchaseItems.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-gray-500 border-t border-gray-200">
                <Package className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
                <p className="mt-2 text-sm sm:text-base">No items in cart</p>
              </div>
            ) : (
              <div className="space-y-4 border-t border-gray-200 pt-4 sm:pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                  <h4 className="text-sm sm:text-md font-medium text-gray-700">Cart Items</h4>
                  <button
                    type="button"
                    onClick={handleSortPurchaseItems}
                    className="btn btn-secondary btn-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                    title="Sort products alphabetically"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    <span>Sort A-Z</span>
                  </button>
                </div>
                {purchaseItems.map((item, index) => (
                  <PurchaseItem
                    key={item.product?._id}
                    item={item}
                    index={index}
                    onUpdateQuantity={updateQuantity}
                    onUpdateCost={updateCost}
                    onRemove={removeFromPurchase}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Combined Purchase Details and Order Summary */}
        {purchaseItems.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg w-full lg:max-w-5xl lg:ml-auto mt-4">
            {/* Purchase Details Section */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-blue-200">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 text-left sm:text-right mb-3 sm:mb-4">Purchase Details</h3>
              {/* Single Row Layout for Purchase Details */}
              <div className="flex flex-col sm:flex-row sm:flex-nowrap gap-3 sm:items-end sm:justify-end">
                {/* Invoice Number */}
                <div className="flex flex-col w-full sm:w-44">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="input h-8 sm:h-8 text-sm"
                    placeholder={autoGenerateInvoice ? "Auto-generated" : "Enter invoice number"}
                    disabled={autoGenerateInvoice}
                  />
                </div>

                {/* Expected Delivery */}
                <div className="flex flex-col w-full sm:w-48">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Expected Delivery
                  </label>
                  <input
                    type="date"
                    value={expectedDelivery}
                    onChange={(e) => setExpectedDelivery(e.target.value)}
                    className="input h-8 sm:h-8 text-sm"
                  />
                </div>

                {/* Invoice Date (for backdating/postdating) */}
                <div className="flex flex-col w-full sm:w-48">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Invoice Date <span className="text-xs text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="input h-8 sm:h-8 text-sm"
                    max={new Date().toISOString().split('T')[0]} // Prevent future dates
                    placeholder="Leave empty to use current date"
                  />
                  {invoiceDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Invoice number will be generated based on this date
                    </p>
                  )}
                  {!invoiceDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Set custom date for backdating
                    </p>
                  )}
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
                      checked={taxExempt}
                      onChange={(e) => setTaxExempt(e.target.checked)}
                      className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <label htmlFor="taxExempt" className="text-xs font-medium text-gray-700 cursor-pointer">
                        Tax Exempt
                      </label>
                    </div>
                    {taxExempt && (
                      <div className="text-green-600 text-xs font-medium">
                        ✓
                      </div>
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
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input h-8 sm:h-8 text-sm"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            </div>

            {/* Order Summary Section */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 sm:px-6 py-3 sm:py-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">Order Summary</h3>
            </div>

            {/* Order Summary Details */}
            <div className="px-4 sm:px-6 py-3 sm:py-4">
              <div className="space-y-3 mb-4 sm:mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm sm:text-base text-gray-800 font-semibold">Subtotal:</span>
                  <span className="text-lg sm:text-xl font-bold text-gray-900">{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm sm:text-base text-gray-800 font-semibold">
                    {taxExempt ? 'Tax (Exempt):' : 'Tax (8%):'}
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-gray-900">{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm sm:text-base text-gray-800 font-semibold">Purchase Total:</span>
                  <span className="text-lg sm:text-xl font-bold text-gray-900">{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm sm:text-base text-gray-800 font-semibold">Previous Outstanding:</span>
                  <span className="text-lg sm:text-xl font-bold text-red-600">{supplierOutstanding.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-base sm:text-xl font-bold border-t-2 border-blue-400 pt-3 mt-2">
                  <span className="text-blue-900">Total Payables:</span>
                  <span className="text-blue-900 text-2xl sm:text-3xl">{totalPayables.toFixed(2)}</span>
                </div>

              </div>

              {/* Payment and Discount Section - One Row */}
              <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-start">
                  {/* Apply Discount */}
                  <div className="flex flex-col">
                    <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                      Apply Discount
                    </label>
                    <div className="flex space-x-2">
                      <select
                        value={directDiscount.type}
                        onChange={(e) => setDirectDiscount({ ...directDiscount, type: e.target.value })}
                        className="px-2 sm:px-3 py-2 text-xs sm:text-sm border-2 border-blue-200 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium h-[42px]"
                      >
                        <option value="amount">Amount</option>
                        <option value="percentage">%</option>
                      </select>
                      <input
                        type="number"
                        placeholder={directDiscount.type === 'amount' ? 'Enter amount...' : 'Enter percentage...'}
                        value={directDiscount.value || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          setDirectDiscount({ ...directDiscount, value });
                        }}
                        className="flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm border-2 border-blue-200 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-900 h-[42px]"
                        min="0"
                        step={directDiscount.type === 'percentage' ? '0.1' : '0.01'}
                      />
                    </div>
                    {directDiscount.value > 0 && (
                      <div className="text-xs sm:text-sm text-green-700 font-semibold mt-2 bg-green-50 px-2 py-1 rounded">
                        {directDiscount.type === 'percentage'
                          ? `${directDiscount.value}% = ${directDiscountAmount.toFixed(2)} off`
                          : `${directDiscount.value} off`
                        }
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="flex flex-col">
                    <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border-2 border-blue-200 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-900 h-[42px]"
                    >
                      <option value="cash">Cash</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="debit_card">Debit Card</option>
                      <option value="check">Check</option>
                    </select>
                  </div>

                  {/* Amount Paid */}
                  <div className="flex flex-col">
                    <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                      Amount Paid
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-2 sm:px-3 py-2 text-sm sm:text-base border-2 border-blue-200 rounded-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-900 h-[42px]"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Clear Discount Button */}
                {directDiscount.value > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setDirectDiscount({ type: 'amount', value: 0 })}
                      className="btn btn-danger btn-sm"
                    >
                      Clear Discount
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4 sm:mt-6 px-4 sm:px-6 pb-4 sm:pb-6">
              {purchaseItems.length > 0 && (
                <button
                  onClick={() => {
                    setPurchaseItems([]);
                    setSelectedSupplier(null);
                    setSupplierSearchTerm('');
                    setTaxExempt(true);
                    setDirectDiscount({ type: 'amount', value: 0 });
                    setAmountPaid(0);
                    setPaymentMethod('cash');
                    setInvoiceDate(new Date().toISOString().split('T')[0]); // Reset to current date
                    toast.success('Cart cleared');
                  }}
                  className="btn btn-secondary btn-md flex items-center justify-center gap-2 w-full sm:flex-1"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Clear Cart</span>
                </button>
              )}
              {purchaseItems.length > 0 && (
                <button
                  onClick={() => {
                    const tempOrder = {
                      orderNumber: `PO-${Date.now()}`,
                      orderType: 'purchase',
                      supplier: selectedSupplier?._id,
                      customer: selectedSupplier, // PrintModal expects 'customer' field
                      customerInfo: selectedSupplier ? {
                        name: selectedSupplier.displayName,
                        email: selectedSupplier.email,
                        phone: selectedSupplier.phone,
                        address: selectedSupplier.address || selectedSupplier.companyAddress || selectedSupplier.location,
                        businessName: selectedSupplier.companyName
                      } : null,
                      items: purchaseItems.map(item => {
                        const product = item.product || {};
                        const displayName = product.isVariant
                          ? (product.displayName || product.variantName || product.name || 'Unknown Variant')
                          : (product.name || 'Unknown Product');

                        return {
                          product: {
                            name: displayName,
                            isVariant: product.isVariant,
                            variantType: product.variantType,
                            variantValue: product.variantValue
                          },
                          quantity: item.quantity,
                          unitPrice: item.costPerUnit
                        };
                      }),
                      pricing: {
                        subtotal: subtotal,
                        discountAmount: directDiscountAmount,
                        taxAmount: tax,
                        isTaxExempt: taxExempt,
                        total: total
                      },
                      payment: {
                        method: paymentMethod,
                        amountPaid: amountPaid,
                        remainingBalance: total - amountPaid,
                        isPartialPayment: amountPaid < total
                      },
                      createdAt: new Date(),
                      createdBy: { name: 'Current User' },
                      invoiceNumber: invoiceNumber,
                      expectedDelivery: expectedDelivery,
                      notes: notes
                    };
                    setCurrentOrder(tempOrder);
                    setShowPrintModal(true);
                  }}
                  className="btn btn-secondary btn-md flex items-center justify-center gap-2 w-full sm:flex-1"
                >
                  <Receipt className="h-4 w-4" />
                  <span>Print Preview</span>
                </button>
              )}
              <LoadingButton
                onClick={handleProcessPurchase}
                isLoading={false}
                className="btn btn-primary btn-md sm:btn-lg flex items-center justify-center gap-2 w-full sm:flex-2"
              >
                <Truck className="h-4 w-4" />
                <span className="hidden sm:inline">{editData?.isEditMode ? 'Update Purchase Invoice' : 'Complete Purchase & Update Inventory'}</span>
                <span className="sm:hidden">{editData?.isEditMode ? 'Update' : 'Complete Purchase'}</span>
              </LoadingButton>
            </div>
          </div>
        )}

        {/* Print Modal */}
        <PrintModal
          isOpen={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setCurrentOrder(null);
          }}
          orderData={currentOrder}
          documentTitle="Purchase Invoice"
          partyLabel="Supplier"
        />

        {/* Export Format Selection Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Export Purchase Report</h2>
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    setExportDateFrom('');
                    setExportDateTo('');
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
                          setExportDateFrom('');
                          setExportDateTo('');
                        }}
                        className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                      >
                        Clear dates
                      </button>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowExportModal(false);
                        setExportDateFrom('');
                        setExportDateTo('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      disabled={isExporting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExportConfirm}
                      disabled={isExporting}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
