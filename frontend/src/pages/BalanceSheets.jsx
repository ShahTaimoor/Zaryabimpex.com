import React, { useState } from 'react';
import {
  RefreshCw,
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  X
} from 'lucide-react';
import {
  useGetBalanceSheetsQuery,
  useGetBalanceSheetStatsQuery,
  useGetBalanceSheetQuery,
  useDeleteBalanceSheetMutation,
  useUpdateBalanceSheetStatusMutation,
} from '../store/services/balanceSheetsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingCard, LoadingTable } from '../components/LoadingSpinner';
import { useResponsive } from '../components/ResponsiveContainer';
import CreateBalanceSheetModal from '../components/CreateBalanceSheetModal';
import BalanceSheetDetailModal from '../components/BalanceSheetDetailModal';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';

const BalanceSheets = () => {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    periodType: '',
    search: '',
    startDate: '',
    endDate: ''
  });

  const [selectedBalanceSheet, setSelectedBalanceSheet] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { isMobile } = useResponsive();
  const { confirmation, confirmDelete, handleConfirm, handleCancel } = useDeleteConfirmation();

  // Fetch balance sheets
  const {
    data: balanceSheetsData,
    isLoading: balanceSheetsLoading,
    error: balanceSheetsError,
    refetch: refetchBalanceSheets
  } = useGetBalanceSheetsQuery(filters, {
    onError: (error) => {
      handleApiError(error, 'Fetch Balance Sheets');
    },
    keepPreviousData: true,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  // Fetch balance sheet statistics
  const {
    data: statsData,
    isLoading: statsLoading
  } = useGetBalanceSheetStatsQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate
    },
    {
      skip: !filters.startDate || !filters.endDate,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    }
  );

  // Get selected balance sheet details
  const { data: selectedBalanceSheetData } = useGetBalanceSheetQuery(
    selectedBalanceSheet?._id,
    {
      skip: !selectedBalanceSheet?._id,
    }
  );

  // Mutations
  const [deleteBalanceSheet] = useDeleteBalanceSheetMutation();
  const [updateBalanceSheetStatus] = useUpdateBalanceSheetStatusMutation();

  // Handlers
  const handleUpdateStatus = async (balanceSheetId, status, notes) => {
    try {
      await updateBalanceSheetStatus({ id: balanceSheetId, status, notes }).unwrap();
      showSuccessToast(`Balance sheet status updated to ${status}`);
      setShowDetailModal(false);
      setSelectedBalanceSheet(null);
      refetchBalanceSheets();
    } catch (error) {
      handleApiError(error, 'Update Balance Sheet Status');
    }
  };

  const handleDeleteBalanceSheet = async (balanceSheetId) => {
    try {
      await deleteBalanceSheet(balanceSheetId).unwrap();
      showSuccessToast('Balance sheet deleted successfully');
      refetchBalanceSheets();
    } catch (error) {
      handleApiError(error, 'Delete Balance Sheet');
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handleBalanceSheetSelect = (balanceSheetId) => {
    setSelectedBalanceSheet({ _id: balanceSheetId }); // Trigger query
    setShowDetailModal(true);
  };

  React.useEffect(() => {
    if (selectedBalanceSheetData?.data) {
      setSelectedBalanceSheet(selectedBalanceSheetData.data);
    }
  }, [selectedBalanceSheetData]);

  const handleStatusUpdate = (status, notes = '') => {
    if (!selectedBalanceSheet) return;
    handleUpdateStatus(selectedBalanceSheet._id, status, notes);
  };

  const handleDelete = (balanceSheet) => {
    const statementNumber = balanceSheet.statementNumber || 'Balance Sheet';
    confirmDelete(statementNumber, 'Balance Sheet', async () => {
      try {
        await handleDeleteBalanceSheet(balanceSheet._id);
      } catch (error) {
        // Error already handled in handleDeleteBalanceSheet
      }
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft':
        return <Edit className="h-4 w-4 text-slate-500" />;
      case 'review':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'final':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 text-slate-700';
      case 'review':
        return 'bg-amber-100 text-amber-700';
      case 'approved':
        return 'bg-emerald-100 text-emerald-700';
      case 'final':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getPeriodTypeColor = (periodType) => {
    switch (periodType) {
      case 'monthly':
        return 'bg-blue-100 text-blue-800';
      case 'quarterly':
        return 'bg-emerald-100 text-emerald-800';
      case 'yearly':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  if (balanceSheetsLoading && !balanceSheetsData) {
    return <LoadingSpinner message="Loading balance sheets..." />;
  }

  // Handle different response formats
  const balanceSheets = balanceSheetsData?.data?.balanceSheets || balanceSheetsData?.balanceSheets || [];
  const pagination = balanceSheetsData?.data?.pagination || balanceSheetsData?.pagination || {};
  const stats = statsData?.data || statsData || {};

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8 bg-gray-50/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center">
            <div className="bg-primary-100 p-2 rounded-lg mr-4">
              <BarChart3 className="h-7 w-7 text-primary-600" />
            </div>
            Balance Sheets
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Financial position and asset management</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => refetchBalanceSheets()}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${balanceSheetsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-all shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Generate Balance Sheet</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Statements</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{stats.total || pagination.total || 0}</h3>
          <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">All balance sheets</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Approved</p>
          <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">
            {stats.byStatus?.approved || balanceSheets.filter(bs => bs.status === 'approved').length || 0}
          </h3>
          <div className="mt-2 text-[10px] font-bold text-emerald-500 uppercase tracking-tight">Verified records</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Draft</p>
          <h3 className="text-3xl font-black text-amber-600 tracking-tighter">
            {stats.byStatus?.draft || balanceSheets.filter(bs => bs.status === 'draft').length || 0}
          </h3>
          <div className="mt-2 text-[10px] font-bold text-amber-500 uppercase tracking-tight">Pending review</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Final</p>
          <h3 className="text-3xl font-black text-blue-600 tracking-tighter">
            {stats.byStatus?.final || balanceSheets.filter(bs => bs.status === 'final').length || 0}
          </h3>
          <div className="mt-2 text-[10px] font-bold text-blue-500 uppercase tracking-tight">Completed reports</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by statement number..."
                value={filters.search}
                onChange={(e) => {
                  handleFilterChange({ search: e.target.value, page: 1 });
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={filters.status}
                onChange={(e) => {
                  handleFilterChange({ status: e.target.value, page: 1 });
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="approved">Approved</option>
                <option value="final">Final</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={filters.periodType}
                onChange={(e) => {
                  handleFilterChange({ periodType: e.target.value, page: 1 });
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">All Periods</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-2 flex justify-end">
            <button
              onClick={() => {
                handleFilterChange({
                  search: '',
                  status: '',
                  periodType: '',
                  startDate: '',
                  endDate: '',
                  page: 1
                });
              }}
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              title="Clear Filters"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Balance Sheets Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {balanceSheetsLoading ? (
            <div className="py-20 text-center"><LoadingSpinner /></div>
          ) : balanceSheets.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-slate-200" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No records found</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto mt-1">Try adjusting your search or filters to find what you're looking for.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Statement #</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Period</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Assets</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Equity</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balanceSheets.map((balanceSheet) => (
                  <tr key={balanceSheet._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold uppercase tracking-tight">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{balanceSheet.statementNumber}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            {balanceSheet.metadata?.generatedAt ? new Date(balanceSheet.metadata.generatedAt).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">
                          {balanceSheet.statementDate ? new Date(balanceSheet.statementDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getPeriodTypeColor(balanceSheet.periodType)}`}>
                        {balanceSheet.periodType || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(balanceSheet.status)}`}>
                          {getStatusIcon(balanceSheet.status)}
                          <span className="ml-1 capitalize">{balanceSheet.status}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">
                        {(balanceSheet.assets?.totalAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">
                        {(balanceSheet.equity?.totalEquity || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleBalanceSheetSelect(balanceSheet._id)}
                          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200 rounded-lg shadow-sm transition-all"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {balanceSheet.status === 'draft' && (
                          <button
                            onClick={() => handleDelete(balanceSheet)}
                            className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-lg shadow-sm transition-all"
                            title="Delete Record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Showing {((filters.page - 1) * filters.limit) + 1} - {Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total} records
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleFilterChange({ page: Math.max(1, filters.page - 1) })}
                disabled={filters.page === 1}
                className="px-4 py-1.5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
              >
                Previous
              </button>
              <button
                onClick={() => handleFilterChange({ page: Math.min(pagination.pages, filters.page + 1) })}
                disabled={filters.page === pagination.pages}
                className="px-4 py-1.5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateBalanceSheetModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refetchBalanceSheets();
          }}
        />
      )}

      {showDetailModal && selectedBalanceSheet && (
        <BalanceSheetDetailModal
          balanceSheet={selectedBalanceSheet}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedBalanceSheet(null);
          }}
          onStatusUpdate={handleStatusUpdate}
          isLoading={false}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={confirmation.isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={confirmation.title}
        message={confirmation.message}
      />
    </div>
  );
};

export default BalanceSheets;
