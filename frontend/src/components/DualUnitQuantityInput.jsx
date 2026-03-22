import React, { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  computeTotalPieces,
  piecesToBoxesAndPieces,
  getPiecesPerBox,
  hasDualUnit,
  clampDualTotal,
  formatRemainingAfterSaleLabel
} from '../utils/dualUnitUtils';

/**
 * Dual unit quantity input - supports boxes + pieces when product has piecesPerBox > 1.
 * Enforces max (stock in pieces) so totals cannot exceed available stock.
 */
export function DualUnitQuantityInput({
  product,
  quantity = 0,
  onChange,
  min = 1,
  max,
  disabled = false,
  className = '',
  inputClassName = '',
  compact = false,
  variant = 'default',
  placeholder = '0',
  onKeyDown,
  /** When true (e.g. sales), show stock remaining after this quantity vs `max` (stock in pcs). */
  showRemainingAfterSale = false,
  /**
   * Stock in pieces for the "After sale" line. Use when `max` is not the real stock (e.g. cart uses 999999).
   * Defaults to `max` when omitted.
   */
  stockPiecesForRemaining,
  /** Show Box(es) column for dual-unit products (default true). */
  showBoxInput = true,
  /** Show loose Pieces column for dual-unit products (default true). */
  showPiecesInput = true,
  ...props
}) {
  const ppb = getPiecesPerBox(product);
  const useDual = hasDualUnit(product);
  const lastToastRef = useRef(0);

  const showCappedToast = useCallback(() => {
    const now = Date.now();
    if (now - lastToastRef.current < 800) return;
    lastToastRef.current = now;
    const cap = max != null ? Number(max) : '';
    toast.warning(
      cap !== ''
        ? `Maximum you can enter is ${cap} pcs (available stock).`
        : 'Quantity adjusted to available stock.'
    );
  }, [max]);

  const { boxes, pieces } = piecesToBoxesAndPieces(quantity, ppb || 1);

  const handleBoxesChange = useCallback(
    (e) => {
      const b = Math.max(0, parseInt(e.target.value, 10) || 0);
      const p = showPiecesInput ? Math.max(0, Number(pieces) || 0) : 0;
      const raw = computeTotalPieces(b, p, ppb);
      const { total, boxes: nb, pieces: np, wasCapped } = clampDualTotal(raw, min, max, ppb);
      if (wasCapped) showCappedToast();
      onChange?.(total, { boxes: nb, pieces: np });
    },
    [ppb, pieces, min, max, onChange, showCappedToast, showPiecesInput]
  );

  const handlePiecesChange = useCallback(
    (e) => {
      const b = showBoxInput ? Math.max(0, Number(boxes) || 0) : 0;
      const p = Math.max(0, parseInt(e.target.value, 10) || 0);
      const raw = computeTotalPieces(b, p, ppb);
      const { total, boxes: nb, pieces: np, wasCapped } = clampDualTotal(raw, min, max, ppb);
      if (wasCapped) showCappedToast();
      onChange?.(total, { boxes: nb, pieces: np });
    },
    [ppb, boxes, min, max, onChange, showCappedToast, showBoxInput]
  );

  const handleSingleChange = useCallback(
    (e) => {
      let val = parseInt(e.target.value, 10);
      if (Number.isNaN(val)) val = min;
      const capMax = max != null && max !== '' && !Number.isNaN(Number(max)) ? Number(max) : null;
      if (capMax != null && val > capMax) {
        val = capMax;
        showCappedToast();
      }
      if (capMax === 0) {
        val = 0;
      } else {
        val = Math.max(min, val);
      }
      onChange?.(val, null);
    },
    [min, max, onChange, showCappedToast]
  );

  /** Dual product but box & pieces inputs hidden — still emit boxes/pieces split for line storage */
  const handleDualTotalPiecesOnlyChange = useCallback(
    (e) => {
      let val = parseInt(e.target.value, 10);
      if (Number.isNaN(val)) val = min;
      const capMax = max != null && max !== '' && !Number.isNaN(Number(max)) ? Number(max) : null;
      if (capMax != null && val > capMax) {
        val = capMax;
        showCappedToast();
      }
      if (capMax === 0) {
        val = 0;
      } else {
        val = Math.max(min, val);
      }
      const { boxes: nb, pieces: np } = piecesToBoxesAndPieces(val, ppb || 1);
      onChange?.(val, { boxes: nb, pieces: np });
    },
    [min, max, onChange, showCappedToast, ppb]
  );

  const baseInput =
    inputClassName ||
    'w-full min-w-0 text-center border border-gray-300 rounded-md px-2 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

  const stockCap =
    max != null && max !== '' && !Number.isNaN(Number(max)) ? Number(max) : null;
  const stockForRemaining =
    stockPiecesForRemaining != null && stockPiecesForRemaining !== '' && !Number.isNaN(Number(stockPiecesForRemaining))
      ? Number(stockPiecesForRemaining)
      : stockCap;
  const remainingLine =
    showRemainingAfterSale && stockForRemaining != null ? (
      <p
        className="mt-1 text-[11px] leading-snug text-emerald-800"
        title="Stock left after this sale (same line)"
      >
        <span className="font-medium text-emerald-900">After sale:</span>{' '}
        <span className="tabular-nums">{formatRemainingAfterSaleLabel(stockForRemaining, quantity, product)}</span>
      </p>
    ) : null;

  if (!useDual) {
    return (
      <div className={compact ? `flex flex-col gap-0 ${className}` : `space-y-1 ${className}`} {...props}>
        <div className={compact ? 'flex items-center gap-1' : ''}>
          <input
            type="number"
            min={min}
            max={max != null ? max : undefined}
            value={quantity || ''}
            onChange={handleSingleChange}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className={baseInput}
          />
          {!compact && <span className="text-xs text-gray-500">pcs</span>}
        </div>
        {remainingLine}
      </div>
    );
  }

  // Dual unit but both box & pieces columns turned off → single total (pcs) input
  if (!showBoxInput && !showPiecesInput) {
    return (
      <div className={compact ? `flex flex-col gap-0 ${className}` : `space-y-1 ${className}`} {...props}>
        <div className={compact ? 'flex items-center gap-1' : ''}>
          <input
            type="number"
            min={min}
            max={max != null ? max : undefined}
            value={quantity || ''}
            onChange={handleDualTotalPiecesOnlyChange}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className={baseInput}
          />
          {!compact && <span className="text-xs text-gray-500">pcs</span>}
        </div>
        {remainingLine}
      </div>
    );
  }

  if (compact || variant === 'compact') {
    return (
      <div className={`flex flex-col gap-1 ${className}`} {...props}>
        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-2.5 shadow-sm">
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            {showBoxInput && (
              <div className="flex min-w-[3.25rem] flex-1 flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Box</span>
                <input
                  type="number"
                  min={0}
                  value={boxes || ''}
                  onChange={handleBoxesChange}
                  onKeyDown={onKeyDown}
                  disabled={disabled}
                  placeholder="0"
                  className={`${baseInput} h-10`}
                  title="Boxes"
                />
              </div>
            )}
            {showPiecesInput && (
              <div className="flex min-w-[3.25rem] flex-1 flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Pcs</span>
                <input
                  type="number"
                  min={0}
                  value={pieces || ''}
                  onChange={handlePiecesChange}
                  onKeyDown={onKeyDown}
                  disabled={disabled}
                  placeholder="0"
                  className={`${baseInput} h-10`}
                  title="Loose pieces (not full boxes)"
                />
              </div>
            )}
            <div className="flex min-w-[4.75rem] shrink-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">Total</span>
              <div
                className="flex h-10 min-w-[4.75rem] items-center justify-center rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold tabular-nums text-gray-900 shadow-sm"
                title="Total quantity in pieces"
              >
                {quantity || 0} <span className="ml-0.5 font-medium text-gray-600">pcs</span>
              </div>
            </div>
          </div>
        </div>
        {remainingLine}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`} {...props}>
    <div className="flex flex-wrap items-end gap-2 sm:gap-3">
      {showBoxInput && (
      <div className="min-w-[3.5rem] flex-1">
        <span className="mb-1 block text-xs font-medium text-gray-600">Boxes</span>
        <input
          type="number"
          min={0}
          value={boxes || ''}
          onChange={handleBoxesChange}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="0"
          className={baseInput}
          title="Full boxes"
        />
      </div>
      )}
      {showPiecesInput && (
      <div className="min-w-[3.5rem] flex-1">
        <span className="mb-1 block text-xs font-medium text-gray-600">Pieces</span>
        <input
          type="number"
          min={0}
          value={pieces || ''}
          onChange={handlePiecesChange}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="0"
          className={baseInput}
          title="Loose pieces"
        />
      </div>
      )}
      <div className="w-[5.75rem] shrink-0 sm:w-24">
        <span className="mb-1 block text-xs font-medium text-gray-600">Total</span>
        <div
          className="flex h-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-sm font-semibold tabular-nums text-gray-900"
          title="Total quantity in pieces (cannot exceed stock)"
        >
          {quantity || 0}
        </div>
      </div>
    </div>
    {remainingLine}
    </div>
  );
}
