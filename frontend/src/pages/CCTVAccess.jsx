import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Search, 
  Calendar, 
  Clock, 
  FileText, 
  User,
  Eye,
  Copy,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Filter,
  X
} from 'lucide-react';
import { useGetCCTVOrdersQuery } from '../store/services/salesApi';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showSuccessToast, showErrorToast } from '../utils/errorHandler';
import toast from 'react-hot-toast';

const CCTVAccess = ({ tabId }) => {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [copiedTime, setCopiedTime] = useState(null);

  // Calculate default date range (last 7 days)
  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (!dateFrom) setDateFrom(formatDate(sevenDaysAgo));
    if (!dateTo) setDateTo(formatDate(today));
  }, []);

  const { data, isLoading, error, refetch } = useGetCCTVOrdersQuery({
    page,
    limit,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    orderNumber: orderNumber || undefined
  });

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDateOnly = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    const duration = Math.round((new Date(endTime) - new Date(startTime)) / 1000);
    return `${duration} seconds`;
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTime(type);
      showSuccessToast('Time copied to clipboard!');
      setTimeout(() => setCopiedTime(null), 2000);
    }).catch(() => {
      showErrorToast('Failed to copy to clipboard');
    });
  };

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setShowDetails(true);
  };

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  const clearFilters = () => {
    setOrderNumber('');
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setDateFrom(formatDate(sevenDaysAgo));
    setDateTo(formatDate(today));
    setPage(1);
  };

  const generateCCTVURL = (order) => {
    // This is a placeholder - replace with actual CCTV system URL format
    // Example formats:
    // - For Hikvision: http://cctv-ip/playback?start={startTime}&end={endTime}
    // - For Dahua: http://cctv-ip/cgi-bin/playback?start={startTime}&end={endTime}
    // - For generic: http://cctv-ip/playback?from={startTime}&to={endTime}
    
    if (!order.billStartTime || !order.billEndTime) return null;
    
    // Get CCTV base URL from environment or settings
    const cctvBaseURL = process.env.REACT_APP_CCTV_BASE_URL || '';
    
    if (!cctvBaseURL) {
      // Return time range for manual lookup
      return {
        startTime: formatDateTime(order.billStartTime),
        endTime: formatDateTime(order.billEndTime)
      };
    }
    
    // Format times for URL (ISO 8601 format)
    const startTime = new Date(order.billStartTime).toISOString();
    const endTime = new Date(order.billEndTime).toISOString();
    
    // Adjust for buffer (±5 seconds)
    const bufferStart = new Date(new Date(startTime).getTime() - 5000).toISOString();
    const bufferEnd = new Date(new Date(endTime).getTime() + 5000).toISOString();
    
    return `${cctvBaseURL}?start=${encodeURIComponent(bufferStart)}&end=${encodeURIComponent(bufferEnd)}`;
  };

  const handleOpenCCTV = (order) => {
    const cctvURL = generateCCTVURL(order);
    
    if (typeof cctvURL === 'string') {
      // Open CCTV system in new window
      window.open(cctvURL, '_blank');
      showSuccessToast('Opening CCTV playback...');
    } else if (cctvURL && cctvURL.startTime) {
      // Show time range for manual lookup
      const timeRange = `${cctvURL.startTime} to ${cctvURL.endTime}`;
      copyToClipboard(timeRange, 'range');
      showSuccessToast('Time range copied! Use this to search in your CCTV system.');
    } else {
      showErrorToast('CCTV system URL not configured. Please configure in settings.');
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Camera className="h-8 w-8 text-blue-600" />
            CCTV Access
          </h1>
          <p className="text-gray-600 mt-2">
            Access camera recordings linked to invoices and bills
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Search & Filter</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Order Number Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order Number
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Search by order number..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-end gap-2">
            <button
              onClick={handleSearch}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Clear Filters"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">Error loading CCTV orders: {error.message || 'Unknown error'}</span>
        </div>
      ) : !data?.orders || data.orders.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No orders with CCTV timestamps found</p>
          <p className="text-gray-500 text-sm mt-2">
            Try adjusting your search filters or check if orders have been created with CCTV tracking enabled.
          </p>
        </div>
      ) : (
        <>
          {/* Orders List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Bill Start Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Bill End Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.orders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{order.orderNumber}</span>
                          {/* Show warning icon if billDate differs from CCTV date */}
                          {order.billDate && order.billStartTime && 
                           new Date(order.billDate).toDateString() !== new Date(order.billStartTime).toDateString() && (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" title="Bill date differs from CCTV recording date" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {order.billDate ? formatDateOnly(order.billDate) : formatDateOnly(order.createdAt)}
                          {order.billDate && order.billStartTime && 
                           new Date(order.billDate).toDateString() !== new Date(order.billStartTime).toDateString() && (
                            <span className="text-yellow-600 ml-1" title={`CCTV: ${formatDateOnly(order.billStartTime)}`}>
                              (CCTV: {formatDateOnly(order.billStartTime)})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-900">
                            {order.customer?.displayName || 
                             order.customerInfo?.name || 
                             'Walk-in Customer'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-green-600" />
                          <span className="text-gray-900 font-mono text-sm">
                            {formatDateTime(order.billStartTime)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(formatDateTime(order.billStartTime), `start-${order._id}`)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Copy start time"
                          >
                            {copiedTime === `start-${order._id}` ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-red-600" />
                          <span className="text-gray-900 font-mono text-sm">
                            {formatDateTime(order.billEndTime)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(formatDateTime(order.billEndTime), `end-${order._id}`)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Copy end time"
                          >
                            {copiedTime === `end-${order._id}` ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-gray-600 text-sm">
                          {calculateDuration(order.billStartTime, order.billEndTime)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-gray-900">
                          {Math.round(order.pricing?.total || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenCCTV(order)}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                            title="Open CCTV Playback"
                          >
                            <Eye className="h-4 w-4" />
                            View Footage
                          </button>
                          <button
                            onClick={() => handleViewDetails(order)}
                            className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm"
                            title="View Details"
                          >
                            <FileText className="h-4 w-4" />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination && data.pagination.pages > 1 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
                  {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{' '}
                  {data.pagination.total} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={data.pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                    disabled={data.pagination.page === data.pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Details Modal */}
      {showDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Invoice Details</h2>
                <button
                  onClick={() => {
                    setShowDetails(false);
                    setSelectedOrder(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Invoice Number</label>
                    <p className="text-gray-900 font-semibold">{selectedOrder.orderNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Date</label>
                    <p className="text-gray-900">{formatDateOnly(selectedOrder.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Customer</label>
                    <p className="text-gray-900">
                      {selectedOrder.customer?.displayName || 
                       selectedOrder.customerInfo?.name || 
                       'Walk-in Customer'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Total Amount</label>
                    <p className="text-gray-900 font-semibold">
                      {Math.round(selectedOrder.pricing?.total || 0)}
                    </p>
                  </div>
                </div>

                {/* Bill Date vs CCTV Timestamps Warning */}
                {selectedOrder.billDate && selectedOrder.billStartTime && (
                  (() => {
                    const billDateOnly = new Date(selectedOrder.billDate).toDateString();
                    const cctvDateOnly = new Date(selectedOrder.billStartTime).toDateString();
                    const isMismatch = billDateOnly !== cctvDateOnly;
                    return isMismatch ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                              Date Mismatch Detected
                            </h4>
                            <p className="text-sm text-yellow-800 mb-2">
                              This invoice has been backdated/postdated. The bill date is different from the actual CCTV recording time.
                            </p>
                            <div className="text-xs text-yellow-700 space-y-1">
                              <div><strong>Bill Date (Accounting):</strong> {formatDateOnly(selectedOrder.billDate)}</div>
                              <div><strong>CCTV Recording Date:</strong> {formatDateOnly(selectedOrder.billStartTime)}</div>
                              <div className="mt-2 italic">
                                Note: CCTV footage is available at the actual recording time, not the bill date.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()
                )}

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Camera className="h-5 w-5 text-blue-600" />
                    CCTV Timestamps
                  </h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Bill Start Time:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-mono text-sm">
                          {formatDateTime(selectedOrder.billStartTime)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(formatDateTime(selectedOrder.billStartTime), 'detail-start')}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {copiedTime === 'detail-start' ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Bill End Time:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-mono text-sm">
                          {formatDateTime(selectedOrder.billEndTime)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(formatDateTime(selectedOrder.billEndTime), 'detail-end')}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {copiedTime === 'detail-end' ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Duration:</span>
                      <span className="text-gray-900">
                        {calculateDuration(selectedOrder.billStartTime, selectedOrder.billEndTime)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <button
                      onClick={() => handleOpenCCTV(selectedOrder)}
                      className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="h-5 w-5" />
                      Open CCTV Playback
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CCTVAccess;
