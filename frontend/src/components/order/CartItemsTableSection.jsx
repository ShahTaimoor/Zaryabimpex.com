import React from 'react';

export function CartItemsTableSection({
  topContent = null,
  desktopHeader = null,
  children,
  className = 'pt-6',
}) {
  return (
    <div className={className}>
      {topContent}
      {desktopHeader}
      {children}
    </div>
  );
}

