import React from 'react';
import { Filter } from 'lucide-react';

/**
 * Card wrapper for the "Filters" section that appears at the top of every
 * list-style page (BankReceipts, BankPayments, CashReceipts, CashPayments,
 * etc.).
 *
 * Replaces the duplicated 8-line boilerplate of:
 *   <div className="card">
 *     <div className="card-header">
 *       <div className="flex items-center space-x-2">
 *         <Filter className="h-5 w-5 text-gray-400" />
 *         <h3 className="text-lg font-medium text-gray-900">Filters</h3>
 *       </div>
 *     </div>
 *     <div className="card-content">{children}</div>
 *   </div>
 *
 * Usage:
 *   <FiltersCard>
 *     <div className="grid grid-cols-1 md:grid-cols-2 ...">
 *       ...filter inputs
 *     </div>
 *   </FiltersCard>
 */
export function FiltersCard({
  title = 'Filters',
  icon: IconComponent = Filter,
  headerExtra,
  children,
  contentClassName = 'card-content',
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            {IconComponent && (
              <IconComponent className="h-5 w-5 text-gray-400" />
            )}
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          </div>
          {headerExtra}
        </div>
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}

export default FiltersCard;
