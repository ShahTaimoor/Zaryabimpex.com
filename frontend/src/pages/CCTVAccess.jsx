import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useGetCCTVOrdersQuery } from '../store/services/salesApi';
import { LoadingSpinner } from '../components/LoadingSpinner';
import DateFilter from '../components/DateFilter';
import { getDatePresets } from '../utils/dateUtils';
import { showSuccessToast, showErrorToast } from '../utils/errorHandler';

const CCTVAccess = ({ tabId }) => {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [dateFrom, setDateFrom] = useState(() => getDatePresets().last7Days.startDate);
  const [dateTo, setDateTo] = useState(() => getDatePresets().last7Days.endDate);
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [copiedTime, setCopiedTime] = useState(null);

  const tableScrollRef = useRef(null);
  const [canScrollTableLeft, setCanScrollTableLeft] = useState(false);
  const [canScrollTableRight, setCanScrollTableRight] = useState(false);

  const updateTableScrollState = useCallback(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setCanScrollTableLeft(scrollLeft > 4);
    setCanScrollTableRight(max > 4 && scrollLeft < max - 4);
  }, []);

  const scrollTableBy = (delta) => {
    const el = tableScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const { data, isLoading, error, refetch } = useGetCCTVOrdersQuery({
    page,
    limit,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    orderNumber: orderNumber || undefined
  });

  // Normalize orders from API (backend returns snake_case; support both and add fallbacks for missing CCTV fields)
  // Use created_at/updated_at so bill times show real time (not 00:00:00) and duration can be calculated
  const orders = React.useMemo(() => {
    const raw = data?.orders || [];
    return raw.map((o) => {
      const customer = o.customer || {};
      const displayName = customer.displayName ?? customer.business_name ?? customer.businessName ?? customer.name ?? 'Walk-in Customer';
      const saleDate = o.sale_date || o.saleDate || o.created_at || o.createdAt;
      const createdAt = o.created_at ?? o.createdAt;
      const updatedAt = o.updated_at ?? o.updatedAt;
      const total = o.total != null ? o.total : (o.pricing?.total ?? 0);
      // Prefer real CCTV timestamps; else use created_at (has time) and updated_at so duration can show
      const billStart = o.bill_start_time ?? o.billStartTime ?? createdAt ?? saleDate;
      const billEnd = o.bill_end_time ?? o.billEndTime ?? updatedAt ?? createdAt ?? saleDate;
      return {
        _id: o.id || o._id,
        id: o.id || o._id,
        orderNumber: o.order_number ?? o.orderNumber ?? 'N/A',
        billDate: o.bill_date ?? o.billDate ?? saleDate,
        billStartTime: billStart,
        billEndTime: billEnd,
        customer: { ...customer, displayName },
        customerInfo: { name: displayName },
        pricing: { total },
        createdAt
      };
    });
  }, [data?.orders]);

  useEffect(() => {
    if (isLoading) return;
    const id = requestAnimationFrame(() => updateTableScrollState());
    return () => cancelAnimationFrame(id);
  }, [orders, isLoading, updateTableScrollState]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => updateTableScrollState());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateTableScrollState]);

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
    const seconds = Math.round((new Date(endTime) - new Date(startTime)) / 1000);
    if (seconds <= 0) return '—';
    if (seconds < 60) return `${seconds} sec`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) return `${mins} min`;
    return `${mins} min ${secs} sec`;
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
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 via-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex gap-4 min-w-0">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-lg shadow-slate-900/20">
              <Camera className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                CCTV Access
              </h1>
              <p className="mt-1 text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
                Find invoices and open matching camera playback windows using bill timestamps.
              </p>
            </div>
          </div>
        </header>

        {/* Filters */}
        <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/50 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-slate-700 via-blue-600 to-slate-700" aria-hidden />
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600">
                <Filter className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Search &amp; filter</h2>
                <p className="text-xs text-slate-500 hidden sm:block">Filter by order number and sale date range</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-4">
              <div className="min-w-0 lg:flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Order number
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="e.g. INV-1001"
                    className="w-full h-10 pl-10 pr-3 text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 transition-colors"
                  />
                </div>
              </div>

              <div className="min-w-0 lg:flex-[1.35]">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  <Calendar className="inline h-3.5 w-3.5 mr-1 -mt-0.5 text-slate-400" aria-hidden />
                  Date range
                </label>
                <DateFilter
                  compact
                  startDate={dateFrom}
                  endDate={dateTo}
                  onDateChange={(start, end) => {
                    setDateFrom(start || '');
                    setDateTo(end || '');
                  }}
                  showPresets={false}
                  showClear={false}
                  showLabel={false}
                  className="min-w-0 [&_button]:h-10 [&_button]:min-h-[2.5rem] [&_button]:rounded-xl [&_button]:border-slate-200 [&_button]:bg-slate-50/50 [&_button]:shadow-none [&_button]:hover:bg-white [&_button]:text-slate-900"
                />
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={handleSearch}
                  className="w-full lg:w-auto min-w-[7.5rem] inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-colors"
                >
                  <Search className="h-4 w-4 shrink-0" />
                  Search
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Results */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-16 sm:py-20">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-slate-500">Loading orders…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 sm:p-5 flex items-start gap-3 shadow-sm">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Couldn&apos;t load CCTV orders</p>
              <p className="text-sm text-red-800/90 mt-1">{error.message || 'Unknown error'}</p>
            </div>
          </div>
        ) : !orders.length ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 sm:p-14 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-5">
              <Camera className="h-8 w-8" aria-hidden />
            </div>
            <p className="text-lg font-semibold text-slate-800">No orders in this range</p>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
              Try another order number or widen the date range, then search again.
            </p>
          </div>
        ) : (
        <>
          {/* Orders List */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40 overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 sm:px-6 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Matching invoices</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bill times are used for CCTV playback windows</p>
              </div>
              <Link
                to="/inventory-alerts"
                className="inline-flex items-center gap-0.5 text-sm font-medium text-slate-700 hover:text-slate-900 shrink-0"
              >
                Inventory alerts
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => scrollTableBy(-280)}
                disabled={!canScrollTableLeft}
                aria-label="Scroll table left"
                title="Scroll left"
                className="flex-shrink-0 flex items-center justify-center w-9 sm:w-10 border-r border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <div
                ref={tableScrollRef}
                onScroll={updateTableScrollState}
                className="flex-1 min-w-0 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
              <table className="w-full min-w-[900px] table-auto">
                <thead className="bg-slate-50/90 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-[140px]">
                      Invoice #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-[120px]">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-[160px]">
                      Bill Start Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-[160px]">
                      Bill End Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-[100px] whitespace-nowrap">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-[80px] whitespace-nowrap">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-[180px] whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-900">{order.orderNumber}</span>
                          {/* Show warning icon if billDate differs from CCTV date */}
                          {order.billDate && order.billStartTime && 
                           new Date(order.billDate).toDateString() !== new Date(order.billStartTime).toDateString() && (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" title="Bill date differs from CCTV recording date" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {order.billDate ? formatDateOnly(order.billDate) : formatDateOnly(order.createdAt)}
                          {order.billDate && order.billStartTime && 
                           new Date(order.billDate).toDateString() !== new Date(order.billStartTime).toDateString() && (
                            <span className="text-amber-600 ml-1" title={`CCTV: ${formatDateOnly(order.billStartTime)}`}>
                              (CCTV: {formatDateOnly(order.billStartTime)})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-900">
                            {order.customer?.displayName || 
                             order.customerInfo?.name || 
                             'Walk-in Customer'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-slate-900 font-mono text-sm">
                            {formatDateTime(order.billStartTime)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(formatDateTime(order.billStartTime), `start-${order._id}`)}
                            className="text-slate-600 hover:text-slate-900 transition-colors"
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
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-red-600 flex-shrink-0" />
                          <span className="text-slate-900 font-mono text-sm">
                            {formatDateTime(order.billEndTime)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(formatDateTime(order.billEndTime), `end-${order._id}`)}
                            className="text-slate-600 hover:text-slate-900 transition-colors"
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
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-slate-600 text-sm">
                          {calculateDuration(order.billStartTime, order.billEndTime)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">
                          {Math.round(order.pricing?.total || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenCCTV(order)}
                            className="bg-slate-900 text-white px-3 py-1.5 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 text-sm flex-shrink-0 shadow-sm"
                            title="Open CCTV Playback"
                          >
                            <Eye className="h-4 w-4" />
                            View Footage
                          </button>
                          <button
                            onClick={() => handleViewDetails(order)}
                            className="border border-slate-200 bg-white text-slate-700 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm flex-shrink-0"
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
              <button
                type="button"
                onClick={() => scrollTableBy(280)}
                disabled={!canScrollTableRight}
                aria-label="Scroll table right"
                title="Scroll right"
                className="flex-shrink-0 flex items-center justify-center w-9 sm:w-10 border-l border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Pagination */}
            {data?.pagination && data.pagination.pages > 1 && (
              <div className="bg-slate-50/90 px-4 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-slate-600">
                  Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
                  {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{' '}
                  {data.pagination.total} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={data.pagination.page === 1}
                    className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                    disabled={data.pagination.page === data.pagination.pages}
                    className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/20">
            <div className="h-1 bg-gradient-to-r from-slate-700 via-blue-600 to-slate-700" aria-hidden />
            <div className="overflow-y-auto max-h-[calc(90vh-0.25rem)] p-6 sm:p-8">
              <div className="flex justify-between items-start gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Invoice details</h2>
                  <p className="text-sm text-slate-500 mt-1">Review timestamps before opening playback</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetails(false);
                    setSelectedOrder(null);
                  }}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice number</label>
                    <p className="text-slate-900 font-semibold mt-1">{selectedOrder.orderNumber}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</label>
                    <p className="text-slate-900 mt-1">{formatDateOnly(selectedOrder.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</label>
                    <p className="text-slate-900 mt-1">
                      {selectedOrder.customer?.displayName || 
                       selectedOrder.customerInfo?.name || 
                       'Walk-in Customer'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total amount</label>
                    <p className="text-slate-900 font-semibold mt-1">
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
                      <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-amber-950 mb-1">
                              Date mismatch detected
                            </h4>
                            <p className="text-sm text-amber-900/90 mb-2">
                              This invoice has been backdated/postdated. The bill date is different from the actual CCTV recording time.
                            </p>
                            <div className="text-xs text-amber-900/80 space-y-1">
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

                <div className="border-t border-slate-100 pt-4 mt-4">
                  <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Camera className="h-4 w-4" aria-hidden />
                    </span>
                    CCTV timestamps
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-sm font-medium text-slate-600">Bill start time</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-900 font-mono text-sm truncate">
                          {formatDateTime(selectedOrder.billStartTime)}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formatDateTime(selectedOrder.billStartTime), 'detail-start')}
                          className="text-slate-600 hover:text-slate-900 shrink-0"
                        >
                          {copiedTime === 'detail-start' ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-sm font-medium text-slate-600">Bill end time</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-900 font-mono text-sm truncate">
                          {formatDateTime(selectedOrder.billEndTime)}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formatDateTime(selectedOrder.billEndTime), 'detail-end')}
                          className="text-slate-600 hover:text-slate-900 shrink-0"
                        >
                          {copiedTime === 'detail-end' ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
                      <span className="text-sm font-medium text-slate-600">Duration</span>
                      <span className="text-slate-900 font-medium">
                        {calculateDuration(selectedOrder.billStartTime, selectedOrder.billEndTime)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => handleOpenCCTV(selectedOrder)}
                      className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 font-semibold shadow-md shadow-slate-900/15"
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
    </div>
  );
};

export default CCTVAccess;
