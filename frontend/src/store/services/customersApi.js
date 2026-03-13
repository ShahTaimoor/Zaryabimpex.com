import { api } from '../api';

export const customersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCustomers: builder.query({
      query: (params) => {
        // Filter out empty string parameters
        const filteredParams = {};
        Object.keys(params || {}).forEach(key => {
          const value = params[key];
          // Only include non-empty values (skip empty strings, null, undefined)
          if (value !== '' && value !== null && value !== undefined) {
            filteredParams[key] = value;
          }
        });
        return {
          url: 'customers',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: (result) => {
        const list =
          result?.data?.customers ||
          result?.customers ||
          result?.items ||
          [];
        return list.length
          ? [
              ...list.map(({ _id, id }) => ({ type: 'Customers', id: _id || id })),
              { type: 'Customers', id: 'LIST' },
            ]
          : [{ type: 'Customers', id: 'LIST' }];
      },
    }),
    getCustomer: builder.query({
      query: (id) => ({
        url: `customers/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Customers', id }],
    }),
    createCustomer: builder.mutation({
      query: (data) => ({
        url: 'customers',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Customers', id: 'LIST' }],
    }),
    updateCustomer: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `customers/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Customers', id },
        { type: 'Customers', id: 'LIST' },
      ],
    }),
    deleteCustomer: builder.mutation({
      query: (id) => ({
        url: `customers/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Customers', id },
        { type: 'Customers', id: 'LIST' },
      ],
    }),
    searchCustomers: builder.query({
      query: (query) => ({
        url: `customers/search/${encodeURIComponent(query)}`,
        method: 'get',
      }),
    }),
    checkEmail: builder.query({
      query: ({ email, excludeId }) => ({
        url: `customers/check-email/${encodeURIComponent(email)}`,
        method: 'get',
        params: excludeId ? { excludeId } : undefined,
      }),
    }),
    checkBusinessName: builder.query({
      query: ({ businessName, excludeId }) => ({
        url: `customers/check-business-name/${encodeURIComponent(businessName)}`,
        method: 'get',
        params: excludeId ? { excludeId } : undefined,
      }),
    }),
    cities: builder.query({
      query: () => ({
        url: 'customers/cities',
        method: 'get',
      }),
      providesTags: [{ type: 'Customers', id: 'CITIES' }],
    }),
    getCustomersByCities: builder.query({
      query: (params) => ({
        url: 'customers/by-cities',
        method: 'get',
        params,
      }),
    }),
    exportExcel: builder.mutation({
      query: (params) => ({
        url: 'customers/export/excel',
        method: 'post',
        data: params,
      }),
    }),
    downloadExportFile: builder.query({
      query: (filename) => ({
        url: `customers/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
    }),
    importExcel: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: 'customers/import/excel',
          method: 'post',
          data: formData,
        };
      },
      invalidatesTags: [{ type: 'Customers', id: 'LIST' }],
    }),
    downloadTemplate: builder.query({
      query: () => ({
        url: 'customers/export/template',
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCustomersQuery,
  useGetCustomerQuery,
  useLazyGetCustomerQuery,
  useLazyGetCustomersQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useSearchCustomersQuery,
  useLazySearchCustomersQuery,
  useLazyCheckEmailQuery,
  useLazyCheckBusinessNameQuery,
  useCitiesQuery,
  useGetCustomersByCitiesQuery,
  useLazyGetCustomersByCitiesQuery,
  useExportExcelMutation,
  useImportExcelMutation,
  useDownloadTemplateQuery,
  useLazyDownloadExportFileQuery,
} = customersApi;

