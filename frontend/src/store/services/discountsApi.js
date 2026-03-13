import { api } from '../api';

export const discountsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDiscounts: builder.query({
      query: (params) => ({
        url: 'discounts',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.discounts || result?.discounts
          ? [
              ...(result.data?.discounts || result.discounts).map(({ _id, id }) => ({
                type: 'Discounts',
                id: _id || id,
              })),
              { type: 'Discounts', id: 'LIST' },
            ]
          : [{ type: 'Discounts', id: 'LIST' }],
    }),
    getDiscount: builder.query({
      query: (id) => ({
        url: `discounts/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Discounts', id }],
    }),
    createDiscount: builder.mutation({
      query: (data) => ({
        url: 'discounts',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Discounts', id: 'LIST' }],
    }),
    updateDiscount: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `discounts/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Discounts', id },
        { type: 'Discounts', id: 'LIST' },
      ],
    }),
    deleteDiscount: builder.mutation({
      query: (id) => ({
        url: `discounts/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Discounts', id },
        { type: 'Discounts', id: 'LIST' },
      ],
    }),
    toggleDiscountStatus: builder.mutation({
      query: (id) => ({
        url: `discounts/${id}/toggle-status`,
        method: 'put',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Discounts', id },
        { type: 'Discounts', id: 'LIST' },
      ],
    }),
    applyDiscount: builder.mutation({
      query: (data) => ({
        url: 'discounts/apply',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Discounts', id: 'LIST' }],
    }),
    removeDiscount: builder.mutation({
      query: (data) => ({
        url: 'discounts/remove',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Discounts', id: 'LIST' }],
    }),
    checkApplicableDiscounts: builder.mutation({
      query: (data) => ({
        url: 'discounts/check-applicable',
        method: 'post',
        data,
      }),
    }),
    getDiscountByCode: builder.query({
      query: (code) => ({
        url: `discounts/code/${code}`,
        method: 'get',
      }),
      providesTags: (_r, _e, code) => [{ type: 'Discounts', id: `CODE_${code}` }],
    }),
    checkCodeAvailability: builder.query({
      query: (code) => ({
        url: `discounts/code/${code}/availability`,
        method: 'get',
      }),
    }),
    generateCodeSuggestions: builder.mutation({
      query: (data) => ({
        url: 'discounts/generate-code-suggestions',
        method: 'post',
        data,
      }),
    }),
    getDiscountStats: builder.query({
      query: (params) => ({
        url: 'discounts/stats',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Discounts', id: 'STATS' }],
    }),
    getActiveDiscounts: builder.query({
      query: () => ({
        url: 'discounts/active',
        method: 'get',
      }),
      providesTags: [{ type: 'Discounts', id: 'ACTIVE' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDiscountsQuery,
  useGetDiscountQuery,
  useCreateDiscountMutation,
  useUpdateDiscountMutation,
  useDeleteDiscountMutation,
  useToggleDiscountStatusMutation,
  useApplyDiscountMutation,
  useRemoveDiscountMutation,
  useCheckApplicableDiscountsMutation,
  useGetDiscountByCodeQuery,
  useCheckCodeAvailabilityQuery,
  useGenerateCodeSuggestionsMutation,
  useGetDiscountStatsQuery,
  useGetActiveDiscountsQuery,
} = discountsApi;

