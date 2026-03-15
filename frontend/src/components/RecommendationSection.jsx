import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, Sparkles, RefreshCw, Settings, Eye, ShoppingCart } from 'lucide-react';
import { useGenerateRecommendationsMutation } from '../store/services/recommendationsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingButton } from './LoadingSpinner';
import ProductRecommendationCard from './ProductRecommendationCard';
import { useResponsive, ResponsiveContainer, ResponsiveGrid } from './ResponsiveContainer';

const RecommendationSection = ({
  title = 'Recommended for You',
  algorithm = 'hybrid',
  context = {},
  limit = 8,
  showTitle = true,
  showControls = true,
  onAddToCart,
  onViewProduct,
  className = ''
}) => {
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [currentAlgorithm, setCurrentAlgorithm] = useState(algorithm);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recommendationsData, setRecommendationsData] = useState(null);
  const [error, setError] = useState(null);
  const { isMobile } = useResponsive();

  // Generate recommendations mutation
  const [generateRecommendations, { isLoading }] = useGenerateRecommendationsMutation();
  
  // Ref to prevent duplicate calls in React Strict Mode
  const isFetchingRef = useRef(false);

  // Fetch recommendations on mount and when algorithm/context changes
  useEffect(() => {
    // Prevent duplicate calls in React Strict Mode
    if (isFetchingRef.current) {
      return;
    }
    
    const fetchRecommendations = async () => {
      if (isFetchingRef.current) {
        return; // Double check
      }
      
      isFetchingRef.current = true;
      try {
        setError(null);
        const result = await generateRecommendations({
          sessionId,
          algorithm: currentAlgorithm,
          context,
          limit,
        }).unwrap();
        setRecommendationsData(result);
      } catch (err) {
        setError(err);
        handleApiError(err, 'Recommendations');
      } finally {
        // Reset after a short delay to allow cleanup
        setTimeout(() => {
          isFetchingRef.current = false;
        }, 100);
      }
    };

    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAlgorithm, sessionId, limit]);

  const handleRefresh = async () => {
    // Prevent duplicate refresh calls
    if (isFetchingRef.current || isRefreshing) {
      return;
    }
    
    setIsRefreshing(true);
    isFetchingRef.current = true;
    try {
      setError(null);
      const result = await generateRecommendations({
        sessionId,
        algorithm: currentAlgorithm,
        context,
        limit,
      }).unwrap();
      setRecommendationsData(result);
      showSuccessToast('Recommendations updated');
    } catch (err) {
      setError(err);
      handleApiError(err, 'Refresh Recommendations');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => {
        isFetchingRef.current = false;
      }, 100);
    }
  };

  const handleAlgorithmChange = (newAlgorithm) => {
    setCurrentAlgorithm(newAlgorithm);
  };

  const handleAddToCart = async (product) => {
    try {
      if (onAddToCart) {
        await onAddToCart(product);
      }
      showSuccessToast(`${product.name} added to cart`);
    } catch (error) {
      handleApiError(error, 'Add to Cart');
    }
  };

  const handleViewProduct = (product) => {
    if (onViewProduct) {
      onViewProduct(product);
    }
  };

  const algorithmOptions = [
    { value: 'hybrid', label: 'Smart Recommendations', icon: Sparkles },
    { value: 'trending', label: 'Trending Now', icon: TrendingUp },
    { value: 'frequently_bought', label: 'Frequently Bought', icon: ShoppingCart },
    { value: 'similar_products', label: 'Similar Products', icon: Eye },
    { value: 'collaborative', label: 'Others Also Bought', icon: TrendingUp },
    { value: 'seasonal', label: 'Seasonal Picks', icon: Sparkles },
  ];

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-red-500 mb-4">
          <RefreshCw className="h-8 w-8 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load recommendations</h3>
        <p className="text-gray-500 mb-4">{error.message}</p>
        <button
          onClick={handleRefresh}
          className="btn btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <ResponsiveContainer className={className}>
      {/* Header */}
      {showTitle && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Sparkles className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">
                {algorithmOptions.find(opt => opt.value === currentAlgorithm)?.label}
              </p>
            </div>
          </div>
          
          {showControls && (
            <div className="flex items-center space-x-2">
              {/* Algorithm Selector */}
              <select
                value={currentAlgorithm}
                onChange={(e) => handleAlgorithmChange(e.target.value)}
                className="select select-sm"
              >
                {algorithmOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              {/* Refresh Button */}
              <LoadingButton
                onClick={handleRefresh}
                isLoading={isRefreshing}
                className="btn btn-secondary btn-sm"
              >
                <RefreshCw className="h-4 w-4" />
              </LoadingButton>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: limit }).map((_, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="flex space-x-2">
                  <div className="h-8 bg-gray-200 rounded flex-1"></div>
                  <div className="h-8 bg-gray-200 rounded flex-1"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations Grid */}
      {recommendationsData?.recommendations && (
        <ResponsiveGrid 
          cols={{ default: 2, md: 3, lg: 4 }} 
          gap={4}
          className="mb-6"
        >
          {recommendationsData.recommendations.map((recommendation, index) => (
            <ProductRecommendationCard
              key={`${recommendation.product._id}-${index}`}
              recommendation={{
                ...recommendation,
                _id: recommendationsData.recommendationId,
              }}
              position={index + 1}
              onAddToCart={handleAddToCart}
              onViewProduct={handleViewProduct}
              showReason={true}
              showScore={false}
            />
          ))}
        </ResponsiveGrid>
      )}

      {/* No Recommendations */}
      {recommendationsData?.recommendations?.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Sparkles className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations available</h3>
          <p className="text-gray-500 mb-4">
            We need more data to provide personalized recommendations.
          </p>
          <button
            onClick={handleRefresh}
            className="btn btn-primary"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      )}

      {/* Performance Info */}
      {recommendationsData?.metadata && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Generated in {recommendationsData.metadata.processingTime}ms
            </span>
            <span>
              {recommendationsData.recommendations?.length || 0} recommendations
            </span>
          </div>
        </div>
      )}
    </ResponsiveContainer>
  );
};

export default RecommendationSection;
