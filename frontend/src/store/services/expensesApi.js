import { api } from '../api';

export const expensesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Recurring Expenses
    getRecurringExpenses: builder.query({
      query: (params) => ({
        url: 'recurring-expenses',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ _id, id }) => ({ type: 'RecurringExpenses', id: _id || id })),
              { type: 'RecurringExpenses', id: 'LIST' },
            ]
          : [{ type: 'RecurringExpenses', id: 'LIST' }],
    }),
    getUpcomingExpenses: builder.query({
      query: (params) => ({
        url: 'recurring-expenses/upcoming',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'RecurringExpenses', id: 'UPCOMING' }],
    }),
    createRecurringExpense: builder.mutation({
      query: (data) => ({
        url: 'recurring-expenses',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'RecurringExpenses', id: 'LIST' }, { type: 'RecurringExpenses', id: 'UPCOMING' }],
    }),
    updateRecurringExpense: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `recurring-expenses/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'RecurringExpenses', id },
        { type: 'RecurringExpenses', id: 'LIST' },
        { type: 'RecurringExpenses', id: 'UPCOMING' },
      ],
    }),
    deactivateRecurringExpense: builder.mutation({
      query: (id) => ({
        url: `recurring-expenses/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'RecurringExpenses', id },
        { type: 'RecurringExpenses', id: 'LIST' },
        { type: 'RecurringExpenses', id: 'UPCOMING' },
      ],
    }),
    recordPayment: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `recurring-expenses/${id}/record-payment`,
        method: 'post',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'RecurringExpenses', id },
        { type: 'RecurringExpenses', id: 'LIST' },
        { type: 'RecurringExpenses', id: 'UPCOMING' },
        { type: 'CashPayments', id: 'LIST' },
        { type: 'BankPayments', id: 'LIST' },
      ],
    }),
    snoozeRecurringExpense: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `recurring-expenses/${id}/snooze`,
        method: 'post',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'RecurringExpenses', id },
        { type: 'RecurringExpenses', id: 'LIST' },
        { type: 'RecurringExpenses', id: 'UPCOMING' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetRecurringExpensesQuery,
  useGetUpcomingExpensesQuery,
  useCreateRecurringExpenseMutation,
  useUpdateRecurringExpenseMutation,
  useDeactivateRecurringExpenseMutation,
  useRecordPaymentMutation,
  useSnoozeRecurringExpenseMutation,
} = expensesApi;

