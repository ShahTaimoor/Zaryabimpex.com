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
      invalidatesTags: [
        { type: 'Customers', id: 'LIST' },
        { type: 'Customers', id: 'BY_CITIES' },
        { type: 'Customers', id: 'SEARCH' },
        { type: 'Customers', id: 'CHECK' },
        { type: 'Accounting' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_ANALYTICS' },
        { type: 'Reports', id: 'CUSTOMER_ANALYTICS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
      ],
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
        { type: 'Customers', id: 'BY_CITIES' },
        { type: 'Customers', id: 'SEARCH' },
        { type: 'Customers', id: 'CHECK' },
        { type: 'Accounting' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_ANALYTICS' },
        { type: 'Reports', id: 'CUSTOMER_ANALYTICS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'SALES_REPORT' },
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
        { type: 'Customers', id: 'BY_CITIES' },
        { type: 'Customers', id: 'SEARCH' },
        { type: 'Customers', id: 'CHECK' },
        { type: 'Accounting' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_ANALYTICS' },
        { type: 'Reports', id: 'CUSTOMER_ANALYTICS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'SALES_REPORT' },
      ],
    }),
    searchCustomers: builder.query({
      query: (query) => ({
        url: `customers/search/${encodeURIComponent(query)}`,
        method: 'get',
      }),
      providesTags: [{ type: 'Customers', id: 'SEARCH' }],
    }),
    checkEmail: builder.query({
      query: ({ email, excludeId }) => ({
        url: `customers/check-email/${encodeURIComponent(email)}`,
        method: 'get',
        params: excludeId ? { excludeId } : undefined,
      }),
      providesTags: [{ type: 'Customers', id: 'CHECK' }],
    }),
    checkBusinessName: builder.query({
      query: ({ businessName, excludeId }) => ({
        url: `customers/check-business-name/${encodeURIComponent(businessName)}`,
        method: 'get',
        params: excludeId ? { excludeId } : undefined,
      }),
      providesTags: [{ type: 'Customers', id: 'CHECK' }],
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
      providesTags: [{ type: 'Customers', id: 'BY_CITIES' }],
    }),
    exportExcel: builder.mutation({
      query: (params) => ({
        url: 'customers/export/excel',
        method: 'post',
        data: params,
      }),
    }),
    importExcelSheets: builder.mutation({
      query: (payload) => {
        const file = payload instanceof File ? payload : payload?.file;
        const formData = new FormData();
        if (file) formData.append('file', file);
        return {
          url: 'customers/import/excel/sheets',
          method: 'post',
          data: formData,
        };
      },
    }),
    downloadExportFile: builder.query({
      query: (filename) => ({
        url: `customers/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
      providesTags: [{ type: 'Customers', id: 'EXPORT' }],
    }),
    importExcel: builder.mutation({
      query: (payload) => {
        const file = payload instanceof File ? payload : payload?.file;
        const sheetName = payload instanceof File ? undefined : payload?.sheetName;
        const sheetIndex = payload instanceof File ? undefined : payload?.sheetIndex;
        const formData = new FormData();
        // Append text fields first so multer/busboy consistently exposes req.body.
        if (sheetName) formData.append('sheetName', sheetName);
        if (file) formData.append('file', file);
        return {
          url: 'customers/import/excel',
          method: 'post',
          params: {
            ...(sheetName ? { sheetName } : {}),
            ...(Number.isInteger(sheetIndex) ? { sheetIndex } : {}),
          },
          data: formData,
        };
      },
      invalidatesTags: [
        { type: 'Customers', id: 'LIST' },
        { type: 'Customers', id: 'BY_CITIES' },
        { type: 'Customers', id: 'SEARCH' },
        { type: 'Customers', id: 'CHECK' },
        { type: 'Accounting' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_ANALYTICS' },
        { type: 'Reports', id: 'CUSTOMER_ANALYTICS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
      ],
    }),
    downloadTemplate: builder.query({
      query: () => ({
        url: 'customers/template/excel',
        method: 'get',
        responseType: 'blob',
      }),
      providesTags: [{ type: 'Customers', id: 'TEMPLATE' }],
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
  useImportExcelSheetsMutation,
  useImportExcelMutation,
  useDownloadTemplateQuery,
  useLazyDownloadTemplateQuery,
  useLazyDownloadExportFileQuery,
} = customersApi;

