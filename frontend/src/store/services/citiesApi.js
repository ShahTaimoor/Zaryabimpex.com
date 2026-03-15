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
} = citiesApi;

