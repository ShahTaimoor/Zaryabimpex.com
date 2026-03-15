import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  Star,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  AlertCircle,
  ShoppingCart,
  Truck,
  Calendar,
  FileText,
  Settings
} from 'lucide-react';

import {
  useGetReportsQuery,
  useGetQuickSummaryQuery,
  useGetQuickStockLevelsQuery,
  useGetQuickTurnoverRatesQuery,
  useGetQuickAgingAnalysisQuery,
  useDeleteReportMutation,
  useExportReportMutation,
} from '../store/services/inventoryApi';
import { handleApiError } from '../utils/errorHandler';
import CreateInventoryReportModal from '../components/CreateInventoryReportModal';
import InventoryReportFilters from '../components/InventoryReportFilters';
import InventoryReportDetailModal from '../components/InventoryReportDetailModal';

const InventoryReports = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    reportType: '',
    status: '',
    generatedBy: '',
    startDate: '',
    endDate: '',
    sortBy: 'generatedAt',
    sortOrder: 'desc'
  });

  // Fetch reports
  const { data: reportsData, isLoading: reportsLoading, error: reportsError } = useGetReportsQuery(
    filters,
    {
      onError: (error) => {
        handleApiError(error, 'Inventory Reports');
      }
    }
  );

  // Fetch quick summary data
  const { data: quickSummary, isLoading: summaryLoading, error: summaryError } = useGetQuickSummaryQuery(
    undefined,
    {
      retry: 1,
      refetchOnFocus: false
    }
  );

  // Fetch quick stock levels
  const { data: quickStockLevels, isLoading: stockLevelsLoading } = useGetQuickStockLevelsQuery(
    { limit: 5 },
    {
      retry: 1,
      refetchOnFocus: false
    }
  );

  // Fetch quick turnover rates
  const { data: quickTurnoverRates, isLoading: turnoverRatesLoading } = useGetQuickTurnoverRatesQuery(
    { limit: 5, period: '30d' },
    {
      retry: 1,
      refetchOnFocus: false
    }
  );

  // Fetch quick aging analysis
  const { data: quickAgingAnalysis, isLoading: agingAnalysisLoading } = useGetQuickAgingAnalysisQuery(
    { limit: 5, threshold: 90 },
    {
      retry: 1,
      refetchOnFocus: false
    }
  );


  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    setFilters(prev => ({ ...prev, search: term, page: 1 }));
  };

  const handleViewReport = (report) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  };

  const handleDeleteReportClick = async (reportId) => {
    if (window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      await handleDeleteReport(reportId);
    }
  };

  const handleExportReportClick = async (reportId, format) => {
    try {
      const blob = await exportReport({ id: reportId, format }).unwrap();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-report-${reportId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      handleApiError(error, 'Export Report');
    }
  };

  const handleRefresh = () => {
    // RTK Query will automatically refetch on component remount or when dependencies change
    toast.success('Data refreshed');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'generating':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'archived':
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'generating':
        return 'text-blue-600 bg-blue-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'archived':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getReportTypeIcon = (type) => {
    switch (type) {
      case 'stock_levels':
        return <Package className="h-4 w-4" />;
      case 'turnover_rates':
        return <TrendingUp className="h-4 w-4" />;
      case 'aging_analysis':
        return <Clock className="h-4 w-4" />;
      case 'comprehensive':
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getReportTypeColor = (type) => {
    switch (type) {
      case 'stock_levels':
        return 'text-blue-600 bg-blue-50';
      case 'turnover_rates':
        return 'text-green-600 bg-green-50';
      case 'aging_analysis':
        return 'text-orange-600 bg-orange-50';
      case 'comprehensive':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('en-US').format(number);
  };

  const formatPercentage = (percentage) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`;
  };

  const reports = reportsData?.reports || [];
  const pagination = reportsData?.pagination || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Comprehensive inventory analytics including stock levels, turnover rates, and aging analysis
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Error Display */}
      {summaryError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading inventory summary
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{summaryError.response?.data?.message || summaryError.message}</p>
                {summaryError.response?.data?.details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">Technical details</summary>
                    <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                      {summaryError.response.data.details}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Dashboard */}
      {quickSummary && (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Products */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Products</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatNumber(quickSummary.summary?.totalProducts || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Total Stock Value */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Stock Value</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatCurrency(quickSummary.summary?.totalStockValue || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Low Stock</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatNumber(quickSummary.alerts?.lowStock || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Out of Stock Alert */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Out of Stock</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatNumber(quickSummary.alerts?.outOfStock || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Stock Levels */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Stock Level Alerts
            </h3>
            {stockLevelsLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : quickStockLevels?.stockLevels?.length > 0 ? (
              <div className="space-y-3">
                {quickStockLevels.stockLevels.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-3 ${item.metrics.stockStatus === 'out_of_stock' ? 'bg-red-500' :
                          item.metrics.stockStatus === 'low_stock' ? 'bg-orange-500' :
                            'bg-green-500'
                        }`}></div>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.product.name}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatNumber(item.metrics.currentStock)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No stock level data available</p>
            )}
          </div>
        </div>

        {/* Top Turnover Rates */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Fast Moving Products
            </h3>
            {turnoverRatesLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : quickTurnoverRates?.turnoverRates?.length > 0 ? (
              <div className="space-y-3">
                {quickTurnoverRates.turnoverRates.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <TrendingUp className="h-4 w-4 text-green-500 mr-3" />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.product.name}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {item.metrics.turnoverRate.toFixed(1)}x
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No turnover data available</p>
            )}
          </div>
        </div>

        {/* Aging Analysis */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Aging Inventory
            </h3>
            {agingAnalysisLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : quickAgingAnalysis?.agingAnalysis?.length > 0 ? (
              <div className="space-y-3">
                {quickAgingAnalysis.agingAnalysis.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-orange-500 mr-3" />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.product.name}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {item.metrics.daysInStock}d
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No aging data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex flex-row items-center justify-between gap-3">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-3 py-2 border text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${showFilters
                    ? 'border-blue-500 text-blue-700 bg-blue-50'
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                  }`}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4">
              <InventoryReportFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onClose={() => setShowFilters(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Inventory Reports
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Generated inventory reports with detailed analytics
          </p>
        </div>

        {reportsLoading ? (
          <div className="px-4 py-5 sm:px-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div className="px-4 py-5 sm:px-6 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No reports found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by generating your first inventory report.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Generate Report
              </button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {reports.map((report) => (
              <li key={report._id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {getReportTypeIcon(report.reportType)}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-blue-600 truncate">
                            {report.reportName}
                          </p>
                          {report.isFavorite && (
                            <Star className="ml-2 h-4 w-4 text-yellow-400 fill-current" />
                          )}
                        </div>
                        <div className="mt-1 flex items-center space-x-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getReportTypeColor(report.reportType)}`}>
                            {report.reportType.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                            {getStatusIcon(report.status)}
                            <span className="ml-1">{report.status.toUpperCase()}</span>
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(report.generatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewReport(report)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Report"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(report.reportId, !report.isFavorite)}
                        className={`${report.isFavorite ? 'text-yellow-400' : 'text-gray-400'} hover:text-yellow-400`}
                        title={report.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star className={`h-4 w-4 ${report.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleExportReportClick(report.reportId, 'pdf')}
                        className="text-gray-400 hover:text-gray-600"
                        title="Export Report"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteReportClick(report.reportId)}
                        className="text-red-400 hover:text-red-600"
                        title="Delete Report"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={!pagination.hasPrev}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
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
                  <span className="font-medium">{(pagination.current - 1) * filters.limit + 1}</span>
                  {' '}to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.current * filters.limit, pagination.total)}
                  </span>
                  {' '}of{' '}
                  <span className="font-medium">{pagination.total}</span>
                  {' '}results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={!pagination.hasPrev}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {[...Array(pagination.pages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setFilters(prev => ({ ...prev, page: i + 1 }))}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${pagination.current === i + 1
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
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
        <CreateInventoryReportModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            // RTK Query will automatically refetch on component remount or when dependencies change
          }}
        />
      )}

      {showDetailModal && selectedReport && (
        <InventoryReportDetailModal
          report={selectedReport}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReport(null);
          }}
          onExport={handleExportReport}
          onDelete={handleDeleteReport}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </div>
  );
};

export default InventoryReports;
