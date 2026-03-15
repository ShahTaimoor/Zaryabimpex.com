import React, { useState } from 'react';
import {
  X,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  Package,
  UserCheck,
  Calendar,
  Download,
  Star,
  Tag,
  FileText,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Target,
  Award,
  Percent,
  Activity
} from 'lucide-react';
import { useGetReportQuery } from '../store/services/salesPerformanceApi';
import { LoadingSpinner, LoadingCard } from '../components/LoadingSpinner';

const SalesPerformanceDetailModal = ({ isOpen, onClose, report, onDelete, onExport }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Fetch detailed report data
  const { data: detailedReport, isLoading, error } = useGetReportQuery(
    report?.reportId,
    {
      skip: !report?.reportId || !isOpen,
    }
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'products', label: 'Top Products', icon: Package },
    { id: 'customers', label: 'Top Customers', icon: Users },
    { id: 'salesreps', label: 'Top Sales Reps', icon: UserCheck },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'insights', label: 'Insights', icon: Target }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
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

  const getInsightIcon = (type) => {
    switch (type) {
      case 'achievement':
        return <Award className="h-5 w-5 text-green-600" />;
      case 'opportunity':
        return <TrendingUp className="h-5 w-5 text-blue-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'recommendation':
        return <Target className="h-5 w-5 text-purple-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'achievement':
        return 'border-green-200 bg-green-50';
      case 'opportunity':
        return 'border-blue-200 bg-blue-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'recommendation':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-7xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BarChart3 className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {report.reportName}
                  </h3>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                      {getStatusIcon(report.status)}
                      <span className="ml-1 capitalize">{report.status}</span>
                    </span>
                    <span className="text-sm text-gray-500">
                      Generated {formatDate(report.generatedAt)}
                    </span>
                    <span className="text-sm text-gray-500">
                      Views: {report.viewCount || 0}
                    </span>
                    {report.isFavorite && (
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn btn-secondary"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Export Menu */}
          {showExportMenu && (
            <div className="absolute right-4 top-16 z-10 bg-white border border-gray-200 rounded-lg shadow-lg">
              <div className="py-1">
                <button
                  onClick={() => {
                    onExport(report.reportId, 'pdf');
                    setShowExportMenu(false);
                  }}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export as PDF
                </button>
                <button
                  onClick={() => {
                    onExport(report.reportId, 'excel');
                    setShowExportMenu(false);
                  }}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export as Excel
                </button>
                <button
                  onClick={() => {
                    onExport(report.reportId, 'csv');
                    setShowExportMenu(false);
                  }}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export as CSV
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-6">
                <LoadingCard />
              </div>
            ) : error ? (
              <div className="p-6 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading report</h3>
                <p className="mt-1 text-sm text-gray-500">{error.message}</p>
              </div>
            ) : (
              <div className="p-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && detailedReport && (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="card">
                        <div className="card-content">
                          <div className="flex items-center">
                            <TrendingUp className="h-8 w-8 text-green-600" />
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                              <p className="text-2xl font-semibold text-gray-900">
                                {formatCurrency(detailedReport.summary?.totalRevenue || 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="card">
                        <div className="card-content">
                          <div className="flex items-center">
                            <ShoppingCart className="h-8 w-8 text-blue-600" />
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-500">Total Orders</p>
                              <p className="text-2xl font-semibold text-gray-900">
                                {(detailedReport.summary?.totalOrders || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="card">
                        <div className="card-content">
                          <div className="flex items-center">
                            <Target className="h-8 w-8 text-purple-600" />
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-500">Avg Order Value</p>
                              <p className="text-2xl font-semibold text-gray-900">
                                {formatCurrency(detailedReport.summary?.averageOrderValue || 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="card">
                        <div className="card-content">
                          <div className="flex items-center">
                            <Users className="h-8 w-8 text-orange-600" />
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-500">Total Customers</p>
                              <p className="text-2xl font-semibold text-gray-900">
                                {(detailedReport.summary?.totalCustomers || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Comparison */}
                    {detailedReport.comparison && (
                      <div className="card">
                        <div className="card-header">
                          <h3 className="text-lg font-medium text-gray-900">Period Comparison</h3>
                        </div>
                        <div className="card-content">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="text-center">
                              <p className="text-sm text-gray-500">Revenue Change</p>
                              <div className={`flex items-center justify-center mt-2 ${
                                detailedReport.comparison.changes.revenueChangePercentage >= 0 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                              }`}>
                                {detailedReport.comparison.changes.revenueChangePercentage >= 0 ? (
                                  <TrendingUp className="h-4 w-4 mr-1" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 mr-1" />
                                )}
                                {formatPercentage(detailedReport.comparison.changes.revenueChangePercentage)}
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-gray-500">Orders Change</p>
                              <div className={`flex items-center justify-center mt-2 ${
                                detailedReport.comparison.changes.orderChangePercentage >= 0 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                              }`}>
                                {detailedReport.comparison.changes.orderChangePercentage >= 0 ? (
                                  <TrendingUp className="h-4 w-4 mr-1" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 mr-1" />
                                )}
                                {formatPercentage(detailedReport.comparison.changes.orderChangePercentage)}
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-gray-500">AOV Change</p>
                              <div className={`flex items-center justify-center mt-2 ${
                                detailedReport.comparison.changes.aovChangePercentage >= 0 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                              }`}>
                                {detailedReport.comparison.changes.aovChangePercentage >= 0 ? (
                                  <TrendingUp className="h-4 w-4 mr-1" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 mr-1" />
                                )}
                                {formatPercentage(detailedReport.comparison.changes.aovChangePercentage)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Top Products Tab */}
                {activeTab === 'products' && detailedReport?.topProducts && (
                  <div className="space-y-4">
                    {detailedReport.topProducts.map((product, index) => (
                      <div key={product.product._id} className="card">
                        <div className="card-content">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-900">{product.product.name}</h4>
                                <p className="text-sm text-gray-500">Category: {product.product.category || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900">
                                {formatCurrency(product.metrics.totalRevenue)}
                              </p>
                              <div className={`text-sm ${
                                product.trend.revenueChangePercentage >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {product.trend.revenueChangePercentage >= 0 ? (
                                  <TrendingUp className="h-4 w-4 inline mr-1" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 inline mr-1" />
                                )}
                                {formatPercentage(product.trend.revenueChangePercentage)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Quantity</p>
                              <p className="font-medium">{product.metrics.totalQuantity}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Orders</p>
                              <p className="font-medium">{product.metrics.totalOrders}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Profit</p>
                              <p className="font-medium">{formatCurrency(product.metrics.profit)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Margin</p>
                              <p className="font-medium">{product.metrics.margin.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Top Customers Tab */}
                {activeTab === 'customers' && detailedReport?.topCustomers && (
                  <div className="space-y-4">
                    {detailedReport.topCustomers.map((customer, index) => (
                      <div key={customer.customer._id} className="card">
                        <div className="card-content">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-green-600">#{index + 1}</span>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-900">{customer.customer.displayName}</h4>
                                <p className="text-sm text-gray-500 capitalize">
                                  {customer.customer.businessType} • {customer.customer.customerTier}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
                                <p className="text-lg font-semibold text-gray-900">
                                  {formatCurrency(customer.metrics.totalRevenue)}
                                </p>
                                <div className={`text-sm ${
                                  customer.trend.revenueChangePercentage >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {customer.trend.revenueChangePercentage >= 0 ? (
                                    <TrendingUp className="h-4 w-4 inline mr-1" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 inline mr-1" />
                                  )}
                                  {formatPercentage(customer.trend.revenueChangePercentage)}
                                </div>
                              </div>
                              <div className="mt-2">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Profit</p>
                                <p className="text-base font-semibold text-gray-900">
                                  {formatCurrency(customer.metrics.totalProfit)}
                                </p>
                                <div className={`text-sm ${
                                  customer.trend.profitChangePercentage >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {customer.trend.profitChangePercentage >= 0 ? (
                                    <TrendingUp className="h-4 w-4 inline mr-1" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 inline mr-1" />
                                  )}
                                  {formatPercentage(customer.trend.profitChangePercentage)}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Orders</p>
                              <p className="font-medium">{customer.metrics.totalOrders}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Avg Order Value</p>
                              <p className="font-medium">{formatCurrency(customer.metrics.averageOrderValue)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Last Order</p>
                              <p className="font-medium">{formatDate(customer.metrics.lastOrderDate)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Margin</p>
                              <p className="font-medium">{customer.metrics.margin?.toFixed(1) || 0}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Top Sales Reps Tab */}
                {activeTab === 'salesreps' && detailedReport?.topSalesReps && (
                  <div className="space-y-4">
                    {detailedReport.topSalesReps.map((salesRep, index) => (
                      <div key={salesRep.salesRep._id} className="card">
                        <div className="card-content">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-purple-600">#{index + 1}</span>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-900">
                                  {salesRep.salesRep.firstName} {salesRep.salesRep.lastName}
                                </h4>
                                <p className="text-sm text-gray-500">{salesRep.salesRep.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900">
                                {formatCurrency(salesRep.metrics.totalRevenue)}
                              </p>
                              <div className={`text-sm ${
                                salesRep.trend.revenueChangePercentage >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {salesRep.trend.revenueChangePercentage >= 0 ? (
                                  <TrendingUp className="h-4 w-4 inline mr-1" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 inline mr-1" />
                                )}
                                {formatPercentage(salesRep.trend.revenueChangePercentage)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Orders</p>
                              <p className="font-medium">{salesRep.metrics.totalOrders}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Customers</p>
                              <p className="font-medium">{salesRep.metrics.totalCustomers}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Conversion Rate</p>
                              <p className="font-medium">{(salesRep.metrics.conversionRate * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Avg Order Value</p>
                              <p className="font-medium">{formatCurrency(salesRep.metrics.averageOrderValue)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Insights Tab */}
                {activeTab === 'insights' && detailedReport?.insights && (
                  <div className="space-y-4">
                    {detailedReport.insights.map((insight, index) => (
                      <div key={index} className={`border rounded-lg p-4 ${getInsightColor(insight.type)}`}>
                        <div className="flex items-start">
                          {getInsightIcon(insight.type)}
                          <div className="ml-3 flex-1">
                            <h4 className="text-sm font-medium text-gray-900">{insight.title}</h4>
                            <p className="mt-1 text-sm text-gray-600">{insight.description}</p>
                            {insight.actionable && insight.suggestedActions && insight.suggestedActions.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-medium text-gray-700">Suggested Actions:</p>
                                <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                                  {insight.suggestedActions.map((action, actionIndex) => (
                                    <li key={actionIndex}>{action}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div className="ml-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                              insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {insight.impact} impact
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-between">
            <div className="text-sm text-gray-500">
              Report ID: {report.reportId}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesPerformanceDetailModal;
