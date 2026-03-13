import { api } from '../api';

export const shopsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getShops: builder.query({
      query: () => ({ url: 'shops', method: 'get' }),
      providesTags: ['Shops'],
    }),
    getShopById: builder.query({
      query: (shopId) => ({ url: `shops/${shopId}`, method: 'get' }),
      providesTags: ['Shops'],
    }),
    createShop: builder.mutation({
      query: (data) => ({
        url: 'shops',
        method: 'post',
        data,
      }),
      invalidatesTags: ['Shops'],
    }),
    updateShop: builder.mutation({
      query: ({ shopId, ...data }) => ({
        url: `shops/${shopId}`,
        method: 'put',
        data,
      }),
      invalidatesTags: ['Shops'],
    }),
    updateShopStatus: builder.mutation({
      query: ({ shopId, status }) => ({
        url: `shops/${shopId}/status`,
        method: 'patch',
        data: { status },
      }),
      invalidatesTags: ['Shops'],
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
      invalidatesTags: ['Admins'],
    }),
    getShopSuppliers: builder.query({
      query: (shopId) => ({
        url: `shops/${shopId}/suppliers`,
        method: 'get',
      }),
    }),
    getShopProducts: builder.query({
      query: (shopId) => ({
        url: `shops/${shopId}/products`,
        method: 'get',
      }),
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
