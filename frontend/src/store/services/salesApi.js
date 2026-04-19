import { api } from '../api';

/**
 * RTK Query: tags to invalidate after creating a sale (POS hot path).
 * Avoids broad `{ type: 'Accounting' }` and most Reports so completing a sale
 * does not refetch every ledger/report query in the background.
 * Dashboard cards use `DASHBOARD_RANGE_SUMMARY`; other report screens refetch on focus/mount.
 */
const CACHE_INVALIDATE_AFTER_NEW_SALE = [
  { type: 'Sales', id: 'LIST' },
  { type: 'Settings', id: 'INVESTORS_LIST' },
  { type: 'Accounting', id: 'PROFIT_SHARES' },
  { type: 'Accounting', id: 'PROFIT_SUMMARY' },
  { type: 'Sales', id: 'TODAY_SUMMARY' },
  { type: 'Sales', id: 'PERIOD_SUMMARY' },
  { type: 'Sales', id: 'CCTV_LIST' },
  { type: 'Sales', id: 'LAST_PRICES' },
  { type: 'Products', id: 'LIST' },
  { type: 'Products', id: 'SEARCH' },
  { type: 'Products', id: 'VARIANTS_LIST' },
  { type: 'Inventory', id: 'LIST' },
  { type: 'Inventory', id: 'SUMMARY' },
  { type: 'Inventory', id: 'LOW_STOCK' },
  { type: 'Customers', id: 'LIST' },
  { type: 'Accounting', id: 'LEDGER_SUMMARY' },
  { type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' },
];

/** Extra tags when an invoice is edited, deleted, or ledger backfill/sync runs. */
const CACHE_INVALIDATE_AFTER_SALE_LEDGER_REPORTS = [
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
];

/** Merge base sale tags with response-scoped tags (new invoice id, customer AR balance). */
function buildInvalidateTagsAfterCreateSale(result, error, arg) {
  const tags = [...CACHE_INVALIDATE_AFTER_NEW_SALE];
  if (error) return tags;

  const order = result?.order ?? result?.data?.order;
  const orderId = order?.id ?? order?._id;
  if (orderId) {
    tags.push({ type: 'Sales', id: orderId });
  }

  const customerId =
    arg?.payload?.customer ??
    order?.customer_id ??
    order?.customerId ??
    (typeof order?.customer === 'string' ? order.customer : order?.customer?.id ?? order?.customer?._id);
  if (customerId) {
    const cid = String(customerId);
    tags.push({ type: 'Customers', id: cid });
    tags.push({ type: 'Accounting', id: 'CUSTOMER_BALANCE' });
  }

  return tags;
}

export const salesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSales: builder.query({
      query: (params) => ({
        url: 'sales',
        method: 'get',
        params,
      }),
      keepUnusedDataFor: 90,
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
      invalidatesTags: buildInvalidateTagsAfterCreateSale,
    }),
    getOrders: builder.query({
      query: (params) => ({
        url: 'sales',
        method: 'get',
        params: {
          listMode: 'minimal',
          ...params,
        },
      }),
      keepUnusedDataFor: 60,
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
      keepUnusedDataFor: 60,
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
        ...CACHE_INVALIDATE_AFTER_NEW_SALE,
        ...CACHE_INVALIDATE_AFTER_SALE_LEDGER_REPORTS,
      ],
    }),
    deleteOrder: builder.mutation({
      query: (id) => ({
        url: `sales/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Sales', id },
        ...CACHE_INVALIDATE_AFTER_NEW_SALE,
        ...CACHE_INVALIDATE_AFTER_SALE_LEDGER_REPORTS,
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
        ...CACHE_INVALIDATE_AFTER_NEW_SALE,
        ...CACHE_INVALIDATE_AFTER_SALE_LEDGER_REPORTS,
      ],
    }),
    syncSalesLedger: builder.mutation({
      query: (params = {}) => ({
        url: 'sales/sync-ledger',
        method: 'post',
        params: params?.dateFrom || params?.dateTo ? { dateFrom: params.dateFrom, dateTo: params.dateTo } : undefined,
      }),
      invalidatesTags: [
        ...CACHE_INVALIDATE_AFTER_NEW_SALE,
        ...CACHE_INVALIDATE_AFTER_SALE_LEDGER_REPORTS,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSalesQuery,
  useCreateSaleMutation,
  useGetOrdersQuery,
  useLazyGetOrdersQuery,
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
} = salesApi;

