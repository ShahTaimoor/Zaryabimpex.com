import { api } from '../api';

export const supplierBalancesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBalanceSummary: builder.query({
      query: (supplierId) => ({
        url: `supplier-balances/${supplierId}`,
        method: 'get',
      }),
      providesTags: (_res, _err, supplierId) => [
        { type: 'Suppliers', id: supplierId },
        { type: 'Accounting', id: 'SUPPLIER_BALANCE' },
      ],
    }),
    recordPayment: builder.mutation({
      query: ({ supplierId, ...data }) => ({
        url: `supplier-balances/${supplierId}/payment`,
        method: 'post',
        data,
      }),
      invalidatesTags: (_res, _err, { supplierId }) => [
        { type: 'Suppliers', id: supplierId },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'SUPPLIER_BALANCE' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'CashPayments', id: 'LIST' },
        { type: 'BankPayments', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    recordRefund: builder.mutation({
      query: ({ supplierId, ...data }) => ({
        url: `supplier-balances/${supplierId}/refund`,
        method: 'post',
        data,
      }),
      invalidatesTags: (_res, _err, { supplierId }) => [
        { type: 'Suppliers', id: supplierId },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'SUPPLIER_BALANCE' },
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
    recalculateBalance: builder.mutation({
      query: (supplierId) => ({
        url: `supplier-balances/${supplierId}/recalculate`,
        method: 'post',
      }),
      invalidatesTags: (_res, _err, supplierId) => [
        { type: 'Suppliers', id: supplierId },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'SUPPLIER_BALANCE' },
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
    canAcceptPurchase: builder.query({
      query: ({ supplierId, amount }) => ({
        url: `supplier-balances/${supplierId}/can-accept-purchase`,
        method: 'get',
        params: { amount },
      }),
    }),
    getBalanceIssues: builder.query({
      query: () => ({
        url: 'supplier-balances/reports/balance-issues',
        method: 'get',
      }),
      providesTags: [{ type: 'Reports', id: 'BALANCE_ISSUES' }],
    }),
    fixAllBalances: builder.mutation({
      query: () => ({
        url: 'supplier-balances/fix-all-balances',
        method: 'post',
      }),
      invalidatesTags: [
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'SUPPLIER_BALANCE' },
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
  useCanAcceptPurchaseQuery,
  useLazyCanAcceptPurchaseQuery,
  useGetBalanceIssuesQuery,
  useFixAllBalancesMutation,
} = supplierBalancesApi;

