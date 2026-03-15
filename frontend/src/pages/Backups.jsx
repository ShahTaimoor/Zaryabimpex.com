import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Play, 
  Pause, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Settings,
  FileText,
  Shield,
  Zap,
  Calendar,
  HardDrive
} from 'lucide-react';
import {
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
} from '../store/services/backupsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import { useResponsive, ResponsiveContainer, ResponsiveGrid } from '../components/ResponsiveContainer';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';

const BackupCard = ({ backup, onRestore, onDelete, onRetry, onVerify }) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [action, setAction] = useState(null);

  const getStatusIcon = () => {
    switch (backup.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Database className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (backup.status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const handleAction = (actionType, data = {}) => {
    setAction({ type: actionType, data });
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    switch (action.type) {
      case 'restore':
        onRestore(backup._id, action.data);
        break;
      case 'delete':
        onDelete(backup._id, action.data);
        break;
      case 'retry':
        onRetry(backup._id);
        break;
      case 'verify':
        onVerify(backup._id);
        break;
    }
    setShowConfirmDialog(false);
    setAction(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-medium text-gray-900">{backup.backupId}</h3>
            <p className="text-sm text-gray-500">
              {backup.type} • {backup.schedule}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
          {backup.status}
        </span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500">Size</p>
          <p className="font-medium">{formatBytes(backup.metadata?.compressedSize)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Duration</p>
          <p className="font-medium">{formatDuration(backup.metadata?.duration)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Collections</p>
          <p className="font-medium">{backup.collections?.length || 0}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Records</p>
          <p className="font-medium">{backup.metadata?.totalRecords?.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Features */}
      <div className="flex items-center space-x-2 mb-4">
        {backup.compression?.enabled && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Zap className="h-3 w-3 mr-1" />
            Compressed
          </span>
        )}
        {backup.encryption?.enabled && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Shield className="h-3 w-3 mr-1" />
            Encrypted
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex space-x-2">
        {backup.status === 'completed' && (
          <button
            onClick={() => handleAction('restore', { confirmRestore: true })}
            className="flex-1 btn btn-secondary btn-sm"
          >
            <Upload className="h-4 w-4 mr-1" />
            Restore
          </button>
        )}
        
        {backup.status === 'failed' && (
          <button
            onClick={() => handleAction('retry')}
            className="flex-1 btn btn-primary btn-sm"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </button>
        )}
        
        <button
          onClick={() => handleAction('verify')}
          className="btn btn-secondary btn-sm"
        >
          <Shield className="h-4 w-4" />
        </button>
        
        <button
          onClick={() => handleAction('delete', { confirmDelete: true })}
          className="btn btn-danger btn-sm"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Confirm Dialog */}
        <DeleteConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirm}
        title={`Confirm ${action?.type}`}
        message={
          action?.type === 'restore' 
            ? 'Are you sure you want to restore this backup? This will overwrite current data.'
            : action?.type === 'delete'
            ? 'Are you sure you want to delete this backup? This action cannot be undone.'
            : action?.type === 'retry'
            ? 'Are you sure you want to retry this failed backup?'
            : 'Are you sure you want to verify this backup?'
        }
        confirmText={action?.type === 'delete' ? 'Delete' : action?.type === 'restore' ? 'Restore' : 'Confirm'}
        confirmClass={action?.type === 'delete' ? 'btn-danger' : 'btn-primary'}
      />
    </div>
  );
};

const SchedulerStatus = ({ status, onStart, onStop, onTrigger }) => {
  const [triggerDialog, setTriggerDialog] = useState(false);
  const [triggerData, setTriggerData] = useState({ schedule: 'daily', type: 'full' });

  const handleTrigger = () => {
    onTrigger(triggerData);
    setTriggerDialog(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Backup Scheduler</h3>
        <div className="flex items-center space-x-2">
          {status.running ? (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Running
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <Pause className="h-3 w-3 mr-1" />
              Stopped
            </span>
          )}
        </div>
      </div>

      {/* Job Status */}
      <div className="space-y-2 mb-4">
        {Object.entries(status.jobs || {}).map(([name, job]) => (
          <div key={name} className="flex items-center justify-between">
            <span className="text-sm text-gray-600 capitalize">{name}</span>
            <div className="flex items-center space-x-2">
              {job.running ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Pause className="h-4 w-4 text-gray-400" />
              )}
              {job.nextRun && (
                <span className="text-xs text-gray-500">
                  Next: {new Date(job.nextRun).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex space-x-2">
        {status.running ? (
          <button
            onClick={onStop}
            className="btn btn-danger btn-sm"
          >
            <Pause className="h-4 w-4 mr-1" />
            Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            className="btn btn-primary btn-sm"
          >
            <Play className="h-4 w-4 mr-1" />
            Start
          </button>
        )}
        
        <button
          onClick={() => setTriggerDialog(true)}
          className="btn btn-secondary btn-sm"
        >
          <Zap className="h-4 w-4 mr-1" />
          Trigger
        </button>
      </div>

      {/* Trigger Dialog */}
        <DeleteConfirmationDialog
        isOpen={triggerDialog}
        onClose={() => setTriggerDialog(false)}
        onConfirm={handleTrigger}
        title="Trigger Backup"
        message="Select the backup schedule and type to trigger manually:"
        confirmText="Trigger"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Schedule
            </label>
            <select
              value={triggerData.schedule}
              onChange={(e) => setTriggerData({ ...triggerData, schedule: e.target.value })}
              className="input"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={triggerData.type}
              onChange={(e) => setTriggerData({ ...triggerData, type: e.target.value })}
              className="input"
            >
              <option value="full">Full</option>
              <option value="incremental">Incremental</option>
              <option value="differential">Differential</option>
            </select>
          </div>
        </div>
        </DeleteConfirmationDialog>
    </div>
  );
};

export const Backups = () => {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    type: '',
    schedule: '',
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createData, setCreateData] = useState({
    type: 'full',
    schedule: 'manual',
    compression: true,
    encryption: false,
  });

  const { isMobile } = useResponsive();

  // Fetch backups
  const { 
    data: backupsData, 
    isLoading: backupsLoading, 
    error: backupsError 
  } = useGetBackupsQuery(filters, {
    keepPreviousData: true,
  });

  React.useEffect(() => {
    if (backupsError) {
      handleApiError(backupsError, 'Backups');
    }
  }, [backupsError]);

  // Fetch backup stats
  const { 
    data: statsData, 
    isLoading: statsLoading 
  } = useGetBackupStatsQuery(30);

  React.useEffect(() => {
    if (statsData?.error) {
      handleApiError(statsData.error, 'Backup Stats');
    }
  }, [statsData?.error]);

  // Fetch scheduler status
  const { 
    data: schedulerStatus, 
    isLoading: schedulerLoading 
  } = useGetSchedulerStatusQuery(undefined, {
    pollingInterval: 30000, // Refresh every 30 seconds
  });

  React.useEffect(() => {
    if (schedulerStatus?.error) {
      handleApiError(schedulerStatus.error, 'Scheduler Status');
    }
  }, [schedulerStatus?.error]);

  // Mutations
  const [createBackup, { isLoading: creatingBackup }] = useCreateBackupMutation();
  const [restoreBackup, { isLoading: restoringBackup }] = useRestoreBackupMutation();
  const [deleteBackup, { isLoading: deletingBackup }] = useDeleteBackupMutation();
  const [retryBackup, { isLoading: retryingBackup }] = useRetryBackupMutation();
  const [verifyBackup, { isLoading: verifyingBackup }] = useVerifyBackupMutation();
  const [startScheduler, { isLoading: startingScheduler }] = useStartSchedulerMutation();
  const [stopScheduler, { isLoading: stoppingScheduler }] = useStopSchedulerMutation();
  const [triggerBackup, { isLoading: triggeringBackup }] = useTriggerBackupMutation();

  // Mutation handlers
  const handleCreateBackup = async (data) => {
    try {
      await createBackup(data).unwrap();
      showSuccessToast('Backup created successfully');
      setShowCreateDialog(false);
    } catch (error) {
      handleApiError(error, 'Create Backup');
    }
  };

  const handleRestoreBackup = async ({ backupId, data }) => {
    try {
      await restoreBackup({ backupId, data }).unwrap();
      showSuccessToast('Backup restored successfully');
    } catch (error) {
      handleApiError(error, 'Restore Backup');
    }
  };

  const handleDeleteBackup = async (backupId) => {
    try {
      await deleteBackup(backupId).unwrap();
      showSuccessToast('Backup deleted successfully');
    } catch (error) {
      handleApiError(error, 'Delete Backup');
    }
  };

  const handleRetryBackup = async (backupId) => {
    try {
      await retryBackup(backupId).unwrap();
      showSuccessToast('Backup retry initiated');
    } catch (error) {
      handleApiError(error, 'Retry Backup');
    }
  };

  const handleVerifyBackup = async (backupId) => {
    try {
      await verifyBackup(backupId).unwrap();
      showSuccessToast('Backup verification completed');
    } catch (error) {
      handleApiError(error, 'Verify Backup');
    }
  };

  const handleStartScheduler = async () => {
    try {
      await startScheduler().unwrap();
      showSuccessToast('Scheduler started successfully');
    } catch (error) {
      handleApiError(error, 'Start Scheduler');
    }
  };

  const handleStopScheduler = async () => {
    try {
      await stopScheduler().unwrap();
      showSuccessToast('Scheduler stopped successfully');
    } catch (error) {
      handleApiError(error, 'Stop Scheduler');
    }
  };

  const handleTriggerBackup = async (data) => {
    try {
      await triggerBackup(data).unwrap();
      showSuccessToast('Backup triggered successfully');
    } catch (error) {
      handleApiError(error, 'Trigger Backup');
    }
  };


  if (backupsError) {
    return (
      <ResponsiveContainer className="text-center py-8">
        <div className="text-red-500 mb-4">
          <AlertTriangle className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading backups</h3>
        <p className="text-gray-500 mb-4">{backupsError.message}</p>
        <button
          onClick={() => queryClient.invalidateQueries('backups')}
          className="btn btn-primary"
        >
          Try Again
        </button>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backup Management</h1>
          <p className="text-gray-600">Manage automated backups and restore data</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="btn btn-primary"
        >
          <Database className="h-5 w-5 mr-2" />
          Create Backup
        </button>
      </div>

      {/* Stats Cards */}
      {statsData && (
        <ResponsiveGrid cols={{ default: 1, md: 2, lg: 4 }} gap={4}>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Backups</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.totalBackups}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Successful</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.successfulBackups}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Failed</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.failedBackups}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <HardDrive className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Size</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsData.totalSize ? (statsData.totalSize / 1024 / 1024).toFixed(1) + ' MB' : '0 MB'}
                </p>
              </div>
            </div>
          </div>
        </ResponsiveGrid>
      )}

      {/* Scheduler Status */}
      {schedulerStatus && (
        <SchedulerStatus
          status={schedulerStatus}
          onStart={handleStartScheduler}
          onStop={handleStopScheduler}
          onTrigger={handleTrigger}
        />
      )}

      {/* Backups List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Backups</h3>
        </div>
        
        <div className="p-6">
          {backupsLoading ? (
            <LoadingGrid count={3} />
          ) : backupsData?.backups?.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No backups found</h3>
              <p className="text-gray-500 mb-4">Create your first backup to get started</p>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="btn btn-primary"
              >
                Create Backup
              </button>
            </div>
          ) : (
            <ResponsiveGrid cols={{ default: 1, md: 2, lg: 3 }} gap={4}>
              {backupsData?.backups?.map((backup) => (
                <BackupCard
                  key={backup._id}
                  backup={backup}
                  onRestore={handleRestore}
                  onDelete={handleDelete}
                  onRetry={handleRetry}
                  onVerify={handleVerify}
                />
              ))}
            </ResponsiveGrid>
          )}
        </div>
      </div>

      {/* Create Backup Dialog */}
        <DeleteConfirmationDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onConfirm={handleCreateBackup}
        title="Create New Backup"
        message="Configure your backup settings:"
        confirmText="Create Backup"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Backup Type
            </label>
            <select
              value={createData.type}
              onChange={(e) => setCreateData({ ...createData, type: e.target.value })}
              className="input"
            >
              <option value="full">Full Backup</option>
              <option value="incremental">Incremental</option>
              <option value="differential">Differential</option>
              <option value="schema_only">Schema Only</option>
              <option value="data_only">Data Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Schedule
            </label>
            <select
              value={createData.schedule}
              onChange={(e) => setCreateData({ ...createData, schedule: e.target.value })}
              className="input"
            >
              <option value="manual">Manual</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={createData.compression}
                onChange={(e) => setCreateData({ ...createData, compression: e.target.checked })}
                className="form-checkbox"
              />
              <span className="ml-2 text-sm text-gray-700">Compression</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={createData.encryption}
                onChange={(e) => setCreateData({ ...createData, encryption: e.target.checked })}
                className="form-checkbox"
              />
              <span className="ml-2 text-sm text-gray-700">Encryption</span>
            </label>
          </div>
        </div>
        </DeleteConfirmationDialog>
    </ResponsiveContainer>
  );
};
