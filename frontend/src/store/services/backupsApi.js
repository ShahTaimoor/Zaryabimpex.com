import { api } from '../api';

export const backupsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBackups: builder.query({
      query: (params) => ({
        url: 'backups',
        method: 'get',
        params,
      }),
      providesTags: (result) =>
        result?.backups
          ? [
              ...result.backups.map(({ _id, backupId }) => ({
                type: 'Settings',
                id: _id || backupId,
              })),
              { type: 'Settings', id: 'BACKUPS_LIST' },
            ]
          : [{ type: 'Settings', id: 'BACKUPS_LIST' }],
    }),
    getBackupStats: builder.query({
      query: (days) => ({
        url: 'backups/stats',
        method: 'get',
        params: { days },
      }),
      providesTags: [{ type: 'Settings', id: 'BACKUP_STATS' }],
    }),
    getSchedulerStatus: builder.query({
      query: () => ({
        url: 'backups/scheduler/status',
        method: 'get',
      }),
      providesTags: [{ type: 'Settings', id: 'SCHEDULER_STATUS' }],
    }),
    createBackup: builder.mutation({
      query: (data) => ({
        url: 'backups/create',
        method: 'post',
        data,
      }),
      invalidatesTags: [
        { type: 'Settings', id: 'BACKUPS_LIST' },
        { type: 'Settings', id: 'BACKUP_STATS' },
      ],
    }),
    restoreBackup: builder.mutation({
      query: ({ backupId, data }) => ({
        url: `backups/${backupId}/restore`,
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Settings', id: 'BACKUPS_LIST' }],
    }),
    deleteBackup: builder.mutation({
      query: (backupId) => ({
        url: `backups/${backupId}`,
        method: 'delete',
      }),
      invalidatesTags: [
        { type: 'Settings', id: 'BACKUPS_LIST' },
        { type: 'Settings', id: 'BACKUP_STATS' },
      ],
    }),
    retryBackup: builder.mutation({
      query: (backupId) => ({
        url: `backups/${backupId}/retry`,
        method: 'post',
      }),
      invalidatesTags: [{ type: 'Settings', id: 'BACKUPS_LIST' }],
    }),
    verifyBackup: builder.mutation({
      query: (backupId) => ({
        url: `backups/${backupId}/verify`,
        method: 'post',
      }),
      invalidatesTags: [{ type: 'Settings', id: 'BACKUPS_LIST' }],
    }),
    startScheduler: builder.mutation({
      query: () => ({
        url: 'backups/scheduler/start',
        method: 'post',
      }),
      invalidatesTags: [{ type: 'Settings', id: 'SCHEDULER_STATUS' }],
    }),
    stopScheduler: builder.mutation({
      query: () => ({
        url: 'backups/scheduler/stop',
        method: 'post',
      }),
      invalidatesTags: [{ type: 'Settings', id: 'SCHEDULER_STATUS' }],
    }),
    triggerBackup: builder.mutation({
      query: (data) => ({
        url: 'backups/scheduler/trigger',
        method: 'post',
        data,
      }),
      invalidatesTags: [{ type: 'Settings', id: 'BACKUPS_LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBackupsQuery,
  useGetBackupStatsQuery,
  useGetSchedulerStatusQuery,
  useCreateBackupMutation,
  useRestoreBackupMutation,
  useDeleteBackupMutation,
  useRetryBackupMutation,
  useVerifyBackupMutation,
  useStartSchedulerMutation,
  useStopSchedulerMutation,
  useTriggerBackupMutation,
} = backupsApi;

