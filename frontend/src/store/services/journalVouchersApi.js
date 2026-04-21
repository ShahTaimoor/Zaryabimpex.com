import { api } from '../api';

const JV_TAGS = [
  { type: 'JournalVouchers', id: 'LIST' },
  { type: 'Accounting' },
  { type: 'Accounting', id: 'LEDGER_SUMMARY' },
  { type: 'Accounting', id: 'LEDGER_ENTRIES' },
  { type: 'Accounting', id: 'ALL_ENTRIES' },
  { type: 'Accounting', id: 'TRIAL_BALANCE' },
  { type: 'ChartOfAccounts', id: 'LIST' },
  { type: 'ChartOfAccounts', id: 'STATS' },
  { type: 'ChartOfAccounts', id: 'HIERARCHY' },
  { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
  { type: 'Reports', id: 'PARTY_BALANCE' },
  { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
  { type: 'Reports', id: 'SUMMARY_CARDS' },
  { type: 'Reports', id: 'FINANCIAL_REPORT' },
];

export const journalVouchersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getJournalVouchers: builder.query({
      query: (params) => ({
        url: 'journal-vouchers',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.vouchers || result?.vouchers
          ? [
            ...(result.data?.vouchers || result.vouchers).map(({ _id, id }) => ({
              type: 'JournalVouchers',
              id: _id || id,
            })),
            { type: 'JournalVouchers', id: 'LIST' },
          ]
          : [{ type: 'JournalVouchers', id: 'LIST' }],
    }),

    getJournalVoucher: builder.query({
      query: (id) => ({
        url: `journal-vouchers/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'JournalVouchers', id }],
    }),

    createJournalVoucher: builder.mutation({
      query: (data) => ({
        url: 'journal-vouchers',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        ...JV_TAGS,
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
      ],
    }),

    updateJournalVoucher: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `journal-vouchers/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'JournalVouchers', id },
        ...JV_TAGS,
      ],
    }),

    postJournalVoucher: builder.mutation({
      query: (id) => ({
        url: `journal-vouchers/${id}/post`,
        method: 'post',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'JournalVouchers', id },
        ...JV_TAGS,
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
      ],
    }),

    reverseJournalVoucher: builder.mutation({
      query: ({ id, reason }) => ({
        url: `journal-vouchers/${id}/reverse`,
        method: 'post',
        data: { reason },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'JournalVouchers', id },
        ...JV_TAGS,
      ],
    }),

    deleteJournalVoucher: builder.mutation({
      query: (id) => ({
        url: `journal-vouchers/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'JournalVouchers', id },
        ...JV_TAGS,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetJournalVouchersQuery,
  useGetJournalVoucherQuery,
  useCreateJournalVoucherMutation,
  useUpdateJournalVoucherMutation,
  usePostJournalVoucherMutation,
  useReverseJournalVoucherMutation,
  useDeleteJournalVoucherMutation,
} = journalVouchersApi;
