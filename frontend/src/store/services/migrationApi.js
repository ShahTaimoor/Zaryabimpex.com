import { api } from '../api';

export const migrationApi = api.injectEndpoints({
  endpoints: (builder) => ({
    updateInvoicePrefix: builder.mutation({
      query: () => ({
        url: 'migration/update-invoice-prefix',
        method: 'post',
      }),
      invalidatesTags: [
        { type: 'Sales', id: 'LIST' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Settings', id: 'COMPANY' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useUpdateInvoicePrefixMutation,
} = migrationApi;

