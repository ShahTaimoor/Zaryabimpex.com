/**
 * OptimizedImage Component
 * Handles lazy loading, WebP with fallback, and responsive images
 */

import React, { useState, useRef, useEffect } from 'react';

/**
 * OptimizedImage - Image component with lazy loading, WebP support, and responsive images
 * @param {string} src - Image source URL (JPEG/PNG)
 * @param {string} webpSrc - WebP version URL (optional)
 * @param {string} alt - Alt text
 * @param {string} className - CSS classes
 * @param {Object} sizes - Responsive image sizes object {thumbnail, small, medium, large}
 * @param {boolean} lazy - Enable lazy loading (default: true)
 * @param {string} fallback - Fallback image URL
 * @param {Object} style - Inline styles
 */
export const OptimizedImage = ({
  src,
  webpSrc,
  alt = '',
  className = '',
  sizes = null,
  lazy = true,
  fallback = null,
  style = {},
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const imgRef = useRef(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before image enters viewport
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
      observer.disconnect();
    };
  }, [lazy, isInView]);

  // Generate srcset for responsive images
  const generateSrcSet = () => {
    if (!sizes || !webpSrc) return null;

    const srcset = [];
    const basePath = webpSrc.replace(/\.webp$/, '');

    // Generate WebP srcset
    if (sizes.thumbnail) srcset.push(`${basePath}_thumbnail.webp 150w`);
    if (sizes.small) srcset.push(`${basePath}_small.webp 300w`);
    if (sizes.medium) srcset.push(`${basePath}_medium.webp 600w`);
    if (sizes.large) srcset.push(`${basePath}_large.webp 1200w`);

    return srcset.length > 0 ? srcset.join(', ') : null;
  };

  // Generate sizes attribute
  const getSizes = () => {
    return '(max-width: 640px) 300px, (max-width: 1024px) 600px, 1200px';
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  // Don't render until in view (lazy loading)
  if (lazy && !isInView) {
    return (
      <div
        ref={imgRef}
        className={`bg-gray-200 animate-pulse ${className}`}
        style={{ minHeight: '200px', ...style }}
        {...props}
      />
    );
  }

  // Error state - show fallback or placeholder
  if (hasError) {
    if (fallback) {
      return (
        <img
          src={fallback}
          alt={alt}
          className={className}
          style={style}
          {...props}
        />
      );
    }
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        style={{ minHeight: '200px', ...style }}
        {...props}
      >
        <span className="text-gray-400 text-sm">Image not available</span>
      </div>
    );
  }

  const srcset = generateSrcSet();
  const sizesAttr = srcset ? getSizes() : undefined;

  return (
    <picture ref={imgRef} className={className} style={style}>
      {/* WebP source with srcset for responsive images */}
      {webpSrc && srcset && (
        <source
          srcSet={srcset}
          sizes={sizesAttr}
          type="image/webp"
        />
      )}
      
      {/* WebP source (single image) */}
      {webpSrc && !srcset && (
        <source srcSet={webpSrc} type="image/webp" />
      )}

      {/* Fallback image (JPEG/PNG) */}
      <img
        src={src}
        alt={alt}
        className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}
        onLoad={handleLoad}
        onError={handleError}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        {...props}
      />
    </picture>
  );
};

/**
 * LazyImage - Simple lazy loading image component
 */
export const LazyImage = ({
  src,
  alt = '',
  className = '',
  fallback = null,
  ...props
}) => {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      className={className}
      lazy={true}
      fallback={fallback}
      {...props}
    />
  );
};

export default OptimizedImage;

