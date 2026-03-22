/**
 * Dual unit utilities for products with boxes and pieces.
 * Stock is always managed in pieces (base unit).
 * When piecesPerBox > 1, product supports both boxes and pieces.
 *
 * Example: Cotton - 1 box = 10 pieces
 * User enters: 2 boxes + 5 pieces => Total = 25 pieces
 */

/**
 * Check if product supports dual unit (boxes + pieces)
 * @param {object} product - Product object
 * @returns {boolean}
 */
export function hasDualUnit(product) {
  const ppb = product?.piecesPerBox ?? product?.pieces_per_box;
  return ppb != null && Number(ppb) > 1;
}

/**
 * Get pieces per box for a product (null if pieces-only)
 * @param {object} product - Product object
 * @returns {number|null}
 */
export function getPiecesPerBox(product) {
  const ppb = product?.piecesPerBox ?? product?.pieces_per_box;
  if (ppb == null || ppb === '') return null;
  const n = Number(ppb);
  return n > 1 ? n : null;
}

/**
 * Compute total quantity in pieces from boxes and pieces
 * @param {number} boxes - Number of boxes
 * @param {number} pieces - Loose pieces
 * @param {number} piecesPerBox - Pieces per box (must be > 1)
 * @returns {number} Total pieces
 */
export function computeTotalPieces(boxes = 0, pieces = 0, piecesPerBox = 1) {
  const b = Math.max(0, Number(boxes) || 0);
  const p = Math.max(0, Number(pieces) || 0);
  const ppb = Math.max(1, Number(piecesPerBox) || 1);
  return Math.round((b * ppb + p) * 100) / 100;
}

/**
 * Split total pieces into boxes and remainder pieces
 * @param {number} totalPieces - Total quantity in pieces
 * @param {number} piecesPerBox - Pieces per box
 * @returns {{ boxes: number, pieces: number }}
 */
export function piecesToBoxesAndPieces(totalPieces, piecesPerBox) {
  const total = Math.max(0, Number(totalPieces) || 0);
  const ppb = Math.max(1, Number(piecesPerBox) || 1);
  const boxes = Math.floor(total / ppb);
  const pieces = Math.round((total - boxes * ppb) * 100) / 100;
  return { boxes, pieces };
}

/**
 * Clamp line total (pieces) to stock max and order min; re-split boxes/pieces.
 * @returns {{ total: number, boxes: number, pieces: number, wasCapped: boolean }}
 */
export function clampDualTotal(rawTotal, min, max, piecesPerBox) {
  const ppbN = Math.max(1, Number(piecesPerBox) || 1);
  let t = Math.max(0, Number(rawTotal) || 0);
  let wasCapped = false;
  const cap = max != null && max !== '' && !Number.isNaN(Number(max)) ? Number(max) : null;

  if (cap != null && t > cap) {
    t = cap;
    wasCapped = true;
  }

  const minN = Number(min) || 1;
  if (cap === 0) {
    t = 0;
  } else if (t < minN) {
    t = minN;
  }

  const { boxes, pieces } = piecesToBoxesAndPieces(t, ppbN);
  return { total: t, boxes, pieces, wasCapped };
}

/**
 * Format available stock for UI when product uses boxes + pieces
 * @param {number} stockPieces - Stock quantity in pieces
 * @param {object|null} product - Product with piecesPerBox
 * @returns {string} e.g. "2 pcs" or "0 boxes · 2 pcs"
 */
export function formatStockDualLabel(stockPieces, product = null) {
  const n = Math.max(0, Number(stockPieces) || 0);
  const ppb = getPiecesPerBox(product);
  if (ppb == null) {
    return `${n} pcs`;
  }
  const { boxes, pieces } = piecesToBoxesAndPieces(n, ppb);
  const parts = [];
  if (boxes > 0) {
    parts.push(`${boxes} box${boxes !== 1 ? 'es' : ''}`);
  }
  if (pieces > 0) {
    parts.push(`${pieces} pcs`);
  }
  if (parts.length === 0) {
    return '0 pcs';
  }
  return parts.join(' · ');
}

/**
 * Stock left (in pieces) after selling `quantityPieces` from `stockPieces`.
 */
export function getRemainingStockAfterQuantity(stockPieces, quantityPieces) {
  const stock = Math.max(0, Number(stockPieces) || 0);
  const qty = Math.max(0, Number(quantityPieces) || 0);
  return Math.max(0, stock - qty);
}

/**
 * Human-readable "what's left after this line" for sales UI.
 * e.g. stock 1000, qty 100 → "900 pcs" or "9 boxes · 0 pcs"
 */
export function formatRemainingAfterSaleLabel(stockPieces, quantityPieces, product = null) {
  const rem = getRemainingStockAfterQuantity(stockPieces, quantityPieces);
  const ppb = getPiecesPerBox(product);
  if (ppb == null) {
    return `${rem} pcs`;
  }
  return formatStockDualLabel(rem, product);
}

export function formatQuantityDisplay(quantity, product = null, piecesPerBox = null, stored = null) {
  const qty = Number(quantity) || 0;
  const ppb = piecesPerBox ?? getPiecesPerBox(product);
  if (ppb == null || ppb <= 1) {
    return `${qty} pcs`;
  }
  if (stored && (stored.boxes != null || stored.pieces != null)) {
    const b = Number(stored.boxes) || 0;
    const p = Number(stored.pieces) || 0;
    const parts = [];
    if (b > 0) parts.push(`${b} box${b !== 1 ? 'es' : ''}`);
    if (p > 0) parts.push(`${p} pcs`);
    return parts.length ? parts.join(', ') : `${qty} pcs`;
  }
  const { boxes, pieces } = piecesToBoxesAndPieces(qty, ppb);
  const parts = [];
  if (boxes > 0) parts.push(`${boxes} box${boxes !== 1 ? 'es' : ''}`);
  if (pieces > 0) parts.push(`${pieces} pcs`);
  return parts.length ? parts.join(', ') : `${qty} pcs`;
}
