import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Building,
  User,
  Calendar,
  TrendingUp,
  Filter,
  X,
  Eye,
  ArrowRight,
  Save,
  RotateCcw,
  Download,
  RefreshCw,
  Phone,
  Receipt,
  Printer,
  ArrowUpDown
} from 'lucide-react';
import { useGetSuppliersQuery, useGetSupplierQuery } from '../store/services/suppliersApi';
import { useGetProductsQuery } from '../store/services/productsApi';
import { useGetVariantsQuery } from '../store/services/productVariantsApi';
import {
  useGetPurchaseOrdersQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useDeletePurchaseOrderMutation,
  useConfirmPurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
  useClosePurchaseOrderMutation,
} from '../store/services/purchaseOrdersApi';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { SearchableDropdown } from '../components/SearchableDropdown';
import toast from 'react-hot-toast';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../utils/componentUtils';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';
import PrintModal from '../components/PrintModal';

// Helper function to safely render values
const safeRender = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'object') {
    return value.name || value.title || value.fullName || value.companyName || JSON.stringify(value);
  }
  return String(value);
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    draft: { color: 'bg-gray-100 text-gray-800', icon: FileText, label: 'Pending' },
    confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Confirmed' },
    partially_received: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Partially Received' },
    fully_received: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Fully Received' },
    cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' },
    closed: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Closed' }
  };

  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </span>
  );
};

const PurchaseOrderCard = ({ po, onEdit, onDelete, onConfirm, onCancel, onClose, onView, onConvert }) => (
  <div className="card hover:shadow-lg transition-shadow">
    <div className="card-content">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="font-semibold text-gray-900">{po.poNumber}</h3>
            <StatusBadge status={po.status} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-600">
              <Building className="h-4 w-4 mr-2" />
              {po.supplier?.companyName || (typeof po.supplier === 'string' ? `Supplier ID: ${po.supplier}` : 'Unknown Supplier')}
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <User className="h-4 w-4 mr-2" />
              {po.createdBy.firstName} {po.createdBy.lastName}
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="h-4 w-4 mr-2" />
              {new Date(po.orderDate).toLocaleDateString()}
            </div>

            {po.expectedDelivery && (
              <div className="flex items-center text-sm text-gray-600">
                <Package className="h-4 w-4 mr-2" />
                Expected: {new Date(po.expectedDelivery).toLocaleDateString()}
              </div>
            )}

            <div className="flex items-center text-sm text-gray-600">
              <TrendingUp className="h-4 w-4 mr-2" />
              {Math.round(po.subtotal)} ({po.items.length} items)
            </div>
          </div>

          {/* Progress Bar for Received Orders */}
          {(po.status === 'partially_received' || po.status === 'fully_received') && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span>{po.progressPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${po.progressPercentage}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <button
            onClick={() => onView(po)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>

          {(po.status === 'draft' || po.status === 'confirmed' || po.status === 'partially_received' || po.status === 'cancelled') && (
            <button
              onClick={() => onEdit(po)}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}

          {po.status === 'draft' && (
            <button
              onClick={() => onConfirm(po)}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Confirm"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          )}

          {(po.status === 'draft' || po.status === 'cancelled' || po.status === 'confirmed' || po.status === 'partially_received' || !po.supplier) && (
            <button
              onClick={() => onDelete(po)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          {po.status === 'confirmed' && (
            <button
              onClick={() => onCancel(po)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Cancel"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}

          {po.status === 'fully_received' && (
            <button
              onClick={() => onClose(po)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {(po.status === 'confirmed' || po.status === 'partially_received') && po.remainingItemsCount > 0 && (
            <button
              onClick={() => onConvert(po)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Convert to Purchase"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);


export const PurchaseOrders = ({ tabId }) => {
  const { updateTabTitle, getActiveTab, openTab } = useTab();
  const { companyInfo: companySettings } = useCompanyInfo();
  const resolvedCompanyName = companySettings.companyName || 'Company Name';
  const resolvedCompanyAddress = companySettings.address || companySettings.billingAddress || '';
  const resolvedCompanyPhone = companySettings.contactNumber || '';

  // Calculate default date range (14 days ago to today)
  const today = getCurrentDatePakistan();
  const fromDateDefault = getDateDaysAgo(14);

  // State for filters and pagination
  const [filters, setFilters] = useState({
    fromDate: fromDateDefault, // 14 days ago
    toDate: today, // Today
    poNumber: '',
    supplier: '',
    status: '',
    paymentStatus: ''
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 999999 // Get all purchase orders without pagination
  });

  const [sortConfig, setSortConfig] = useState({
    key: 'createdAt',
    direction: 'desc'
  });

  // State for modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrderData, setPrintOrderData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [editProductQuantity, setEditProductQuantity] = useState(1);
  const [editProductCost, setEditProductCost] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    supplier: '',
    items: [],
    invoiceNumber: '',
    expectedDelivery: new Date().toISOString().split('T')[0],
    notes: '',
    terms: '',
    isTaxExempt: true
  });

  // Product selection state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customCost, setCustomCost] = useState('');
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const [searchKey, setSearchKey] = useState(0); // Key to force re-render

  // Modal-specific product selection state
  const [modalProductSearchTerm, setModalProductSearchTerm] = useState('');
  const [modalSelectedProduct, setModalSelectedProduct] = useState(null);
  const [modalSelectedSuggestionIndex, setModalSelectedSuggestionIndex] = useState(-1);

  // Refs
  const productSearchRef = useRef(null);
  const supplierSearchRef = useRef(null);

  // Current order for operations
  const [currentOrder, setCurrentOrder] = useState(null);

  // Auto-focus on product search field when component mounts
  useEffect(() => {
    if (productSearchRef.current) {
      productSearchRef.current.focus();
    }
  }, []);

  // Focus management for edit modal
  useEffect(() => {
    if (showEditModal) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      // Focus on the first input field in the modal after a short delay
      const timer = setTimeout(() => {
        const modalInput = document.querySelector('.modal-product-search input');
        if (modalInput) {
          modalInput.focus();
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = 'unset';
      };
    } else {
      // Clear modal state when modal is closed
      setModalProductSearchTerm('');
      setModalSelectedProduct(null);
      setEditProductQuantity(1);
      setEditProductCost(0);
      setModalSelectedSuggestionIndex(-1);
    }
  }, [showEditModal]);


  // Transform filters to match backend API expectations
  const queryParams = React.useMemo(() => {
    const params = {
      ...pagination,
    };

    // Map fromDate/toDate to dateFrom/dateTo
    if (filters.fromDate) {
      params.dateFrom = filters.fromDate;
    }
    if (filters.toDate) {
      params.dateTo = filters.toDate;
    }

    // Map poNumber to search parameter
    if (filters.poNumber) {
      params.search = filters.poNumber;
    }

    // Include status and supplier if provided
    if (filters.status) {
      params.status = filters.status;
    }
    if (filters.supplier) {
      params.supplier = filters.supplier;
    }

    // Note: sortConfig and paymentStatus are not supported by backend
    // Sorting is handled client-side if needed

    return params;
  }, [filters, pagination]);

  // Fetch purchase orders
  const {
    data: purchaseOrdersData,
    isLoading,
    error,
    refetch,
  } = useGetPurchaseOrdersQuery(queryParams, { refetchOnMountOrArgChange: true });

  // Fetch suppliers for dropdown
  const { data: suppliersData, isLoading: suppliersLoading, refetch: refetchSuppliers } = useGetSuppliersQuery(
    { search: '', limit: 999999 },
    {
      skip: false,
      staleTime: 0, // Always consider data stale to get fresh balance information
      refetchOnMountOrArgChange: true, // Refetch when component mounts or params change
    }
  );
  const suppliers = React.useMemo(() => {
    return suppliersData?.data?.suppliers || suppliersData?.suppliers || [];
  }, [suppliersData]);

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

  // Fetch all active products for client-side fuzzy search
  const { data: allProductsData, isLoading: productsLoading } = useGetProductsQuery(
    { limit: 999999, status: 'active' }, // Get all active products
    {
      keepPreviousData: true,
      staleTime: 30000, // Cache for 30 seconds
    }
  );

  // Fetch all variants for search
  const { data: variantsData, isLoading: variantsLoading } = useGetVariantsQuery(
    { status: 'active' },
    {
      keepPreviousData: true,
      staleTime: 30000,
    }
  );

  // Extract products array from RTK Query response
  const allProducts = React.useMemo(() => {
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

  const fuzzySearchResults = useFuzzySearch(
    allItems,
    productSearchTerm,
    ['name', 'description', 'brand', 'displayName', 'variantValue', 'variantName'],
    {
      threshold: 0.4,
      minScore: 0.3,
      limit: null // Show unlimited products
    }
  );

  // Show all results when searching
  const productsData = React.useMemo(() => {
    if (!productSearchTerm || productSearchTerm.trim().length === 0) {
      // Show all items when no search term
      return allItems;
    }
    return fuzzySearchResults;
  }, [productSearchTerm, allItems, fuzzySearchResults]);

  // Fetch products for modal (use same cached data with fuzzy search)
  const modalFuzzySearchResults = useFuzzySearch(
    allItems,
    modalProductSearchTerm,
    ['name', 'description', 'brand', 'displayName', 'variantValue', 'variantName'],
    {
      threshold: 0.4,
      minScore: 0.3,
      limit: null // Show unlimited products
    }
  );

  // Show all results when searching
  const modalProductsData = React.useMemo(() => {
    if (!modalProductSearchTerm || modalProductSearchTerm.trim().length === 0) {
      // Show all items when no search term
      return allItems;
    }
    return modalFuzzySearchResults;
  }, [modalProductSearchTerm, allItems, modalFuzzySearchResults]);

  const modalProductsLoading = productsLoading || variantsLoading;

  // Auto-scroll selected product into view when navigating with keyboard
  useEffect(() => {
    if (selectedProductIndex >= 0 && productSearchTerm && productsData) {
      const productList = document.querySelector('.product-list-container');
      const selectedProductElement = productList?.querySelector(`[data-product-index="${selectedProductIndex}"]`);

      if (selectedProductElement && productList) {
        selectedProductElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }, [selectedProductIndex, productSearchTerm, productsData]);


  // Mutations
  const [createPurchaseOrderMutation, { isLoading: creating }] = useCreatePurchaseOrderMutation();
  const [updatePurchaseOrderMutation, { isLoading: updating }] = useUpdatePurchaseOrderMutation();
  const [deletePurchaseOrderMutation, { isLoading: deleting }] = useDeletePurchaseOrderMutation();
  const [confirmPurchaseOrderMutation, { isLoading: confirming }] = useConfirmPurchaseOrderMutation();
  const [cancelPurchaseOrderMutation, { isLoading: cancelling }] = useCancelPurchaseOrderMutation();
  const [closePurchaseOrderMutation, { isLoading: closing }] = useClosePurchaseOrderMutation();

  // Helper functions
  const resetForm = () => {
    setFormData({
      supplier: '',
      items: [],
      invoiceNumber: '',
      expectedDelivery: new Date().toISOString().split('T')[0],
      notes: '',
      terms: '',
      isTaxExempt: true
    });
    setSelectedSupplier(null);
    setSupplierSearchTerm('');
    setSelectedProduct(null);
    setProductSearchTerm('');
    setQuantity(1);
    setCustomCost('');
    setSearchKey(prev => prev + 1); // Force re-render of search components

    // Reset tab title to default
    if (updateTabTitle && getActiveTab) {
      const activeTab = getActiveTab();
      if (activeTab) {
        updateTabTitle(activeTab.id, 'PO');
      }
    }
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
    // SearchableDropdown passes the full supplier object, not just the ID
    const supplierId = typeof supplier === 'string' ? supplier : supplier._id;
    const supplierObj = typeof supplier === 'object' ? supplier : suppliers?.find(s => s._id === supplierId);

    setSelectedSupplier(supplierObj);
    setFormData(prev => ({ ...prev, supplier: supplierId }));
    setSupplierSearchTerm(supplierObj?.companyName || supplierObj?.name || '');

    // Update tab title to show supplier name
    if (updateTabTitle && getActiveTab && supplierObj) {
      const activeTab = getActiveTab();
      if (activeTab) {
        updateTabTitle(activeTab.id, `PO - ${supplierObj.companyName || supplierObj.name || 'Unknown'}`);
      }
    }
  };

  const handleSupplierSearch = (searchTerm) => {
    setSupplierSearchTerm(searchTerm);

    if (searchTerm === '') {
      setSelectedSupplier(null);
      setFormData(prev => ({ ...prev, supplier: '' }));

      // Reset tab title to default when supplier is cleared
      if (updateTabTitle && getActiveTab) {
        const activeTab = getActiveTab();
        if (activeTab) {
          updateTabTitle(activeTab.id, 'PO');
        }
      }
    }
  };

  const productDisplayKey = (product) => {
    const inventory = product.inventory || {};
    const isLowStock = inventory.currentStock <= (inventory.reorderPoint || inventory.minStock || 0);
    const isOutOfStock = inventory.currentStock === 0;

    // Get display name - use variant display name if it's a variant
    const displayName = product.isVariant
      ? (product.displayName || product.variantName || product.name)
      : product.name;

    // Get cost price
    const pricing = product.pricing || {};
    const cost = pricing.cost || 0;

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
          <div className="text-sm text-gray-600">Cost: {Math.round(cost)}</div>
        </div>
      </div>
    );
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    // Use variant pricing if it's a variant
    const cost = product.pricing?.cost || 0;
    setCustomCost(cost.toString());
    // Show product/variant name in the field
    const displayName = product.isVariant
      ? (product.displayName || product.variantName || product.name)
      : product.name;
    setProductSearchTerm(displayName);
    setSelectedProductIndex(-1);
  };

  const handleProductSearch = (searchTerm) => {
    setProductSearchTerm(searchTerm);
    setSelectedProductIndex(-1); // Reset selection when searching

    // Clear selected product if search term doesn't match the selected product name
    if (selectedProduct && searchTerm !== selectedProduct.name) {
      setSelectedProduct(null);
      setCustomCost('');
    }

    if (searchTerm === '') {
      setSelectedProduct(null);
      setCustomCost('');
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && selectedProduct) {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) {
      toast.error('Please select a product and enter quantity');
      return;
    }

    const costPerUnit = parseFloat(customCost) || selectedProduct.pricing?.cost || 0;
    const totalCost = costPerUnit * quantity;

    const newItem = {
      product: selectedProduct._id,
      productData: selectedProduct, // Store full product data for display
      quantity,
      costPerUnit,
      totalCost
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    // Reset product selection
    setSelectedProduct(null);
    setProductSearchTerm('');
    setQuantity(1);
    setCustomCost('');
    setSearchKey(prev => prev + 1); // Force re-render of search components

    // Focus back to product search input
    setTimeout(() => {
      if (productSearchRef.current) {
        productSearchRef.current.focus();
      }
    }, 100);
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSortCartItems = () => {
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
          (productData.isVariant
            ? (productData.displayName || productData.variantName || productData.name)
            : productData.name) ||
          productData.title ||
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
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.totalCost, 0);
    const tax = formData.isTaxExempt ? 0 : subtotal * 0.08; // 8% tax if not exempt
    const total = subtotal + tax;
    const supplierOutstanding = selectedSupplier?.pendingBalance || 0;
    const totalPayables = total + supplierOutstanding;

    return { subtotal, tax, total, supplierOutstanding, totalPayables };
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
      toast.error('Please add at least one item to the order');
      return;
    }

    if (!formData.supplier) {
      toast.error('Please select a supplier');
      return;
    }

    const { subtotal, tax, total } = calculateTotals();
    const orderData = {
      ...formData,
      subtotal,
      tax,
      total
    };

    createPurchaseOrderMutation(orderData)
      .unwrap()
      .then(() => {
        toast.success('Purchase order created successfully');

        // Refetch suppliers list to update balances (so new supplier selection works without refresh)
        if (refetchSuppliers && typeof refetchSuppliers === 'function') {
          try {
            refetchSuppliers();
          } catch (error) {
            // Failed to refetch suppliers - silent fail
          }
        }

        // Reset form (clears supplier and enables supplier selection UI for next order)
        resetForm();
        if (updateTabTitle && getActiveTab) {
          const activeTab = getActiveTab();
          if (activeTab) {
            updateTabTitle(activeTab.id, 'PO');
          }
        }
        refetch();
      })
      .catch((error) => {
        toast.error(error?.data?.message || 'Failed to create purchase order');
      });
  };

  const handleUpdate = () => {
    // Clean the form data before sending to backend
    const cleanedData = {
      ...formData,
      items: formData.items.map(item => ({
        product: item.product,
        quantity: item.quantity,
        costPerUnit: item.costPerUnit,
        totalCost: item.totalCost,
        receivedQuantity: item.receivedQuantity || 0,
        remainingQuantity: item.remainingQuantity || item.quantity
      }))
    };

    updatePurchaseOrderMutation({ id: selectedOrder._id, ...cleanedData })
      .unwrap()
      .then(() => {
        setShowEditModal(false);
        setSelectedOrder(null);

        // Immediately refetch supplier to update outstanding balance (BEFORE resetting form)
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

        // Also refetch suppliers list to update balances
        if (refetchSuppliers && typeof refetchSuppliers === 'function') {
          try {
            refetchSuppliers();
          } catch (error) {
            // Failed to refetch suppliers - silent fail
          }
        }

        resetForm();
        toast.success('Purchase order updated successfully');
        if (updateTabTitle && getActiveTab) {
          const activeTab = getActiveTab();
          if (activeTab) {
            updateTabTitle(activeTab.id, 'PO');
          }
        }
        refetch();
      })
      .catch((error) => {
        const errorMessage = error?.data?.message || error?.message || 'Failed to update purchase order';
        toast.error(errorMessage);
      });
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this purchase order?')) {
      deletePurchaseOrderMutation(id)
        .unwrap()
        .then(() => {
          toast.success('Purchase order deleted successfully');
          refetch();
        })
        .catch((error) => {
          toast.error(error?.data?.message || 'Failed to delete purchase order');
        });
    }
  };

  const handleConfirm = (id) => {
    if (window.confirm('Are you sure you want to confirm this pending purchase order? This will change its status to confirmed and make it ready for receiving.')) {
      confirmPurchaseOrderMutation(id)
        .unwrap()
        .then(() => {
          toast.success('Purchase order confirmed successfully');
          refetch();
        })
        .catch((error) => {
          toast.error(error?.data?.message || 'Failed to confirm purchase order');
        });
    }
  };

  const handleCancel = (id) => {
    if (window.confirm('Are you sure you want to cancel this purchase order? This action cannot be undone.')) {
      cancelPurchaseOrderMutation(id)
        .unwrap()
        .then(() => {
          toast.success('Purchase order cancelled successfully');
          refetch();
        })
        .catch((error) => {
          toast.error(error?.data?.message || 'Failed to cancel purchase order');
        });
    }
  };

  const handleEdit = (order) => {
    setSelectedOrder(order);

    // Process items to ensure productData is available and costPerUnit is preserved
    const processedItems = (order.items || []).map(item => {
      // Use saved costPerUnit, or fallback to product's default cost price if saved cost is 0
      let finalCostPerUnit = item.costPerUnit || 0;
      if (finalCostPerUnit === 0 && item.product?.pricing?.cost) {
        finalCostPerUnit = item.product.pricing.cost;
      }

      return {
        product: item.product?._id || item.product,
        quantity: item.quantity,
        costPerUnit: finalCostPerUnit, // Use saved cost or fallback to product default
        totalCost: item.totalCost || (item.quantity * finalCostPerUnit),
        receivedQuantity: item.receivedQuantity || 0,
        remainingQuantity: item.remainingQuantity || item.quantity,
        productData: item.product || null // Use the populated product data
      };
    });

    const newFormData = {
      supplier: order.supplier?._id || '',
      items: processedItems,
      expectedDelivery: order.expectedDelivery ? new Date(order.expectedDelivery).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      notes: order.notes || '',
      terms: order.terms || '',
      isTaxExempt: order.isTaxExempt !== undefined ? order.isTaxExempt : true
    };

    setFormData(newFormData);

    // Set the selected supplier and update tab title
    if (order.supplier) {
      setSelectedSupplier(order.supplier);
      setSupplierSearchTerm(order.supplier.companyName || order.supplier.name || '');

      // Update tab title to show supplier name
      if (updateTabTitle && getActiveTab) {
        const activeTab = getActiveTab();
        if (activeTab) {
          updateTabTitle(activeTab.id, `PO - ${order.supplier.companyName || order.supplier.name || 'Unknown'}`);
        }
      }
    } else {
      setSelectedSupplier(null);
      setSupplierSearchTerm('');

      // Reset tab title to default
      if (updateTabTitle && getActiveTab) {
        const activeTab = getActiveTab();
        if (activeTab) {
          updateTabTitle(activeTab.id, 'PO');
        }
      }
    }

    setShowEditModal(true);
  };

  const handleView = (order) => {
    setSelectedOrder(order);
    setShowViewModal(true);
  };

  const formatPurchaseOrderForPrint = (order) => {
    if (!order) return null;
    const supplier = order.supplier || {};
    const items = (order.items || []).map((item) => {
      const product = item.product || {};
      const name = product.isVariant
        ? product.displayName || product.variantName || product.name || 'Product'
        : product.name || 'Product';
      const qty = Number(item.quantity) || 0;
      // costPerUnit is the actual field name used in purchase orders
      const unitCost = Number(item.costPerUnit ?? item.unitCost ?? item.cost ?? 0) || 0;
      const totalCost = Number(item.totalCost) || qty * unitCost;
      return {
        quantity: qty,
        unitPrice: unitCost,
        unitCost,
        costPerUnit: unitCost,
        total: totalCost,
        product: { name },
        name
      };
    });
    const subtotal = order.subtotal ?? items.reduce((sum, i) => sum + (i.quantity * (i.unitPrice || 0)), 0);
    const tax = order.tax ?? 0;
    const total = order.total ?? subtotal + tax;
    return {
      ...order,
      supplier,
      items,
      subtotal,
      tax,
      total,
      poNumber: order.poNumber || order.orderNumber || order.referenceNumber,
      orderNumber: order.poNumber || order.orderNumber,
      status: order.status || 'draft',
      createdAt: order.createdAt || order.orderDate,
      payment: order.payment || { method: 'N/A', status: 'Pending', amountPaid: 0 }
    };
  };

  const handlePrint = (order) => {
    const formatted = formatPurchaseOrderForPrint(order);
    if (formatted) {
      setPrintOrderData(formatted);
      setShowPrintModal(true);
    }
  };

  const handleExport = () => {
    try {
      // Get all purchase orders (or filtered ones)
      const ordersToExport = purchaseOrders || [];

      if (ordersToExport.length === 0) {
        toast.error('No purchase orders to export');
        return;
      }

      // Prepare CSV headers
      const headers = [
        'Order Number',
        'Date',
        'Supplier',
        'Status',
        'Subtotal',
        'Tax',
        'Total',
        'Items Count',
        'Notes'
      ];

      // Convert orders to CSV rows
      const csvRows = [
        headers.join(',')
      ];

      ordersToExport.forEach(order => {
        const supplierName = order.supplier?.companyName ||
          order.supplier?.name ||
          order.supplierInfo?.companyName ||
          'N/A';
        const status = order.status || 'N/A';
        const subtotal = order.subtotal || order.pricing?.subtotal || 0;
        const tax = order.tax || order.pricing?.taxAmount || 0;
        const total = order.total || order.pricing?.total || 0;
        const itemsCount = order.items?.length || 0;
        const notes = (order.notes || '').replace(/"/g, '""'); // Escape quotes
        const date = order.createdAt ? formatDate(order.createdAt) : formatDate(new Date());

        const row = [
          order.poNumber || order.orderNumber || 'N/A',
          date,
          `"${supplierName}"`,
          status,
          subtotal.toFixed(2),
          tax.toFixed(2),
          total.toFixed(2),
          itemsCount,
          `"${notes}"`
        ];

        csvRows.push(row.join(','));
      });

      // Create CSV content
      const csvContent = csvRows.join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `purchase_orders_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${ordersToExport.length} purchase order(s) to CSV`);
    } catch (error) {
      toast.error('Failed to export purchase orders');
    }
  };

  // Extract purchase orders data - handle multiple possible response structures
  const purchaseOrders = React.useMemo(() => {
    if (!purchaseOrdersData) return [];
    if (purchaseOrdersData?.data?.purchaseOrders) return purchaseOrdersData.data.purchaseOrders;
    if (purchaseOrdersData?.purchaseOrders) return purchaseOrdersData.purchaseOrders;
    if (purchaseOrdersData?.data?.data?.purchaseOrders) return purchaseOrdersData.data.data.purchaseOrders;
    if (Array.isArray(purchaseOrdersData)) return purchaseOrdersData;
    if (Array.isArray(purchaseOrdersData?.data)) return purchaseOrdersData.data;
    return [];
  }, [purchaseOrdersData]);

  const paginationInfo = purchaseOrdersData?.data?.pagination || purchaseOrdersData?.pagination || {};
  const { subtotal, tax, total, supplierOutstanding, totalPayables } = calculateTotals();

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm sm:text-base text-gray-600">Process purchase order transactions</p>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="btn btn-secondary btn-md flex-1 sm:flex-initial"
          >
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={resetForm}
            className="btn btn-primary btn-md flex-1 sm:flex-initial"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">New Purchase Order</span>
            <span className="sm:hidden">New PO</span>
          </button>
        </div>
      </div>

      {/* Supplier Selection and Information Row */}
      <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-4">
        {/* Supplier Selection */}
        <div className="w-full md:w-[500px] flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Supplier
            </label>
            {selectedSupplier && (
              <button
                onClick={() => {
                  setSelectedSupplier(null);
                  setSupplierSearchTerm('');
                  setFormData(prev => ({ ...prev, supplier: '' }));
                  if (updateTabTitle && getActiveTab) {
                    const activeTab = getActiveTab();
                    if (activeTab) {
                      updateTabTitle(activeTab.id, 'PO');
                    }
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Change Supplier
              </button>
            )}
          </div>
          <SearchableDropdown
            ref={supplierSearchRef}
            placeholder="Search suppliers by name, email, or business..."
            items={suppliers || []}
            onSelect={handleSupplierSelect}
            onSearch={handleSupplierSearch}
            displayKey={supplierDisplayKey}
            selectedItem={selectedSupplier}
            loading={suppliersLoading}
            emptyMessage={supplierSearchTerm.length > 0 ? "No suppliers found" : "Start typing to search suppliers..."}
            value={supplierSearchTerm}
          />
        </div>

        {/* Supplier Information - Right Side */}
        <div className="flex-1">
          {selectedSupplier ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <Building className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium">{selectedSupplier.companyName || selectedSupplier.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-600 capitalize">
                    {selectedSupplier.businessType || 'Business'} • {selectedSupplier.reliability || 'Standard'}
                  </p>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">Outstanding Balance:</span>
                      <span className={`text-sm font-medium ${(selectedSupplier.outstandingBalance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {Math.round(selectedSupplier.outstandingBalance || 0)}
                      </span>
                    </div>
                    {selectedSupplier.phone && (
                      <div className="flex items-center space-x-1">
                        <Phone className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{selectedSupplier.phone}</span>
                      </div>
                    )}
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
          <h3 className="text-lg font-medium text-gray-900">Product Selection & Cart</h3>
        </div>
        <div className="card-content">
          {/* Product Search */}
          <div className="mb-6">
            <div className="space-y-4">
              {/* Mobile Layout */}
              <div className="md:hidden space-y-3">
                {/* Product Search */}
                <div>
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
                    loading={productsLoading || variantsLoading}
                    emptyMessage={productSearchTerm.length > 0 ? "No products found" : "Start typing to search products..."}
                    value={productSearchTerm}
                  />
                </div>

                {/* Fields Grid - 2 columns on mobile */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Stock */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Stock
                    </label>
                    <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-2 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
                      {selectedProduct ? selectedProduct.inventory?.currentStock || 0 : '0'}
                    </span>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-2 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
                      {selectedProduct ? Math.round(quantity * parseFloat(customCost || 0)) : 0}
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
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      onKeyDown={handleInputKeyDown}
                      className="input text-center h-10 w-full"
                      placeholder="1"
                    />
                  </div>

                  {/* Cost */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Cost
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={customCost}
                      onChange={(e) => setCustomCost(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      className="input text-center h-10 w-full"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                {/* Add Button - Full width on mobile */}
                <div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full btn btn-primary flex items-center justify-center px-4 py-2.5 h-11"
                    disabled={!selectedProduct}
                    title="Add to cart (or press Enter in Quantity/Cost fields - focus returns to search)"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </button>
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden md:grid grid-cols-12 gap-4 items-end">
                {/* Product Search - 7 columns */}
                <div className="col-span-7">
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
                    loading={productsLoading || variantsLoading}
                    emptyMessage={productSearchTerm.length > 0 ? "No products found" : "Start typing to search products..."}
                    value={productSearchTerm}
                  />
                </div>

                {/* Stock - 1 column */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock
                  </label>
                  <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1.5 rounded border border-gray-200 block text-center h-12 flex items-center justify-center">
                    {selectedProduct ? selectedProduct.inventory?.currentStock || 0 : '0'}
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
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    onKeyDown={handleInputKeyDown}
                    className="input text-center h-12"
                    placeholder="1 (Enter to add & focus search)"
                  />
                </div>

                {/* Cost - 1 column */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cost
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={customCost}
                    onChange={(e) => setCustomCost(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    className="input text-center h-12"
                    placeholder="0 (Enter to add & focus search)"
                    required
                  />
                </div>

                {/* Amount - 1 column */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount
                  </label>
                  <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1.5 rounded border border-gray-200 block text-center h-12 flex items-center justify-center">
                    {selectedProduct ? Math.round(quantity * parseFloat(customCost || 0)) : 0}
                  </span>
                </div>

                {/* Add Button - 1 column */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    &nbsp;
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full btn btn-primary flex items-center justify-center px-3 h-12"
                    disabled={!selectedProduct}
                    title="Add to cart (or press Enter in Quantity/Cost fields - focus returns to search)"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cart Items */}
          {formData.items.length === 0 ? (
            <div className="p-8 text-center text-gray-500 border-t border-gray-200">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">No items in cart</p>
            </div>
          ) : (
            <div className="space-y-4 border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base sm:text-md font-medium text-gray-700">Cart Items</h4>
                <button
                  type="button"
                  onClick={handleSortCartItems}
                  className="btn btn-secondary btn-sm flex items-center space-x-2"
                  title="Sort products alphabetically"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Sort A-Z</span>
                  <span className="sm:hidden">Sort</span>
                </button>
              </div>

              {/* Desktop Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 items-center pb-2 border-b border-gray-300 mb-2">
                <div className="col-span-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase">#</span>
                </div>
                <div className="col-span-6">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Product</span>
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Stock</span>
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Qty</span>
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Cost</span>
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Total</span>
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Action</span>
                </div>
              </div>

              {formData.items.map((item, index) => {
                const product = item.productData || item.product; // Use stored product/variant data or fallback to product
                const displayName = product?.isVariant
                  ? (product?.displayName || product?.variantName || product?.name || 'Unknown Variant')
                  : (product?.name || 'Unknown Product');
                const totalPrice = item.costPerUnit * item.quantity;
                const isLowStock = product?.inventory?.currentStock <= (product?.inventory?.reorderPoint || 0);

                return (
                  <div key={index}>
                    {/* Mobile Card View */}
                    <div className="md:hidden mb-4 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{index + 1}</span>
                            <span className="font-medium text-sm truncate">
                              {product?.isVariant
                                ? safeRender(product?.displayName || product?.variantName || product?.name || 'Unknown Variant')
                                : safeRender(product?.name || 'Unknown Product')}
                            </span>
                          </div>
                          {product?.isVariant && (
                            <span className="text-xs text-gray-500 block">
                              {product.variantType}: {product.variantValue}
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {isLowStock && <span className="text-yellow-600 text-xs">⚠️ Low</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="btn btn-danger btn-sm h-8 w-8 p-0 flex-shrink-0 ml-2"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Stock</label>
                          <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center">
                            {product?.inventory?.currentStock || 0}
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
                            onChange={(e) => {
                              const newQuantity = parseInt(e.target.value) || 1;
                              if (newQuantity <= 0) {
                                handleRemoveItem(index);
                                return;
                              }
                              setFormData(prev => ({
                                ...prev,
                                items: prev.items.map((itm, i) =>
                                  i === index ? { ...itm, quantity: newQuantity, totalCost: newQuantity * itm.costPerUnit } : itm
                                )
                              }));
                            }}
                            className="input text-center h-8 w-full"
                            min="1"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Cost</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.costPerUnit}
                            onChange={(e) => {
                              const newCost = parseFloat(e.target.value) || 0;
                              setFormData(prev => ({
                                ...prev,
                                items: prev.items.map((itm, i) =>
                                  i === index ? { ...itm, costPerUnit: newCost, totalCost: itm.quantity * newCost } : itm
                                )
                              }));
                            }}
                            className="input text-center h-8 w-full"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Desktop Table Row */}
                    <div className={`hidden md:block py-1 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <div className="grid grid-cols-12 gap-4 items-center">
                        {/* Serial Number - 1 column (new field) */}
                        <div className="col-span-1">
                          <span className="text-sm font-medium text-gray-700 bg-gray-50 px-0.5 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
                            {index + 1}
                          </span>
                        </div>

                        {/* Product Name - 6 columns (adjusted to align with Product Search 7 columns) */}
                        <div className="col-span-6 flex items-center h-8">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm truncate">
                              {product?.isVariant
                                ? safeRender(product?.displayName || product?.variantName || product?.name || 'Unknown Variant')
                                : safeRender(product?.name || 'Unknown Product')}
                              {isLowStock && <span className="text-yellow-600 text-xs ml-2">⚠️ Low</span>}
                            </span>
                            {product?.isVariant && (
                              <span className="text-xs text-gray-500">
                                {product.variantType}: {product.variantValue}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stock - 1 column (matches Product Selection Stock) */}
                        <div className="col-span-1">
                          <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
                            {product?.inventory?.currentStock || 0}
                          </span>
                        </div>

                        {/* Quantity - 1 column (matches Product Selection Quantity) */}
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
                                  i === index ? { ...itm, quantity: newQuantity, totalCost: newQuantity * itm.costPerUnit } : itm
                                )
                              }));
                            }}
                            className="input text-center h-8"
                            min="1"
                          />
                        </div>

                        {/* Cost - 1 column (matches Product Selection Cost) */}
                        <div className="col-span-1">
                          <input
                            type="number"
                            step="0.01"
                            value={item.costPerUnit}
                            onChange={(e) => {
                              const newCost = parseFloat(e.target.value) || 0;
                              setFormData(prev => ({
                                ...prev,
                                items: prev.items.map((itm, i) =>
                                  i === index ? { ...itm, costPerUnit: newCost, totalCost: itm.quantity * newCost } : itm
                                )
                              }));
                            }}
                            className="input text-center h-8"
                            min="0"
                          />
                        </div>

                        {/* Total - 1 column (matches Product Selection Amount) */}
                        <div className="col-span-1">
                          <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-8 flex items-center justify-center">
                            {Math.round(totalPrice)}
                          </span>
                        </div>

                        {/* Delete Button - 1 column (matches Product Selection Add Button) */}
                        <div className="col-span-1">
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="btn btn-danger btn-sm h-8 w-full"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      {/* Purchase Order Details - Create Mode */}
      {formData.items.length > 0 && !showEditModal && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg max-w-5xl ml-auto mt-4">
          {/* Purchase Details Section */}
          <div className="px-4 sm:px-6 py-4 border-b border-blue-200">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 text-left sm:text-right">
              Purchase Order Details
            </h3>
          </div>
          <div className="px-4 sm:px-6 py-4">
            {/* Mobile Layout - Stacked */}
            <div className="md:hidden space-y-3">
              {/* Invoice Number */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={formData.invoiceNumber || "Auto-generated"}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  className="input h-10 text-sm w-full"
                  placeholder="Auto-generated"
                  disabled
                />
              </div>

              {/* Expected Delivery */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Expected Delivery
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.expectedDelivery}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                    className="input h-10 text-sm w-full pr-8"
                  />
                  <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none sm:hidden" />
                </div>
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
                    checked={formData.isTaxExempt}
                    onChange={(e) => setFormData(prev => ({ ...prev, isTaxExempt: e.target.checked }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <label htmlFor="taxExemptMobile" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Tax Exempt
                    </label>
                  </div>
                  {formData.isTaxExempt && (
                    <div className="text-green-600 text-sm font-medium">
                      ✓
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="input h-10 text-sm w-full"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            {/* Desktop Layout - Horizontal */}
            <div className="hidden md:flex flex-nowrap gap-3 items-end justify-end">
              {/* Invoice Number */}
              <div className="flex flex-col w-44">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={formData.invoiceNumber || "Auto-generated"}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  className="input h-8 text-sm"
                  placeholder="Auto-generated"
                  disabled
                />
              </div>

              {/* Expected Delivery */}
              <div className="flex flex-col w-48">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Expected Delivery
                </label>
                <input
                  type="date"
                  value={formData.expectedDelivery}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                  className="input h-8 text-sm"
                />
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

              {/* Notes */}
              <div className="flex flex-col w-[28rem]">
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

            {/* Order Summary Section */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 border-t border-blue-200 mt-6">
              <h3 className="text-lg font-semibold text-white">Order Summary</h3>
            </div>

            {/* Order Summary Details */}
            <div className="px-6 py-4">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-semibold">Subtotal:</span>
                  <span className="text-xl font-bold text-gray-900">{Math.round(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-semibold">
                    {formData.isTaxExempt ? 'Tax (Exempt):' : 'Tax (8%):'}
                  </span>
                  <span className="text-xl font-bold text-gray-900">{Math.round(tax)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-semibold">PO Total:</span>
                  <span className="text-xl font-bold text-gray-900">{Math.round(total)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-semibold">Previous Outstanding:</span>
                  <span className="text-xl font-bold text-red-600">{Math.round(supplierOutstanding)}</span>
                </div>
                <div className="flex justify-between items-center text-xl font-bold border-t-2 border-blue-400 pt-3 mt-2">
                  <span className="text-blue-900">Total Payables:</span>
                  <span className="text-blue-900 text-3xl">{Math.round(totalPayables)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6 px-6 pb-6">
              {formData.items.length > 0 && !showEditModal && (
                <button
                  onClick={resetForm}
                  className="btn btn-secondary flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Cart
                </button>
              )}
              {formData.items.length > 0 && (
                <button
                  onClick={() => {
                    // Create temporary order data for print preview
                    const tempOrder = {
                      poNumber: `PO-${Date.now()}`,
                      supplier: selectedSupplier,
                      items: formData.items.map(item => {
                        const product = productsData?.find(p => p._id === item.product);
                        return {
                          product: product,
                          quantity: item.quantity,
                          unitCost: item.costPerUnit,
                          totalCost: item.quantity * item.costPerUnit
                        };
                      }),
                      subtotal: subtotal,
                      discount: 0,
                      tax: tax,
                      total: total,
                      expectedDelivery: formData.expectedDelivery,
                      notes: formData.notes,
                      terms: formData.terms,
                      createdAt: new Date().toISOString()
                    };
                    handlePrint(tempOrder);
                  }}
                  className="btn btn-secondary flex-1"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Print Preview
                </button>
              )}
              <button
                onClick={handleCreate}
                disabled={creating || formData.items.length === 0}
                className="btn btn-primary btn-lg flex-2"
              >
                <Save className="h-4 w-4 mr-2" />
                {creating ? 'Creating...' : 'Create Purchase Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedOrder && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Edit Purchase Order</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedOrder(null);
                    setSupplierSearchTerm('');
                    setModalProductSearchTerm('');
                    setModalSelectedProduct(null);
                    setEditProductQuantity(1);
                    setEditProductCost(0);
                    setModalSelectedSuggestionIndex(-1);
                    resetForm();
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>

              {/* Purchase Order Details */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg mb-6">
                {/* Purchase Details Section */}
                <div className="px-6 py-4 border-b border-blue-200">
                  <h3 className="text-lg font-medium text-gray-900 text-right">
                    Edit Purchase Order Details
                  </h3>
                </div>
                <div className="px-6 py-4">
                  {/* Supplier Selection */}
                  <div className="mb-4">
                    <div className="flex flex-col">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Selection</label>
                      <input
                        type="text"
                        placeholder="Search suppliers..."
                        value={supplierSearchTerm}
                        onChange={(e) => setSupplierSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {/* Supplier Suggestions */}
                      {supplierSearchTerm && suppliers?.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                          {suppliers.slice(0, 5).map((supplier) => (
                            <div
                              key={supplier._id}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, supplier: supplier._id }));
                                setSupplierSearchTerm(supplier.companyName || supplier.name);
                              }}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium">{supplier.companyName || supplier.name}</div>
                              <div className="text-sm text-gray-600">{supplier.email}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Selected Supplier Display */}
                      {formData.supplier && (
                        <div className="mt-2 p-2 bg-blue-50 rounded border">
                          <div className="text-sm font-medium text-blue-900">
                            Selected: {selectedOrder?.supplierInfo?.companyName || selectedOrder?.supplierInfo?.name || 'Supplier'}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, supplier: null }));
                              setSupplierSearchTerm('');
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Single Row Layout for Purchase Order Details */}
                  <div className="flex flex-nowrap gap-3 items-end justify-end">
                    {/* Invoice Number */}
                    <div className="flex flex-col w-44">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Invoice Number
                      </label>
                      <input
                        type="text"
                        value={formData.invoiceNumber || "Auto-generated"}
                        onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                        className="input h-8 text-sm"
                        placeholder="Auto-generated"
                        disabled
                      />
                    </div>

                    {/* Expected Delivery */}
                    <div className="flex flex-col w-48">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Expected Delivery
                      </label>
                      <input
                        type="date"
                        value={formData.expectedDelivery}
                        onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                        className="input h-8 text-sm"
                      />
                    </div>

                    {/* Tax Exemption Option */}
                    <div className="flex flex-col w-40">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Tax Status
                      </label>
                      <div className="flex items-center space-x-1 px-2 py-1 border border-gray-200 rounded h-8">
                        <input
                          type="checkbox"
                          id="taxExemptEdit"
                          checked={formData.isTaxExempt}
                          onChange={(e) => setFormData(prev => ({ ...prev, isTaxExempt: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="taxExemptEdit" className="text-xs text-gray-700">
                          Tax Exempt
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Notes and Terms Row */}
                  <div className="mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Notes Column */}
                      <div className="flex flex-col">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                          className="input h-16 text-sm resize-none"
                          placeholder="Add any notes or comments..."
                        />
                      </div>

                      {/* Terms Column */}
                      <div className="flex flex-col">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Terms & Conditions
                        </label>
                        <textarea
                          value={formData.terms}
                          onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                          className="input h-16 text-sm resize-none"
                          placeholder="Add terms and conditions..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product Selection & Cart Items */}
                <div className="px-6 py-4 border-t border-blue-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Product Selection & Cart Items</h4>

                  {/* Product Search */}
                  <div className="mb-4">
                    <div className="grid grid-cols-12 gap-4 items-end">
                      {/* Product Search - 6 columns */}
                      <div className="col-span-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Product Search
                        </label>
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
                                  setEditProductCost(product.pricing?.costPrice || 0);
                                  setEditProductQuantity(1);
                                  const displayName = product.isVariant
                                    ? (product.displayName || product.variantName || product.name)
                                    : product.name;
                                  setModalProductSearchTerm(displayName);
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
                        {modalProductsData && modalProductsData.length > 0 && (
                          <div className="mt-2 max-h-96 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                            {modalProductsData
                              .map((product, index) => (
                                <div
                                  key={product._id}
                                  onClick={() => {
                                    setModalSelectedProduct(product);
                                    setEditProductCost(product.pricing?.costPrice || 0);
                                    setEditProductQuantity(1);
                                    const displayName = product.isVariant
                                      ? (product.displayName || product.variantName || product.name)
                                      : product.name;
                                    setModalProductSearchTerm(displayName);
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
                                    Cost: {product.pricing?.costPrice || 0}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>


                      {/* Quantity - 2 columns */}
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={editProductQuantity}
                          onChange={(e) => setEditProductQuantity(parseInt(e.target.value) || 1)}
                          className="modal-quantity-input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="1"
                        />
                      </div>

                      {/* Cost Per Unit - 2 columns */}
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cost Per Unit
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editProductCost}
                          onChange={(e) => setEditProductCost(parseFloat(e.target.value) || 0)}
                          className="modal-cost-input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Add Button - 2 columns */}
                      <div className="col-span-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (modalSelectedProduct && editProductQuantity > 0 && editProductCost >= 0) {
                              const newItem = {
                                product: modalSelectedProduct._id,
                                quantity: editProductQuantity,
                                costPerUnit: editProductCost,
                                totalCost: editProductQuantity * editProductCost,
                                productData: modalSelectedProduct
                              };
                              setFormData(prev => ({
                                ...prev,
                                items: [...prev.items, newItem]
                              }));
                              setModalSelectedProduct(null);
                              setModalProductSearchTerm('');
                              setEditProductQuantity(1);
                              setEditProductCost(0);
                              setModalSelectedSuggestionIndex(-1);
                            }
                          }}
                          disabled={!modalSelectedProduct || editProductQuantity <= 0 || editProductCost < 0}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          Add Product
                        </button>
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
                            {item.productData?.isVariant
                              ? (item.productData?.displayName || item.productData?.variantName || item.productData?.name || 'Unknown Variant')
                              : (item.productData?.name || 'Unknown Product')}
                          </div>

                          {/* Quantity, Cost, Total and Delete - Grouped Together */}
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
                                  newItems[index].totalCost = newQuantity * newItems[index].costPerUnit;
                                  setFormData(prev => ({ ...prev, items: newItems }));
                                }}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            {/* Cost Field */}
                            <div className="flex items-center space-x-1">
                              <label className="text-xs text-gray-600">× Cost:</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.costPerUnit}
                                onChange={(e) => {
                                  const newItems = [...formData.items];
                                  const newCost = parseFloat(e.target.value) || 0;
                                  newItems[index].costPerUnit = newCost;
                                  newItems[index].totalCost = newItems[index].quantity * newCost;
                                  setFormData(prev => ({ ...prev, items: newItems }));
                                }}
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            {/* Total Display */}
                            <div className="flex items-center space-x-1">
                              <label className="text-xs text-gray-600">=</label>
                              <span className="text-sm font-medium text-gray-900 min-w-[60px]">
                                {item.totalCost.toFixed(2)}
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

                {/* Order Items Summary */}
                <div className="px-6 py-4 border-t border-blue-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Order Items Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600 mb-1">Total Items</div>
                      <div className="text-lg font-semibold text-gray-900">{formData.items.length}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600 mb-1">Total Quantity</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formData.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600 mb-1">Total Cost</div>
                      <div className="text-lg font-semibold text-blue-600">
                        {Math.round(formData.items.reduce((sum, item) => sum + item.totalCost, 0))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="px-6 py-4 border-t border-blue-200 bg-white rounded-b-lg">
                  <div className="flex justify-end">
                    <div className="text-right">
                      <div className="text-sm text-gray-600 mb-1">Total Payables</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {Math.round(formData.items.reduce((sum, item) => sum + item.totalCost, 0))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedOrder(null);
                      setSupplierSearchTerm('');
                      setModalProductSearchTerm('');
                      setModalSelectedProduct(null);
                      setEditProductQuantity(1);
                      setEditProductCost(0);
                      setModalSelectedSuggestionIndex(-1);
                      resetForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={updating || formData.items.length === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {updating ? 'Updating...' : 'Update Purchase Order'}
                  </button>
                </div>
              </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            {/* Date Range */}
            <div className="col-span-2">
              <DateFilter
                startDate={filters.fromDate}
                endDate={filters.toDate}
                onDateChange={(start, end) => {
                  handleFilterChange('fromDate', start || '');
                  handleFilterChange('toDate', end || '');
                }}
                compact={true}
                showPresets={true}
              />
            </div>

            {/* PO Number Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PO Number
              </label>
              <input
                type="text"
                placeholder="Contains..."
                value={filters.poNumber}
                onChange={(e) => handleFilterChange('poNumber', e.target.value)}
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
                <option value="partially_received">Partially Received</option>
                <option value="fully_received">Fully Received</option>
                <option value="cancelled">Cancelled</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Supplier Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier
              </label>
              <select
                value={filters.supplier}
                onChange={(e) => handleFilterChange('supplier', e.target.value)}
                className="input h-[42px]"
              >
                <option value="">All Suppliers</option>
                {suppliers?.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>
                    {supplier.companyName || supplier.name || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Status
              </label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                className="input h-[42px]"
              >
                <option value="">All Payment Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="refunded">Refunded</option>
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
              Purchase Orders From: {formatDate(filters.fromDate)} To: {formatDate(filters.toDate)}
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
              <p className="mt-2 text-gray-500">Loading purchase orders...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <p>Error loading purchase orders: {error.message}</p>
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No purchase orders found for the selected criteria.</p>
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
                      PO #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier
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
                  {purchaseOrders.map((order, index) => (
                    <tr key={order._id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.poNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {safeRender(order.supplier) || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Math.round(order.total || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
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
                          {(order.status === 'draft' || order.status === 'confirmed' || order.status === 'partially_received' || order.status === 'cancelled') && (
                            <button
                              onClick={() => handleEdit(order)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {order.status === 'draft' && (
                            <>
                              <button
                                onClick={() => handleConfirm(order._id)}
                                className="text-green-600 hover:text-green-900"
                                title="Confirm Order"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleCancel(order._id)}
                                className="text-red-600 hover:text-red-900"
                                title="Cancel Order"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {(order.status === 'draft' || order.status === 'cancelled' || order.status === 'confirmed' || order.status === 'partially_received' || !order.supplier) && (
                            <button
                              onClick={() => handleDelete(order._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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
                <h3 className="text-2xl font-bold text-gray-900">Purchase Order</h3>
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

              {/* PO Details */}
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <h5 className="font-semibold text-gray-900 mb-2">Purchase Order Details</h5>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">PO Number:</span> {selectedOrder.poNumber}</p>
                    <p><span className="font-medium">Date:</span> {formatDate(selectedOrder.createdAt)}</p>
                    <p><span className="font-medium">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${selectedOrder.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                        selectedOrder.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          selectedOrder.status === 'partially_received' ? 'bg-yellow-100 text-yellow-800' :
                            selectedOrder.status === 'fully_received' ? 'bg-green-100 text-green-800' :
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
                <div>
                  {/* Empty middle column for spacing */}
                </div>
                <div className="text-right">
                  <h5 className="font-semibold text-gray-900 mb-2">Supplier Details</h5>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Company:</span> {safeRender(selectedOrder.supplier) || 'Unknown'}</p>
                    {selectedOrder.supplier?.email && (
                      <p><span className="font-medium">Email:</span> {safeRender(selectedOrder.supplier.email)}</p>
                    )}
                    {selectedOrder.supplier?.phone && (
                      <p><span className="font-medium">Phone:</span> {safeRender(selectedOrder.supplier.phone)}</p>
                    )}
                    {selectedOrder.supplier?.contactPerson && (
                      <p><span className="font-medium">Contact:</span> {safeRender(selectedOrder.supplier.contactPerson)}</p>
                    )}
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <p className="font-semibold text-red-600">
                        <span className="font-medium">Outstanding Balance:</span> {Math.round(selectedOrder.supplier?.pendingBalance || 0)}
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
                          Unit Cost
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                          Total Cost
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
                              <div className="font-medium">
                                {safeRender(item.product) || 'Unknown Product'}
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
                            {Math.round(item.costPerUnit || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right border-b border-gray-200">
                            {Math.round(item.totalCost || 0)}
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
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PO Total:</span>
                      <span className="font-medium">{Math.round(selectedOrder.total || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Previous Outstanding:</span>
                      <span className="font-medium text-red-600">{Math.round(selectedOrder.supplier?.pendingBalance || 0)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total Payables:</span>
                      <span className="text-red-600">{Math.round((selectedOrder.total || 0) + (selectedOrder.supplier?.pendingBalance || 0))}</span>
                    </div>
                  </div>
                </div>
              </div>

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

      <PrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setPrintOrderData(null);
        }}
        orderData={printOrderData}
        documentTitle="Purchase Order"
        partyLabel="Supplier"
      />
    </div>
  );
};

