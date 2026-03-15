import { api } from '../api';

export const paymentApi = api.injectEndpoints({
  endpoints: (builder) => ({
    processPayment: builder.mutation({
      query: (paymentData) => ({
        url: 'payments/process',
        method: 'post',
        data: paymentData,
      }),
      invalidatesTags: [
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'PAYMENT_HISTORY' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Sales', id: 'PAYMENT_STATS' },
      ],
    }),
    processRefund: builder.mutation({
      query: ({ paymentId, ...refundData }) => ({
        url: `payments/${paymentId}/refund`,
        method: 'post',
        data: refundData,
      }),
      invalidatesTags: [
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'PAYMENT_HISTORY' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Sales', id: 'PAYMENT_STATS' },
      ],
    }),
    voidTransaction: builder.mutation({
      query: ({ transactionId, reason }) => ({
        url: `payments/transactions/${transactionId}/void`,
        method: 'post',
        data: { reason },
      }),
      invalidatesTags: [
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'PAYMENT_HISTORY' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Sales', id: 'PAYMENT_STATS' },
      ],
    }),
    getPaymentHistory: builder.query({
      query: (filters = {}) => ({
        url: 'payments',
        method: 'get',
        params: filters,
      }),
      providesTags: (result) => {
        const list = result?.data?.payments || result?.payments || result?.items || [];
        return list.length
          ? [
            ...list.map(({ _id, id }) => ({ type: 'Sales', id: _id || id })),
            { type: 'Sales', id: 'PAYMENT_HISTORY' },
          ]
          : [{ type: 'Sales', id: 'PAYMENT_HISTORY' }];
      },
    }),
    getPaymentDetails: builder.query({
      query: (paymentId) => ({
        url: `payments/${paymentId}`,
        method: 'get',
      }),
      providesTags: (_res, _err, paymentId) => [{ type: 'Sales', id: paymentId }],
    }),
    getPaymentStats: builder.query({
      query: ({ startDate, endDate }) => ({
        url: 'payments/stats',
        method: 'get',
        params: { startDate, endDate },
      }),
      providesTags: [{ type: 'Sales', id: 'PAYMENT_STATS' }],
    }),
    getPaymentMethods: builder.query({
      query: () => ({
        url: 'payments/methods',
        method: 'get',
      }),
      providesTags: [{ type: 'Settings', id: 'PAYMENT_METHODS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useProcessPaymentMutation,
  useProcessRefundMutation,
  useVoidTransactionMutation,
  useGetPaymentHistoryQuery,
  useLazyGetPaymentHistoryQuery,
  useGetPaymentDetailsQuery,
  useGetPaymentStatsQuery,
  useGetPaymentMethodsQuery,
} = paymentApi;

