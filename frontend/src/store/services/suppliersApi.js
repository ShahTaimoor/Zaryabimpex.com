import { api } from '../api';

export const suppliersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSuppliers: builder.query({
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
          url: 'suppliers',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: (result) =>
        result?.data?.suppliers
          ? [
              ...result.data.suppliers.map(({ _id, id }) => ({
                type: 'Suppliers',
                id: _id || id,
              })),
              { type: 'Suppliers', id: 'LIST' },
            ]
          : [{ type: 'Suppliers', id: 'LIST' }],
    }),
    createSupplier: builder.mutation({
      query: (data) => ({
        url: 'suppliers',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Suppliers', id: 'LIST' }],
    }),
    updateSupplier: builder.mutation({
      query: ({ id, data }) => ({
        url: `suppliers/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Suppliers', id },
        { type: 'Suppliers', id: 'LIST' },
      ],
    }),
    deleteSupplier: builder.mutation({
      query: (id) => ({
        url: `suppliers/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Suppliers', id },
        { type: 'Suppliers', id: 'LIST' },
      ],
    }),
    checkEmail: builder.query({
      query: ({ email, excludeId }) => ({
        url: `suppliers/check-email/${encodeURIComponent(email)}`,
        method: 'get',
        params: excludeId ? { excludeId } : undefined,
      }),
    }),
    checkCompanyName: builder.query({
      query: ({ companyName, excludeId }) => ({
        url: `suppliers/check-company-name/${encodeURIComponent(companyName)}`,
        method: 'get',
        params: excludeId ? { excludeId } : undefined,
      }),
    }),
    checkContactName: builder.query({
      query: ({ contactName, excludeId }) => ({
        url: `suppliers/check-contact-name/${encodeURIComponent(contactName)}`,
        method: 'get',
        params: excludeId ? { excludeId } : undefined,
      }),
    }),
    getActiveSuppliers: builder.query({
      query: () => ({
        url: 'suppliers/active/list',
        method: 'get',
      }),
      providesTags: [{ type: 'Suppliers', id: 'ACTIVE' }],
    }),
    getSupplier: builder.query({
      query: (id) => ({
        url: `suppliers/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Suppliers', id }],
    }),
    searchSuppliers: builder.query({
      query: (searchTerm) => ({
        url: `suppliers/search/${encodeURIComponent(searchTerm)}`,
        method: 'get',
      }),
      providesTags: [{ type: 'Suppliers', id: 'SEARCH' }],
    }),
    exportExcel: builder.mutation({
      query: (params) => ({
        url: 'suppliers/export/excel',
        method: 'post',
        data: params,
      }),
    }),
    importExcel: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: 'suppliers/import/excel',
          method: 'post',
          data: formData,
        };
      },
      invalidatesTags: [{ type: 'Suppliers', id: 'LIST' }],
    }),
    downloadTemplate: builder.query({
      query: () => ({
        url: 'suppliers/export/template',
        method: 'get',
        responseType: 'blob',
      }),
    }),
    downloadExportFile: builder.query({
      query: (filename) => ({
        url: `suppliers/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useLazyCheckEmailQuery,
  useLazyCheckCompanyNameQuery,
  useLazyCheckContactNameQuery,
  useGetActiveSuppliersQuery,
  useGetSupplierQuery,
  useLazyGetSupplierQuery,
  useSearchSuppliersQuery,
  useLazySearchSuppliersQuery,
  useExportExcelMutation,
  useImportExcelMutation,
  useDownloadTemplateQuery,
  useLazyDownloadExportFileQuery,
} = suppliersApi;

