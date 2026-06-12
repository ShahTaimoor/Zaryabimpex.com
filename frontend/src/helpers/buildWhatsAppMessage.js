/**
 * Normalize Pakistani / international numbers for wa.me (digits only, country code).
 * e.g. 03001234567 → 923001234567
 */
export function normalizePhoneForWhatsApp(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('3')) digits = `92${digits}`;
  return digits;
}

export function isValidWhatsAppPhone(phone) {
  const normalized = normalizePhoneForWhatsApp(phone);
  return normalized.length >= 10 && normalized.length <= 15;
}

/**
 * WhatsApp caption — empty by default (invoice PDF has all details).
 * Only used for link-based fallback sharing.
 */
export function buildWhatsAppInvoiceMessage(_orderData, options = {}) {
  const { pdfLink } = options;
  if (pdfLink) {
    return `Download Invoice:\n${pdfLink}`;
  }
  return '';
}

export function resolvePartyPhoneFromOrder(orderData) {
  const info = orderData?.customerInfo || orderData?.customer || orderData?.supplierInfo || orderData?.supplier || {};
  return info.phone || info.mobile || info.contactNumber || orderData?.phone || '';
}
