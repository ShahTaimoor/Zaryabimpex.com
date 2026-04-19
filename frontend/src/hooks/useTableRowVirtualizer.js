import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Scrollable tbody virtualization (padding `<tr>` pattern — see PurchaseOrders).
 * @param {object} opts
 * @param {number} opts.rowCount
 * @param {boolean} opts.enabled When false, still returns a virtualizer with count 0 (no-op rows).
 * @param {number} [opts.estimateSize]
 * @param {number} [opts.overscan]
 */
export function useTableRowVirtualizer({ rowCount, enabled, estimateSize = 52, overscan = 10 }) {
  const scrollRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: enabled ? rowCount : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });
  return { scrollRef, virtualizer };
}

export function getVirtualTablePadding(vItems, totalH) {
  const padTop = vItems.length ? vItems[0].start : 0;
  const padBottom = vItems.length ? totalH - vItems[vItems.length - 1].end : 0;
  return { padTop, padBottom };
}
