import { api } from '../api';

export const investorsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getInvestors: builder.query({
      query: (params) => ({
        url: 'investors',
        method: 'get',
        params,
      }),
      providesTags: (result) => {
        const list = result?.data?.investors || result?.investors || result?.items || [];
        return list.length
          ? [
              ...list.map(({ _id, id }) => ({ type: 'Settings', id: _id || id })),
              { type: 'Settings', id: 'INVESTORS_LIST' },
            ]
          : [{ type: 'Settings', id: 'INVESTORS_LIST' }];
      },
    }),
    getInvestor: builder.query({
      query: (id) => ({
        url: `investors/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Settings', id }],
    }),
    createInvestor: builder.mutation({
      query: (data) => ({
        url: 'investors',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Settings', id: 'INVESTORS_LIST' }],
    }),
    updateInvestor: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `investors/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Settings', id },
        { type: 'Settings', id: 'INVESTORS_LIST' },
      ],
    }),
    deleteInvestor: builder.mutation({
      query: (id) => ({
        url: `investors/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Settings', id },
        { type: 'Settings', id: 'INVESTORS_LIST' },
      ],
    }),
    recordPayout: builder.mutation({
      query: ({ id, amount }) => ({
        url: `investors/${id}/payout`,
        method: 'post',
        data: { amount },
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Settings', id },
        { type: 'Accounting', id: 'INVESTOR_PAYOUTS' },
      ],
    }),
    recordInvestment: builder.mutation({
      query: ({ id, amount, notes }) => ({
        url: `investors/${id}/investment`,
        method: 'post',
        data: { amount, notes },
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Settings', id },
        { type: 'Accounting', id: 'INVESTOR_INVESTMENTS' },
      ],
    }),
    getProfitShares: builder.query({
      query: ({ id, ...params }) => ({
        url: `investors/${id}/profit-shares`,
        method: 'get',
        params,
      }),
      providesTags: (_res, _err, { id }) => [
        { type: 'Settings', id },
        { type: 'Accounting', id: 'PROFIT_SHARES' },
      ],
    }),
    getProfitSummary: builder.query({
      query: (params) => ({
        url: 'investors/profit-shares/summary',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Accounting', id: 'PROFIT_SUMMARY' }],
    }),
    getOrderProfitShares: builder.query({
      query: (orderId) => ({
        url: `investors/profit-shares/order/${orderId}`,
        method: 'get',
      }),
    }),
    getInvestorProducts: builder.query({
      query: (id) => ({
        url: `investors/${id}/products`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [
        { type: 'Settings', id },
        { type: 'Products', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetInvestorsQuery,
  useLazyGetInvestorsQuery,
  useGetInvestorQuery,
  useCreateInvestorMutation,
  useUpdateInvestorMutation,
  useDeleteInvestorMutation,
  useRecordPayoutMutation,
  useRecordInvestmentMutation,
  useGetProfitSharesQuery,
  useLazyGetProfitSharesQuery,
  useGetProfitSummaryQuery,
  useGetOrderProfitSharesQuery,
  useGetInvestorProductsQuery,
} = investorsApi;

