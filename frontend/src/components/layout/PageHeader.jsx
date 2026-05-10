import React from 'react';

/**
 * Reusable page-title block used at the top of every list/management page.
 *
 * Replaces the duplicated 4-line block:
 *
 *   <div className="flex items-center justify-between gap-2">
 *     <div className="min-w-0">
 *       <h1 className="text-lg sm:text-3xl font-bold text-gray-900 truncate">{title}</h1>
 *       <p className="hidden sm:block text-sm sm:text-base text-gray-600 mt-1">{subtitle}</p>
 *     </div>
 *     <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>
 *   </div>
 *
 * Usage:
 *   <PageHeader title="Bank Receipts" />
 *   <PageHeader
 *     title="Customers"
 *     subtitle="Manage your customer list"
 *     icon={BarChart3}
 *     actions={<Button>Add</Button>}
 *   />
 */
export function PageHeader({
  title,
  subtitle,
  icon: IconComponent,
  actions,
  className = '',
  titleClassName = 'text-lg sm:text-3xl font-bold text-gray-900 truncate',
  subtitleClassName = 'hidden sm:block text-sm sm:text-base text-gray-600 mt-1',
}) {
  const hasRightSide = !!actions;
  const containerClass = hasRightSide
    ? `flex items-center justify-between gap-2 ${className}`.trim()
    : `min-w-0 ${className}`.trim();

  const titleBlock = (
    <div className={`min-w-0 ${IconComponent ? 'flex items-center gap-2' : ''}`.trim()}>
      {IconComponent && (
        <IconComponent
          className="h-7 w-7 text-primary-600 shrink-0 hidden sm:block"
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
      <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>
    </div>
  );
}

export default PageHeader;
