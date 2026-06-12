import { generateInvoicePDF, downloadPdfFromPayload } from './pdfService';
import { openWhatsAppComposer } from './whatsappService';
import {
  buildWhatsAppInvoiceMessage,
  resolvePartyPhoneFromOrder,
} from '../helpers/buildWhatsAppMessage';

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function canUseWebShareApi() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function canSharePdfFile(file) {
  if (!canUseWebShareApi() || !file) return false;
  try {
    if (typeof navigator.canShare === 'function') {
      return navigator.canShare({ files: [file] });
    }
    return isMobileDevice();
  } catch {
    return false;
  }
}

export class InvoiceShareValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'InvoiceShareValidationError';
    this.code = code;
  }
}

export function validateInvoiceShareRequirements(orderData, { requireSaved = true } = {}) {
  if (!orderData) {
    throw new InvoiceShareValidationError('Invoice data is missing.', 'NO_INVOICE');
  }

  const orderId = orderData.id || orderData._id;
  const orderNumber = orderData.orderNumber || orderData.order_number || orderData.invoiceNumber;
  const isTemp = String(orderNumber || '').startsWith('TEMP-');

  if (requireSaved && (!orderId || isTemp)) {
    throw new InvoiceShareValidationError('Please save the invoice before sharing on WhatsApp.', 'NOT_SAVED');
  }

  const customer =
    orderData.customer ||
    orderData.customerInfo ||
    orderData.customer_info ||
    null;

  if (!customer && !resolvePartyPhoneFromOrder(orderData)) {
    throw new InvoiceShareValidationError('Please select a customer before sharing.', 'NO_CUSTOMER');
  }

  return { orderId, orderNumber };
}

/**
 * Share invoice via WhatsApp.
 * Opens the device share sheet (PDF attach) or WhatsApp composer — user picks the recipient.
 */
export async function shareInvoiceWhatsApp({
  orderData,
  companySettings,
  documentTitle = 'Invoice',
  partyLabel = 'Customer',
  ledgerBalance = null,
  permissions = {},
  requireSaved = true,
  onProgress,
  pdfLink,
}) {
  validateInvoiceShareRequirements(orderData, { requireSaved });

  onProgress?.('Generating PDF...');
  const { file, payload } = await generateInvoicePDF(orderData, {
    companySettings,
    documentTitle,
    partyLabel,
    ledgerBalance,
    permissions,
    onProgress,
  });

  const invoiceNumber =
    orderData?.invoiceNumber ||
    orderData?.orderNumber ||
    orderData?.order_number ||
    payload?.filename;

  const message = buildWhatsAppInvoiceMessage(orderData, {
    pdfLink,
    companyName: companySettings?.companyName,
  });

  // Primary: share PDF file only — no caption text (invoice details are inside the PDF).
  // User picks WhatsApp, then selects the customer contact.
  if (canSharePdfFile(file)) {
    try {
      await navigator.share({ files: [file] });
      return { method: 'web-share-file' };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { method: 'cancelled' };
      }
    }
  }

  if (canUseWebShareApi()) {
    try {
      await navigator.share({
        files: [file],
        title: `Invoice ${invoiceNumber}`,
      });
      return { method: 'web-share-file-fallback' };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { method: 'cancelled' };
      }
    }
  }

  // Fallback: save PDF, open WhatsApp — user picks contact and attaches the downloaded file.
  onProgress?.('Opening WhatsApp...');
  try {
    await downloadPdfFromPayload(payload, { onProgress });
  } catch {
    // PDF download is best-effort.
  }
  openWhatsAppComposer(message);
  return { method: 'whatsapp-composer', pdfDownloaded: true };
}
