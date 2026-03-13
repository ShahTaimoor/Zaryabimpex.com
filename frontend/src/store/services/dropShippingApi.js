import { api } from '../api';

export const dropShippingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTransactions: builder.query({
      query: (params) => ({
        url: 'drop-shipping',
        method: 'get',
        params,
      }),
      providesTags: (result) => {
        const list = result?.data?.transactions || result?.transactions || result?.items || [];
        return list.length
          ? [
              ...list.map(({ _id, id }) => ({ type: 'Sales', id: _id || id })),
              { type: 'Sales', id: 'DROPSHIP_LIST' },
            ]
          : [{ type: 'Sales', id: 'DROPSHIP_LIST' }];
      },
    }),
    getTransaction: builder.query({
      query: (id) => ({
        url: `drop-shipping/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Sales', id }],
    }),
    createTransaction: builder.mutation({
      query: (data) => ({
        url: 'drop-shipping',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Sales', id: 'DROPSHIP_LIST' }],
    }),
    updateTransaction: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `drop-shipping/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Sales', id },
        { type: 'Sales', id: 'DROPSHIP_LIST' },
      ],
    }),
    deleteTransaction: builder.mutation({
      query: (id) => ({
        url: `drop-shipping/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Sales', id },
        { type: 'Sales', id: 'DROPSHIP_LIST' },
      ],
    }),
    updateStatus: builder.mutation({
      query: ({ id, status }) => ({
        url: `drop-shipping/${id}/status`,
        method: 'put',
        data: { status },
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: 'Sales', id }],
    }),
    getStats: builder.query({
      query: (params) => ({
        url: 'drop-shipping/stats',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'DROPSHIP_STATS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTransactionsQuery,
  useLazyGetTransactionsQuery,
  useGetTransactionQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useUpdateStatusMutation,
  useGetStatsQuery,
  useLazyGetStatsQuery,
} = dropShippingApi;

