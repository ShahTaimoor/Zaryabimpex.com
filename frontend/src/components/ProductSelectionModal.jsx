import React, { useState } from 'react';
import { X, Plus, Minus, Package, Calendar, DollarSign, CheckSquare, Square } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

const ProductSelectionModal = ({ 
  isOpen, 
  onClose, 
  products, 
  isLoading,
  type = 'sale', // 'sale' or 'purchase'
  onConfirm 
}) => {
  const [selectedProducts, setSelectedProducts] = useState({}); // { productId: { quantity, sale/purchase data } }

  if (!isOpen) return null;

  const handleToggleProduct = (productData) => {
    const productId = productData.product._id;
    
    if (selectedProducts[productId]) {
      // Remove from selection
      const newSelection = { ...selectedProducts };
      delete newSelection[productId];
      setSelectedProducts(newSelection);
    } else {
      // Add to selection with default quantity 1
      setSelectedProducts({
        ...selectedProducts,
        [productId]: {
          quantity: 1,
          maxQuantity: productData.remainingReturnableQuantity,
          productData
        }
      });
    }
  };

  const handleQuantityChange = (productId, newQuantity) => {
    const selected = selectedProducts[productId];
    if (!selected) return;

    const maxQty = selected.maxQuantity;
    const qty = Math.max(1, Math.min(maxQty, parseInt(newQuantity) || 1));

    setSelectedProducts({
      ...selectedProducts,
      [productId]: {
        ...selected,
        quantity: qty
      }
    });
  };

  const handleConfirm = () => {
    if (Object.keys(selectedProducts).length === 0) {
      return;
    }

    // Convert selected products to return items format
    const returnItems = Object.values(selectedProducts).map(selected => {
      const productData = selected.productData;
      // Use the first sale/purchase for order reference
      const firstSale = type === 'sale' 
        ? productData.sales[0] 
        : productData.purchases[0];

      return {
        product: productData.product._id,
        originalOrder: firstSale.orderId || firstSale.invoiceId,
        originalOrderItem: firstSale.orderItemId || firstSale.invoiceItemId,
        quantity: selected.quantity,
        originalPrice: productData.previousPrice,
        returnReason: type === 'sale' ? 'changed_mind' : 'defective',
        condition: 'good',
        action: 'refund',
        returnReasonDetail: '',
        refundAmount: 0,
        restockingFee: 0,
        maxQuantity: selected.maxQuantity
      };
    });

    onConfirm(returnItems);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-0 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Select Products for Return
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {type === 'sale' ? 'Sale' : 'Purchase'} Return - Select products and quantities
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No products found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((productData) => {
                const product = productData.product;
                const productId = product._id;
                const isSelected = !!selectedProducts[productId];
                const selected = selectedProducts[productId];

                return (
                  <div
                    key={productId}
                    className={`border rounded-lg p-4 transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleProduct(productData)}
                        className="mt-1 flex-shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400" />
                        )}
                      </button>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-1">
                              {product.name || 'Unknown Product'}
                            </h4>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-2">
                              {product.sku && (
                                <span>SKU: <span className="font-medium">{product.sku}</span></span>
                              )}
                              {product.barcode && (
                                <span>Barcode: <span className="font-medium">{product.barcode}</span></span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Quantity {type === 'sale' ? 'Sold' : 'Purchased'}:</span>
                                <span className="font-medium ml-1">{productData.totalQuantitySold || productData.totalQuantityPurchased}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Returned:</span>
                                <span className="font-medium ml-1">{productData.totalReturnedQuantity}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Remaining:</span>
                                <span className="font-medium ml-1 text-green-600">{productData.remainingReturnableQuantity}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Previous Price:</span>
                                <span className="font-medium ml-1">{formatCurrency(productData.previousPrice)}</span>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              Latest {type === 'sale' ? 'Sale' : 'Purchase'}: {formatDate(productData.latestSaleDate || productData.latestPurchaseDate)}
                            </div>
                          </div>

                          {/* Quantity Input */}
                          {isSelected && (
                            <div className="flex-shrink-0">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Return Quantity
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(productId, (selected.quantity || 1) - 1)}
                                  className="p-1 border border-gray-300 rounded hover:bg-gray-100"
                                  disabled={selected.quantity <= 1}
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={selected.maxQuantity}
                                  value={selected.quantity}
                                  onChange={(e) => handleQuantityChange(productId, e.target.value)}
                                  className="w-20 text-center border border-gray-300 rounded px-2 py-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(productId, (selected.quantity || 1) + 1)}
                                  className="p-1 border border-gray-300 rounded hover:bg-gray-100"
                                  disabled={selected.quantity >= selected.maxQuantity}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Max: {selected.maxQuantity}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="text-sm text-gray-600">
            {Object.keys(selectedProducts).length} product(s) selected
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={Object.keys(selectedProducts).length === 0}
              className="btn btn-primary"
            >
              Create Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductSelectionModal;
