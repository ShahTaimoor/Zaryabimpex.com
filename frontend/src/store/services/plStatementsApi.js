import { api } from '../api';

export const plStatementsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    generateStatement: builder.mutation({
      query: (data) => ({
        url: 'pl-statements/generate',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Reports', id: 'PL_STATEMENTS' }],
    }),
    getStatements: builder.query({
      query: (params) => ({
        url: 'pl-statements',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.statements || result?.statements
          ? [
              ...(result.data?.statements || result.statements).map(({ _id, id }) => ({
                type: 'Reports',
                id: _id || id,
              })),
              { type: 'Reports', id: 'PL_STATEMENTS' },
            ]
          : [{ type: 'Reports', id: 'PL_STATEMENTS' }],
    }),
    getStatement: builder.query({
      query: (id) => ({
        url: `pl-statements/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Reports', id }],
    }),
    updateStatement: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `pl-statements/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Reports', id },
        { type: 'Reports', id: 'PL_STATEMENTS' },
      ],
    }),
    updateStatementStatus: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `pl-statements/${id}/status`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Reports', id },
        { type: 'Reports', id: 'PL_STATEMENTS' },
      ],
    }),
    deleteStatement: builder.mutation({
      query: (id) => ({
        url: `pl-statements/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Reports', id },
        { type: 'Reports', id: 'PL_STATEMENTS' },
      ],
    }),
    getSummary: builder.query({
      query: (params) => ({
        url: 'pl-statements/summary',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' }],
    }),
    getTrends: builder.query({
      query: (params) => ({
        url: 'pl-statements/trends',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'PL_STATEMENTS_TRENDS' }],
    }),
    getComparison: builder.query({
      query: ({ id, type = 'previous' }) => ({
        url: `pl-statements/${id}/comparison`,
        method: 'get',
        params: { type },
      }),
      providesTags: (_r, _e, { id }) => [{ type: 'Reports', id: `COMPARISON_${id}` }],
    }),
    exportStatement: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `pl-statements/${id}/export`,
        method: 'post',
        data,
        responseType: 'blob',
      }),
    }),
    getLatestStatement: builder.query({
      query: (params) => ({
        url: 'pl-statements/latest',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'PL_STATEMENTS_LATEST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGenerateStatementMutation,
  useGetStatementsQuery,
  useGetStatementQuery,
  useUpdateStatementMutation,
  useUpdateStatementStatusMutation,
  useDeleteStatementMutation,
  useGetSummaryQuery,
  useGetTrendsQuery,
  useGetComparisonQuery,
  useExportStatementMutation,
  useGetLatestStatementQuery,
} = plStatementsApi;

