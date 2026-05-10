/**
 * Centralized helpers for resolving display names and formatted addresses
 * for parties (customers, suppliers, employees, etc.). Replaces the long
 * nullish chains and ad-hoc address formatters that were duplicated across
 * Sales, SalesOrders, Purchase, PurchaseOrders, Orders, and others.
 */

const trimOrNull = (s) => {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
};

/** Try a chain of candidate fields and return the first non-empty string. */
function pickFirst(party, keys) {
  if (!party || typeof party !== 'object') return null;
  for (const key of keys) {
    const v = trimOrNull(party[key]);
    if (v) return v;
  }
  return null;
}

const CUSTOMER_NAME_KEYS = [
  'businessName',
  'business_name',
  'displayName',
  'display_name',
  'companyName',
  'company_name',
  'name',
  'fullName',
  'full_name',
];

const SUPPLIER_NAME_KEYS = [
  'businessName',
  'business_name',
  'companyName',
  'company_name',
  'displayName',
  'display_name',
  'name',
  'supplierName',
  'supplier_name',
];

/**
 * Resolve a customer's display name. Falls back to `fallback` (default
 * "Walk-in") so callers don't have to repeat the same `?? 'Walk-in'`.
 */
export function getCustomerDisplayName(customer, fallback = 'Walk-in') {
  return pickFirst(customer, CUSTOMER_NAME_KEYS) ?? fallback;
}

/** Resolve a supplier's display name. */
export function getSupplierDisplayName(supplier, fallback = 'Unknown Supplier') {
  return pickFirst(supplier, SUPPLIER_NAME_KEYS) ?? fallback;
}

/** Generic party (customer/supplier/employee/etc.) display name. */
export function getPartyDisplayName(party, fallback = '') {
  if (!party) return fallback;
  if (typeof party === 'string') return party;
  return (
    pickFirst(party, [
      ...CUSTOMER_NAME_KEYS,
      ...SUPPLIER_NAME_KEYS,
      'firstName',
      'lastName',
      'first_name',
      'last_name',
      'title',
    ]) ?? fallback
  );
}

const ADDRESS_LINE_KEYS = [
  'street',
  'address_line1',
  'addressLine1',
  'line1',
  'address',
];
const ADDRESS_ZIP_KEYS = ['zipCode', 'zip', 'postalCode', 'postal_code'];

function flattenAddressObject(a) {
  if (!a || typeof a !== 'object') return '';
  const lineParts = [];
  for (const k of ADDRESS_LINE_KEYS) {
    if (a[k]) {
      lineParts.push(String(a[k]).trim());
      break;
    }
  }
  const city = trimOrNull(a.city);
  const state = trimOrNull(a.state ?? a.province);
  const country = trimOrNull(a.country);
  let zip = null;
  for (const k of ADDRESS_ZIP_KEYS) {
    if (a[k]) {
      zip = String(a[k]).trim();
      break;
    }
  }
  return [lineParts[0], city, state, country, zip].filter(Boolean).join(', ');
}

function pickPreferredAddress(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  return (
    addresses.find((x) => x?.isDefault) ||
    addresses.find((x) => x?.type === 'billing' || x?.type === 'both') ||
    addresses[0]
  );
}

/**
 * Format a party's address as a single comma-separated line. Handles all
 * the shapes seen in the codebase:
 *   - party.address (string)
 *   - party.address (object)
 *   - party.address (array of objects)
 *   - party.addresses (array)
 *   - party.location / party.companyAddress (string fallbacks)
 *
 * Returns the empty string when no address can be resolved (callers use
 * truthy checks before rendering).
 */
export function formatPartyAddress(party) {
  if (!party) return '';

  const directString = trimOrNull(party.address);
  if (directString) return directString;

  const raw = party.address ?? party.addresses;
  if (Array.isArray(raw)) {
    return flattenAddressObject(pickPreferredAddress(raw)) || '—';
  }
  if (raw && typeof raw === 'object') {
    return flattenAddressObject(raw) || '—';
  }

  const location = trimOrNull(party.location);
  if (location) return location;

  const companyAddress = trimOrNull(party.companyAddress);
  if (companyAddress) return companyAddress;

  return '';
}
