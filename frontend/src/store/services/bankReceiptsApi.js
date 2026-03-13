import { api } from '../api';

export const bankReceiptsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBankReceiptById: builder.query({
      query: (id) => ({
        url: `bank-receipts/${id}`,
        method: 'get',
      }),
      providesTags: (_result, _error, id) => [{ type: 'BankReceipts', id }],
    }),
    getBankReceipts: builder.query({
      query: (params) => ({
        url: 'bank-receipts',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.receipts
          ? [
            ...result.data.receipts.map(({ _id, id }) => ({
              type: 'BankReceipts',
              id: _id || id,
            })),
            { type: 'BankReceipts', id: 'LIST' },
          ]
          : [{ type: 'BankReceipts', id: 'LIST' }],
    }),
    createBankReceipt: builder.mutation({
      query: (data) => ({
        url: 'bank-receipts',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'BankReceipts', id: 'LIST' },
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
    updateBankReceipt: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `bank-receipts/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'BankReceipts', id },
        { type: 'BankReceipts', id: 'LIST' },
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
    deleteBankReceipt: builder.mutation({
      query: (id) => ({
        url: `bank-receipts/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'BankReceipts', id },
        { type: 'BankReceipts', id: 'LIST' },
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
        url: 'bank-receipts/export/excel',
        method: 'post',
        data: { filters },
      }),
    }),
    exportCSV: builder.mutation({
      query: (filters) => ({
        url: 'bank-receipts/export/csv',
        method: 'post',
        data: { filters },
      }),
    }),
    exportPDF: builder.mutation({
      query: (filters) => ({
        url: 'bank-receipts/export/pdf',
        method: 'post',
        data: { filters },
      }),
    }),
    exportJSON: builder.mutation({
      query: (filters) => ({
        url: 'bank-receipts/export/json',
        method: 'post',
        data: { filters },
      }),
    }),
    downloadFile: builder.mutation({
      query: (filename) => ({
        url: `bank-receipts/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBankReceiptsQuery,
  useGetBankReceiptByIdQuery,
  useLazyGetBankReceiptByIdQuery,
  useCreateBankReceiptMutation,
  useUpdateBankReceiptMutation,
  useDeleteBankReceiptMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} = bankReceiptsApi;

