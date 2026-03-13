import { api } from '../api';

export const balanceSheetsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    generateBalanceSheet: builder.mutation({
      query: (data) => ({
        url: 'balance-sheets/generate',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Reports', id: 'BALANCE_SHEETS' }, { type: 'Reports', id: 'BALANCE_SHEETS_LATEST' }],
    }),
    getBalanceSheets: builder.query({
      query: (params) => ({
        url: 'balance-sheets',
        method: 'get',
        params,
      }),
      transformResponse: (response) => {
        // Backend returns { balanceSheets: [...], pagination: {...} }
        // Normalize to { data: { balanceSheets: [...], pagination: {...} } }
        if (response.balanceSheets || response.pagination) {
          return {
            data: {
              balanceSheets: response.balanceSheets || [],
              pagination: response.pagination || {}
            }
          };
        }
        // If already in expected format, return as is
        return response;
      },
      providesTags: (result) => {
        const balanceSheets = result?.data?.balanceSheets || result?.balanceSheets || [];
        return balanceSheets.length > 0
          ? [
              ...balanceSheets.map(({ _id, id }) => ({
                type: 'Reports',
                id: _id || id,
              })),
              { type: 'Reports', id: 'BALANCE_SHEETS' },
            ]
          : [{ type: 'Reports', id: 'BALANCE_SHEETS' }];
      },
    }),
    getBalanceSheet: builder.query({
      query: (id) => ({
        url: `balance-sheets/${id}`,
        method: 'get',
      }),
      transformResponse: (response) => {
        // Backend returns balance sheet directly or wrapped in data
        // Normalize to { data: balanceSheet }
        if (response.statementNumber || response._id) {
          return {
            data: response
          };
        }
        // If already in expected format, return as is
        return response;
      },
      providesTags: (_r, _e, id) => [{ type: 'Reports', id }],
    }),
    updateBalanceSheet: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `balance-sheets/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Reports', id },
        { type: 'Reports', id: 'BALANCE_SHEETS' },
      ],
    }),
    updateBalanceSheetStatus: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `balance-sheets/${id}/status`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Reports', id },
        { type: 'Reports', id: 'BALANCE_SHEETS' },
      ],
    }),
    deleteBalanceSheet: builder.mutation({
      query: (id) => ({
        url: `balance-sheets/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Reports', id },
        { type: 'Reports', id: 'BALANCE_SHEETS' },
      ],
    }),
    getComparison: builder.query({
      query: ({ id, type = 'previous' }) => ({
        url: `balance-sheets/${id}/comparison`,
        method: 'get',
        params: { type },
      }),
      providesTags: (_r, _e, { id }) => [{ type: 'Reports', id: `COMPARISON_${id}` }],
    }),
    getBalanceSheetStats: builder.query({
      query: (params) => ({
        url: 'balance-sheets/stats',
        method: 'get',
        params,
      }),
      transformResponse: (response) => {
        // Backend returns stats object directly
        // Normalize to { data: stats }
        if (response.total !== undefined || response.byStatus || response.latestStatementDate) {
          return {
            data: response
          };
        }
        // If already in expected format, return as is
        return response;
      },
      providesTags: [{ type: 'Reports', id: 'BALANCE_SHEETS_STATS' }],
    }),
    getLatestBalanceSheet: builder.query({
      query: (params) => ({
        url: 'balance-sheets/latest',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'BALANCE_SHEETS_LATEST' }],
    }),
    addAuditEntry: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `balance-sheets/${id}/audit`,
        method: 'post',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Reports', id }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGenerateBalanceSheetMutation,
  useGetBalanceSheetsQuery,
  useGetBalanceSheetQuery,
  useUpdateBalanceSheetMutation,
  useUpdateBalanceSheetStatusMutation,
  useDeleteBalanceSheetMutation,
  useGetComparisonQuery,
  useGetBalanceSheetStatsQuery,
  useGetLatestBalanceSheetQuery,
  useAddAuditEntryMutation,
} = balanceSheetsApi;

