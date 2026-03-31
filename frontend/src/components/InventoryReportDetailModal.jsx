import React, { useState } from 'react';
import BaseModal from './BaseModal';
import {
  Download,
  Star,
  Trash2,
  Eye,
  TrendingUp,
  TrendingDown,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  User,
  Tag,
  FileText,
  RefreshCw,
  AlertCircle,
  Info
} from 'lucide-react';

import { useGetReportQuery } from '../store/services/inventoryApi';
import { useGetProductsQuery } from '../store/services/productsApi';

const InventoryReportDetailModal = ({ report, onClose, onExport, onDelete, onToggleFavorite }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch detailed report data
  const { data: detailedReport, isLoading } = useGetReportQuery(
    report.reportId,
    {
      skip: !report.reportId,
    }
  );
  const { data: productsData } = useGetProductsQuery({ limit: 10000 });

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

  const formatDate = (date) => {
    const raw = date ?? null;
    if (!raw) return 'N/A';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
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
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'alert':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'opportunity':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'achievement':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'recommendation':
        return <Info className="h-5 w-5 text-purple-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'warning':
        return 'border-orange-200 bg-orange-50';
      case 'alert':
        return 'border-red-200 bg-red-50';
      case 'opportunity':
        return 'border-green-200 bg-green-50';
      case 'achievement':
        return 'border-blue-200 bg-blue-50';
      case 'recommendation':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'stock-levels', name: 'Stock Levels', icon: Package },
    { id: 'turnover-rates', name: 'Turnover Rates', icon: TrendingUp },
    { id: 'aging-analysis', name: 'Aging Analysis', icon: Clock },
    { id: 'insights', name: 'Insights', icon: AlertTriangle }
  ];

  const reportData = detailedReport || report;
  const products = productsData?.data?.products || productsData?.products || [];
  const productNameById = new Map(
    products.map((p) => [String(p.id || p._id), p.name || p.productName || p.title || ''])
  );

  const resolveProductName = (item) => {
    if (item?.product?.name) return item.product.name;
    if (item?.productName) return item.productName;
    if (item?.product_name) return item.product_name;
    const pid =
      typeof item?.product === 'object'
        ? (item.product?.id || item.product?._id)
        : item?.product;
    if (pid != null) {
      const mapped = productNameById.get(String(pid));
      if (mapped) return mapped;
      return `Product ${String(pid).slice(0, 8)}`;
    }
    return 'Unknown Product';
  };
  const computedSummary = (() => {
    const rows = Array.isArray(reportData?.stockLevels) ? reportData.stockLevels : [];
    const base = rows.reduce(
      (acc, row) => {
        const currentStock = Number(row?.metrics?.currentStock || 0);
        const reorderPoint = Number(row?.metrics?.reorderPoint || 0);
        const stockValue = Number(row?.metrics?.stockValue || 0);
        const retailValue = Number(row?.metrics?.retailValue || 0);
        const status = String(row?.metrics?.stockStatus || '');
        acc.totalProducts += 1;
        acc.totalStockValue += stockValue;
        acc.totalRetailValue += retailValue;
        if (currentStock <= reorderPoint) acc.lowStockProducts += 1;
        if (currentStock === 0 || status === 'out_of_stock') acc.outOfStockProducts += 1;
        if (status === 'overstocked') acc.overstockedProducts += 1;
        return acc;
      },
      {
        totalProducts: 0,
        totalStockValue: 0,
        totalRetailValue: 0,
        lowStockProducts: 0,
        outOfStockProducts: 0,
        overstockedProducts: 0
      }
    );

    return {
      ...base,
      averageTurnoverRate: Number(reportData?.summary?.averageTurnoverRate || 0),
      fastMovingProducts: Number(reportData?.summary?.fastMovingProducts || 0),
      totalPotentialLoss: Number(reportData?.summary?.totalPotentialLoss || 0)
    };
  })();
  const summary = reportData?.summary || computedSummary;

  const headerExtra = !isLoading ? (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => onToggleFavorite(reportData.reportId, !reportData.isFavorite)}
        className={`p-2 rounded-md ${reportData.isFavorite ? 'text-yellow-400' : 'text-gray-400'} hover:text-yellow-400`}
        title={reportData.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star className={`h-5 w-5 ${reportData.isFavorite ? 'fill-current' : ''}`} />
      </button>
      <button
        onClick={() => onExport(reportData.reportId, 'pdf')}
        className="p-2 text-gray-400 hover:text-gray-600"
        title="Export Report"
      >
        <Download className="h-5 w-5" />
      </button>
      <button
        onClick={() => onDelete(reportData.reportId)}
        className="p-2 text-red-400 hover:text-red-600"
        title="Delete Report"
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </div>
  ) : null;

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={isLoading ? 'Loading...' : (reportData.reportName ?? reportData.report_name ?? 'N/A')}
      subtitle={
        !isLoading && (reportData.generatedAt || reportData.created_at || reportData.createdAt)
          ? `Generated ${formatDate(reportData.generatedAt ?? reportData.created_at ?? reportData.createdAt)}`
          : ''
      }
      headerExtra={headerExtra}
      maxWidth="2xl"
      variant="scrollable"
      contentClassName="p-5"
    >
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          <span className="ml-2 text-gray-600">Loading report details...</span>
        </div>
      ) : (
        <>
        <div className="flex items-center space-x-4 mb-6">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reportData.status)}`}>
            {getStatusIcon(reportData.status)}
            <span className="ml-1">{String(reportData.status || '').toUpperCase()}</span>
          </span>
          <span className="text-sm text-gray-500">
            {reportData.viewCount} views
          </span>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="max-h-96 overflow-y-auto">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Package className="h-8 w-8 text-blue-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Total Products</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatNumber(summary.totalProducts || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Retail Valuation</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(summary.totalRetailValue || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Total Stock Value</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(summary.totalStockValue || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Low Stock</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatNumber(summary.lowStockProducts || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Out of Stock</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatNumber(summary.outOfStockProducts || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Average Turnover Rate</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {(summary.averageTurnoverRate || 0).toFixed(1)}x/year
                      </p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Fast Moving Products</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatNumber(summary.fastMovingProducts || 0)}
                      </p>
                    </div>
                    <Activity className="h-6 w-6 text-blue-600" />
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Potential Loss</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(summary.totalPotentialLoss || 0)}
                      </p>
                    </div>
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Report Information */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Report Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Report Type</p>
                    <p className="text-sm font-medium text-gray-900">
                      {(() => {
                        const type = reportData.reportType ?? reportData.report_type;
                        return type ? String(type).replace('_', ' ').toUpperCase() : 'N/A';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Period Type</p>
                    <p className="text-sm font-medium text-gray-900">
                      {String(reportData.periodType ?? reportData.period_type ?? '').toUpperCase() || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Start Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(reportData.startDate ?? reportData.start_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">End Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(reportData.endDate ?? reportData.end_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Generated By</p>
                    <p className="text-sm font-medium text-gray-900">
                      {reportData.generatedBy?.firstName} {reportData.generatedBy?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Last Viewed</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(reportData.lastViewedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stock Levels Tab */}
          {activeTab === 'stock-levels' && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900">Stock Levels Analysis</h4>
              {reportData.stockLevels?.length > 0 ? (
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                          Stock Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                          Retail Val.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.stockLevels.slice(0, 10).map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {resolveProductName(item)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatNumber(item.metrics.currentStock)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatNumber(item.metrics.reorderPoint)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(item.metrics.stockValue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                            {formatCurrency(item.metrics.retailValue || 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.metrics.stockStatus === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                              item.metrics.stockStatus === 'low_stock' ? 'bg-orange-100 text-orange-800' :
                              item.metrics.stockStatus === 'overstocked' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {String(item.metrics.stockStatus || '').replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No stock level data available</p>
              )}
            </div>
          )}

          {/* Turnover Rates Tab */}
          {activeTab === 'turnover-rates' && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900">Turnover Rates Analysis</h4>
              {reportData.turnoverRates?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Turnover Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Sold
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Days to Sell
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.turnoverRates.slice(0, 10).map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {resolveProductName(item)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.metrics.turnoverRate.toFixed(1)}x/year
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatNumber(item.metrics.totalSold)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.metrics.daysToSell.toFixed(0)} days
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.metrics.turnoverCategory === 'fast' ? 'bg-green-100 text-green-800' :
                              item.metrics.turnoverCategory === 'slow' ? 'bg-orange-100 text-orange-800' :
                              item.metrics.turnoverCategory === 'dead' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {String(item.metrics.turnoverCategory || '').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No turnover rate data available</p>
              )}
            </div>
          )}

          {/* Aging Analysis Tab */}
          {activeTab === 'aging-analysis' && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900">Aging Analysis</h4>
              {reportData.agingAnalysis?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Days in Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Sold
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stock Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Potential Loss
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.agingAnalysis.slice(0, 10).map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {resolveProductName(item)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatNumber(item.metrics.daysInStock)} days
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.metrics.lastSoldDate ? formatDate(item.metrics.lastSoldDate) : 'Never'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(item.metrics.stockValue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(item.metrics.potentialLoss)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.metrics.agingCategory === 'very_old' ? 'bg-red-100 text-red-800' :
                              item.metrics.agingCategory === 'old' ? 'bg-orange-100 text-orange-800' :
                              item.metrics.agingCategory === 'aging' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {String(item.metrics.agingCategory || '').replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No aging analysis data available</p>
              )}
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900">Insights & Recommendations</h4>
              {reportData.insights?.length > 0 ? (
                <div className="space-y-4">
                  {reportData.insights.map((insight, index) => (
                    <div key={index} className={`border rounded-lg p-4 ${getInsightColor(insight.type)}`}>
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          {getInsightIcon(insight.type)}
                        </div>
                        <div className="ml-3 flex-1">
                          <h5 className="text-sm font-medium text-gray-900">{insight.title}</h5>
                          <p className="mt-1 text-sm text-gray-600">{insight.description}</p>
                          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
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
                        <div className="ml-3 flex-shrink-0">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                            insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {String(insight.impact || '').toUpperCase()} IMPACT
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No insights available for this report</p>
              )}
            </div>
          )}
        </div>
        </>
      )}
    </BaseModal>
  );
};

export default InventoryReportDetailModal;
