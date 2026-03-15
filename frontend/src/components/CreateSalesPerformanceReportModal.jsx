import React, { useState } from 'react';
import {
  X,
  BarChart3,
  Calendar,
  Settings,
  Filter,
  Tag,
  FileText,
  TrendingUp,
  Users,
  Package,
  UserCheck,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { useGenerateReportMutation } from '../store/services/salesPerformanceApi';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { LoadingButton } from '../components/LoadingSpinner';

const CreateSalesPerformanceReportModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    reportType: 'comprehensive',
    periodType: 'monthly',
    startDate: '',
    endDate: '',
    limit: 10,
    rankBy: 'revenue',
    includeMetrics: {
      revenue: true,
      quantity: true,
      profit: true,
      margin: true,
      orders: true,
      averageOrderValue: true
    },
    filters: {
      orderTypes: [],
      customerTiers: [],
      businessTypes: [],
      productCategories: [],
      salesReps: []
    },
    groupBy: 'product'
  });
  const [activeTab, setActiveTab] = useState('basic');
  const [errors, setErrors] = useState({});

  const tabs = [
    { id: 'basic', label: 'Basic Settings', icon: FileText },
    { id: 'period', label: 'Time Period', icon: Calendar },
    { id: 'filters', label: 'Filters', icon: Filter },
    { id: 'advanced', label: 'Advanced', icon: Settings }
  ];

  const reportTypes = [
    { value: 'top_products', label: 'Top Products', icon: Package, description: 'Analyze best-performing products' },
    { value: 'top_customers', label: 'Top Customers', icon: Users, description: 'Identify high-value customers' },
    { value: 'top_sales_reps', label: 'Top Sales Reps', icon: UserCheck, description: 'Track sales team performance' },
    { value: 'comprehensive', label: 'Comprehensive', icon: BarChart3, description: 'Complete performance overview' }
  ];

  const periodTypes = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const orderTypes = [
    { value: 'retail', label: 'Retail' },
    { value: 'wholesale', label: 'Wholesale' },
    { value: 'online', label: 'Online' }
  ];

  const customerTiers = [
    { value: 'bronze', label: 'Bronze' },
    { value: 'silver', label: 'Silver' },
    { value: 'gold', label: 'Gold' },
    { value: 'platinum', label: 'Platinum' }
  ];

  const businessTypes = [
    { value: 'retail', label: 'Retail' },
    { value: 'wholesale', label: 'Wholesale' },
    { value: 'distributor', label: 'Distributor' }
  ];

  const groupByOptions = [
    { value: 'product', label: 'Product' },
    { value: 'customer', label: 'Customer' },
    { value: 'sales_rep', label: 'Sales Rep' },
    { value: 'category', label: 'Category' },
    { value: 'date', label: 'Date' }
  ];

  // Create report mutation
  const [generateReport, { isLoading: isGenerating }] = useGenerateReportMutation();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleNestedInputChange = (parentField, childField, value) => {
    setFormData(prev => ({
      ...prev,
      [parentField]: {
        ...prev[parentField],
        [childField]: value
      }
    }));
  };

  const handleArrayChange = (parentField, childField, value, checked) => {
    setFormData(prev => ({
      ...prev,
      [parentField]: {
        ...prev[parentField],
        [childField]: checked
          ? [...prev[parentField][childField], value]
          : prev[parentField][childField].filter(item => item !== value)
      }
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.reportType) {
      newErrors.reportType = 'Report type is required';
    }

    if (!formData.periodType) {
      newErrors.periodType = 'Period type is required';
    }

    if (formData.periodType === 'custom') {
      if (!formData.startDate) {
        newErrors.startDate = 'Start date is required for custom period';
      }
      if (!formData.endDate) {
        newErrors.endDate = 'End date is required for custom period';
      }
      if (formData.startDate && formData.endDate && new Date(formData.startDate) >= new Date(formData.endDate)) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    if (formData.limit < 1 || formData.limit > 100) {
      newErrors.limit = 'Limit must be between 1 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const config = {
      ...formData,
      startDate: formData.periodType === 'custom' ? formData.startDate : undefined,
      endDate: formData.periodType === 'custom' ? formData.endDate : undefined
    };

    try {
      const response = await generateReport(config).unwrap();
      showSuccessToast('Report generation started successfully');
      onSuccess(response.data?.report || response.report);
    } catch (error) {
      handleApiError(error, 'Generate Report');
    }
  };

  const handleClose = () => {
    setFormData({
      reportType: 'comprehensive',
      periodType: 'monthly',
      startDate: '',
      endDate: '',
      limit: 10,
      includeMetrics: {
        revenue: true,
        quantity: true,
        profit: true,
        margin: true,
        orders: true,
        averageOrderValue: true
      },
      filters: {
        orderTypes: [],
        customerTiers: [],
        businessTypes: [],
        productCategories: [],
        salesReps: []
      },
      groupBy: 'product',
      rankBy: 'revenue'
    });
    setErrors({});
    setActiveTab('basic');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={handleClose}></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BarChart3 className="h-6 w-6 text-blue-600 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">Create Sales Performance Report</h3>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

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

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-6 py-6 max-h-96 overflow-y-auto">
              {/* Basic Settings Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Report Type
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {reportTypes.map((type) => (
                        <div
                          key={type.value}
                          className={`relative rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                            formData.reportType === type.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleInputChange('reportType', type.value)}
                        >
                          <div className="flex items-start">
                            <type.icon className={`h-5 w-5 mr-3 ${
                              formData.reportType === type.value ? 'text-blue-600' : 'text-gray-400'
                            }`} />
                            <div className="flex-1">
                              <h4 className={`text-sm font-medium ${
                                formData.reportType === type.value ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {type.label}
                              </h4>
                              <p className={`text-xs mt-1 ${
                                formData.reportType === type.value ? 'text-blue-700' : 'text-gray-500'
                              }`}>
                                {type.description}
                              </p>
                            </div>
                            {formData.reportType === type.value && (
                              <CheckCircle className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {errors.reportType && (
                      <p className="mt-2 text-sm text-red-600">{errors.reportType}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Limit Results
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.limit}
                      onChange={(e) => handleInputChange('limit', parseInt(e.target.value))}
                      className="input"
                      placeholder="10"
                    />
                    {errors.limit && (
                      <p className="mt-2 text-sm text-red-600">{errors.limit}</p>
                    )}
                    <p className="mt-1 text-sm text-gray-500">
                      Number of top results to include in the report (1-100)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Include Metrics
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(formData.includeMetrics).map(([key, value]) => (
                        <label key={key} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => handleNestedInputChange('includeMetrics', key, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                          <span className="ml-2 text-sm text-gray-700 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </label>
                      ))}
                    </div>
                </div>

                {formData.reportType === 'top_customers' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Customer Ranking Metric
                    </label>
                    <div className="flex space-x-3">
                      {[
                        { value: 'revenue', label: 'Sales Volume' },
                        { value: 'profit', label: 'Profitability' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleInputChange('rankBy', option.value)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            formData.rankBy === option.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Choose whether to rank customers by total sales or profit.
                    </p>
                  </div>
                )}
                </div>
              )}

              {/* Time Period Tab */}
              {activeTab === 'period' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Period Type
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {periodTypes.map((period) => (
                        <button
                          key={period.value}
                          type="button"
                          onClick={() => handleInputChange('periodType', period.value)}
                          className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                            formData.periodType === period.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>
                    {errors.periodType && (
                      <p className="mt-2 text-sm text-red-600">{errors.periodType}</p>
                    )}
                  </div>

                  {formData.periodType === 'custom' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => handleInputChange('startDate', e.target.value)}
                          className="input"
                        />
                        {errors.startDate && (
                          <p className="mt-2 text-sm text-red-600">{errors.startDate}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => handleInputChange('endDate', e.target.value)}
                          className="input"
                        />
                        {errors.endDate && (
                          <p className="mt-2 text-sm text-red-600">{errors.endDate}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex">
                      <Info className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
                      <div className="text-sm text-blue-700">
                        <p className="font-medium">Period Information</p>
                        <p className="mt-1">
                          {formData.periodType === 'custom' 
                            ? 'Custom date range selected'
                            : `${formData.periodType.charAt(0).toUpperCase() + formData.periodType.slice(1)} period will be analyzed`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Filters Tab */}
              {activeTab === 'filters' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Order Types
                    </label>
                    <div className="space-y-2">
                      {orderTypes.map((type) => (
                        <label key={type.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.filters.orderTypes.includes(type.value)}
                            onChange={(e) => handleArrayChange('filters', 'orderTypes', type.value, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                          <span className="ml-2 text-sm text-gray-700 capitalize">
                            {type.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Leave empty to include all order types
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Customer Tiers
                    </label>
                    <div className="space-y-2">
                      {customerTiers.map((tier) => (
                        <label key={tier.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.filters.customerTiers.includes(tier.value)}
                            onChange={(e) => handleArrayChange('filters', 'customerTiers', tier.value, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                          <span className="ml-2 text-sm text-gray-700 capitalize">
                            {tier.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Business Types
                    </label>
                    <div className="space-y-2">
                      {businessTypes.map((type) => (
                        <label key={type.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.filters.businessTypes.includes(type.value)}
                            onChange={(e) => handleArrayChange('filters', 'businessTypes', type.value, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                          <span className="ml-2 text-sm text-gray-700 capitalize">
                            {type.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Tab */}
              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group By
                    </label>
                    <select
                      value={formData.groupBy}
                      onChange={(e) => handleInputChange('groupBy', e.target.value)}
                      className="input"
                    >
                      {groupByOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-sm text-gray-500">
                      Primary grouping method for the report data
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Report Preview</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Type:</strong> {reportTypes.find(t => t.value === formData.reportType)?.label}</p>
                      <p><strong>Period:</strong> {periodTypes.find(p => p.value === formData.periodType)?.label}</p>
                      <p><strong>Limit:</strong> {formData.limit} results</p>
                      <p><strong>Group By:</strong> {groupByOptions.find(g => g.value === formData.groupBy)?.label}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <LoadingButton
                type="submit"
                isLoading={isGenerating}
                className="btn btn-primary"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Generate Report
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateSalesPerformanceReportModal;
