import React from 'react';
import { Plus, Minus, Trash2, Package } from 'lucide-react';
import { useResponsive } from './ResponsiveContainer';
import { OptimizedImage } from './OptimizedImage';

const MobileProductCard = ({ 
  product, 
  quantity, 
  onQuantityChange, 
  onRemove,
  onAdd,
  isAdding = false 
}) => {
  const { isMobile } = useResponsive();

  const handleQuantityChange = (newQuantity) => {
    if (newQuantity < 0) return;
    if (newQuantity === 0) {
      onRemove();
    } else {
      onQuantityChange(newQuantity);
    }
  };

  if (!isMobile) {
    // Desktop version - return null to use regular table
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Product Image/Icon */}
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {product.image ? (
            <OptimizedImage
              src={product.image}
              webpSrc={product.imageWebp || product.image?.replace(/\.(jpg|jpeg|png)$/i, '.webp')}
              alt={product.name}
              className="h-16 w-16 object-cover rounded-lg"
              sizes={{ thumbnail: true, small: true }}
              lazy={true}
            />
          ) : (
            <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {product.name}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            Category: {product.category || 'N/A'}
          </p>
          <p className="text-xs text-gray-500">
            ${product.unitPrice?.toFixed(2) || '0.00'} each
          </p>
        </div>

        {/* Price */}
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            ${((product.unitPrice || 0) * quantity).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">
            {quantity} × ${product.unitPrice?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Quantity Controls */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleQuantityChange(quantity - 1)}
            disabled={isAdding}
            className="p-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Minus className="h-4 w-4" />
          </button>
          
          <span className="text-sm font-medium text-gray-900 min-w-[2rem] text-center">
            {quantity}
          </span>
          
          <button
            onClick={() => handleQuantityChange(quantity + 1)}
            disabled={isAdding}
            className="p-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Remove Button */}
        <button
          onClick={onRemove}
          disabled={isAdding}
          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Stock Warning */}
      {product.inventory?.currentStock <= product.inventory?.reorderPoint && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-xs text-yellow-800">
            ⚠️ Low stock: {product.inventory.currentStock} remaining
          </p>
        </div>
      )}
    </div>
  );
};

export default MobileProductCard;
