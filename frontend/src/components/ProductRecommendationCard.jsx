import React, { useState } from 'react';
import { Package, TrendingUp, Heart, ShoppingCart, Star, AlertTriangle } from 'lucide-react';
import { useResponsive } from './ResponsiveContainer';
import { useTrackInteractionMutation } from '../store/services/recommendationsApi';
import { handleApiError } from '../utils/errorHandler';
import { Button } from '@/components/ui/button';
import { OptimizedImage } from './OptimizedImage';

const ProductRecommendationCard = ({ 
  recommendation, 
  position, 
  onAddToCart, 
  showReason = true,
  showScore = false,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { isMobile } = useResponsive();
  const [trackInteraction] = useTrackInteractionMutation();

  const { product, score, reason } = recommendation;
  const productId = product?._id ?? product?.id;

  if (!product) return null;

  const handleAddToCart = async () => {
    if (isAddingToCart) return;
    
    setIsAddingToCart(true);
    
    try {
      // Track the interaction
      if (recommendation._id && productId) {
        await trackInteraction({
          recommendationId: recommendation._id,
          productId,
          action: 'add_to_cart',
          position,
        }).unwrap();
      }
      
      // Call the parent handler
      if (onAddToCart) {
        await onAddToCart(product);
      }
    } catch (error) {
      handleApiError(error, 'Add to Cart');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const getReasonIcon = () => {
    switch (reason) {
      case 'trending':
        return <TrendingUp className="h-4 w-4 text-orange-500" />;
      case 'frequently_bought_together':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'similar_products':
        return <Package className="h-4 w-4 text-purple-500" />;
      case 'seasonal':
        return <Star className="h-4 w-4 text-yellow-500" />;
      case 'collaborative_filtering':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'content_similarity':
        return <Package className="h-4 w-4 text-green-500" />;
      case 'price_range':
        return <Package className="h-4 w-4 text-indigo-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getReasonText = () => {
    switch (reason) {
      case 'trending':
        return 'Trending Now';
      case 'frequently_bought_together':
        return 'Frequently Bought Together';
      case 'similar_products':
        return 'Similar Products';
      case 'seasonal':
        return 'Seasonal Pick';
      case 'collaborative_filtering':
        return 'Customers Also Bought';
      case 'content_similarity':
        return 'You Might Like';
      case 'price_range':
        return 'In Your Price Range';
      default:
        return 'Recommended';
    }
  };

  const isLowStock = product.inventory?.currentStock <= product.inventory?.reorderPoint;
  const isOutOfStock = product.inventory?.currentStock === 0;

  return (
    <div 
      className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 min-w-0 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
        {(localStorage.getItem('showProductImagesUI') !== 'false') && product.image ? (
          <OptimizedImage
            src={product.image}
            webpSrc={product.imageWebp || product.image?.replace(/\.(jpg|jpeg|png)$/i, '.webp')}
            alt={product.name}
            className="w-full h-full object-cover"
            sizes={{
              thumbnail: true,
              small: true,
              medium: true,
              large: true
            }}
            lazy={true}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
            <Package className="h-12 w-12" />
          </div>
        )}
        
        {/* Stock Status */}
        {(isLowStock || isOutOfStock) && (
          <div className="absolute top-2 right-2">
            {isOutOfStock ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Out of Stock
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Low Stock
              </span>
            )}
          </div>
        )}

        {/* Recommendation Reason Badge */}
        {showReason && (
          <div className="absolute top-2 left-2">
            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white bg-opacity-90 text-gray-700">
              {getReasonIcon()}
              <span className="ml-1 hidden sm:inline">{getReasonText()}</span>
            </div>
          </div>
        )}

        {/* Score Badge */}
        {showScore && (
          <div className="absolute bottom-2 right-2">
            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {Math.round(score * 100)}%
            </div>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
            {product.name}
          </h3>
          {(typeof product.category === 'object' ? product.category?.name : product.category) && (
            <p className="text-xs text-gray-500">Category: {typeof product.category === 'object' ? product.category.name : product.category}</p>
          )}
        </div>

        {/* Price */}
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-gray-900">
              {(Number(product.pricing?.retail ?? product.selling_price ?? product.sellingPrice ?? 0) || 0).toFixed(2)}
            </span>
            {product.pricing?.wholesale && product.pricing.wholesale !== product.pricing.retail && (
              <span className="text-sm text-gray-500 line-through">
                {product.pricing.wholesale.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Stock Info - only show when we have inventory data and stock > 0 */}
        {product.inventory?.currentStock != null && product.inventory.currentStock > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Stock:</span>
              <span className={`font-medium ${
                isLowStock ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {product.inventory.currentStock}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAddingToCart}
            variant="default"
            size="sm"
            className="w-full flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAddingToCart ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Add to Cart</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductRecommendationCard;
