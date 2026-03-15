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
          { type: 'Products', id: 'LIST' },
          { type: 'Suppliers', id: 'LIST' },
          { type: 'Inventory', id: 'LIST' },
          { type: 'Inventory', id: 'SUMMARY' },
          { type: 'Inventory', id: 'LOW_STOCK' },
          { type: 'Accounting', id: 'LEDGER_SUMMARY' },
          { type: 'Accounting', id: 'LEDGER_ENTRIES' },
          { type: 'Accounting', id: 'ALL_ENTRIES' },
          { type: 'Accounting', id: 'TRIAL_BALANCE' },
          { type: 'ChartOfAccounts', id: 'LIST' },
          { type: 'ChartOfAccounts', id: 'STATS' },
          { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
          { type: 'Reports', id: 'PARTY_BALANCE' },
          { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
          { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
          { type: 'Reports', id: 'PRODUCT_REPORT' },
          { type: 'Reports', id: 'INVENTORY_REPORT' },
          { type: 'Reports', id: 'SUMMARY_CARDS' },
          { type: 'Reports', id: 'FINANCIAL_REPORT' },
        ];
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
          { type: 'Products', id: 'LIST' },
          { type: 'Suppliers', id: 'LIST' },
          { type: 'Inventory', id: 'LIST' },
          { type: 'Inventory', id: 'SUMMARY' },
          { type: 'Inventory', id: 'LOW_STOCK' },
          { type: 'Accounting', id: 'LEDGER_SUMMARY' },
          { type: 'Accounting', id: 'LEDGER_ENTRIES' },
          { type: 'Accounting', id: 'ALL_ENTRIES' },
          { type: 'Accounting', id: 'TRIAL_BALANCE' },
          { type: 'ChartOfAccounts', id: 'LIST' },
          { type: 'ChartOfAccounts', id: 'STATS' },
          { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
          { type: 'Reports', id: 'PARTY_BALANCE' },
          { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
          { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
          { type: 'Reports', id: 'PRODUCT_REPORT' },
          { type: 'Reports', id: 'INVENTORY_REPORT' },
          { type: 'Reports', id: 'SUMMARY_CARDS' },
          { type: 'Reports', id: 'FINANCIAL_REPORT' },
        ];
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
        { type: 'Products', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
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
        { type: 'Products', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
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
        { type: 'Products', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
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
    syncPurchaseInvoicesLedger: builder.mutation({
      query: (params = {}) => ({
        url: 'purchase-invoices/sync-ledger',
        method: 'post',
        params: params?.dateFrom || params?.dateTo ? { dateFrom: params.dateFrom, dateTo: params.dateTo } : undefined,
      }),
      invalidatesTags: [
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
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
  useSyncPurchaseInvoicesLedgerMutation,
} = purchaseInvoicesApi;

