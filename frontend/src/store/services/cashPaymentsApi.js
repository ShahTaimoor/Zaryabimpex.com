import { api } from '../api';

export const cashPaymentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCashPayments: builder.query({
      query: (params) => ({
        url: 'cash-payments',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.payments
          ? [
            ...result.data.payments.map(({ _id, id }) => ({
              type: 'CashPayments',
              id: _id || id,
            })),
            { type: 'CashPayments', id: 'LIST' },
          ]
          : [{ type: 'CashPayments', id: 'LIST' }],
    }),
    createCashPayment: builder.mutation({
      query: (data) => ({
        url: 'cash-payments',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'CashPayments', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
      ],
    }),
    updateCashPayment: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `cash-payments/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'CashPayments', id },
        { type: 'CashPayments', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
      ],
    }),
    deleteCashPayment: builder.mutation({
      query: (id) => ({
        url: `cash-payments/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'CashPayments', id },
        { type: 'CashPayments', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
      ],
    }),
    exportExcel: builder.mutation({
      query: (filters) => ({
        url: 'cash-payments/export/excel',
        method: 'post',
        data: { filters },
      }),
    }),
    exportCSV: builder.mutation({
      query: (filters) => ({
        url: 'cash-payments/export/csv',
        method: 'post',
        data: { filters },
      }),
    }),
    exportPDF: builder.mutation({
      query: (filters) => ({
        url: 'cash-payments/export/pdf',
        method: 'post',
        data: { filters },
      }),
    }),
    exportJSON: builder.mutation({
      query: (filters) => ({
        url: 'cash-payments/export/json',
        method: 'post',
        data: { filters },
      }),
    }),
    downloadFile: builder.mutation({
      query: (filename) => ({
        url: `cash-payments/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCashPaymentsQuery,
  useCreateCashPaymentMutation,
  useUpdateCashPaymentMutation,
  useDeleteCashPaymentMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} = cashPaymentsApi;

