import React from 'react';

export function ProductSelectionCartSection({
  title = 'Product Selection & Cart',
  headerActions = null,
  searchSection = null,
  isEmpty = false,
  emptyIcon: EmptyIcon = null,
  emptyText = 'No items in cart',
  children,
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
            {headerActions}
          </div>
        </div>
      </div>
      <div className="card-content">
        {searchSection ? <div className="mb-6">{searchSection}</div> : null}

        {isEmpty ? (
          <div className="p-8 text-center text-gray-500">
            {EmptyIcon ? <EmptyIcon className="mx-auto h-12 w-12 text-gray-400" /> : null}
            <p className="mt-2">{emptyText}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

