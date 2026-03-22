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
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    updateCategory: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `categories/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Categories', id },
        { type: 'Categories', id: 'LIST' },
        { type: 'Categories', id: 'TREE' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    deleteCategory: builder.mutation({
      query: (id) => ({
        url: `categories/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Categories', id },
        { type: 'Categories', id: 'LIST' },
        { type: 'Categories', id: 'TREE' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    exportCategories: builder.mutation({
      query: (filters) => ({
        url: 'categories/export/excel',
        method: 'post',
        data: { filters },
      }),
    }),
    importCategories: builder.mutation({
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
      invalidatesTags: [
        { type: 'Categories', id: 'LIST' },
        { type: 'Categories', id: 'TREE' },
        { type: 'Products', id: 'LIST' },
        { type: 'Products', id: 'SEARCH' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
    }),
    downloadCategoryTemplate: builder.query({
      query: () => ({
        url: 'categories/template/excel',
        method: 'get',
        responseType: 'blob',
      }),
      providesTags: [{ type: 'Categories', id: 'TEMPLATE' }],
    }),
    downloadCategoryExportFile: builder.query({
      query: (filename) => ({
        url: `categories/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
      providesTags: [{ type: 'Categories', id: 'EXPORT' }],
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
  useExportCategoriesMutation,
  useImportCategoriesMutation,
  useDownloadCategoryTemplateQuery,
  useLazyDownloadCategoryExportFileQuery,
} = categoriesApi;

