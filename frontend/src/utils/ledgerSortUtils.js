/**
 * Client-side ledger row order (matches backend accountLedgerService.sortLedgerEntriesChronological).
 * Uses posted time first so back-dated returns stay in true entry sequence.
 */

function toMs(value) {
  if (value == null || value === '') return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeReferenceType(entry) {
  return String(entry?.referenceType ?? entry?.source ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
}

function ledgerSameVoucherRank(entry) {
  const refType = normalizeReferenceType(entry);
  const desc = String(entry?.particular ?? entry?.description ?? '').toLowerCase();

  if (refType === 'sale') return 10;
  if (refType === 'sale payment') return 20;

  if (refType === 'sale return') {
    if (desc.includes('refund for return') || desc.includes('cash refund') || desc.includes('bank refund')) {
      return 20;
    }
    return 10;
  }

  if (refType === 'purchase invoice' || refType === 'purchase') return 10;
  if (refType === 'purchase invoice payment') return 20;
  if (refType === 'purchase return') return 10;

  if (desc.includes('payment for sale') || desc.includes('sale payment')) return 20;
  if (desc.startsWith('sale:') || /^sale\b/.test(desc)) return 10;
  if (desc.includes('payment for invoice') || desc.includes('payment for purchase')) return 20;
  if (desc.includes('purchase invoice')) return 10;
  if (desc.startsWith('sale return ') && !desc.includes('refund')) return 10;
  if (desc.startsWith('purchase return ') && !desc.includes('refund')) return 10;

  return 50;
}

function ledgerReferenceSequence(entry) {
  const ref = String(entry?.voucherNo ?? entry?.referenceNumber ?? '').trim();
  if (!ref) return 0;

  const epochMatch = ref.match(/-(\d{13,})$/);
  if (epochMatch) return Number(epochMatch[1]) || 0;

  const retMatch = ref.match(/^RET-(\d{8})-(\d+)$/i);
  if (retMatch) return Number(retMatch[1]) * 100000 + (Number(retMatch[2]) || 0);

  const tailDigits = ref.match(/(\d+)$/);
  if (tailDigits) return Number(tailDigits[1]) || 0;

  return 0;
}

export function sortLedgerDisplayEntries(entries) {
  if (!Array.isArray(entries) || entries.length <= 1) return entries || [];

  const entryPosted = (e) => toMs(e.postedAt ?? e.createdAt ?? e.date);
  const entryDate = (e) => toMs(e.date ?? e.transactionDate);
  const entryId = (e) => String(e.id ?? e.referenceId ?? e.voucherNo ?? '');
  const entryRef = (e) => String(e.voucherNo ?? e.referenceNumber ?? '').trim();

  return [...entries].sort((a, b) => {
    const postedDiff = entryPosted(a) - entryPosted(b);
    if (postedDiff !== 0) return postedDiff;

    const seqDiff = ledgerReferenceSequence(a) - ledgerReferenceSequence(b);
    if (seqDiff !== 0) return seqDiff;

    const dateDiff = entryDate(a) - entryDate(b);
    if (dateDiff !== 0) return dateDiff;

    const refA = entryRef(a);
    const refB = entryRef(b);
    if (refA && refA === refB) {
      const rankDiff = ledgerSameVoucherRank(a) - ledgerSameVoucherRank(b);
      if (rankDiff !== 0) return rankDiff;
    }

    return entryId(a).localeCompare(entryId(b), undefined, { numeric: true });
  });
}

export function isSaleReturnLedgerRow(entry) {
  return normalizeReferenceType(entry) === 'sale return';
}

export function isPurchaseReturnLedgerRow(entry) {
  return normalizeReferenceType(entry) === 'purchase return';
}

/** Recompute balance column after reordering rows. */
export function applyLedgerRunningBalance(entries, openingBalance = 0, isSupplier = false) {
  let running = Number(openingBalance) || 0;
  return (entries || []).map((entry) => {
    const debit = Number(entry.debitAmount) || 0;
    const credit = Number(entry.creditAmount) || 0;
    running += isSupplier ? credit - debit : debit - credit;
    return { ...entry, balance: running };
  });
}
