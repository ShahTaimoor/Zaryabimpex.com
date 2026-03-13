import { api } from '../api';

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query({
      query: (params) => ({
        url: 'auth/users',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.data?.users || result?.users
          ? [
              ...(result.data?.users || result.users).map(({ _id, id }) => ({
                type: 'Users',
                id: _id || id,
              })),
              { type: 'Users', id: 'LIST' },
            ]
          : [{ type: 'Users', id: 'LIST' }],
    }),
    getUser: builder.query({
      query: (id) => ({
        url: `auth/users/${id}`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Users', id }],
    }),
    createUser: builder.mutation({
      query: (data) => ({
        url: 'auth/register',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),
    updateUser: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `auth/users/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Users', id },
        { type: 'Users', id: 'LIST' },
      ],
    }),
    deleteUser: builder.mutation({
      query: (id) => ({
        url: `auth/users/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Users', id },
        { type: 'Users', id: 'LIST' },
      ],
    }),
    toggleUserStatus: builder.mutation({
      query: (id) => ({
        url: `auth/users/${id}/toggle-status`,
        method: 'patch',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Users', id },
        { type: 'Users', id: 'LIST' },
      ],
    }),
    resetPassword: builder.mutation({
      query: ({ id, newPassword }) => ({
        url: `auth/users/${id}/reset-password`,
        method: 'patch',
        data: { newPassword },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Users', id }],
    }),
    updateRolePermissions: builder.mutation({
      query: ({ role, permissions }) => ({
        url: 'auth/users/update-role-permissions',
        method: 'patch',
        data: { role, permissions },
      }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),
    getUserActivity: builder.query({
      query: (id) => ({
        url: `auth/users/${id}/activity`,
        method: 'get',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Users', id: `ACTIVITY_${id}` }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useToggleUserStatusMutation,
  useResetPasswordMutation,
  useUpdateRolePermissionsMutation,
  useGetUserActivityQuery,
} = usersApi;

