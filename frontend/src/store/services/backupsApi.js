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
      invalidatesTags: [
        { type: 'Settings', id: 'BACKUPS_LIST' },
        { type: 'Settings', id: 'BACKUP_STATS' },
        { type: 'Sales', id: 'LIST' },
        { type: 'Sales', id: 'TODAY_SUMMARY' },
        { type: 'Sales', id: 'PERIOD_SUMMARY' },
        { type: 'Orders', id: 'LIST' },
        { type: 'Orders', id: 'PO_LIST' },
        { type: 'Orders', id: 'PI_LIST' },
        { type: 'Products', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
        { type: 'Inventory', id: 'SUMMARY' },
        { type: 'Inventory', id: 'LOW_STOCK' },
        { type: 'Customers', id: 'LIST' },
        { type: 'Suppliers', id: 'LIST' },
        { type: 'Accounting', id: 'LEDGER_SUMMARY' },
        { type: 'Accounting', id: 'LEDGER_ENTRIES' },
        { type: 'Accounting', id: 'ALL_ENTRIES' },
        { type: 'Accounting', id: 'TRIAL_BALANCE' },
        { type: 'ChartOfAccounts', id: 'LIST' },
        { type: 'ChartOfAccounts', id: 'STATS' },
        { type: 'CashReceipts', id: 'LIST' },
        { type: 'BankReceipts', id: 'LIST' },
        { type: 'CashPayments', id: 'LIST' },
        { type: 'BankPayments', id: 'LIST' },
        { type: 'Returns', id: 'LIST' },
        { type: 'SaleReturns', id: 'LIST' },
        { type: 'PurchaseReturns', id: 'LIST' },
        { type: 'StockLedger', id: 'LIST' },
        { type: 'Reports', id: 'PL_STATEMENTS_SUMMARY' },
        { type: 'Reports', id: 'PARTY_BALANCE' },
        { type: 'Reports', id: 'BANK_CASH_SUMMARY' },
        { type: 'Reports', id: 'FINANCIAL_REPORT' },
        { type: 'Reports', id: 'SALES_REPORT' },
        { type: 'Reports', id: 'PRODUCT_REPORT' },
        { type: 'Reports', id: 'CUSTOMER_REPORT' },
        { type: 'Reports', id: 'INVENTORY_REPORT' },
        { type: 'Reports', id: 'PURCHASE_BY_SUPPLIER' },
        { type: 'Reports', id: 'SUMMARY_CARDS' },
      ],
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
      invalidatesTags: [
        { type: 'Settings', id: 'BACKUPS_LIST' },
        { type: 'Settings', id: 'BACKUP_STATS' },
      ],
    }),
    verifyBackup: builder.mutation({
      query: (backupId) => ({
        url: `backups/${backupId}/verify`,
        method: 'post',
      }),
      invalidatesTags: [
        { type: 'Settings', id: 'BACKUPS_LIST' },
        { type: 'Settings', id: 'BACKUP_STATS' },
      ],
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
      invalidatesTags: [
        { type: 'Settings', id: 'BACKUPS_LIST' },
        { type: 'Settings', id: 'BACKUP_STATS' },
      ],
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

