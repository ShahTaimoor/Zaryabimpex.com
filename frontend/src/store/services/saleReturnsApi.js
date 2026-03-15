import { api } from '../api';

export const saleReturnsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get all sale returns
    getSaleReturns: builder.query({
      query: (params) => {
        const cleanParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          if (value !== '' && value !== null && value !== undefined) {
            cleanParams[key] = value;
          }
        });
        return {
          url: 'sale-returns',
          method: 'get',
          params: cleanParams,
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
            ...result.data.map(({ _id, id }) => ({
              type: 'SaleReturns',
              id: _id || id,
            })),
            { type: 'SaleReturns', id: 'LIST' },
          ]
          : [{ type: 'SaleReturns', id: 'LIST' }],
    }),

    // Get single sale return
    getSaleReturn: builder.query({
      query: (id) => ({
        url: `sale-returns/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'SaleReturns', id }],
    }),

    // Create sale return
    createSaleReturn: builder.mutation({
      query: (data) => ({
        url: 'sale-returns',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'SaleReturns', id: 'LIST' },
        { type: 'Returns', id: 'LIST' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'ChartOfAccounts', id: 'LIST' },
      ],
    }),

    // Get customer invoices for return
    getCustomerInvoices: builder.query({
      query: (customerId) => ({
        url: `sale-returns/customer/${customerId}/invoices`,
        method: 'get',
      }),
      providesTags: (_r, _e, customerId) => [
        { type: 'SaleReturns', id: `CUSTOMER_INVOICES_${customerId}` },
      ],
    }),

    // Search products sold to customer
    searchCustomerProducts: builder.query({
      query: ({ customerId, search }) => ({
        url: `sale-returns/customer/${customerId}/products`,
        method: 'get',
        params: search ? { search } : {},
      }),
      providesTags: (_r, _e, { customerId }) => [
        { type: 'SaleReturns', id: `CUSTOMER_PRODUCTS_${customerId}` },
      ],
    }),

    // Approve sale return
    approveSaleReturn: builder.mutation({
      query: ({ returnId, notes }) => ({
        url: `sale-returns/${returnId}/approve`,
        method: 'put',
        data: { notes },
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'SaleReturns', id: returnId },
        { type: 'SaleReturns', id: 'LIST' },
      ],
    }),

    // Reject sale return
    rejectSaleReturn: builder.mutation({
      query: ({ returnId, reason }) => ({
        url: `sale-returns/${returnId}/reject`,
        method: 'put',
        data: { reason },
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'SaleReturns', id: returnId },
        { type: 'SaleReturns', id: 'LIST' },
      ],
    }),

    // Process sale return (complete with accounting)
    processSaleReturn: builder.mutation({
      query: ({ returnId, inspection }) => ({
        url: `sale-returns/${returnId}/process`,
        method: 'put',
        data: { inspection },
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'SaleReturns', id: returnId },
        { type: 'SaleReturns', id: 'LIST' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'ChartOfAccounts', id: 'LIST' },
      ],
    }),

    // Get sale return statistics
    getSaleReturnStats: builder.query({
      query: (params) => ({
        url: 'sale-returns/stats/summary',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'SaleReturns', id: 'STATS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSaleReturnsQuery,
  useGetSaleReturnQuery,
  useCreateSaleReturnMutation,
  useGetCustomerInvoicesQuery,
  useSearchCustomerProductsQuery,
  useLazySearchCustomerProductsQuery,
  useApproveSaleReturnMutation,
  useRejectSaleReturnMutation,
  useProcessSaleReturnMutation,
  useGetSaleReturnStatsQuery,
} = saleReturnsApi;
