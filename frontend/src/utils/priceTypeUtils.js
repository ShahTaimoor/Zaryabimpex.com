/**
 * Centralized helpers for the order Price Type concept used by Sales and
 * Sales Orders. Keeping them in one place ensures the value the user picks
 * round-trips correctly between create, save, and edit.
 *
 * UI Price Type values (4): 'wholesale' | 'retail' | 'distributor' | 'custom'
 * Backend orderType values (4): 'retail' | 'wholesale' | 'return' | 'exchange'
 *
 * Mapping rules:
 *  - retail / wholesale  → stored as-is
 *  - distributor         → stored as 'wholesale' (distributor pricing tier
 *                          uses the wholesale price column in DB).
 *  - custom              → stored as 'wholesale' (no dedicated DB tier).
 *  - return / exchange   → not pricing tiers, treated as overrides for the
 *                          backend orderType field only.
 */

export const PRICE_TYPE_OPTIONS = [
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'retail', label: 'Retail' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'custom', label: 'Custom' },
];

export const PRICE_TYPE_VALUES = PRICE_TYPE_OPTIONS.map((o) => o.value);

const norm = (v) => String(v ?? '').trim().toLowerCase();

/** Normalize any value into one of the canonical UI price types. */
export function normalizePriceType(value, fallback = 'wholesale') {
  const v = norm(value);
  if (PRICE_TYPE_VALUES.includes(v)) return v;
  return fallback;
}

/**
 * Convert a UI price type into a backend-storable orderType value.
 * (`distributor` and `custom` are folded into `wholesale` for storage.)
 */
export function mapPriceTypeToOrderType(priceType) {
  const v = norm(priceType);
  if (v === 'retail') return 'retail';
  if (v === 'wholesale') return 'wholesale';
  if (v === 'distributor') return 'wholesale';
  if (v === 'custom') return 'wholesale';
  return 'retail';
}

/**
 * Convert a customer's businessType into the matching UI price type. Used
 * when a customer is freshly selected and we want to suggest a sensible
 * default. Returns null if the businessType is missing/unknown.
 */
export function priceTypeFromBusinessType(businessType) {
  const v = norm(businessType);
  if (!v) return null;
  if (v === 'retail' || v === 'individual') return 'retail';
  if (v === 'wholesale') return 'wholesale';
  if (v === 'distributor') return 'distributor';
  return null;
}

/**
 * Resolve the initial Price Type when entering edit mode for an existing
 * order. Combines the saved orderType with the customer's businessType so
 * we can recover `distributor` (which collapses to `wholesale` in the DB).
 *
 * Priority:
 *   1. If saved orderType is retail/wholesale AND the customer's
 *      businessType maps to the same orderType, prefer the more specific
 *      customer-derived value (e.g. distributor over wholesale).
 *   2. Otherwise use the saved orderType when it's retail/wholesale.
 *   3. Otherwise (return/exchange/unknown) fall back to the customer.
 *   4. Final fallback: 'wholesale'.
 */
export function deriveInitialPriceType(savedOrderType, customer) {
  const saved = norm(savedOrderType);
  const fromCustomer = priceTypeFromBusinessType(
    customer?.businessType ?? customer?.business_type
  );

  if ((saved === 'retail' || saved === 'wholesale') && fromCustomer) {
    if (mapPriceTypeToOrderType(fromCustomer) === saved) {
      return fromCustomer;
    }
  }

  if (saved === 'retail' || saved === 'wholesale') return saved;
  if (fromCustomer) return fromCustomer;
  return 'wholesale';
}

/**
 * Decide the final orderType to send to the backend. If the order has been
 * marked as a return/exchange (currentOrderType), keep that value; otherwise
 * use the price-type-derived value so the user's selection is persisted.
 */
export function resolveOrderTypeForSave(priceType, currentOrderType) {
  const cur = norm(currentOrderType);
  if (cur === 'return' || cur === 'exchange') return cur;
  return mapPriceTypeToOrderType(priceType);
}
