import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Printer,
  Trash2,
  CheckCircle, 
  XCircle, 
  Clock,
  AlertCircle,
  Package,
  TrendingUp,
  Users
} from 'lucide-react';
import {
  useGetReturnsQuery,
  useGetReturnStatsQuery,
  useGetReturnTrendsQuery,
  useGetReturnQuery,
  useDeleteReturnMutation,
  useUpdateReturnStatusMutation,
  useAddNoteMutation,
  useAddCommunicationMutation,
} from '../store/services/returnsApi';
import { useGetCompanySettingsQuery } from '../store/services/settingsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingCard, LoadingTable } from '../components/LoadingSpinner';
import { useResponsive, ResponsiveContainer, ResponsiveGrid } from '../components/ResponsiveContainer';
import CreateReturnModal from '../components/CreateReturnModal';
import ReturnDetailModal from '../components/ReturnDetailModal';
import ReturnStatsCard from '../components/ReturnStatsCard';
import ReturnFilters from '../components/ReturnFilters';
import { getCurrentDatePakistan } from '../utils/dateUtils';

const Returns = () => {
  const navigate = useNavigate();
  const today = getCurrentDatePakistan();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    returnType: '',
    priority: '',
    search: '',
    startDate: today,
    endDate: today
  });
  
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preselectedReturnType, setPreselectedReturnType] = useState('sales');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { isMobile } = useResponsive();
  // Fetch returns
  const { 
    data: returnsData, 
    isLoading: returnsLoading, 
    error: returnsError,
    refetch: refetchReturns
  } = useGetReturnsQuery(filters, {
    onError: (error) => {
      handleApiError(error, 'Fetch Returns');
    }
  });

  // Fetch return statistics - show all stats if no date filter, or filtered stats if dates provided
  const { 
    data: statsData, 
    isLoading: statsLoading 
  } = useGetReturnStatsQuery(
    filters.startDate && filters.endDate
      ? {
          startDate: filters.startDate,
          endDate: filters.endDate
        }
      : {}
  );

  // Fetch company settings
  const { 
    data: companySettingsResponse 
  } = useGetCompanySettingsQuery();

  const companySettings = companySettingsResponse?.data || companySettingsResponse;

  // Mutations
  const [updateReturnStatus] = useUpdateReturnStatusMutation();
  const [deleteReturn] = useDeleteReturnMutation();

  const handleUpdateStatus = async (returnId, status, notes) => {
    try {
      await updateReturnStatus({ returnId, status, notes }).unwrap();
      showSuccessToast(`Return status updated to ${status}`);
      setShowDetailModal(false);
      setSelectedReturn(null);
      refetchReturns();
    } catch (error) {
      handleApiError(error, 'Update Return Status');
    }
  };

  const [addNote] = useAddNoteMutation();

  const handleAddNote = async (returnId, note, isInternal) => {
    try {
      await addNote({ returnId, note, isInternal }).unwrap();
      showSuccessToast('Note added successfully');
      refetchReturns();
    } catch (error) {
      handleApiError(error, 'Add Note');
    }
  };

  const handleDeleteReturn = async (returnId) => {
    try {
      await deleteReturn(returnId).unwrap();
      showSuccessToast('Return deleted successfully');
      refetchReturns();
    } catch (error) {
      handleApiError(error, 'Delete Return');
    }
  };


  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    }));
  };

  const { data: selectedReturnData } = useGetReturnQuery(selectedReturn?._id, {
    skip: !selectedReturn?._id,
  });

  const handleReturnSelect = (returnId) => {
    setSelectedReturn({ _id: returnId }); // Trigger query
    setShowDetailModal(true);
  };

  React.useEffect(() => {
    if (selectedReturnData?.data) {
      setSelectedReturn(selectedReturnData.data);
    }
  }, [selectedReturnData]);

  const handleStatusUpdate = async (status, notes = '') => {
    if (!selectedReturn) return;
    await handleUpdateStatus(selectedReturn._id, status, notes);
  };

  const handleAddNoteWrapper = async (note, isInternal = false) => {
    if (!selectedReturn) return;
    await handleAddNote(selectedReturn._id, note, isInternal);
  };

  const [addCommunication] = useAddCommunicationMutation();

  const handleAddCommunication = async (type, message, recipient = null) => {
    if (!selectedReturn) return;
    try {
      await addCommunication({ returnId: selectedReturn._id, type, message, recipient }).unwrap();
      showSuccessToast('Communication logged successfully');
      refetchReturns();
    } catch (error) {
      handleApiError(error, 'Add Communication');
    }
  };

  const handleDeleteReturnClick = async (returnId) => {
    if (window.confirm('Are you sure you want to delete this return? This action cannot be undone.')) {
      await handleDeleteReturn(returnId);
    }
  };

  const handlePrint = (returnItem) => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Get the return data and company settings
    const returnData = returnItem;
    const companyName = companySettings?.data?.companyName || 'Your Company Name';
    
    // Create the print content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Return Document - ${returnData.returnNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 10px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; }
          .company-name { font-size: 16px; font-weight: bold; color: #333; }
          .document-title { font-size: 14px; color: #666; margin-top: 5px; }
          .return-info { margin-bottom: 15px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; padding: 2px 0; border-bottom: 1px solid #eee; font-size: 11px; }
          .info-label { font-weight: bold; color: #333; }
          .info-value { color: #666; }
          .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
          .items-table th, .items-table td { border: 1px solid #ddd; padding: 4px; text-align: left; }
          .items-table th { background-color: #f5f5f5; font-weight: bold; font-size: 10px; }
          .items-table tr:nth-child(even) { background-color: #f9f9f9; }
          .totals { margin-top: 15px; text-align: right; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; padding: 2px 0; font-size: 11px; }
          .total-label { font-weight: bold; }
          .total-value { font-weight: bold; font-size: 12px; }
          .footer { margin-top: 20px; text-align: center; color: #666; font-size: 10px; }
          @media print {
            body { margin: 5px; font-size: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companyName}</div>
          <div class="company-details" style="font-size: 10px; color: #666; margin-top: 5px;">
            ${companySettings?.data?.address || ''} | ${companySettings?.data?.contactNumber || ''} | ${companySettings?.data?.email || ''}
          </div>
          <div class="document-title">RETURN DOCUMENT</div>
        </div>
        
        <div class="return-info" style="display: flex; gap: 20px; margin-bottom: 15px;">
          <div style="flex: 1;">
            <h3 style="color: #333; margin-bottom: 8px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 3px;">CUSTOMER DETAILS</h3>
            <div class="info-row">
              <span class="info-label">Customer Name:</span>
              <span class="info-value">${returnData.customer?.firstName && returnData.customer?.lastName ? 
                `${returnData.customer.firstName} ${returnData.customer.lastName}` : 
                returnData.customer?.name || 
                returnData.customer?.businessName || 
                'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span class="info-value">${returnData.customer?.email || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span class="info-value">${returnData.customer?.phone || 'N/A'}</span>
            </div>
          </div>
          <div style="flex: 1;">
            <h3 style="color: #333; margin-bottom: 8px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 3px;">RETURN DETAILS</h3>
            <div class="info-row">
              <span class="info-label">Return Number:</span>
              <span class="info-value">${returnData.returnNumber}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Original Order:</span>
              <span class="info-value">${returnData.originalOrder?.orderNumber || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value">${returnData.status?.toUpperCase() || 'PENDING'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Priority:</span>
              <span class="info-value">${returnData.priority?.toUpperCase() || 'NORMAL'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Return Date:</span>
              <span class="info-value">${new Date(returnData.returnDate).toLocaleDateString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Refund Method:</span>
              <span class="info-value">${returnData.refundMethod?.replace('_', ' ').toUpperCase() || 'ORIGINAL PAYMENT'}</span>
            </div>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Original Price</th>
              <th>Return Reason</th>
              <th>Condition</th>
              <th>Refund Amount</th>
              <th>Restocking Fee</th>
            </tr>
          </thead>
          <tbody>
            ${returnData.items?.map(item => `
              <tr>
                <td>${item.product?.name || 'N/A'}</td>
                <td>${item.quantity || 0}</td>
                <td>$${(item.originalPrice || 0).toFixed(2)}</td>
                <td>${item.returnReason?.replace('_', ' ').toUpperCase() || 'N/A'}</td>
                <td>${item.condition?.toUpperCase() || 'N/A'}</td>
                <td>$${(item.refundAmount || 0).toFixed(2)}</td>
                <td>$${(item.restockingFee || 0).toFixed(2)}</td>
              </tr>
            `).join('') || '<tr><td colspan="7">No items found</td></tr>'}
          </tbody>
        </table>
        
        <div class="totals">
          <div class="total-row">
            <span class="total-label">Total Refund Amount:</span>
            <span class="total-value">$${returnData.totalRefundAmount ? returnData.totalRefundAmount.toFixed(2) : 
              returnData.items ? returnData.items.reduce((sum, item) => sum + (item.refundAmount || 0), 0).toFixed(2) : '0.00'}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Total Restocking Fee:</span>
            <span class="total-value">$${returnData.totalRestockingFee ? returnData.totalRestockingFee.toFixed(2) : 
              returnData.items ? returnData.items.reduce((sum, item) => sum + (item.restockingFee || 0), 0).toFixed(2) : '0.00'}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Net Refund Amount:</span>
            <span class="total-value">$${returnData.netRefundAmount ? returnData.netRefundAmount.toFixed(2) : 
              returnData.items ? (returnData.items.reduce((sum, item) => sum + (item.refundAmount || 0), 0) - 
                returnData.items.reduce((sum, item) => sum + (item.restockingFee || 0), 0)).toFixed(2) : '0.00'}</span>
          </div>
        </div>
        
        ${returnData.generalNotes ? `
          <div style="margin-top: 30px;">
            <h3 style="color: #333; margin-bottom: 10px;">Notes:</h3>
            <p style="color: #666; line-height: 1.5;">${returnData.generalNotes}</p>
          </div>
        ` : ''}
        
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>This is a computer-generated document.</p>
          <p style="margin-top: 10px; font-weight: bold;">${companyName}</p>
          <p>${companySettings?.data?.address || ''}</p>
          <p>Phone: ${companySettings?.data?.contactNumber || ''} | Email: ${companySettings?.data?.email || ''}</p>
        </div>
      </body>
      </html>
    `;
    
    // Write the content to the new window
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for the content to load, then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'received':
        return <Package className="h-4 w-4 text-green-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'received':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (returnsLoading && !returnsData) {
    return <LoadingSpinner message="Loading returns..." />;
  }

  const returns = returnsData?.data?.returns || returnsData?.returns || [];
  const pagination = returnsData?.data?.pagination || returnsData?.pagination || {};
  // Handle stats data - RTK Query wraps in data, but also handle direct response
  const stats = statsData?.data || statsData || {
    totalReturns: 0,
    pendingReturns: 0,
    totalRefundAmount: 0,
    returnRate: 0
  };

  return (
    <ResponsiveContainer className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Return Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage returns, exchanges, and refunds</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => refetchReturns()}
            className="btn btn-outline btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => navigate('/sale-returns')}
            className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Create Sales Return</span>
          </button>
          <button
            onClick={() => {
              setPreselectedReturnType('purchase');
              setShowCreateModal(true);
            }}
            className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Create Purchase Return</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {!statsLoading && (
        <ResponsiveGrid cols={{ default: 2, md: 2, lg: 4 }} gap={6}>
          <ReturnStatsCard
            title="Total Returns"
            value={stats.totalReturns || 0}
            icon={<Package className="h-5 w-5" />}
            color="blue"
          />
          <ReturnStatsCard
            title="Pending Returns"
            value={stats.pendingReturns || 0}
            icon={<Clock className="h-5 w-5" />}
            color="yellow"
          />
          <ReturnStatsCard
            title="Total Refunds"
            value={`${(stats.totalRefundAmount || 0).toFixed(2)}`}
            icon={<TrendingUp className="h-5 w-5" />}
            color="green"
          />
          <ReturnStatsCard
            title="Return Rate"
            value={`${(stats.returnRate || 0).toFixed(1)}%`}
            icon={<TrendingUp className="h-5 w-5" />}
            color="purple"
          />
        </ResponsiveGrid>
      )}

      {/* Filters */}
      <ReturnFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        isLoading={returnsLoading}
      />

      {/* Returns Table */}
      <div className="card">
        <div className="card-header">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Returns</h3>
            <span className="text-xs sm:text-sm text-gray-600">
              {pagination.total || 0} total returns
            </span>
          </div>
        </div>
        
        <div className="card-content p-0">
          {returnsLoading ? (
            <LoadingTable rows={5} cols={6} />
          ) : returns.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">No returns found</p>
              <p className="text-sm">Try adjusting your filters or create a new return</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Return #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {returns.map((returnItem) => (
                    <tr key={returnItem._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(returnItem.returnDate).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(returnItem.returnDate).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {returnItem.origin === 'purchase' 
                            ? (returnItem.supplier?.companyName || returnItem.supplier?.name || returnItem.supplier?.businessName || 'N/A')
                            : (returnItem.customer?.name || returnItem.customer?.businessName || 'N/A')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {returnItem.origin === 'purchase'
                            ? (returnItem.supplier?.email || 'N/A')
                            : (returnItem.customer?.email || 'N/A')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {returnItem.originalOrder?.orderNumber || returnItem.originalOrder?.soNumber || returnItem.originalOrder?.invoiceNumber || returnItem.originalOrder?.poNumber || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {returnItem.items?.length || 0} items
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${returnItem.netRefundAmount?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {returnItem.returnNumber}
                        </div>
                        <div className="text-sm text-gray-500 capitalize">
                          {returnItem.returnType}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(returnItem.status)}`}>
                          {getStatusIcon(returnItem.status)}
                          <span className="ml-1 capitalize">{returnItem.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(returnItem.priority)}`}>
                          {returnItem.priority || 'normal'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleReturnSelect(returnItem._id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Return Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePrint(returnItem)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Print Return Document"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteReturnClick(returnItem._id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Return"
                            disabled={!['pending', 'cancelled'].includes(returnItem.status)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handleFilterChange({ page: pagination.current - 1 })}
                disabled={!pagination.hasPrev}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => handleFilterChange({ page: pagination.current + 1 })}
                disabled={!pagination.hasNext}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {(pagination.current - 1) * filters.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.current * filters.limit, pagination.total)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{pagination.total}</span>{' '}
                  results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => handleFilterChange({ page: pagination.current - 1 })}
                    disabled={!pagination.hasPrev}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {[...Array(pagination.pages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => handleFilterChange({ page: i + 1 })}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pagination.current === i + 1
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => handleFilterChange({ page: pagination.current + 1 })}
                    disabled={!pagination.hasNext}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateReturnModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refetchReturns();
          }}
          defaultReturnType={preselectedReturnType}
        />
      )}

      {showDetailModal && selectedReturn && (
        <ReturnDetailModal
          return={selectedReturn}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReturn(null);
          }}
          onStatusUpdate={handleStatusUpdate}
          onAddNote={handleAddNote}
          onAddCommunication={handleAddCommunication}
          isLoading={false}
        />
      )}
    </ResponsiveContainer>
  );
};

export default Returns;
