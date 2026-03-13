import { api } from '../api';

export const bankPaymentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBankPayments: builder.query({
      query: (params) => ({
        url: 'bank-payments',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.payments
          ? [
            ...result.data.payments.map(({ _id, id }) => ({
              type: 'BankPayments',
              id: _id || id,
            })),
            { type: 'BankPayments', id: 'LIST' },
          ]
          : [{ type: 'BankPayments', id: 'LIST' }],
    }),
    createBankPayment: builder.mutation({
      query: (data) => ({
        url: 'bank-payments',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'BankPayments', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
        { type: 'Banks', id: 'LIST' },
      ],
    }),
    updateBankPayment: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `bank-payments/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'BankPayments', id },
        { type: 'BankPayments', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
        { type: 'Banks', id: 'LIST' },
      ],
    }),
    deleteBankPayment: builder.mutation({
      query: (id) => ({
        url: `bank-payments/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'BankPayments', id },
        { type: 'BankPayments', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'ChartOfAccounts', id: 'HIERARCHY' },
        { type: 'Banks', id: 'LIST' },
      ],
    }),
    exportExcel: builder.mutation({
      query: (filters) => ({
        url: 'bank-payments/export/excel',
        method: 'post',
        data: { filters },
      }),
    }),
    exportCSV: builder.mutation({
      query: (filters) => ({
        url: 'bank-payments/export/csv',
        method: 'post',
        data: { filters },
      }),
    }),
    exportPDF: builder.mutation({
      query: (filters) => ({
        url: 'bank-payments/export/pdf',
        method: 'post',
        data: { filters },
      }),
    }),
    exportJSON: builder.mutation({
      query: (filters) => ({
        url: 'bank-payments/export/json',
        method: 'post',
        data: { filters },
      }),
    }),
    downloadFile: builder.mutation({
      query: (filename) => ({
        url: `bank-payments/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBankPaymentsQuery,
  useCreateBankPaymentMutation,
  useUpdateBankPaymentMutation,
  useDeleteBankPaymentMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} = bankPaymentsApi;

