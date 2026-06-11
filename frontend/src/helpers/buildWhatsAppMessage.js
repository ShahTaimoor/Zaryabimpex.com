import { formatCurrency } from '../utils/formatters';

/**
 * Normalize Pakistani / international numbers for wa.me (digits only, country code).
 * e.g. 03130922988 → 923130922988
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

function resolveCustomerName(orderData) {
  const info = orderData?.customerInfo || orderData?.customer || {};
  return (
    info.businessName ||
    info.business_name ||
    info.displayName ||
    info.name ||
    orderData?.customerName ||
    orderData?.customer_name ||
    'Customer'
  );
}

function resolveInvoiceNumber(orderData) {
  return (
    orderData?.invoiceNumber ||
    orderData?.orderNumber ||
    orderData?.order_number ||
    orderData?.id ||
    orderData?._id ||
    '—'
  );
}

function resolveTotalAmount(orderData) {
  const total =
    orderData?.pricing?.total ??
    orderData?.total ??
    0;
  return formatCurrency(Number(total) || 0);
}

/**
 * Reusable WhatsApp invoice message template.
 */
export function buildWhatsAppInvoiceMessage(orderData, options = {}) {
  const { pdfLink, companyName } = options;
  const customerName = resolveCustomerName(orderData);
  const invoiceNumber = resolveInvoiceNumber(orderData);
  const totalAmount = resolveTotalAmount(orderData);
  const from = companyName ? `${companyName}\n\n` : '';

  let message = `${from}Hello ${customerName},

Thank you for your purchase.

Invoice No: ${invoiceNumber}
Total Amount: ${totalAmount}`;

  if (pdfLink) {
    message += `

Download Invoice:
${pdfLink}`;
  } else {
    message += `

Please find your invoice attached.`;
  }

  return message.trim();
}

export function resolvePartyPhoneFromOrder(orderData) {
  const info = orderData?.customerInfo || orderData?.customer || orderData?.supplierInfo || orderData?.supplier || {};
  return info.phone || info.mobile || info.contactNumber || orderData?.phone || '';
}
