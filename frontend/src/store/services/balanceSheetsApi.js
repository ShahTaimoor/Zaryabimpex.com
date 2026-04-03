import { api } from '../api';

export const balanceSheetsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLatestBalanceSheet: builder.query({
      query: (params) => {
        const { asOfDate } = params || {};
        return {
          url: 'balance-sheets/latest',
          method: 'get',
          params: asOfDate != null && asOfDate !== '' ? { asOfDate } : {},
        };
      },
      // Always treat refetch as new data so the statement re-renders after ledger changes
      structuralSharing: false,
      providesTags: [{ type: 'Reports', id: 'BALANCE_SHEETS_LATEST' }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetLatestBalanceSheetQuery } = balanceSheetsApi;
