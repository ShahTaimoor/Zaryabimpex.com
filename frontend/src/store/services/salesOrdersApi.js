import { api } from '../api';

export const salesOrdersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSalesOrders: builder.query({
      query: (params) => ({
        url: 'sales-orders',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.salesOrders
          ? [
            ...result.data.salesOrders.map(({ _id, id }) => ({
              type: 'Orders',
              id: _id || id,
            })),
            { type: 'Orders', id: 'LIST' },
          ]
          : [{ type: 'Orders', id: 'LIST' }],
    }),
    getSalesOrder: builder.query({
      query: (id) => ({
        url: `sales-orders/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Orders', id }],
    }),
    createSalesOrder: builder.mutation({
      query: (data) => ({
        url: 'sales-orders',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Orders', id: 'LIST' }],
    }),
    updateSalesOrder: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `sales-orders/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'LIST' },
      ],
    }),
    deleteSalesOrder: builder.mutation({
      query: (id) => ({
        url: `sales-orders/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'LIST' },
      ],
    }),
    confirmSalesOrder: builder.mutation({
      query: (id) => ({
        url: `sales-orders/${id}/confirm`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'LIST' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
      ],
    }),
    cancelSalesOrder: builder.mutation({
      query: (id) => ({
        url: `sales-orders/${id}/cancel`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'LIST' },
        { type: 'Products', id: 'LIST' }, // Invalidate products to update stock levels
        { type: 'Inventory', id: 'LIST' }, // Invalidate inventory cache
      ],
    }),
    closeSalesOrder: builder.mutation({
      query: (id) => ({
        url: `sales-orders/${id}/close`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Orders', id },
        { type: 'Orders', id: 'LIST' },
      ],
    }),
    getConversionData: builder.query({
      query: (id) => ({
        url: `sales-orders/${id}/convert`,
        method: 'get',
      }),
    }),
    exportExcel: builder.mutation({
      query: (filters) => ({
        url: 'sales-orders/export/excel',
        method: 'post',
        data: { filters },
      }),
    }),
    exportCSV: builder.mutation({
      query: (filters) => ({
        url: 'sales-orders/export/csv',
        method: 'post',
        data: { filters },
      }),
    }),
    exportPDF: builder.mutation({
      query: (filters) => ({
        url: 'sales-orders/export/pdf',
        method: 'post',
        data: { filters },
      }),
    }),
    exportJSON: builder.mutation({
      query: (filters) => ({
        url: 'sales-orders/export/json',
        method: 'post',
        data: { filters },
      }),
    }),
    downloadFile: builder.mutation({
      query: (filename) => ({
        url: `sales-orders/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSalesOrdersQuery,
  useGetSalesOrderQuery,
  useCreateSalesOrderMutation,
  useUpdateSalesOrderMutation,
  useDeleteSalesOrderMutation,
  useConfirmSalesOrderMutation,
  useCancelSalesOrderMutation,
  useCloseSalesOrderMutation,
  useGetConversionDataQuery,
  useExportExcelMutation,
  useExportCSVMutation,
  useExportPDFMutation,
  useExportJSONMutation,
  useDownloadFileMutation,
} = salesOrdersApi;

