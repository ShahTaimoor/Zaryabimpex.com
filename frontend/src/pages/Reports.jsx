import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Package,
  Calendar,
  Download
} from 'lucide-react';
import {
  useGetSalesReportQuery,
  useGetProductReportQuery,
  useGetCustomerReportQuery,
} from '../store/services/reportsApi';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';

export const Reports = () => {
  const [dateRange, setDateRange] = useState({
    from: getDateDaysAgo(30),
    to: getCurrentDatePakistan()
  });

  const { data: salesData, isLoading: salesLoading } = useGetSalesReportQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const { data: productData, isLoading: productLoading } = useGetProductReportQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const { data: customerData, isLoading: customerLoading } = useGetCustomerReportQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  if (salesLoading || productLoading || customerLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const salesSummary = salesData?.data?.summary || {};
  const topProducts = productData?.data?.products?.slice(0, 5) || [];
  const topCustomers = customerData?.data?.customers?.slice(0, 5) || [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 text-sm md:text-base">Analyze your business performance</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <DateFilter
            startDate={dateRange.from}
            endDate={dateRange.to}
            onDateChange={(start, end) => {
              setDateRange({ from: start || '', to: end || '' });
            }}
            compact={true}
            showPresets={true}
            className="flex-1"
          />
          <button className="btn btn-secondary btn-md w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-success-500">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {salesSummary.totalRevenue?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-primary-500">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {salesSummary.totalOrders || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-warning-500">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Items Sold</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {salesSummary.totalItems || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-purple-500">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {salesSummary.averageOrderValue?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Top Products</h3>
          </div>
          <div className="card-content">
            {topProducts.length === 0 ? (
              <p className="text-gray-500">No product data available</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={product.product._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-2 sm:p-0">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.product.name}</p>
                        <p className="text-xs text-gray-500">Category: {product.product.category || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right pl-6 sm:pl-0">
                      <p className="text-sm font-medium text-gray-900">
                        {product.totalQuantity} sold
                      </p>
                      <p className="text-xs text-gray-500">
                        {product.totalRevenue.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Top Customers</h3>
          </div>
          <div className="card-content">
            {topCustomers.length === 0 ? (
              <p className="text-gray-500">No customer data available</p>
            ) : (
              <div className="space-y-3">
                {topCustomers.map((customer, index) => (
                  <div key={customer.customer._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-2 sm:p-0">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {customer.customer.displayName}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {customer.customer.businessType}
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right pl-6 sm:pl-0">
                      <p className="text-sm font-medium text-gray-900">
                        {customer.totalOrders} orders
                      </p>
                      <p className="text-xs text-gray-500">
                        {customer.totalRevenue.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sales Trend */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Sales Trend</h3>
        </div>
        <div className="card-content">
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">Sales chart will be displayed here</p>
              <p className="text-sm">Integration with charting library needed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
