import { api } from '../api';

export const dropShippingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTransactions: builder.query({
      query: (params) => ({
        url: 'drop-shipping',
        method: 'get',
        params,
      }),
      providesTags: (result) => {
        const list = result?.data?.transactions || result?.transactions || result?.items || [];
        return list.length
          ? [
              ...list.map(({ _id, id }) => ({ type: 'Sales', id: _id || id })),
              { type: 'Sales', id: 'DROPSHIP_LIST' },
            ]
          : [{ type: 'Sales', id: 'DROPSHIP_LIST' }];
      },
    }),
    getTransaction: builder.query({
      query: (id) => ({
        url: `drop-shipping/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Sales', id }],
    }),
    createTransaction: builder.mutation({
      query: (data) => ({
        url: 'drop-shipping',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Sales', id: 'DROPSHIP_LIST' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'DROPSHIP_STATS' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
    updateTransaction: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `drop-shipping/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Sales', id },
        { type: 'Sales', id: 'DROPSHIP_LIST' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'DROPSHIP_STATS' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
    deleteTransaction: builder.mutation({
      query: (id) => ({
        url: `drop-shipping/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Sales', id },
        { type: 'Sales', id: 'DROPSHIP_LIST' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'DROPSHIP_STATS' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
    updateStatus: builder.mutation({
      query: ({ id, status }) => ({
        url: `drop-shipping/${id}/status`,
        method: 'put',
        data: { status },
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Sales', id },
        { type: 'Sales', id: 'DROPSHIP_LIST' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'DROPSHIP_STATS' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
    getStats: builder.query({
      query: (params) => ({
        url: 'drop-shipping/stats',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'DROPSHIP_STATS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTransactionsQuery,
  useLazyGetTransactionsQuery,
  useGetTransactionQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useUpdateStatusMutation,
  useGetStatsQuery,
  useLazyGetStatsQuery,
} = dropShippingApi;

