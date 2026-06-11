import React, { useMemo, useState, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Save,
  Eye,
  X,
  RefreshCcw,
  FileText,
  Search,
  BookOpen,
  Scale
} from 'lucide-react';
import { toast } from 'sonner';
import AsyncSelect from 'react-select/async';
import { useGetAccountsQuery, useLazyGetAccountsQuery } from '../store/services/chartOfAccountsApi';
import { useGetBanksQuery, useLazyGetBanksQuery } from '../store/services/banksApi';
import {
  useGetJournalVouchersQuery,
  useGetJournalVoucherQuery,
  useCreateJournalVoucherMutation,
  usePostJournalVoucherMutation,
} from '../store/services/journalVouchersApi';
import { useLazyGetCustomersQuery } from '../store/services/customersApi';
import { useLazyGetSuppliersQuery } from '../store/services/suppliersApi';
import { useGetBalanceSummaryQuery as useGetCustomerBalanceSummaryQuery } from '../store/services/customerBalancesApi';
import { useGetBalanceSummaryQuery as useGetSupplierBalanceSummaryQuery } from '../store/services/supplierBalancesApi';
import { getCustomerDisplayName, getSupplierDisplayName } from '../utils/partyDisplay';
import { getAccountRecordId, resolvePartyAccountOption } from '../utils/journalPartyAccounts';
import { handleApiError } from '../utils/errorHandler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner, LoadingInline, LoadingButton } from '../components/LoadingSpinner';
import DateFilter from '../components/DateFilter';
import PageShell from '../components/PageShell';
import { PageHeader } from '../components/layout/PageHeader';
import { getCurrentDatePakistan } from '../utils/dateUtils';

const todayISO = () => getCurrentDatePakistan();

const formatBalance = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const asyncSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '2.5rem',
    borderColor: state.isFocused ? '#94a3b8' : '#e2e8f0',
    backgroundColor: '#f8fafc',
    boxShadow: 'none',
    '&:hover': { borderColor: '#cbd5e1' },
  }),
  menu: (base) => ({
    ...base,
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0f172a' : state.isFocused ? '#f1f5f9' : 'white',
    color: state.isSelected ? 'white' : '#334155',
    fontSize: '0.875rem',
  }),
  placeholder: (base) => ({ ...base, color: '#94a3b8', fontSize: '0.875rem' }),
  singleValue: (base) => ({ ...base, color: '#1e293b', fontSize: '0.875rem' }),
};

const createEmptyEntry = () => ({
  accountId: '',
  debit: '',
  credit: '',
  particulars: '',
  partyId: '',
  partyName: ''
});

const isPartyLedgerAccount = (account) => {
  const code = account?.accountCode || '';
  return (
    code.startsWith('CUST-') ||
    code.startsWith('SUPP-') ||
    (Array.isArray(account?.tags) &&
      (account.tags.includes('customer') || account.tags.includes('supplier')))
  );
};

/** GL accounts selectable in journal lines (excludes party sub-ledgers and inactive/non-posting rows). */
const isJournalSelectableAccount = (account) => {
  if (!account || account.deletedAt || account.isActive === false) return false;
  if (isPartyLedgerAccount(account)) return false;
  return account.allowDirectPosting !== false;
};

const getAccountDisplayLabel = (account) => {
  if (!account) return '';
  return `${account.accountCode} — ${account.accountName}`;
};

const extractAccountsList = (response) =>
  response?.data?.accounts || response?.accounts || response?.data || response || [];

const getViewEntryAccountLabel = (entry, bankMap, accountCodeMap) => {
  if (!entry) return '—';
  if (entry.customerId && entry.customerName) return entry.customerName;
  if (entry.supplierId && entry.supplierName) return entry.supplierName;
  if (entry.bankId) {
    const bank = bankMap?.get(entry.bankId);
    if (bank) {
      return `${bank.bankName || bank.bank_name} — ${bank.accountName || bank.account_name}`;
    }
    if (entry.bankName) return entry.bankName;
  }
  const accountName = entry.accountName || accountCodeMap?.get(entry.accountCode)?.accountName;
  if (accountName) return `${entry.accountCode} — ${accountName}`;
  return entry.accountCode || '—';
};

const viewFieldClass =
  'min-h-[2.5rem] px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-sm';

/* ─── View‑Detail Modal ─────────────────────────────────────────────────── */
const ViewModal = ({ voucherId, onClose }) => {
  const {
    data: voucher,
    isLoading,
    isFetching,
    isError,
    error,
  } = useGetJournalVoucherQuery(voucherId, {
    skip: !voucherId,
  });
  const { data: banksResponse } = useGetBanksQuery(
    { isActive: 'true', all: 'true' },
    { skip: !voucherId }
  );
  const { data: accountsResponse } = useGetAccountsQuery(
    { isActive: true, limit: 500 },
    { skip: !voucherId }
  );

  const bankMap = useMemo(() => {
    const list = banksResponse?.data?.banks || banksResponse?.banks || [];
    return new Map(list.map((b) => [b._id || b.id, b]));
  }, [banksResponse]);

  const accountCodeMap = useMemo(() => {
    const rows = extractAccountsList(accountsResponse);
    return new Map((Array.isArray(rows) ? rows : []).map((a) => [a.accountCode, a]));
  }, [accountsResponse]);

  if (!voucherId) return null;

  const entries = voucher?.entries || [];
  const loading = isLoading || isFetching;
  const loadError = isError
    ? (error?.data?.message || error?.data?.error || 'Failed to load journal entry details.')
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-slate-100 p-2 rounded-lg shrink-0">
              <FileText className="h-5 w-5 text-slate-700" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {voucher?.voucherNumber || 'Journal Entry'}
              </h2>
              <p className="text-sm text-slate-500">
                {voucher?.voucherDate
                  ? new Date(voucher.voucherDate).toLocaleDateString()
                  : '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {voucher?.description && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-sm text-slate-700">
            <span className="font-semibold text-slate-500 uppercase text-xs tracking-wide">Description </span>
            <span className="block mt-1">{voucher.description}</span>
          </div>
        )}

        <div className="overflow-auto p-6">
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[220px]">Account</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[150px]">Particulars</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider w-28">Debit</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider w-28">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan="4" className="px-4 py-10 text-center">
                      <LoadingSpinner />
                    </td>
                  </tr>
                )}
                {!loading && loadError && (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-red-600">
                      {loadError}
                    </td>
                  </tr>
                )}
                {!loading && !loadError && entries.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                      No line items found for this entry.
                    </td>
                  </tr>
                )}
                {!loading && !loadError && entries.map((e, i) => {
                  const debit = parseFloat(e.debitAmount) || 0;
                  const credit = parseFloat(e.creditAmount) || 0;
                  const isDebit = debit > 0;
                  const isCredit = credit > 0;
                  const accountLabel = getViewEntryAccountLabel(e, bankMap, accountCodeMap);

                  return (
                    <tr key={e.id || i} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 align-top">
                        <div className={`${viewFieldClass} text-slate-900`}>{accountLabel}</div>
                        <span
                          className={`inline-flex mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                            isDebit ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isDebit ? 'Debit account' : 'Credit account'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div className={`${viewFieldClass} text-slate-600`}>
                          {e.particulars || e.description || '—'}
                        </div>
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums align-top ${
                        isDebit ? 'font-bold text-slate-900' : 'text-slate-300'
                      }`}>
                        {isDebit ? debit.toFixed(2) : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums align-top ${
                        isCredit ? 'font-bold text-slate-900' : 'text-slate-300'
                      }`}>
                        {isCredit ? credit.toFixed(2) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
                <tr>
                  <td colSpan="2" className="px-4 py-2.5 text-right text-slate-600">Totals</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{(voucher?.totalDebit || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{(voucher?.totalCredit || 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {voucher?.notes && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Notes</span>
              <p className="mt-1">{voucher.notes}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

/* ─── Party balance hint (ledger balance for linked customer/supplier) ─── */
const JournalPartyBalance = ({ type, partyId }) => {
  const { data: customerData, isFetching: customerFetching } = useGetCustomerBalanceSummaryQuery(
    partyId,
    { skip: !partyId || type !== 'customer' }
  );
  const { data: supplierData, isFetching: supplierFetching } = useGetSupplierBalanceSummaryQuery(
    partyId,
    { skip: !partyId || type !== 'supplier' }
  );

  if (!partyId) return null;

  const balances =
    type === 'customer'
      ? (customerData?.data?.balances ?? customerData?.balances)
      : (supplierData?.data?.balances ?? supplierData?.balances);

  const isLoading = type === 'customer' ? customerFetching : supplierFetching;
  const balance = Number(balances?.currentBalance ?? 0);
  const hasBalance = Math.abs(balance) > 0.001;

  if (isLoading && balances === undefined) {
    return (
      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
        <LoadingInline message="Loading balance…" />
      </p>
    );
  }

  const isCustomer = type === 'customer';
  const isPayable = isCustomer ? balance < 0 : balance > 0;

  const toneClass = hasBalance
    ? (isPayable ? 'text-red-600 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200')
    : 'text-slate-600 bg-slate-50 border-slate-200';

  return (
    <div className={`mt-1.5 rounded-md border px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] ${toneClass}`}>
      <span className="uppercase tracking-wide text-[10px] font-semibold opacity-80">Balance</span>
      <span className="font-bold tabular-nums">{formatBalance(Math.abs(balance))}</span>
    </div>
  );
};

const getEntryPartyMeta = (entry, accountMap) => {
  if (!entry?.partyId) return null;
  if (entry.accountId?.startsWith('CUST_PARTY::') || entry.accountId?.startsWith('SUPP_PARTY::')) {
    return {
      type: entry.accountId.startsWith('CUST_PARTY::') ? 'customer' : 'supplier',
      partyId: entry.partyId,
    };
  }
  const account = accountMap.get(entry.accountId);
  const code = account?.accountCode || '';
  if (code === '1100' || code.startsWith('CUST-')) {
    return { type: 'customer', partyId: entry.partyId };
  }
  if (code === '2000' || code.startsWith('SUPP-')) {
    return { type: 'supplier', partyId: entry.partyId };
  }
  return null;
};

/* ─── Main Component ────────────────────────────────────────────────────── */
export const JournalVouchers = () => {
  /* ── filter state ── */
  const [filters, setFilters] = useState({
    fromDate: todayISO(),
    toDate: todayISO(),
    search: ''
  });

  /* ── form state ── */
  const [formState, setFormState] = useState({
    voucherDate: todayISO(),
    reference: '',
    description: '',
    notes: '',
    entries: [createEmptyEntry(), createEmptyEntry()]
  });

  /* ── modal ── */
  const [viewVoucherId, setViewVoucherId] = useState(null);

  /* ── accounts ── */
  const [accountMap, setAccountMap] = useState(new Map());
  // bankMap stores id → bank object for quick label lookup
  const [bankMap, setBankMap] = useState(new Map());

  const extractAccounts = useCallback((response) =>
    response?.data?.accounts || response?.accounts || response?.data || response || [], []);

  const updateAccountMap = useCallback((accounts) => {
    setAccountMap(prev => {
      const next = new Map(prev);
      accounts.forEach(a => {
        if (a._id) next.set(a._id, a);
        if (a.id) next.set(a.id, a);
      });
      return next;
    });
  }, []);

  const {
    data: accountsResponse,
    isLoading: accountsLoading,
    isFetching: accountsFetching
  } = useGetAccountsQuery(
    { isActive: true, limit: 500 },
    { onError: (error) => handleApiError(error, 'Chart of Accounts') }
  );

  React.useEffect(() => {
    if (accountsResponse) {
      updateAccountMap(extractAccounts(accountsResponse).filter(isJournalSelectableAccount));
    }
  }, [accountsResponse, extractAccounts, updateAccountMap]);

  /* ── banks ── */
  const { data: banksResponse } = useGetBanksQuery({ isActive: 'true', all: 'true' });
  const banks = React.useMemo(() => {
    const list = banksResponse?.data?.banks || banksResponse?.banks || [];
    return list.filter(b => !b.deletedAt && b.isActive !== false);
  }, [banksResponse]);

  React.useEffect(() => {
    const next = new Map();
    banks.forEach(b => next.set(b._id || b.id, b));
    setBankMap(next);
  }, [banks]);

  const bankOptions = React.useMemo(() => ({
    label: 'Bank Accounts',
    options: banks.map(b => ({
      value: `BANK::${b._id || b.id}`,
      label: `${b.bankName || b.bank_name} — ${b.accountName || b.account_name}`
    }))
  }), [banks]);

  const buildGroups = useCallback((accounts) => {
    const eligible = accounts.filter(isJournalSelectableAccount);
    const groups = eligible.reduce((acc, account) => {
      const type = account.accountType || 'other';
      const groupLabel = `${type.charAt(0).toUpperCase()}${type.slice(1)} Accounts`;
      if (!acc[groupLabel]) acc[groupLabel] = [];
      acc[groupLabel].push(account);
      return acc;
    }, {});
    return Object.entries(groups).map(([label, records]) => ({
      label,
      options: records
        .sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''))
        .map((a) => ({ value: getAccountRecordId(a), label: getAccountDisplayLabel(a) }))
        .filter((o) => o.value)
    }));
  }, []);

  const buildPartyGroups = useCallback((customers, suppliers, accounts) => {
    const sortOpts = (opts) =>
      opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

    const customerOptions = sortOpts(
      customers
        .map((c) => {
          const resolved = resolvePartyAccountOption(c, 'customer', accounts);
          if (!resolved?.value) return null;
          return { value: resolved.value, label: getCustomerDisplayName(c, 'Unnamed Customer') };
        })
        .filter(Boolean)
    );

    const supplierOptions = sortOpts(
      suppliers
        .map((s) => {
          const resolved = resolvePartyAccountOption(s, 'supplier', accounts);
          if (!resolved?.value) return null;
          return { value: resolved.value, label: getSupplierDisplayName(s, 'Unnamed Supplier') };
        })
        .filter(Boolean)
    );

    const groups = [];
    if (customerOptions.length) groups.push({ label: 'Customers', options: customerOptions });
    if (supplierOptions.length) groups.push({ label: 'Suppliers', options: supplierOptions });
    return groups;
  }, []);

  const dedupeOptionGroups = useCallback((groupList) => {
    const seen = new Set();
    return groupList
      .map((group) => ({
        ...group,
        options: group.options.filter((opt) => {
          if (!opt?.value || seen.has(opt.value)) return false;
          seen.add(opt.value);
          return true;
        }),
      }))
      .filter((group) => group.options.length > 0);
  }, []);

  const groupedAccountOptions = useMemo(() => {
    const groups = buildGroups(Array.from(accountMap.values()));
    if (bankOptions.options.length > 0) return [...groups, bankOptions];
    return groups;
  }, [accountMap, buildGroups, bankOptions]);

  const [triggerAccountsSearch] = useLazyGetAccountsQuery();
  const [triggerBanksSearch] = useLazyGetBanksQuery();
  const [triggerCustomers] = useLazyGetCustomersQuery();
  const [triggerSuppliers] = useLazyGetSuppliersQuery();

  const loadAccountOptions = useCallback(async (inputValue) => {
    const searchQuery = inputValue?.trim() || '';
    if (searchQuery.length < 2) {
      return groupedAccountOptions;
    }
    try {
      const [accountsRes, banksRes, customersRes, suppliersRes] = await Promise.all([
        triggerAccountsSearch({
          search: searchQuery,
          limit: 50,
          isActive: true,
        }).unwrap(),
        triggerBanksSearch({
          search: searchQuery,
          limit: 50,
          isActive: 'true',
        }).unwrap(),
        triggerCustomers({ search: searchQuery, limit: 50 }).unwrap(),
        triggerSuppliers({ search: searchQuery, limit: 50 }).unwrap(),
      ]);
      const accounts = extractAccounts(accountsRes).filter(isJournalSelectableAccount);
      updateAccountMap(accounts);

      const customers = customersRes?.data?.customers ?? customersRes?.customers ?? [];
      const suppliers = suppliersRes?.data?.suppliers ?? suppliersRes?.suppliers ?? [];
      const partyGroups = buildPartyGroups(customers, suppliers, []);
      const groups = buildGroups(accounts);
      const bankRows = banksRes?.data?.banks || banksRes?.banks || [];
      const bankGroup = {
        label: 'Bank Accounts',
        options: bankRows.map((b) => ({
          value: `BANK::${b._id || b.id}`,
          label: `${b.bankName || b.bank_name} — ${b.accountName || b.account_name}`,
        })),
      };
      return dedupeOptionGroups([
        ...partyGroups,
        ...groups,
        ...(bankGroup.options.length > 0 ? [bankGroup] : []),
      ]);
    } catch {
      return groupedAccountOptions;
    }
  }, [
    accountMap,
    extractAccounts,
    updateAccountMap,
    buildGroups,
    buildPartyGroups,
    dedupeOptionGroups,
    groupedAccountOptions,
    triggerAccountsSearch,
    triggerBanksSearch,
    triggerCustomers,
    triggerSuppliers,
  ]);

  /* ── queries ── */
  const {
    data: vouchersData,
    isLoading: vouchersLoading,
    isFetching: vouchersFetching,
    refetch
  } = useGetJournalVouchersQuery(
    { ...filters, page: 1, limit: 50 },
    { onError: (error) => handleApiError(error, 'Journal Vouchers') }
  );

  /* ── mutations ── */
  const [createJournalVoucher, { isLoading: creating }] = useCreateJournalVoucherMutation();
  const [postJournalVoucher, { isLoading: posting }] = usePostJournalVoucherMutation();

  const recording = creating || posting;

  /* ── form helpers ── */
  const resetForm = () => {
    setFormState({
      voucherDate: todayISO(),
      reference: '',
      description: '',
      notes: '',
      entries: [createEmptyEntry(), createEmptyEntry()]
    });
  };

  /* resolve the correct { value, label } for an entry in the AsyncSelect */
  const getSelectedOption = (entry) => {
    if (!entry.accountId) return null;
    if (entry.accountId.startsWith('SUPP_PARTY::') || entry.accountId.startsWith('CUST_PARTY::')) {
      return { value: entry.accountId, label: entry.partyName || entry.accountId };
    }
    if (entry.accountId.startsWith('BANK::')) {
      const bankId = entry.accountId.replace('BANK::', '');
      const bank = bankMap.get(bankId);
      if (!bank) return null;
      return {
        value: entry.accountId,
        label: `${bank.bankName || bank.bank_name} — ${bank.accountName || bank.account_name}`
      };
    }
    if (!accountMap.has(entry.accountId)) return null;
    return { value: entry.accountId, label: getAccountDisplayLabel(accountMap.get(entry.accountId)) };
  };

  /* ── totals ── */
  const totals = useMemo(() => {
    const debitTotal = formState.entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
    const creditTotal = formState.entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
    const difference = Math.round((debitTotal - creditTotal) * 100) / 100;
    return {
      debitTotal: Math.round(debitTotal * 100) / 100,
      creditTotal: Math.round(creditTotal * 100) / 100,
      difference
    };
  }, [formState.entries]);

  const handleAccountSelection = (index, option) => {
    setFormState((prev) => {
      const nextEntries = prev.entries.map((entry, idx) => {
        if (idx !== index) return entry;
        if (!option) {
          return { ...entry, accountId: '', partyId: '', partyName: '' };
        }
        const updated = { ...entry, accountId: option.value };
        if (option.value.startsWith('CUST_PARTY::')) {
          updated.partyId = option.value.replace('CUST_PARTY::', '');
          updated.partyName = option.label || '';
        } else if (option.value.startsWith('SUPP_PARTY::')) {
          updated.partyId = option.value.replace('SUPP_PARTY::', '');
          updated.partyName = option.label || '';
        } else {
          const account = accountMap.get(option.value);
          if (account) {
            const code = account.accountCode || '';
            if (code.startsWith('CUST-')) {
              updated.partyId = code.replace('CUST-', '');
              updated.partyName = account.accountName || '';
            } else if (code.startsWith('SUPP-')) {
              updated.partyId = code.replace('SUPP-', '');
              updated.partyName = account.accountName || '';
            } else {
              updated.partyId = '';
              updated.partyName = '';
            }
          } else {
            updated.partyId = '';
            updated.partyName = '';
          }
        }
        return updated;
      });
      return { ...prev, entries: nextEntries };
    });
  };

  /* ── entry change ── */
  const handleEntryChange = (index, field, value) => {
    setFormState(prev => {
      const nextEntries = prev.entries.map((entry, idx) => {
        if (idx !== index) return entry;
        const updated = { ...entry, [field]: value };
        if (field === 'debit' && value) updated.credit = '';
        if (field === 'credit' && value) updated.debit = '';

        return updated;
      });
      return { ...prev, entries: nextEntries };
    });
  };

  const handleAddEntry = () =>
    setFormState(prev => ({ ...prev, entries: [...prev.entries, createEmptyEntry()] }));

  const handleRemoveEntry = (index) => {
    setFormState(prev => {
      if (prev.entries.length <= 2) {
        toast.error('At least two entries are required.');
        return prev;
      }
      return { ...prev, entries: prev.entries.filter((_, idx) => idx !== index) };
    });
  };

  /* ── submit: create then immediately post ── */
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (totals.debitTotal <= 0) {
      toast.error('Total debit must be greater than zero.');
      return;
    }
    if (Math.abs(totals.difference) > 0.01) {
      toast.error('Total debit and credit must be equal.');
      return;
    }

    const payload = {
      voucherDate: formState.voucherDate,
      reference: formState.reference?.trim() || undefined,
      description: formState.description?.trim() || undefined,
      notes: formState.notes?.trim() || undefined,
      entries: formState.entries.map(entry => {
        // Bank entries use a synthetic BANK::{id} value — resolve to account 1001
        if (entry.accountId?.startsWith('BANK::')) {
          const bankId = entry.accountId.replace('BANK::', '');
          const bank = bankMap.get(bankId);
          const bankLabel = bank
            ? `${bank.bankName || bank.bank_name} — ${bank.accountName || bank.account_name}`
            : 'Bank';
          return {
            accountCode: '1001',
            accountName: bankLabel,
            particulars: entry.particulars?.trim() || bankLabel,
            debitAmount: entry.debit ? parseFloat(entry.debit) : 0,
            creditAmount: entry.credit ? parseFloat(entry.credit) : 0,
            bankId: bankId
          };
        }
        if (entry.accountId?.startsWith('CUST_PARTY::')) {
          return {
            accountCode: '1100',
            accountName: entry.partyName || 'Accounts Receivable',
            particulars: entry.particulars?.trim() || entry.partyName || '',
            debitAmount: entry.debit ? parseFloat(entry.debit) : 0,
            creditAmount: entry.credit ? parseFloat(entry.credit) : 0,
            customerId: entry.accountId.replace('CUST_PARTY::', '') || entry.partyId || undefined,
          };
        }
        if (entry.accountId?.startsWith('SUPP_PARTY::')) {
          return {
            accountCode: '2000',
            accountName: entry.partyName || 'Accounts Payable',
            particulars: entry.particulars?.trim() || entry.partyName || '',
            debitAmount: entry.debit ? parseFloat(entry.debit) : 0,
            creditAmount: entry.credit ? parseFloat(entry.credit) : 0,
            supplierId: entry.accountId.replace('SUPP_PARTY::', '') || entry.partyId || undefined,
          };
        }
        const account = entry.accountId ? accountMap.get(entry.accountId) : null;
        const code = account?.accountCode || entry.accountId;
        return {
          accountCode: code,
          accountName: account?.accountName || '',
          particulars: entry.particulars?.trim() || '',
          debitAmount: entry.debit ? parseFloat(entry.debit) : 0,
          creditAmount: entry.credit ? parseFloat(entry.credit) : 0,
          customerId: (code === '1100' || code.startsWith('CUST-')) ? entry.partyId || undefined : undefined,
          supplierId: (code === '2000' || code.startsWith('SUPP-')) ? entry.partyId || undefined : undefined
        };
      })
    };

    const invalidEntry = payload.entries.find(
      e => !e.accountCode || (e.debitAmount <= 0 && e.creditAmount <= 0)
    );
    if (invalidEntry) {
      toast.error('Each entry must include an account and a debit or credit amount.');
      return;
    }

    try {
      // Step 1 — Create the voucher
      const created = await createJournalVoucher(payload).unwrap();
      const jvId = created?.data?._id || created?.data?.id || created?._id || created?.id;

      // Step 2 — Immediately post to ledger
      if (jvId) {
        await postJournalVoucher(jvId).unwrap();
      }

      toast.success('Journal entry recorded and posted to ledger.');
      resetForm();
    } catch (error) {
      handleApiError(error, 'Record Journal Entry');
    }
  };

  /* ── filter helpers ── */
  const handleFilterChange = (field, value) =>
    setFilters(prev => ({ ...prev, [field]: value }));

  const vouchers = vouchersData?.data?.vouchers || vouchersData?.vouchers || [];
  const pagination = vouchersData?.data?.pagination || vouchersData?.pagination;

  const isBalanced = Math.abs(totals.difference) < 0.01;

  /* ────────────────────────────────── RENDER ─────────────────────────── */
  return (
    <PageShell className="bg-slate-50/50" maxWidthClassName="max-w-full" contentClassName="space-y-6 p-4 md:p-6">
      <ViewModal voucherId={viewVoucherId} onClose={() => setViewVoucherId(null)} />

      <PageHeader
        title="Journal Vouchers"
        subtitle="Create and manage general ledger journal entries"
        icon={BookOpen}
      />

      {/* ── ENTRY FORM ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
          <div className="bg-white border border-slate-200 p-2 rounded-lg">
            <BookOpen className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">New Journal Entry</h2>
            <p className="text-xs text-slate-500">Debits must equal credits before saving</p>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DateFilter mode="single"
              label="Voucher Date"
              value={formState.voucherDate}
              onChange={(date) => setFormState(prev => ({ ...prev, voucherDate: date }))}
              required
              size="sm"
            />

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reference</label>
              <Input
                type="text"
                autoComplete="off"
                value={formState.reference}
                onChange={(e) => setFormState(prev => ({ ...prev, reference: e.target.value }))}
                placeholder="Optional reference number"
                maxLength={100}
                className="bg-slate-50 border-slate-200"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
              <Input
                type="text"
                autoComplete="off"
                value={formState.description}
                onChange={(e) => setFormState(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Purpose of this journal entry"
                maxLength={1000}
                className="bg-slate-50 border-slate-200"
              />
            </div>
          </div>

          {accountsFetching && (
            <div className="text-sm text-slate-500 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
              <LoadingInline message="Fetching accounts…" />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">Journal Lines</h3>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  isBalanced
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                <Scale className="h-3.5 w-3.5" />
                Difference: {totals.difference.toFixed(2)}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[220px]">Account</th>
                    <th className="px-3 sm:px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[150px]">Particulars</th>
                    <th className="px-3 sm:px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider w-28">Debit</th>
                    <th className="px-3 sm:px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider w-28">Credit</th>
                    <th className="px-3 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formState.entries.map((entry, index) => {
                    const partyMeta = getEntryPartyMeta(entry, accountMap);
                    return (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <td className="px-3 sm:px-4 py-3 align-top">
                        <AsyncSelect
                          cacheOptions
                          defaultOptions={groupedAccountOptions}
                          loadOptions={loadAccountOptions}
                          value={getSelectedOption(entry)}
                          onChange={(option) => handleAccountSelection(index, option)}
                          isLoading={accountsLoading || accountsFetching}
                          placeholder="Select account or customer/supplier"
                          menuPortalTarget={document.body}
                          styles={asyncSelectStyles}
                          isClearable
                        />
                        {partyMeta && (
                          <JournalPartyBalance type={partyMeta.type} partyId={partyMeta.partyId} />
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 align-top">
                        <Input
                          type="text"
                          autoComplete="off"
                          value={entry.particulars}
                          onChange={(e) => handleEntryChange(index, 'particulars', e.target.value)}
                          className="w-full min-w-[150px] bg-slate-50 border-slate-200"
                          placeholder="Narration / memo"
                          maxLength={500}
                        />
                      </td>
                      <td className="px-3 sm:px-4 py-3 align-top">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          autoComplete="off"
                          value={entry.debit}
                          onChange={(e) => handleEntryChange(index, 'debit', e.target.value)}
                          className="text-right w-full tabular-nums bg-slate-50 border-slate-200"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 sm:px-4 py-3 align-top">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          autoComplete="off"
                          value={entry.credit}
                          onChange={(e) => handleEntryChange(index, 'credit', e.target.value)}
                          className="text-right w-full tabular-nums bg-slate-50 border-slate-200"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-3 text-center align-top">
                        <button
                          type="button"
                          onClick={() => handleRemoveEntry(index)}
                          className="p-1.5 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50"
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-3 sm:px-4 py-3">
                      <Button
                        type="button"
                        onClick={handleAddEntry}
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-2 border-slate-200"
                      >
                        <Plus className="h-4 w-4" /> Add Line
                      </Button>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right font-bold text-slate-600 tabular-nums">
                      {totals.debitTotal.toFixed(2)}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right font-bold text-slate-600 tabular-nums">
                      {totals.creditTotal.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-3 sm:px-4 pb-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold uppercase tracking-wide">Totals</span>
                        <span className={isBalanced ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {isBalanced ? 'Balanced' : 'Out of balance'}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
            <Textarea
              value={formState.notes}
              onChange={(e) => setFormState(prev => ({ ...prev, notes: e.target.value }))}
              autoComplete="off"
              rows={3}
              placeholder="Optional notes or supporting details"
              className="bg-slate-50 border-slate-200 resize-y"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={resetForm}
              disabled={recording}
              className="border-slate-200"
            >
              Clear Form
            </Button>
            <LoadingButton
              type="submit"
              variant="default"
              size="default"
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800"
              isLoading={recording}
              loadingText="Recording…"
              disabled={accountsLoading || !isBalanced}
            >
              <>
                <Save className="h-4 w-4" /> Record Journal Entry
              </>
            </LoadingButton>
          </div>
        </div>
      </form>

      {/* ── VOUCHER LOG ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Entry History</h2>
            <p className="text-xs text-slate-500">Previously recorded journal vouchers</p>
          </div>
          <Button
            type="button"
            onClick={() => refetch()}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2 border-slate-200 self-start sm:self-auto"
          >
            {vouchersFetching ? (
              <LoadingSpinner size="sm" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}{' '}
            Refresh
          </Button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Range</label>
              <DateFilter
                startDate={filters.fromDate}
                endDate={filters.toDate}
                onDateChange={(start, end) => {
                  handleFilterChange('fromDate', start || '');
                  handleFilterChange('toDate', end || '');
                }}
                compact={true}
                showPresets={true}
                className="w-full"
              />
            </div>
            <div className="lg:col-span-6">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  autoComplete="off"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Voucher no, description..."
                  className="pl-10 bg-slate-50 border-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Voucher #</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Debit</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Credit</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(vouchersLoading || vouchersFetching) && (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center">
                      <LoadingSpinner />
                    </td>
                  </tr>
                )}
                {!vouchersLoading && !vouchersFetching && vouchers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center">
                      <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">No journal entries found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting the date range or search filters</p>
                    </td>
                  </tr>
                )}
                {!vouchersLoading && !vouchersFetching && vouchers.map((voucher) => {
                  const id = voucher._id || voucher.id;
                  return (
                    <tr key={id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-900">{voucher.voucherNumber}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(voucher.voucherDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate">
                        {voucher.description || voucher.reference || '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">{(voucher.totalDebit || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">{(voucher.totalCredit || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          title="View entry details"
                          onClick={() => setViewVoucherId(id)}
                          className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination && (
            <p className="text-xs text-slate-500 font-medium">
              Showing {vouchers.length} of {pagination.totalItems || pagination.total || vouchers.length} entr{vouchers.length === 1 ? 'y' : 'ies'}
            </p>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default JournalVouchers;
