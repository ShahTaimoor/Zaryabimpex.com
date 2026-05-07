import { api } from '../api';

export const marketPricesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMarketPriceHistory: builder.query({
      query: (params) => ({
        url: 'market-prices/history',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'MarketPrices', id: 'HISTORY' }],
    }),
    createManualMarketPrice: builder.mutation({
      query: (data) => ({
        url: 'market-prices/manual',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'MarketPrices', id: 'HISTORY' }, { type: 'Products', id: 'LIST' }],
    }),
    previewMarketPriceImport: builder.mutation({
      query: (formData) => ({
        url: 'market-prices/import/preview',
        method: 'post',
        data: formData,
      }),
    }),
    applyMarketPriceImport: builder.mutation({
      query: (formData) => ({
        url: 'market-prices/import/apply',
        method: 'post',
        data: formData,
      }),
      invalidatesTags: [{ type: 'MarketPrices', id: 'HISTORY' }, { type: 'Products', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMarketPriceHistoryQuery,
  useCreateManualMarketPriceMutation,
  usePreviewMarketPriceImportMutation,
  useApplyMarketPriceImportMutation,
} = marketPricesApi;
