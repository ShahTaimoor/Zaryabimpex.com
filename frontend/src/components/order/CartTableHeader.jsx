import React from 'react';

export function CartTableHeader({ className, columns }) {
  return (
    <div className={className}>
      {columns.map((col) => (
        <div key={col.key} className={col.wrapperClassName || 'min-w-0'}>
          <span className={col.labelClassName || 'text-xs font-semibold text-gray-600 uppercase'}>
            {col.label}
          </span>
        </div>
      ))}
    </div>
  );
}

