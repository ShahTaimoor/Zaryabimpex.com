import { api } from '../api';

export const cashReceiptsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCashReceiptById: builder.query({
      query: (id) => ({
        url: `cash-receipts/${id}`,
        method: 'get',
      }),
      providesTags: (_result, _error, id) => [{ type: 'CashReceipts', id }],
    }),
    getCashReceipts: builder.query({
      query: (params) => ({
        url: 'cash-receipts',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.receipts
          ? [
            ...result.data.receipts.map(({ _id, id }) => ({
              type: 'CashReceipts',
              id: _id || id,
            })),
            { type: 'CashReceipts', id: 'LIST' },
          ]
          : [{ type: 'CashReceipts', id: 'LIST' }],
    }),
    createCashReceipt: builder.mutation({
      query: (data) => ({
        url: 'cash-receipts',
        method: 'post',
        data,
      }),
      invalidatesTags: (_r, _e, data) => {
        const tags = [
          { type: 'CashReceipts', id: 'LIST' },
          { type: 'Customers', id: 'LIST' },
          { type: 'Suppliers', id: 'LIST' },
          { type: 'Accounting', id: 'LEDGER_SUMMARY' },
          { type: 'Accounting', id: 'LEDGER_ENTRIES' },
          { type: 'Accounting', id: 'ALL_ENTRIES' },
          { type: 'ChartOfAccounts', id: 'LIST' },
          { type: 'ChartOfAccounts', id: 'STATS' },
          { type: 'ChartOfAccounts', id: 'HIERARCHY' },
        ];
        // Invalidate specific customer/supplier cache if involved
        if (data?.customer) tags.push({ type: 'Customers', id: data.customer });
        if (data?.supplier) tags.push({ type: 'Suppliers', id: data.supplier });
        return tags;
      },
    }),
    updateCashReceipt: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `cash-receipts/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id, ...data }) => {
        const tags = [
          { type: 'CashReceipts', id },
          { type: 'CashReceipts', id: 'LIST' },
          { type: 'Customers', id: 'LIST' },
          { type: 'Suppliers', id: 'LIST' },
          { type: 'Accounting', id: 'LEDGER_SUMMARY' },
          { type: 'Accounting', id: 'LEDGER_ENTRIES' },
          { type: 'Accounting', id: 'ALL_ENTRIES' },
          { type: 'ChartOfAccounts', id: 'LIST' },
          { type: 'ChartOfAccounts', id: 'STATS' },
          { type: 'ChartOfAccounts', id: 'HIERARCHY' },
        ];
        // Invalidate specific customer/supplier cache if involved
        if (data?.customer) tags.push({ type: 'Customers', id: data.customer });
        if (data?.supplier) tags.push({ type: 'Suppliers', id: data.supplier });
        return tags;
      },
    }),
    deleteCashReceipt: builder.mutation({
      query: (id) => ({
        url: `cash-receipts/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'CashReceipts', id },
        { type: 'CashReceipts', id: 'LIST' },
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
    createBatchCashReceipts: builder.mutation({
      query: (data) => ({
        url: 'cash-receipts/batch',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'CashReceipts', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
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
        url: 'cash-receipts/export/excel',
        method: 'post',
        data: { filters },
      }),
    }),
    exportCSV: builder.mutation({
      query: (filters) => ({
        url: 'cash-receipts/export/csv',
        method: 'post',
        data: { filters },
      }),
    }),
    exportPDF: builder.mutation({
      query: (filters) => ({
        url: 'cash-receipts/export/pdf',
        method: 'post',
        data: { filters },
      }),
    }),
    exportJSON: builder.mutation({
      query: (filters) => ({
        url: 'cash-receipts/export/json',
        method: 'post',
        data: { filters },
      }),
    }),
    downloadFile: builder.mutation({
      query: (filename) => ({
        url: `cash-receipts/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCashReceiptsQuery,
  useGetCashReceiptByIdQuery,
  useLazyGetCashReceiptByIdQuery,
  useCreateCashReceiptMutation,
  useUpdateCashReceiptMutation,
  useDeleteCashReceiptMutation,
  useCreateBatchCashReceiptsMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} = cashReceiptsApi;

