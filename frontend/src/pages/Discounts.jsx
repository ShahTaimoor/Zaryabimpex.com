import React, { useState } from 'react';
import { 
  RefreshCw, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  Trash2,
  ToggleLeft,
  ToggleRight,
  Percent,
  TrendingUp,
  Tag,
  Calendar,
  Users,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  TrendingDown,
  X
} from 'lucide-react';
import {
  useGetDiscountsQuery,
  useGetDiscountStatsQuery,
  useGetDiscountQuery,
  useToggleDiscountStatusMutation,
  useDeleteDiscountMutation,
} from '../store/services/discountsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/LoadingSpinner';
import CreateDiscountModal from '../components/CreateDiscountModal';
import DiscountDetailModal from '../components/DiscountDetailModal';
import DiscountFilters from '../components/DiscountFilters';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';

const Discounts = () => {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    type: '',
    isActive: '',
    search: '',
    validFrom: '',
    validUntil: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { confirmation, confirmDelete, handleConfirm, handleCancel } = useDeleteConfirmation();

  // Fetch discounts
  const { 
    data: discountsData, 
    isLoading: discountsLoading, 
    error: discountsError,
    refetch: refetchDiscounts
  } = useGetDiscountsQuery(filters, {
    keepPreviousData: true,
    onError: (error) => {
      handleApiError(error, 'Fetch Discounts');
    }
  });

  // Fetch discount statistics
  const { 
    data: statsData, 
    isLoading: statsLoading 
  } = useGetDiscountStatsQuery(
    {
      startDate: filters.validFrom,
      endDate: filters.validUntil
    },
    {
      skip: !filters.validFrom || !filters.validUntil,
    }
  );

  // Get selected discount details
  const { data: selectedDiscountData } = useGetDiscountQuery(selectedDiscount?._id, {
    skip: !selectedDiscount?._id,
  });

  // Mutations
  const [toggleDiscountStatus, { isLoading: toggling }] = useToggleDiscountStatusMutation();
  const [deleteDiscount, { isLoading: deleting }] = useDeleteDiscountMutation();

  React.useEffect(() => {
    if (selectedDiscountData?.data) {
      setSelectedDiscount(selectedDiscountData.data);
    }
  }, [selectedDiscountData]);

  React.useEffect(() => {
    if (discountsError) {
      handleApiError(discountsError, 'Failed to fetch discounts');
    }
  }, [discountsError]);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handleDiscountSelect = (discountId) => {
    setSelectedDiscount({ _id: discountId }); // Trigger query
    setShowDetailModal(true);
  };

  const handleToggleStatus = async (discountId) => {
    try {
      const response = await toggleDiscountStatus(discountId).unwrap();
      showSuccessToast(`Discount ${response.data?.discount?.isActive ? 'activated' : 'deactivated'} successfully`);
      refetchDiscounts();
    } catch (error) {
      handleApiError(error, 'Toggle Discount Status');
    }
  };

  const handleDelete = async (discountId) => {
    const discount = discounts.find(d => d._id === discountId);
    const discountName = discount?.name || 'this discount';
    confirmDelete(discountName, 'Discount', async () => {
      try {
        await deleteDiscount(discountId).unwrap();
        showSuccessToast('Discount deleted successfully');
        refetchDiscounts();
      } catch (error) {
        handleApiError(error, 'Delete Discount');
      }
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const discounts = discountsData?.data?.discounts || discountsData?.discounts || [];
  const pagination = discountsData?.data?.pagination || discountsData?.pagination || {};
  const stats = statsData?.data || {};

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8 bg-gray-50/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center">
            <div className="bg-primary-100 p-2 rounded-lg mr-4">
              <Tag className="h-7 w-7 text-primary-600" />
            </div>
            Discount Management
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Manage percentage and fixed amount discounts</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => refetchDiscounts()}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${discountsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-all shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Add Discount</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Discounts</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{stats.totalDiscounts || pagination.total || 0}</h3>
          <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">All discount codes</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Now</p>
          <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">
            {stats.activeDiscounts || discounts.filter(d => d.isActive && d.status === 'active').length}
          </h3>
          <div className="mt-2 text-[10px] font-bold text-emerald-500 uppercase tracking-tight">Currently active</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Usage</p>
          <h3 className="text-3xl font-black text-blue-600 tracking-tighter">{stats.totalUsage || 0}</h3>
          <div className="mt-2 text-[10px] font-bold text-blue-500 uppercase tracking-tight">Times redeemed</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Savings</p>
          <h3 className="text-3xl font-black text-purple-600 tracking-tighter">{formatCurrency(stats.totalDiscountAmount || 0)}</h3>
          <div className="mt-2 text-[10px] font-bold text-purple-500 uppercase tracking-tight">Customer savings</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, code or type..."
                value={filters.search}
                onChange={(e) => {
                  handleFilterChange({ search: e.target.value });
                  setFilters(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={filters.type}
                onChange={(e) => {
                  handleFilterChange({ type: e.target.value });
                  setFilters(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">All Types</option>
                <option value="percentage">Percentage</option>
                <option value="fixed_amount">Fixed Amount</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={filters.status}
                onChange={(e) => {
                  handleFilterChange({ status: e.target.value });
                  setFilters(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="scheduled">Scheduled</option>
                <option value="expired">Expired</option>
                <option value="exhausted">Exhausted</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-1 flex justify-end">
            <button 
              onClick={() => {
                handleFilterChange({ search: '', type: '', status: '' });
                setFilters(prev => ({ ...prev, page: 1 }));
              }}
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              title="Clear Filters"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Discounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {discountsLoading ? (
            <div className="py-20 text-center"><LoadingSpinner /></div>
          ) : discounts.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag className="h-8 w-8 text-slate-200" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No records found</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto mt-1">Try adjusting your search or filters to find what you're looking for.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Discount</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Type & Value</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Usage</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Valid Period</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Applicable To</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discounts.map((discount) => (
                  <tr key={discount._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary-100 border border-primary-200 flex items-center justify-center text-primary-600 font-bold uppercase tracking-tight">
                          <Tag className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{discount.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Code: {discount.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {discount.type === 'percentage' ? (
                          <Percent className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                        )}
                        <span className="text-sm font-bold text-slate-700">
                          {discount.type === 'percentage' ? `${discount.value}%` : formatCurrency(discount.value)}
                        </span>
                      </div>
                      {discount.maximumDiscount && discount.type === 'percentage' && (
                        <div className="text-xs font-medium text-slate-500 mt-1">
                          Max: {formatCurrency(discount.maximumDiscount)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-start">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            discount.status === 'active' && discount.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : discount.status === 'expired'
                              ? 'bg-rose-100 text-rose-700'
                              : discount.status === 'scheduled'
                              ? 'bg-amber-100 text-amber-700'
                              : discount.status === 'exhausted'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {discount.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-700">{discount.currentUsage || 0}</div>
                      {discount.usageLimit && (
                        <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                          / {discount.usageLimit} limit
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{formatDate(discount.validFrom)}</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                        Until {formatDate(discount.validUntil)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {discount.applicableTo === 'all' && <Users className="h-3.5 w-3.5 text-slate-400" />}
                        {discount.applicableTo === 'products' && <Package className="h-3.5 w-3.5 text-slate-400" />}
                        {discount.applicableTo === 'categories' && <Tag className="h-3.5 w-3.5 text-slate-400" />}
                        {discount.applicableTo === 'customers' && <Users className="h-3.5 w-3.5 text-slate-400" />}
                        <span className="text-sm font-bold text-slate-700 capitalize">{discount.applicableTo}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDiscountSelect(discount._id)}
                          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200 rounded-lg shadow-sm transition-all"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(discount._id)}
                          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-green-600 hover:border-green-200 rounded-lg shadow-sm transition-all"
                          title={discount.isActive ? 'Deactivate' : 'Activate'}
                          disabled={toggling}
                        >
                          {discount.isActive ? 
                            <ToggleRight className="h-4 w-4" /> : 
                            <ToggleLeft className="h-4 w-4" />
                          }
                        </button>
                        {discount.currentUsage === 0 && (
                          <button
                            onClick={() => handleDelete(discount._id)}
                            className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-lg shadow-sm transition-all"
                            title="Delete"
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
              Showing {((filters.page - 1) * (pagination.limit || 20)) + 1} - {Math.min(filters.page * (pagination.limit || 20), pagination.total)} of {pagination.total} records
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
        <CreateDiscountModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refetchDiscounts();
          }}
        />
      )}

      {showDetailModal && selectedDiscount && (
        <DiscountDetailModal
          discount={selectedDiscount}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedDiscount(null);
          }}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
          isLoading={false}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        itemName={confirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Discount"
        isLoading={deleting}
      />
    </div>
  );
};

export default Discounts;
