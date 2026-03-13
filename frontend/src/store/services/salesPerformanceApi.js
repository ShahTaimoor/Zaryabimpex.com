import { api } from '../api';

export const salesPerformanceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    generateReport: builder.mutation({
      query: (data) => ({
        url: 'sales-performance/generate',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Reports', id: 'SALES_PERFORMANCE' }],
    }),
    getReports: builder.query({
      query: (params) => ({
        url: 'sales-performance',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.reports || result?.reports
          ? [
              ...(result.data?.reports || result.reports).map(({ _id, id }) => ({
                type: 'Reports',
                id: _id || id,
              })),
              { type: 'Reports', id: 'SALES_PERFORMANCE' },
            ]
          : [{ type: 'Reports', id: 'SALES_PERFORMANCE' }],
    }),
    getReport: builder.query({
      query: (id) => ({
        url: `sales-performance/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Reports', id }],
    }),
    deleteReport: builder.mutation({
      query: (id) => ({
        url: `sales-performance/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Reports', id },
        { type: 'Reports', id: 'SALES_PERFORMANCE' },
      ],
    }),
    toggleFavorite: builder.mutation({
      query: ({ id, isFavorite }) => ({
        url: `sales-performance/${id}/favorite`,
        method: 'put',
        data: { isFavorite },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Reports', id }],
    }),
    updateTags: builder.mutation({
      query: ({ id, tags }) => ({
        url: `sales-performance/${id}/tags`,
        method: 'put',
        data: { tags },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Reports', id }],
    }),
    updateNotes: builder.mutation({
      query: ({ id, notes }) => ({
        url: `sales-performance/${id}/notes`,
        method: 'put',
        data: { notes },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Reports', id }],
    }),
    exportReport: builder.mutation({
      query: ({ id, format }) => ({
        url: `sales-performance/${id}/export`,
        method: 'post',
        data: { format },
        responseType: 'blob',
      }),
    }),
    getReportStats: builder.query({
      query: (params) => ({
        url: 'sales-performance/stats/overview',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'SALES_PERFORMANCE_STATS' }],
    }),
    getQuickTopProducts: builder.query({
      query: (params) => ({
        url: 'sales-performance/quick/top-products',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'SALES_PERFORMANCE_TOP_PRODUCTS' }],
    }),
    getQuickTopCustomers: builder.query({
      query: (params) => ({
        url: 'sales-performance/quick/top-customers',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'SALES_PERFORMANCE_TOP_CUSTOMERS' }],
    }),
    getQuickTopSalesReps: builder.query({
      query: (params) => ({
        url: 'sales-performance/quick/top-sales-reps',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'SALES_PERFORMANCE_TOP_SALES_REPS' }],
    }),
    getQuickSummary: builder.query({
      query: (params) => ({
        url: 'sales-performance/quick/summary',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'SALES_PERFORMANCE_QUICK_SUMMARY' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGenerateReportMutation,
  useGetReportsQuery,
  useGetReportQuery,
  useDeleteReportMutation,
  useToggleFavoriteMutation,
  useUpdateTagsMutation,
  useUpdateNotesMutation,
  useExportReportMutation,
  useGetReportStatsQuery,
  useGetQuickTopProductsQuery,
  useGetQuickTopCustomersQuery,
  useGetQuickTopSalesRepsQuery,
  useGetQuickSummaryQuery,
} = salesPerformanceApi;

