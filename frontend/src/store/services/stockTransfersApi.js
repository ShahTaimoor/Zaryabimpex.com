import { api } from '../api';

export const stockTransfersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStockTransfers: builder.query({
      query: (params) => ({ url: 'stock-transfers', method: 'get', params }),
      providesTags: [{ type: 'Inventory', id: 'TRANSFERS' }],
    }),
    getStockTransferById: builder.query({
      query: (id) => ({ url: `stock-transfers/${id}`, method: 'get' }),
      providesTags: (_res, _err, id) => [{ type: 'Inventory', id: `TRANSFER_${id}` }],
    }),
    createStockTransfer: builder.mutation({
      query: (data) => ({ url: 'stock-transfers', method: 'post', data }),
      invalidatesTags: [
        { type: 'Inventory', id: 'TRANSFERS' },
        'Products',
        'Inventory',
        'Warehouses',
        'Shops',
      ],
    }),
    getWarehouseStock: builder.query({
      query: ({ warehouseId, ...params }) => ({
        url: `warehouses/${warehouseId}/stock`,
        method: 'get',
        params,
      }),
      providesTags: (_res, _err, { warehouseId }) => [
        { type: 'Inventory', id: `WH_STOCK_${warehouseId}` },
      ],
    }),
    getShopStock: builder.query({
      query: ({ shopId, ...params }) => ({
        url: `shops/${shopId}/stock`,
        method: 'get',
        params,
      }),
      providesTags: (_res, _err, { shopId }) => [
        { type: 'Inventory', id: `SHOP_STOCK_${shopId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStockTransfersQuery,
  useGetStockTransferByIdQuery,
  useCreateStockTransferMutation,
  useGetWarehouseStockQuery,
  useLazyGetWarehouseStockQuery,
  useGetShopStockQuery,
  useLazyGetShopStockQuery,
} = stockTransfersApi;
