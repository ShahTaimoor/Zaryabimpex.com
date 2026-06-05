/** AR / AP account detection for Journal Voucher party linking */

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

const AR_ACCOUNT_CODES = new Set(['1100', '1130']);
const AP_ACCOUNT_CODES = new Set(['2000', '2100', '2110']);

export const getAccountRecordId = (account) => account?.id || account?._id || '';

export function requiresCustomerParty(account) {
  if (!account) return false;
  const code = normalizeCode(account.accountCode);
  if (code.startsWith('CUST-') || AR_ACCOUNT_CODES.has(code)) return true;
  if (Array.isArray(account.tags) && account.tags.includes('customer')) return true;
  const name = String(account.accountName || '').toLowerCase();
  return name.includes('accounts receivable') || name === 'receivable';
}

export function requiresSupplierParty(account) {
  if (!account) return false;
  const code = normalizeCode(account.accountCode);
  if (code.startsWith('SUPP-') || AP_ACCOUNT_CODES.has(code)) return true;
  if (Array.isArray(account.tags) && account.tags.includes('supplier')) return true;
  const name = String(account.accountName || '').toLowerCase();
  return (
    name.includes('accounts payable') ||
    (name.includes('payable') && !name.includes('tax') && !name.includes('sales'))
  );
}

/** @returns {'customer' | 'supplier' | null} */
export function getPartyLinkType(account) {
  if (requiresCustomerParty(account)) return 'customer';
  if (requiresSupplierParty(account)) return 'supplier';
  return null;
}

export function entryNeedsCustomerId(accountCode) {
  const code = normalizeCode(accountCode);
  return AR_ACCOUNT_CODES.has(code) || code.startsWith('CUST-');
}

export function entryNeedsSupplierId(accountCode) {
  const code = normalizeCode(accountCode);
  return AP_ACCOUNT_CODES.has(code) || code.startsWith('SUPP-');
}

export function getPartyAccountCode(partyId, type) {
  const id = String(partyId || '').trim().toUpperCase();
  if (!id) return '';
  return type === 'customer' ? `CUST-${id}` : `SUPP-${id}`;
}

/** Find CUST-/SUPP- ledger row for a party id within a list or map of accounts. */
export function findPartyLedgerAccount(partyId, type, accounts = []) {
  const targetCode = normalizeCode(getPartyAccountCode(partyId, type));
  if (!targetCode) return null;
  const list = Array.isArray(accounts) ? accounts : Array.from(accounts.values?.() || []);
  return list.find((a) => normalizeCode(a.accountCode) === targetCode) || null;
}

/**
 * Map a customer/supplier entity to an account dropdown option.
 * Falls back to synthetic SUPP_PARTY:: / CUST_PARTY:: when no ledger row exists.
 */
export function resolvePartyAccountOption(party, type, accounts = []) {
  const partyId = party?.id || party?._id;
  if (!partyId) return null;

  const account = findPartyLedgerAccount(partyId, type, accounts);
  if (account) {
    const value = getAccountRecordId(account);
    return value ? { value, account, partyId: String(partyId) } : null;
  }

  const prefix = type === 'customer' ? 'CUST_PARTY' : 'SUPP_PARTY';
  return {
    value: `${prefix}::${partyId}`,
    account: null,
    partyId: String(partyId),
  };
}
