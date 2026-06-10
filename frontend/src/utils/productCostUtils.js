/**
 * Catalog / master cost from product pricing (matches POS search dropdown "Cost:").
 */
export function getProductCostPrice(product) {
  if (!product) return 0;

  const pricing = product.pricing || {};
  const normalizedCost =
    pricing.cost ??
    pricing.costPrice ??
    pricing.cost_price ??
    pricing.purchasePrice ??
    pricing.purchase_price ??
    pricing.wholesaleCost ??
    product.costPrice ??
    product.cost_price ??
    product.purchasePrice ??
    product.purchase_price;

  const numericCost = Number(normalizedCost);
  return Number.isFinite(numericCost) ? numericCost : 0;
}

/** Rounded catalog cost for UI display. */
export function getProductDisplayCostPrice(product) {
  if (!product) return null;
  const catalogCost = getProductCostPrice(product);
  return Number.isFinite(catalogCost) ? Math.round(catalogCost) : null;
}

/**
 * Cost threshold for loss warnings: higher of catalog cost and last purchase price.
 */
export function getEffectiveCostForLossCheck(product, lastPurchasePrice) {
  const catalogCost = getProductCostPrice(product);
  const last =
    lastPurchasePrice !== null && lastPurchasePrice !== undefined
      ? Number(lastPurchasePrice)
      : null;
  if (last !== null && Number.isFinite(last)) {
    return Math.max(catalogCost, last);
  }
  return catalogCost;
}
