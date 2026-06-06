import React, { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Wraps data tables to enable horizontal scroll on small screens
 * without causing page-level overflow.
 */
export const DataTableContainer = memo(function DataTableContainer({
  children,
  className = '',
  minWidth,
}) {
  return (
    <div
      className={cn('table-scroll', className)}
      style={minWidth ? { '--table-min-width': minWidth } : undefined}
    >
      {children}
    </div>
  );
});

export default DataTableContainer;
