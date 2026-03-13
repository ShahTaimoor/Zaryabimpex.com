import { api } from '../api';

export const productsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query({
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
          url: 'products',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: (result) => {
        const list =
          result?.data?.products ||
          result?.products ||
          result?.items ||
          [];
        return list.length
          ? [
              ...list.map(({ _id, id }) => ({ type: 'Products', id: _id || id })),
              { type: 'Products', id: 'LIST' },
            ]
          : [{ type: 'Products', id: 'LIST' }];
      },
    }),
    getProduct: builder.query({
      query: (id) => ({
        url: `products/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Products', id }],
    }),
    createProduct: builder.mutation({
      query: (data) => ({
        url: 'products',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Products', id: 'LIST' }],
    }),
    updateProduct: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `products/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Products', id },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    deleteProduct: builder.mutation({
      query: (id) => ({
        url: `products/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Products', id },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    bulkUpdateProducts: builder.mutation({
      query: ({ productIds, updates }) => ({
        url: 'products/bulk',
        method: 'put',
        data: { productIds, updates },
      }),
      invalidatesTags: [{ type: 'Products', id: 'LIST' }],
    }),
    bulkDeleteProducts: builder.mutation({
      query: ({ productIds }) => ({
        url: 'products/bulk',
        method: 'delete',
        data: { productIds },
      }),
      invalidatesTags: [{ type: 'Products', id: 'LIST' }],
    }),
    searchProducts: builder.query({
      query: (query) => ({
        url: `products/search/${encodeURIComponent(query)}`,
        method: 'get',
      }),
    }),
    lowStock: builder.query({
      query: () => ({
        url: 'products/low-stock',
        method: 'get',
      }),
      providesTags: [{ type: 'Products', id: 'LOW_STOCK' }],
    }),
    getLastPurchasePrice: builder.query({
      query: (id) => ({
        url: `products/${id}/last-purchase-price`,
        method: 'get',
      }),
    }),
    getLastPurchasePrices: builder.mutation({
      query: (data) => ({
        url: 'products/get-last-purchase-prices',
        method: 'post',
        data,
      }),
    }),
    linkInvestors: builder.mutation({
      query: ({ productId, investors }) => ({
        url: `products/${productId}/link-investors`,
        method: 'post',
        data: { investors },
      }),
      invalidatesTags: (_res, _err, { productId }) => [
        { type: 'Products', id: productId },
        { type: 'Products', id: 'LIST' },
      ],
    }),
    exportCSV: builder.mutation({
      query: (filters) => ({
        url: 'products/export/csv',
        method: 'post',
        data: { filters },
      }),
    }),
    exportExcel: builder.mutation({
      query: (filters) => ({
        url: 'products/export/excel',
        method: 'post',
        data: { filters },
      }),
    }),
    importExcel: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: 'products/import/excel',
          method: 'post',
          data: formData,
        };
      },
      invalidatesTags: [{ type: 'Products', id: 'LIST' }],
    }),
    importCSV: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: 'products/import/csv',
          method: 'post',
          data: formData,
        };
      },
      invalidatesTags: [{ type: 'Products', id: 'LIST' }],
    }),
    downloadFile: builder.query({
      query: (filename) => ({
        url: `products/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
    }),
    // Download CSV template for product import
    downloadTemplate: builder.query({
      query: () => ({
        // Backend route: GET /api/products/template/csv
        url: 'products/template/csv',
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useBulkUpdateProductsMutation,
  useBulkDeleteProductsMutation,
  useSearchProductsQuery,
  useLowStockQuery,
  useGetLastPurchasePriceQuery,
  useLazyGetLastPurchasePriceQuery,
  useGetLastPurchasePricesMutation,
  useLinkInvestorsMutation,
  useExportCSVMutation,
  useExportExcelMutation,
  useImportExcelMutation,
  useImportCSVMutation,
  useLazyDownloadFileQuery,
  useDownloadTemplateQuery,
  useLazyDownloadTemplateQuery,
} = productsApi;

