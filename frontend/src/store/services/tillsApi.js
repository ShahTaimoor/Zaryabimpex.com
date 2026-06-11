import { api } from '../api';

export const tillsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCurrentTill: builder.query({
      query: () => ({ url: 'tills/current', method: 'get' }),
      providesTags: [{ type: 'Till', id: 'CURRENT' }],
    }),
    getTillDashboard: builder.query({
      query: (params) => ({ url: 'tills/dashboard', method: 'get', params }),
      providesTags: [{ type: 'Till', id: 'DASHBOARD' }],
    }),
    getTillSessions: builder.query({
      query: (params) => ({ url: 'tills/sessions', method: 'get', params }),
      providesTags: [{ type: 'Till', id: 'SESSIONS' }],
    }),
    getTillSession: builder.query({
      query: (id) => ({ url: `tills/sessions/${id}`, method: 'get' }),
      providesTags: (_r, _e, id) => [{ type: 'Till', id }],
    }),
    openTill: builder.mutation({
      query: (data) => ({ url: 'tills/open', method: 'post', data }),
      invalidatesTags: [{ type: 'Till', id: 'CURRENT' }, { type: 'Till', id: 'SESSIONS' }, { type: 'Till', id: 'DASHBOARD' }],
    }),
    closeTill: builder.mutation({
      query: (data) => ({ url: 'tills/close', method: 'post', data }),
      invalidatesTags: [{ type: 'Till', id: 'CURRENT' }, { type: 'Till', id: 'SESSIONS' }, { type: 'Till', id: 'DASHBOARD' }],
    }),
    withdrawFromTill: builder.mutation({
      query: (data) => ({ url: 'tills/withdraw', method: 'post', data }),
      invalidatesTags: [{ type: 'Till', id: 'CURRENT' }, { type: 'Till', id: 'DASHBOARD' }],
    }),
    getTillMovementsReport: builder.query({
      query: (params) => ({ url: 'tills/reports/movements', method: 'get', params }),
      providesTags: [{ type: 'Till', id: 'MOVEMENTS' }],
    }),
    getTillDailySummary: builder.query({
      query: (params) => ({ url: 'tills/reports/daily-summary', method: 'get', params }),
      providesTags: [{ type: 'Till', id: 'DAILY' }],
    }),
    getTillCashierSummary: builder.query({
      query: (params) => ({ url: 'tills/reports/cashier-summary', method: 'get', params }),
      providesTags: [{ type: 'Till', id: 'CASHIER' }],
    }),
    getTillVarianceReport: builder.query({
      query: (params) => ({ url: 'tills/reports/variance', method: 'get', params }),
      providesTags: [{ type: 'Till', id: 'VARIANCE' }],
    }),
  }),
});

export const {
  useGetCurrentTillQuery,
  useGetTillDashboardQuery,
  useGetTillSessionsQuery,
  useGetTillSessionQuery,
  useOpenTillMutation,
  useCloseTillMutation,
  useWithdrawFromTillMutation,
  useGetTillMovementsReportQuery,
  useGetTillDailySummaryQuery,
  useGetTillCashierSummaryQuery,
  useGetTillVarianceReportQuery,
} = tillsApi;
