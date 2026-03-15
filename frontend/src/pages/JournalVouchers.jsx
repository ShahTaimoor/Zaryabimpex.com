import React, { useMemo, useState, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Save,
  RefreshCcw,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import AsyncSelect from 'react-select/async';
import { useGetAccountsQuery } from '../store/services/chartOfAccountsApi';
import { useGetJournalVouchersQuery, useCreateJournalVoucherMutation } from '../store/services/journalVouchersApi';
import { handleApiError } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/LoadingSpinner';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan } from '../utils/dateUtils';

const todayISO = () => getCurrentDatePakistan();

const createEmptyEntry = () => ({
  accountId: '',
  debit: '',
  credit: '',
  particulars: ''
});

export const JournalVouchers = () => {
  const [filters, setFilters] = useState({
    fromDate: todayISO(),
    toDate: todayISO(),
    search: ''
  });

  const [formState, setFormState] = useState({
    voucherDate: todayISO(),
    reference: '',
    description: '',
    notes: '',
    entries: [createEmptyEntry(), createEmptyEntry()]
  });

  const [accountMap, setAccountMap] = useState(new Map());

  const extractAccounts = useCallback((response) => {
    return response?.data?.accounts || response?.accounts || response?.data || response || [];
  }, []);

  const updateAccountMap = useCallback((accounts) => {
    setAccountMap(prev => {
      const next = new Map(prev);
      accounts.forEach(account => {
        next.set(account._id, account);
      });
      return next;
    });
  }, []);

  const { data: accountsResponse, isLoading: accountsLoading, isFetching: accountsFetching } = useGetAccountsQuery(
    { includePartyAccounts: true },
    {
      onError: (error) => {
        handleApiError(error, 'Chart of Accounts');
      }
    }
  );

  React.useEffect(() => {
    if (accountsResponse) {
      updateAccountMap(extractAccounts(accountsResponse));
    }
  }, [accountsResponse, extractAccounts, updateAccountMap]);

  const groupedAccountOptions = useMemo(() => {
    const groups = Array.from(accountMap.values()).reduce((acc, account) => {
      let groupLabel;
      if (Array.isArray(account.tags) && account.tags.includes('customer')) {
        groupLabel = 'Customer Accounts';
      } else if (Array.isArray(account.tags) && account.tags.includes('supplier')) {
        groupLabel = 'Supplier Accounts';
      } else {
        const type = account.accountType || 'other';
        groupLabel = `${type.charAt(0).toUpperCase()}${type.slice(1)} Accounts`;
      }

      if (!acc[groupLabel]) {
        acc[groupLabel] = [];
      }
      acc[groupLabel].push(account);
      return acc;
    }, {});

    return Object.entries(groups).map(([label, records]) => ({
      label,
      options: records
        .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
        .map((account) => ({
          value: account._id,
          label: `${account.accountCode} — ${account.accountName}`
        }))
    }));
  }, [accountMap]);

  const loadAccountOptions = useCallback(async (inputValue) => {
    const searchQuery = inputValue?.trim() || '';
    try {
      // Use RTK Query's lazy query or fetch directly
      // For now, we'll use the existing query data and filter
      const accounts = extractAccounts(accountsResponse);
      const filteredAccounts = searchQuery 
        ? accounts.filter(acc => 
            acc.accountCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            acc.accountName?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : accounts;
      updateAccountMap(filteredAccounts);
      const groups = filteredAccounts.reduce((acc, account) => {
        let groupLabel;
        if (Array.isArray(account.tags) && account.tags.includes('customer')) {
          groupLabel = 'Customer Accounts';
        } else if (Array.isArray(account.tags) && account.tags.includes('supplier')) {
          groupLabel = 'Supplier Accounts';
        } else {
          const type = account.accountType || 'other';
          groupLabel = `${type.charAt(0).toUpperCase()}${type.slice(1)} Accounts`;
        }

        if (!acc[groupLabel]) {
          acc[groupLabel] = [];
        }
        acc[groupLabel].push(account);
        return acc;
      }, {});

      return Object.entries(groups).map(([label, records]) => ({
        label,
        options: records
          .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
          .map((account) => ({
            value: account._id,
            label: `${account.accountCode} — ${account.accountName}`
          }))
      }));
    } catch (error) {
      handleApiError(error, 'Chart of Accounts');
      return [];
    }
  }, [extractAccounts, updateAccountMap, accountsResponse]);

  const {
    data: vouchersData,
    isLoading: vouchersLoading,
    isFetching: vouchersFetching
  } = useGetJournalVouchersQuery(
    {
      ...filters,
      page: 1,
      limit: 25
    },
    {
      onError: (error) => {
        handleApiError(error, 'Journal Vouchers');
      }
    }
  );

  const [createJournalVoucher, { isLoading: creatingJournalVoucher }] = useCreateJournalVoucherMutation();

  const handleCreateJournalVoucher = async (payload) => {
    try {
      await createJournalVoucher(payload).unwrap();
      toast.success('Journal voucher created successfully');
      resetForm();
    } catch (error) {
      handleApiError(error, 'Create Journal Voucher');
    }
  };

  const resetForm = () => {
    setFormState({
      voucherDate: todayISO(),
      reference: '',
      description: '',
      notes: '',
      entries: [createEmptyEntry(), createEmptyEntry()]
    });
  };

  const totals = useMemo(() => {
    const debitTotal = formState.entries.reduce(
      (sum, entry) => sum + (parseFloat(entry.debit) || 0),
      0
    );
    const creditTotal = formState.entries.reduce(
      (sum, entry) => sum + (parseFloat(entry.credit) || 0),
      0
    );
    const difference = Math.round((debitTotal - creditTotal) * 100) / 100;
    return {
      debitTotal: Math.round(debitTotal * 100) / 100,
      creditTotal: Math.round(creditTotal * 100) / 100,
      difference
    };
  }, [formState.entries]);

  const handleEntryChange = (index, field, value) => {
    setFormState((prev) => {
      const nextEntries = prev.entries.map((entry, idx) => {
        if (idx !== index) return entry;
        const updated = { ...entry, [field]: value };

        if (field === 'debit' && value) {
          updated.credit = '';
        } else if (field === 'credit' && value) {
          updated.debit = '';
        }

        return updated;
      });

      return { ...prev, entries: nextEntries };
    });
  };

  const handleAddEntry = () => {
    setFormState((prev) => ({
      ...prev,
      entries: [...prev.entries, createEmptyEntry()]
    }));
  };

  const handleRemoveEntry = (index) => {
    setFormState((prev) => {
      if (prev.entries.length <= 2) {
        toast.error('At least two entries are required for a journal voucher.');
        return prev;
      }
      return {
        ...prev,
        entries: prev.entries.filter((_, idx) => idx !== index)
      };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (totals.debitTotal <= 0) {
      toast.error('Total debit must be greater than zero.');
      return;
    }

    if (Math.abs(totals.difference) > 0.01) {
      toast.error('Total debit and credit must be equal before saving.');
      return;
    }

    const payload = {
      voucherDate: formState.voucherDate,
      reference: formState.reference?.trim() || undefined,
      description: formState.description?.trim() || undefined,
      notes: formState.notes?.trim() || undefined,
      entries: formState.entries.map((entry) => ({
        accountId: entry.accountId,
        particulars: entry.particulars?.trim() || '',
        debit: entry.debit ? parseFloat(entry.debit) : 0,
        credit: entry.credit ? parseFloat(entry.credit) : 0
      }))
    };

    const invalidEntry = payload.entries.find(
      (entry) => !entry.accountId || (entry.debit <= 0 && entry.credit <= 0)
    );

    if (invalidEntry) {
      toast.error('Each entry must include an account and either a debit or credit amount.');
      return;
    }

    handleCreateJournalVoucher(payload);
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const vouchers = vouchersData?.vouchers || [];
  const pagination = vouchersData?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Journal Vouchers</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Record manual ledger adjustments while keeping debits and credits balanced.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="card-content space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Voucher Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={formState.voucherDate}
                  onChange={(e) => setFormState((prev) => ({ ...prev, voucherDate: e.target.value }))}
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Reference
              </label>
              <input
                type="text"
                value={formState.reference}
                onChange={(e) => setFormState((prev) => ({ ...prev, reference: e.target.value }))}
                className="input"
                placeholder="Optional reference number"
                maxLength={100}
              />
            </div>

            <div className="sm:col-span-2 md:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formState.description}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                className="input"
                placeholder="Purpose of this journal voucher"
                maxLength={1000}
              />
            </div>
          </div>

          {accountsFetching && (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <LoadingSpinner size="sm" inline />
              Fetching accounts...
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Particulars
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-2 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formState.entries.map((entry, index) => (
                  <tr key={index}>
                    <td className="px-2 sm:px-4 py-3">
                      <div className="space-y-2">
                        <AsyncSelect
                          cacheOptions
                          defaultOptions={groupedAccountOptions}
                          loadOptions={loadAccountOptions}
                          value={
                            entry.accountId && accountMap.has(entry.accountId)
                              ? {
                                  value: entry.accountId,
                                  label: `${accountMap.get(entry.accountId).accountCode} — ${accountMap.get(entry.accountId).accountName}`
                                }
                              : null
                          }
                          onChange={(option) => handleEntryChange(index, 'accountId', option ? option.value : '')}
                          isLoading={accountsLoading || accountsFetching}
                          placeholder="Select account"
                          styles={{
                            control: (provided) => ({
                              ...provided,
                              minHeight: '2.5rem'
                            }),
                            menu: (provided) => ({
                              ...provided,
                              zIndex: 20
                            })
                          }}
                          isClearable
                        />
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-3">
                      <input
                        type="text"
                        value={entry.particulars}
                        onChange={(e) => handleEntryChange(index, 'particulars', e.target.value)}
                        className="input w-full min-w-[150px] sm:min-w-[220px]"
                        placeholder="Narration / memo"
                        maxLength={500}
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-3 w-24 sm:w-28">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.debit}
                        onChange={(e) => handleEntryChange(index, 'debit', e.target.value)}
                        className="input text-right w-full min-w-[70px] sm:min-w-[90px]"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-3 w-24 sm:w-28">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.credit}
                        onChange={(e) => handleEntryChange(index, 'credit', e.target.value)}
                        className="input text-right w-full min-w-[70px] sm:min-w-[90px]"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(index)}
                        className="text-red-500 hover:text-red-700"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-2 sm:px-4 py-3">
                    <button
                      type="button"
                      onClick={handleAddEntry}
                      className="btn btn-secondary btn-md flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Line
                    </button>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right font-medium text-gray-700">Totals</td>
                  <td className="px-2 sm:px-4 py-3 text-right font-semibold text-gray-900">
                    {totals.debitTotal.toFixed(2)}
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right font-semibold text-gray-900">
                    {totals.creditTotal.toFixed(2)}
                  </td>
                  <td className="px-2 sm:px-4 py-3" />
                </tr>
                <tr>
                  <td colSpan="5" className="px-2 sm:px-4 pb-3 text-right">
                    <span
                      className={`text-sm font-medium ${
                        Math.abs(totals.difference) < 0.01 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      Difference: {totals.difference.toFixed(2)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formState.notes}
              onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
              className="input"
              rows={3}
              placeholder="Optional notes or supporting details"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn btn-primary btn-md flex items-center gap-2"
              disabled={creatingJournalVoucher || accountsLoading}
            >
              {creatingJournalVoucher ? (
                <>
                  <LoadingSpinner size="sm" inline className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Voucher
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <div className="card">
        <div className="card-content">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full">
              <div className="sm:col-span-2 md:col-span-2">
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
              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="input"
                  placeholder="Voucher no, account, description..."
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries('journalVouchers')}
              className="btn btn-secondary btn-md flex items-center gap-2 self-start md:self-auto"
            >
              <FileText className="h-4 w-4" />
              Refresh List
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Voucher #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Debit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Credit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lines
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(vouchersLoading || vouchersFetching) && (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center">
                      <LoadingSpinner />
                    </td>
                  </tr>
                )}
                {!vouchersLoading && vouchers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                      No journal vouchers found for the selected filters.
                    </td>
                  </tr>
                )}
                {vouchers.map((voucher) => (
                  <tr key={voucher._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {voucher.voucherNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(voucher.voucherDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {voucher.description || voucher.reference || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {voucher.totalDebit?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {voucher.totalCredit?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {voucher.entries?.length || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && (
            <div className="mt-4 text-sm text-gray-600">
              Showing {vouchers.length} of {pagination.totalItems} voucher(s)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalVouchers;

