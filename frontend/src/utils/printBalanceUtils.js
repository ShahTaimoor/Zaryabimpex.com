/**
 * Party balance math shared by POS checkout UI and invoice print.
 *
 * New sale or TEMP preview: ledger does NOT yet include this invoice.
 *   previousBalance = ledger before sale
 *   remainingBalance = ledger + (net − received)
 *
 * Saved / edit: ledger already includes this invoice at last-save values.
 *   When the user edits payment/qty before saving, adjust with savedInvoiceRemaining
 *   so preview matches what will be owed after save.
 */

export function ledgerAlreadyIncludesInvoice(orderData) {
  if (!orderData || typeof orderData !== 'object') return false;
  if (orderData.isEditMode === true) return true;

  const invoiceNum = String(orderData.invoiceNumber || orderData.orderNumber || '');
  if (/^TEMP-/i.test(invoiceNum)) return false;

  return Boolean(orderData.id || orderData._id);
}

/**
 * Core balance projection used by checkout UI and print.
 * @param {number|null|undefined} savedInvoiceRemaining - net − paid when the invoice was loaded (edit mode only)
 */
export function computePartyBalances({
  ledgerBalance = 0,
  totalValue = 0,
  receivedAmount = 0,
  orderData = null,
  isEditMode = false,
  savedInvoiceRemaining = null,
} = {}) {
  const ledger = Number(ledgerBalance) || 0;
  const total = Number(totalValue) || 0;
  const received = Number(receivedAmount) || 0;
  const invoiceBalance = total - received;
  const posted = isEditMode || ledgerAlreadyIncludesInvoice(orderData);

  if (posted) {
    const savedRemaining = Number(savedInvoiceRemaining);
    // Never treat the live invoice balance as the saved snapshot — that freezes receivables
    // when qty/rate/payment change during edit.
    const savedDelta = Number.isFinite(savedRemaining) ? savedRemaining : 0;
    const previousBalance = ledger - savedDelta;
    const projectedLedger = previousBalance + invoiceBalance;

    return {
      invoiceBalance,
      previousBalance,
      combinedRemainingBalance: projectedLedger,
      totalReceivables: projectedLedger,
      projectedLedger,
      ledgerAlreadyIncludesInvoice: true,
    };
  }

  const projectedLedger = ledger + invoiceBalance;

  return {
    invoiceBalance,
    previousBalance: ledger,
    combinedRemainingBalance: projectedLedger,
    totalReceivables: projectedLedger,
    projectedLedger,
    ledgerAlreadyIncludesInvoice: false,
  };
}

/**
 * Live POS checkout display: previous balance (before this invoice) + current invoice remaining.
 * Always reacts to cart total and payment edits in real time.
 */
export function computeCheckoutDisplayBalances({
  ledgerBalance = 0,
  totalValue = 0,
  receivedAmount = 0,
  isEditMode = false,
  savedInvoiceRemaining = null,
  savedInvoiceTotal = null,
  savedInvoicePaid = null,
} = {}) {
  const ledger = Number(ledgerBalance) || 0;
  const invoiceRemaining = Math.max(0, (Number(totalValue) || 0) - (Number(receivedAmount) || 0));

  let savedRemaining = Number(savedInvoiceRemaining);
  if (isEditMode && !Number.isFinite(savedRemaining)) {
    const savedTotal = Number(savedInvoiceTotal);
    const savedPaid = Number(savedInvoicePaid);
    if (Number.isFinite(savedTotal)) {
      savedRemaining = Math.max(0, savedTotal - (Number.isFinite(savedPaid) ? savedPaid : 0));
    }
  }

  const previousBalance = isEditMode && Number.isFinite(savedRemaining)
    ? ledger - savedRemaining
    : ledger;
  const totalReceivables = previousBalance + invoiceRemaining;

  return {
    invoiceRemaining,
    invoiceBalance: invoiceRemaining,
    previousBalance,
    combinedRemainingBalance: totalReceivables,
    totalReceivables,
    projectedLedger: totalReceivables,
    ledgerAlreadyIncludesInvoice: isEditMode,
  };
}

/**
 * Print balance math — ledger from API is the source of truth for Remaining Balance.
 * Previous Balance is derived: ledger − (net − received).
 * Does not apply unsaved POS edit projections.
 */
export function computeLedgerPrintBalances({
  ledgerBalance = 0,
  totalValue = 0,
  receivedAmount = 0,
  orderData = null,
} = {}) {
  const total = Number(totalValue) || 0;
  const received = Number(receivedAmount) || 0;
  const invoiceBalance = total - received;
  const posted = ledgerAlreadyIncludesInvoice(orderData);

  if (orderData?.ledgerBalanceFresh) {
    const freshLedger = Number(orderData.ledgerBalance);
    const freshPrevious = Number(orderData.previousBalance);
    if (Number.isFinite(freshLedger)) {
      const previousBalance = Number.isFinite(freshPrevious)
        ? freshPrevious
        : (posted ? freshLedger - invoiceBalance : freshLedger);
      const combinedRemainingBalance = posted
        ? freshLedger
        : freshLedger + invoiceBalance;

      return {
        invoiceBalance,
        previousBalance,
        combinedRemainingBalance,
        ledgerAlreadyIncludesInvoice: posted,
      };
    }
  }

  const ledger = Number(ledgerBalance) || 0;

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

/** @deprecated Use computeLedgerPrintBalances or computePartyBalances */
export function computePrintPartyBalances(params = {}) {
  return computeLedgerPrintBalances(params);
}

/**
 * Compute post-save ledger when API snapshot is not yet available (matches ledger math).
 */
export function computePostSaveLedgerBalance({
  ledgerBalanceBefore = 0,
  totalValue = 0,
  receivedAmount = 0,
  savedInvoiceRemaining = null,
  isNewSale = false,
} = {}) {
  if (isNewSale) {
    const invoiceBalance = Math.max(0, (Number(totalValue) || 0) - (Number(receivedAmount) || 0));
    return (Number(ledgerBalanceBefore) || 0) + invoiceBalance;
  }

  return computePartyBalances({
    ledgerBalance: ledgerBalanceBefore,
    totalValue,
    receivedAmount,
    isEditMode: true,
    savedInvoiceRemaining,
  }).projectedLedger;
}

/** Previous balance before this invoice from post-save remaining ledger. */
export function computePostSavePreviousBalance({
  ledgerBalanceAfter = 0,
  totalValue = 0,
  receivedAmount = 0,
  ledgerBalanceBefore = 0,
  isNewSale = false,
} = {}) {
  const invoiceRemaining = Math.max(0, (Number(totalValue) || 0) - (Number(receivedAmount) || 0));
  if (Number.isFinite(Number(ledgerBalanceAfter))) {
    return Number(ledgerBalanceAfter) - invoiceRemaining;
  }
  if (isNewSale) {
    return Number(ledgerBalanceBefore) || 0;
  }
  return (Number(ledgerBalanceBefore) || 0);
}

/**
 * Resolve ledger for print.
 * 1. Fresh post-save snapshot on order (immediate, no refetch)
 * 2. API/unified ledger
 * 3. Prop / order / party fallbacks
 */
export function resolvePrintLedgerBalance({
  ledgerBalanceProp,
  orderData = null,
  apiBalance = null,
} = {}) {
  if (orderData?.ledgerBalanceFresh) {
    const fresh = Number(orderData.ledgerBalance);
    if (Number.isFinite(fresh)) return fresh;
  }

  const fromProp = ledgerBalanceProp !== undefined && ledgerBalanceProp !== null
    ? Number(ledgerBalanceProp)
    : NaN;
  if (Number.isFinite(fromProp)) return fromProp;

  const fromApi = apiBalance !== undefined && apiBalance !== null ? Number(apiBalance) : NaN;
  if (Number.isFinite(fromApi)) return fromApi;

  const fromOrder = orderData?.ledgerBalance;
  const fromOrderNum = fromOrder !== undefined && fromOrder !== null ? Number(fromOrder) : NaN;
  if (Number.isFinite(fromOrderNum)) return fromOrderNum;

  const fromParty = orderData?.customerInfo?.currentBalance ?? orderData?.customer?.currentBalance;
  const fromPartyNum = fromParty !== undefined && fromParty !== null ? Number(fromParty) : NaN;
  return Number.isFinite(fromPartyNum) ? fromPartyNum : 0;
}

export function hasFreshPrintLedgerBalance(orderData) {
  return Boolean(orderData?.ledgerBalanceFresh && Number.isFinite(Number(orderData?.ledgerBalance)));
}
