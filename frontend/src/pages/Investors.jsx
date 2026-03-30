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
  ExternalLink,
  Printer,
  Receipt
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
  useGetInvestorPayoutsQuery,
} from '../store/services/investorsApi';
import { toast } from 'sonner';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import { useTab } from '../contexts/TabContext';

/** Amount display without a currency prefix (e.g. no leading $). */
function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ISO or Date string from API → locale string for payout timestamps */
function formatPayoutDate(iso) {
  if (iso == null || iso === '') return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return null;
  }
}

/** Shorter single-line date/time for investor table “Last paid” (avoids wrapping in narrow cells). */
function formatLastPaidOneLine(iso) {
  if (iso == null || iso === '') return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return null;
  }
}

/** Prefer camelCase from API; fall back to Postgres snake_case. */
function invNum(inv, camel, snake) {
  const v = inv?.[camel] ?? inv?.[snake];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Opens a print dialog with a simple HTML document (includes “Printed on” date/time). */
function openPrintDocument(title, innerHtml) {
  const printedAt = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const w = window.open('', '_blank');
  if (!w) {
    toast.error('Pop-up blocked — allow pop-ups to print.');
    return;
  }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 20px; margin: 0 0 6px; }
    .printed { color: #6b7280; font-size: 12px; margin: 0 0 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; }
    th { background: #f9fafb; text-align: left; font-weight: 600; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .note { margin-top: 16px; font-size: 11px; color: #6b7280; }
    @media print { body { padding: 12px; } }
  </style></head><body>
  <h1>${escapeHtml(title)}</h1>
  <p class="printed">Printed on: ${escapeHtml(printedAt)}</p>
  ${innerHtml}
  </body></html>`);
  w.document.close();
  w.focus();
  requestAnimationFrame(() => {
    w.print();
  });
}

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
                    <Input
                      {...register('name', { required: 'Investor name is required' })}
                      className="pl-10"
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
                      <Input
                        {...register('email', { 
                          required: 'Email is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Invalid email address'
                          }
                        })}
                        type="email"
                        className="pl-10"
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
                      <Input
                        {...register('phone')}
                        type="tel"
                        className="pl-10"
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
                    <Input
                      {...register('address.street')}
                      className="pl-10"
                      placeholder="Enter street address"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <Input
                      {...register('address.city')}
                      placeholder="Enter city"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State/Province
                    </label>
                    <Input
                      {...register('address.state')}
                      placeholder="Enter state"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Zip Code
                    </label>
                    <Input
                      {...register('address.zipCode')}
                      placeholder="Enter zip code"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <Input
                      {...register('address.country')}
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
                    Total Investment
                  </label>
                  <div className="relative">
                    <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      {...register('totalInvestment', { 
                        valueAsNumber: true,
                        min: { value: 0, message: 'Investment must be positive' }
                      })}
                      type="number"
                      step="0.01"
                      className="pl-10"
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
              <Textarea
                {...register('notes')}
                rows={3}
                placeholder="Enter any additional notes"
              />
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                onClick={onCancel}
                variant="secondary"
                size="default"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                size="default"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (investor ? 'Update Investor' : 'Add Investor')}
              </Button>
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
  /** `{ id, name }` when profit-shares modal is open */
  const [showProfitShares, setShowProfitShares] = useState(null);
  /** `{ id, name }` when payout-history modal is open */
  const [showPayoutHistory, setShowPayoutHistory] = useState(null);
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

  const investors = useMemo(() => {
    const list = data?.data?.investors || data?.data || data?.investors || data || [];
    return Array.isArray(list) ? list : [];
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
    setShowProfitShares({ id: investor._id, name: investor.name });
  };

  const handleViewPayoutHistory = (investor) => {
    setShowPayoutHistory({ id: investor._id, name: investor.name });
  };

  const handlePrintInvestorsList = () => {
    const rows = investors
      .map(
        (inv) => `<tr>
        <td>${escapeHtml(inv.name)}</td>
        <td>${escapeHtml(inv.email || '—')}</td>
        <td>${escapeHtml(inv.phone || '—')}</td>
        <td class="num">${escapeHtml(formatAmount(invNum(inv, 'totalInvestment', 'total_investment')))}</td>
        <td class="num">${escapeHtml(formatAmount(invNum(inv, 'totalEarnedProfit', 'total_earned_profit')))}</td>
        <td class="num">${escapeHtml(formatAmount(invNum(inv, 'totalPaidOut', 'total_paid_out')))}</td>
        <td>${escapeHtml(formatPayoutDate(inv.lastPayoutAt ?? inv.last_payout_at) || '—')}</td>
        <td class="num">${escapeHtml(formatAmount(invNum(inv, 'currentBalance', 'current_balance')))}</td>
        <td>${escapeHtml(inv.status || '—')}</td>
      </tr>`
      )
      .join('');
    openPrintDocument(
      'Investors report',
      `<table>
        <thead><tr>
          <th>Name</th><th>Email</th><th>Phone</th>
          <th class="num">Total investment</th><th class="num">Earned profit</th>
          <th class="num">Paid out</th><th>Last payout (date)</th><th class="num">Current balance</th><th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="note">Amounts are as of the print date above. Profit share line dates appear on the per-investor Profit Shares print.</p>`
    );
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
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            type="button"
            onClick={handlePrintInvestorsList}
            variant="outline"
            size="default"
            className="flex items-center justify-center gap-2"
            disabled={investors.length === 0}
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>
          <Button
            onClick={() => {
              setSelectedInvestor(null);
              setIsModalOpen(true);
            }}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Investor</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-[2] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search investors by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
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
            <div className="bg-gray-50 px-4 sm:px-8 py-4 sm:py-5 border-b border-gray-200">
              <div className="grid w-full min-w-0 grid-cols-12 gap-x-3 sm:gap-x-4 lg:gap-x-5 gap-y-2 items-center">
                <div className="col-span-12 lg:col-span-2 min-w-0">
                  <h3 className="text-base font-medium text-gray-700">Investor Name</h3>
                  <p className="text-sm text-gray-500">Contact Information</p>
                </div>
                <div className="col-span-6 sm:col-span-4 lg:col-span-2 lg:text-right">
                  <h3 className="text-sm font-medium text-gray-700 whitespace-nowrap">Total Investment</h3>
                </div>
                <div className="col-span-6 sm:col-span-4 lg:col-span-1 lg:text-right">
                  <h3 className="text-sm font-medium text-gray-700 whitespace-nowrap">Earned Profit</h3>
                </div>
                <div className="col-span-6 sm:col-span-4 lg:col-span-2 lg:text-right">
                  <h3 className="text-sm font-medium text-gray-700 whitespace-nowrap">Paid Out</h3>
                </div>
                <div className="col-span-6 sm:col-span-4 lg:col-span-2 lg:text-right">
                  <h3 className="text-sm font-medium text-gray-700 whitespace-nowrap">Current Balance</h3>
                </div>
                <div className="col-span-6 sm:col-span-4 lg:col-span-1 lg:text-center">
                  <h3 className="text-sm font-medium text-gray-700 whitespace-nowrap">Status</h3>
                </div>
                <div className="col-span-12 lg:col-span-2 lg:text-right">
                  <h3 className="text-sm font-medium text-gray-700 whitespace-nowrap">Actions</h3>
                </div>
              </div>
            </div>

            {/* Investor Rows */}
            <div className="divide-y divide-gray-200">
              {investors.map((investor) => (
                <div key={investor._id} className="px-4 sm:px-8 py-6 hover:bg-gray-50">
                  <div className="grid w-full min-w-0 grid-cols-12 gap-x-4 sm:gap-x-6 gap-y-3 items-center">
                    {/* Investor Name & Contact */}
                    <div className="col-span-12 lg:col-span-2 min-w-0">
                      <div className="flex items-center space-x-4">
                        <User className="h-6 w-6 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium text-gray-900 truncate">
                            {investor.name}
                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-600 mt-1 min-w-0">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{investor.email}</span>
                          </div>
                          {investor.phone && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600 mt-1">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{investor.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Total Investment */}
                    <div className="col-span-6 sm:col-span-4 lg:col-span-2 text-left lg:text-right tabular-nums">
                      <p className="text-sm text-gray-600">
                        {formatAmount(invNum(investor, 'totalInvestment', 'total_investment'))}
                      </p>
                    </div>

                    {/* Earned Profit */}
                    <div className="col-span-6 sm:col-span-4 lg:col-span-1 text-left lg:text-right tabular-nums">
                      <p className="text-sm font-semibold text-green-600">
                        {formatAmount(invNum(investor, 'totalEarnedProfit', 'total_earned_profit'))}
                      </p>
                    </div>

                    {/* Paid Out + last payout date (wider column + nowrap so date stays one line) */}
                    <div className="col-span-6 sm:col-span-4 lg:col-span-2 text-left lg:text-right tabular-nums">
                      <p className="text-sm text-gray-600">
                        {formatAmount(invNum(investor, 'totalPaidOut', 'total_paid_out'))}
                      </p>
                      {formatLastPaidOneLine(investor.lastPayoutAt ?? investor.last_payout_at) ? (
                        <p className="text-xs text-gray-500 mt-1 flex flex-wrap lg:flex-nowrap items-center gap-1 lg:whitespace-nowrap lg:w-full lg:justify-end">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>Last paid: {formatLastPaidOneLine(investor.lastPayoutAt ?? investor.last_payout_at)}</span>
                        </p>
                      ) : null}
                    </div>

                    {/* Current Balance */}
                    <div className="col-span-6 sm:col-span-4 lg:col-span-2 text-left lg:text-right tabular-nums">
                      <p className="text-sm font-bold text-blue-600">
                        {formatAmount(invNum(investor, 'currentBalance', 'current_balance'))}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="col-span-6 sm:col-span-4 lg:col-span-1 flex lg:justify-center justify-start">
                      <span className={`badge ${
                        investor.status === 'active' ? 'badge-success' :
                        investor.status === 'inactive' ? 'badge-gray' :
                        'badge-danger'
                      }`}>
                        {investor.status}
                      </span>
                    </div>

                    {/* Actions — use full cell width and align icons to the right (removes dead space on the right) */}
                    <div className="col-span-12 lg:col-span-2 w-full min-w-0">
                      <div className="flex w-full items-center justify-start lg:justify-end gap-2 sm:gap-3 flex-wrap">
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
                          onClick={() => handleViewPayoutHistory(investor)}
                          className="text-amber-700 hover:text-amber-900"
                          title="Payout history (dates paid out)"
                        >
                          <Receipt className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleInvestment(investor)}
                          className="text-green-600 hover:text-green-800"
                          title="Record Investment (Receive Money)"
                        >
                          <TrendingUp className="h-5 w-5" />
                        </button>
                        {invNum(investor, 'currentBalance', 'current_balance') > 0 && (
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
          investorId={showProfitShares.id}
          investorName={showProfitShares.name}
          onClose={() => setShowProfitShares(null)}
        />
      )}

      {showPayoutHistory && (
        <PayoutHistoryModal
          investorId={showPayoutHistory.id}
          investorName={showPayoutHistory.name}
          onClose={() => setShowPayoutHistory(null)}
        />
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <PayoutModal
          investor={showPayoutModal}
          onSave={async (amount, payoutOptions) => {
            try {
              await recordPayout({
                id: showPayoutModal._id,
                amount,
                paymentMethod: payoutOptions?.paymentMethod || 'cash',
                debitAccountCode: payoutOptions?.debitAccountCode || undefined,
              }).unwrap();
              toast.success('Payout recorded successfully (posted to general ledger)');
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
                              {formatAmount(product.pricing?.cost)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Retail:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {formatAmount(product.pricing?.retail)}
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
const ProfitSharesModal = ({ investorId, investorName, onClose }) => {
  const { data, isLoading, isError, error } = useGetProfitSharesQuery({ id: investorId }, {
    skip: !investorId,
  });

  const profitShares = useMemo(() => {
    const sharesList = data?.data?.profitShares || data?.data || data?.profitShares || data || [];
    return Array.isArray(sharesList) ? sharesList : [];
  }, [data]);

  const profitSharesErrorMessage =
    isError && error?.data != null
      ? String(
          typeof error.data === 'object' && error.data?.message != null
            ? error.data.message
            : error.data
        )
      : isError
        ? 'Could not load profit shares. Try again or check the server.'
        : null;

  const printProfitShares = () => {
    if (profitShares.length === 0) {
      toast.error('Nothing to print');
      return;
    }
    const rows = profitShares
      .map((share) => {
        const shareInvestorId = share.investor_id ?? share.investor?._id ?? share.investor ?? null;
        const isThisInvestor =
          shareInvestorId && shareInvestorId.toString() === investorId.toString();
        const investorShare = isThisInvestor
          ? Number(share.investor_share ?? share.investorShare ?? 0)
          : share.investors?.find((inv) => {
              const invId = inv.investor?._id || inv.investor;
              return invId && invId.toString() === investorId.toString();
            })?.shareAmount || 0;
        const sharePercentage = isThisInvestor
          ? Number(share.investor_share_percentage ?? share.investorSharePercentage ?? 0)
          : share.investors?.find((inv) => {
              const invId = inv.investor?._id || inv.investor;
              return invId && invId.toString() === investorId.toString();
            })?.sharePercentage || 0;
        const lineDate =
          share.order_date ?? share.orderDate ?? share.created_at ?? share.createdAt;
        const dateStr = lineDate
          ? new Date(lineDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
          : '—';
        const saleAmt = share.sale_amount ?? share.saleAmount;
        const totProfit = share.total_profit ?? share.totalProfit;
        const ordNum = share.order_number ?? share.orderNumber ?? share.order?.orderNumber;
        const prodName = share.product_name ?? share.productName ?? share.product?.name;
        return `<tr>
          <td>${escapeHtml(dateStr)}</td>
          <td>${escapeHtml(ordNum || '—')}</td>
          <td>${escapeHtml(prodName || 'N/A')}</td>
          <td class="num">${escapeHtml(formatAmount(saleAmt))}</td>
          <td class="num">${escapeHtml(formatAmount(totProfit))}</td>
          <td class="num">${escapeHtml(String(sharePercentage))}%</td>
          <td class="num">${escapeHtml(formatAmount(investorShare))}</td>
        </tr>`;
      })
      .join('');
    const title = investorName
      ? `Profit shares — ${investorName}`
      : 'Profit shares';
    openPrintDocument(
      title,
      `<p style="margin:0 0 16px;font-size:14px;color:#374151">Each row shows the <strong>sale / order date</strong> when profit was credited (not payout date).</p>
      <table>
        <thead><tr>
          <th>Date (sale)</th><th>Order #</th><th>Product</th>
          <th class="num">Sale amount</th><th class="num">Total profit</th>
          <th class="num">Share %</th><th class="num">Investor share</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-900">
              Profit Shares{investorName ? ` — ${investorName}` : ''}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={printProfitShares}
                disabled={isLoading || isError || profitShares.length === 0}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : isError ? (
            <div className="text-center py-12 px-4">
              <p className="text-red-600 font-medium mb-2">Failed to load profit shares</p>
              <p className="text-gray-600 text-sm">{profitSharesErrorMessage}</p>
            </div>
          ) : profitShares.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No profit shares found</p>
              <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
                Rows appear after a <strong>paid</strong> sale of a product linked to this investor, when profit is distributed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date (sale)</th>
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
                    // Handle Postgres snake_case, camelCase, and legacy schema (investors array)
                    const shareInvestorId = share.investor_id ?? share.investor?._id ?? share.investor ?? null;
                    const isThisInvestor = shareInvestorId && (
                      shareInvestorId.toString() === investorId.toString()
                    );
                    
                    const investorShare = isThisInvestor
                      ? Number(share.investor_share ?? share.investorShare ?? 0)
                      : share.investors?.find(inv => {
                          const invId = inv.investor?._id || inv.investor;
                          return invId && invId.toString() === investorId.toString();
                        })?.shareAmount || 0;
                        
                    const sharePercentage = isThisInvestor
                      ? Number(share.investor_share_percentage ?? share.investorSharePercentage ?? 0)
                      : share.investors?.find(inv => {
                          const invId = inv.investor?._id || inv.investor;
                          return invId && invId.toString() === investorId.toString();
                        })?.sharePercentage || 0;

                    const lineDate = share.order_date ?? share.orderDate ?? share.created_at ?? share.createdAt;
                    
                    return (
                      <tr key={share.id || share._id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {lineDate
                            ? new Date(lineDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{share.order_number ?? share.orderNumber ?? share.order?.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {share.product_name ?? share.productName ?? share.product?.name ?? 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatAmount(share.sale_amount ?? share.saleAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatAmount(share.total_profit ?? share.totalProfit)}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-600 text-right">
                          {sharePercentage}%
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600 text-right">
                          {formatAmount(investorShare)}
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

function payoutMethodLabel(pm) {
  if (pm === 'bank') return 'Bank';
  return 'Cash';
}

// Payout history — each cash payout with date (from investor_payouts)
const PayoutHistoryModal = ({ investorId, investorName, onClose }) => {
  const { data, isLoading, isError, error } = useGetInvestorPayoutsQuery(investorId, {
    skip: !investorId,
  });

  const payouts = useMemo(() => {
    const raw = data?.data ?? data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const errMsg =
    isError && error?.data != null
      ? String(
          typeof error.data === 'object' && error.data?.message != null
            ? error.data.message
            : error.data
        )
      : isError
        ? 'Could not load payout history.'
        : null;

  const printPayouts = () => {
    if (payouts.length === 0) {
      toast.error('Nothing to print');
      return;
    }
    const rows = payouts
      .map((p) => {
        const when = formatPayoutDate(p.paidAt ?? p.paid_at);
        const amt = p.amount;
        const method = payoutMethodLabel(p.paymentMethod ?? p.payment_method);
        const dr = p.debitAccountCode ?? p.debit_account_code ?? '—';
        const cr = p.creditAccountCode ?? p.credit_account_code ?? (p.paymentMethod === 'bank' || p.payment_method === 'bank' ? '1001' : '1000');
        return `<tr>
          <td>${escapeHtml(when || '—')}</td>
          <td class="num">${escapeHtml(formatAmount(amt))}</td>
          <td>${escapeHtml(method)}</td>
          <td>${escapeHtml(String(dr))}</td>
          <td>${escapeHtml(String(cr))}</td>
        </tr>`;
      })
      .join('');
    const title = investorName ? `Payout history — ${investorName}` : 'Payout history';
    openPrintDocument(
      title,
      `<p style="margin:0 0 16px;font-size:14px;color:#374151">Each row is one payout posted to the general ledger (Dr equity/liability, Cr cash or bank).</p>
      <table>
        <thead><tr><th>Date paid out</th><th class="num">Amount</th><th>Method</th><th>Debit acct</th><th>Credit acct</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-900">
              Payout history{investorName ? ` — ${investorName}` : ''}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={printPayouts}
                disabled={isLoading || isError || payouts.length === 0}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : isError ? (
            <div className="text-center py-12 px-4">
              <p className="text-red-600 font-medium mb-2">Failed to load payout history</p>
              <p className="text-gray-600 text-sm">{errMsg}</p>
            </div>
          ) : payouts.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No payout records yet</p>
              <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
                New payouts are posted to the general ledger. Older rows may show “—” for accounts if they pre-date ledger integration.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date paid out</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid via</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ledger</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatPayoutDate(p.paidAt ?? p.paid_at) || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatAmount(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {payoutMethodLabel(p.paymentMethod ?? p.payment_method)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        Dr {p.debitAccountCode ?? p.debit_account_code ?? '—'} / Cr{' '}
                        {p.creditAccountCode ??
                          p.credit_account_code ??
                          (p.paymentMethod === 'bank' || p.payment_method === 'bank'
                            ? '1001'
                            : '1000')}
                        {p.ledgerTransactionId || p.ledger_transaction_id ? (
                          <span className="block text-gray-400 mt-0.5">
                            {p.ledgerTransactionId ?? p.ledger_transaction_id}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
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
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [debitAccountCode, setDebitAccountCode] = useState('');
  const currentBalance = invNum(investor, 'currentBalance', 'current_balance');

  const handleFormSubmit = () => {
    const payoutAmount = parseFloat(amount);
    if (payoutAmount <= 0) {
      toast.error('Payout amount must be greater than 0');
      return;
    }
    if (payoutAmount > currentBalance) {
      toast.error(`Payout amount cannot exceed current balance of ${formatAmount(currentBalance)}`);
      return;
    }
    const trimmedDebit = debitAccountCode.trim();
    onSave(payoutAmount, {
      paymentMethod,
      debitAccountCode: trimmedDebit || undefined,
    });
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
              <Input
                type="text"
                value={investor.name}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Balance
              </label>
              <Input
                type="text"
                value={formatAmount(currentBalance)}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pay from *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="invPayMethod"
                    checked={paymentMethod === 'cash'}
                    onChange={() => setPaymentMethod('cash')}
                    className="rounded-full border-gray-300"
                  />
                  Cash (credits account 1000)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="invPayMethod"
                    checked={paymentMethod === 'bank'}
                    onChange={() => setPaymentMethod('bank')}
                    className="rounded-full border-gray-300"
                  />
                  Bank (credits account 1001)
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Posted to the general ledger: Dr equity/liability, Cr cash or bank (same transaction as investor balance update).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Debit account (optional)
              </label>
              <Input
                type="text"
                value={debitAccountCode}
                onChange={(e) => setDebitAccountCode(e.target.value)}
                placeholder="3100 (default: Retained Earnings) or 2350 Due to Investors"
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to use server default (usually 3100). Must be an equity or liability code from your chart of accounts.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payout Amount *
              </label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={currentBalance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10"
                  placeholder="0.00"
                  required
                />
              </div>
              {parseFloat(amount) > currentBalance && (
                <p className="text-red-500 text-sm mt-1">
                  Amount exceeds current balance
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                onClick={onCancel}
                variant="secondary"
                size="default"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                size="default"
                className="w-full sm:w-auto"
                disabled={isSubmitting || parseFloat(amount) <= 0 || parseFloat(amount) > currentBalance}
              >
                {isSubmitting ? 'Recording...' : 'Record Payout'}
              </Button>
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
  const totalInvestmentVal = invNum(investor, 'totalInvestment', 'total_investment');

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
              <Input
                type="text"
                value={investor.name}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Total Investment
              </label>
              <Input
                type="text"
                value={formatAmount(totalInvestmentVal)}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Investment Amount *
              </label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10"
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
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes about this investment..."
                maxLength={500}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                onClick={onCancel}
                variant="secondary"
                size="default"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                size="default"
                className="w-full sm:w-auto"
                disabled={isSubmitting || parseFloat(amount) <= 0}
              >
                {isSubmitting ? 'Recording...' : 'Record Investment'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Investors;

