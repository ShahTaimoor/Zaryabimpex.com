import { api } from '../api';

export const chartOfAccountsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAccounts: builder.query({
      query: (params) => ({
        url: 'chart-of-accounts',
        method: 'get',
        params,
      }),
      transformResponse: (response) => {
        // If it's the new standard paginated response { success: true, data: [...], pagination: {...} }
        if (response?.pagination) {
          return response; // Return full object so pagination can be used
        }
        
        // Backward compatibility: extract the array if it's wrapped or just the array itself
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.data)) return response.data;
        if (Array.isArray(response?.data?.accounts)) return response.data.accounts;
        if (Array.isArray(response?.accounts)) return response.accounts;
        return [];
      },
      providesTags: (result) => {
        const accounts = Array.isArray(result) ? result : (result?.data || []);
        return accounts.length
          ? [
              ...accounts.map(({ _id, id }) => ({ type: 'ChartOfAccounts', id: _id || id })),
              { type: 'ChartOfAccounts', id: 'LIST' },
            ]
          : [{ type: 'ChartOfAccounts', id: 'LIST' }];
      },
    }),
    getAccount: builder.query({
      query: (id) => ({
        url: `chart-of-accounts/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'ChartOfAccounts', id }],
    }),
    checkAccount: builder.query({
      query: (accountCode) => ({
        url: `chart-of-accounts/check/${encodeURIComponent(accountCode)}`,
        method: 'get',
      }),
      providesTags: (_r, _e, accountCode) => [
        { type: 'ChartOfAccounts', id: `CHECK-${String(accountCode).toUpperCase()}` },
      ],
    }),
    createAccount: builder.mutation({
      query: (data) => ({
        url: 'chart-of-accounts',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    updateAccount: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `chart-of-accounts/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'ChartOfAccounts', id },
        { type: 'ChartOfAccounts', id: 'CHECK-1000' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    deleteAccount: builder.mutation({
      query: (id) => ({
        url: `chart-of-accounts/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'ChartOfAccounts', id },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    getAccountHierarchy: builder.query({
      query: () => ({
        url: 'chart-of-accounts/hierarchy',
        method: 'get',
      }),
      providesTags: [{ type: 'ChartOfAccounts', id: 'HIERARCHY' }],
    }),
    getAccountStats: builder.query({
      query: () => ({
        url: 'chart-of-accounts/stats/summary',
        method: 'get',
      }),
      providesTags: [{ type: 'ChartOfAccounts', id: 'STATS' }],
    }),
    getCategoriesGrouped: builder.query({
      query: () => ({
        url: 'account-categories/grouped',
        method: 'get',
      }),
      providesTags: [{ type: 'ChartOfAccounts', id: 'CATEGORIES' }],
    }),
    syncPartyAccounts: builder.mutation({
      query: () => ({
        url: 'chart-of-accounts/sync-party-accounts',
        method: 'post',
      }),
      invalidatesTags: [
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAccountsQuery,
  useGetAccountQuery,
  useCheckAccountQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useGetAccountHierarchyQuery,
  useGetAccountStatsQuery,
  useGetCategoriesGroupedQuery,
  useSyncPartyAccountsMutation,
} = chartOfAccountsApi;

