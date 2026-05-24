/**
 * Centralized pricing helpers for sales / purchase / order checkout pages.
 *
 * These utilities replace the per-page `subtotal * taxRate / 100` and
 * direct-discount math that was duplicated across Sales, SalesOrders,
 * Purchase, and PurchaseOrders. Centralising guards against the same
 * class of "discount-before-tax vs. discount-after-tax" drift that bit
 * us in the price-type fix.
 *
 * All math is pure: callers still own state and rendering.
 */

const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const safeRate = (rate) => {
  const n = Number(rate);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
};

/**
 * Compute the cart subtotal from a list of line items.
 * Each item should expose `unitPrice` (or `costPerUnit`) and `quantity`.
 */
export function computeLineItemSubtotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    if (!item) return sum;
    const price = toNum(item.costPerUnit ?? item.unitPrice ?? item.price ?? 0);
    const qty = toNum(item.quantity ?? 0);
    return sum + price * qty;
  }, 0);
}

/**
 * Resolve a "direct discount" amount from a {type, value} pair.
 *   type === 'percentage' -> percent of subtotal, capped at subtotal
 *   anything else        -> flat amount, capped at subtotal
 */
export function computeDirectDiscountAmount(subtotal, directDiscount) {
  const sub = Math.max(0, toNum(subtotal));
  if (!directDiscount) return 0;
  const value = Math.max(0, toNum(directDiscount.value));
  if (value <= 0) return 0;
  if (directDiscount.type === 'percentage') {
    return Math.min(sub, (sub * value) / 100);
  }
  return Math.min(sub, value);
}

/**
 * Compute tax on a base amount when the system is enabled.
 *   - If `taxSystemEnabled` is false, returns 0.
 *   - Tax base is the value passed in (callers decide whether to pass
 *     subtotal or subtotalAfterDiscount).
 */
export function computeTaxAmount({
  baseAmount,
  taxRate,
  taxSystemEnabled = true,
}) {
  if (!taxSystemEnabled) return 0;
  const base = Math.max(0, toNum(baseAmount));
  const rate = safeRate(taxRate);
  return (base * rate) / 100;
}

/**
 * One-shot "compute the whole checkout breakdown" helper. Use this for
 * sales-style pricing where the canonical order is:
 *   subtotal -> (− discounts) -> (+ tax on discounted) -> total.
 *
 * Discount inputs can be combined: line-level totals + a direct discount
 * (percentage or flat). Tax base is `subtotal − totalDiscount` to match
 * Sales / SalesOrders behaviour.
 */
export function computeSalesCheckoutPricing({
  items,
  lineDiscountTotal = 0,
  directDiscount = null,
  codeDiscountAmount = 0,
  taxRate = 0,
  taxSystemEnabled = true,
}) {
  const subtotal = computeLineItemSubtotal(items);
  const directAmount = computeDirectDiscountAmount(subtotal, directDiscount);
  const totalDiscount = Math.min(
    subtotal,
    toNum(lineDiscountTotal) + toNum(codeDiscountAmount) + directAmount
  );
  const subtotalAfterDiscount = Math.max(0, subtotal - totalDiscount);
  const tax = computeTaxAmount({
    baseAmount: subtotalAfterDiscount,
    taxRate,
    taxSystemEnabled,
  });
  const total = subtotalAfterDiscount + tax;
  return {
    subtotal,
    lineDiscountTotal: toNum(lineDiscountTotal),
    directDiscountAmount: directAmount,
    codeDiscountAmount: toNum(codeDiscountAmount),
    totalDiscount,
    subtotalAfterDiscount,
    tax,
    total,
  };
}

/**
 * Purchase-style pricing helper. Purchases historically apply tax to the
 * raw subtotal (before discount) and add import charges on top:
 *   subtotal -> (+ tax on subtotal) -> (− discount) -> (+ import charges).
 * Keep that ordering here so behaviour matches existing Purchase totals
 * exactly.
 */
export function computePurchaseCheckoutPricing({
  items,
  directDiscount = null,
  taxRate = 0,
  taxSystemEnabled = true,
  importChargesTotal = 0,
}) {
  const subtotal = computeLineItemSubtotal(items);
  const tax = computeTaxAmount({
    baseAmount: subtotal,
    taxRate,
    taxSystemEnabled,
  });
  const directAmount = computeDirectDiscountAmount(subtotal, directDiscount);
  const importCharges = Math.max(0, toNum(importChargesTotal));
  const total = subtotal + tax - directAmount + importCharges;
  return {
    subtotal,
    tax,
    directDiscountAmount: directAmount,
    importChargesTotal: importCharges,
    total,
  };
}
