import { api } from '../api';

export const accountLedgerApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLedgerEntries: builder.query({
      query: (params) => ({
        url: 'account-ledger',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Accounting', id: 'LEDGER_ENTRIES' }],
    }),
    getAccountsList: builder.query({
      query: () => ({
        url: 'account-ledger/accounts',
        method: 'get',
      }),
      providesTags: [{ type: 'Accounting', id: 'ACCOUNTS_LIST' }],
    }),
    getAllEntries: builder.query({
      query: (params) => ({
        url: 'account-ledger/all-entries',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Accounting', id: 'ALL_ENTRIES' }],
    }),
    exportLedger: builder.mutation({
      query: (params) => ({
        url: 'account-ledger/all-entries',
        method: 'get',
        params,
        responseType: 'blob',
      }),
    }),
    getLedgerSummary: builder.query({
      query: (params) => ({
        url: 'account-ledger/summary',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Accounting', id: 'LEDGER_SUMMARY' }],
      keepUnusedDataFor: 0, // Don't keep unused data - always fetch fresh
    }),
    getCustomerDetailedTransactions: builder.query({
      query: ({ customerId, ...params }) => ({
        url: `account-ledger/customer/${customerId}/transactions`,
        method: 'get',
        params,
      }),
      providesTags: (result, error, { customerId }) => [
        { type: 'Accounting', id: `CUSTOMER_TRANSACTIONS_${customerId}` }
      ],
    }),
    getSupplierDetailedTransactions: builder.query({
      query: ({ supplierId, ...params }) => ({
        url: `account-ledger/supplier/${supplierId}/transactions`,
        method: 'get',
        params,
      }),
      providesTags: (result, error, { supplierId }) => [
        { type: 'Accounting', id: `SUPPLIER_TRANSACTIONS_${supplierId}` }
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetLedgerEntriesQuery,
  useGetAccountsListQuery,
  useGetAllEntriesQuery,
  useExportLedgerMutation,
  useGetLedgerSummaryQuery,
  useGetCustomerDetailedTransactionsQuery,
  useGetSupplierDetailedTransactionsQuery,
} = accountLedgerApi;

