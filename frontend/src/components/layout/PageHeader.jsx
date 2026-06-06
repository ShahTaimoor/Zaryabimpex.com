import React, { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Reusable page-title block used at the top of every list/management page.
 * Stacks title and actions vertically on mobile; inline on tablet+.
 */
export const PageHeader = memo(function PageHeader({
  title,
  subtitle,
  icon: IconComponent,
  actions,
  className = '',
  titleClassName = 'text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate',
  subtitleClassName = 'text-sm sm:text-base text-gray-600 mt-0.5 sm:mt-1 line-clamp-2 sm:line-clamp-none',
}) {
  const hasRightSide = !!actions;
  const containerClass = hasRightSide
    ? cn('flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0', className)
    : cn('min-w-0', className);

  const titleBlock = (
    <div className={cn('min-w-0 flex-1', IconComponent && 'flex items-start sm:items-center gap-2 sm:gap-3')}>
      {IconComponent && (
        <IconComponent
          className="h-6 w-6 sm:h-7 sm:w-7 text-primary-600 shrink-0 mt-0.5 sm:mt-0"
          aria-hidden
        />
      )}
      <div className="min-w-0">
        <h1 className={titleClassName}>{title}</h1>
        {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
      </div>
    </div>
  );

  if (!hasRightSide) {
    return titleBlock;
  }

  return (
    <div className={containerClass}>
      {titleBlock}
      <div className="page-actions">{actions}</div>
    </div>
  );
});

export default PageHeader;
