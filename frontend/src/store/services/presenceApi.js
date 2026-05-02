import { api } from '../api';

export const presenceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getOnlineUsers: builder.query({
      query: () => ({
        url: 'presence/online',
        method: 'get',
      }),
      providesTags: [{ type: 'Presence', id: 'LIST' }],
    }),
    presenceHeartbeat: builder.mutation({
      query: (body) => ({
        url: 'presence/heartbeat',
        method: 'post',
        data: body || {},
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useGetOnlineUsersQuery, usePresenceHeartbeatMutation } = presenceApi;
