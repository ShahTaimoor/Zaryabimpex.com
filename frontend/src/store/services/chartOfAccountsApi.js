import { api } from '../api';

export const chartOfAccountsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAccounts: builder.query({
      query: (params) => ({
        url: 'chart-of-accounts',
        method: 'get',
        params: {
          ...params,
          includeBalances: 'true', // Always include calculated balances
        },
      }),
      transformResponse: (response) => {
        // Backend returns { success: true, data: accounts } where data is the array directly
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.data)) return response.data;
        if (Array.isArray(response?.data?.accounts)) return response.data.accounts;
        if (Array.isArray(response?.accounts)) return response.accounts;
        return [];
      },
      providesTags: (result) => {
        const accounts = Array.isArray(result) ? result : [];
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
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
        { type: 'ChartOfAccounts', id: 'STATS' },
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
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useGetAccountHierarchyQuery,
  useGetAccountStatsQuery,
  useGetCategoriesGroupedQuery,
  useSyncPartyAccountsMutation,
} = chartOfAccountsApi;

