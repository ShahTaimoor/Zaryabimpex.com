import { api } from '../api';

export const customerAnalyticsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAnalytics: builder.query({
      query: (params) => ({
        url: 'customer-analytics',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'CUSTOMER_ANALYTICS' }],
    }),
    getSummary: builder.query({
      query: () => ({
        url: 'customer-analytics/summary',
        method: 'get',
      }),
      providesTags: [{ type: 'Reports', id: 'CUSTOMER_ANALYTICS_SUMMARY' }],
    }),
    getCustomerAnalytics: builder.query({
      query: (customerId) => ({
        url: `customer-analytics/${customerId}`,
        method: 'get',
      }),
      providesTags: (_res, _err, customerId) => [
        { type: 'Customers', id: customerId },
        { type: 'Reports', id: 'CUSTOMER_ANALYTICS' },
      ],
    }),
    getSegment: builder.query({
      query: ({ segment, ...params }) => ({
        url: `customer-analytics/segments/${segment}`,
        method: 'get',
        params,
      }),
    }),
    getChurnRisk: builder.query({
      query: (level) => ({
        url: `customer-analytics/churn-risk/${level}`,
        method: 'get',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAnalyticsQuery,
  useLazyGetAnalyticsQuery,
  useGetSummaryQuery,
  useGetCustomerAnalyticsQuery,
  useGetSegmentQuery,
  useLazyGetSegmentQuery,
  useGetChurnRiskQuery,
  useLazyGetChurnRiskQuery,
} = customerAnalyticsApi;

