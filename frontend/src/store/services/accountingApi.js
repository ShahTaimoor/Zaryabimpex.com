import { api } from '../api';

export const accountingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    postJournal: builder.mutation({
      query: ({ entries, metadata, idempotencyKey }) => ({
        url: 'accounting/journal',
        method: 'post',
        data: { entries, metadata },
        headers: idempotencyKey
          ? { 'Idempotency-Key': idempotencyKey }
          : undefined,
      }),
      invalidatesTags: [
        { type: 'Accounting' },
        { type: 'Accounting', id: 'JOURNAL' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    getTrialBalance: builder.query({
      query: (params) => ({
        url: 'accounting/trial-balance',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Accounting', id: 'TRIAL_BALANCE' }],
    }),
  }),
  overrideExisting: false,
});

export const { usePostJournalMutation, useGetTrialBalanceQuery } = accountingApi;

