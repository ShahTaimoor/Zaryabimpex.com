import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Camera, X } from 'lucide-react';
import { productsApi, useLazyGetLastPurchasePriceQuery, useLazyGetProductsQuery } from '@/store/services/productsApi';
import { productVariantsApi, useLazyGetVariantsQuery } from '@/store/services/productVariantsApi';
import { useDebouncedPosProductSearch } from '@/hooks/useDebouncedPosProductSearch';
import { SearchableDropdown } from '@/components/SearchableDropdown';
import { DualUnitQuantityInput } from '@/components/DualUnitQuantityInput';
import { hasDualUnit, getPiecesPerBox, piecesToBoxesAndPieces, formatStockDualLabel } from '@/utils/dualUnitUtils';
import { handleApiError } from '@/utils/errorHandler';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/LoadingSpinner';
import BarcodeScanner from '@/components/BarcodeScanner';
import BaseModal from '@/components/BaseModal';
import { compressImageFileToDataUrl } from '@/utils/imageCompress';

/** Max rows shown in dropdown (server search caps higher; we slice in hook). */
const PRODUCT_DROPDOWN_LIMIT = 50;
/** Cap manual line images stored as data URLs on sales.items */
const MAX_MANUAL_IMAGE_BYTES = 5 * 1024 * 1024;

function ProductSearchComponent({
  onAddProduct,
  selectedCustomer,
  showCostPrice,
  onLastPurchasePriceFetched,
  hasCostPricePermission,
  priceType,
  onRefetchReady,
  dualUnitShowBoxInput = true,
  dualUnitShowPiecesInput = true,
  allowOutOfStock = false,
  allowSaleWithoutProduct = false,
  allowManualCostPrice = false,
}) {
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(0);
  const [customRate, setCustomRate] = useState('');
  const [calculatedRate, setCalculatedRate] = useState(0);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [searchKey, setSearchKey] = useState(0); // Key to force re-render
  const [lastPurchasePrice, setLastPurchasePrice] = useState(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showProductImages, setShowProductImages] = useState(localStorage.getItem('showProductImagesUI') !== 'false');
  const [isManualMode, setIsManualMode] = useState(false); // New state for manual entry
  const [manualName, setManualName] = useState(''); // New state for manual name
  const [manualCost, setManualCost] = useState(''); // New state for manual cost
  /** Data URL for optional photo on manual line items (stored on sale JSON). */
  const [manualProductImage, setManualProductImage] = useState(null);
  const productSearchRef = useRef(null);
  const manualNameRef = useRef(null);
  const manualImageInputRef = useRef(null);
  const dispatch = useDispatch();

  const [triggerProducts] = useLazyGetProductsQuery();
  const [triggerVariants] = useLazyGetVariantsQuery();
  const [getLastPurchasePrice] = useLazyGetLastPurchasePriceQuery();

  const {
    items: products,
    isLoading: productsLoading,
    emptyMessage: emptySearchMessage,
  } = useDebouncedPosProductSearch(productSearchTerm, { dropdownLimit: PRODUCT_DROPDOWN_LIMIT });

  const refreshProductSearchCache = useCallback(() => {
    dispatch(
      productsApi.util.invalidateTags([
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
      ])
    );
    dispatch(productVariantsApi.util.invalidateTags([{ type: 'Products', id: 'VARIANTS_LIST' }]));
  }, [dispatch]);

  useEffect(() => {
    const handleConfigChange = () => {
      setShowProductImages(localStorage.getItem('showProductImagesUI') !== 'false');
    };
    window.addEventListener('productImagesConfigChanged', handleConfigChange);
    return () => window.removeEventListener('productImagesConfigChanged', handleConfigChange);
  }, []);

  useEffect(() => {
    if (onRefetchReady && typeof onRefetchReady === 'function') {
      onRefetchReady(refreshProductSearchCache);
    }
  }, [onRefetchReady, refreshProductSearchCache]);

  const getCostPrice = (product) => {
    if (!product) return 0;

    const pricing = product.pricing || {};
    const normalizedCost = pricing.cost
      ?? pricing.costPrice
      ?? pricing.cost_price
      ?? pricing.purchasePrice
      ?? pricing.purchase_price
      ?? pricing.wholesaleCost
      ?? product.pricing?.cost_price
      ?? product.costPrice
      ?? product.cost_price
      ?? product.purchasePrice
      ?? product.purchase_price;

    const numericCost = Number(normalizedCost);
    return Number.isFinite(numericCost) ? numericCost : 0;
  };

  const calculatePrice = (product, priceType) => {
    if (!product) return 0;

    // Handle both regular products and variants
    const pricing = product.pricing || {};

    if (priceType === 'cost') {
      return getCostPrice(product);
    } else if (priceType === 'distributor') {
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

  /**
   * Universal handler for detected barcodes (USB or Camera).
   * Fetches the product and auto-adds to cart if a single match is found.
   */
  const handleBarcodeSubmit = useCallback(async (barcodeValue) => {
    if (!barcodeValue || isAddingToCart) return;

    try {
      setIsAddingToCart(true);
      
      // Fetch both products and variants by code
      const [pRes, vRes] = await Promise.all([
        triggerProducts({ code: barcodeValue, status: 'active', limit: 2 }).unwrap(),
        triggerVariants({ code: barcodeValue, status: 'active', limit: 2 }).unwrap()
      ]);

      const foundProducts = pRes?.products ?? pRes?.data?.products ?? [];
      const foundVariants = vRes?.variants ?? vRes?.data?.variants ?? [];
      
      // Combine results
      const totalMatches = [
        ...foundProducts.map(p => ({ ...p, isVariant: false })),
        ...foundVariants.map(v => ({ 
          ...v, 
          isVariant: true,
          name: v.displayName || v.variantName || `${v.baseProduct?.name || ''} - ${v.variantValue || ''}`.trim()
        }))
      ];

      if (totalMatches.length === 0) {
        toast.error(`No product found with barcode: ${barcodeValue}`);
        setProductSearchTerm(barcodeValue); // Set search term so user can see what failed
        return;
      }

      if (totalMatches.length > 1) {
        toast.warning(`Multiple products found for barcode: ${barcodeValue}. Please select manually.`);
        setProductSearchTerm(barcodeValue);
        return;
      }

      // Single match found - Auto Add to cart
      const product = totalMatches[0];
      
      // Check stock if not allowed to oversell
      const currentStock = product.inventory?.currentStock || 0;
      if (!allowOutOfStock && currentStock === 0) {
        toast.error(`${product.name} is out of stock.`);
        return;
      }

      // Calculate price based on type
      const unitPrice = calculatePrice(product, priceType);
      
      // Check for loss warning (sale < cost)
      const costPrice = getCostPrice(product); // Simplified for auto-add to avoid blocking confirm dialogs
      if (unitPrice < costPrice) {
        toast.warning(`Auto-added ${product.name} with price BELOW cost!`, { duration: 4000 });
      }

      // Add to cart
      const ppb = getPiecesPerBox(product);
      const { boxes, pieces } = ppb ? piecesToBoxesAndPieces(1, ppb) : {};
      
      onAddProduct({
        product,
        quantity: 1,
        ...(ppb && { boxes, pieces }),
        unitPrice: unitPrice
      });

      toast.success(`Scanned: ${product.name}`, {
        icon: '✅',
        duration: 2000,
        position: 'top-center'
      });

      // Clear search and focus back
      setProductSearchTerm('');
      setSelectedProduct(null);
      setIsAddingProduct(false);

    } catch (error) {
      handleApiError(error, 'Barcode Search');
    } finally {
      setIsAddingToCart(false);
      // Ensure focus returns to search field for next scan
      setTimeout(() => productSearchRef.current?.focus({ preventScroll: true }), 100);
    }
  }, [triggerProducts, triggerVariants, priceType, allowOutOfStock, onAddProduct, isAddingToCart]);

  // USB Barcode Scanner Detection (Keyboard Emulation)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e) => {
      // Ignore modifier keys
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Scanners usually send keys very fast (<30ms between keys)
      // If time between keys is short, it's likely a scanner
      if (timeDiff < 50) {
        if (e.key === 'Enter') {
          if (buffer.length >= 4) {
            e.preventDefault();
            e.stopPropagation();
            const scannedValue = buffer;
            buffer = '';
            handleBarcodeSubmit(scannedValue);
          } else {
            buffer = '';
          }
        } else if (e.key.length === 1) {
          buffer += e.key;
        }
      } else {
        // Too slow, probably manual typing. Clear buffer.
        // But if it was a single character after a long pause, it might be the START of a scan
        if (e.key.length === 1) {
          buffer = e.key;
        } else {
          buffer = '';
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [handleBarcodeSubmit]);

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

  const handleManualImageFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_MANUAL_IMAGE_BYTES) {
      toast.error('Image must be 5 MB or smaller');
      e.target.value = '';
      return;
    }
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxDim: 1600,
        maxBytes: MAX_MANUAL_IMAGE_BYTES,
        quality: 0.85,
      });
      setManualProductImage(dataUrl);
    } catch {
      toast.error('Could not process image');
    }
    e.target.value = '';
  }, []);

  const handleAddToCart = async () => {
    if (isManualMode) {
      if (!manualName.trim()) {
        toast.error('Please enter a product name');
        if (manualNameRef.current) manualNameRef.current.focus({ preventScroll: true });
        return;
      }
      if (quantity <= 0) {
        toast.error('Please enter a valid quantity');
        return;
      }
      if (!customRate || parseInt(customRate) < 0) {
        toast.error('Please enter a valid rate');
        return;
      }

      setIsAddingToCart(true);
      try {
        const unitPrice = parseInt(customRate) || 0;
        const unitCost = (allowManualCostPrice && manualCost) ? parseInt(manualCost) : 0;

        const manualProduct = {
          _id: `manual_${Date.now()}`,
          id: `manual_${Date.now()}`,
          name: manualName.trim(),
          isManual: true,
          inventory: { currentStock: 999999, reorderPoint: 0 },
          pricing: { 
            retail: unitPrice, 
            wholesale: unitPrice, 
            cost: unitCost,
            cost_price: unitCost
          },
          ...(manualProductImage ? { imageUrl: manualProductImage } : {}),
        };

        onAddProduct({
          product: manualProduct,
          quantity: quantity,
          unitPrice: unitPrice
        });

        // Reset manual form but keep mode enabled if user wants multiple manual items
        setManualName('');
        setQuantity(0);
        setCustomRate('');
        setManualCost('');
        
        if (manualNameRef.current) {
          manualNameRef.current.focus({ preventScroll: true });
        }
        toast.success(`Manual item ${manualProduct.name} added to cart`);
      } finally {
        setIsAddingToCart(false);
      }
      return;
    }

    if (!selectedProduct) return;

    // Validate that rate is filled
    if (!customRate || parseInt(customRate) < 0) {
      toast.error('Please enter a valid rate');
      return;
    }

    // Get display name for error messages
    const displayName = selectedProduct.isVariant
      ? (selectedProduct.displayName || selectedProduct.variantName || selectedProduct.name)
      : selectedProduct.name;

    const currentStock = selectedProduct.inventory?.currentStock || 0;
    if (!allowOutOfStock && currentStock === 0) {
      toast.error(`${displayName} is out of stock and cannot be added to the invoice.`);
      return;
    }

    if (quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (!allowOutOfStock && quantity > currentStock) {
      toast.error(`Cannot add ${quantity} units. Only ${currentStock} units available in stock.`);
      return;
    }

    setIsAddingToCart(true);
    try {
      // Use the rate from the input field
      const unitPrice = parseInt(customRate) || Math.round(calculatedRate);

      // Check if sale price is less than cost price (always check, regardless of showCostPrice)
      const costPrice = lastPurchasePrice !== null ? lastPurchasePrice : getCostPrice(selectedProduct);
      if (costPrice !== undefined && costPrice !== null && unitPrice < costPrice) {
        const loss = costPrice - unitPrice;
        const lossPercent = ((loss / costPrice) * 100).toFixed(1);
        const shouldProceed = window.confirm(
          `⚠️ WARNING: Sale price (${unitPrice}) is below cost price (${Math.round(costPrice)}).\n\n` +
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

      const ppb = getPiecesPerBox(selectedProduct);
      const { boxes, pieces } = ppb ? piecesToBoxesAndPieces(quantity, ppb) : {};
      onAddProduct({
        product: selectedProduct,
        quantity: quantity,
        ...(ppb && { boxes, pieces }),
        unitPrice: unitPrice
      });

      // Reset form
      setSelectedProduct(null);
      setQuantity(0);
      setCustomRate('');
      setCalculatedRate(0);
      setIsAddingProduct(false);

      // Clear search term and force re-render
      setProductSearchTerm('');
      setSearchKey(prev => prev + 1);

      // Focus back to product search input
      setTimeout(() => {
        if (productSearchRef.current) {
          productSearchRef.current.focus({ preventScroll: true });
        }
      }, 100);

      // Show success message
      const priceLabel = priceType === 'cost'
        ? 'cost'
        : selectedCustomer?.businessType === 'wholesale'
          ? 'wholesale'
          : selectedCustomer?.businessType === 'distributor'
            ? 'distributor'
            : 'retail';
      toast.success(`${selectedProduct.name} added to cart at ${priceLabel} price: ${Math.round(unitPrice)}`);
    } catch (error) {
      handleApiError(error, 'Product Price Check');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (isManualMode || isAddingProduct) {
        e.preventDefault();
        handleAddToCart();
      }
    } else if (e.key === 'Escape') {
      if (isManualMode) {
        e.preventDefault();
        setIsManualMode(false);
        setIsAddingProduct(false);
        setManualName('');
        setManualCost('');
        setManualProductImage(null);
        setQuantity(0);
        setCustomRate('');
        setTimeout(() => productSearchRef.current?.focus({ preventScroll: true }), 100);
      } else if (isAddingProduct) {
        e.preventDefault();
        setSelectedProduct(null);
        setQuantity(0);
        setCustomRate('');
        setCalculatedRate(0);
        setIsAddingProduct(false);
      }
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

    if (priceType === 'cost') {
      unitPrice = getCostPrice(product);
      priceLabel = 'Cost';
    } else if (priceType === 'wholesale') {
      unitPrice = pricing.wholesale || pricing.retail || 0;
      priceLabel = 'Wholesale';
    } else if (priceType === 'retail') {
      unitPrice = pricing.retail || 0;
      priceLabel = 'Retail';
    }

    const purchasePrice = getCostPrice(product);

    // Show variant indicator
    const variantInfo = product.isVariant
      ? <span className="text-xs text-blue-600 font-semibold">({product.variantType}: {product.variantValue})</span>
      : null;

    return (
      <div className="flex items-center justify-between w-full gap-3">
        <div className="flex items-center gap-3">
          {product?.imageUrl && showProductImages && (
            <div className="h-10 w-10 flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200">
              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex flex-col">
            <div className="font-medium">{displayName}</div>
            {variantInfo && <div className="text-xs text-gray-500">{variantInfo}</div>}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`text-sm ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-orange-600' : 'text-gray-600'}`}>
            Stock: {inventory.currentStock || 0}
          </div>
          {showCostPrice && hasCostPricePermission && (purchasePrice !== undefined && purchasePrice !== null) && (
            <div className="text-sm text-red-600 font-medium">Cost: {Math.round(purchasePrice)}</div>
          )}
          <div className="text-sm text-gray-600">{priceLabel}: {Math.round(unitPrice)}</div>
        </div>
      </div>
    );
  };

  // Fit dual-unit quantity (box + qty) in one row: 12 cols total
  const dualUnit = hasDualUnit(selectedProduct);
  const selectedPpb = getPiecesPerBox(selectedProduct);
  const selectedStockPieces = Number(selectedProduct?.inventory?.currentStock || 0);
  const selectedBoxCount = selectedPpb ? piecesToBoxesAndPieces(quantity, selectedPpb).boxes : 0;
  const quantityInputMax = allowOutOfStock ? undefined : selectedProduct?.inventory?.currentStock;
  const searchColClass =
    dualUnit && showCostPrice && hasCostPricePermission
      ? 'col-span-5'
      : dualUnit
        ? 'col-span-6'
        : showCostPrice && hasCostPricePermission
          ? 'col-span-6'
          : 'col-span-7';
  /** Dual-unit uses two regular-width columns: Box + Qty */
  const quantityColClass = dualUnit ? 'col-span-2' : 'col-span-1';

  return (
    <div className="space-y-4">
      {/* Product Selection - Responsive Layout */}
      <div>
        {/* Mobile Layout */}
        <div className="md:hidden space-y-3">
          {/* Product Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isManualMode ? 'Manual Item Details' : 'Product Search'}
            </label>
            <div className="relative flex space-x-2">
              {!isManualMode ? (
                <>
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
                      loading={productsLoading}
                      emptyMessage={emptySearchMessage}
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
                  {allowSaleWithoutProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualMode(true);
                        setIsAddingProduct(true);
                        setSelectedProduct(null);
                        setCalculatedRate(0);
                        setTimeout(() => manualNameRef.current?.focus({ preventScroll: true }), 100);
                      }}
                      className="px-3 py-2 border border-blue-300 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors flex items-center justify-center flex-shrink-0 text-sm font-medium"
                      title="Add manual item"
                    >
                      <span>Manual</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex space-x-2">
                    <Input
                      ref={manualNameRef}
                      placeholder="Enter manual product name..."
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualMode(false);
                        setIsAddingProduct(false);
                        setManualName('');
                        setManualCost('');
                        setManualProductImage(null);
                        setTimeout(() => productSearchRef.current?.focus({ preventScroll: true }), 100);
                      }}
                      className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={manualImageInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={handleManualImageFile}
                    />
                    {manualProductImage ? (
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                        <img src={manualProductImage} alt="" width={40} height={40} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                          onClick={() => setManualProductImage(null)}
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => manualImageInputRef.current?.click()}
                      className="rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {manualProductImage ? 'Change photo' : 'Photo (optional)'}
                    </button>
                    <span className="text-[10px] text-gray-400">Max 5 MB</span>
                  </div>
                </div>
              )}
              {selectedProduct?.imageUrl && !isManualMode && showProductImages && (
                <div 
                  className="h-10 w-10 flex-shrink-0 bg-gray-50 rounded-md overflow-hidden border border-gray-300 cursor-pointer hover:border-primary-500 transition-colors group relative"
                  onClick={() => setShowImagePreview(true)}
                  title="Click to view full size"
                >
                  <img src={selectedProduct.imageUrl} alt="" width={40} height={40} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                    <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fields Grid - 2 columns on mobile */}
          <div className="grid grid-cols-2 gap-3">
            {/* Stock */}
            {!isManualMode && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Stock
                </label>
                <span
                  className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-2 rounded border border-gray-200 block text-center min-h-[2.5rem] flex flex-col items-center justify-center gap-0.5 leading-tight"
                  title={selectedProduct ? `Available stock (pieces)` : ''}
                >
                  {selectedProduct ? (
                    hasDualUnit(selectedProduct) ? (
                      <>
                        <span className="text-xs">{formatStockDualLabel(selectedProduct.inventory?.currentStock ?? 0, selectedProduct)}</span>

                      </>
                    ) : (
                      <span>{selectedProduct.inventory?.currentStock ?? 0} pcs</span>
                    )
                  ) : (
                    '0'
                  )}
                </span>
              </div>
            )}

            {/* Amount */}
            <div className={isManualMode ? 'col-span-1' : ''}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Amount
              </label>
              <Input
                type="text"
                readOnly
                value={isAddingProduct ? Math.round(quantity * parseInt(customRate || 0)) : 0}
                onFocus={(e) => e.target.select()}
                className="text-center h-10 bg-gray-100 font-semibold text-gray-700"
              />
            </div>

            {/* Box + Qty (dual unit): no parent "Quantity" label — matches cart columns */}
            <div className={(!isManualMode && dualUnit) ? 'col-span-2' : ''}>
              {(!isManualMode && !dualUnit) || isManualMode ? (
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Quantity
                </label>
              ) : null}
              {!isManualMode && dualUnit ? (
                (dualUnitShowBoxInput || dualUnitShowPiecesInput) ? (
                  <div className={`grid ${dualUnitShowBoxInput && dualUnitShowPiecesInput ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                    {dualUnitShowBoxInput && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Box</label>
                        <Input
                          type="number"
                          min="0"
                          value={quantity === 0 ? '' : selectedBoxCount}
                          onChange={(e) => {
                            const boxVal = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const currentPieces = dualUnitShowPiecesInput
                              ? piecesToBoxesAndPieces(quantity, selectedPpb || 1).pieces
                              : 0;
                            const raw = boxVal * (selectedPpb || 1) + currentPieces;
                            const capped = allowOutOfStock ? raw : Math.min(raw, selectedStockPieces);
                            setQuantity(Math.max(1, capped || 0));
                          }}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={handleKeyDown}
                          className="text-center h-10"
                        />
                      </div>
                    )}
                    {dualUnitShowPiecesInput && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
                        <Input
                          type="number"
                          min="1"
                          value={quantity || ''}
                          onChange={(e) => {
                            const raw = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const capped = allowOutOfStock ? raw : Math.min(raw, selectedStockPieces);
                            setQuantity(Math.max(1, capped || 0));
                          }}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={handleKeyDown}
                          className="text-center h-10"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <DualUnitQuantityInput
                    product={selectedProduct}
                    quantity={quantity}
                    onChange={(q) => setQuantity(q)}
                    max={quantityInputMax}
                    showRemainingAfterSale={false}
                    showPiecesUnitLabel={false}
                    showBoxInput={false}
                    showPiecesInput={false}
                    onKeyDown={handleKeyDown}
                    inputClassName="text-center h-10 border border-gray-300 rounded px-2 w-full"
                    compact
                  />
                )
              ) : (
                <Input
                  type="number"
                  min="1"
                  value={quantity || ''}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={handleKeyDown}
                  className="text-center h-10"
                />
              )}
            </div>

            {/* Rate */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rate
              </label>
              <Input
                type="number"
                step="1"
                autoComplete="off"
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.target.select()}
                className="text-center h-10"
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
                {isManualMode && allowManualCostPrice ? (
                  <Input
                    type="number"
                    step="1"
                    autoComplete="off"
                    value={manualCost}
                    onChange={(e) => setManualCost(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => e.target.select()}
                    className="text-center h-10 bg-red-50 border-red-200 text-red-700 font-semibold"
                    placeholder="0"
                  />
                ) : (
                  <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-2 rounded border border-red-200 block text-center h-10 flex items-center justify-center" title="Cost Price">
                    {lastPurchasePrice !== null
                      ? `${Math.round(lastPurchasePrice)}`
                      : (selectedProduct?.pricing?.cost !== undefined && selectedProduct?.pricing?.cost !== null)
                        ? `${Math.round(selectedProduct.pricing.cost)}`
                        : selectedProduct ? 'N/A' : '0'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Add Button - Full width on mobile */}
          <div>
            <LoadingButton
              type="button"
              onClick={handleAddToCart}
              isLoading={isAddingToCart}
              variant="default"
              className="w-full flex items-center justify-center px-4 py-2.5 h-11"
              disabled={(!selectedProduct && !isManualMode) || isAddingToCart}
              title="Add to cart (or press Enter in Quantity/Rate fields - focus returns to search)"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </LoadingButton>
          </div>
        </div>

        {/* Desktop Layout — items-start for quantity column alignment */}
        <div className="hidden md:grid grid-cols-12 gap-x-3 gap-y-3 items-start">
          {/* Product Search - 7 columns */}
          <div className={isManualMode ? 'col-span-7' : searchColClass}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isManualMode ? 'Manual Item Details' : 'Product Search'}
            </label>
            <div className="relative flex space-x-2">
              {!isManualMode ? (
                <>
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
                      loading={productsLoading}
                      emptyMessage={emptySearchMessage}
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
                  {allowSaleWithoutProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualMode(true);
                        setIsAddingProduct(true);
                        setSelectedProduct(null);
                        setCalculatedRate(0);
                        setTimeout(() => manualNameRef.current?.focus({ preventScroll: true }), 100);
                      }}
                      className="px-3 py-2 border border-blue-300 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors flex items-center justify-center flex-shrink-0 text-sm font-medium"
                      title="Add manual item"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      <span>Manual</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex space-x-2">
                    <Input
                      ref={manualNameRef}
                      placeholder="Enter manual product name..."
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualMode(false);
                        setIsAddingProduct(false);
                        setManualName('');
                        setManualCost('');
                        setManualProductImage(null);
                        setTimeout(() => productSearchRef.current?.focus({ preventScroll: true }), 100);
                      }}
                      className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={manualImageInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={handleManualImageFile}
                    />
                    {manualProductImage ? (
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                        <img src={manualProductImage} alt="" width={40} height={40} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                          onClick={() => setManualProductImage(null)}
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => manualImageInputRef.current?.click()}
                      className="rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {manualProductImage ? 'Change photo' : 'Photo (optional)'}
                    </button>
                    <span className="text-[10px] text-gray-400">Max 5 MB</span>
                  </div>
                </div>
              )}
              {selectedProduct?.imageUrl && !isManualMode && showProductImages && (
                <div 
                  className="h-10 w-10 flex-shrink-0 bg-gray-50 rounded-md overflow-hidden border border-gray-300 cursor-pointer hover:border-primary-500 transition-colors group relative"
                  onClick={() => setShowImagePreview(true)}
                  title="Click to view full size"
                >
                  <img src={selectedProduct.imageUrl} alt="" width={40} height={40} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                    <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Manual Mode Cost Field (Desktop specific if needed, but it currently shares responsive logic) */}
          {isManualMode && allowManualCostPrice && hasCostPricePermission && showCostPrice && (
            <div className="col-span-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost
              </label>
              <Input
                type="number"
                step="1"
                autoComplete="off"
                value={manualCost}
                onChange={(e) => setManualCost(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.target.select()}
                className="text-center h-10 bg-red-50 border-red-200 text-red-700 font-semibold"
                placeholder="0"
              />
            </div>
          )}

          {/* Stock - 1 column */}
          {!isManualMode && (
            <div className="col-span-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock
              </label>
              <span
                className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-2 rounded border border-gray-200 block text-center min-h-[2.75rem] flex flex-col items-center justify-center gap-0.5 leading-snug"
                title={selectedProduct ? 'Available stock (pieces)' : ''}
              >
                {selectedProduct ? (
                  dualUnit ? (
                    <>
                      <span className="text-xs">{formatStockDualLabel(selectedProduct.inventory?.currentStock ?? 0, selectedProduct)}</span>
                     
                    </>
                  ) : (
                    <span>{selectedProduct.inventory?.currentStock ?? 0} pcs</span>
                  )
                ) : (
                  '0'
                )}
              </span>
            </div>
          )}

          {/* Box + Qty (dual unit): no parent "Quantity" label — matches cart columns */}
          <div className={`${isManualMode ? 'col-span-1' : quantityColClass} min-w-0`}>
            {(!isManualMode && !dualUnit) || isManualMode ? (
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity
              </label>
            ) : null}
            {!isManualMode && dualUnit ? (
              (dualUnitShowBoxInput || dualUnitShowPiecesInput) ? (
                <div className={`grid ${dualUnitShowBoxInput && dualUnitShowPiecesInput ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                  {dualUnitShowBoxInput && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Box</label>
                      <Input
                        type="number"
                        min="0"
                        value={quantity === 0 ? '' : selectedBoxCount}
                        onChange={(e) => {
                          const boxVal = Math.max(0, parseInt(e.target.value, 10) || 0);
                          const currentPieces = dualUnitShowPiecesInput
                            ? piecesToBoxesAndPieces(quantity, selectedPpb || 1).pieces
                            : 0;
                          const raw = boxVal * (selectedPpb || 1) + currentPieces;
                          const capped = allowOutOfStock ? raw : Math.min(raw, selectedStockPieces);
                          setQuantity(Math.max(1, capped || 0));
                        }}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={handleKeyDown}
                        className="text-center h-10"
                      />
                    </div>
                  )}
                  {dualUnitShowPiecesInput && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Qty</label>
                      <Input
                        type="number"
                        min="1"
                        value={quantity || ''}
                        onChange={(e) => {
                          const raw = Math.max(0, parseInt(e.target.value, 10) || 0);
                          const capped = allowOutOfStock ? raw : Math.min(raw, selectedStockPieces);
                          setQuantity(Math.max(1, capped || 0));
                        }}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={handleKeyDown}
                        className="text-center h-10"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <DualUnitQuantityInput
                  product={selectedProduct}
                  quantity={quantity}
                  onChange={(q) => setQuantity(q)}
                  max={quantityInputMax}
                  showRemainingAfterSale={false}
                  showPiecesUnitLabel={false}
                  showBoxInput={false}
                  showPiecesInput={false}
                  onKeyDown={handleKeyDown}
                  inputClassName="text-center border border-gray-300 rounded px-2 h-10"
                  compact
                />
              )
            ) : (
              <Input
                type="number"
                min="1"
                value={quantity || ''}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                onFocus={(e) => e.target.select()}
                onKeyDown={handleKeyDown}
                className="text-center h-10"
              />
            )}
          </div>

          {/* Purchase Price - 1 column (conditional) - Between Quantity and Rate */}
          {!isManualMode && showCostPrice && hasCostPricePermission && (
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost
              </label>
              <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-2 rounded border border-red-200 block text-center min-h-[2.75rem] flex items-center justify-center" title="Cost Price">
                {lastPurchasePrice !== null
                  ? `${Math.round(lastPurchasePrice)}`
                  : (selectedProduct?.pricing?.cost !== undefined && selectedProduct?.pricing?.cost !== null)
                    ? `${Math.round(selectedProduct.pricing.cost)}`
                    : selectedProduct ? 'N/A' : '0'}
              </span>
            </div>
          )}

          {/* Rate - 1 column */}
          <div className="col-span-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rate
            </label>
            <Input
              type="number"
              step="1"
              autoComplete="off"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={(e) => e.target.select()}
              className="text-center h-10"
              placeholder="0"
              required
            />
          </div>

          {/* Amount - 1 column */}
          <div className="col-span-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount
            </label>
            <Input
              type="text"
              readOnly
              value={isAddingProduct ? Math.round(quantity * parseInt(customRate || 0)) : 0}
              onFocus={(e) => e.target.select()}
              className="text-center h-10 bg-gray-100 font-semibold text-gray-700"
            />
          </div>

          {/* Add Button - 1 column */}
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2 opacity-0">
              Action
            </label>
            <LoadingButton
              type="button"
              onClick={handleAddToCart}
              isLoading={isAddingToCart}
              variant="default"
              className="w-full flex items-center justify-center px-4 h-10"
              disabled={(!selectedProduct && !isManualMode) || isAddingToCart}
              title="Add to cart (or press Enter in Quantity/Rate fields - focus returns to search)"
            >
              <Plus className="h-4 w-4" />
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={(barcodeValue) => {
          handleBarcodeSubmit(barcodeValue);
          setShowBarcodeScanner(false);
        }}
      />

      {/* Product Image Preview Modal */}
      <BaseModal
        isOpen={showImagePreview}
        onClose={() => setShowImagePreview(false)}
        title={selectedProduct?.displayName || selectedProduct?.variantName || selectedProduct?.name || 'Product Image'}
      >
        <div className="flex justify-center items-center bg-gray-50 rounded-lg overflow-hidden min-h-[300px] p-4">
          {selectedProduct?.imageUrl ? (
            <img 
              src={selectedProduct.imageUrl} 
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
}

export const ProductSearch = React.memo(ProductSearchComponent);