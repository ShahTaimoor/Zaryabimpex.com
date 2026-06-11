import { normalizePhoneForWhatsApp } from '../helpers/buildWhatsAppMessage';

/** Company support line (also used on Login / help). */
export const SUPPORT_WHATSAPP_PHONE = '923130922988';

export function buildWhatsAppSendUrl(phone, text) {
  const normalized = normalizePhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(text || '');
  if (!normalized) {
    return `https://wa.me/?text=${encoded}`;
  }
  return `https://wa.me/${normalized}?text=${encoded}`;
}

export function buildWhatsAppDeepLink(phone, text) {
  const normalized = normalizePhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(text || '');
  if (!normalized) {
    return `whatsapp://send?text=${encoded}`;
  }
  return `whatsapp://send?phone=${normalized}&text=${encoded}`;
}

/**
 * Open WhatsApp with pre-filled message to a specific number.
 */
export function openWhatsAppChat(phone, text) {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const url = isMobile ? buildWhatsAppDeepLink(phone, text) : buildWhatsAppSendUrl(phone, text);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Open WhatsApp composer without a recipient — user picks the contact in WhatsApp.
 * Used for invoice PDF sharing (not support chat).
 */
export function openWhatsAppComposer(text) {
  openWhatsAppChat(null, text);
}
export function openSupportWhatsApp(text) {
  openWhatsAppChat(SUPPORT_WHATSAPP_PHONE, text);
}

