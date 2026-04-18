import { api } from '../api';

export const productTransformationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTransformations: builder.query({
      query: (params) => ({
        url: 'product-transformations',
        method: 'get',
        params,
      }),
      providesTags: (result) => {
        const list = result?.data?.transformations || result?.transformations || result?.items || [];
        return list.length
          ? [
              ...list.map(({ _id, id }) => ({ type: 'Products', id: _id || id })),
              { type: 'Products', id: 'TRANSFORMATIONS_LIST' },
            ]
          : [{ type: 'Products', id: 'TRANSFORMATIONS_LIST' }];
      },
    }),
    getTransformation: builder.query({
      query: (id) => ({
        url: `product-transformations/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Products', id }],
    }),
    createTransformation: builder.mutation({
      query: (data) => ({
        url: 'product-transformations',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Products', id: 'TRANSFORMATIONS_LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Inventory', id: 'MOVEMENTS' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Inventory', id: 'MOVEMENTS_STATS' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'STOCK_MOVEMENTS_STATS' },
      ],
    }),
    cancelTransformation: builder.mutation({
      query: (id) => ({
        url: `product-transformations/${id}/cancel`,
        method: 'put',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Products', id },
        { type: 'Products', id: 'TRANSFORMATIONS_LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Inventory', id: 'MOVEMENTS' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Inventory', id: 'MOVEMENTS_STATS' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'STOCK_MOVEMENTS_STATS' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTransformationsQuery,
  useLazyGetTransformationsQuery,
  useGetTransformationQuery,
  useCreateTransformationMutation,
  useCancelTransformationMutation,
} = productTransformationsApi;

