import { api } from '../api';

export const purchaseInvoicesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPurchaseInvoices: builder.query({
      query: (params) => ({
        url: 'purchase-invoices',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.purchaseInvoices
          ? [
            ...result.data.purchaseInvoices.map(({ _id, id }) => ({
              type: 'Orders',
              id: _id || id,
            })),
            { type: 'Orders', id: 'PI_LIST' },
          ]
          : [{ type: 'Orders', id: 'PI_LIST' }],
    }),
    getPurchaseInvoice: builder.query({
      query: (id) => ({
        url: `purchase-invoices/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Orders', id }],
    }),
    createPurchaseInvoice: builder.mutation({
      query: (data) => ({
        url: 'purchase-invoices',
        method: 'post',
        data,
      }),
      invalidatesTags: (result, error, arg) => {
        const tags = [
          { type: 'Orders', id: 'PI_LIST' },
          { type: 'Products', id: 'LIST' }, // Invalidate products to refresh stock and prices
          { type: 'Suppliers', id: 'LIST' }, // Invalidate suppliers to refresh outstanding balance
          { type: 'Accounting', id: 'LEDGER_SUMMARY' },
          { type: 'Accounting', id: 'LEDGER_ENTRIES' },
          { type: 'ChartOfAccounts', id: 'LIST' },
        ];
        // Invalidate specific supplier if we have the supplier ID
        if (arg?.supplier) {
          tags.push({ type: 'Suppliers', id: arg.supplier });
        }
        return tags;
      },
    }),
    updatePurchaseInvoice: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `purchase-invoices/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id, supplier }) => {
        const tags = [
          { type: 'Orders', id },
          { type: 'Orders', id: 'PI_LIST' },
          { type: 'Products', id: 'LIST' }, // Invalidate products to refresh stock and prices
          { type: 'Suppliers', id: 'LIST' }, // Invalidate suppliers to refresh outstanding balance
          { type: 'Accounting', id: 'LEDGER_SUMMARY' },
          { type: 'Accounting', id: 'LEDGER_ENTRIES' },
          { type: 'ChartOfAccounts', id: 'LIST' },
        ];
        // Invalidate specific supplier if we have the supplier ID
        if (supplier) {
          tags.push({ type: 'Suppliers', id: supplier });
        }
        return tags;
      },
    }),
    deletePurchaseInvoice: builder.mutation({
      query: (id) => ({
        url: `purchase-invoices/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'PI_LIST' },
      ],
    }),
    confirmPurchaseInvoice: builder.mutation({
      query: (id) => ({
        url: `purchase-invoices/${id}/confirm`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Products', id: 'LIST' }, // Invalidate products to refresh stock and prices
        { type: 'Suppliers', id: 'LIST' }, // Invalidate suppliers to refresh outstanding balance
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'ChartOfAccounts', id: 'LIST' },
      ],
    }),
    cancelPurchaseInvoice: builder.mutation({
      query: (id) => ({
        url: `purchase-invoices/${id}/cancel`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'PI_LIST' },
      ],
    }),
    exportExcel: builder.mutation({
      query: (filters) => ({
        url: 'purchase-invoices/export/excel',
        method: 'post',
        data: { filters },
      }),
    }),
    exportCSV: builder.mutation({
      query: (filters) => ({
        url: 'purchase-invoices/export/csv',
        method: 'post',
        data: { filters },
      }),
    }),
    exportPDF: builder.mutation({
      query: (filters) => ({
        url: 'purchase-invoices/export/pdf',
        method: 'post',
        data: { filters },
      }),
    }),
    exportJSON: builder.mutation({
      query: (filters) => ({
        url: 'purchase-invoices/export/json',
        method: 'post',
        data: { filters },
      }),
    }),
    downloadFile: builder.mutation({
      query: (filename) => ({
        url: `purchase-invoices/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPurchaseInvoicesQuery,
  useGetPurchaseInvoiceQuery,
  useLazyGetPurchaseInvoiceQuery,
  useCreatePurchaseInvoiceMutation,
  useUpdatePurchaseInvoiceMutation,
  useDeletePurchaseInvoiceMutation,
  useConfirmPurchaseInvoiceMutation,
  useCancelPurchaseInvoiceMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} = purchaseInvoicesApi;

