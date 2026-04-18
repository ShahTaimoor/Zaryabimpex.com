import { api } from '../api';

export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardRangeSummary: builder.query({
      query: ({ dateFrom, dateTo }) => ({
        url: 'dashboard/range-summary',
        method: 'get',
        params: { dateFrom, dateTo },
      }),
      keepUnusedDataFor: 180,
      providesTags: [{ type: 'Reports', id: 'DASHBOARD_RANGE_SUMMARY' }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetDashboardRangeSummaryQuery } = dashboardApi;
