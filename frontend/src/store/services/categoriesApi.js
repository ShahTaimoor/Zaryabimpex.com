import { api } from '../api';

export const categoriesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCategories: builder.query({
      query: (params) => ({
        url: 'categories',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Categories', id: 'LIST' }],
    }),
    getCategoryTree: builder.query({
      query: () => ({
        url: 'categories/tree',
        method: 'get',
      }),
      providesTags: [{ type: 'Categories', id: 'TREE' }],
    }),
    createCategory: builder.mutation({
      query: (data) => ({
        url: 'categories',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Categories', id: 'LIST' },
        { type: 'Categories', id: 'TREE' },
      ],
    }),
    updateCategory: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `categories/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: [
        { type: 'Categories', id: 'LIST' },
        { type: 'Categories', id: 'TREE' },
      ],
    }),
    deleteCategory: builder.mutation({
      query: (id) => ({
        url: `categories/${id}`,
        method: 'delete',
      }),
      invalidatesTags: [
        { type: 'Categories', id: 'LIST' },
        { type: 'Categories', id: 'TREE' },
      ],
    }),
    exportCategoriesCSV: builder.mutation({
      query: (params) => ({
        url: 'categories/export/csv',
        method: 'get',
        params,
        responseType: 'blob',
      }),
    }),
    exportCategoriesExcel: builder.mutation({
      query: (params) => ({
        url: 'categories/export/excel',
        method: 'get',
        params,
        responseType: 'blob',
      }),
    }),
    importCategoriesCSV: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: 'categories/import/csv',
          method: 'post',
          data: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        };
      },
      invalidatesTags: [{ type: 'Categories', id: 'LIST' }, { type: 'Categories', id: 'TREE' }],
    }),
    importCategoriesExcel: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: 'categories/import/excel',
          method: 'post',
          data: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        };
      },
      invalidatesTags: [{ type: 'Categories', id: 'LIST' }, { type: 'Categories', id: 'TREE' }],
    }),
    downloadCategoryTemplate: builder.query({
      query: () => ({
        url: 'categories/import/template',
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCategoriesQuery,
  useGetCategoryTreeQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useExportCategoriesCSVMutation,
  useExportCategoriesExcelMutation,
  useImportCategoriesCSVMutation,
  useImportCategoriesExcelMutation,
  useLazyDownloadCategoryTemplateQuery,
} = categoriesApi;

