import { api } from '../api';

export const notesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getNotes: builder.query({
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
          url: 'notes',
          method: 'get',
          params: filteredParams,
        };
      },
      providesTags: (result) => {
        const list = result?.data?.notes || result?.notes || result?.items || [];
        return list.length
          ? [
              ...list.map(({ _id, id }) => ({ type: 'Settings', id: _id || id })),
              { type: 'Settings', id: 'NOTES_LIST' },
            ]
          : [{ type: 'Settings', id: 'NOTES_LIST' }];
      },
    }),
    getNote: builder.query({
      query: (id) => ({
        url: `notes/${id}`,
        method: 'get',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Settings', id }],
    }),
    createNote: builder.mutation({
      query: (data) => ({
        url: 'notes',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Settings', id: 'NOTES_LIST' }],
    }),
    updateNote: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `notes/${id}`,
        method: 'put',
        data,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Settings', id },
        { type: 'Settings', id: 'NOTES_LIST' },
      ],
    }),
    deleteNote: builder.mutation({
      query: (id) => ({
        url: `notes/${id}`,
        method: 'delete',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Settings', id },
        { type: 'Settings', id: 'NOTES_LIST' },
      ],
    }),
    getNoteHistory: builder.query({
      query: (id) => ({
        url: `notes/${id}/history`,
        method: 'get',
      }),
    }),
    searchUsers: builder.query({
      query: (query) => ({
        url: 'notes/search/users',
        method: 'get',
        params: { q: query },
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetNotesQuery,
  useLazyGetNotesQuery,
  useGetNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useGetNoteHistoryQuery,
  useSearchUsersQuery,
  useLazySearchUsersQuery,
} = notesApi;

