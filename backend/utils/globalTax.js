'use strict';

/**
 * Company-wide GST/VAT from settings (settings.tax_enabled + settings.default_tax_rate).
 * default_tax_rate is stored as percentage 0–100; computations use decimal rate.
 */

function clampPct(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * @param {object} settings - Company settings (camelCase from SettingsRepository)
 * @param {boolean} invoiceTaxExempt - Invoice/order marked tax-exempt
 * @returns {{ rateDecimal: number, percent: number, enabled: boolean }}
 */
function getEffectiveGlobalTaxRate(settings, invoiceTaxExempt = false) {
  const enabled = settings?.taxEnabled === true;
  const pct = clampPct(settings?.defaultTaxRate ?? settings?.default_tax_rate ?? 0);
  if (!enabled || invoiceTaxExempt) {
    return { rateDecimal: 0, percent: pct, enabled: !!enabled };
  }
  return { rateDecimal: pct / 100, percent: pct, enabled: true };
}

const { getSalesOrderLineTotal } = require('./orderConfirmationUtils');

/**
 * Apply global tax to sales order items; returns totals for persistence.
 * Line taxRate stored as percentage (0–100) for compatibility with Sales Orders UI.
 */
function applyGlobalTaxToSalesOrderItems(items, isTaxExempt, settings) {
  const gt = getEffectiveGlobalTaxRate(settings, !!isTaxExempt);
  if (!Array.isArray(items)) {
    return { items: [], tax: 0, subtotal: 0, total: 0 };
  }
  let taxSum = 0;
  let netSum = 0;

  const out = items.map((item) => {
    const cancelled = (item.confirmationStatus ?? item.confirmation_status ?? 'pending') === 'cancelled';
    if (cancelled) {
      return {
        ...item,
        taxRate: 0,
        taxAmount: 0,
        total: getSalesOrderLineTotal(item)
      };
    }

    const lineGross = getSalesOrderLineTotal(item);
    const discPct = Number(item.discountPercent) || 0;
    const lineDiscFromPct = lineGross * (discPct / 100);
    const lineDiscFlat = Number(item.discountAmount) || 0;
    const lineDisc = lineDiscFromPct + lineDiscFlat;
    const taxable = Math.max(0, lineGross - lineDisc);
    const lineTax = taxable * gt.rateDecimal;
    taxSum += lineTax;
    netSum += taxable;

    return {
      ...item,
      taxRate: gt.percent,
      taxAmount: lineTax,
      subtotal: lineGross,
      discountAmount: lineDisc,
      total: taxable + lineTax
    };
  });

  const total = netSum + taxSum;
  return { items: out, tax: taxSum, subtotal: netSum, total };
}

module.exports = {
  getEffectiveGlobalTaxRate,
  applyGlobalTaxToSalesOrderItems
};
