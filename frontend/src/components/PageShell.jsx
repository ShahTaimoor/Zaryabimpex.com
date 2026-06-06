import React, { memo } from 'react';
import { cn } from '@/lib/utils';

const PageShell = memo(function PageShell({
  children,
  className = '',
  contentClassName = '',
  maxWidthClassName = 'max-w-[1600px]',
  centerContent = false,
  padding = true,
}) {
  const centerClass = centerContent ? 'min-h-[100dvh] flex items-center justify-center' : '';
  const paddingClass = padding ? 'px-4 sm:px-6 lg:px-8' : '';

  return (
    <div className={cn('min-h-[100dvh] min-w-0 max-w-full overflow-x-hidden', className)}>
      <div className={cn('mx-auto w-full min-w-0', maxWidthClassName, paddingClass, centerClass, contentClassName)}>
        {children}
      </div>
    </div>
  );
});

export default PageShell;
