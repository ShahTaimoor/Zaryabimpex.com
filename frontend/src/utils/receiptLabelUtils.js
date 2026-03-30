/**
 * Build product rows for BarcodeLabelPrinter from purchase lines (invoice / PO).
 * Merges duplicate product ids by summing label quantities.
 */
export function buildReceiptLabelProductsFromLineItems(lineItems) {
  if (!Array.isArray(lineItems)) return [];
  const byId = new Map();

  for (const item of lineItems) {
    const raw = item.product;
    const p = typeof raw === 'object' && raw !== null ? raw : item.productData || {};
    const id = p._id || p.id || (typeof raw === 'string' ? raw : null);
    if (!id) continue;

    const qty = Math.max(0, Math.round(Number(item.quantity) || 0));
    if (qty <= 0) continue;

    const key = String(id);
    const name =
      p.name ||
      p.displayName ||
      p.display_name ||
      p.variantName ||
      p.variant_name ||
      'Product';

    const existing = byId.get(key);
    if (existing) {
      existing.labelQuantity += qty;
    } else {
      byId.set(key, {
        ...p,
        _id: id,
        id,
        name,
        labelQuantity: qty,
      });
    }
  }

  return Array.from(byId.values());
}
