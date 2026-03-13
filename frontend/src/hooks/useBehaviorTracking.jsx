import { useEffect, useRef } from 'react';
import { useTrackBehaviorMutation } from '../store/services/recommendationsApi';

// Generate a unique session ID
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get or create session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('recommendation_session_id');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('recommendation_session_id', sessionId);
  }
  return sessionId;
};

const useBehaviorTracking = () => {
  const sessionId = useRef(getSessionId());
  const trackingQueue = useRef([]);
  const isTracking = useRef(false);
  const [trackBehaviorMutation] = useTrackBehaviorMutation();

  // Track user behavior
  const trackBehavior = async (behaviorData) => {
    const data = {
      sessionId: sessionId.current,
      ...behaviorData,
      timestamp: new Date().toISOString(),
    };

    // Add to queue
    trackingQueue.current.push(data);

    // Process queue if not already processing
    if (!isTracking.current) {
      processTrackingQueue();
    }
  };

  // Process tracking queue
  const processTrackingQueue = async () => {
    if (isTracking.current || trackingQueue.current.length === 0) {
      return;
    }

    isTracking.current = true;

    while (trackingQueue.current.length > 0) {
      const behaviorData = trackingQueue.current.shift();
      
      try {
        await trackBehaviorMutation(behaviorData).unwrap();
      } catch (error) {
        // Error tracking behavior - silent fail
        // Re-queue failed tracking if it's important
        if (behaviorData.action === 'purchase' || behaviorData.action === 'add_to_cart') {
          trackingQueue.current.unshift(behaviorData);
        }
      }
    }

    isTracking.current = false;
  };

  // Track page view
  const trackPageView = (page, referrer = null) => {
    trackBehavior({
      action: 'page_view',
      entity: {
        type: 'page',
        name: page,
      },
      context: {
        page,
        referrer,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      },
    });
  };

  // Track product view
  const trackProductView = (product, position = null) => {
    trackBehavior({
      action: 'product_view',
      entity: {
        type: 'product',
        id: product._id,
        ref: 'Product',
        name: product.name,
        category: product.category,
      },
      metadata: {
        productPrice: product.pricing?.retail,
        position,
      },
    });
  };

  // Track product click
  const trackProductClick = (product, position = null) => {
    trackBehavior({
      action: 'product_click',
      entity: {
        type: 'product',
        id: product._id,
        ref: 'Product',
        name: product.name,
        category: product.category,
      },
      metadata: {
        productPrice: product.pricing?.retail,
        position,
      },
    });
  };

  // Track add to cart
  const trackAddToCart = (product, quantity = 1, position = null) => {
    trackBehavior({
      action: 'add_to_cart',
      entity: {
        type: 'product',
        id: product._id,
        ref: 'Product',
        name: product.name,
        category: product.category,
      },
      metadata: {
        productPrice: product.pricing?.retail,
        quantity,
        position,
        cartValue: product.pricing?.retail * quantity,
      },
    });
  };

  // Track remove from cart
  const trackRemoveFromCart = (product, quantity = 1, position = null) => {
    trackBehavior({
      action: 'remove_from_cart',
      entity: {
        type: 'product',
        id: product._id,
        ref: 'Product',
        name: product.name,
        category: product.category,
      },
      metadata: {
        productPrice: product.pricing?.retail,
        quantity,
        position,
      },
    });
  };

  // Track purchase
  const trackPurchase = (products, totalAmount, orderId = null) => {
    products.forEach((product, index) => {
      trackBehavior({
        action: 'purchase',
        entity: {
          type: 'product',
          id: product._id || product.product?._id,
          ref: 'Product',
          name: product.name || product.product?.name,
          category: product.category || product.product?.category,
        },
        metadata: {
          productPrice: product.price || product.product?.pricing?.retail,
          quantity: product.quantity,
          position: index + 1,
          totalAmount,
          orderId,
        },
      });
    });
  };

  // Track search
  const trackSearch = (query, resultsCount = 0, filters = {}) => {
    trackBehavior({
      action: 'search',
      entity: {
        type: 'search',
        name: query,
      },
      metadata: {
        searchQuery: query,
        resultsCount,
        filterCriteria: filters,
      },
    });
  };

  // Track category view
  const trackCategoryView = (category, position = null) => {
    trackBehavior({
      action: 'category_view',
      entity: {
        type: 'category',
        id: category._id,
        ref: 'Category',
        name: category.name,
      },
      metadata: {
        position,
      },
    });
  };

  // Track filter usage
  const trackFilter = (filterType, filterValue, resultsCount = 0) => {
    trackBehavior({
      action: 'filter',
      entity: {
        type: 'filter',
        name: filterType,
      },
      metadata: {
        filterType,
        filterValue,
        resultsCount,
      },
    });
  };

  // Track recommendation interaction
  const trackRecommendationInteraction = (recommendationId, productId, action, position = null) => {
    trackBehavior({
      action: `recommendation_${action}`,
      entity: {
        type: 'product',
        id: productId,
        ref: 'Product',
      },
      metadata: {
        recommendationId,
        position,
        interactionType: action,
      },
    });
  };

  // Process any remaining tracking on unmount
  useEffect(() => {
    return () => {
      if (trackingQueue.current.length > 0) {
        // Send remaining tracking data
        processTrackingQueue();
      }
    };
  }, []);

  return {
    sessionId: sessionId.current,
    trackBehavior,
    trackPageView,
    trackProductView,
    trackProductClick,
    trackAddToCart,
    trackRemoveFromCart,
    trackPurchase,
    trackSearch,
    trackCategoryView,
    trackFilter,
    trackRecommendationInteraction,
  };
};

export default useBehaviorTracking;
