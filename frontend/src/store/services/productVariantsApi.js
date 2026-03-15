import { api } from '../api';

export const productVariantsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getVariants: builder.query({
      query: (params) => ({
        url: 'product-variants',
        method: 'get',
        params,
      }),
      providesTags: (result) => {
        const list = result?.data?.variants || result?.variants || result?.items || [];
        return list.length
          ? [
              ...list.map(({ _id, id }) => ({ type: 'Products', id: _id || id })),
              { type: 'Products', id: 'VARIANTS_LIST' },
            ]
          : [{ type: 'Products', id: 'VARIANTS_LIST' }];
      },
    }),
    getVariant: builder.query({
      query: (id) => ({
        url: `product-variants/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Products', id }],
    }),
    createVariant: builder.mutation({
      query: (data) => ({
        url: 'product-variants',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Products', id: 'VARIANTS_LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'LOW_STOCK' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    updateVariant: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `product-variants/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Products', id },
        { type: 'Products', id: 'VARIANTS_LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'LOW_STOCK' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    deleteVariant: builder.mutation({
      query: (id) => ({
        url: `product-variants/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Products', id },
        { type: 'Products', id: 'VARIANTS_LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'LOW_STOCK' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    getVariantsByBaseProduct: builder.query({
      query: (productId) => ({
        url: `product-variants/base-product/${productId}`,
        method: 'get',
      }),
      providesTags: (_res, _err, productId) => [
        { type: 'Products', id: productId },
        { type: 'Products', id: 'VARIANTS_LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetVariantsQuery,
  useLazyGetVariantsQuery,
  useGetVariantQuery,
  useCreateVariantMutation,
  useUpdateVariantMutation,
  useDeleteVariantMutation,
  useGetVariantsByBaseProductQuery,
} = productVariantsApi;

