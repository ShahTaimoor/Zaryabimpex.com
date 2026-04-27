import { api } from '../api';

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: ({ email, password }) => ({
        url: 'auth/login', // Use standard login endpoint
        method: 'post',
        data: { email, password },
      }),
      invalidatesTags: [{ type: 'Auth', id: 'CURRENT_USER' }],
    }),
    requestTwoFactorCode: builder.mutation({
      query: ({ channel = 'email', email, phone }) => ({
        url: 'auth/request-2fa-code',
        method: 'post',
        data: { channel, email, phone },
      }),
      invalidatesTags: [{ type: 'Auth', id: 'CURRENT_USER' }],
    }),
    verifyTwoFactor: builder.mutation({
      query: ({ tempToken, code }) => ({
        url: 'auth/verify-2fa',
        method: 'post',
        data: { tempToken, code },
      }),
      invalidatesTags: [{ type: 'Auth', id: 'CURRENT_USER' }],
    }),
    currentUser: builder.query({
      query: () => ({ url: 'auth/me', method: 'get' }),
      providesTags: [{ type: 'Auth', id: 'CURRENT_USER' }],
    }),
    updateProfile: builder.mutation({
      query: (data) => ({
        url: 'auth/profile',
        method: 'put',
        data,
      }),
      invalidatesTags: [{ type: 'Auth', id: 'CURRENT_USER' }],
    }),
    changePassword: builder.mutation({
      query: ({ currentPassword, newPassword }) => ({
        url: 'auth/change-password',
        method: 'post',
        data: { currentPassword, newPassword },
      }),
      invalidatesTags: [{ type: 'Auth', id: 'CURRENT_USER' }],
    }),
    logout: builder.mutation({
      query: () => ({
        url: 'auth/logout',
        method: 'post',
      }),
      invalidatesTags: [{ type: 'Auth', id: 'CURRENT_USER' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useRequestTwoFactorCodeMutation,
  useVerifyTwoFactorMutation,
  useCurrentUserQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useLogoutMutation,
} = authApi;

