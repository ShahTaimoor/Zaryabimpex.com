import { api } from '../api';

export const dailyCashApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTodayCashSummary: builder.query({
      query: (params) => ({ url: 'daily-cash/today', method: 'get', params }),
      providesTags: [{ type: 'DailyCash', id: 'TODAY' }],
    }),
    getDailyCashDashboard: builder.query({
      query: (params) => ({ url: 'daily-cash/dashboard', method: 'get', params }),
      providesTags: [{ type: 'DailyCash', id: 'DASHBOARD' }],
    }),
    setDailyOpeningCash: builder.mutation({
      query: (data) => ({ url: 'daily-cash/opening', method: 'post', data }),
      invalidatesTags: [
        { type: 'DailyCash', id: 'TODAY' },
        { type: 'DailyCash', id: 'DASHBOARD' },
        { type: 'DailyCash', id: 'CLOSINGS' },
      ],
    }),
    closeDailyCash: builder.mutation({
      query: (data) => ({ url: 'daily-cash/close', method: 'post', data }),
      invalidatesTags: [
        { type: 'DailyCash', id: 'TODAY' },
        { type: 'DailyCash', id: 'DASHBOARD' },
        { type: 'DailyCash', id: 'CLOSINGS' },
        { type: 'DailyCash', id: 'VARIANCE' },
      ],
    }),
    recordCashWithdrawal: builder.mutation({
      query: (data) => ({ url: 'daily-cash/withdraw', method: 'post', data }),
      invalidatesTags: [
        { type: 'DailyCash', id: 'TODAY' },
        { type: 'DailyCash', id: 'DASHBOARD' },
        { type: 'DailyCash', id: 'MOVEMENTS' },
      ],
    }),
    recordCashAdjustment: builder.mutation({
      query: (data) => ({ url: 'daily-cash/adjustment', method: 'post', data }),
      invalidatesTags: [
        { type: 'DailyCash', id: 'TODAY' },
        { type: 'DailyCash', id: 'DASHBOARD' },
        { type: 'DailyCash', id: 'MOVEMENTS' },
      ],
    }),
    getCashMovementsReport: builder.query({
      query: (params) => ({ url: 'daily-cash/reports/movements', method: 'get', params }),
      providesTags: [{ type: 'DailyCash', id: 'MOVEMENTS' }],
    }),
    getDailyCashSummaryReport: builder.query({
      query: (params) => ({ url: 'daily-cash/reports/summary', method: 'get', params }),
      providesTags: [{ type: 'DailyCash', id: 'DAILY' }],
    }),
    getDailyCashClosingsReport: builder.query({
      query: (params) => ({ url: 'daily-cash/reports/closings', method: 'get', params }),
      providesTags: [{ type: 'DailyCash', id: 'CLOSINGS' }],
    }),
    getDailyCashVarianceReport: builder.query({
      query: (params) => ({ url: 'daily-cash/reports/variance', method: 'get', params }),
      providesTags: [{ type: 'DailyCash', id: 'VARIANCE' }],
    }),
    getDailyCashUserActivityReport: builder.query({
      query: (params) => ({ url: 'daily-cash/reports/user-activity', method: 'get', params }),
      providesTags: [{ type: 'DailyCash', id: 'USER_ACTIVITY' }],
    }),
  }),
});

export const {
  useGetTodayCashSummaryQuery,
  useGetDailyCashDashboardQuery,
  useSetDailyOpeningCashMutation,
  useCloseDailyCashMutation,
  useRecordCashWithdrawalMutation,
  useRecordCashAdjustmentMutation,
  useGetCashMovementsReportQuery,
  useGetDailyCashSummaryReportQuery,
  useGetDailyCashClosingsReportQuery,
  useGetDailyCashVarianceReportQuery,
  useGetDailyCashUserActivityReportQuery,
} = dailyCashApi;
