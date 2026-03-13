import { api } from '../api';

export const stockMovementsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStockMovements: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'stock-movements',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: (result) => {
        const list = result?.data?.movements || result?.movements || result?.items || [];
        return list.length
          ? [
              ...list.map(({ _id, id }) => ({ type: 'Inventory', id: _id || id })),
              { type: 'Inventory', id: 'MOVEMENTS_LIST' },
            ]
          : [{ type: 'Inventory', id: 'MOVEMENTS_LIST' }];
      },
    }),
    getProductMovements: builder.query({
      query: ({ productId, ...params }) => ({
        url: `stock-movements/product/${productId}`,
        method: 'get',
        params,
      }),
      providesTags: (_res, _err, { productId }) => [
        { type: 'Products', id: productId },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
      ],
    }),
    getStockMovement: builder.query({
      query: (id) => ({
        url: `stock-movements/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Inventory', id }],
    }),
    createAdjustment: builder.mutation({
      query: (data) => ({
        url: 'stock-movements/adjustment',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    reverseMovement: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `stock-movements/${id}/reverse`,
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'MOVEMENTS_LIST' },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    getStats: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'stock-movements/stats/overview',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: [{ type: 'Reports', id: 'STOCK_MOVEMENTS_STATS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStockMovementsQuery,
  useLazyGetStockMovementsQuery,
  useGetProductMovementsQuery,
  useLazyGetProductMovementsQuery,
  useGetStockMovementQuery,
  useCreateAdjustmentMutation,
  useReverseMovementMutation,
  useGetStatsQuery,
  useLazyGetStatsQuery,
} = stockMovementsApi;

