import { api } from '../api';

export const warehousesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getWarehouses: builder.query({
      query: (params) => ({
        url: 'warehouses',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.warehouses || result?.warehouses
          ? [
              ...(result.data?.warehouses || result.warehouses).map(({ _id, id }) => ({
                type: 'Warehouses',
                id: _id || id,
              })),
              { type: 'Warehouses', id: 'LIST' },
            ]
          : [{ type: 'Warehouses', id: 'LIST' }],
    }),
    getWarehouse: builder.query({
      query: (id) => ({
        url: `warehouses/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Warehouses', id }],
    }),
    createWarehouse: builder.mutation({
      query: (data) => ({
        url: 'warehouses',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Warehouses', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    updateWarehouse: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `warehouses/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Warehouses', id },
        { type: 'Warehouses', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    deleteWarehouse: builder.mutation({
      query: (id) => ({
        url: `warehouses/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Warehouses', id },
        { type: 'Warehouses', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Products', id: 'LIST' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetWarehousesQuery,
  useGetWarehouseQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  useDeleteWarehouseMutation,
} = warehousesApi;
