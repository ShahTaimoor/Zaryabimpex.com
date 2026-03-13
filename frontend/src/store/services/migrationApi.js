import { api } from '../api';

export const migrationApi = api.injectEndpoints({
  endpoints: (builder) => ({
    updateInvoicePrefix: builder.mutation({
      query: () => ({
        url: 'migration/update-invoice-prefix',
        method: 'post',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useUpdateInvoicePrefixMutation,
} = migrationApi;

