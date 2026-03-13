import { api } from '../api';

export const companyApi = api.injectEndpoints({
  endpoints: (builder) => ({
    fetchCompany: builder.query({
      query: () => ({
        url: 'company',
        method: 'get',
      }),
      providesTags: [{ type: 'Company', id: 'SETTINGS' }],
    }),
    updateCompany: builder.mutation({
      query: (body) => ({
        url: 'company',
        method: 'put',
        data: body,
      }),
      invalidatesTags: [{ type: 'Company', id: 'SETTINGS' }],
    }),
    uploadCompanyLogo: builder.mutation({
      query: (formData) => ({
        url: 'company/logo',
        method: 'post',
        data: formData,
      }),
      invalidatesTags: [{ type: 'Company', id: 'SETTINGS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useFetchCompanyQuery,
  useUpdateCompanyMutation,
  useUploadCompanyLogoMutation,
} = companyApi;
