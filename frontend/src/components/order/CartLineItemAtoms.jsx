import React from 'react';
import { Camera, Trash2, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/LoadingSpinner';
import {
  hasDualUnit,
  getPiecesPerBox,
  piecesToBoxesAndPieces,
} from '@/utils/dualUnitUtils';

/**
 * Small "atom" components extracted from the cart-row JSX duplicated across
 * Sales / SalesOrders / Purchase / PurchaseOrders / SaleReturns /
 * PurchaseReturns. Each atom is intentionally narrow so the consuming
 * page keeps full control over the grid layout, item shape, and
 * page-specific state (sort highlights, virtualization, edit mode).
 *
 * None of these are "smart" — they accept primitives + callbacks and
 * render the visually-identical chunk that previously lived inline.
 */

const stockColorClasses = (currentStock, reorderPoint) => {
  const stock = Number(currentStock) || 0;
  const reorder = Number(reorderPoint) || 0;
  if (stock === 0) return 'text-red-700 bg-red-50 border-red-200';
  if (stock <= reorder) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-gray-700 bg-gray-100 border-gray-200';
};

const boxStockColorClasses = (currentStock, reorderPoint) => {
  const stock = Number(currentStock) || 0;
  const reorder = Number(reorderPoint) || 0;
  if (stock === 0) return 'text-red-700 bg-red-50 border-red-200';
  if (stock <= reorder) return 'text-yellow-800 bg-yellow-50 border-yellow-200';
  return 'text-gray-700 bg-gray-100 border-gray-200';
};

/* ─────────────────────────────────────────────────────────────────────
 * Serial number badge
 *   Renders the boxed "#N" / "N" badge with optional highlight ring
 *   used when the user just added/duplicate-merged a line item.
 *
 *   variant="desktop" → fixed-width 8 cell ("N")
 *   variant="mobile"  → compact pill ("#N")
 * ──────────────────────────────────────────────────────────────────── */
export function LineItemSerial({
  index,
  highlight = false,
  variant = 'desktop',
  className = '',
}) {
  if (variant === 'mobile') {
    return (
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors duration-300 ${
          highlight
            ? 'bg-green-100 text-green-800 border border-green-400 ring-2 ring-green-300/80'
            : 'text-gray-500 bg-gray-100'
        } ${className}`}
      >
        #{index + 1}
      </span>
    );
  }
  return (
    <span
      className={`text-sm font-medium px-0.5 py-1 rounded border block w-8 text-center h-8 flex items-center justify-center transition-colors duration-300 ${
        highlight
          ? 'bg-green-100 text-green-800 border-green-400 ring-2 ring-green-300/80'
          : 'text-gray-700 bg-gray-50 border-gray-200'
      } ${className}`}
    >
      {index + 1}
    </span>
  );
}

/**
 * Static "return cart" serial — green background, no highlight state.
 * Used by SaleReturns and PurchaseReturns desktop rows.
 */
export function LineItemSerialStatic({ index, className = '' }) {
  return (
    <span
      className={`text-sm font-medium px-0.5 py-1 rounded border block w-8 text-center h-8 flex items-center justify-center text-green-800 bg-green-100 border-green-300 ${className}`}
    >
      {index + 1}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Product image thumbnail
 *   Clickable square that opens the product image preview modal.
 *   Renders nothing when `src` is empty so callers don't need their
 *   own conditional wrapper.
 *
 *   size="sm" → 8x8 (desktop row)
 *   size="md" → 10x10 (mobile card)
 *   variant="static" disables the click + hover (used by SaleReturns
 *   which doesn't open the preview modal).
 * ──────────────────────────────────────────────────────────────────── */
export function LineItemThumbnail({
  src,
  alt = '',
  size = 'sm',
  onClick,
  variant = 'interactive',
  crossOrigin,
  className = '',
}) {
  if (!src) return null;
  const dim = size === 'md' ? 'h-10 w-10' : 'h-8 w-8';

  if (variant === 'static' || !onClick) {
    return (
      <div
        className={`${dim} flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200 ${className}`}
      >
        <img
          src={src}
          alt={alt}
          {...(crossOrigin ? { crossOrigin } : {})}
          className="h-full w-full object-cover shadow-sm"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dim} flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200 cursor-pointer hover:border-primary-500 transition-colors group relative ${className}`}
      onClick={onClick}
      title="Click to view full size"
    >
      <img
        src={src}
        alt={alt}
        {...(crossOrigin ? { crossOrigin } : {})}
        className="h-full w-full object-cover shadow-sm"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
        <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Stock cell — color-coded box that shows the current stock count.
 *   Pass `formatValue` to override the rendered text (used when
 *   dual-unit pages render "X box, Y pcs" instead of a raw number).
 * ──────────────────────────────────────────────────────────────────── */
export function LineItemStockCell({
  currentStock,
  reorderPoint = 0,
  formatValue,
  className = '',
  textSize = 'text-sm',
  title,
}) {
  const stock = Number(currentStock) || 0;
  const colorClasses = stockColorClasses(stock, reorderPoint);
  const display =
    typeof formatValue === 'function' ? formatValue(stock) : stock;
  return (
    <span
      title={title}
      className={`${textSize} font-semibold px-2 py-1 rounded border block text-center h-8 flex items-center justify-center ${colorClasses} ${className}`}
    >
      {display}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Total / amount cell — gray boxed display rendered at the right of
 * the row. Pass any string/number; the atom only supplies styling.
 * ──────────────────────────────────────────────────────────────────── */
export function LineItemTotalCell({
  value,
  className = '',
  textSize = 'text-sm',
}) {
  return (
    <span
      className={`${textSize} font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 block w-full min-w-0 text-center h-8 flex items-center justify-center ${className}`}
    >
      {value}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * "Not applicable" placeholder cell — single-character dash with the
 * same height as the inputs around it. Used for the Box column when
 * the product isn't dual-unit, and SaleReturns' phantom unit column.
 * ──────────────────────────────────────────────────────────────────── */
export function LineItemPlaceholderCell({
  symbol = '—',
  title = 'Not applicable',
  className = '',
}) {
  return (
    <span
      title={title}
      className={`text-sm font-semibold px-2 py-1 rounded border block text-center h-8 flex items-center justify-center text-gray-400 bg-gray-50 border-gray-200 ${className}`}
    >
      {symbol}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Remove (delete) button. Wraps `LoadingButton` so consuming pages
 * can pass an `isLoading` map. Pass `loading={undefined}` to fall
 * back to a plain `Button` without the spinner overhead.
 * ──────────────────────────────────────────────────────────────────── */
export function LineItemRemoveButton({
  onClick,
  loading,
  size = 'sm',
  title = 'Delete',
  className = 'h-8 w-8 p-0',
}) {
  if (loading === undefined) {
    return (
      <Button
        type="button"
        onClick={onClick}
        variant="destructive"
        size={size}
        className={className}
        title={title}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <LoadingButton
      onClick={onClick}
      isLoading={loading}
      variant="destructive"
      size={size}
      className={className}
      title={title}
    >
      <Trash2 className="h-4 w-4" />
    </LoadingButton>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Box-input cell for dual-unit products.
 *   Renders an editable box-count input when the product supports
 *   pieces-per-box, otherwise renders a placeholder dash.
 *
 *   `onChange(nextBoxesString)` receives the raw string from the
 *   input so callers can run their own page-specific update logic
 *   (e.g. SalesOrders also updates `quantity` + warns on stock).
 *
 *   `forceNumberInput` switches between the styled `<Input />`
 *   wrapper (PurchaseOrders) and the plain `<input>` other pages use.
 * ──────────────────────────────────────────────────────────────────── */
export function LineItemBoxInputCell({
  product,
  item,
  onChange,
  inputComponent: InputComponent = 'input',
  title = 'Full boxes',
  className = '',
}) {
  if (!hasDualUnit(product)) {
    return <LineItemPlaceholderCell />;
  }
  const ppb = getPiecesPerBox(product);
  const boxVal =
    item.boxes != null
      ? item.boxes
      : ppb
      ? piecesToBoxesAndPieces(item.quantity, ppb).boxes
      : 0;
  const colorClasses = boxStockColorClasses(
    product?.inventory?.currentStock,
    product?.inventory?.reorderPoint
  );
  return (
    <InputComponent
      type="number"
      min={0}
      value={item.quantity === 0 ? '' : boxVal}
      onChange={(e) => onChange?.(e.target.value, e)}
      onFocus={(e) => e.target.select()}
      className={`text-sm font-semibold w-full min-w-0 rounded border px-2 py-1 text-center h-8 focus:outline-none focus:ring-2 focus:ring-primary-500/35 ${colorClasses} ${className}`}
      title={title}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Last-prices applied: small text badge shown next to the product
 * name on Sales and SalesOrders rows.
 *
 *   status = 'updated' | 'unchanged' | 'not-found'
 * ──────────────────────────────────────────────────────────────────── */
const PRICE_STATUS_BADGE = {
  updated: { color: 'bg-green-100 text-green-700', label: 'Updated' },
  unchanged: { color: 'bg-blue-100 text-blue-700', label: 'Same Price' },
  'not-found': {
    color: 'bg-yellow-100 text-yellow-700',
    label: 'Not in Last Order',
  },
};

export function LineItemPriceStatusBadge({ status, className = '' }) {
  const cfg = PRICE_STATUS_BADGE[status];
  if (!cfg) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.color} ${className}`}>
      {cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Last-prices applied: small icon overlay rendered to the right of
 * the unit-price input on Sales rows. Sister to the badge above.
 * ──────────────────────────────────────────────────────────────────── */
const PRICE_STATUS_ICON = {
  updated: { Icon: CheckCircle, color: 'text-green-600', tooltip: 'Price updated from last order' },
  unchanged: { Icon: Info, color: 'text-blue-600', tooltip: 'Price same as last order' },
  'not-found': { Icon: AlertCircle, color: 'text-yellow-600', tooltip: 'Product not found in previous order' },
};

export function LineItemPriceStatusIcon({ status, className = '' }) {
  const cfg = PRICE_STATUS_ICON[status];
  if (!cfg) return null;
  const { Icon, color, tooltip } = cfg;
  return (
    <div
      className={`absolute -right-7 top-1/2 transform -translate-y-1/2 flex items-center z-10 ${className}`}
      title={tooltip}
    >
      <Icon className={`h-4 w-4 ${color} bg-white rounded-full`} />
    </div>
  );
}

/**
 * Resolves the `bg-` ring classes applied to the rate input when
 * Apply Last Prices runs. Used by Sales' rate input.
 */
export function priceStatusInputClasses(status) {
  switch (status) {
    case 'updated':
      return 'bg-green-50 border-green-300 ring-1 ring-green-200';
    case 'not-found':
      return 'bg-yellow-50 border-yellow-300 ring-1 ring-yellow-200';
    case 'unchanged':
      return 'bg-blue-50 border-blue-300 ring-1 ring-blue-200';
    default:
      return '';
  }
}
