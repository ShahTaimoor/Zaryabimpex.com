import React, { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  /** When false, hide trailing "pcs" labels next to quantity (e.g. sales order cart). */
  showPiecesUnitLabel = true,
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

  /** Always merge so callers can override sizing — never drop w-full/min-w-0 (prevents grid overflow into Rate, etc.) */
  const baseInput = cn(
    'w-full min-w-0 text-center border border-gray-300 rounded-md px-2 h-10 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
    inputClassName
  );

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
      <div
        className={
          compact
            ? cn('flex w-full min-w-0 flex-col gap-0', className)
            : `space-y-1 ${className}`
        }
        {...props}
      >
        <div className={compact ? 'flex min-w-0 items-center gap-1' : ''}>
          <input
            type="number"
            min={min}
            max={max != null ? max : undefined}
            value={quantity || ''}
            onChange={handleSingleChange}
            onFocus={(e) => e.target.select()}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            inputMode="numeric"
            pattern="[0-9]*"
            className={baseInput}
          />
          {!compact && showPiecesUnitLabel && (
            <span className="text-xs text-gray-500">pcs</span>
          )}
        </div>
        {remainingLine}
      </div>
    );
  }

  // Dual unit but both box & pieces columns turned off → single total (pcs) input
  if (!showBoxInput && !showPiecesInput) {
    return (
      <div
        className={
          compact
            ? cn('flex w-full min-w-0 flex-col gap-0', className)
            : `space-y-1 ${className}`
        }
        {...props}
      >
        <div className={compact ? 'flex min-w-0 items-center gap-1' : ''}>
          <input
            type="number"
            min={min}
            max={max != null ? max : undefined}
            value={quantity || ''}
            onChange={handleDualTotalPiecesOnlyChange}
            onFocus={(e) => e.target.select()}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            inputMode="numeric"
            pattern="[0-9]*"
            className={baseInput}
          />
          {!compact && showPiecesUnitLabel && (
            <span className="text-xs text-gray-500">pcs</span>
          )}
        </div>
        {remainingLine}
      </div>
    );
  }

  if (compact || variant === 'compact') {
    /** Input row (h-8): Box/Pieces inputs only (no trailing Total box, no caption row). */
    const segmentInputClass =
      'min-w-0 flex-1 border-0 bg-transparent p-0 text-center text-base md:text-sm tabular-nums text-gray-900 shadow-none ring-0 placeholder:text-gray-400 focus:outline-none focus:ring-0 h-full';

    return (
      <div className={`flex w-full min-w-0 flex-col gap-0.5 ${className}`} {...props}>
        <div
          className="flex h-8 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/25"
          role="group"
          aria-label="Quantity: boxes, pieces, total pieces"
        >
          {showBoxInput && (
            <div className="flex min-w-0 flex-1 items-center border-r border-gray-200 px-1.5">
              <input
                type="number"
                min={0}
                value={quantity === 0 ? '' : (boxes !== undefined ? boxes : '')}
                onChange={handleBoxesChange}
                onFocus={(e) => e.target.select()}
                onKeyDown={onKeyDown}
                disabled={disabled}
                placeholder="0"
                inputMode="numeric"
                pattern="[0-9]*"
                className={segmentInputClass}
                title="Full boxes"
              />
            </div>
          )}
          {showPiecesInput && (
            <div className="flex min-w-0 flex-1 items-center border-r border-gray-200 px-1.5">
              <input
                type="number"
                min={0}
                value={quantity === 0 ? '' : (pieces !== undefined ? pieces : '')}
                onChange={handlePiecesChange}
                onFocus={(e) => e.target.select()}
                onKeyDown={onKeyDown}
                disabled={disabled}
                placeholder="0"
                inputMode="numeric"
                pattern="[0-9]*"
                className={segmentInputClass}
                title="Loose pieces"
              />
            </div>
          )}
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
              value={quantity === 0 ? '' : (boxes !== undefined ? boxes : '')}
              onChange={handleBoxesChange}
              onFocus={(e) => e.target.select()}
              onKeyDown={onKeyDown}
              disabled={disabled}
              placeholder="0"
              inputMode="numeric"
              pattern="[0-9]*"
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
              value={quantity === 0 ? '' : (pieces !== undefined ? pieces : '')}
              onChange={handlePiecesChange}
              onFocus={(e) => e.target.select()}
              onKeyDown={onKeyDown}
              disabled={disabled}
              placeholder="0"
              inputMode="numeric"
              pattern="[0-9]*"
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
