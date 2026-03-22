import { api } from '../api';

export const salesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSales: builder.query({
      query: (params) => ({
        url: 'sales',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.items
          ? [
            ...result.items.map(({ id, _id }) => ({ type: 'Sales', id: id || _id })),
            { type: 'Sales', id: 'LIST' },
          ]
          : [{ type: 'Sales', id: 'LIST' }],
    }),
    createSale: builder.mutation({
      query: ({ payload, idempotencyKey }) => ({
        url: 'sales',
        method: 'post',
        data: payload,
        headers: idempotencyKey
          ? { 'Idempotency-Key': idempotencyKey }
          : undefined,
      }),
      invalidatesTags: [
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Sales', id: 'CCTV_LIST' },
        { type: 'Sales', id: 'LAST_PRICES' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    getOrders: builder.query({
      query: (params) => ({
        url: 'sales',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.items || result?.data?.items
          ? [
            ...(result.items || result.data.items).map(({ id, _id }) => ({ type: 'Sales', id: id || _id })),
            { type: 'Sales', id: 'LIST' },
          ]
          : [{ type: 'Sales', id: 'LIST' }],
    }),
    getOrderById: builder.query({
      query: (id) => ({
        url: `sales/${id}`,
        method: 'get',
      }),
      providesTags: (_result, _error, id) => [{ type: 'Sales', id }],
    }),
    getTodaySummary: builder.query({
      query: () => ({
        url: 'sales/today/summary',
        method: 'get',
      }),
      providesTags: [{ type: 'Sales', id: 'TODAY_SUMMARY' }],
    }),
    getPeriodSummary: builder.query({
      query: (params) => ({
        url: 'sales/period-summary',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Sales', id: 'PERIOD_SUMMARY' }],
    }),
    updateOrder: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `sales/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Sales', id },
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Sales', id: 'CCTV_LIST' },
        { type: 'Sales', id: 'LAST_PRICES' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    deleteOrder: builder.mutation({
      query: (id) => ({
        url: `sales/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Sales', id },
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Sales', id: 'CCTV_LIST' },
        { type: 'Sales', id: 'LAST_PRICES' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    getLastPrices: builder.query({
      query: (customerId) => ({
        url: `sales/customer/${customerId}/last-prices`,
        method: 'get',
      }),
      providesTags: (_res, _err, customerId) => [
        { type: 'Sales', id: 'LAST_PRICES' },
        { type: 'Customers', id: customerId },
      ],
    }),
    getCCTVOrders: builder.query({
      query: (params) => ({
        url: 'sales/cctv-orders',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.orders
          ? [
            ...result.orders.map(({ _id, id }) => ({ type: 'Sales', id: _id || id })),
            { type: 'Sales', id: 'CCTV_LIST' },
          ]
          : [{ type: 'Sales', id: 'CCTV_LIST' }],
    }),
    postMissingSalesToLedger: builder.mutation({
      query: (params = {}) => ({
        url: 'sales/post-missing-to-ledger',
        method: 'post',
        params: params?.dateFrom || params?.dateTo ? { dateFrom: params.dateFrom, dateTo: params.dateTo } : undefined,
      }),
      invalidatesTags: [
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    syncSalesLedger: builder.mutation({
      query: (params = {}) => ({
        url: 'sales/sync-ledger',
        method: 'post',
        params: params?.dateFrom || params?.dateTo ? { dateFrom: params.dateFrom, dateTo: params.dateTo } : undefined,
      }),
      invalidatesTags: [
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Accounting' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    exportExcel: builder.mutation({
      query: (filters) => ({
        url: 'sales/export/excel',
        method: 'post',
        data: { filters: filters || {} },
      }),
    }),
    exportCSV: builder.mutation({
      query: (filters) => ({
        url: 'sales/export/csv',
        method: 'post',
        data: { filters: filters || {} },
      }),
    }),
    exportPDF: builder.mutation({
      query: (filters) => ({
        url: 'sales/export/pdf',
        method: 'post',
        data: { filters: filters || {} },
      }),
    }),
    exportJSON: builder.mutation({
      query: (filters) => ({
        url: 'sales/export/json',
        method: 'post',
        data: { filters: filters || {} },
      }),
    }),
    downloadExportFile: builder.query({
      query: (filename) => ({
        url: `sales/download/${filename}`,
        method: 'get',
        responseHandler: (response) => response.blob(),
      }),
      providesTags: [{ type: 'Sales', id: 'EXPORT' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSalesQuery,
  useCreateSaleMutation,
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useLazyGetOrderByIdQuery,
  useGetTodaySummaryQuery,
  useGetPeriodSummaryQuery,
  useLazyGetPeriodSummaryQuery,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
  useGetLastPricesQuery,
  useLazyGetLastPricesQuery,
  useGetCCTVOrdersQuery,
  usePostMissingSalesToLedgerMutation,
  useSyncSalesLedgerMutation,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useLazyDownloadExportFileQuery,
} = salesApi;

