import { api } from '../api';

export const balanceSheetsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLatestBalanceSheet: builder.query({
      query: (params) => ({
        url: 'balance-sheets/latest',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Reports', id: 'BALANCE_SHEETS_LATEST' }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetLatestBalanceSheetQuery } = balanceSheetsApi;
