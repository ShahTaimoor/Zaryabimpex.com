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
        if (!filteredParams.listMode) {
          filteredParams.listMode = 'minimal';
        }
        return {
          url: 'products',
          method: 'get',
          params: filteredParams,
        };
      },
      // Cache list queries to reduce refetch churn when navigating POS (~90s).
      keepUnusedDataFor: 90,
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
      invalidatesTags: [
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'LowStock', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
      ],
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
        { type: 'Products', id: 'SEARCH' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
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
        { type: 'Products', id: 'SEARCH' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
      ],
    }),
    bulkUpdateProducts: builder.mutation({
      query: ({ productIds, updates }) => ({
        url: 'products/bulk',
        method: 'put',
        data: { productIds, updates },
      }),
      invalidatesTags: [
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
      ],
    }),
    bulkDeleteProducts: builder.mutation({
      query: ({ productIds }) => ({
        url: 'products/bulk',
        method: 'delete',
        data: { productIds },
      }),
      invalidatesTags: [
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
      ],
    }),
    searchProducts: builder.query({
      query: (query) => ({
        url: `products/search/${encodeURIComponent(query)}`,
        method: 'get',
      }),
      providesTags: [{ type: 'Products', id: 'SEARCH' }],
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
      providesTags: (_res, _err, id) => [{ type: 'Products', id }],
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
        url: `products/${productId}/investors`,
        method: 'post',
        data: { investors },
      }),
      invalidatesTags: (_res, _err, { productId }) => [
        { type: 'Products', id: productId },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
      ],
    }),
    bulkCreateProducts: builder.mutation({
      query: ({ products, autoCreateCategories = true }) => ({
        url: 'products/bulk-create',
        method: 'post',
        data: { products, autoCreateCategories },
      }),
      invalidatesTags: [
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Inventory', id: 'LIST' },
      ],
    }),
    uploadProductImage: builder.mutation({
      query: (formData) => ({
        url: 'images/upload',
        method: 'post',
        data: formData,
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetProductsQuery,
  useLazyGetProductsQuery,
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
  useBulkCreateProductsMutation,
  useUploadProductImageMutation,
} = productsApi;
