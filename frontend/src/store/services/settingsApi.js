import { api } from '../api';

export const settingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCompanySettings: builder.query({
      query: () => ({
        url: 'settings/company',
        method: 'get',
      }),
      providesTags: [{ type: 'Settings', id: 'COMPANY' }],
    }),
    updateCompanySettings: builder.mutation({
      query: (data) => ({
        url: 'settings/company',
        method: 'put',
        data,
      }),
      invalidatesTags: [{ type: 'Settings', id: 'COMPANY' }],
    }),
    getUserPreferences: builder.query({
      query: () => ({
        url: 'settings/preferences',
        method: 'get',
      }),
      providesTags: [{ type: 'Settings', id: 'PREFERENCES' }],
    }),
    updateUserPreferences: builder.mutation({
      query: (data) => ({
        url: 'settings/preferences',
        method: 'put',
        data,
      }),
      invalidatesTags: [{ type: 'Settings', id: 'PREFERENCES' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
  useGetUserPreferencesQuery,
  useUpdateUserPreferencesMutation,
} = settingsApi;

