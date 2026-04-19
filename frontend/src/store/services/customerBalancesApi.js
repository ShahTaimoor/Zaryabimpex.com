import { api } from '../api';

export const customerBalancesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBalanceSummary: builder.query({
      query: (customerId) => ({
        url: `customer-balances/${customerId}`,
        method: 'get',
      }),
      providesTags: (_res, _err, customerId) => [
        { type: 'Customers', id: customerId },
        { type: 'Accounting', id: 'CUSTOMER_BALANCE' },
      ],
    }),
    recordPayment: builder.mutation({
      query: ({ customerId, ...data }) => ({
        url: `customer-balances/${customerId}/payment`,
        method: 'post',
        data,
      }),
      invalidatesTags: (_res, _err, { customerId }) => [
        { type: 'Customers', id: customerId },
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting', id: 'CUSTOMER_BALANCE' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'CashReceipts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
    recordRefund: builder.mutation({
      query: ({ customerId, ...data }) => ({
        url: `customer-balances/${customerId}/refund`,
        method: 'post',
        data,
      }),
      invalidatesTags: (_res, _err, { customerId }) => [
        { type: 'Customers', id: customerId },
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting', id: 'CUSTOMER_BALANCE' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'CashReceipts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
    recalculateBalance: builder.mutation({
      query: (customerId) => ({
        url: `customer-balances/${customerId}/recalculate`,
        method: 'post',
      }),
      invalidatesTags: (_res, _err, customerId) => [
        { type: 'Customers', id: customerId },
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting', id: 'CUSTOMER_BALANCE' },
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
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
    canMakePurchase: builder.query({
      query: ({ customerId, amount }) => ({
        url: `customer-balances/${customerId}/can-purchase`,
        method: 'get',
        params: { amount },
      }),
      providesTags: (_res, _err, { customerId }) => [
        { type: 'Customers', id: customerId },
        { type: 'Accounting', id: 'CUSTOMER_BALANCE' },
      ],
    }),
    getBalanceIssues: builder.query({
      query: () => ({
        url: 'customer-balances/reports/balance-issues',
        method: 'get',
      }),
      providesTags: [{ type: 'Reports', id: 'BALANCE_ISSUES' }],
    }),
    fixAllBalances: builder.mutation({
      query: () => ({
        url: 'customer-balances/fix-all-balances',
        method: 'post',
      }),
      invalidatesTags: [
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting', id: 'CUSTOMER_BALANCE' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'BALANCE_ISSUES' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBalanceSummaryQuery,
  useRecordPaymentMutation,
  useRecordRefundMutation,
  useRecalculateBalanceMutation,
  useCanMakePurchaseQuery,
  useLazyCanMakePurchaseQuery,
  useGetBalanceIssuesQuery,
  useFixAllBalancesMutation,
} = customerBalancesApi;

