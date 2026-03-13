import { api } from '../api';

export const anomalyDetectionApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAnomalies: builder.query({
      query: (params) => ({
        url: 'anomaly-detection',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'ANOMALIES' }],
    }),
    getSalesAnomalies: builder.query({
      query: (params) => ({
        url: 'anomaly-detection/sales',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'SALES_ANOMALIES' }],
    }),
    getInventoryAnomalies: builder.query({
      query: () => ({
        url: 'anomaly-detection/inventory',
        method: 'get',
      }),
      providesTags: [{ type: 'Reports', id: 'INVENTORY_ANOMALIES' }],
    }),
    getPaymentAnomalies: builder.query({
      query: (params) => ({
        url: 'anomaly-detection/payments',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'PAYMENT_ANOMALIES' }],
    }),
    getSummary: builder.query({
      query: () => ({
        url: 'anomaly-detection/summary',
        method: 'get',
      }),
      providesTags: [{ type: 'Reports', id: 'ANOMALY_SUMMARY' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAnomaliesQuery,
  useLazyGetAnomaliesQuery,
  useGetSalesAnomaliesQuery,
  useLazyGetSalesAnomaliesQuery,
  useGetInventoryAnomaliesQuery,
  useGetPaymentAnomaliesQuery,
  useLazyGetPaymentAnomaliesQuery,
  useGetSummaryQuery,
} = anomalyDetectionApi;

