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
        { type: 'Products', id: 'LIST' }, // Invalidate products to refresh stock levels
        { type: 'Inventory', id: 'LIST' }, // Invalidate inventory cache
        { type: 'Customers', id: 'LIST' }, // Invalidate customers to refresh credit information
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'ChartOfAccounts', id: 'LIST' },
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
        { type: 'Sales', id: 'CCTV_LIST' }, // Invalidate CCTV orders list too
        { type: 'Products', id: 'LIST' }, // Invalidate products to refresh stock levels
        { type: 'Inventory', id: 'LIST' }, // Invalidate inventory cache
        { type: 'Customers', id: 'LIST' }, // Invalidate customers to refresh credit information
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
      ],
    }),
    getLastPrices: builder.query({
      query: (customerId) => ({
        url: `sales/customer/${customerId}/last-prices`,
        method: 'get',
      }),
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
} = salesApi;

