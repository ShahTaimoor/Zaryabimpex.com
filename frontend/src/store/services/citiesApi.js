import { api } from '../api';

export const citiesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCities: builder.query({
      query: (params) => ({
        url: 'cities',
        method: 'get',
        params,
      }),
      providesTags: [{ type: 'Cities', id: 'LIST' }],
    }),
    getCity: builder.query({
      query: (id) => ({
        url: `cities/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Cities', id }],
    }),
    createCity: builder.mutation({
      query: (data) => ({
        url: 'cities',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Cities', id: 'LIST' },
        { type: 'Cities', id: 'ACTIVE' },
      ],
    }),
    updateCity: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `cities/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Cities', id },
        { type: 'Cities', id: 'LIST' },
        { type: 'Cities', id: 'ACTIVE' },
      ],
    }),
    deleteCity: builder.mutation({
      query: (id) => ({
        url: `cities/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Cities', id },
        { type: 'Cities', id: 'LIST' },
        { type: 'Cities', id: 'ACTIVE' },
      ],
    }),
    getActiveCities: builder.query({
      query: () => ({
        url: 'cities/active',
        method: 'get',
      }),
      providesTags: [{ type: 'Cities', id: 'ACTIVE' }],
    }),
    exportCities: builder.mutation({
      query: (filters) => ({
        url: 'cities/export/excel',
        method: 'post',
        data: { filters },
      }),
    }),
    importCities: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: 'cities/import/excel',
          method: 'post',
          data: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        };
      },
      invalidatesTags: [
        { type: 'Cities', id: 'LIST' },
        { type: 'Cities', id: 'ACTIVE' },
      ],
    }),
    downloadCityTemplate: builder.query({
      query: () => ({
        url: 'cities/template/excel',
        method: 'get',
        responseType: 'blob',
      }),
    }),
    downloadCityExportFile: builder.query({
      query: (filename) => ({
        url: `cities/download/${filename}`,
        method: 'get',
        responseType: 'blob',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCitiesQuery,
  useGetCityQuery,
  useCreateCityMutation,
  useUpdateCityMutation,
  useDeleteCityMutation,
  useGetActiveCitiesQuery,
  useExportCitiesMutation,
  useImportCitiesMutation,
  useDownloadCityTemplateQuery,
  useLazyDownloadCityExportFileQuery,
} = citiesApi;

