import React, { useState, useEffect, useRef } from 'react';
import { Plus, Camera } from 'lucide-react';
import { useGetProductsQuery, useLazyGetLastPurchasePriceQuery } from '@/store/services/productsApi';
import { useGetVariantsQuery } from '@/store/services/productVariantsApi';
import { useFuzzySearch } from '@/hooks/useFuzzySearch';
import { SearchableDropdown } from '@/components/SearchableDropdown';
import { DualUnitQuantityInput } from '@/components/DualUnitQuantityInput';
import { hasDualUnit, getPiecesPerBox, piecesToBoxesAndPieces, formatStockDualLabel } from '@/utils/dualUnitUtils';
import { handleApiError } from '@/utils/errorHandler';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/LoadingSpinner';
import BarcodeScanner from '@/components/BarcodeScanner';

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
}) {
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

  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useGetProductsQuery(
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
      const costPrice = lastPurchasePrice !== null ? lastPurchasePrice : selectedProduct?.pricing?.cost;
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
          {showCostPrice && hasCostPricePermission && (purchasePrice !== undefined && purchasePrice !== null) && (
            <div className="text-sm text-red-600 font-medium">Cost: {Math.round(purchasePrice)}</div>
          )}
          <div className="text-sm text-gray-600">Price: {Math.round(unitPrice)}</div>
        </div>
      </div>
    );
  };

  // Fit dual-unit quantity (boxes + pieces + total) in one row: 12 cols total
  const dualUnit = hasDualUnit(selectedProduct);
  const searchColClass =
    dualUnit && showCostPrice && hasCostPricePermission
      ? 'col-span-3'
      : dualUnit
        ? 'col-span-4'
        : showCostPrice && hasCostPricePermission
          ? 'col-span-6'
          : 'col-span-7';
  /** Wider column when dual unit (boxes + pieces + total) */
  const quantityColClass = dualUnit ? 'col-span-4' : 'col-span-1';

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
              <span
                className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-2 rounded border border-gray-200 block text-center min-h-[2.5rem] flex flex-col items-center justify-center gap-0.5 leading-tight"
                title={selectedProduct ? `Available stock (pieces)` : ''}
              >
                {selectedProduct ? (
                  hasDualUnit(selectedProduct) ? (
                    <>
                      <span className="text-xs">{formatStockDualLabel(selectedProduct.inventory?.currentStock ?? 0, selectedProduct)}</span>
                      <span className="text-[10px] font-normal text-gray-500">available</span>
                    </>
                  ) : (
                    <span>{selectedProduct.inventory?.currentStock ?? 0} pcs</span>
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
                {isAddingProduct ? Math.round(quantity * parseInt(customRate || 0)) : 0}
              </span>
            </div>

            {/* Quantity — full width on mobile when dual unit */}
            <div className={dualUnit ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <DualUnitQuantityInput
                product={selectedProduct}
                quantity={quantity}
                onChange={(q) => setQuantity(q)}
                max={selectedProduct?.inventory?.currentStock}
                showRemainingAfterSale={false}
                showPiecesUnitLabel={false}
                showBoxInput={dualUnitShowBoxInput}
                showPiecesInput={dualUnitShowPiecesInput}
                onKeyDown={handleKeyDown}
                inputClassName="text-center h-10 border border-gray-300 rounded px-2 w-full"
                compact
              />
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
                <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-2 rounded border border-red-200 block text-center h-10 flex items-center justify-center" title="Cost Price">
                  {lastPurchasePrice !== null
                    ? `${Math.round(lastPurchasePrice)}`
                    : (selectedProduct?.pricing?.cost !== undefined && selectedProduct?.pricing?.cost !== null)
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
              variant="default"
              className="w-full flex items-center justify-center px-4 py-2.5 h-11"
              disabled={!selectedProduct || isAddingToCart}
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
                    <span className="text-[10px] font-normal text-gray-500">available</span>
                  </>
                ) : (
                  <span>{selectedProduct.inventory?.currentStock ?? 0} pcs</span>
                )
              ) : (
                '0'
              )}
            </span>
          </div>

          {/* Quantity — wider when dual unit (boxes + pieces + total) */}
          <div className={`${quantityColClass} min-w-0`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity
            </label>
            <DualUnitQuantityInput
              product={selectedProduct}
              quantity={quantity}
              onChange={(q) => setQuantity(q)}
              max={selectedProduct?.inventory?.currentStock}
              showRemainingAfterSale={false}
              showPiecesUnitLabel={false}
              showBoxInput={dualUnitShowBoxInput}
              showPiecesInput={dualUnitShowPiecesInput}
              onKeyDown={handleKeyDown}
              inputClassName="text-center border border-gray-300 rounded px-2 h-10"
              compact
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
                  : (selectedProduct?.pricing?.cost !== undefined && selectedProduct?.pricing?.cost !== null)
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
            <Input
              type="number"
              step="1"
              autoComplete="off"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={(e) => e.target.select()}
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
            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block text-center h-10 flex items-center justify-center">
              {isAddingProduct ? Math.round(quantity * parseInt(customRate || 0)) : 0}
            </span>
          </div>

          {/* Add Button - 1 column (spacer label aligns row with fields that have labels) */}
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2 invisible select-none" aria-hidden="true">
              Add
            </label>
            <LoadingButton
              type="button"
              onClick={handleAddToCart}
              isLoading={isAddingToCart}
              variant="default"
              className="w-full flex items-center justify-center px-3 py-2 h-10"
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
}

export const ProductSearch = React.memo(ProductSearchComponent);