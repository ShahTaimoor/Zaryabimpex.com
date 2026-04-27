import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Building,
  Truck,
  Receipt,
  Printer,
  Eye,
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  ArrowUpDown,
  Download,
  Camera
} from 'lucide-react';
import BaseModal from '../components/BaseModal';
import {
  useGetSupplierQuery,
  useLazySearchSuppliersQuery,
} from '../store/services/suppliersApi';
import {
  useCreatePurchaseInvoiceMutation,
  useUpdatePurchaseInvoiceMutation,

} from '../store/services/purchaseInvoicesApi';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { useGetUnifiedBalanceQuery } from '../store/services/accountingApi';
import { toast } from 'sonner';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import PrintModal, { DirectPrintInvoice } from '../components/PrintModal';
import BarcodeLabelPrinter from '../components/BarcodeLabelPrinter';
import { buildReceiptLabelProductsFromLineItems } from '../utils/receiptLabelUtils';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../components/ComponentRegistry';
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
  OrderInsetPanel,
  OrderCheckoutActions,
} from '../components/order/OrderCheckoutLayout';
import { ProductSelectionCartSection } from '../components/order/ProductSelectionCartSection';
import { CartItemsTableSection } from '../components/order/CartItemsTableSection';
import { CartTableHeader } from '../components/order/CartTableHeader';
import { DualUnitQuantityInput } from '../components/DualUnitQuantityInput';
import {
  hasDualUnit,
  getPiecesPerBox,
  piecesToBoxesAndPieces,
  formatStockDualLabel,
  computeTotalPieces,
} from '../utils/dualUnitUtils';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { getLocalDateString } from '../utils/dateUtils';


import AsyncErrorBoundary from '../components/AsyncErrorBoundary';
import { useResponsive } from '../components/ResponsiveContainer';
import { ProductSearch as SharedSalesProductSearch } from '../components/sales/ProductSearch';

const PurchaseItem = ({
  item,
  index,
  onUpdateQuantity,
  onUpdateCost,
  onRemove,
  onUpdateCartBoxCount,
  showProductImages,
  setPreviewImageProduct,
  highlightSerial = false,
}) => {
  const { companyInfo: companySettings } = useCompanyInfo();
  const dualUnitShowBoxInputEnabled = companySettings.orderSettings?.dualUnitShowBoxInput !== false;
  const dualUnitShowPiecesInputEnabled = companySettings.orderSettings?.dualUnitShowPiecesInput !== false;
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
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{index + 1}</span>
                {isLowStock && <span className="text-yellow-600 text-xs">⚠️ Low Stock</span>}
              </div>
              <p className="font-medium text-sm truncate">{displayName}</p>
              {product.isVariant && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {product.variantType}: {product.variantValue}
                </p>
              )}
              {(() => {
                const b = (product.barcode ?? '').toString().trim();
                if (b) return <p className="text-xs text-gray-600 font-mono mt-0.5">Barcode: {b}</p>;
                const s = (product.sku ?? '').toString().trim();
                if (s) return <p className="text-xs text-gray-600 font-mono mt-0.5">SKU: {s}</p>;
                return null;
              })()}
            </div>
          </div>
          <Button
            onClick={() => onRemove(item.product?._id)}
            variant="destructive"
            size="sm"
            className="p-1 flex-shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stock</label>
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center leading-tight">
              {hasDualUnit(product)
                ? formatStockDualLabel(currentStock, product)
                : currentStock}
            </span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Total</label>
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center">
              {totalPrice.toFixed(2)}
            </span>
          </div>
          <div className={hasDualUnit(product) ? 'col-span-2' : ''}>
            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
            {hasDualUnit(product) ? (
              <DualUnitQuantityInput
                product={product}
                quantity={item.quantity}
                showBoxInput={dualUnitShowBoxInputEnabled}
                showPiecesInput={dualUnitShowPiecesInputEnabled}
                onChange={(newQuantity, dual) => {
                  if (newQuantity <= 0) {
                    onRemove(item.product?._id);
                    return;
                  }
                  const ppb = getPiecesPerBox(product);
                  const { boxes, pieces } = ppb && dual ? dual : (ppb ? piecesToBoxesAndPieces(newQuantity, ppb) : {});
                  onUpdateQuantity(item.product?._id, newQuantity, ppb ? { boxes, pieces } : undefined);
                }}
                min={1}
                inputClassName="input text-center text-sm h-8"
                compact={hasDualUnit(product)}
              />
            ) : (
              <input
                type="number"
                autoComplete="off"
                value={item.quantity}
                onChange={(e) => onUpdateQuantity(item.product?._id, parseInt(e.target.value) || 1)}
                onFocus={(e) => e.target.select()}
                className="input text-center text-sm h-8"
                min="1"
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cost</label>
            <input
              type="number"
              step="0.01"
              autoComplete="off"
              value={item.costPerUnit}
              onChange={(e) => onUpdateCost(item.product?._id, parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              className="input text-center text-sm h-8"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Desktop Table Row — same column model as Sales (Box + Qty split when dual-unit) */}
      <div className={`hidden md:block py-1 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
        <div
          className={`grid gap-x-1 items-center ${dualUnitShowBoxInputEnabled
              ? 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
              : 'grid-cols-[2.25rem_minmax(0,1fr)_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
            }`}
        >
          <div className="min-w-0 flex justify-start">
            <span
              className={`text-sm font-medium px-0.5 py-1 rounded border block w-8 text-center h-8 flex items-center justify-center transition-colors duration-300 ${highlightSerial
                  ? 'bg-green-100 text-green-800 border-green-400 ring-2 ring-green-300/80'
                  : 'text-gray-700 bg-gray-50 border-gray-200'
                }`}
            >
              {index + 1}
            </span>
          </div>

          <div className="min-w-0 flex items-center h-8 gap-2">
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
            <div className="flex flex-col min-w-0 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-sm truncate min-w-0">{displayName}</span>
                {isLowStock && <span className="text-yellow-600 text-xs whitespace-nowrap">⚠️ Low Stock</span>}
              </div>
              {product.isVariant && (
                <span className="text-xs text-gray-500 truncate">
                  {product.variantType}: {product.variantValue}
                </span>
              )}
              {(() => {
                const b = (product.barcode ?? '').toString().trim();
                if (b) return <span className="text-xs text-gray-600 font-mono truncate">Barcode: {b}</span>;
                const s = (product.sku ?? '').toString().trim();
                if (s) return <span className="text-xs text-gray-600 font-mono truncate">SKU: {s}</span>;
                return null;
              })()}
            </div>
          </div>

          {dualUnitShowBoxInputEnabled && (
            <div className="min-w-0">
              {hasDualUnit(product) ? (
                (() => {
                  const ppb = getPiecesPerBox(product);
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
                      onChange={(e) => onUpdateCartBoxCount(item.product?._id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className={`text-sm font-semibold w-full min-w-0 rounded border px-2 py-1 text-center h-8 focus:outline-none focus:ring-2 focus:ring-primary-500/35 ${(product.inventory?.currentStock || 0) === 0
                          ? 'text-red-700 bg-red-50 border-red-200'
                          : (product.inventory?.currentStock || 0) <= (product.inventory?.reorderPoint || 0)
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

          <div className="min-w-0">
            <span
              className={`text-sm font-semibold px-2 py-1 rounded border block text-center h-8 flex items-center justify-center ${(product.inventory?.currentStock || 0) === 0
                  ? 'text-red-700 bg-red-50 border-red-200'
                  : (product.inventory?.currentStock || 0) <= (product.inventory?.reorderPoint || 0)
                    ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                    : 'text-gray-700 bg-gray-100 border-gray-200'
                }`}
            >
              {hasDualUnit(product) ? formatStockDualLabel(currentStock, product) : currentStock}
            </span>
          </div>

          <div className="min-w-0">
            <DualUnitQuantityInput
              product={product}
              quantity={item.quantity}
              onChange={(newQuantity, dual) => {
                if (newQuantity <= 0) {
                  onRemove(item.product?._id);
                  return;
                }
                const ppb = getPiecesPerBox(product);
                const { boxes, pieces } = ppb && dual ? dual : ppb ? piecesToBoxesAndPieces(newQuantity, ppb) : {};
                onUpdateQuantity(item.product?._id, newQuantity, ppb ? { boxes, pieces } : undefined);
              }}
              min={1}
              showRemainingAfterSale={false}
              showPiecesUnitLabel={false}
              showBoxInput={dualUnitShowBoxInputEnabled && !hasDualUnit(product)}
              showPiecesInput={dualUnitShowPiecesInputEnabled}
              inputClassName="w-full min-w-0 text-center h-8 border border-gray-300 rounded px-2"
              compact={hasDualUnit(product)}
            />
          </div>

          <div className="min-w-0">
            <Input
              type="number"
              step="0.01"
              autoComplete="off"
              value={item.costPerUnit}
              onChange={(e) => onUpdateCost(item.product?._id, parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              className="text-center h-8"
              min="0"
            />
          </div>

          <div className="min-w-0">
            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block w-full min-w-0 text-center h-8 flex items-center justify-center">
              {Number.isFinite(totalPrice) ? totalPrice.toFixed(2) : '0.00'}
            </span>
          </div>

          <div className="min-w-0 flex justify-end">
            <Button
              onClick={() => onRemove(item.product?._id)}
              variant="destructive"
              size="sm"
              className="h-8 w-8 p-0"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// NOTE: SupplierSearch component removed - functionality moved to main Purchase component
// This was using react-query instead of RTK Query, causing conflicts

const ProductSearch = ({ onAddProduct, onRefetchReady }) => {
  const { companyInfo: companySettings } = useCompanyInfo();
  const dualUnitShowBoxInputEnabled = companySettings.orderSettings?.dualUnitShowBoxInput !== false;
  const dualUnitShowPiecesInputEnabled = companySettings.orderSettings?.dualUnitShowPiecesInput !== false;

  return (
    <SharedSalesProductSearch
      onAddProduct={(item) =>
        onAddProduct({
          ...item,
          costPerUnit: Number(item.costPerUnit ?? item.unitPrice ?? 0),
        })
      }
      selectedCustomer={null}
      showCostPrice={false}
      hasCostPricePermission={false}
      priceType="cost"
      dualUnitShowBoxInput={dualUnitShowBoxInputEnabled}
      dualUnitShowPiecesInput={dualUnitShowPiecesInputEnabled}
      allowOutOfStock
      onRefetchReady={onRefetchReady}
    />
  );
};

export const Purchase = ({ tabId, editData }) => {
  const [purchaseItems, setPurchaseItems] = useState([]);
  const purchaseCartScrollRef = useRef(null);
  const purchaseCartLineElRefs = useRef(new Map());
  const [highlightedPurchaseLineIndex, setHighlightedPurchaseLineIndex] = useState(null);
  const purchaseCartNeedsInnerScroll = purchaseItems.length > 10;

  useLayoutEffect(() => {
    if (highlightedPurchaseLineIndex === null) return;
    const idx = highlightedPurchaseLineIndex;
    purchaseCartScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (purchaseCartNeedsInnerScroll) {
      const el = purchaseCartLineElRefs.current.get(idx);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      requestAnimationFrame(() => {
        purchaseCartLineElRefs.current.get(idx)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      });
    }
  }, [highlightedPurchaseLineIndex, purchaseCartNeedsInnerScroll, purchaseItems.length]);

  useEffect(() => {
    if (purchaseItems.length === 0) setHighlightedPurchaseLineIndex(null);
  }, [purchaseItems.length]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(true);
  const [expectedDelivery, setExpectedDelivery] = useState(new Date().toISOString().split('T')[0]);
  const [billDate, setBillDate] = useState(getLocalDateString()); // Bill Date for backdating (same as Sale page)
  const [notes, setNotes] = useState('');
  const [showPurchaseDetailsFields, setShowPurchaseDetailsFields] = useState(false);
  const [showProductImages, setShowProductImages] = useState(localStorage.getItem('showProductImagesUI') !== 'false');

  useEffect(() => {
    const handleConfigChange = () => {
      setShowProductImages(localStorage.getItem('showProductImagesUI') !== 'false');
    };
    window.addEventListener('productImagesConfigChanged', handleConfigChange);
    return () => window.removeEventListener('productImagesConfigChanged', handleConfigChange);
  }, []);

  const [previewImageProduct, setPreviewImageProduct] = useState(null);

  const { isMobile } = useResponsive();
  const { companyInfo: companySettings } = useCompanyInfo();
  const dualUnitShowBoxInputEnabledPage = companySettings.orderSettings?.dualUnitShowBoxInput !== false;
  const taxSystemEnabled = companySettings.taxEnabled === true;
  const globalTaxPct = Math.min(100, Math.max(0, Number(companySettings.defaultTaxRate ?? 0)));

  // Ref for supplier selection field to focus on page load
  const supplierSearchRef = useRef(null);

  // Payment and discount state variables (matching Sales component)
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState(0);
  const [directDiscount, setDirectDiscount] = useState({ type: 'amount', value: 0 });

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [directPrintOrder, setDirectPrintOrder] = useState(null);

  const PURCHASE_INVOICE_LABEL_KEY = 'purchaseInvoiceOfferBarcodeLabels';
  const [printBarcodeLabelsAfterInvoice, setPrintBarcodeLabelsAfterInvoice] = useState(() => {
    try {
      const v = localStorage.getItem(PURCHASE_INVOICE_LABEL_KEY);
      if (v === null) return false;
      return v === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PURCHASE_INVOICE_LABEL_KEY, String(printBarcodeLabelsAfterInvoice));
    } catch {
      /* ignore */
    }
  }, [printBarcodeLabelsAfterInvoice]);

  const pendingReceiptLabelPayloadRef = useRef(null);
  const [showReceiptLabelPrinter, setShowReceiptLabelPrinter] = useState(false);
  const [receiptLabelProducts, setReceiptLabelProducts] = useState([]);







  const { updateTabTitle, getActiveTab, openTab } = useTab();

  // Store refetch function from ProductSearch component
  const [refetchProducts, setRefetchProducts] = useState(null);

  // RTK Query hooks
  const [searchSuppliers, { data: suppliersSearchResult, isLoading: suppliersLoading, refetch: refetchSuppliers }] = useLazySearchSuppliersQuery();
  const [createPurchaseInvoice] = useCreatePurchaseInvoiceMutation();
  const [updatePurchaseInvoice] = useUpdatePurchaseInvoiceMutation();


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

      // Set bill date (same as Sale page; API returns invoiceDate)
      if (editData.invoiceDate || editData.billDate) {
        const d = editData.invoiceDate || editData.billDate;
        setBillDate(!isNaN(new Date(d).getTime()) ? getLocalDateString(new Date(d)) : getLocalDateString());
      } else if (editData.createdAt) {
        setBillDate(!isNaN(new Date(editData.createdAt).getTime()) ? getLocalDateString(new Date(editData.createdAt)) : getLocalDateString());
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

      // Set payment amount and method for editing (same as sales invoice amount received)
      if (editData.payment) {
        const amt = editData.payment.amount ?? editData.payment.paidAmount ?? 0;
        setAmountPaid(typeof amt === 'number' ? amt : parseFloat(amt) || 0);
        if (editData.payment.method) {
          setPaymentMethod(editData.payment.method);
        }
      }

      // Data loaded successfully (no toast needed as PurchaseInvoices already shows opening message)
    }
  }, [editData?.invoiceId]); // Only depend on invoiceId to prevent multiple executions

  // Fetch complete supplier data when supplier is selected (for immediate balance updates)
  const { data: completeSupplierData, refetch: refetchSupplier } = useGetSupplierQuery(
    selectedSupplier?._id,
    {
      skip: !selectedSupplier?._id,
      staleTime: 60_000,
      refetchOnMountOrArgChange: true,
    }
  );

  // Merge fresh GET /suppliers/:id into selection (API returns { supplier }, not { data })
  useEffect(() => {
    const s =
      completeSupplierData?.supplier ??
      completeSupplierData?.data?.supplier ??
      completeSupplierData?.data;
    if (s && (s._id || s.id)) {
      setSelectedSupplier(s);
    }
  }, [completeSupplierData]);

  // Use centralized unified balance instead of entity-specific balance
  const supplierIdForBalance = selectedSupplier?._id || selectedSupplier?.id;
  const { data: unifiedBalanceData } = useGetUnifiedBalanceQuery({
    type: 'supplier',
    id: supplierIdForBalance
  }, {
    skip: !supplierIdForBalance
  });

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

    // Check if sequential numbering is enabled
    const orderSettings = companySettings.orderSettings || {};
    if (orderSettings.purchaseSequenceEnabled) {
      const prefix = orderSettings.purchaseSequencePrefix || 'PUR-';
      const nextNum = orderSettings.purchaseSequenceNext || 1;
      const padding = orderSettings.purchaseSequencePadding || 3;
      return `${prefix}${String(nextNum).padStart(padding, '0')}`;
    }

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
        <div className="font-medium">{supplier.companyName || supplier.company_name || supplier.businessName || supplier.business_name || supplier.displayName || supplier.name || 'Unknown'}</div>
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
    // SearchableDropdown passes the full supplier object
    setSelectedSupplier(supplier);

    // Auto-generate invoice number if enabled
    if (autoGenerateInvoice && supplier) {
      setInvoiceNumber(generateInvoiceNumber(supplier));
    }

    // Update tab title to show supplier name
    const activeTab = getActiveTab();
    if (activeTab && supplier) {
      updateTabTitle(activeTab.id, `Purchase - ${supplier.companyName || supplier.company_name || supplier.businessName || supplier.displayName || supplier.name || 'Unknown'}`);
    }

    // Clear cart when supplier changes (only in new purchase mode, not in edit mode)
    if (purchaseItems.length > 0 && !editData?.isEditMode) {
      setPurchaseItems([]);
      setHighlightedPurchaseLineIndex(null);
      toast.success('Purchase items cleared due to supplier change. Please re-add products.');
    }
  };

  // Handler functions for purchase invoice mutations
  const handleCreatePurchaseInvoice = async (invoiceData) => {
    const labelPayload = pendingReceiptLabelPayloadRef.current;
    pendingReceiptLabelPayloadRef.current = null;
    try {
      const result = await createPurchaseInvoice(invoiceData).unwrap();

      // Handle different response structures
      const invoiceNumber = result?.invoice?.invoiceNumber || result?.data?.invoice?.invoiceNumber || 'Unknown';
      const inventoryUpdates = result?.inventoryUpdates || result?.data?.inventoryUpdates || [];
      const successCount = inventoryUpdates.filter(update => update.success).length;

      toast.success(`Purchase invoice created successfully! Invoice ${invoiceNumber} created and ${successCount} products added to inventory.`);

      if (labelPayload?.items?.length) {
        const prods = buildReceiptLabelProductsFromLineItems(labelPayload.items);
        if (prods.length) {
          setReceiptLabelProducts(prods);
          setShowReceiptLabelPrinter(true);
        }
      }

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
            const s =
              result?.data?.supplier ??
              result?.data?.data?.supplier ??
              result?.data?.data;
            if (s && (s._id || s.id)) {
              setSelectedSupplier(s);
            }
          }).catch(() => { });
        } catch {
          /* ignore */
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
      setHighlightedPurchaseLineIndex(null);
      // Don't clear selectedSupplier immediately - let it update from refetched data
      // setSelectedSupplier(null);
      setAmountPaid(0);
      setPaymentMethod('cash');
      setInvoiceNumber('');
      setExpectedDelivery(new Date().toISOString().split('T')[0]);
      setBillDate(getLocalDateString()); // Reset Bill Date to today
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
            const s =
              result?.data?.supplier ??
              result?.data?.data?.supplier ??
              result?.data?.data;
            if (s && (s._id || s.id)) {
              setSelectedSupplier(s);
            }
          }).catch((error) => {
            if (!error?.message?.includes('has not been started')) {
              /* ignore */
            }
          });
        } catch (error) {
          if (!error?.message?.includes('has not been started')) {
            /* ignore */
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

      // Navigate to Purchase Invoices page after successful update
      const componentInfo = getComponentInfo('/purchase-invoices');
      if (componentInfo) {
        openTab({
          title: 'Purchase Invoices',
          path: '/purchase-invoices',
          component: componentInfo.component,
          icon: componentInfo.icon,
          allowMultiple: componentInfo.allowMultiple,
          props: {}
        });
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to update purchase');
    }
  };

  const calculateTax = () => {
    if (!taxSystemEnabled) return 0;
    if (!selectedSupplier) return 0;
    const sub = purchaseItems.reduce((sum, item) => sum + (item.costPerUnit * item.quantity), 0);
    return sub * (globalTaxPct / 100);
  };

  const subtotal = purchaseItems.reduce((sum, item) => sum + (item.costPerUnit * item.quantity), 0);
  const tax = calculateTax();

  // Calculate discount amount
  const directDiscountAmount = directDiscount.type === 'percentage'
    ? (subtotal * directDiscount.value / 100)
    : directDiscount.value;

  const total = subtotal + tax - directDiscountAmount;
  // Use centralized ledger balance if available, fallback to entity balance
  const supplierOutstanding = unifiedBalanceData?.balance ?? (
    Number(selectedSupplier?.pendingBalance ?? selectedSupplier?.outstandingBalance ?? 0) || 0
  );
  const totalPayables = total + supplierOutstanding;

  const addToPurchase = (newItem) => {
    let highlightLineIndex = null;
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

        highlightLineIndex = prevItems.findIndex((item) => item.product?._id === newItem.product?._id);

        // User confirmed, update existing item quantity and cost (re-split boxes/pieces when dual)
        return prevItems.map(item =>
          item.product?._id === newItem.product?._id
            ? (() => {
              const mergedQty = item.quantity + newItem.quantity;
              const ppb = getPiecesPerBox(item.product);
              const split = ppb ? piecesToBoxesAndPieces(mergedQty, ppb) : {};
              return {
                ...item,
                quantity: mergedQty,
                costPerUnit: newItem.costPerUnit,
                ...(ppb ? { boxes: split.boxes, pieces: split.pieces } : {}),
              };
            })()
            : item
        );
      }
      highlightLineIndex = prevItems.length;
      return [...prevItems, newItem];
    });
    if (highlightLineIndex !== null && highlightLineIndex >= 0) {
      setHighlightedPurchaseLineIndex(highlightLineIndex);
    }
  };

  const updateQuantity = (productId, newQuantity, dualBreakdown) => {
    if (newQuantity <= 0) {
      removeFromPurchase(productId);
      return;
    }
    setPurchaseItems(prevItems =>
      prevItems.map(item => {
        if (item.product?._id !== productId) return item;
        const ppb = getPiecesPerBox(item.product);
        const { boxes, pieces } =
          ppb && dualBreakdown
            ? dualBreakdown
            : ppb
              ? piecesToBoxesAndPieces(newQuantity, ppb)
              : { boxes: undefined, pieces: undefined };
        return {
          ...item,
          quantity: newQuantity,
          ...(ppb ? { boxes, pieces } : {}),
        };
      })
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

  const updateCartBoxCount = (productId, newBoxes) => {
    const boxes = Math.max(0, parseInt(String(newBoxes), 10) || 0);
    setPurchaseItems((prevItems) => {
      const cartItem = prevItems.find((item) => item.product?._id === productId);
      if (!cartItem) return prevItems;
      const ppb = getPiecesPerBox(cartItem.product);
      if (!ppb) return prevItems;

      const pieces =
        cartItem.pieces != null ? cartItem.pieces : piecesToBoxesAndPieces(cartItem.quantity, ppb).pieces;
      const total = computeTotalPieces(boxes, pieces, ppb);

      if (total <= 0) {
        return prevItems.filter((item) => item.product?._id !== productId);
      }

      const { boxes: nb, pieces: np } = piecesToBoxesAndPieces(total, ppb);
      return prevItems.map((item) =>
        item.product?._id === productId ? { ...item, quantity: total, boxes: nb, pieces: np } : item
      );
    });
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
      supplier: selectedSupplier.id || selectedSupplier._id,
      supplierInfo: {
        name: selectedSupplier.name,
        email: selectedSupplier.email,
        phone: selectedSupplier.phone,
        companyName: selectedSupplier.companyName,
        address: (() => {
          if (typeof selectedSupplier.address === 'string' && selectedSupplier.address.trim()) return selectedSupplier.address.trim();
          if (selectedSupplier.address && typeof selectedSupplier.address === 'object') {
            const a = selectedSupplier.address;
            return [a.street, a.address_line1 || a.addressLine1, a.city, a.province || a.state, a.country, a.zipCode || a.zip].filter(Boolean).join(', ') || null;
          }
          if (selectedSupplier.addresses?.length) {
            const addr = selectedSupplier.addresses.find(a => a.isDefault) || selectedSupplier.addresses.find(a => a.type === 'billing' || a.type === 'both') || selectedSupplier.addresses[0];
            return [addr.street, addr.address_line1 || addr.addressLine1, addr.city, addr.province || addr.state, addr.country, addr.zipCode || addr.zip].filter(Boolean).join(', ') || null;
          }
          return null;
        })()
      },
      items: purchaseItems.map(item => ({
        product: item.product?.id || item.product?._id,
        quantity: item.quantity,
        unitCost: item.costPerUnit,
        totalCost: item.quantity * item.costPerUnit
      })),
      pricing: {
        subtotal: subtotal,
        discountAmount: 0,
        taxAmount: tax,
        isTaxExempt: !taxSystemEnabled,
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
      invoiceDate: billDate || undefined, // Bill Date for backdating (sent as invoiceDate to API, same as Sale page)
      notes: notes,
      terms: ''
    };

    pendingReceiptLabelPayloadRef.current = null;
    if (printBarcodeLabelsAfterInvoice && !editData?.isEditMode && purchaseItems.length > 0) {
      pendingReceiptLabelPayloadRef.current = { items: [...purchaseItems] };
    }

    // Use appropriate mutation based on edit mode
    if (editData?.isEditMode) {
      handleUpdatePurchaseInvoice(editData.invoiceId, invoiceData);
    } else {
      handleCreatePurchaseInvoice(invoiceData);
    }
  }, [purchaseItems, selectedSupplier, invoiceNumber, autoGenerateInvoice, expectedDelivery, billDate, notes, taxSystemEnabled, subtotal, tax, total, directDiscountAmount, paymentMethod, amountPaid, editData, handleCreatePurchaseInvoice, handleUpdatePurchaseInvoice, printBarcodeLabelsAfterInvoice]);


  return (
    <AsyncErrorBoundary>
      <div className="space-y-4 lg:space-y-6">
        <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start justify-between'}`}>
          <div>
            <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>Purchase</h1>
            <p className="text-gray-600">Process purchase transactions</p>
          </div>
          <div className="flex items-center space-x-2">

            <Button
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
              variant="default"
              size="default"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Purchase
            </Button>
          </div>
        </div>

        {/* Supplier Selection and Information Row */}
        <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-start space-x-12'}`}>
          {/* Supplier Selection */}
          <div className={`${isMobile ? 'w-full' : 'w-full max-w-3xl flex-shrink-0'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Supplier
                </label>
                {selectedSupplier && (
                  <button
                    onClick={() => {
                      setSelectedSupplier(null);
                      setSupplierSearchTerm('');
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
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (supplierSearchTerm) {
                      try {
                        await refetchSuppliers?.();
                      } catch {
                        /* ignore */
                      }
                    }
                    if ((selectedSupplier?.id || selectedSupplier?._id) && refetchSupplier) {
                      try {
                        const result = await refetchSupplier();
                        const s =
                          result?.data?.supplier ??
                          result?.data?.data?.supplier ??
                          result?.data?.data;
                        if (s && (s._id || s.id)) {
                          setSelectedSupplier(s);
                        }
                      } catch {
                        /* ignore */
                      }
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                  title="Refresh supplier list and outstanding balance"
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
          <div className={`${isMobile ? 'w-full' : 'flex-1'}`}>
            {selectedSupplier ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedSupplier.companyName || selectedSupplier.company_name || selectedSupplier.businessName || selectedSupplier.business_name || selectedSupplier.displayName || selectedSupplier.name || 'Unknown Supplier'}</p>
                    <p className="text-sm text-gray-600 capitalize mt-1">
                      {selectedSupplier.businessType && selectedSupplier.reliability
                        ? `${selectedSupplier.businessType} • ${selectedSupplier.reliability}`
                        : selectedSupplier.businessType || selectedSupplier.reliability || 'Supplier Information'
                      }
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-4 mt-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">Outstanding Balance:</span>
                        <span className={`text-xs sm:text-sm font-medium ${supplierOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {Math.round(supplierOutstanding)}
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
                        <span className="text-xs text-gray-500 break-words">
                          {(() => {
                            const addr = selectedSupplier.address;
                            if (typeof addr === 'string') return addr;
                            return [addr.street, addr.city, addr.province || addr.state, addr.country].filter(Boolean).join(', ');
                          })()}
                        </span>
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
        <ProductSelectionCartSection
          headerActions={
            purchaseItems.length > 0 ? (
              <Button
                type="button"
                onClick={handleSortPurchaseItems}
                variant="secondary"
                size="sm"
                className="flex items-center space-x-2"
                title="Sort products alphabetically"
              >
                <ArrowUpDown className="h-4 w-4" />
                <span>Sort A-Z</span>
              </Button>
            ) : null
          }
          searchSection={
            <ProductSearch
              onAddProduct={addToPurchase}
              onRefetchReady={setRefetchProducts}
              allowOutOfStock
            />
          }
          isEmpty={purchaseItems.length === 0}
          emptyIcon={Package}
          emptyText="No items in cart"
        >
          <CartItemsTableSection
            desktopHeader={(
              <CartTableHeader
                className={`hidden md:grid gap-x-1 items-center pb-2 border-b border-gray-300 mb-2 ${dualUnitShowBoxInputEnabledPage
                    ? 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
                    : 'grid-cols-[2.25rem_minmax(0,1fr)_5.35rem_5.35rem_5.35rem_5.35rem_2.25rem]'
                  }`}
                columns={[
                  { key: 'sno', label: 'S.NO', labelClassName: 'text-xs font-semibold text-gray-600 uppercase text-left' },
                  { key: 'product', label: 'Product' },
                  ...(dualUnitShowBoxInputEnabledPage ? [{ key: 'box', label: 'Box' }] : []),
                  { key: 'stock', label: 'Stock' },
                  { key: 'qty', label: 'Qty' },
                  { key: 'cost', label: 'Cost' },
                  { key: 'total', label: 'Total', labelClassName: 'text-xs font-semibold text-gray-600 uppercase block text-center' },
                  { key: 'action', label: 'Action', wrapperClassName: 'min-w-0 flex justify-end', labelClassName: 'text-xs font-semibold text-gray-600 uppercase text-right' },
                ]}
              />
            )}
          >
            <div
              ref={purchaseCartScrollRef}
              className={
                purchaseCartNeedsInnerScroll
                  ? 'max-h-[min(70vh,860px)] overflow-y-auto -mx-1 px-1 [scrollbar-gutter:stable]'
                  : 'overflow-visible -mx-1 px-1'
              }
            >
              {purchaseItems.map((item, index) => (
                <div
                  key={item.product?._id ?? index}
                  ref={(node) => {
                    if (node) purchaseCartLineElRefs.current.set(index, node);
                    else purchaseCartLineElRefs.current.delete(index);
                  }}
                >
                  <PurchaseItem
                    item={item}
                    index={index}
                    onUpdateQuantity={updateQuantity}
                    onUpdateCost={updateCost}
                    onRemove={removeFromPurchase}
                    onUpdateCartBoxCount={updateCartBoxCount}
                    showProductImages={showProductImages}
                    setPreviewImageProduct={setPreviewImageProduct}
                    highlightSerial={highlightedPurchaseLineIndex === index}
                  />
                </div>
              ))}
            </div>
          </CartItemsTableSection>
        </ProductSelectionCartSection>

        {/* Purchase Details + Order Summary — same two-column pattern as Sales */}
        {purchaseItems.length > 0 && (
          <div
            className={`mt-4 grid w-full min-w-0 grid-cols-1 gap-4 lg:gap-5 lg:items-start ${showPurchaseDetailsFields ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
              }`}
          >
            <OrderCheckoutCard
              className={`mt-0 ml-0 max-w-none min-w-0 w-full border-slate-200 bg-none bg-slate-50 shadow-sm ring-0 ${showPurchaseDetailsFields ? 'order-1' : 'order-2'
                }`}
            >
              <OrderDetailsSection
                detailsTitle="Purchase Details"
                showDetails={showPurchaseDetailsFields}
                onShowDetailsChange={setShowPurchaseDetailsFields}
                checkboxId="showPurchaseDetailsFields"
              >
                {showPurchaseDetailsFields && (
                  <>
                    <div className="md:hidden space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-gray-700">Invoice Number</label>
                          <label
                            htmlFor="autoGenerateInvoicePurchaseMobile"
                            className="flex items-center space-x-1 text-xs text-gray-600 cursor-pointer select-none"
                          >
                            <Input
                              type="checkbox"
                              id="autoGenerateInvoicePurchaseMobile"
                              checked={autoGenerateInvoice}
                              onChange={(e) => {
                                setAutoGenerateInvoice(e.target.checked);
                                if (e.target.checked && selectedSupplier) {
                                  setInvoiceNumber(generateInvoiceNumber(selectedSupplier));
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
                                if (selectedSupplier) {
                                  setInvoiceNumber(generateInvoiceNumber(selectedSupplier));
                                }
                              }}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-primary-600 hover:text-primary-800 font-medium"
                            >
                              Regenerate
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Expected Delivery</label>
                        <Input
                          type="date"
                          autoComplete="off"
                          value={expectedDelivery}
                          onChange={(e) => setExpectedDelivery(e.target.value)}
                          className="h-10 text-sm w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Bill Date <span className="text-gray-500">(Optional)</span>
                        </label>
                        <Input
                          type="date"
                          autoComplete="off"
                          value={billDate}
                          onChange={(e) => setBillDate(e.target.value)}
                          className="h-10 text-sm w-full"
                          max={getLocalDateString()}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
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

                    <div className="hidden md:flex flex-wrap gap-3 items-end justify-start">
                      <div className="flex flex-col w-72">
                        <div className="flex items-center gap-3 mb-1">
                          <label className="block text-xs font-medium text-gray-700 m-0">Invoice Number</label>
                          <label
                            htmlFor="autoGenerateInvoicePurchase"
                            className="flex items-center space-x-1 text-[11px] text-gray-600 cursor-pointer select-none"
                          >
                            <Input
                              type="checkbox"
                              id="autoGenerateInvoicePurchase"
                              checked={autoGenerateInvoice}
                              onChange={(e) => {
                                setAutoGenerateInvoice(e.target.checked);
                                if (e.target.checked && selectedSupplier) {
                                  setInvoiceNumber(generateInvoiceNumber(selectedSupplier));
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
                                if (selectedSupplier) {
                                  setInvoiceNumber(generateInvoiceNumber(selectedSupplier));
                                }
                              }}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[11px] text-primary-600 hover:text-primary-800 font-medium"
                            >
                              Regenerate
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col w-44">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Expected Delivery</label>
                        <Input
                          type="date"
                          autoComplete="off"
                          value={expectedDelivery}
                          onChange={(e) => setExpectedDelivery(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
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
                          max={getLocalDateString()}
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col basis-[min(100%,20rem)]">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                        <Input
                          type="text"
                          autoComplete="off"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="h-8 w-full min-w-0 text-sm"
                          placeholder="Additional notes..."
                        />
                      </div>
                    </div>
                  </>
                )}
              </OrderDetailsSection>
            </OrderCheckoutCard>

            <OrderCheckoutCard
              className={`mt-0 ml-0 max-w-none min-w-0 w-full border-slate-200 bg-none bg-slate-50 shadow-sm ring-0 ${showPurchaseDetailsFields ? 'order-2' : 'order-1'
                }`}
            >
              <OrderSummaryContent className="bg-none bg-slate-50">
                <div className="space-y-2">
                  {directDiscountAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Discount:</span>
                      <span className="text-xl font-semibold tabular-nums text-red-600">
                        -{directDiscountAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {taxSystemEnabled && tax > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Tax ({globalTaxPct}%):</span>
                      <span className="text-xl font-semibold tabular-nums text-foreground">{tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="mt-2">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4 md:gap-4">
                      <div className="flex items-center justify-between md:block">
                        <span className="text-sm font-medium text-muted-foreground">Subtotal:</span>
                        <div className="text-2xl font-semibold tabular-nums text-foreground md:mt-1">{subtotal.toFixed(2)}</div>
                      </div>
                      <div className="flex items-center justify-between md:block">
                        <span className="text-sm font-medium text-muted-foreground">Purchase Total:</span>
                        <div className="text-2xl font-bold tabular-nums text-primary md:mt-1">{total.toFixed(2)}</div>
                      </div>
                      <div className="flex items-center justify-between md:block">
                        <span className="text-sm font-medium text-muted-foreground">Previous Outstanding:</span>
                        <div
                          className={`text-2xl font-semibold tabular-nums md:mt-1 ${supplierOutstanding > 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                        >
                          {supplierOutstanding.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:block">
                        <span className="text-sm font-semibold text-foreground">Total Payables:</span>
                        <div className="text-2xl font-bold tabular-nums text-primary md:mt-1">{totalPayables.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <OrderInsetPanel>
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start">
                    <div className="flex flex-col">
                      <label className="block text-sm font-medium text-foreground mb-2">Apply Discount (manual)</label>
                      <div className="flex space-x-2">
                        <select
                          value={directDiscount.type}
                          onChange={(e) => setDirectDiscount({ ...directDiscount, type: e.target.value })}
                          className="h-10 px-3 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                        >
                          <option value="amount">Amount</option>
                          <option value="percentage">%</option>
                        </select>
                        <Input
                          type="number"
                          autoComplete="off"
                          placeholder={directDiscount.type === 'amount' ? 'Enter amount...' : 'Enter percentage...'}
                          value={directDiscount.value || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setDirectDiscount({ ...directDiscount, value });
                          }}
                          onFocus={(e) => e.target.select()}
                          className="flex-1 h-10 px-3 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-medium text-foreground"
                          min="0"
                          step={directDiscount.type === 'percentage' ? '0.1' : '0.01'}
                        />
                      </div>
                      {directDiscount.value > 0 && (
                        <div className="mt-2">
                          <Button
                            onClick={() => setDirectDiscount({ type: 'amount', value: 0 })}
                            variant="destructive"
                            size="sm"
                          >
                            Clear Discount
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col md:col-start-2 md:row-start-1 w-full">
                      <label className="block text-sm font-medium text-foreground mb-2">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full h-10 px-3 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-medium text-foreground"
                      >
                        <option value="cash">Cash</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="debit_card">Debit Card</option>
                        <option value="check">Check</option>
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <label className="block text-sm font-medium text-foreground mb-2">Amount Paid</label>
                      <Input
                        type="number"
                        step="0.01"
                        autoComplete="off"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        className="w-full h-10 px-3 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-medium text-foreground text-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </OrderInsetPanel>

                <OrderCheckoutActions>
                  {purchaseItems.length > 0 && (
                    <Button
                      onClick={() => {
                        setPurchaseItems([]);
                        setHighlightedPurchaseLineIndex(null);
                        setSelectedSupplier(null);
                        setSupplierSearchTerm('');
                        setDirectDiscount({ type: 'amount', value: 0 });
                        setAmountPaid(0);
                        setPaymentMethod('cash');
                        setBillDate(getLocalDateString());
                        toast.success('Cart cleared');
                      }}
                      variant="secondary"
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Cart
                    </Button>
                  )}
                  {purchaseItems.length > 0 && (
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
                            const supplierInfoForPrint = selectedSupplier ? {
                              name: selectedSupplier.companyName || selectedSupplier.company_name || selectedSupplier.businessName || selectedSupplier.business_name || selectedSupplier.displayName || selectedSupplier.name,
                              email: selectedSupplier.email,
                              phone: selectedSupplier.phone,
                              address: (() => {
                                if (typeof selectedSupplier.address === 'string' && selectedSupplier.address.trim()) return selectedSupplier.address.trim();
                                const addr = selectedSupplier.address || selectedSupplier.companyAddress || selectedSupplier.location;
                                if (addr && typeof addr === 'object') {
                                  const parts = [addr.street || addr.address_line1 || addr.addressLine1 || addr.line1, addr.address_line2 || addr.addressLine2, addr.city, addr.province || addr.state, addr.country, addr.zipCode || addr.zip || addr.postalCode || addr.postal_code].filter(Boolean);
                                  if (parts.length) return parts.join(', ');
                                }
                                if (selectedSupplier.addresses?.length) {
                                  const a = selectedSupplier.addresses.find(x => x.isDefault) || selectedSupplier.addresses.find(x => x.type === 'billing' || x.type === 'both') || selectedSupplier.addresses[0];
                                  const parts = [a.street || a.address_line1 || a.addressLine1, a.city, a.province || a.state, a.country, a.zipCode || a.zip].filter(Boolean);
                                  if (parts.length) return parts.join(', ');
                                }
                                return null;
                              })(),
                              businessName: selectedSupplier.businessName || selectedSupplier.business_name || selectedSupplier.companyName
                            } : null;
                            const tempOrder = {
                              orderNumber: `PO-${Date.now()}`,
                              orderType: 'purchase',
                              supplier: selectedSupplier,
                              supplierInfo: supplierInfoForPrint,
                              customer: selectedSupplier,
                              customerInfo: supplierInfoForPrint,
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
                                    variantValue: product.variantValue,
                                    ...(product.barcode ? { barcode: product.barcode } : {}),
                                    ...(product.sku ? { sku: product.sku } : {})
                                  },
                                  quantity: item.quantity,
                                  unitPrice: item.costPerUnit
                                };
                              }),
                              pricing: {
                                subtotal: subtotal,
                                discountAmount: directDiscountAmount,
                                taxAmount: tax,
                                isTaxExempt: !taxSystemEnabled,
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
                            setDirectPrintOrder(tempOrder);
                          }}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Print
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const supplierInfoForPrint = selectedSupplier ? {
                              name: selectedSupplier.companyName || selectedSupplier.company_name || selectedSupplier.businessName || selectedSupplier.business_name || selectedSupplier.displayName || selectedSupplier.name,
                              email: selectedSupplier.email,
                              phone: selectedSupplier.phone,
                              address: (() => {
                                if (typeof selectedSupplier.address === 'string' && selectedSupplier.address.trim()) return selectedSupplier.address.trim();
                                const addr = selectedSupplier.address || selectedSupplier.companyAddress || selectedSupplier.location;
                                if (addr && typeof addr === 'object') {
                                  const parts = [addr.street || addr.address_line1 || addr.addressLine1 || addr.line1, addr.address_line2 || addr.addressLine2, addr.city, addr.province || addr.state, addr.country, addr.zipCode || addr.zip || addr.postalCode || addr.postal_code].filter(Boolean);
                                  if (parts.length) return parts.join(', ');
                                }
                                if (selectedSupplier.addresses?.length) {
                                  const a = selectedSupplier.addresses.find(x => x.isDefault) || selectedSupplier.addresses.find(x => x.type === 'billing' || x.type === 'both') || selectedSupplier.addresses[0];
                                  const parts = [a.street || a.address_line1 || a.addressLine1, a.city, a.province || a.state, a.country, a.zipCode || a.zip].filter(Boolean);
                                  if (parts.length) return parts.join(', ');
                                }
                                return null;
                              })(),
                              businessName: selectedSupplier.businessName || selectedSupplier.business_name || selectedSupplier.companyName
                            } : null;
                            const tempOrder = {
                              orderNumber: `PO-${Date.now()}`,
                              orderType: 'purchase',
                              supplier: selectedSupplier,
                              supplierInfo: supplierInfoForPrint,
                              customer: selectedSupplier,
                              customerInfo: supplierInfoForPrint,
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
                                    variantValue: product.variantValue,
                                    ...(product.barcode ? { barcode: product.barcode } : {}),
                                    ...(product.sku ? { sku: product.sku } : {})
                                  },
                                  quantity: item.quantity,
                                  unitPrice: item.costPerUnit
                                };
                              }),
                              pricing: {
                                subtotal: subtotal,
                                discountAmount: directDiscountAmount,
                                taxAmount: tax,
                                isTaxExempt: !taxSystemEnabled,
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
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Print Preview
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {!editData?.isEditMode && purchaseItems.length > 0 && (
                    <label className="flex items-center space-x-2 px-2 text-sm font-medium text-gray-700 cursor-pointer">
                      <Input
                        type="checkbox"
                        checked={printBarcodeLabelsAfterInvoice}
                        onChange={(e) => setPrintBarcodeLabelsAfterInvoice(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span>Print labels after purchase</span>
                    </label>
                  )}
                  <LoadingButton
                    onClick={handleProcessPurchase}
                    isLoading={false}
                    variant="default"
                    size="lg"
                    className="flex-2"
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    {editData?.isEditMode ? 'Update Purchase Invoice' : 'Complete Purchase & Update Inventory'}
                  </LoadingButton>
                </OrderCheckoutActions>
              </OrderSummaryContent>
            </OrderCheckoutCard>
          </div>
        )}

        {directPrintOrder && (
          <DirectPrintInvoice
            orderData={directPrintOrder}
            documentTitle="Purchase Invoice"
            partyLabel="Supplier"
            onComplete={() => setDirectPrintOrder(null)}
          />
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

        {showReceiptLabelPrinter && (
          <BarcodeLabelPrinter
            products={receiptLabelProducts}
            quantityMode={true}
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
    </AsyncErrorBoundary>
  );
};
