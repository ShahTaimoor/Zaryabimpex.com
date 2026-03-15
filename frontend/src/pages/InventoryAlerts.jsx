import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  ShoppingCart,
  TrendingDown,
  Package,
  CheckCircle,
  XCircle,
  Loader2,
  Zap
} from 'lucide-react';
import {
  useGetLowStockAlertsQuery,
  useGetAlertSummaryQuery,
  useGeneratePurchaseOrdersMutation,
} from '../store/services/inventoryApi';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { formatCurrency } from '../utils/formatters';
import { LoadingSpinner } from '../components/LoadingSpinner';

const InventoryAlerts = () => {
  const navigate = useNavigate();
  const [filterLevel, setFilterLevel] = useState('all'); // 'all', 'critical', 'warning'
  const [autoConfirm, setAutoConfirm] = useState(false);

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
      includeWarning: filterLevel === 'all' || filterLevel === 'warning'
    },
    {
      pollingInterval: 30000, // Refetch every 30 seconds
    }
  );

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
          <button
            onClick={handleGeneratePOs}
            disabled={generating || alerts.length === 0}
            className="btn btn-primary btn-md flex items-center justify-center gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Generate Purchase Orders</span>
            <span className="sm:hidden">Generate POs</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Total Alerts</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{summary.total || 0}</p>
            </div>
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-3 sm:p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-red-600 truncate">Critical</p>
              <p className="text-lg sm:text-2xl font-bold text-red-700">{summary.critical || 0}</p>
            </div>
            <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-3 sm:p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-yellow-600 truncate">Warning</p>
              <p className="text-lg sm:text-2xl font-bold text-yellow-700">{summary.warning || 0}</p>
            </div>
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-3 sm:p-4 border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Out of Stock</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-700">{summary.outOfStock || 0}</p>
            </div>
            <Package className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-3 sm:p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-blue-600 truncate">Low Stock</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-700">{summary.lowStock || 0}</p>
            </div>
            <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Filter by Level:</label>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="input"
          >
            <option value="all">All Alerts</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warning Only</option>
          </select>
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
          <div className="overflow-x-auto">
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
        )}
      </div>
    </div>
  );
};

export default InventoryAlerts;

