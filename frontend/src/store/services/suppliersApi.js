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
      invalidatesTags: [
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Suppliers', id: 'ACTIVE' },
        { type: 'Suppliers', id: 'SEARCH' },
        { type: 'Suppliers', id: 'CHECK' },
        { type: 'Accounting' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
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
        { type: 'Suppliers', id: 'ACTIVE' },
        { type: 'Suppliers', id: 'SEARCH' },
        { type: 'Suppliers', id: 'CHECK' },
        { type: 'Accounting' },
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
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
        { type: 'Suppliers', id: 'ACTIVE' },
        { type: 'Suppliers', id: 'SEARCH' },
        { type: 'Suppliers', id: 'CHECK' },
        { type: 'Accounting' },
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
      ],
    }),
    checkEmail: builder.query({
      query: ({ email, excludeId }) => ({
        url: `suppliers/check-email/${encodeURIComponent(email)}`,
        method: 'get',
        params: excludeId ? { excludeId } : undefined,
      }),
      providesTags: [{ type: 'Suppliers', id: 'CHECK' }],
    }),
    checkCompanyName: builder.query({
      query: ({ companyName, excludeId }) => ({
        url: `suppliers/check-company-name/${encodeURIComponent(companyName)}`,
        method: 'get',
        params: excludeId ? { excludeId } : undefined,
      }),
      providesTags: [{ type: 'Suppliers', id: 'CHECK' }],
    }),
    checkContactName: builder.query({
      query: ({ contactName, excludeId }) => ({
        url: `suppliers/check-contact-name/${encodeURIComponent(contactName)}`,
        method: 'get',
        params: excludeId ? { excludeId } : undefined,
      }),
      providesTags: [{ type: 'Suppliers', id: 'CHECK' }],
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
      invalidatesTags: [
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Suppliers', id: 'ACTIVE' },
        { type: 'Suppliers', id: 'SEARCH' },
        { type: 'Suppliers', id: 'CHECK' },
        { type: 'Accounting' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
      ],
    }),
    downloadTemplate: builder.query({
      query: () => ({
        url: 'suppliers/export/template',
        method: 'get',
        responseType: 'blob',
      }),
      providesTags: [{ type: 'Suppliers', id: 'TEMPLATE' }],
    }),
    downloadExportFile: builder.query({
      query: (filename) => ({
        url: `suppliers/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
      providesTags: [{ type: 'Suppliers', id: 'EXPORT' }],
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

