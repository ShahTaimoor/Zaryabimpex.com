import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  RefreshCw,
  Phone,
  Receipt,
  Printer,
  ArrowUpDown,
  Camera
} from 'lucide-react';
import BaseModal from '../components/BaseModal';
import PaginationControls from '../components/PaginationControls';
import ExcelExportButton from '../components/ExcelExportButton';
import PdfExportButton from '../components/PdfExportButton';
import { suppliersApi, useGetSupplierQuery } from '../store/services/suppliersApi';
import { useAppDispatch } from '../store/hooks';
import { useDebouncedSupplierSearch } from '../hooks/useDebouncedSupplierSearch';
import {
  useGetPurchaseOrdersQuery,
  useLazyGetPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useLazyGetPurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useUpdatePurchaseOrderItemsConfirmationMutation,
  useDeletePurchaseOrderMutation,
  useConfirmPurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
  useClosePurchaseOrderMutation,
} from '../store/services/purchaseOrdersApi';
import {
  OrderConfirmationStatusBadge,
  OrderItemConfirmationCell,
  OrderConfirmSelectedActions,
  getItemConfirmationStatus,
} from '../components/OrderItemConfirmationCell';
import { useDebouncedPosProductSearch } from '../hooks/useDebouncedPosProductSearch';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { DualUnitQuantityInput } from '../components/DualUnitQuantityInput';
import { hasDualUnit, getPiecesPerBox, piecesToBoxesAndPieces, formatStockDualLabel } from '../utils/dualUnitUtils';
import { toast } from 'sonner';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  OrderCheckoutCard,
  OrderDetailsSection,
  OrderSummaryBar,
  OrderSummaryContent,
  OrderCheckoutActions,
} from '../components/order/OrderCheckoutLayout';
import { ShowDetailsSectionHeader } from '../components/ShowDetailsSectionHeader';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../utils/componentUtils';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';
import PrintModal from '../components/PrintModal';
import BarcodeLabelPrinter from '../components/BarcodeLabelPrinter';
import { buildReceiptLabelProductsFromLineItems } from '../utils/receiptLabelUtils';

// Helper to get product display name (handles object with name/displayName or UUID string)
const getProductDisplayName = (product) => {
  if (!product) return 'Unknown Product';
  if (typeof product === 'object') {
    const name = product.displayName || product.variantName || product.name || product.company_name || '';
    return name || 'Product';
  }
  // UUID-like string - don't show raw ID
  if (typeof product === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product)) {
    return 'Product';
  }
  return product;
};

// Format supplier/customer address for display (avoids showing raw JSON)
const formatAddressForDisplay = (party) => {
  if (!party) return '';
  if (typeof party.address === 'string' && party.address.trim()) return party.address.trim();
  const addrRaw = party.address ?? party.addresses;
  if (Array.isArray(addrRaw) && addrRaw.length > 0) {
    const a = addrRaw.find(x => x.isDefault) || addrRaw.find(x => x.type === 'billing' || x.type === 'both') || addrRaw[0];
    const parts = [a.street || a.address_line1 || a.addressLine1 || a.line1 || a.address, a.city, a.state || a.province, a.country, a.zipCode || a.zip || a.postalCode || a.postal_code].filter(Boolean);
    return parts.join(', ') || '—';
  }
  if (addrRaw && typeof addrRaw === 'object' && !Array.isArray(addrRaw)) {
    const parts = [addrRaw.street || addrRaw.address_line1 || addrRaw.addressLine1 || addrRaw.line1 || addrRaw.address, addrRaw.city, addrRaw.state || addrRaw.province, addrRaw.country, addrRaw.zipCode || addrRaw.zip || addrRaw.postalCode || addrRaw.postal_code].filter(Boolean);
    return parts.join(', ') || '—';
  }
  if (typeof party.location === 'string' && party.location.trim()) return party.location.trim();
  if (typeof party.companyAddress === 'string' && party.companyAddress.trim()) return party.companyAddress.trim();
  return '';
};

// Helper function to safely render values (supports both camelCase and snake_case)
const safeRender = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Handle JSON string (e.g. supplier stored as stringified object)
    if (value.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(value);
        return parsed.businessName || parsed.business_name || parsed.companyName || parsed.company_name || parsed.name || parsed.contact_person || parsed.contactPerson?.name || parsed.contactPerson || '';
      } catch {
        return value;
      }
    }
    return value;
  }
  if (typeof value === 'object') {
    const cp = value.contactPerson ?? value.contact_person;
    const cpVal = typeof cp === 'object' ? (cp?.name ?? cp?.title) : cp;
    return value.businessName || value.business_name || value.companyName || value.company_name || value.name || value.title || value.fullName || value.contact_person || (typeof cpVal === 'string' ? cpVal : '') || '';
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
              {po.supplier?.businessName || po.supplier?.business_name || po.supplier?.companyName || (typeof po.supplier === 'string' ? `Supplier ID: ${po.supplier}` : 'Unknown Supplier')}
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
  const itemWiseConfirmationEnabled = companySettings.orderSettings?.purchaseOrderItemWiseConfirmation !== false;
  const dualUnitShowBoxInputEnabled = companySettings.orderSettings?.dualUnitShowBoxInput !== false;
  const dualUnitShowPiecesInputEnabled = companySettings.orderSettings?.dualUnitShowPiecesInput !== false;
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
    limit: 50
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

  const PO_LABEL_PRINT_KEY = 'purchaseOrderOfferBarcodeLabelsAfterConfirm';
  const [printBarcodeLabelsAfterPoConfirm, setPrintBarcodeLabelsAfterPoConfirm] = useState(() => {
    try {
      const v = localStorage.getItem(PO_LABEL_PRINT_KEY);
      if (v === null) return false;
      return v === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PO_LABEL_PRINT_KEY, String(printBarcodeLabelsAfterPoConfirm));
    } catch {
      /* ignore */
    }
  }, [printBarcodeLabelsAfterPoConfirm]);

  const [showReceiptLabelPrinter, setShowReceiptLabelPrinter] = useState(false);
  const [receiptLabelProducts, setReceiptLabelProducts] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewOrderFresh, setViewOrderFresh] = useState(null);
  const [selectedItemIndices, setSelectedItemIndices] = useState([]);
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
  const [showPurchaseOrderDetailsFields, setShowPurchaseOrderDetailsFields] = useState(false);
  const [showProductImages, setShowProductImages] = useState(localStorage.getItem('showProductImagesUI') !== 'false');

  useEffect(() => {
    const handleConfigChange = () => {
      setShowProductImages(localStorage.getItem('showProductImagesUI') !== 'false');
    };
    window.addEventListener('productImagesConfigChanged', handleConfigChange);
    return () => window.removeEventListener('productImagesConfigChanged', handleConfigChange);
  }, []);

  const [previewImageProduct, setPreviewImageProduct] = useState(null);

  const poCartScrollRef = useRef(null);
  const poCartLineElRefs = useRef(new Map());
  const [highlightedPoLineIndex, setHighlightedPoLineIndex] = useState(null);
  const poCartNeedsInnerScroll = formData.items.length > 10;

  useLayoutEffect(() => {
    if (highlightedPoLineIndex === null) return;
    const idx = highlightedPoLineIndex;
    poCartScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (poCartNeedsInnerScroll) {
      poCartLineElRefs.current.get(idx)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      requestAnimationFrame(() => {
        poCartLineElRefs.current.get(idx)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      });
    }
  }, [highlightedPoLineIndex, poCartNeedsInnerScroll, formData.items.length]);

  useEffect(() => {
    if (formData.items.length === 0) setHighlightedPoLineIndex(null);
  }, [formData.items.length]);

  // Auto-focus on product search field when component mounts
  useEffect(() => {
    if (productSearchRef.current) {
      productSearchRef.current.focus({ preventScroll: true });
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
    if (filters.paymentStatus) {
      params.paymentStatus = filters.paymentStatus;
    }

    return params;
  }, [filters, pagination]);

  // Fetch purchase orders
  const {
    data: purchaseOrdersData,
    isLoading,
    error,
    refetch,
  } = useGetPurchaseOrdersQuery(queryParams, { refetchOnMountOrArgChange: true });

  const [fetchPurchaseOrdersForExport] = useLazyGetPurchaseOrdersQuery();

  const dispatch = useAppDispatch();
  const { suppliers, isLoading: suppliersLoading, isFetching: suppliersFetching } = useDebouncedSupplierSearch(
    supplierSearchTerm,
    { selectedSupplier }
  );
  const invalidateSuppliersList = () => {
    dispatch(suppliersApi.util.invalidateTags([{ type: 'Suppliers', id: 'LIST' }]));
  };

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

  // Fetch full order (with populated products) when view modal is open
  const viewOrderId = showViewModal && selectedOrder ? (selectedOrder.id || selectedOrder._id) : null;
  const { data: viewOrderData } = useGetPurchaseOrderQuery(viewOrderId, { skip: !viewOrderId });
  const viewOrder = viewOrderFresh || viewOrderData?.data?.purchaseOrder || viewOrderData?.purchaseOrder || selectedOrder;

  const {
    items: productsData,
    isLoading: lineProductSearchLoading,
    emptyMessage: lineProductEmptyMessage,
  } = useDebouncedPosProductSearch(productSearchTerm, { dropdownLimit: 120 });

  const {
    items: modalProductsData,
    isLoading: modalProductSearchLoading,
  } = useDebouncedPosProductSearch(modalProductSearchTerm, { dropdownLimit: 120 });

  const modalProductsLoading = modalProductSearchLoading;

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
  const [triggerGetPurchaseOrder] = useLazyGetPurchaseOrderQuery();
  const [updateItemsConfirmationMutation, { isLoading: updatingItemsConfirmation }] = useUpdatePurchaseOrderItemsConfirmationMutation();
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
    setHighlightedPoLineIndex(null);

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
        <div className="font-medium">{supplier.companyName || supplier.company_name || supplier.businessName || supplier.displayName || supplier.name || 'Unknown'}</div>
        {supplier.name && supplier.name !== (supplier.companyName || supplier.company_name || supplier.businessName || supplier.displayName) && (
          <div className="text-xs text-gray-500">{supplier.name}</div>
        )}
        <div className="text-sm text-gray-600">
          Outstanding Balance: {(Number(supplier.pendingBalance ?? supplier.outstandingBalance ?? 0) || 0).toFixed(2)}
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
    setSupplierSearchTerm(supplierObj?.companyName || supplierObj?.company_name || supplierObj?.businessName || supplierObj?.name || '');

    // Update tab title to show supplier name
    if (updateTabTitle && getActiveTab && supplierObj) {
      const activeTab = getActiveTab();
      if (activeTab) {
        updateTabTitle(activeTab.id, `PO - ${supplierObj.companyName || supplierObj.company_name || supplierObj.businessName || supplierObj.name || 'Unknown'}`);
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
            Stock:{' '}
            {hasDualUnit(product)
              ? formatStockDualLabel(inventory.currentStock || 0, product)
              : `${inventory.currentStock || 0} pcs`}
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
    const ppb = getPiecesPerBox(selectedProduct);
    const { boxes, pieces } = ppb ? piecesToBoxesAndPieces(quantity, ppb) : {};

    const newItem = {
      product: selectedProduct._id,
      productData: selectedProduct,
      quantity,
      ...(ppb && { boxes, pieces }),
      costPerUnit,
      totalCost
    };

    let addedLineIndex = null;
    setFormData(prev => {
      addedLineIndex = prev.items.length;
      return {
        ...prev,
        items: [...prev.items, newItem]
      };
    });
    if (addedLineIndex !== null && addedLineIndex >= 0) {
      setHighlightedPoLineIndex(addedLineIndex);
    }

    // Reset product selection
    setSelectedProduct(null);
    setProductSearchTerm('');
    setQuantity(1);
    setCustomCost('');
    setSearchKey(prev => prev + 1); // Force re-render of search components

    // Focus back to product search input
    setTimeout(() => {
      if (productSearchRef.current) {
        productSearchRef.current.focus({ preventScroll: true });
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
    const supplierOutstanding =
      Number(selectedSupplier?.pendingBalance ?? selectedSupplier?.outstandingBalance ?? 0) || 0;
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
        if (invalidateSuppliersList && typeof invalidateSuppliersList === 'function') {
          try {
            invalidateSuppliersList();
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
      items: formData.items.map(item => {
        const base = {
          product: item.product,
          quantity: Math.round(Number(item.quantity) || 1),
          costPerUnit: item.costPerUnit,
          totalCost: item.totalCost,
          receivedQuantity: item.receivedQuantity || 0,
          remainingQuantity: item.remainingQuantity || item.quantity
        };
        if (item.boxes != null || item.pieces != null) {
          base.boxes = item.boxes;
          base.pieces = item.pieces;
        }
        return base;
      })
    };

    updatePurchaseOrderMutation({ id: selectedOrder.id || selectedOrder._id, ...cleanedData })
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
        if (invalidateSuppliersList && typeof invalidateSuppliersList === 'function') {
          try {
            invalidateSuppliersList();
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

  const handleConfirm = async (order) => {
    const id = order?.id || order?._id;
    if (!id) return;
    if (
      !window.confirm(
        'Are you sure you want to confirm this purchase order? Inventory will be updated and a purchase invoice may be created.'
      )
    ) {
      return;
    }
    try {
      await confirmPurchaseOrderMutation(id).unwrap();
      toast.success('Purchase order confirmed successfully');
      refetch();

      if (!printBarcodeLabelsAfterPoConfirm) return;

      try {
        const res = await triggerGetPurchaseOrder(id).unwrap();
        const po = res?.data?.purchaseOrder || res?.purchaseOrder;
        const items = po?.items || [];
        const prods = buildReceiptLabelProductsFromLineItems(items);
        if (prods.length) {
          setReceiptLabelProducts(prods);
          setShowReceiptLabelPrinter(true);
        }
      } catch (labelErr) {
        console.warn('Could not load PO for barcode labels:', labelErr);
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to confirm purchase order');
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

  const handleUpdateItemsConfirmation = (itemUpdates, confirmAll, cancelAll) => {
    const order = viewOrder || selectedOrder;
    const id = order?.id ?? order?._id;
    if (!id) return;
    updateItemsConfirmationMutation({ id, itemUpdates, confirmAll, cancelAll })
      .unwrap()
      .then((response) => {
        toast.success('Items confirmation updated');
        if (response?.purchaseOrder) {
          setViewOrderFresh(response.purchaseOrder);
          setSelectedOrder(response.purchaseOrder);
        }
        setSelectedItemIndices([]);
        refetch();
      })
      .catch((error) => {
        toast.error(error?.data?.message || 'Failed to update items confirmation');
      });
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
    setViewOrderFresh(null);
    setSelectedItemIndices([]);
    setShowViewModal(true);
  };

  const formatPurchaseOrderForPrint = (order) => {
    if (!order) return null;
    const supplier = order.supplier || {};
    const supplierInfo = {
      ...order.supplierInfo,
      address: order.supplierInfo?.address && typeof order.supplierInfo.address === 'string'
        ? order.supplierInfo.address
        : formatAddressForDisplay(supplier) || ''
    };
    const items = (order.items || []).map((item) => {
      const product = item.product || item.productData || {};
      const productName = typeof product === 'object' && product !== null
        ? (product.name || product.displayName || product.display_name || product.variantName || product.variant_name)
        : getProductDisplayName(product);
      const name = productName || 'Product';
      const qty = Number(item.quantity) || 0;
      const unitCost = Number(item.costPerUnit ?? item.unitCost ?? item.cost ?? 0) || 0;
      const totalCost = Number(item.totalCost) || qty * unitCost;
      const barcode =
        typeof product === 'object' && product !== null
          ? (product.barcode || product.barcodeNumber || '').toString().trim()
          : '';
      const sku =
        typeof product === 'object' && product !== null
          ? (product.sku || product.skuCode || '').toString().trim()
          : '';
      return {
        quantity: qty,
        unitPrice: unitCost,
        unitCost,
        costPerUnit: unitCost,
        total: totalCost,
        product: { name, ...(barcode ? { barcode } : {}), ...(sku ? { sku } : {}) },
        name
      };
    });
    const subtotal = order.subtotal ?? items.reduce((sum, i) => sum + (i.quantity * (i.unitPrice || 0)), 0);
    const tax = order.tax ?? 0;
    const total = order.total ?? subtotal + tax;
    return {
      ...order,
      supplier,
      supplierInfo,
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

  const poTableScrollRef = useRef(null);
  const virtualizePoRows = purchaseOrders.length > 35;
  const poRowVirtualizer = useVirtualizer({
    count: purchaseOrders.length,
    getScrollElement: () => poTableScrollRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  const paginationInfo = purchaseOrdersData?.data?.pagination || purchaseOrdersData?.pagination || {};
  const { subtotal, tax, total, supplierOutstanding, totalPayables } = calculateTotals();

  const purchaseOrdersExportParams = useMemo(() => {
    const params = { all: true };
    if (filters.fromDate) params.dateFrom = filters.fromDate;
    if (filters.toDate) params.dateTo = filters.toDate;
    if (filters.poNumber) params.search = filters.poNumber;
    if (filters.status) params.status = filters.status;
    if (filters.supplier) params.supplier = filters.supplier;
    if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
    return params;
  }, [filters]);

  const getExportData = useCallback(async () => {
    try {
      const res = await fetchPurchaseOrdersForExport(purchaseOrdersExportParams).unwrap();
      const allRows = res?.purchaseOrders ?? res?.data?.purchaseOrders ?? [];
      return {
        title: 'Purchase Orders Report',
        filename: `Purchase_Orders_${filters.fromDate}_to_${filters.toDate}.xlsx`,
        company: {
          name: companySettings?.companyName || 'ZARYAB IMPEX',
          address: companySettings?.address || companySettings?.billingAddress || '',
          contact: `${companySettings?.contactNumber || ''} ${companySettings?.email ? '| ' + companySettings.email : ''}`.trim()
        },
        columns: [
          { header: 'S.No', key: 'sno', width: 8, type: 'number' },
          { header: 'PO #', key: 'poNumber', width: 22 },
          { header: 'Supplier', key: 'supplierName', width: 35 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Status', key: 'status', width: 18 },
          { header: 'Total', key: 'total', width: 14, type: 'currency' }
        ],
        data: allRows.map((order, i) => ({
          sno: i + 1,
          poNumber: order.purchase_order_number || order.poNumber || order.po_number || '—',
          supplierName: safeRender(order.supplier) || 'Unknown',
          date: formatDate(order.purchase_date || order.order_date || order.created_at || order.createdAt),
          status: String(order?.status || '—').replace(/_/g, ' '),
          total: Number(order.total || 0)
        })),
        summary: {
          rows: [
            {
              label: 'GRAND TOTAL:',
              poNumber: `${allRows.length} orders`,
              total: allRows.reduce((sum, o) => sum + Number(o.total || 0), 0)
            }
          ]
        }
      };
    } catch (err) {
      const msg = err?.data?.message || err?.message || 'Could not load purchase orders for export';
      toast.error(msg);
      return null;
    }
  }, [fetchPurchaseOrdersForExport, purchaseOrdersExportParams, filters.fromDate, filters.toDate, companySettings]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm sm:text-base text-gray-600">Process purchase order transactions</p>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">

          <Button
            onClick={resetForm}
            variant="default"
            size="default"
            className="flex-1 sm:flex-initial"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">New Purchase Order</span>
            <span className="sm:hidden">New PO</span>
          </Button>
        </div>
      </div>

      {/* Supplier Selection and Information Row */}
      <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-12">
        {/* Supplier Selection */}
        <div className="w-full md:w-[750px] flex-shrink-0">
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
            loading={suppliersLoading || suppliersFetching}
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
                  <p className="font-medium">{selectedSupplier.companyName || selectedSupplier.company_name || selectedSupplier.businessName || selectedSupplier.business_name || selectedSupplier.displayName || selectedSupplier.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-600 capitalize">
                    {selectedSupplier.businessType || 'Business'} • {selectedSupplier.reliability || 'Standard'}
                  </p>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">Outstanding Balance:</span>
                      <span className={`text-sm font-medium ${(Number(selectedSupplier.pendingBalance ?? selectedSupplier.outstandingBalance ?? 0) || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {(Number(selectedSupplier.pendingBalance ?? selectedSupplier.outstandingBalance ?? 0) || 0).toFixed(2)}
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
                    loading={lineProductSearchLoading}
                    emptyMessage={lineProductEmptyMessage}
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
                    <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-2 rounded border border-gray-200 block text-center min-h-[2.5rem] flex flex-col items-center justify-center gap-0.5 leading-tight">
                      {selectedProduct ? (
                        hasDualUnit(selectedProduct) ? (
                          <>
                            <span className="text-xs">{formatStockDualLabel(selectedProduct.inventory?.currentStock || 0, selectedProduct)}</span>
                            <span className="text-[10px] font-normal text-gray-500">available</span>
                          </>
                        ) : (
                          <span>{selectedProduct.inventory?.currentStock || 0} pcs</span>
                        )
                      ) : (
                        '0'
                      )}
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

                  {/* Quantity — full width on mobile when dual (box + pcs + total) */}
                  <div className={hasDualUnit(selectedProduct) ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <DualUnitQuantityInput
                      product={selectedProduct}
                      quantity={quantity}
                      onChange={(q) => setQuantity(q)}
                      showBoxInput={dualUnitShowBoxInputEnabled}
                      showPiecesInput={dualUnitShowPiecesInputEnabled}
                      onKeyDown={handleInputKeyDown}
                      inputClassName="text-center h-10 w-full border border-gray-300 rounded px-2"
                      compact={hasDualUnit(selectedProduct)}
                    />
                  </div>

                  {/* Cost */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Cost
                    </label>
                    <Input
                      type="number"
                      step="1"
                      value={customCost}
                      onChange={(e) => setCustomCost(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={handleInputKeyDown}
                      className="text-center h-10 w-full"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                {/* Add Button - Full width on mobile */}
                <div>
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    variant="default"
                    className="w-full flex items-center justify-center px-4 py-2.5 h-11"
                    disabled={!selectedProduct}
                    title="Add to cart (or press Enter in Quantity/Cost fields - focus returns to search)"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Desktop Layout — column spans sum to 12; wider qty when dual (box + pcs + total) */}
              <div className="hidden md:grid grid-cols-12 gap-x-3 gap-y-3 items-start">
                {/* Product Search */}
                <div className={hasDualUnit(selectedProduct) ? 'col-span-5 min-w-0' : 'col-span-7 min-w-0'}>
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
                    loading={lineProductSearchLoading}
                    emptyMessage={lineProductEmptyMessage}
                    value={productSearchTerm}
                  />
                </div>

                {/* Stock - 1 column */}
                <div className="col-span-1 min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock
                  </label>
                  <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1.5 rounded border border-gray-200 block text-center min-h-[3rem] flex flex-col items-center justify-center gap-0.5 leading-snug">
                    {selectedProduct ? (
                      hasDualUnit(selectedProduct) ? (
                        <>
                          <span className="text-xs">{formatStockDualLabel(selectedProduct.inventory?.currentStock || 0, selectedProduct)}</span>
                          <span className="text-[10px] font-normal text-gray-500">available</span>
                        </>
                      ) : (
                        <span>{selectedProduct.inventory?.currentStock || 0} pcs</span>
                      )
                    ) : (
                      '0'
                    )}
                  </span>
                </div>

                {/* Quantity — col-span-3 when dual so Box + Pcs + Total fit (matches compact dual UI) */}
                <div className={hasDualUnit(selectedProduct) ? 'col-span-3 min-w-0' : 'col-span-1 min-w-0'}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <DualUnitQuantityInput
                    product={selectedProduct}
                    quantity={quantity}
                    onChange={(q) => setQuantity(q)}
                    showBoxInput={dualUnitShowBoxInputEnabled}
                    showPiecesInput={dualUnitShowPiecesInputEnabled}
                    onKeyDown={handleInputKeyDown}
                    inputClassName="text-center h-10 border border-gray-300 rounded px-2"
                    compact={hasDualUnit(selectedProduct)}
                  />
                </div>

                {/* Cost - 1 column */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cost
                  </label>
                  <Input
                    type="number"
                    step="1"
                    value={customCost}
                    onChange={(e) => setCustomCost(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={handleInputKeyDown}
                    className="text-center h-10"
                    placeholder="0 (Enter to add & focus search)"
                    required
                  />
                </div>

                {/* Amount - 1 column */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount
                  </label>
                  <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1.5 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
                    {selectedProduct ? Math.round(quantity * parseFloat(customCost || 0)) : 0}
                  </span>
                </div>

                {/* Add Button - 1 column */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 invisible select-none" aria-hidden="true">
                    Add
                  </label>
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    variant="default"
                    className="w-full flex items-center justify-center px-3 h-10"
                    disabled={!selectedProduct}
                    title="Add to cart (or press Enter in Quantity/Cost fields - focus returns to search)"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
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
                <Button
                  type="button"
                  onClick={handleSortCartItems}
                  variant="secondary"
                  size="sm"
                  className="flex items-center space-x-2"
                  title="Sort products alphabetically"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Sort A-Z</span>
                  <span className="sm:hidden">Sort</span>
                </Button>
              </div>

              {/* Desktop Table Header — 1+4+1+3+1+1+1 = 12 */}
              <div className="hidden md:grid grid-cols-12 gap-4 items-center pb-2 border-b border-gray-300 mb-2">
                <div className="col-span-1 flex justify-center">
                  <span className="text-xs font-semibold text-gray-600 uppercase w-1/2 min-w-[56px] text-center">S.NO</span>
                </div>
                <div className="col-span-4">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Product</span>
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Stock</span>
                </div>
                <div className="col-span-3">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Qty</span>
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Cost</span>
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Total</span>
                </div>
                <div className="col-span-1 flex justify-center">
                  <span className="text-xs font-semibold text-gray-600 uppercase w-1/2 min-w-[56px] text-center">Action</span>
                </div>
              </div>

              <div
                ref={poCartScrollRef}
                className={
                  poCartNeedsInnerScroll
                    ? 'max-h-[min(70vh,860px)] overflow-y-auto -mx-1 px-1 [scrollbar-gutter:stable]'
                    : 'overflow-visible -mx-1 px-1'
                }
              >
                {formData.items.map((item, index) => {
                  const product = item.productData || item.product; // Use stored product/variant data or fallback to product
                  const displayName = product?.isVariant
                    ? (product?.displayName || product?.variantName || product?.name || 'Unknown Variant')
                    : (product?.name || 'Unknown Product');
                  const totalPrice = item.costPerUnit * item.quantity;
                  const isLowStock = product?.inventory?.currentStock <= (product?.inventory?.reorderPoint || 0);
                  const serialHighlight = highlightedPoLineIndex === index;

                  return (
                    <div
                      key={index}
                      ref={(node) => {
                        if (node) poCartLineElRefs.current.set(index, node);
                        else poCartLineElRefs.current.delete(index);
                      }}
                    >
                      {/* Mobile Card View */}
                      <div className="md:hidden mb-4 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {product?.imageUrl && showProductImages && (
                              <div
                                className="h-10 w-10 flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200 cursor-pointer hover:border-primary-500 transition-colors group relative"
                                onClick={() => setPreviewImageProduct(product)}
                                title="Click to view full size"
                              >
                                <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                                  <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors duration-300 ${serialHighlight
                                      ? 'bg-green-100 text-green-800 border border-green-400 ring-2 ring-green-300/80'
                                      : 'text-gray-500 bg-gray-100'
                                    }`}
                                >
                                  #{index + 1}
                                </span>
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
                              {(() => {
                                const b = (product?.barcode ?? '').toString().trim();
                                if (b) return <span className="text-xs text-gray-600 font-mono block mt-0.5">Barcode: {b}</span>;
                                const s = (product?.sku ?? '').toString().trim();
                                if (s) return <span className="text-xs text-gray-600 font-mono block mt-0.5">SKU: {s}</span>;
                                return null;
                              })()}
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {isLowStock && <span className="text-yellow-600 text-xs">⚠️ Low</span>}
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleRemoveItem(index)}
                            variant="destructive"
                            size="sm"
                            className="h-8 w-8 p-0 flex-shrink-0 ml-2"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Stock</label>
                            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center leading-tight">
                              {hasDualUnit(product)
                                ? formatStockDualLabel(product?.inventory?.currentStock || 0, product)
                                : (product?.inventory?.currentStock || 0)}
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>
                            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center">
                              {Math.round(totalPrice)}
                            </span>
                          </div>
                          <div className={hasDualUnit(product) ? 'col-span-2' : ''}>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                            {hasDualUnit(product) ? (
                              <DualUnitQuantityInput
                                product={product}
                                quantity={item.quantity}
                                showBoxInput={dualUnitShowBoxInputEnabled}
                                showPiecesInput={dualUnitShowPiecesInputEnabled}
                                onChange={(newQuantity, dual) => {
                                  if (newQuantity <= 0) {
                                    handleRemoveItem(index);
                                    return;
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
                                        totalCost: newQuantity * itm.costPerUnit
                                      } : itm
                                    )
                                  }));
                                }}
                                min={1}
                                inputClassName="text-center h-8 w-full border border-gray-300 rounded px-2"
                                compact={hasDualUnit(product)}
                              />
                            ) : (
                              <Input
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
                                onFocus={(e) => e.target.select()}
                                className="text-center h-8 w-full"
                                min="1"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Cost</label>
                            <Input
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
                              onFocus={(e) => e.target.select()}
                              className="text-center h-8 w-full"
                              min="0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Desktop Table Row */}
                      <div className={`hidden md:block py-1 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="grid grid-cols-12 gap-4 items-center">
                          {/* Serial Number - 1 column (new field) */}
                          <div className="col-span-1 flex justify-center">
                            <span
                              className={`text-sm font-medium px-0.5 py-1 rounded border block text-center h-8 w-1/2 min-w-[56px] flex items-center justify-center transition-colors duration-300 ${serialHighlight
                                  ? 'bg-green-100 text-green-800 border-green-400 ring-2 ring-green-300/80'
                                  : 'text-gray-700 bg-gray-50 border-gray-200'
                                }`}
                            >
                              {index + 1}
                            </span>
                          </div>

                          {/* Product Name — col-span-4 so Qty can use 3 cols for dual units */}
                          <div className="col-span-4 flex items-center gap-2 min-h-8 min-w-0">
                            {product?.imageUrl && showProductImages && (
                              <div
                                className="h-8 w-8 flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200 cursor-pointer hover:border-primary-500 transition-colors group relative"
                                onClick={() => setPreviewImageProduct(product)}
                                title="Click to view full size"
                              >
                                <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                                  <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
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
                          <div className="col-span-1 min-w-0">
                            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center min-h-8 flex items-center justify-center leading-tight text-xs">
                              {hasDualUnit(product)
                                ? formatStockDualLabel(product?.inventory?.currentStock || 0, product)
                                : (product?.inventory?.currentStock || 0)}
                            </span>
                          </div>

                          {/* Quantity — 3 cols so Box + Pcs + Total fit */}
                          <div className="col-span-3 min-w-0">
                            <DualUnitQuantityInput
                              product={product}
                              quantity={item.quantity}
                              showBoxInput={dualUnitShowBoxInputEnabled}
                              showPiecesInput={dualUnitShowPiecesInputEnabled}
                              onChange={(newQuantity, dual) => {
                                if (newQuantity <= 0) {
                                  handleRemoveItem(index);
                                  return;
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
                                      totalCost: newQuantity * itm.costPerUnit
                                    } : itm
                                  )
                                }));
                              }}
                              min={1}
                              inputClassName="text-center h-8 border border-gray-300 rounded px-2"
                              compact={hasDualUnit(product)}
                            />
                          </div>

                          {/* Cost - 1 column (matches Product Selection Cost) */}
                          <div className="col-span-1">
                            <Input
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
                              onFocus={(e) => e.target.select()}
                              className="text-center h-8"
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
                          <div className="col-span-1 flex justify-center">
                            <Button
                              onClick={() => handleRemoveItem(index)}
                              variant="destructive"
                              size="sm"
                              className="h-8 w-1/2 min-w-[56px]"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Purchase Order Details - Create Mode */}
      {formData.items.length > 0 && !showEditModal && (
        <OrderCheckoutCard>
          <OrderDetailsSection
            detailsTitle="Purchase Order Details"
            showDetails={showPurchaseOrderDetailsFields}
            onShowDetailsChange={setShowPurchaseOrderDetailsFields}
            checkboxId="showPurchaseOrderDetailsFields"
            headerClassName="mb-0"
          >
            {showPurchaseOrderDetailsFields && (
              <>
                {/* Mobile Layout - Stacked */}
                <div className="md:hidden space-y-3">
                  {/* Invoice Number */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Invoice Number
                    </label>
                    <Input
                      type="text"
                      value={formData.invoiceNumber || "Auto-generated"}
                      onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      className="h-10 text-sm w-full"
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
                      <Input
                        type="date"
                        value={formData.expectedDelivery}
                        onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                        className="h-10 text-sm w-full pr-8"
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
                    <Input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="h-10 text-sm w-full"
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
                    <Input
                      type="text"
                      value={formData.invoiceNumber || "Auto-generated"}
                      onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      className="h-8 text-sm"
                      placeholder="Auto-generated"
                      disabled
                    />
                  </div>

                  {/* Expected Delivery */}
                  <div className="flex flex-col w-48">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Expected Delivery
                    </label>
                    <Input
                      type="date"
                      value={formData.expectedDelivery}
                      onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                      className="h-8 text-sm"
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
                    <Input
                      type="text"
                      autoComplete="off"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="h-8 text-sm"
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
              </>
            )}
          </OrderDetailsSection>

          <OrderSummaryBar />
          <OrderSummaryContent>
            <div className="mb-6 space-y-3">
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

            {/* Action Buttons */}
            <OrderCheckoutActions className="mt-6 border-0 pt-0">
              {formData.items.length > 0 && !showEditModal && (
                <Button
                  onClick={resetForm}
                  variant="secondary"
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Cart
                </Button>
              )}
              {formData.items.length > 0 && (
                <Button
                  onClick={() => {
                    // Create temporary order data for print preview
                    const tempOrder = {
                      poNumber: `PO-${Date.now()}`,
                      supplier: selectedSupplier,
                      items: formData.items.map(item => {
                        const product =
                          item.productData ||
                          (typeof item.product === 'object' ? item.product : null);
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
                  variant="secondary"
                  className="flex-1"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Print Preview
                </Button>
              )}
              <Button
                onClick={handleCreate}
                disabled={creating || formData.items.length === 0}
                variant="default"
                size="lg"
                className="flex-2"
              >
                <Save className="h-4 w-4 mr-2" />
                {creating ? 'Creating...' : 'Create Purchase Order'}
              </Button>
            </OrderCheckoutActions>
          </OrderSummaryContent>
        </OrderCheckoutCard>
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
              <OrderCheckoutCard className="mb-6 ml-0 mt-0 max-w-none">
                <div className="border-b border-blue-200/60 bg-white/40 px-5 py-4 sm:px-7">
                  <ShowDetailsSectionHeader
                    title="Edit Purchase Order Details"
                    showDetails={showPurchaseOrderDetailsFields}
                    onShowDetailsChange={setShowPurchaseOrderDetailsFields}
                    checkboxId="showPurchaseOrderDetailsFieldsEdit"
                    titleClassName="text-lg"
                  />
                </div>
                <div className="px-5 py-4 sm:px-7">
                  {/* Supplier Selection */}
                  <div className="mb-4">
                    <div className="flex flex-col">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Selection</label>
                      <input
                        type="text"
                        autoComplete="off"
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

                  {showPurchaseOrderDetailsFields && (
                    <>
                      {/* Single Row Layout for Purchase Order Details */}
                      <div className="flex flex-nowrap gap-3 items-end justify-end">
                        {/* Invoice Number */}
                        <div className="flex flex-col w-44">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Invoice Number
                          </label>
                          <Input
                            type="text"
                            value={formData.invoiceNumber || "Auto-generated"}
                            onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                            className="h-8 text-sm"
                            placeholder="Auto-generated"
                            disabled
                          />
                        </div>

                        {/* Expected Delivery */}
                        <div className="flex flex-col w-48">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Expected Delivery
                          </label>
                          <Input
                            type="date"
                            autoComplete="off"
                            value={formData.expectedDelivery}
                            onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                            className="h-8 text-sm"
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
                            <Textarea
                              value={formData.notes}
                              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                              className="h-16 text-sm resize-none"
                              placeholder="Add any notes or comments..."
                            />
                          </div>

                          {/* Terms Column */}
                          <div className="flex flex-col">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Terms & Conditions
                            </label>
                            <Textarea
                              value={formData.terms}
                              onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                              className="h-16 text-sm resize-none"
                              placeholder="Add terms and conditions..."
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
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
                          autoComplete="off"
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
                                    Stock:{' '}
                                    {hasDualUnit(product)
                                      ? formatStockDualLabel(product.inventory?.currentStock || 0, product)
                                      : `${product.inventory?.currentStock || 0} pcs`}{' '}
                                    | Cost: {product.pricing?.cost ?? product.pricing?.costPrice ?? 0}
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
                          autoComplete="off"
                          value={editProductQuantity}
                          onChange={(e) => setEditProductQuantity(parseInt(e.target.value) || 1)}
                          onFocus={(e) => e.target.select()}
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
                          autoComplete="off"
                          value={editProductCost}
                          onChange={(e) => setEditProductCost(parseFloat(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
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
                              <DualUnitQuantityInput
                                product={item.productData}
                                quantity={item.quantity}
                                showBoxInput={dualUnitShowBoxInputEnabled}
                                showPiecesInput={dualUnitShowPiecesInputEnabled}
                                onChange={(newQuantity) => {
                                  const newItems = [...formData.items];
                                  const ppb = getPiecesPerBox(item.productData);
                                  const { boxes, pieces } = ppb ? piecesToBoxesAndPieces(newQuantity, ppb) : {};
                                  newItems[index].quantity = newQuantity;
                                  if (ppb) { newItems[index].boxes = boxes; newItems[index].pieces = pieces; }
                                  newItems[index].totalCost = newQuantity * newItems[index].costPerUnit;
                                  setFormData(prev => ({ ...prev, items: newItems }));
                                }}
                                min={1}
                                inputClassName="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                compact={true}
                              />
                            </div>

                            {/* Cost Field */}
                            <div className="flex items-center space-x-1">
                              <label className="text-xs text-gray-600">× Cost:</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                autoComplete="off"
                                value={item.costPerUnit}
                                onChange={(e) => {
                                  const newItems = [...formData.items];
                                  const newCost = parseFloat(e.target.value) || 0;
                                  newItems[index].costPerUnit = newCost;
                                  newItems[index].totalCost = newItems[index].quantity * newCost;
                                  setFormData(prev => ({ ...prev, items: newItems }));
                                }}
                                onFocus={(e) => e.target.select()}
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
                <div className="border-t border-blue-200 px-6 py-4">
                  <h4 className="mb-3 text-sm font-medium text-gray-900">Order Items Summary</h4>
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
              </OrderCheckoutCard>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
            {/* Date Range - spans more columns to prevent overlap */}
            <div className="sm:col-span-2 lg:col-span-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
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
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PO Number
              </label>
              <Input
                type="text"
                autoComplete="off"
                placeholder="Contains..."
                value={filters.poNumber}
                onChange={(e) => handleFilterChange('poNumber', e.target.value)}
                className="h-[42px] w-full"
              />
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input h-[42px] w-full"
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
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier
              </label>
              <select
                value={filters.supplier}
                onChange={(e) => handleFilterChange('supplier', e.target.value)}
                className="input h-[42px] w-full"
              >
                <option value="">All Suppliers</option>
                {suppliers?.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>
                    {supplier.companyName || supplier.name || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-12 flex items-start gap-2 pt-2 border-t border-gray-100 mt-1">
              <input
                type="checkbox"
                id="po-offer-barcode-labels"
                checked={printBarcodeLabelsAfterPoConfirm}
                onChange={(e) => setPrintBarcodeLabelsAfterPoConfirm(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-1"
              />
              <label htmlFor="po-offer-barcode-labels" className="text-sm text-gray-700 cursor-pointer">
                After confirming a draft PO (receipt), open barcode label printer — copies default to line quantity (barcode or SKU per product)
              </label>
            </div>

            {/* Payment Status Filter */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment
              </label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                className="input h-[42px] w-full"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            {/* Search Button */}
            <div className="sm:col-span-2 lg:col-span-2 flex items-end">
              <Button
                onClick={() => refetch()}
                variant="default"
                className="w-full flex items-center justify-center space-x-2 h-[42px]"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="card-header">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 leading-tight">
              Purchase Orders
              <span className="block sm:inline sm:ml-2 text-xs sm:text-sm font-normal text-gray-500 mt-1 sm:mt-0">
                From: {formatDate(filters.fromDate)} To: {formatDate(filters.toDate)}
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                <span className="font-semibold text-gray-700">
                  {paginationInfo.total ?? paginationInfo.totalItems ?? purchaseOrders.length ?? 0}
                </span>{' '}
                records
              </span>
              <div className="flex items-center gap-2">
                <ExcelExportButton getData={getExportData} label="Export" />
                <PdfExportButton getData={getExportData} label="PDF" />
                <button
                  onClick={() => refetch()}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
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
            <>
              <div
                ref={poTableScrollRef}
                className={`overflow-x-auto ${virtualizePoRows ? 'max-h-[min(70vh,560px)] overflow-y-auto' : ''}`}
              >
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
                    {(() => {
                      const vItems = poRowVirtualizer.getVirtualItems();
                      const totalH = poRowVirtualizer.getTotalSize();
                      const padTop = vItems.length ? vItems[0].start : 0;
                      const padBottom = vItems.length ? totalH - vItems[vItems.length - 1].end : 0;
                      return (
                        <>
                          {padTop > 0 ? (
                            <tr aria-hidden className="pointer-events-none">
                              <td colSpan={6} className="p-0 border-0" style={{ height: padTop }} />
                            </tr>
                          ) : null}
                          {vItems.map((vr) => {
                            const order = purchaseOrders[vr.index];
                            const index = vr.index;
                            return (
                              <tr key={vr.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: vr.size }}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {formatDate(order.purchase_date || order.order_date || order.created_at || order.createdAt)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {order.purchase_order_number || order.poNumber || '-'}
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
                                          onClick={() => handleConfirm(order)}
                                          className="text-green-600 hover:text-green-900"
                                          title="Confirm Order"
                                        >
                                          <CheckCircle className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => handleCancel(order.id || order._id)}
                                          className="text-red-600 hover:text-red-900"
                                          title="Cancel Order"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </button>
                                      </>
                                    )}
                                    {(order.status === 'draft' || order.status === 'cancelled' || order.status === 'confirmed' || order.status === 'partially_received' || !order.supplier) && (
                                      <button
                                        onClick={() => handleDelete(order.id || order._id)}
                                        className="text-red-600 hover:text-red-900"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {padBottom > 0 ? (
                            <tr aria-hidden className="pointer-events-none">
                              <td colSpan={6} className="p-0 border-0" style={{ height: padBottom }} />
                            </tr>
                          ) : null}
                        </>
                      );
                    })()}
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
      {showViewModal && (viewOrder || selectedOrder) && (
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
                    setViewOrderFresh(null);
                    setSelectedItemIndices([]);
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
                    <p><span className="font-medium">PO Number:</span> {viewOrder.purchase_order_number || viewOrder.poNumber || '-'}</p>
                    <p><span className="font-medium">Date:</span> {formatDate(viewOrder.purchase_date || viewOrder.order_date || viewOrder.created_at || viewOrder.createdAt)}</p>
                    <p><span className="font-medium">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${viewOrder.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                        viewOrder.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          viewOrder.status === 'partially_received' ? 'bg-yellow-100 text-yellow-800' :
                            viewOrder.status === 'fully_received' ? 'bg-green-100 text-green-800' :
                              viewOrder.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                        }`}>
                        {viewOrder.status === 'draft' ? 'Pending' : (viewOrder.status || '').replace('_', ' ')}
                      </span>
                    </p>
                    {itemWiseConfirmationEnabled && (
                      <p><span className="font-medium">Confirmation:</span>
                        <OrderConfirmationStatusBadge order={viewOrder} />
                      </p>
                    )}
                    {viewOrder.expectedDelivery && (
                      <p><span className="font-medium">Expected Delivery:</span> {formatDate(viewOrder.expectedDelivery)}</p>
                    )}
                  </div>
                </div>
                <div>
                  {/* Empty middle column for spacing */}
                </div>
                <div className="text-right">
                  <h5 className="font-semibold text-gray-900 mb-2">Supplier Details</h5>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Company:</span> {safeRender(viewOrder.supplier) || 'Unknown'}</p>
                    {viewOrder.supplier?.email && (
                      <p><span className="font-medium">Email:</span> {safeRender(viewOrder.supplier.email)}</p>
                    )}
                    {viewOrder.supplier?.phone && (
                      <p><span className="font-medium">Phone:</span> {safeRender(viewOrder.supplier.phone)}</p>
                    )}
                    <p><span className="font-medium">Address:</span> {formatAddressForDisplay(viewOrder.supplier) || '—'}</p>
                    {(viewOrder.supplier?.contact_person || viewOrder.supplier?.contactPerson) && (
                      <p><span className="font-medium">Contact:</span> {safeRender(viewOrder.supplier.contact_person || viewOrder.supplier.contactPerson)}</p>
                    )}
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <p className="font-semibold text-red-600">
                        <span className="font-medium">Outstanding Balance:</span> {Math.round((viewOrder.supplier?.pendingBalance ?? viewOrder.supplier?.currentBalance) || 0)}
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
                    items={viewOrder.items}
                    canEdit={viewOrder.status !== 'cancelled'}
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
                        {itemWiseConfirmationEnabled && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Confirmation
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viewOrder.items && viewOrder.items.map((item, index) => (
                        <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${(item.confirmationStatus ?? item.confirmation_status) === 'cancelled' ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                            <div>
                              <div className="font-medium">
                                {typeof item.product === 'object' && item.product !== null
                                  ? (item.product.name || item.product.displayName || item.product.display_name || item.product.variantName || item.product.variant_name || 'Unknown Product')
                                  : (getProductDisplayName(item.product) || item.productData?.name || 'Unknown Product')}
                              </div>
                              {item.product?.description && typeof item.product === 'object' && (
                                <div className="text-gray-500 text-xs">{safeRender(item.product.description)}</div>
                              )}
                              {(() => {
                                const p =
                                  typeof item.product === 'object' && item.product !== null
                                    ? item.product
                                    : item.productData || {};
                                const b = (p.barcode ?? '').toString().trim();
                                if (b) return <div className="text-gray-600 text-xs font-mono mt-0.5">Barcode: {b}</div>;
                                const s = (p.sku ?? '').toString().trim();
                                if (s) return <div className="text-gray-600 text-xs font-mono mt-0.5">SKU: {s}</div>;
                                return null;
                              })()}
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
                          {itemWiseConfirmationEnabled && (
                            <td className="px-4 py-3 text-sm border-b border-gray-200">
                              <OrderItemConfirmationCell
                                item={item}
                                itemIndex={index}
                                status={getItemConfirmationStatus(item)}
                                canEdit={viewOrder.status !== 'cancelled'}
                                selected={selectedItemIndices.includes(index)}
                                onToggleSelect={(idx) => setSelectedItemIndices((prev) => prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx])}
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
                      <span className="font-medium">{Math.round(Number(viewOrder.subtotal) || 0)}</span>
                    </div>
                    {viewOrder.tax && viewOrder.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax:</span>
                        <span className="font-medium">{Math.round(Number(viewOrder.tax))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PO Total:</span>
                      <span className="font-medium">{Math.round(Number(viewOrder.total) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Previous Outstanding:</span>
                      <span className="font-medium text-red-600">{Math.round((Number((viewOrder.supplier?.pendingBalance ?? viewOrder.supplier?.currentBalance)) || 0))}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total Payables:</span>
                      <span className="text-red-600">{Math.round((Number(viewOrder.total) || 0) + (Number((viewOrder.supplier?.pendingBalance ?? viewOrder.supplier?.currentBalance)) || 0))}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {viewOrder.notes && (
                <div className="mb-6">
                  <h5 className="font-semibold text-gray-900 mb-2">Notes</h5>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                    {safeRender(viewOrder.notes)}
                  </p>
                </div>
              )}

              {/* Terms */}
              {viewOrder.terms && (
                <div className="mb-6">
                  <h5 className="font-semibold text-gray-900 mb-2">Terms & Conditions</h5>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                    {safeRender(viewOrder.terms)}
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-xs text-gray-500">
                  Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                </div>
                <div className="flex space-x-3">
                  <Button
                    onClick={() => handlePrint(viewOrder)}
                    variant="default"
                    className="flex items-center"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button
                    onClick={() => {
                      setShowViewModal(false);
                      setSelectedOrder(null);
                      setViewOrderFresh(null);
                      setSelectedItemIndices([]);
                    }}
                    variant="secondary"
                  >
                    Close
                  </Button>
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

      {showReceiptLabelPrinter && (
        <BarcodeLabelPrinter
          products={receiptLabelProducts}
          quantityMode
          modalTitle="Print labels — purchase order receipt"
          onClose={() => {
            setShowReceiptLabelPrinter(false);
            setReceiptLabelProducts([]);
          }}
        />
      )}

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

    </div>
  );
};

