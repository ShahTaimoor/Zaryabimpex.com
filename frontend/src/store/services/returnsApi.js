import { api } from '../api';

export const returnsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getReturns: builder.query({
      query: (params) => {
        // Remove empty string values from params to avoid validation errors
        const cleanParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          if (value !== '' && value !== null && value !== undefined) {
            cleanParams[key] = value;
          }
        });
        return {
          url: 'returns',
          method: 'get',
          params: cleanParams,
        };
      },
      providesTags: (result) =>
        result?.data?.returns || result?.data
          ? [
              ...(result.data.returns || result.data).map(({ _id, id }) => ({
                type: 'Returns',
                id: _id || id,
              })),
              { type: 'Returns', id: 'LIST' },
            ]
          : [{ type: 'Returns', id: 'LIST' }],
    }),
    getReturn: builder.query({
      query: (id) => ({
        url: `returns/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Returns', id }],
    }),
    createReturn: builder.mutation({
      query: (data) => ({
        url: 'returns',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
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
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    updateReturnStatus: builder.mutation({
      query: ({ returnId, ...data }) => ({
        url: `returns/${returnId}/status`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'Returns', id: returnId },
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
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
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    updateInspection: builder.mutation({
      query: ({ returnId, ...data }) => ({
        url: `returns/${returnId}/inspection`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'Returns', id: returnId },
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
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
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    addNote: builder.mutation({
      query: ({ returnId, ...data }) => ({
        url: `returns/${returnId}/notes`,
        method: 'post',
        data,
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'Returns', id: returnId },
        { type: 'Returns', id: 'LIST' },
      ],
    }),
    addCommunication: builder.mutation({
      query: ({ returnId, ...data }) => ({
        url: `returns/${returnId}/communication`,
        method: 'post',
        data,
      }),
      invalidatesTags: (_r, _e, { returnId }) => [
        { type: 'Returns', id: returnId },
        { type: 'Returns', id: 'LIST' },
      ],
    }),
    getReturnStats: builder.query({
      query: (params) => ({
        url: 'returns/stats',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Returns', id: 'STATS' }],
    }),
    getReturnTrends: builder.query({
      query: (params) => ({
        url: 'returns/trends',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Returns', id: 'TRENDS' }],
    }),
    getEligibleItems: builder.query({
      query: ({ orderId, isPurchase = false }) => ({
        url: isPurchase 
          ? `returns/purchase-order/${orderId}/eligible-items`
          : `returns/order/${orderId}/eligible-items`,
        method: 'get',
      }),
      providesTags: (_r, _e, { orderId }) => [{ type: 'Returns', id: `ELIGIBLE_${orderId}` }],
    }),
    deleteReturn: builder.mutation({
      query: (returnId) => ({
        url: `returns/${returnId}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, returnId) => [
        { type: 'Returns', id: returnId },
        { type: 'Returns', id: 'LIST' },
        { type: 'Returns', id: 'STATS' },
        { type: 'Returns', id: 'TRENDS' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
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
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetReturnsQuery,
  useGetReturnQuery,
  useCreateReturnMutation,
  useUpdateReturnStatusMutation,
  useUpdateInspectionMutation,
  useAddNoteMutation,
  useAddCommunicationMutation,
  useGetReturnStatsQuery,
  useGetReturnTrendsQuery,
  useGetEligibleItemsQuery,
  useDeleteReturnMutation,
} = returnsApi;

