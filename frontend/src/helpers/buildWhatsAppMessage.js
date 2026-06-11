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
 * WhatsApp caption when sharing an invoice PDF — company name only (details are in the PDF).
 */
export function buildWhatsAppInvoiceMessage(_orderData, options = {}) {
  const { pdfLink, companyName } = options;

  if (pdfLink) {
    const parts = [companyName, `Download Invoice:\n${pdfLink}`].filter(Boolean);
    return parts.join('\n\n').trim();
  }

  return (companyName || '').trim();
}

export function resolvePartyPhoneFromOrder(orderData) {
  const info = orderData?.customerInfo || orderData?.customer || orderData?.supplierInfo || orderData?.supplier || {};
  return info.phone || info.mobile || info.contactNumber || orderData?.phone || '';
}
