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

// Map maxWidth values to full Tailwind classes (required for JIT)
const MAX_WIDTH_CLASSES = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

// Map grid-cols values to full Tailwind classes (required for JIT)
const GRID_COLS_CLASSES = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

const GAP_CLASSES = { 0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 5: 'gap-5', 6: 'gap-6', 8: 'gap-8' };

// Responsive container component
export const ResponsiveContainer = ({ 
  children, 
  className = '', 
  maxWidth = '7xl',
  padding = true 
}) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const maxWidthClass = MAX_WIDTH_CLASSES[maxWidth] || MAX_WIDTH_CLASSES['7xl'];
  const paddingClass = padding ? (isMobile ? 'px-4' : 'px-6') : '';

  return (
    <div className={`mx-auto ${maxWidthClass} ${paddingClass} ${className}`.trim()}>
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
  const defaultCol = GRID_COLS_CLASSES[cols.default] || 'grid-cols-1';
  const smCol = cols.sm ? (GRID_COLS_CLASSES[cols.sm] ? `sm:${GRID_COLS_CLASSES[cols.sm]}` : '') : '';
  const mdCol = cols.md ? (GRID_COLS_CLASSES[cols.md] ? `md:${GRID_COLS_CLASSES[cols.md]}` : '') : '';
  const lgCol = cols.lg ? (GRID_COLS_CLASSES[cols.lg] ? `lg:${GRID_COLS_CLASSES[cols.lg]}` : '') : '';
  const xlCol = cols.xl ? (GRID_COLS_CLASSES[cols.xl] ? `xl:${GRID_COLS_CLASSES[cols.xl]}` : '') : '';
  const gapClass = GAP_CLASSES[gap] || 'gap-4';

  const gridClasses = ['grid', defaultCol, smCol, mdCol, lgCol, xlCol, gapClass, className].filter(Boolean).join(' ');

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
