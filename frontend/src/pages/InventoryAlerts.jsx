import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  TrendingDown,
  Layers,
  Package,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  useGetLowStockAlertsQuery,
  useGetAlertSummaryQuery,
  useGeneratePurchaseOrdersMutation,
} from '../store/services/inventoryApi';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '../components/LoadingSpinner';

const LIMIT_OPTIONS = [50, 500, 1000, 5000];

const InventoryAlerts = () => {
  const navigate = useNavigate();
  const [filterLevel, setFilterLevel] = useState('all'); // 'all', 'critical', 'warning'
  const [currentPage, setCurrentPage] = useState(1);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(50);
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

  // Fetch low stock alerts
  const { 
    data: alertsResponse, 
    isLoading, 
    error, 
    refetch 
  } = useGetLowStockAlertsQuery(
    {
      includeOutOfStock: filterLevel === 'all' || filterLevel === 'critical',
      includeCritical: filterLevel === 'all' || filterLevel === 'critical',
      includeWarning: filterLevel === 'all' || filterLevel === 'warning',
      page: currentPage,
      limit,
      ...(searchTerm.trim() && { search: searchTerm.trim() })
    },
    {
      pollingInterval: 30000, // Refetch every 30 seconds
    }
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filterLevel, searchTerm, limit]);

  useEffect(() => {
    if (isLoading) return;
    const id = requestAnimationFrame(() => updateTableScrollState());
    return () => cancelAnimationFrame(id);
  }, [alertsResponse, isLoading, updateTableScrollState]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => updateTableScrollState());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateTableScrollState]);

  // Fetch alert summary
  const { data: summaryResponse } = useGetAlertSummaryQuery(undefined, {
    pollingInterval: 30000,
  });

  // Generate purchase orders mutation
  const [generatePurchaseOrders, { isLoading: generating }] = useGeneratePurchaseOrdersMutation();

  const handleGeneratePOs = async () => {
    const params = {
      autoConfirm: autoConfirm.toString(),
      supplierPreference: 'primary',
      groupBySupplier: 'true'
    };

    try {
      const response = await generatePurchaseOrders(params).unwrap();
      const count = response?.count || 0;
      const message = response?.message || `Successfully generated ${count} purchase order(s)`;
      
      if (count > 0) {
        showSuccessToast(message);
        // Navigate to purchase orders after a short delay
        setTimeout(() => {
          navigate('/purchase-orders');
        }, 1500);
      } else {
        // Show detailed message about why no POs were generated
        let reasonMessage = message;
        if (response?.unassignedProducts?.length > 0) {
          reasonMessage += `. ${response.unassignedProducts.length} product(s) could not be assigned to suppliers (no purchase history found).`;
        }
        if (response?.errors?.length > 0) {
          reasonMessage += ` ${response.errors.length} error(s) occurred during generation.`;
        }
        showErrorToast(reasonMessage);
      }
    } catch (error) {
      showErrorToast(handleApiError(error));
    }
  };

  // Extract data from response
  const alertsData = alertsResponse?.data?.data || alertsResponse?.data || alertsResponse || [];
  const alerts = Array.isArray(alertsData) ? alertsData : [];
  const summary = summaryResponse?.data?.data || summaryResponse?.data || summaryResponse || {};

  const outOfStockCount = summary.outOfStock || 0;
  const warningCount = summary.warning || 0;
  const belowMinimumCount =
    summary.belowMinimum != null
      ? summary.belowMinimum
      : Math.max(0, (summary.critical || 0) - outOfStockCount);

  const pagination = {
    current: alertsResponse?.data?.pagination?.page ?? alertsResponse?.pagination?.page ?? 1,
    pages: alertsResponse?.data?.pagination?.pages ?? alertsResponse?.pagination?.pages ?? 1,
    total: alertsResponse?.data?.pagination?.total ?? alertsResponse?.pagination?.total ?? alerts.length,
    limit: alertsResponse?.data?.pagination?.limit ?? alertsResponse?.pagination?.limit ?? limit
  };
  pagination.hasPrev = pagination.current > 1;
  pagination.hasNext = pagination.current < pagination.pages;

  const getAlertBadgeColor = (level) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (urgency) => {
    if (urgency >= 80) return 'text-red-600 font-bold';
    if (urgency >= 60) return 'text-orange-600 font-semibold';
    if (urgency >= 40) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory Alerts</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Monitor low stock and auto-generate purchase orders</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={handleGeneratePOs}
            disabled={generating || alerts.length === 0}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Generate Purchase Orders</span>
            <span className="sm:hidden">Generate POs</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <div
          className="bg-white rounded-lg shadow p-3 sm:p-4"
          title="All active products that qualify as an inventory alert (critical severity plus warning severity)."
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Total Alerts</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{summary.total || 0}</p>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-1.5 leading-snug">
                <span className="whitespace-nowrap">{outOfStockCount} out of stock</span>
                <span className="text-gray-300 mx-1">·</span>
                <span className="whitespace-nowrap">{belowMinimumCount} below min</span>
                <span className="text-gray-300 mx-1">·</span>
                <span className="whitespace-nowrap">{warningCount} warnings</span>
              </p>
            </div>
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div
          className="bg-red-50 rounded-lg shadow p-3 sm:p-4 border-l-4 border-red-500"
          title="Zero stock or at/below minimum stock — includes out-of-stock rows and below-minimum rows."
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-red-600 truncate">Critical</p>
              <p className="text-lg sm:text-2xl font-bold text-red-700">{summary.critical || 0}</p>
            </div>
            <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div
          className="bg-yellow-50 rounded-lg shadow p-3 sm:p-4 border-l-4 border-yellow-500"
          title="Stock above minimum but at or below the reorder point (yellow severity)."
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-yellow-600 truncate">Warning</p>
              <p className="text-lg sm:text-2xl font-bold text-yellow-700">{summary.warning || 0}</p>
            </div>
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div
          className="bg-gray-50 rounded-lg shadow p-3 sm:p-4 border-l-4 border-gray-500"
          title="Products with zero on-hand quantity."
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Out of Stock</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-700">{outOfStockCount}</p>
            </div>
            <Package className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div
          className="bg-orange-50 rounded-lg shadow p-3 sm:p-4 border-l-4 border-orange-500"
          title="Still has stock but quantity is at or below the minimum level (subset of Critical, excluding zero stock)."
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-orange-800 truncate leading-tight">Below minimum</p>
              <p className="text-[10px] sm:text-[11px] text-orange-700/90 -mt-0.5 mb-0.5">In stock</p>
              <p className="text-lg sm:text-2xl font-bold text-orange-800">{belowMinimumCount}</p>
            </div>
            <Layers className="h-6 w-6 sm:h-8 sm:w-8 text-orange-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div
          className="bg-blue-50 rounded-lg shadow p-3 sm:p-4 border-l-4 border-blue-500"
          title="Reorder warning only: above minimum stock but still at or below reorder point."
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-blue-600 truncate leading-tight">Reorder warning</p>
              <p className="text-[10px] sm:text-[11px] text-blue-700/90 -mt-0.5 mb-0.5">Approaching reorder</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-700">{summary.lowStock || 0}</p>
            </div>
            <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
            <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Filter by Level:</label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="input w-full sm:w-auto"
            >
              <option value="all">All Alerts</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warning Only</option>
            </select>
            <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Show:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="input w-auto"
              >
                {LIMIT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2 ml-auto">
              <input
                type="checkbox"
                id="autoConfirm"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="autoConfirm" className="text-sm text-gray-700">
                Auto-confirm generated POs
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            Error loading alerts: {handleApiError(error).message}
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No low stock alerts at this time</p>
            <p className="text-gray-400 text-sm mt-2">All products are well stocked!</p>
          </div>
        ) : (
          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => scrollTableBy(-280)}
              disabled={!canScrollTableLeft}
              aria-label="Scroll table left"
              title="Scroll left"
              className="flex-shrink-0 flex items-center justify-center w-9 sm:w-10 border-r border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <div
              ref={tableScrollRef}
              onScroll={updateTableScrollState}
              className="flex-1 min-w-0 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reorder Point
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Until Out
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Suggested Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Urgency
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alerts.map((alert, index) => (
                  <tr
                    key={alert.product._id}
                    className={`hover:bg-gray-50 ${
                      alert.alertLevel === 'critical' ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {alert.product.name}
                          </div>
                          {alert.product.sku && (
                            <div className="text-sm text-gray-500">SKU: {alert.product.sku}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {alert.inventory.currentStock}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {alert.inventory.reorderPoint}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getUrgencyColor(alert.urgency)}`}>
                        {alert.daysUntilOutOfStock} days
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getAlertBadgeColor(
                          alert.alertLevel
                        )}`}
                      >
                        {alert.stockStatus === 'out_of_stock'
                          ? 'Out of Stock'
                          : alert.stockStatus === 'critical'
                          ? 'Critical'
                          : 'Low Stock'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {alert.suggestedReorderQuantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className={`h-2 rounded-full ${
                              alert.urgency >= 80
                                ? 'bg-red-600'
                                : alert.urgency >= 60
                                ? 'bg-orange-600'
                                : alert.urgency >= 40
                                ? 'bg-yellow-600'
                                : 'bg-gray-400'
                            }`}
                            style={{ width: `${alert.urgency}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{alert.urgency}%</span>
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
              className="flex-shrink-0 flex items-center justify-center w-9 sm:w-10 border-l border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && alerts.length > 0 && pagination.pages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 px-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing{' '}
              <span className="font-medium">
                {(pagination.current - 1) * pagination.limit + 1}
              </span>
              {' - '}
              <span className="font-medium">
                {Math.min(pagination.current * pagination.limit, pagination.total)}
              </span>
              {' of '}
              <span className="font-medium">{pagination.total}</span>
              {' alerts'}
            </p>
            <nav className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrev}
                variant="outline"
                size="sm"
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600 px-2">
                Page {pagination.current} of {pagination.pages}
              </span>
              <Button
                onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={!pagination.hasNext}
                variant="outline"
                size="sm"
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </Button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryAlerts;

