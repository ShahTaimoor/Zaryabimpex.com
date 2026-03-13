import { api } from '../api';

export const banksApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBanks: builder.query({
      query: (params) => ({
        url: 'banks',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.banks || result?.banks
          ? [
              ...(result.data?.banks || result.banks).map(({ _id, id }) => ({
                type: 'Banks',
                id: _id || id,
              })),
              { type: 'Banks', id: 'LIST' },
            ]
          : [{ type: 'Banks', id: 'LIST' }],
    }),
    getBank: builder.query({
      query: (id) => ({
        url: `banks/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Banks', id }],
    }),
    createBank: builder.mutation({
      query: (data) => ({
        url: 'banks',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Banks', id: 'LIST' }],
    }),
    updateBank: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `banks/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Banks', id },
        { type: 'Banks', id: 'LIST' },
      ],
    }),
    deleteBank: builder.mutation({
      query: (id) => ({
        url: `banks/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Banks', id },
        { type: 'Banks', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBanksQuery,
  useGetBankQuery,
  useCreateBankMutation,
  useUpdateBankMutation,
  useDeleteBankMutation,
} = banksApi;

