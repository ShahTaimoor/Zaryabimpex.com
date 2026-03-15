import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Package,
  UserCheck,
  Calendar,
  Download,
  Filter,
  Search,
  Plus,
  Star,
  MoreVertical,
  Eye,
  Trash2,
  Edit,
  Tag,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  ShoppingCart,
  Target
} from 'lucide-react';
import {
  useGetReportsQuery,
  useGetReportQuery,
  useGetQuickSummaryQuery,
  useGetQuickTopProductsQuery,
  useGetQuickTopCustomersQuery,
  useDeleteReportMutation,
  useToggleFavoriteMutation,
  useExportReportMutation,
} from '../store/services/salesPerformanceApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import toast from 'react-hot-toast';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import AsyncErrorBoundary from '../components/AsyncErrorBoundary';
import { useResponsive, ResponsiveContainer, ResponsiveGrid } from '../components/ResponsiveContainer';
import CreateSalesPerformanceReportModal from '../components/CreateSalesPerformanceReportModal';
import SalesPerformanceDetailModal from '../components/SalesPerformanceDetailModal';
import SalesPerformanceFilters from '../components/SalesPerformanceFilters';

const SalesPerformanceReports = () => {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { isMobile, isTablet } = useResponsive();

  // Fetch reports
  const { data: reportsData, isLoading: reportsLoading, error: reportsError, refetch: refetchReports } = useGetReportsQuery(
    filters,
    {
      onError: (error) => {
        handleApiError(error, 'Sales Performance Reports');
      }
    }
  );

  // Get selected report details
  const { data: selectedReportData } = useGetReportQuery(selectedReport?._id, {
    skip: !selectedReport?._id,
  });

  // Fetch quick summary data
  const { data: quickSummary, isLoading: summaryLoading } = useGetQuickSummaryQuery(
    { period: '30d' },
    {
      retry: 1,
      refetchOnFocus: false
    }
  );

  // Fetch quick top products
  const { data: quickTopProducts, isLoading: topProductsLoading } = useGetQuickTopProductsQuery(
    { period: '30d', limit: 5 },
    {
      retry: 1,
      refetchOnFocus: false
    }
  );

  // Fetch quick top customers
  const { data: quickTopCustomersByRevenue, isLoading: topCustomersRevenueLoading } = useGetQuickTopCustomersQuery(
    { period: '30d', limit: 5, metric: 'revenue' },
    {
      retry: 1,
      refetchOnFocus: false
    }
  );

  const { data: quickTopCustomersByProfit, isLoading: topCustomersProfitLoading } = useGetQuickTopCustomersQuery(
    { period: '30d', limit: 5, metric: 'profit' },
    {
      retry: 1,
      refetchOnFocus: false
    }
  );

  // Mutations
  const [deleteReport] = useDeleteReportMutation();
  const [toggleFavorite] = useToggleFavoriteMutation();
  const [exportReport] = useExportReportMutation();

  React.useEffect(() => {
    if (selectedReportData?.data) {
      setSelectedReport(selectedReportData.data);
    }
  }, [selectedReportData]);

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

  const handleDeleteReport = async (reportId) => {
    if (window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      try {
        await deleteReport(reportId).unwrap();
        toast.success('Report deleted successfully');
        refetchReports();
      } catch (error) {
        handleApiError(error, 'Delete Report');
      }
    }
  };

  const handleToggleFavorite = async (reportId, isFavorite) => {
    try {
      await toggleFavorite({ id: reportId, isFavorite }).unwrap();
      toast.success('Favorite status updated');
      refetchReports();
    } catch (error) {
      handleApiError(error, 'Update Favorite');
    }
  };

  const handleExportReport = async (reportId, format) => {
    try {
      const blob = await exportReport({ id: reportId, format }).unwrap();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-performance-report-${reportId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Report exported as ${format.toUpperCase()} successfully!`);
    } catch (error) {
      handleApiError(error, 'Export Report');
    }
  };

  const handleRefresh = () => {
    refetchReports();
    // RTK Query will automatically refetch based on cache tags
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
      case 'top_products':
        return <Package className="h-4 w-4" />;
      case 'top_customers':
        return <Users className="h-4 w-4" />;
      case 'top_sales_reps':
        return <UserCheck className="h-4 w-4" />;
      case 'comprehensive':
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getReportTypeLabel = (type) => {
    switch (type) {
      case 'top_products':
        return 'Top Products';
      case 'top_customers':
        return 'Top Customers';
      case 'top_sales_reps':
        return 'Top Sales Reps';
      case 'comprehensive':
        return 'Comprehensive';
      default:
        return 'Custom';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (reportsError) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading reports</h3>
          <p className="mt-1 text-sm text-gray-500">{reportsError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <AsyncErrorBoundary>
      <ResponsiveContainer className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Performance Reports</h1>
            <p className="mt-1 text-sm text-gray-500">
              Analyze top products, customers, and sales performance
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Report
            </button>
          </div>
        </div>

        {/* Quick Stats Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Revenue */}
          <div className="card">
            <div className="card-content pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
                </div>
                <div className="ml-2 md:ml-4 min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-medium text-gray-500 truncate">Total Revenue (30d)</p>
                  <div className="flex items-center">
                    <p className="text-lg md:text-2xl font-semibold text-gray-900">
                      {summaryLoading ? (
                        <LoadingInline />
                      ) : (
                        formatCurrency(quickSummary?.summary?.totalRevenue || 0)
                      )}
                    </p>
                    {quickSummary?.comparison?.changes?.revenueChangePercentage !== undefined && (
                      <span className={`ml-2 text-sm ${quickSummary.comparison.changes.revenueChangePercentage >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                        }`}>
                        {quickSummary.comparison.changes.revenueChangePercentage >= 0 ? (
                          <TrendingUp className="h-4 w-4 inline" />
                        ) : (
                          <TrendingDown className="h-4 w-4 inline" />
                        )}
                        {formatPercentage(quickSummary.comparison.changes.revenueChangePercentage)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Total Orders */}
          <div className="card">
            <div className="card-content pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ShoppingCart className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                </div>
                <div className="ml-2 md:ml-4 min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-medium text-gray-500 truncate">Total Orders (30d)</p>
                  <div className="flex items-center">
                    <p className="text-lg md:text-2xl font-semibold text-gray-900">
                      {summaryLoading ? (
                        <LoadingInline />
                      ) : (
                        (quickSummary?.summary?.totalOrders || 0).toLocaleString()
                      )}
                    </p>
                    {quickSummary?.comparison?.changes?.orderChangePercentage !== undefined && (
                      <span className={`ml-2 text-sm ${quickSummary.comparison.changes.orderChangePercentage >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                        }`}>
                        {quickSummary.comparison.changes.orderChangePercentage >= 0 ? (
                          <TrendingUp className="h-4 w-4 inline" />
                        ) : (
                          <TrendingDown className="h-4 w-4 inline" />
                        )}
                        {formatPercentage(quickSummary.comparison.changes.orderChangePercentage)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="card">
            <div className="card-content pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Target className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
                </div>
                <div className="ml-2 md:ml-4 min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-medium text-gray-500 truncate">Avg Order Value (30d)</p>
                  <div className="flex items-center">
                    <p className="text-lg md:text-2xl font-semibold text-gray-900">
                      {summaryLoading ? (
                        <LoadingInline />
                      ) : (
                        formatCurrency(quickSummary?.summary?.averageOrderValue || 0)
                      )}
                    </p>
                    {quickSummary?.comparison?.changes?.aovChangePercentage !== undefined && (
                      <span className={`ml-2 text-sm ${quickSummary.comparison.changes.aovChangePercentage >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                        }`}>
                        {quickSummary.comparison.changes.aovChangePercentage >= 0 ? (
                          <TrendingUp className="h-4 w-4 inline" />
                        ) : (
                          <TrendingDown className="h-4 w-4 inline" />
                        )}
                        {formatPercentage(quickSummary.comparison.changes.aovChangePercentage)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Total Customers */}
          <div className="card">
            <div className="card-content pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-6 w-6 md:h-8 md:w-8 text-orange-600" />
                </div>
                <div className="ml-2 md:ml-4 min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-medium text-gray-500 truncate">Total Customers (30d)</p>
                  <div className="flex items-center">
                    <p className="text-lg md:text-2xl font-semibold text-gray-900">
                      {summaryLoading ? (
                        <LoadingInline />
                      ) : (
                        (quickSummary?.summary?.totalCustomers || 0).toLocaleString()
                      )}
                    </p>
                    {quickSummary?.comparison?.changes?.customerChangePercentage !== undefined && (
                      <span className={`ml-2 text-sm ${quickSummary.comparison.changes.customerChangePercentage >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                        }`}>
                        {quickSummary.comparison.changes.customerChangePercentage >= 0 ? (
                          <TrendingUp className="h-4 w-4 inline" />
                        ) : (
                          <TrendingDown className="h-4 w-4 inline" />
                        )}
                        {formatPercentage(quickSummary.comparison.changes.customerChangePercentage)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Top Performers */}
        <ResponsiveGrid cols={{ default: 1, lg: 3 }} gap={6}>
          {/* Top Products */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Top Products (30d)</h3>
            </div>
            <div className="card-content">
              {topProductsLoading ? (
                <LoadingCard />
              ) : quickTopProducts?.topProducts?.length > 0 ? (
                <div className="space-y-3">
                  {quickTopProducts.topProducts.map((product, index) => (
                    <div key={product.product._id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{product.product.name}</p>
                          <p className="text-xs text-gray-500">Category: {product.product.category || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(product.metrics.totalRevenue)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {product.metrics.totalQuantity} units
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Package className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm">No product data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Customers by Sales */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Top Customers by Sales (30d)</h3>
            </div>
            <div className="card-content">
              {topCustomersRevenueLoading ? (
                <LoadingCard />
              ) : quickTopCustomersByRevenue?.topCustomers?.length > 0 ? (
                <div className="space-y-3">
                  {quickTopCustomersByRevenue.topCustomers.map((customer, index) => (
                    <div key={customer.customer._id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{customer.customer.displayName}</p>
                          <p className="text-xs text-gray-500 capitalize">{customer.customer.businessType}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(customer.metrics.totalRevenue)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {customer.metrics.totalOrders} orders
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Users className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm">No customer data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Customers by Profit */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Top Customers by Profit (30d)</h3>
            </div>
            <div className="card-content">
              {topCustomersProfitLoading ? (
                <LoadingCard />
              ) : quickTopCustomersByProfit?.topCustomers?.length > 0 ? (
                <div className="space-y-3">
                  {quickTopCustomersByProfit.topCustomers.map((customer, index) => (
                    <div key={customer.customer._id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{customer.customer.displayName}</p>
                          <p className="text-xs text-gray-500 capitalize">{customer.customer.businessType}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(customer.metrics.totalProfit)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Margin {customer.metrics.margin?.toFixed(1) || 0}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Users className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm">No customer profit data available</p>
                </div>
              )}
            </div>
          </div>
        </ResponsiveGrid>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn btn-md ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="card">
            <div className="card-content">
              <SalesPerformanceFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onClose={() => setShowFilters(false)}
              />
            </div>
          </div>
        )}

        {/* Reports List */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Reports</h3>
          </div>
          <div className="card-content p-0">
            {reportsLoading ? (
              <LoadingGrid />
            ) : reportsData?.reports?.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {reportsData.reports.map((report) => (
                  <div key={report.reportId} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {getReportTypeIcon(report.reportType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {report.reportName}
                            </h4>
                            {report.isFavorite && (
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            )}
                          </div>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-gray-500">
                              {getReportTypeLabel(report.reportType)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {report.periodType} • {formatDate(report.generatedAt)}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                              {getStatusIcon(report.status)}
                              <span className="ml-1 capitalize">{report.status}</span>
                            </span>
                          </div>
                          {report.summary && (
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>Revenue: {formatCurrency(report.summary.totalRevenue)}</span>
                              <span>Orders: {report.summary.totalOrders}</span>
                              <span>AOV: {formatCurrency(report.summary.averageOrderValue)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewReport(report)}
                          className="text-gray-400 hover:text-gray-600"
                          title="View Report"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleFavorite(report.reportId, !report.isFavorite)}
                          className={`${report.isFavorite
                              ? 'text-yellow-500 hover:text-yellow-600'
                              : 'text-gray-400 hover:text-gray-600'
                            }`}
                          title={report.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star className={`h-4 w-4 ${report.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                        <div className="relative">
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {/* Dropdown menu would go here */}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No reports found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating your first sales performance report.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary btn-md"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {reportsData?.pagination && reportsData.pagination.pages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((filters.page - 1) * filters.limit) + 1} to{' '}
              {Math.min(filters.page * filters.limit, reportsData.pagination.total)} of{' '}
              {reportsData.pagination.total} results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={!reportsData.pagination.hasPrev}
                className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={!reportsData.pagination.hasNext}
                className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </ResponsiveContainer>

      {/* Modals */}
      <CreateSalesPerformanceReportModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          // RTK Query will automatically refetch based on cache tags
          toast.success('Report generation started');
        }}
      />

      <SalesPerformanceDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        report={selectedReport}
        onDelete={(reportId) => {
          handleDeleteReport(reportId);
          setShowDetailModal(false);
        }}
        onExport={handleExportReport}
      />
    </AsyncErrorBoundary>
  );
};

export default SalesPerformanceReports;
