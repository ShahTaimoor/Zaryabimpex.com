import React, { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Standard page wrapper providing consistent spacing, width constraints,
 * and overflow protection across all POS pages.
 */
export const PageLayout = memo(function PageLayout({
  children,
  className = '',
  as: Component = 'div',
}) {
  return (
    <Component className={cn('page-container animate-fade-in', className)}>
      {children}
    </Component>
  );
});

export default PageLayout;
