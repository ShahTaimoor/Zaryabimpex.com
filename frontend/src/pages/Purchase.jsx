import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  Package,
  Search,
  Filter,
  Edit,
  RefreshCw,
  Trash2,
  Building,
  Truck,
  Receipt,
  Printer,
  Eye,
  ChevronDown,
  MapPin,
  ArrowUpDown,
  Download,
  MoreHorizontal,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import BaseModal from '../components/BaseModal';
import { DuplicateLineItemMergeModal } from '../components/order/DuplicateLineItemMergeModal';
import { ProductImagePreviewModal } from '../components/order/ProductImagePreviewModal';
import { DocumentNumberField } from '../components/order/DocumentNumberField';
import { SupplierPartySelect, SupplierSummaryStrip } from '../components/order/SupplierPartySelect';
import { OrderNotesField } from '../components/order/OrderNotesField';
import { PaymentMethodSelect } from '../components/order/PaymentMethodSelect';
import { computePurchaseCheckoutPricing } from '../utils/orderPricing';
import {
  useGetSupplierQuery,
  useLazySearchSuppliersQuery,
} from '../store/services/suppliersApi';
import {
  useCreatePurchaseInvoiceMutation,
  useUpdatePurchaseInvoiceMutation,
  useGetPurchaseInvoicesQuery,
  useLazyGetPurchaseInvoicesQuery,
  useLazyGetPurchaseInvoiceQuery,
  useDeletePurchaseInvoiceMutation,
} from '../store/services/purchaseInvoicesApi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useGetUnifiedBalanceQuery } from '../store/services/accountingApi';
import { useGetBanksQuery } from '../store/services/banksApi';
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
  OrderSummaryBar,
  OrderInsetPanel,
  OrderCheckoutActions,
} from '../components/order/OrderCheckoutLayout';
import { ProductSelectionCartSection } from '../components/order/ProductSelectionCartSection';
import { CartItemsTableSection } from '../components/order/CartItemsTableSection';
import { CartTableHeader } from '../components/order/CartTableHeader';
import {
  LineItemSerial,
  LineItemThumbnail,
  LineItemStockCell,
  LineItemTotalCell,
  LineItemRemoveButton,
  LineItemBoxInputCell,
} from '../components/order/CartLineItemAtoms';
import { DualUnitQuantityInput } from '../components/DualUnitQuantityInput';
import {
  hasDualUnit,
  getPiecesPerBox,
  piecesToBoxesAndPieces,
  formatStockDualLabel,
  computeTotalPieces,
} from '../utils/dualUnitUtils';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { getLocalDateString, getCurrentDatePakistan } from '../utils/dateUtils';
import { formatDate } from '../utils/formatters';
import DateFilter from '../components/DateFilter';
import PaginationControls from '../components/PaginationControls';
import ExcelExportButton from '../components/ExcelExportButton';
import PdfExportButton from '../components/PdfExportButton';
import { getInvoicePdfPayload } from '../utils/invoicePdfUtils';


import AsyncErrorBoundary from '../components/AsyncErrorBoundary';
import { useResponsive } from '../components/ResponsiveContainer';
import { ProductSearch as SharedSalesProductSearch } from '../components/sales/ProductSearch';
import { useSensitiveDataPermissions } from '../hooks/useSensitiveDataPermissions';

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
            {showProductImages && (
              <LineItemThumbnail
                src={product?.imageUrl}
                size="md"
                onClick={() => setPreviewImageProduct(product)}
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <LineItemSerial index={index} variant="mobile" />
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
          <LineItemRemoveButton
            onClick={() => onRemove(item.product?._id)}
            className="p-1 flex-shrink-0"
          />
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
            <LineItemTotalCell value={totalPrice.toFixed(2)} textSize="text-xs" />
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
            <LineItemSerial index={index} highlight={highlightSerial} />
          </div>

          <div className="min-w-0 flex items-center h-8 gap-2">
            {showProductImages && (
              <LineItemThumbnail
                src={product?.imageUrl}
                onClick={() => setPreviewImageProduct(product)}
              />
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
              <LineItemBoxInputCell
                product={product}
                item={item}
                onChange={(value) => onUpdateCartBoxCount(item.product?._id, value)}
              />
            </div>
          )}

          <div className="min-w-0">
            <LineItemStockCell
              currentStock={currentStock}
              reorderPoint={reorderPoint}
              formatValue={() => (hasDualUnit(product) ? formatStockDualLabel(currentStock, product) : currentStock)}
            />
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
            <LineItemTotalCell
              value={Number.isFinite(totalPrice) ? totalPrice.toFixed(2) : '0.00'}
            />
          </div>

          <div className="min-w-0 flex justify-end">
            <LineItemRemoveButton onClick={() => onRemove(item.product?._id)} />
          </div>
        </div>
      </div>
    </div>
  );
};

// NOTE: SupplierSearch component removed - functionality moved to main Purchase component
// This was using react-query instead of RTK Query, causing conflicts

const ProductSearch = ({ onAddProduct, onRefetchReady, onFocusReady }) => {
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
      onFocusReady={onFocusReady}
    />
  );
};

const DEFAULT_IMPORT_CHARGES = {
  customDuty: 0,
  salesTax: 0,
  gst: 0,
  additionalSalesTax: 0,
  freight: 0,
  demurrage: 0,
  loadingUnloading: 0,
  otherDuties: 0,
  otherCharges: 0,
};

const IMPORT_ALLOCATION_METHODS = {
  BY_VALUE: 'by_value',
  BY_QTY: 'by_quantity',
};

export const Purchase = ({ tabId, editData, purchaseMode = 'local' }) => {
  const {
    canViewSupplierBalance,
    canViewSupplierPhone,
    canViewStock,
    getPartyPermissions
  } = useSensitiveDataPermissions();
  const isImportPurchase = purchaseMode === 'import';
  const [purchaseItems, setPurchaseItems] = useState([]);
  const purchaseCartScrollRef = useRef(null);
  const purchaseCartLineElRefs = useRef(new Map());
  const [highlightedPurchaseLineIndex, setHighlightedPurchaseLineIndex] = useState(null);
  const purchaseCartNeedsInnerScroll = purchaseItems.length > 10;
  const [purchaseDuplicateMerge, setPurchaseDuplicateMerge] = useState(null);
  const [purchaseSearchResetKey, setPurchaseSearchResetKey] = useState(0);
  const purchaseProductSearchFocusFnRef = useRef(null);
  const handlePurchaseProductSearchFocusReady = useCallback((fn) => {
    purchaseProductSearchFocusFnRef.current = fn;
  }, []);
  const refocusPurchaseProductSearch = useCallback(() => {
    setTimeout(() => purchaseProductSearchFocusFnRef.current?.(), 60);
  }, []);

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
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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
  const importPurchaseFeatureEnabled = companySettings.orderSettings?.enableImportPurchaseLandedCost === true;
  const isEnhancedImportPurchase = isImportPurchase && importPurchaseFeatureEnabled;
  const dualUnitShowBoxInputEnabledPage = companySettings.orderSettings?.dualUnitShowBoxInput !== false;
  const taxSystemEnabled = companySettings.taxEnabled === true;
  const globalTaxPct = Math.min(100, Math.max(0, Number(companySettings.defaultTaxRate ?? 0)));

  // Ref for supplier selection field to focus on page load
  const supplierSearchRef = useRef(null);

  // Payment and discount state variables (matching Sales component)
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [directDiscount, setDirectDiscount] = useState({ type: 'amount', value: 0 });
  const [importCharges, setImportCharges] = useState(DEFAULT_IMPORT_CHARGES);
  const [importAllocationMethod, setImportAllocationMethod] = useState(IMPORT_ALLOCATION_METHODS.BY_VALUE);

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [directPrintOrder, setDirectPrintOrder] = useState(null);
  const [showSavedPurchasePrintModal, setShowSavedPurchasePrintModal] = useState(false);
  const [savedPurchasePrintOrder, setSavedPurchasePrintOrder] = useState(null);
  const [inlineEditData, setInlineEditData] = useState(null);
  const activeEditData = inlineEditData?.isEditMode ? inlineEditData : editData;
  const [purchaseDeleteTarget, setPurchaseDeleteTarget] = useState(null);
  const [savedPurchaseSearchTerm, setSavedPurchaseSearchTerm] = useState('');
  const [savedPurchaseStatus, setSavedPurchaseStatus] = useState('');
  const excelExportRef = useRef(null);
  const pdfExportRef = useRef(null);
  const [savedPurchaseFromDate, setSavedPurchaseFromDate] = useState(() => getCurrentDatePakistan());
  const [savedPurchaseToDate, setSavedPurchaseToDate] = useState(() => getCurrentDatePakistan());
  const [savedPurchasePage, setSavedPurchasePage] = useState(1);
  const savedPurchaseLimit = 20;
  const debouncedSavedPurchaseSearch = useDebouncedValue(savedPurchaseSearchTerm, 350);

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
  const [deletePurchaseInvoice] = useDeletePurchaseInvoiceMutation();
  const [getPurchaseInvoiceById] = useLazyGetPurchaseInvoiceQuery();
  const [fetchPurchaseInvoicesForExport] = useLazyGetPurchaseInvoicesQuery();
  const {
    data: savedPurchaseResponse,
    isLoading: isSavedPurchaseLoading,
    error: savedPurchaseError,
    refetch: refetchSavedPurchase,
  } = useGetPurchaseInvoicesQuery(
    {
      search: debouncedSavedPurchaseSearch || undefined,
      status: savedPurchaseStatus || undefined,
      dateFrom: savedPurchaseFromDate || undefined,
      dateTo: savedPurchaseToDate || undefined,
      page: savedPurchasePage,
      limit: savedPurchaseLimit,
    },
    { refetchOnMountOrArgChange: 120 }
  );

  const { data: banksData, isLoading: banksLoading } = useGetBanksQuery(
    { isActive: true },
    { staleTime: 5 * 60_000 }
  );

  const activeBanks = useMemo(() => {
    const banks = banksData?.data?.banks || banksData?.banks || [];
    return banks.filter((bank) => bank.isActive !== false);
  }, [banksData]);

  const savedPurchaseInvoices = useMemo(() => {
    const top = savedPurchaseResponse?.data ?? savedPurchaseResponse;
    if (Array.isArray(top?.data?.invoices)) return top.data.invoices;
    if (Array.isArray(top?.invoices)) return top.invoices;
    if (Array.isArray(top?.data?.purchaseInvoices)) return top.data.purchaseInvoices;
    if (Array.isArray(top?.purchaseInvoices)) return top.purchaseInvoices;
    if (Array.isArray(top?.data?.data?.invoices)) return top.data.data.invoices;
    return [];
  }, [savedPurchaseResponse]);

  const savedPurchasePagination = useMemo(
    () => savedPurchaseResponse?.data?.pagination ?? savedPurchaseResponse?.pagination ?? {},
    [savedPurchaseResponse]
  );

  useEffect(() => {
    if (paymentMethod !== 'bank' || selectedBankAccount) return;
    const first = activeBanks[0];
    const id = first?._id || first?.id;
    if (id) setSelectedBankAccount(id);
  }, [paymentMethod, selectedBankAccount, activeBanks]);

  // Focus on supplier selection field when component mounts
  useEffect(() => {
    if (supplierSearchRef.current) {
      supplierSearchRef.current.focus();
    }
  }, []);

  // Handle edit data when component is opened for editing
  useEffect(() => {
    if (activeEditData && activeEditData.isEditMode && activeEditData.invoiceId) {
      // Set the supplier (will be updated with complete data if available)
      if (activeEditData.supplier) {
        setSelectedSupplier(activeEditData.supplier);
      }

      // Set the invoice number
      if (activeEditData.invoiceNumber) {
        setInvoiceNumber(activeEditData.invoiceNumber);
        setAutoGenerateInvoice(false); // Don't auto-generate when editing
      }

      // Set the notes
      if (activeEditData.notes) {
        setNotes(activeEditData.notes);
      }

      if (isEnhancedImportPurchase) {
        const existingImportCharges = activeEditData?.pricing?.importCharges;
        if (existingImportCharges && typeof existingImportCharges === 'object') {
          setImportCharges((prev) => ({ ...prev, ...existingImportCharges }));
        }
        const existingAllocationMethod = activeEditData?.pricing?.importAllocationMethod;
        if (existingAllocationMethod) {
          setImportAllocationMethod(existingAllocationMethod);
        }
      }

      // Set bill date (same as Sale page; API returns invoiceDate)
      if (activeEditData.invoiceDate || activeEditData.billDate) {
        const d = activeEditData.invoiceDate || activeEditData.billDate;
        setBillDate(!isNaN(new Date(d).getTime()) ? getLocalDateString(new Date(d)) : getLocalDateString());
      } else if (activeEditData.createdAt) {
        setBillDate(!isNaN(new Date(activeEditData.createdAt).getTime()) ? getLocalDateString(new Date(activeEditData.createdAt)) : getLocalDateString());
      }

      // Set the purchase items
      if (activeEditData.items && activeEditData.items.length > 0) {
        const formattedItems = activeEditData.items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          costPerUnit: item.unitCost || item.costPerUnit,
          totalCost: item.totalCost || (item.quantity * (item.unitCost || item.costPerUnit))
        }));
        setPurchaseItems(formattedItems);
      }

      // Set payment amount and method for editing (same as sales invoice amount received)
      if (activeEditData.payment) {
        const amt = activeEditData.payment.amount ?? activeEditData.payment.paidAmount ?? 0;
        setAmountPaid(typeof amt === 'number' ? amt : parseFloat(amt) || 0);
        if (activeEditData.payment.method) {
          setPaymentMethod(activeEditData.payment.method);
        }
        if (activeEditData.payment.method === 'bank') {
          setSelectedBankAccount(activeEditData.payment.bankAccount || '');
        } else {
          setSelectedBankAccount('');
        }
      }

      // Data loaded successfully (no toast needed as PurchaseInvoices already shows opening message)
    }
  }, [activeEditData?.invoiceId, isEnhancedImportPurchase]); // Only depend on invoiceId to prevent multiple executions

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
    if (purchaseItems.length > 0 && !activeEditData?.isEditMode) {
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

      if (inlineEditData?.isEditMode) {
        setInlineEditData(null);
        toast.success('Returned to new purchase mode');
      } else {
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
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to update purchase');
    }
  };

  const importChargesTotal = isEnhancedImportPurchase
    ? Object.values(importCharges).reduce((sum, value) => sum + (Number(value) || 0), 0)
    : 0;

  const { subtotal, tax, directDiscountAmount, total } = computePurchaseCheckoutPricing({
    items: purchaseItems,
    directDiscount,
    taxRate: globalTaxPct,
    // Preserve existing behaviour: tax only applies when a supplier has been
    // selected (the original calculateTax() short-circuited otherwise).
    taxSystemEnabled: taxSystemEnabled && !!selectedSupplier,
    importChargesTotal,
  });
  // Use centralized ledger balance if available, fallback to entity balance
  const supplierOutstanding = unifiedBalanceData?.balance ?? (
    Number(selectedSupplier?.pendingBalance ?? selectedSupplier?.outstandingBalance ?? 0) || 0
  );
  const totalPayables = total + supplierOutstanding;

  const getImportAllocatedItems = useCallback(() => {
    if (!isEnhancedImportPurchase || importChargesTotal <= 0 || purchaseItems.length === 0) {
      return purchaseItems.map((item) => ({
        ...item,
        allocatedCharge: 0,
        landedUnitCost: Number(item.costPerUnit) || 0,
      }));
    }

    const qtyDenominator = purchaseItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const valueDenominator = purchaseItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.costPerUnit) || 0;
      return sum + (qty * cost);
    }, 0);

    const denominator = importAllocationMethod === IMPORT_ALLOCATION_METHODS.BY_QTY
      ? qtyDenominator
      : valueDenominator;

    if (denominator <= 0) {
      return purchaseItems.map((item) => ({
        ...item,
        allocatedCharge: 0,
        landedUnitCost: Number(item.costPerUnit) || 0,
      }));
    }

    return purchaseItems.map((item) => {
      const qty = Number(item.quantity) || 0;
      const unitCost = Number(item.costPerUnit) || 0;
      const itemBaseValue = qty * unitCost;
      const weight = importAllocationMethod === IMPORT_ALLOCATION_METHODS.BY_QTY ? qty : itemBaseValue;
      const allocatedCharge = importChargesTotal * (weight / denominator);
      const landedUnitCost = qty > 0 ? (itemBaseValue + allocatedCharge) / qty : unitCost;

      return {
        ...item,
        allocatedCharge,
        landedUnitCost,
      };
    });
  }, [isEnhancedImportPurchase, importChargesTotal, purchaseItems, importAllocationMethod]);

  const addToPurchase = (newItem) => {
    const existingIndex = purchaseItems.findIndex(
      (item) => item.product?._id === newItem.product?._id
    );

    if (existingIndex >= 0) {
      const existingItem = purchaseItems[existingIndex];
      const product = newItem.product || {};
      const displayName = product.isVariant
        ? (product.displayName || product.variantName || product.name || 'Unknown Variant')
        : (product.name || 'Unknown Product');
      setPurchaseDuplicateMerge({
        productId: String(product._id),
        displayName,
        currentQuantity: Number(existingItem.quantity) || 0,
        addQuantity: Number(newItem.quantity) || 0,
        incomingItem: newItem,
      });
      return;
    }

    let highlightLineIndex = null;
    setPurchaseItems((prevItems) => {
      highlightLineIndex = prevItems.length;
      return [...prevItems, newItem];
    });
    if (highlightLineIndex !== null && highlightLineIndex >= 0) {
      setHighlightedPurchaseLineIndex(highlightLineIndex);
    }
  };

  const handlePurchaseDuplicateMergeConfirm = () => {
    if (!purchaseDuplicateMerge) return;
    const { productId, incomingItem } = purchaseDuplicateMerge;

    let mergedIdx = null;
    setPurchaseItems((prevItems) => {
      const idx = prevItems.findIndex((item) => String(item.product?._id) === productId);
      if (idx < 0) {
        mergedIdx = prevItems.length;
        return [...prevItems, incomingItem];
      }
      mergedIdx = idx;
      return prevItems.map((item, i) => {
        if (i !== idx) return item;
        const mergedQty = (Number(item.quantity) || 0) + (Number(incomingItem.quantity) || 0);
        const ppb = getPiecesPerBox(item.product);
        const split = ppb ? piecesToBoxesAndPieces(mergedQty, ppb) : {};
        return {
          ...item,
          quantity: mergedQty,
          costPerUnit: incomingItem.costPerUnit,
          ...(ppb ? { boxes: split.boxes, pieces: split.pieces } : {}),
        };
      });
    });

    setPurchaseDuplicateMerge(null);
    setPurchaseSearchResetKey((k) => k + 1);
    refocusPurchaseProductSearch();

    if (mergedIdx !== null && mergedIdx >= 0) {
      setHighlightedPurchaseLineIndex(mergedIdx);
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

    if (paymentMethod === 'bank' && !selectedBankAccount) {
      toast.error('Please select a bank account');
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
    const importAllocatedItems = getImportAllocatedItems();
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
      items: importAllocatedItems.map(item => ({
        product: item.product?.id || item.product?._id,
        quantity: item.quantity,
        unitCost: isEnhancedImportPurchase ? item.landedUnitCost : item.costPerUnit,
        totalCost: isEnhancedImportPurchase
          ? (item.quantity * item.landedUnitCost)
          : (item.quantity * item.costPerUnit)
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
        bankAccount: paymentMethod === 'bank' ? selectedBankAccount : null,
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

    if (isEnhancedImportPurchase) {
      invoiceData.pricing = {
        ...invoiceData.pricing,
        importCharges,
        importChargesTotal,
        landedCostTotal: total,
        importAllocationMethod,
        landedCostBreakdown: importAllocatedItems.map((item) => ({
          product: item.product?.id || item.product?._id,
          quantity: item.quantity,
          baseUnitCost: item.costPerUnit,
          allocatedCharge: item.allocatedCharge,
          landedUnitCost: item.landedUnitCost,
        })),
      };
      invoiceData.notes = [notes, '[Import Purchase]'].filter(Boolean).join(' ').trim();
    }

    pendingReceiptLabelPayloadRef.current = null;
    if (printBarcodeLabelsAfterInvoice && !activeEditData?.isEditMode && purchaseItems.length > 0) {
      pendingReceiptLabelPayloadRef.current = { items: [...purchaseItems] };
    }

    // Use appropriate mutation based on edit mode
    if (activeEditData?.isEditMode) {
      handleUpdatePurchaseInvoice(activeEditData.invoiceId, invoiceData);
    } else {
      handleCreatePurchaseInvoice(invoiceData);
    }
  }, [purchaseItems, selectedSupplier, invoiceNumber, autoGenerateInvoice, expectedDelivery, billDate, notes, taxSystemEnabled, subtotal, tax, total, directDiscountAmount, paymentMethod, selectedBankAccount, amountPaid, activeEditData, handleCreatePurchaseInvoice, handleUpdatePurchaseInvoice, printBarcodeLabelsAfterInvoice, isEnhancedImportPurchase, importCharges, importChargesTotal, importAllocationMethod, getImportAllocatedItems]);

  const getDerivedPurchasePaymentStatus = useCallback((invoice) => {
    const totalAmount = Number(invoice?.pricing?.total ?? invoice?.total ?? 0) || 0;
    const paidAmount = Number(
      invoice?.payment?.amountPaid ??
      invoice?.payment?.paidAmount ??
      invoice?.payment?.amount ??
      invoice?.amountPaid ??
      invoice?.amount_paid ??
      0
    ) || 0;
    if (totalAmount <= 0) return 'pending';
    if (paidAmount <= 0) return 'pending';
    if (paidAmount + 0.01 >= totalAmount) return 'paid';
    return 'partial';
  }, []);

  const getPurchasePaymentStatusBadgeClass = useCallback((status) => {
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

  const getSavedPurchaseInvoicesExportData = useCallback(async () => {
    try {
      const res = await fetchPurchaseInvoicesForExport({
        search: savedPurchaseSearchTerm || undefined,
        status: savedPurchaseStatus || undefined,
        dateFrom: savedPurchaseFromDate || undefined,
        dateTo: savedPurchaseToDate || undefined,
        page: 1,
        limit: 10000,
      }).unwrap();

      const top = res?.data ?? res;
      let allRows = [];
      if (Array.isArray(top?.data?.invoices)) allRows = top.data.invoices;
      else if (Array.isArray(top?.invoices)) allRows = top.invoices;
      else if (Array.isArray(top?.data?.purchaseInvoices)) allRows = top.data.purchaseInvoices;
      else if (Array.isArray(top?.purchaseInvoices)) allRows = top.purchaseInvoices;
      else if (Array.isArray(top?.data?.data?.invoices)) allRows = top.data.data.invoices;

      const supplierNameOf = (invoice) =>
        invoice?.supplierInfo?.businessName ||
        invoice?.supplierInfo?.business_name ||
        invoice?.supplierInfo?.companyName ||
        invoice?.supplierInfo?.name ||
        'Unknown';

      const fnFrom = savedPurchaseFromDate || 'all';
      const fnTo = savedPurchaseToDate || 'all';

      return {
        title: 'Purchase Invoices Report',
        filename: `Purchase_Invoices_${fnFrom}_to_${fnTo}.xlsx`,
        company: {
          name: companySettings?.companyName || 'ZARYAB IMPEX',
          address: companySettings?.address || companySettings?.billingAddress || '',
          contact: `${companySettings?.contactNumber || ''} ${companySettings?.email ? '| ' + companySettings.email : ''}`.trim(),
        },
        columns: [
          { header: 'S.No', key: 'sno', width: 8, type: 'number' },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Invoice #', key: 'invoiceNumber', width: 22 },
          { header: 'Supplier', key: 'supplierName', width: 35 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Total Amount', key: 'totalAmount', width: 15, type: 'currency' },
        ],
        data: allRows.map((invoice, i) => ({
          sno: i + 1,
          date: formatDate(invoice?.invoiceDate || invoice?.invoice_date || invoice?.createdAt || invoice?.created_at),
          invoiceNumber: invoice?.invoiceNumber || invoice?.invoice_number || '—',
          supplierName: supplierNameOf(invoice),
          status: String(getDerivedPurchasePaymentStatus(invoice)).toUpperCase(),
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
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Could not load purchase invoices for export');
      return null;
    }
  }, [
    fetchPurchaseInvoicesForExport,
    savedPurchaseSearchTerm,
    savedPurchaseStatus,
    savedPurchaseFromDate,
    savedPurchaseToDate,
    companySettings,
    getDerivedPurchasePaymentStatus,
  ]);

  const handleEditSavedPurchase = useCallback(async (invoice) => {
    try {
      const result = await getPurchaseInvoiceById(invoice?._id || invoice?.id).unwrap();
      const full = result?.invoice || result?.data?.invoice || result?.data || result || invoice;
      setInlineEditData({
        invoiceId: full._id || full.id,
        isEditMode: true,
        supplier: full.supplierInfo || full.supplier,
        invoiceNumber: full.invoiceNumber || full.invoice_number,
        notes: full.notes || '',
        pricing: full.pricing || {},
        invoiceDate: full.invoiceDate || full.invoice_date || full.createdAt,
        items: (full.items || []).map((item) => ({
          product: item.product && typeof item.product === 'object'
            ? item.product
            : { _id: item.product_id || item.product, name: item.name || item.productName || 'Product' },
          quantity: item.quantity || 1,
          unitCost: item.unitCost ?? item.costPerUnit ?? item.unit_price ?? 0,
          totalCost: item.totalCost ?? item.total ?? (Number(item.quantity || 0) * Number(item.unitCost ?? item.costPerUnit ?? 0)),
        })),
        payment: full.payment || {},
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success('Invoice loaded for inline edit');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to load purchase invoice');
    }
  }, [getPurchaseInvoiceById]);

  /** Saved-invoice list uses minimal rows (no line items); load full PI before print preview. */
  const openSavedPurchasePrintPreview = useCallback(
    async (invoice) => {
      const id = invoice?._id || invoice?.id;
      if (!id) {
        setSavedPurchasePrintOrder(invoice);
        setShowSavedPurchasePrintModal(true);
        return;
      }
      try {
        const result = await getPurchaseInvoiceById(id).unwrap();
        const full = result?.invoice || result?.data?.invoice || result?.data || result || invoice;
        setSavedPurchasePrintOrder(full);
        setShowSavedPurchasePrintModal(true);
      } catch (error) {
        toast.error(error?.data?.message || error?.message || 'Failed to load invoice for print');
        setSavedPurchasePrintOrder(invoice);
        setShowSavedPurchasePrintModal(true);
      }
    },
    [getPurchaseInvoiceById]
  );

  const handleDeleteSavedPurchase = useCallback(async (invoice) => {
    const target = invoice ?? purchaseDeleteTarget;
    const id = target?._id || target?.id;
    if (!id) return;
    try {
      await deletePurchaseInvoice(id).unwrap();
      toast.success('Purchase invoice deleted successfully');
      setPurchaseDeleteTarget(null);
      refetchSavedPurchase();
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to delete purchase invoice');
    }
  }, [deletePurchaseInvoice, purchaseDeleteTarget, refetchSavedPurchase]);


  return (
    <AsyncErrorBoundary>
      <div className="space-y-4 lg:space-y-6">
        {/* Modern Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center flex-1 gap-3">
              <div className="flex-shrink-0">
                <h1 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900`}>
                  {isImportPurchase ? 'Import Purchase' : 'Purchase'}
                </h1>
              </div>
              <div className="hidden sm:block h-7 w-px bg-gray-200"></div>
              <div className="flex-1 min-w-0 sm:min-w-[220px] lg:max-w-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
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
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider underline"
                        title="Change supplier"
                      >
                        Change
                      </button>
                    )}
                  </div>
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
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider underline"
                    title="Refresh supplier list and outstanding balance"
                  >
                    Refresh
                  </button>
                </div>
                <SupplierPartySelect
                  innerRef={supplierSearchRef}
                  items={suppliers?.data?.suppliers || suppliers?.suppliers || []}
                  selectedItem={selectedSupplier}
                  onSelect={handleSupplierSelect}
                  onSearch={setSupplierSearchTerm}
                  loading={suppliersLoading}
                  searchValue={supplierSearchTerm}
                  emptyMessage={supplierSearchTerm.length > 0 ? "No suppliers found" : "Start typing to search suppliers..."}
                  canViewBalance={canViewSupplierBalance}
                  showSecondaryName
                />
              </div>
            </div>

            <SupplierSummaryStrip
              supplier={selectedSupplier}
              canViewBalance={canViewSupplierBalance}
              canViewPhone={canViewSupplierPhone}
              outstandingOverride={supplierOutstanding}
              roundOutstanding
            />
          </div>
        </div>

        {isImportPurchase && !isEnhancedImportPurchase && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Import duties and landed-cost allocation are currently OFF in Settings. This form is using old purchase behavior.
          </div>
        )}

        {/* Combined Product Selection and Cart Section */}
        <ProductSelectionCartSection
          searchSectionClassName="mb-2"
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
              key={purchaseSearchResetKey}
              onAddProduct={addToPurchase}
              onRefetchReady={setRefetchProducts}
              onFocusReady={handlePurchaseProductSearchFocusReady}
              allowOutOfStock
            />
          }
          isEmpty={purchaseItems.length === 0}
          emptyIcon={Package}
          emptyText="No items in cart"
        >
          <CartItemsTableSection
            className="pt-2"
            desktopHeader={null}
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
                      <DocumentNumberField
                        id="autoGenerateInvoicePurchaseMobile"
                        label="Invoice Number"
                        manualPlaceholder="Enter invoice number"
                        autoGenerate={autoGenerateInvoice}
                        onAutoGenerateChange={(checked) => {
                          setAutoGenerateInvoice(checked);
                          if (checked && selectedSupplier) {
                            setInvoiceNumber(generateInvoiceNumber(selectedSupplier));
                          }
                        }}
                        value={invoiceNumber}
                        onChange={setInvoiceNumber}
                        onRegenerate={() => {
                          if (selectedSupplier) {
                            setInvoiceNumber(generateInvoiceNumber(selectedSupplier));
                          }
                        }}
                        containerClassName=""
                        inputClassName="w-full pr-20 h-10 text-sm"
                      />
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
                      <OrderNotesField
                        value={notes}
                        onChange={setNotes}
                        density="comfortable"
                      />
                    </div>

                    <div className="hidden md:flex flex-wrap gap-3 items-end justify-start">
                      <DocumentNumberField
                        id="autoGenerateInvoicePurchase"
                        label="Invoice Number"
                        manualPlaceholder="Enter invoice number"
                        autoGenerate={autoGenerateInvoice}
                        onAutoGenerateChange={(checked) => {
                          setAutoGenerateInvoice(checked);
                          if (checked && selectedSupplier) {
                            setInvoiceNumber(generateInvoiceNumber(selectedSupplier));
                          }
                        }}
                        value={invoiceNumber}
                        onChange={setInvoiceNumber}
                        onRegenerate={() => {
                          if (selectedSupplier) {
                            setInvoiceNumber(generateInvoiceNumber(selectedSupplier));
                          }
                        }}
                      />
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
                      <OrderNotesField
                        value={notes}
                        onChange={setNotes}
                      />
                    </div>
                  </>
                )}
              </OrderDetailsSection>
            </OrderCheckoutCard>

            <OrderCheckoutCard
              className={`mt-0 ml-0 max-w-none min-w-0 w-full border-slate-200 bg-none bg-slate-50 shadow-sm ring-0 ${showPurchaseDetailsFields ? 'order-2' : 'order-1'
                }`}
            >
              <OrderSummaryBar>
                <div className="flex items-center gap-3">
                  <LoadingButton
                    onClick={handleProcessPurchase}
                    isLoading={false}
                    variant="default"
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 text-white border-none h-8 px-4 font-bold"
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    {activeEditData?.isEditMode ? 'Update' : 'Complete'}
                  </LoadingButton>

                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
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
                          setSelectedBankAccount('');
                          setBillDate(getLocalDateString());
                          toast.success('Cart cleared');
                        }}
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        title="Clear Cart"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {purchaseItems.length > 0 && (
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
                                  bankAccount: paymentMethod === 'bank' ? selectedBankAccount : null,
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
                                  bankAccount: paymentMethod === 'bank' ? selectedBankAccount : null,
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
                  </div>
                </div>
              </OrderSummaryBar>
              <OrderSummaryContent className="bg-none bg-slate-50">
                <div className="space-y-2">
                  {isEnhancedImportPurchase && (
                    <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Import Duties & Charges</div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Allocate By</label>
                          <select
                            value={importAllocationMethod}
                            onChange={(e) => setImportAllocationMethod(e.target.value)}
                            className="h-8 rounded border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700"
                          >
                            <option value={IMPORT_ALLOCATION_METHODS.BY_VALUE}>Value</option>
                            <option value={IMPORT_ALLOCATION_METHODS.BY_QTY}>Quantity</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        {[
                          { key: 'customDuty', label: 'Custom Duty' },
                          { key: 'salesTax', label: 'Sales Tax' },
                          { key: 'gst', label: 'GST' },
                          { key: 'additionalSalesTax', label: 'Additional Sales Tax' },
                          { key: 'freight', label: 'Freight' },
                          { key: 'demurrage', label: 'Demurrage' },
                          { key: 'loadingUnloading', label: 'Loading/Unloading' },
                          { key: 'otherDuties', label: 'Other Duties' },
                          { key: 'otherCharges', label: 'Other Charges' },
                        ].map((field) => (
                          <div key={field.key} className="flex flex-col">
                            <label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">{field.label}</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={importCharges[field.key] ?? 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setImportCharges((prev) => ({ ...prev, [field.key]: Number.isFinite(val) ? val : 0 }));
                              }}
                              className="h-8"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                        <span className="text-xs font-medium text-slate-600">Import Charges Total</span>
                        <span className="text-sm font-bold text-slate-900">{importChargesTotal.toFixed(2)}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Charges will be allocated into item landed unit cost by {importAllocationMethod === IMPORT_ALLOCATION_METHODS.BY_QTY ? 'quantity' : 'item value'}.
                      </div>
                    </div>
                  )}
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
                  {selectedSupplier && (() => {
                    return (
                      <div className="mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
                          {/* 1. Subtotal */}
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Subtotal</span>
                            <div className="h-8 flex items-center px-2 bg-slate-50 border border-gray-200 rounded-md text-xl font-semibold tabular-nums text-foreground">
                              {subtotal.toFixed(2)}
                            </div>
                          </div>

                          {/* 2. Manual Discount */}
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Discount</label>
                              <select
                                value={directDiscount.type}
                                onChange={(e) => setDirectDiscount({ ...directDiscount, type: e.target.value })}
                                className="border-none bg-transparent p-0 text-[10px] font-bold text-primary-600 focus:ring-0 cursor-pointer"
                              >
                                <option value="amount">Amt</option>
                                <option value="percentage">%</option>
                              </select>
                            </div>
                            <Input
                              type="number"
                              autoComplete="off"
                              placeholder="0"
                              value={directDiscount.value || ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setDirectDiscount({ ...directDiscount, value });
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-full h-8 px-2 border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-primary-400 text-sm font-medium shadow-none"
                            />
                          </div>

                          {/* 3. Purchase Total */}
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                              {isEnhancedImportPurchase ? 'Landed Total' : 'Total'}
                            </span>
                            <div className="h-8 flex items-center px-2 bg-slate-50 border border-gray-200 rounded-md text-xl font-bold tabular-nums text-primary">
                              {total.toFixed(2)}
                            </div>
                          </div>

                          {/* 4. Previous Outstanding */}
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Outstanding</span>
                            <div className="h-8 flex items-center px-2 bg-slate-50 border border-gray-200 rounded-md text-xl font-semibold tabular-nums text-foreground">
                              {supplierOutstanding.toFixed(2)}
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
                                onChange={(method, bankId) => {
                                  setPaymentMethod(method);
                                  setSelectedBankAccount(bankId);
                                }}
                              />
                            </div>
                            <Input
                              type="number"
                              step="0.01"
                              autoComplete="off"
                              value={amountPaid}
                              onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              className="w-full h-8 px-2 border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-primary-400 text-sm font-medium shadow-none"
                              placeholder="0"
                            />
                          </div>

                          {/* 6. Total Payables */}
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-foreground mb-1">Payables</span>
                            <div className="h-8 flex items-center px-2 bg-slate-50 border border-gray-200 rounded-md text-xl font-bold tabular-nums text-primary">
                              {totalPayables.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        {isEnhancedImportPurchase && (
                          <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                            Landed cost includes item subtotal, tax, and all import duties/charges.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <OrderCheckoutActions className="mt-4 border-0 pt-0">
                  {!activeEditData?.isEditMode && purchaseItems.length > 0 && (
                    <div className="flex items-center space-x-2 px-2 mb-2">
                      <Input
                        type="checkbox"
                        id="printLabelsAfterPurchase"
                        checked={printBarcodeLabelsAfterInvoice}
                        onChange={(e) => setPrintBarcodeLabelsAfterInvoice(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="printLabelsAfterPurchase" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Print labels after purchase
                      </label>
                    </div>
                  )}
                </OrderCheckoutActions>
              </OrderSummaryContent>
            </OrderCheckoutCard>
          </div>
        )}

        <div className="mt-4 card">
          <div className="card-header py-3">
            <div className="flex flex-col gap-3">
              {/* Row 1: Title, Records (desktop), and Refresh */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Purchase Invoices</h3>
                  <span className="hidden sm:inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    {savedPurchasePagination.total ?? savedPurchaseInvoices.length} records
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => refetchSavedPurchase()}
                    className="p-2 text-gray-400 transition-colors hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSavedPurchaseLoading ? 'animate-spin' : ''}`} />
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
                        startDate={savedPurchaseFromDate}
                        endDate={savedPurchaseToDate}
                        onDateChange={(start, end) => {
                          setSavedPurchaseFromDate(start || '');
                          setSavedPurchaseToDate(end || '');
                          setSavedPurchasePage(1);
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
                        getData={getSavedPurchaseInvoicesExportData} 
                        label="" 
                        className="h-10 w-10 p-0 hidden sm:flex"
                      />
                      <PdfExportButton 
                        ref={pdfExportRef}
                        getData={getSavedPurchaseInvoicesExportData} 
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
                        onClick={() => refetchSavedPurchase()}
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
                        id="saved-pi-search"
                        type="text"
                        placeholder="Invoice / supplier…"
                        value={savedPurchaseSearchTerm}
                        onChange={(e) => {
                          setSavedPurchaseSearchTerm(e.target.value);
                          setSavedPurchasePage(1);
                        }}
                        className="input h-10 w-full pl-9 bg-gray-50 border-gray-200 focus:bg-white text-sm"
                      />
                    </div>
                    <div className="w-full sm:w-48">
                      <select
                        id="saved-pi-status"
                        value={savedPurchaseStatus}
                        onChange={(e) => {
                          setSavedPurchaseStatus(e.target.value);
                          setSavedPurchasePage(1);
                        }}
                        className="input h-10 w-full bg-gray-50 border-gray-200 text-sm"
                      >
                        <option value="">All statuses</option>
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
            {isSavedPurchaseLoading ? (
              <div className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                <p className="mt-2 text-gray-500">Loading purchase invoices...</p>
              </div>
            ) : savedPurchaseError ? (
              <div className="p-8 text-center text-red-600">
                <p>{savedPurchaseError?.data?.message || 'Error loading purchase invoices'}</p>
              </div>
            ) : savedPurchaseInvoices.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No purchase invoices found for the selected criteria.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {savedPurchaseInvoices.map((invoice, index) => {
                        const invoiceId = invoice?._id || invoice?.id || `saved-pi-${index}`;
                        const invoiceNumber = invoice?.invoiceNumber || invoice?.invoice_number || '—';
                        const supplierName = invoice?.supplierInfo?.businessName || invoice?.supplierInfo?.business_name || invoice?.supplierInfo?.companyName || invoice?.supplierInfo?.name || 'Unknown';
                        const invoiceDate = invoice?.invoiceDate || invoice?.invoice_date || invoice?.createdAt || invoice?.created_at;
                        const totalValue = Number(invoice?.pricing?.total ?? invoice?.total ?? 0) || 0;
                        const paymentStatus = getDerivedPurchasePaymentStatus(invoice);
                        return (
                          <tr key={invoiceId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {invoiceDate ? new Date(invoiceDate).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{invoiceNumber}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{supplierName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPurchasePaymentStatusBadgeClass(paymentStatus)}`}>
                                {paymentStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{totalValue.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => openSavedPurchasePrintPreview(invoice)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Print"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                <ExcelExportButton
                                  getData={async () => {
                                    const printPerms = getPartyPermissions('supplier');
                                    try {
                                      const result = await getPurchaseInvoiceById(invoice?._id || invoice?.id).unwrap();
                                      const freshInvoice = result?.invoice || result?.data?.invoice || result?.data || result || invoice;
                                      const payload = getInvoicePdfPayload(freshInvoice, companySettings, 'Purchase Invoice', 'Supplier', null, printPerms);
                                      return { ...payload, filename: `Purchase_Invoice_${invoiceNumber}.xlsx` };
                                    } catch {
                                      return { ...getInvoicePdfPayload(invoice, companySettings, 'Purchase Invoice', 'Supplier', null, printPerms), filename: `Purchase_Invoice_${invoiceNumber}.xlsx` };
                                    }
                                  }}
                                  label=""
                                  className="p-1 bg-transparent border-none shadow-none hover:bg-transparent text-emerald-600 hover:text-emerald-800 px-1 py-1"
                                />
                                <PdfExportButton
                                  getData={async () => {
                                    const printPerms = getPartyPermissions('supplier');
                                    try {
                                      const result = await getPurchaseInvoiceById(invoice?._id || invoice?.id).unwrap();
                                      const freshInvoice = result?.invoice || result?.data?.invoice || result?.data || result || invoice;
                                      return getInvoicePdfPayload(freshInvoice, companySettings, 'Purchase Invoice', 'Supplier', null, printPerms);
                                    } catch {
                                      return getInvoicePdfPayload(invoice, companySettings, 'Purchase Invoice', 'Supplier', null, printPerms);
                                    }
                                  }}
                                  label=""
                                  className="p-1 bg-transparent border-none shadow-none hover:bg-transparent text-red-600 hover:text-red-800 px-1 py-1"
                                />
                                <button
                                  onClick={() => handleEditSavedPurchase(invoice)}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setPurchaseDeleteTarget(invoice)}
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
                  page={Number(savedPurchasePagination.current ?? savedPurchasePage) || 1}
                  totalPages={Math.max(1, Number(savedPurchasePagination.pages) || 1)}
                  onPageChange={(p) => setSavedPurchasePage(p)}
                  totalItems={savedPurchasePagination.total}
                  limit={savedPurchaseLimit}
                />
              </>
            )}
          </div>
        </div>

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

        <PrintModal
          isOpen={showSavedPurchasePrintModal}
          onClose={() => {
            setShowSavedPurchasePrintModal(false);
            setSavedPurchasePrintOrder(null);
          }}
          orderData={savedPurchasePrintOrder}
          documentTitle="Purchase Invoice"
          partyLabel="Supplier"
        />

        <BaseModal
          isOpen={!!purchaseDeleteTarget}
          onClose={() => setPurchaseDeleteTarget(null)}
          title="Delete Purchase Invoice"
          maxWidth="sm"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button type="button" variant="secondary" onClick={() => setPurchaseDeleteTarget(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={() => handleDeleteSavedPurchase()}>
                Delete
              </Button>
            </div>
          }
        >
          <p className="text-sm text-gray-700">
            Are you sure you want to delete invoice{' '}
            <span className="font-semibold">
              {purchaseDeleteTarget?.invoiceNumber || purchaseDeleteTarget?.invoice_number || purchaseDeleteTarget?._id || purchaseDeleteTarget?.id}
            </span>
            ? This action cannot be undone.
          </p>
        </BaseModal>

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

        <DuplicateLineItemMergeModal
          isOpen={!!purchaseDuplicateMerge}
          onClose={() => {
            setPurchaseDuplicateMerge(null);
            refocusPurchaseProductSearch();
          }}
          onConfirm={handlePurchaseDuplicateMergeConfirm}
          productName={purchaseDuplicateMerge?.displayName ?? ''}
          currentQuantity={purchaseDuplicateMerge?.currentQuantity ?? 0}
          quantityToAdd={purchaseDuplicateMerge?.addQuantity ?? 0}
          newTotalQuantity={
            (purchaseDuplicateMerge?.currentQuantity ?? 0) + (purchaseDuplicateMerge?.addQuantity ?? 0)
          }
          title="Duplicate product"
          scopeLabel="purchase"
          confirmText="Update quantity"
        />

        <ProductImagePreviewModal
          product={previewImageProduct}
          onClose={() => setPreviewImageProduct(null)}
        />

      </div>
    </AsyncErrorBoundary>
  );
};
