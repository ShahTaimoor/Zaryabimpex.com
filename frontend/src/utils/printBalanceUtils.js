/**
 * Print balance math aligned with Sales / Purchase checkout UI.
 *
 * New sale or TEMP preview: ledger does NOT yet include this invoice.
 *   previousBalance = ledger before sale
 *   remainingBalance = ledger + (net − received)
 *
 * Saved / edit reprint: ledger already includes this invoice.
 *   previousBalance = ledger − (net − received)
 *   remainingBalance = ledger (total still owed)
 */

export function ledgerAlreadyIncludesInvoice(orderData) {
  if (!orderData || typeof orderData !== 'object') return false;
  if (orderData.isEditMode === true) return true;

  const invoiceNum = String(orderData.invoiceNumber || orderData.orderNumber || '');
  if (/^TEMP-/i.test(invoiceNum)) return false;

  return Boolean(orderData.id || orderData._id);
}

export function computePrintPartyBalances({
  ledgerBalance = 0,
  totalValue = 0,
  receivedAmount = 0,
  orderData = null,
} = {}) {
  const ledger = Number(ledgerBalance) || 0;
  const total = Number(totalValue) || 0;
  const received = Number(receivedAmount) || 0;
  const invoiceBalance = total - received;
  const posted = ledgerAlreadyIncludesInvoice(orderData);

  if (posted) {
    return {
      invoiceBalance,
      previousBalance: ledger - invoiceBalance,
      combinedRemainingBalance: ledger,
      ledgerAlreadyIncludesInvoice: true,
    };
  }

  return {
    invoiceBalance,
    previousBalance: ledger,
    combinedRemainingBalance: ledger + invoiceBalance,
    ledgerAlreadyIncludesInvoice: false,
  };
}
