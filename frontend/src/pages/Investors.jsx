import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2,
  User,
  X,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  Eye,
  Calendar,
  Package,
  ExternalLink
} from 'lucide-react';
import { Checkbox } from '../components/Checkbox';
import {
  useGetInvestorsQuery,
  useCreateInvestorMutation,
  useUpdateInvestorMutation,
  useDeleteInvestorMutation,
  useRecordPayoutMutation,
  useRecordInvestmentMutation,
  useGetInvestorProductsQuery,
  useGetProfitSharesQuery,
} from '../store/services/investorsApi';
import toast from 'react-hot-toast';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage } from '../components/LoadingSpinner';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import { useTab } from '../contexts/TabContext';

const InvestorFormModal = ({ investor, onSave, onCancel, isSubmitting }) => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: investor || {
      name: '',
      email: '',
      phone: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      totalInvestment: 0,
      status: 'active',
      notes: ''
    }
  });

  const onSubmit = (data) => {
    onSave(data);
    reset();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {investor ? 'Edit Investor' : 'Add New Investor'}
            </h2>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Investor Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      {...register('name', { required: 'Investor name is required' })}
                      className="input pl-10"
                      placeholder="Enter investor name"
                    />
                  </div>
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        {...register('email', { 
                          required: 'Email is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Invalid email address'
                          }
                        })}
                        type="email"
                        className="input pl-10"
                        placeholder="Enter email address"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        {...register('phone')}
                        type="tel"
                        className="input pl-10"
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      {...register('address.street')}
                      className="input pl-10"
                      placeholder="Enter street address"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      {...register('address.city')}
                      className="input"
                      placeholder="Enter city"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State/Province
                    </label>
                    <input
                      {...register('address.state')}
                      className="input"
                      placeholder="Enter state"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Zip Code
                    </label>
                    <input
                      {...register('address.zipCode')}
                      className="input"
                      placeholder="Enter zip code"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <input
                      {...register('address.country')}
                      className="input"
                      placeholder="Enter country"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Investment Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Investment Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Investment ($)
                  </label>
                  <div className="relative">
                    <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      {...register('totalInvestment', { 
                        valueAsNumber: true,
                        min: { value: 0, message: 'Investment must be positive' }
                      })}
                      type="number"
                      step="0.01"
                      className="input pl-10"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.totalInvestment && (
                    <p className="text-red-500 text-sm mt-1">{errors.totalInvestment.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select {...register('status')} className="input">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="input"
                placeholder="Enter any additional notes"
              />
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary btn-md w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-md w-full sm:w-auto"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (investor ? 'Update Investor' : 'Add Investor')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const Investors = ({ tabId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [showProfitShares, setShowProfitShares] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(null);
  const [showInvestmentModal, setShowInvestmentModal] = useState(null);
  const [showProductsModal, setShowProductsModal] = useState(null);
  const { updateTabTitle } = useTab();

  const queryParams = { 
    search: searchTerm || undefined,
    status: statusFilter || undefined
  };

  const { data, isLoading, error } = useGetInvestorsQuery(queryParams, {
    keepPreviousData: true,
  });

  // Backend returns: { success: true, data: [investors] }
  const investors = useMemo(() => {
    const investorsList = data?.data?.investors || data?.data || data?.investors || data || [];
    return Array.isArray(investorsList) ? investorsList : [];
  }, [data]);

  const [createInvestor, { isLoading: creating }] = useCreateInvestorMutation();
  const [updateInvestor, { isLoading: updating }] = useUpdateInvestorMutation();
  const [deleteInvestor, { isLoading: deleting }] = useDeleteInvestorMutation();
  const [recordPayout, { isLoading: recordingPayout }] = useRecordPayoutMutation();
  const [recordInvestment, { isLoading: recordingInvestment }] = useRecordInvestmentMutation();

  const { confirmation, confirmDelete, handleConfirm, handleCancel } = useDeleteConfirmation();

  const handleEdit = (investor) => {
    setSelectedInvestor(investor);
    setIsModalOpen(true);
  };

  const handleDelete = async (investor) => {
    const investorName = investor.name || investor.email || 'Unknown Investor';
    confirmDelete(investorName, 'Investor', async () => {
      try {
        await deleteInvestor(investor._id).unwrap();
        toast.success('Investor deleted successfully');
      } catch (error) {
        toast.error(error?.data?.message || error?.message || 'Failed to delete investor');
      }
    });
  };

  const handleSave = async (data) => {
    try {
      if (selectedInvestor) {
        await updateInvestor({ id: selectedInvestor._id, ...data }).unwrap();
        toast.success('Investor updated successfully');
        setIsModalOpen(false);
        setSelectedInvestor(null);
      } else {
        await createInvestor(data).unwrap();
        toast.success('Investor created successfully');
        setIsModalOpen(false);
        setSelectedInvestor(null);
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to save investor');
    }
  };

  const handleViewProfitShares = (investor) => {
    setShowProfitShares(investor._id.toString());
  };

  const handleViewProducts = (investor) => {
    setShowProductsModal(investor);
  };

  const handlePayout = (investor) => {
    setShowPayoutModal(investor);
  };

  const handleInvestment = (investor) => {
    setShowInvestmentModal(investor);
  };

  if (isLoading) return <LoadingPage />;
  if (error) return <div className="p-6 text-red-600">Error loading investors: {error.message}</div>;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Investors</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage investors and track profit distributions</p>
        </div>
        <button
          onClick={() => {
            setSelectedInvestor(null);
            setIsModalOpen(true);
          }}
          className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Investor</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-[2] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search investors by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input flex-1 sm:w-auto min-w-[150px]"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Investors Table */}
      {investors.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No investors found</p>
        </div>
      ) : (
        <div className="card w-full">
          <div className="card-content p-0 w-full">
            {/* Table Header */}
            <div className="bg-gray-50 px-8 py-6 border-b border-gray-200">
              <div className="grid grid-cols-12 gap-6 items-center">
                <div className="col-span-3">
                  <h3 className="text-base font-medium text-gray-700">Investor Name</h3>
                  <p className="text-sm text-gray-500">Contact Information</p>
                </div>
                <div className="col-span-1">
                  <h3 className="text-base font-medium text-gray-700">Total Investment</h3>
                </div>
                <div className="col-span-1">
                  <h3 className="text-base font-medium text-gray-700">Earned Profit</h3>
                </div>
                <div className="col-span-1">
                  <h3 className="text-base font-medium text-gray-700">Paid Out</h3>
                </div>
                <div className="col-span-1">
                  <h3 className="text-base font-medium text-gray-700">Current Balance</h3>
                </div>
                <div className="col-span-1">
                  <h3 className="text-base font-medium text-gray-700">Status</h3>
                </div>
                <div className="col-span-4">
                  <h3 className="text-base font-medium text-gray-700">Actions</h3>
                </div>
              </div>
            </div>

            {/* Investor Rows */}
            <div className="divide-y divide-gray-200">
              {investors.map((investor) => (
                <div key={investor._id} className="px-8 py-6 hover:bg-gray-50">
                  <div className="grid grid-cols-12 gap-6 items-center">
                    {/* Investor Name & Contact */}
                    <div className="col-span-3">
                      <div className="flex items-center space-x-4">
                        <User className="h-6 w-6 text-gray-400" />
                        <div className="flex-1">
                          <h3 className="text-base font-medium text-gray-900">
                            {investor.name}
                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-600 mt-1">
                            <Mail className="h-3 w-3" />
                            <span>{investor.email}</span>
                          </div>
                          {investor.phone && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600 mt-1">
                              <Phone className="h-3 w-3" />
                              <span>{investor.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Total Investment */}
                    <div className="col-span-1">
                      <p className="text-sm text-gray-600">
                        ${(investor.totalInvestment || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Earned Profit */}
                    <div className="col-span-1">
                      <p className="text-sm font-semibold text-green-600">
                        ${(investor.totalEarnedProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Paid Out */}
                    <div className="col-span-1">
                      <p className="text-sm text-gray-600">
                        ${(investor.totalPaidOut || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Current Balance */}
                    <div className="col-span-1">
                      <p className="text-sm font-bold text-blue-600">
                        ${(investor.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      <span className={`badge ${
                        investor.status === 'active' ? 'badge-success' :
                        investor.status === 'inactive' ? 'badge-gray' :
                        'badge-danger'
                      }`}>
                        {investor.status}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-4">
                      <div className="flex items-center space-x-3 flex-wrap">
                        <button
                          onClick={() => handleViewProducts(investor)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Linked Products"
                        >
                          <Package className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleViewProfitShares(investor)}
                          className="text-green-600 hover:text-green-800"
                          title="View Profit Shares"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleInvestment(investor)}
                          className="text-green-600 hover:text-green-800"
                          title="Record Investment (Receive Money)"
                        >
                          <TrendingUp className="h-5 w-5" />
                        </button>
                        {investor.currentBalance > 0 && (
                          <button
                            onClick={() => handlePayout(investor)}
                            className="text-primary-600 hover:text-primary-800"
                            title="Record Payout (Pay Money)"
                          >
                            <TrendingUp className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(investor)}
                          className="text-primary-600 hover:text-primary-800"
                          title="Edit Investor"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(investor)}
                          className="text-danger-600 hover:text-danger-800"
                          title="Delete Investor"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isModalOpen && (
        <InvestorFormModal
          investor={selectedInvestor}
          onSave={handleSave}
          onCancel={() => {
            setIsModalOpen(false);
            setSelectedInvestor(null);
          }}
          isSubmitting={creating || updating}
        />
      )}

      {/* Profit Shares Modal */}
      {showProfitShares && (
        <ProfitSharesModal
          investorId={showProfitShares}
          onClose={() => setShowProfitShares(null)}
        />
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <PayoutModal
          investor={showPayoutModal}
          onSave={async (amount) => {
            try {
              await recordPayout({ id: showPayoutModal._id, amount }).unwrap();
              toast.success('Payout recorded successfully');
              setShowPayoutModal(null);
            } catch (error) {
              toast.error(error?.data?.message || error?.message || 'Failed to record payout');
            }
          }}
          onCancel={() => setShowPayoutModal(null)}
          isSubmitting={recordingPayout}
        />
      )}

      {/* Investment Modal */}
      {showInvestmentModal && (
        <InvestmentModal
          investor={showInvestmentModal}
          onSave={async (amount, notes) => {
            try {
              await recordInvestment({ id: showInvestmentModal._id, amount, notes }).unwrap();
              toast.success('Investment recorded successfully');
              setShowInvestmentModal(null);
            } catch (error) {
              toast.error(error?.data?.message || error?.message || 'Failed to record investment');
            }
          }}
          onCancel={() => setShowInvestmentModal(null)}
          isSubmitting={recordingInvestment}
        />
      )}

      {/* Products Modal */}
      {showProductsModal && (
        <InvestorProductsModal
          investor={showProductsModal}
          onClose={() => setShowProductsModal(null)}
        />
      )}

      {/* Delete Confirmation */}
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

// Investor Products Modal Component
const InvestorProductsModal = ({ investor, onClose }) => {
  const { data, isLoading } = useGetInvestorProductsQuery(investor._id, {
    skip: !investor,
  });

  const products = useMemo(() => {
    const productsList = data?.data?.products || data?.data || data?.products || data || [];
    return Array.isArray(productsList) ? productsList : [];
  }, [data]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Linked Products - {investor.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Products this investor is linked to with profit sharing
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No products linked</p>
              <p className="text-sm text-gray-500">
                This investor is not linked to any products yet. Link them from the Products page.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {products.map((product) => (
                  <div
                    key={product._id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Package className="h-5 w-5 text-gray-400" />
                          <h3 className="text-lg font-medium text-gray-900">
                            {product.name}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            product.status === 'active' ? 'bg-green-100 text-green-800' :
                            product.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {product.status}
                          </span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-gray-600 mb-3">
                            {product.description}
                          </p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Category:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {product.category?.name || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Stock:</span>
                            <span className={`ml-2 font-medium ${
                              (product.inventory?.currentStock || 0) <= (product.inventory?.reorderPoint || 0)
                                ? 'text-red-600'
                                : 'text-gray-900'
                            }`}>
                              {product.inventory?.currentStock || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Cost:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              ${(product.pricing?.cost || 0).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Retail:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              ${(product.pricing?.retail || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                          <div className="text-xs text-blue-600 mb-1">Profit Share</div>
                          <div className="text-lg font-bold text-blue-700">
                            {product.sharePercentage}%
                          </div>
                        </div>
                        {product.linkedAt && (
                          <div className="text-xs text-gray-500 mt-2">
                            Linked: {new Date(product.linkedAt).toLocaleDateString()}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            window.open(`/products`, '_blank');
                          }}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                          title="View Product"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>View Products</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Profit Shares Modal Component
const ProfitSharesModal = ({ investorId, onClose }) => {
  const { data, isLoading } = useGetProfitSharesQuery({ id: investorId }, {
    skip: !investorId,
  });

  const profitShares = useMemo(() => {
    const sharesList = data?.data?.profitShares || data?.data || data?.profitShares || data || [];
    return Array.isArray(sharesList) ? sharesList : [];
  }, [data]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Profit Shares</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : profitShares.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No profit shares found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sale Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Profit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Share %</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Your Share</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {profitShares.map((share) => {
                    // Handle both new schema (single investor) and legacy schema (investors array)
                    const shareInvestorId = share.investor?._id || share.investor || null;
                    const isThisInvestor = shareInvestorId && (
                      shareInvestorId.toString() === investorId.toString()
                    );
                    
                    const investorShare = isThisInvestor
                      ? (share.investorShare || 0)
                      : share.investors?.find(inv => {
                          const invId = inv.investor?._id || inv.investor;
                          return invId && invId.toString() === investorId.toString();
                        })?.shareAmount || 0;
                        
                    const sharePercentage = isThisInvestor
                      ? (share.investorSharePercentage || 0)
                      : share.investors?.find(inv => {
                          const invId = inv.investor?._id || inv.investor;
                          return invId && invId.toString() === investorId.toString();
                        })?.sharePercentage || 0;
                    
                    return (
                      <tr key={share._id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(share.orderDate || share.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{share.orderNumber || share.order?.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {share.productName || share.product?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          ${(share.saleAmount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          ${(share.totalProfit || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-600 text-right">
                          {sharePercentage}%
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600 text-right">
                          ${(investorShare || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Payout Modal Component
const PayoutModal = ({ investor, onSave, onCancel, isSubmitting }) => {
  const [amount, setAmount] = useState('');

  const handleFormSubmit = () => {
    const payoutAmount = parseFloat(amount);
    if (payoutAmount <= 0) {
      toast.error('Payout amount must be greater than 0');
      return;
    }
    if (payoutAmount > investor.currentBalance) {
      toast.error(`Payout amount cannot exceed current balance of $${investor.currentBalance.toFixed(2)}`);
      return;
    }
    onSave(payoutAmount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Record Payout</h2>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit();
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Investor
              </label>
              <input
                type="text"
                value={investor.name}
                disabled
                className="input bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Balance
              </label>
              <input
                type="text"
                value={`$${investor.currentBalance?.toFixed(2) || '0.00'}`}
                disabled
                className="input bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payout Amount ($) *
              </label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={investor.currentBalance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input pl-10"
                  placeholder="0.00"
                  required
                />
              </div>
              {parseFloat(amount) > investor.currentBalance && (
                <p className="text-red-500 text-sm mt-1">
                  Amount exceeds current balance
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary btn-md w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-md w-full sm:w-auto"
                disabled={isSubmitting || parseFloat(amount) <= 0 || parseFloat(amount) > investor.currentBalance}
              >
                {isSubmitting ? 'Recording...' : 'Record Payout'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Investment Modal Component (Receive Money from Investor)
const InvestmentModal = ({ investor, onSave, onCancel, isSubmitting }) => {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleFormSubmit = () => {
    const investmentAmount = parseFloat(amount);
    if (investmentAmount <= 0) {
      toast.error('Investment amount must be greater than 0');
      return;
    }
    onSave(investmentAmount, notes);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Record Investment</h2>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit();
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Investor
              </label>
              <input
                type="text"
                value={investor.name}
                disabled
                className="input bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Total Investment
              </label>
              <input
                type="text"
                value={`$${(investor.totalInvestment || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                disabled
                className="input bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Investment Amount ($) *
              </label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input pl-10"
                  placeholder="0.00"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This will be added to the investor's total investment
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                rows={3}
                placeholder="Add any notes about this investment..."
                maxLength={500}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary btn-md w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-md w-full sm:w-auto"
                disabled={isSubmitting || parseFloat(amount) <= 0}
              >
                {isSubmitting ? 'Recording...' : 'Record Investment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Investors;

