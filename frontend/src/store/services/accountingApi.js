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
      invalidatesTags: [{ type: 'Accounting', id: 'JOURNAL' }],
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

