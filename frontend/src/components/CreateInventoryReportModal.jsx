import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  X,
  Calendar,
  BarChart3,
  Package,
  TrendingUp,
  Clock,
  Settings,
  Filter,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';

import { useCreateReportMutation } from '../store/services/inventoryApi';
import { useGetCategoriesQuery } from '../store/services/categoriesApi';
import { useGetSuppliersQuery } from '../store/services/suppliersApi';
import { handleApiError } from '../utils/errorHandler';

const CreateInventoryReportModal = ({ onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    reportType: 'comprehensive',
    periodType: 'monthly',
    startDate: '',
    endDate: '',
    includeMetrics: {
      stockLevels: true,
      turnoverRates: true,
      agingAnalysis: true,
      reorderPoints: true,
      costAnalysis: true,
      profitMargins: true
    },
    filters: {
      categories: [],
      suppliers: [],
      stockStatus: [],
      turnoverRanges: [],
      agingRanges: []
    },
    thresholds: {
      lowStockThreshold: 10,
      overstockThreshold: 100,
      fastTurnoverThreshold: 12,
      slowTurnoverThreshold: 4,
      agingThreshold: 90,
      oldThreshold: 180,
      veryOldThreshold: 365
    }
  });

  // Fetch categories and suppliers for filters
  const { data: categoriesData } = useGetCategoriesQuery({ limit: 1000 });
  const { data: suppliersData } = useGetSuppliersQuery({ limit: 1000 });
  
  const categories = categoriesData?.data?.categories || categoriesData?.categories || [];
  const suppliers = suppliersData?.data?.suppliers || suppliersData?.suppliers || [];
  
  const [createReport, { isLoading: isGenerating }] = useCreateReportMutation();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const handleArrayChange = (parent, field, value, checked) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: checked
          ? [...prev[parent][field], value]
          : prev[parent][field].filter(item => item !== value)
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createReport(formData).unwrap();
      toast.success('Inventory report generated successfully');
      onSuccess();
    } catch (error) {
      handleApiError(error, 'Generate Report');
    }
  };

  const getDateRange = (periodType) => {
    const now = new Date();
    let start, end;

    switch (periodType) {
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        start = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
        break;
      case 'yearly':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  };

  const handlePeriodTypeChange = (periodType) => {
    const dateRange = getDateRange(periodType);
    setFormData(prev => ({
      ...prev,
      periodType,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    }));
  };

  const tabs = [
    { id: 'basic', name: 'Basic Settings', icon: Settings },
    { id: 'metrics', name: 'Metrics', icon: BarChart3 },
    { id: 'filters', name: 'Filters', icon: Filter },
    { id: 'thresholds', name: 'Thresholds', icon: AlertTriangle }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Generate Inventory Report</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
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

        <form onSubmit={handleSubmit}>
          {/* Basic Settings Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { value: 'stock_levels', label: 'Stock Levels', icon: Package, description: 'Current inventory levels and stock status' },
                    { value: 'turnover_rates', label: 'Turnover Rates', icon: TrendingUp, description: 'Product movement and velocity analysis' },
                    { value: 'aging_analysis', label: 'Aging Analysis', icon: Clock, description: 'Inventory aging and potential obsolescence' },
                    { value: 'comprehensive', label: 'Comprehensive', icon: BarChart3, description: 'Complete inventory analysis with all metrics' }
                  ].map((type) => {
                    const Icon = type.icon;
                    return (
                      <div
                        key={type.value}
                        className={`relative border rounded-lg p-4 cursor-pointer ${
                          formData.reportType === type.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onClick={() => handleInputChange('reportType', type.value)}
                      >
                        <div className="flex items-center">
                          <Icon className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{type.label}</div>
                            <div className="text-xs text-gray-500">{type.description}</div>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2">
                          <input
                            type="radio"
                            name="reportType"
                            value={type.value}
                            checked={formData.reportType === type.value}
                            onChange={() => handleInputChange('reportType', type.value)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Period
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'quarterly', label: 'Quarterly' },
                    { value: 'yearly', label: 'Yearly' },
                    { value: 'custom', label: 'Custom' }
                  ].map((period) => (
                    <button
                      key={period.value}
                      type="button"
                      onClick={() => handlePeriodTypeChange(period.value)}
                      className={`px-4 py-2 text-sm font-medium rounded-md border ${
                        formData.periodType === period.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>

              {formData.periodType === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metrics Tab */}
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-4">Include Metrics</h4>
                <div className="space-y-3">
                  {[
                    { key: 'stockLevels', label: 'Stock Levels', description: 'Current inventory levels and stock status' },
                    { key: 'turnoverRates', label: 'Turnover Rates', description: 'Product movement and velocity analysis' },
                    { key: 'agingAnalysis', label: 'Aging Analysis', description: 'Inventory aging and potential obsolescence' },
                    { key: 'reorderPoints', label: 'Reorder Points', description: 'Reorder point analysis and recommendations' },
                    { key: 'costAnalysis', label: 'Cost Analysis', description: 'Inventory cost analysis and valuation' },
                    { key: 'profitMargins', label: 'Profit Margins', description: 'Profit margin analysis by product' }
                  ].map((metric) => (
                    <div key={metric.key} className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          checked={formData.includeMetrics[metric.key]}
                          onChange={(e) => handleNestedInputChange('includeMetrics', metric.key, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label className="font-medium text-gray-700">{metric.label}</label>
                        <p className="text-gray-500">{metric.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filters Tab */}
          {activeTab === 'filters' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-4">Categories</h4>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {categories?.categories?.map((category) => (
                    <div key={category._id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.filters.categories.includes(category._id)}
                        onChange={(e) => handleArrayChange('filters', 'categories', category._id, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">{category.name}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-4">Suppliers</h4>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {suppliers?.suppliers?.map((supplier) => (
                    <div key={supplier._id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.filters.suppliers.includes(supplier._id)}
                        onChange={(e) => handleArrayChange('filters', 'suppliers', supplier._id, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">{supplier.name}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-4">Stock Status</h4>
                <div className="space-y-2">
                  {[
                    { value: 'in_stock', label: 'In Stock' },
                    { value: 'low_stock', label: 'Low Stock' },
                    { value: 'out_of_stock', label: 'Out of Stock' },
                    { value: 'overstocked', label: 'Overstocked' }
                  ].map((status) => (
                    <div key={status.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.filters.stockStatus.includes(status.value)}
                        onChange={(e) => handleArrayChange('filters', 'stockStatus', status.value, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">{status.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Thresholds Tab */}
          {activeTab === 'thresholds' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.thresholds.lowStockThreshold}
                    onChange={(e) => handleNestedInputChange('thresholds', 'lowStockThreshold', parseInt(e.target.value))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Overstock Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.thresholds.overstockThreshold}
                    onChange={(e) => handleNestedInputChange('thresholds', 'overstockThreshold', parseInt(e.target.value))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fast Turnover Threshold (times/year)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.thresholds.fastTurnoverThreshold}
                    onChange={(e) => handleNestedInputChange('thresholds', 'fastTurnoverThreshold', parseFloat(e.target.value))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Slow Turnover Threshold (times/year)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.thresholds.slowTurnoverThreshold}
                    onChange={(e) => handleNestedInputChange('thresholds', 'slowTurnoverThreshold', parseFloat(e.target.value))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aging Threshold (days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.thresholds.agingThreshold}
                    onChange={(e) => handleNestedInputChange('thresholds', 'agingThreshold', parseInt(e.target.value))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Old Threshold (days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.thresholds.oldThreshold}
                    onChange={(e) => handleNestedInputChange('thresholds', 'oldThreshold', parseInt(e.target.value))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Very Old Threshold (days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.thresholds.veryOldThreshold}
                    onChange={(e) => handleNestedInputChange('thresholds', 'veryOldThreshold', parseInt(e.target.value))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateInventoryReportModal;
