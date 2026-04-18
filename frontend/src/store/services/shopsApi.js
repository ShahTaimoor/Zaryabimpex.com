import { api } from '../api';

export const shopsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getShops: builder.query({
      query: () => ({ url: 'shops', method: 'get' }),
      providesTags: (result) => {
        const shops = result?.data?.shops ?? result?.shops ?? [];
        return shops.length
          ? [
              ...shops.map((s) => ({ type: 'Shops', id: s.shopId || s.id || s._id })),
              { type: 'Shops', id: 'LIST' },
            ]
          : [{ type: 'Shops', id: 'LIST' }];
      },
    }),
    getShopById: builder.query({
      query: (shopId) => ({ url: `shops/${shopId}`, method: 'get' }),
      providesTags: (_res, _err, shopId) => [{ type: 'Shops', id: shopId }],
    }),
    createShop: builder.mutation({
      query: (data) => ({
        url: 'shops',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        'Shops',
        { type: 'Shops', id: 'LIST' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    updateShop: builder.mutation({
      query: ({ shopId, ...data }) => ({
        url: `shops/${shopId}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { shopId }) => [
        'Shops',
        { type: 'Shops', id: shopId },
        { type: 'Shops', id: `SUPPLIERS_${shopId}` },
        { type: 'Shops', id: `PRODUCTS_${shopId}` },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    updateShopStatus: builder.mutation({
      query: ({ shopId, status }) => ({
        url: `shops/${shopId}/status`,
        method: 'patch',
        data: { status },
      }),
      invalidatesTags: (_res, _err, { shopId }) => [
        'Shops',
        { type: 'Shops', id: 'LIST' },
        { type: 'Shops', id: shopId },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    getAllAdmins: builder.query({
      query: () => ({ url: 'shops/admins/all', method: 'get' }),
      providesTags: ['Admins'],
    }),
    createAdmin: builder.mutation({
      query: ({ shopId, ...data }) => ({
        url: `shops/${shopId}/admins`,
        method: 'post',
        data,
      }),
      invalidatesTags: (_res, _err, { shopId }) => [
        'Admins',
        'Shops',
        { type: 'Shops', id: 'LIST' },
        { type: 'Shops', id: shopId },
        { type: 'Shops', id: `SUPPLIERS_${shopId}` },
        { type: 'Shops', id: `PRODUCTS_${shopId}` },
      ],
    }),
    getShopSuppliers: builder.query({
      query: (shopId) => ({
        url: `shops/${shopId}/suppliers`,
        method: 'get',
      }),
      providesTags: (_res, _err, shopId) => [{ type: 'Shops', id: shopId }, { type: 'Shops', id: `SUPPLIERS_${shopId}` }],
    }),
    getShopProducts: builder.query({
      query: (shopId) => ({
        url: `shops/${shopId}/products`,
        method: 'get',
      }),
      providesTags: (_res, _err, shopId) => [{ type: 'Shops', id: shopId }, { type: 'Shops', id: `PRODUCTS_${shopId}` }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetShopsQuery,
  useGetShopByIdQuery,
  useCreateShopMutation,
  useUpdateShopMutation,
  useUpdateShopStatusMutation,
  useGetAllAdminsQuery,
  useCreateAdminMutation,
  useGetShopSuppliersQuery,
  useGetShopProductsQuery,
} = shopsApi;
