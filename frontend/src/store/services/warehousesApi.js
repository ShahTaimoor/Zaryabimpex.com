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
      invalidatesTags: [{ type: 'Warehouses', id: 'LIST' }],
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
