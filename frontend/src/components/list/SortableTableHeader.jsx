import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Reusable sortable `<th>` cell. Replaces the duplicated 8-line block:
 *
 *   <th
 *     className="... cursor-pointer hover:bg-gray-100"
 *     onClick={() => handleSort('date')}
 *   >
 *     <div className="flex items-center space-x-1">
 *       <span>Date</span>
 *       <ArrowUpDown className="h-3 w-3" />
 *     </div>
 *   </th>
 *
 * Pass `sortConfig` to render a directional arrow when the column is the
 * active sort key.
 */
export function SortableTableHeader({
  label,
  sortKey,
  onSort,
  sortConfig,
  align = 'left',
  className = '',
  children,
}) {
  const isActive = sortConfig?.key === sortKey;
  const direction = isActive ? sortConfig?.direction : null;

  const Icon =
    direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;

  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
      ? 'text-center'
      : 'text-left';
  const justifyClass =
    align === 'right'
      ? 'justify-end'
      : align === 'center'
      ? 'justify-center'
      : 'justify-start';

  return (
    <th
      scope="col"
      className={`px-6 py-3 ${alignClass} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => onSort?.(sortKey)}
    >
      <div className={`flex items-center space-x-1 ${justifyClass}`}>
        <span>{children ?? label}</span>
        <Icon
          className={`h-3 w-3 ${isActive ? 'text-gray-700' : 'text-gray-400'}`}
        />
      </div>
    </th>
  );
}

export default SortableTableHeader;
