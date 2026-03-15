import React from 'react';
import { useMediaQuery } from 'react-responsive';

// Responsive breakpoints
export const breakpoints = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};

// Responsive container component
export const ResponsiveContainer = ({ 
  children, 
  className = '', 
  maxWidth = '7xl',
  padding = true 
}) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  
  const containerClasses = `
    mx-auto
    ${maxWidth ? `max-w-${maxWidth}` : ''}
    ${padding ? (isMobile ? 'px-4' : 'px-6') : ''}
    ${className}
  `.trim();

  return (
    <div className={containerClasses}>
      {children}
    </div>
  );
};

// Responsive grid component
export const ResponsiveGrid = ({ 
  children, 
  cols = { default: 1, sm: 2, md: 3, lg: 4 },
  gap = 4,
  className = ''
}) => {
  const gridClasses = `
    grid
    ${cols.default ? `grid-cols-${cols.default}` : ''}
    ${cols.sm ? `sm:grid-cols-${cols.sm}` : ''}
    ${cols.md ? `md:grid-cols-${cols.md}` : ''}
    ${cols.lg ? `lg:grid-cols-${cols.lg}` : ''}
    ${cols.xl ? `xl:grid-cols-${cols.xl}` : ''}
    ${cols['2xl'] ? `2xl:grid-cols-${cols['2xl']}` : ''}
    gap-${gap}
    ${className}
  `.trim();

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
};

// Responsive flex component
export const ResponsiveFlex = ({ 
  children, 
  direction = { default: 'col', md: 'row' },
  align = 'start',
  justify = 'start',
  wrap = false,
  gap = 4,
  className = ''
}) => {
  const flexClasses = `
    flex
    ${direction.default ? `flex-${direction.default}` : ''}
    ${direction.sm ? `sm:flex-${direction.sm}` : ''}
    ${direction.md ? `md:flex-${direction.md}` : ''}
    ${direction.lg ? `lg:flex-${direction.lg}` : ''}
    ${align ? `items-${align}` : ''}
    ${justify ? `justify-${justify}` : ''}
    ${wrap ? 'flex-wrap' : ''}
    gap-${gap}
    ${className}
  `.trim();

  return (
    <div className={flexClasses}>
      {children}
    </div>
  );
};

// Mobile-first responsive component
export const MobileFirst = ({ 
  children, 
  mobile, 
  tablet, 
  desktop,
  className = ''
}) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1023 });
  const isDesktop = useMediaQuery({ minWidth: 1024 });

  let content = children;
  
  if (isMobile && mobile) {
    content = mobile;
  } else if (isTablet && tablet) {
    content = tablet;
  } else if (isDesktop && desktop) {
    content = desktop;
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
};

// Responsive text component
export const ResponsiveText = ({ 
  children, 
  size = { default: 'base', sm: 'lg', md: 'xl' },
  weight = 'normal',
  className = ''
}) => {
  const textClasses = `
    ${size.default ? `text-${size.default}` : ''}
    ${size.sm ? `sm:text-${size.sm}` : ''}
    ${size.md ? `md:text-${size.md}` : ''}
    ${size.lg ? `lg:text-${size.lg}` : ''}
    font-${weight}
    ${className}
  `.trim();

  return (
    <span className={textClasses}>
      {children}
    </span>
  );
};

// Responsive spacing component
export const ResponsiveSpacing = ({ 
  children, 
  padding = { default: 4, sm: 6, md: 8 },
  margin = { default: 0, sm: 2, md: 4 },
  className = ''
}) => {
  const spacingClasses = `
    ${padding.default ? `p-${padding.default}` : ''}
    ${padding.sm ? `sm:p-${padding.sm}` : ''}
    ${padding.md ? `md:p-${padding.md}` : ''}
    ${padding.lg ? `lg:p-${padding.lg}` : ''}
    ${margin.default ? `m-${margin.default}` : ''}
    ${margin.sm ? `sm:m-${margin.sm}` : ''}
    ${margin.md ? `md:m-${margin.md}` : ''}
    ${margin.lg ? `lg:m-${margin.lg}` : ''}
    ${className}
  `.trim();

  return (
    <div className={spacingClasses}>
      {children}
    </div>
  );
};

// Hook for responsive values
export const useResponsive = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1023 });
  const isDesktop = useMediaQuery({ minWidth: 1024 });
  const isLarge = useMediaQuery({ minWidth: 1280 });
  const isXLarge = useMediaQuery({ minWidth: 1536 });

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLarge,
    isXLarge,
    isMobileOrTablet: isMobile || isTablet,
    isDesktopOrLarger: isDesktop || isLarge || isXLarge
  };
};

// Responsive visibility component
export const ResponsiveVisibility = ({ 
  children, 
  show = { mobile: true, tablet: true, desktop: true },
  className = ''
}) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1023 });
  const isDesktop = useMediaQuery({ minWidth: 1024 });

  let shouldShow = true;

  if (isMobile && !show.mobile) {
    shouldShow = false;
  } else if (isTablet && !show.tablet) {
    shouldShow = false;
  } else if (isDesktop && !show.desktop) {
    shouldShow = false;
  }

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={className}>
      {children}
    </div>
  );
};

export default {
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveFlex,
  MobileFirst,
  ResponsiveText,
  ResponsiveSpacing,
  useResponsive,
  ResponsiveVisibility,
  breakpoints
};
