import React, { useState } from 'react';
import { X, Calendar, FileText, AlertCircle } from 'lucide-react';
import { useGenerateBalanceSheetMutation } from '../store/services/balanceSheetsApi';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';

const CreateBalanceSheetModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    periodType: 'monthly'
  });
  const [errors, setErrors] = useState({});
  const [generateBalanceSheet, { isLoading }] = useGenerateBalanceSheetMutation();

  // Compare calendar days in local time (so "today" is allowed, not treated as future)
  const toLocalDateOnly = (dateStr) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(dateStr);
    return new Date(y, m - 1, d);
  };

  const validateForm = () => {
    const newErrors = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    } else {
      const selectedDay = toLocalDateOnly(formData.startDate);
      if (selectedDay > today) {
        newErrors.startDate = 'Start date cannot be in the future';
      }
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    } else {
      const selectedDay = toLocalDateOnly(formData.endDate);
      if (selectedDay > today) {
        newErrors.endDate = 'End date cannot be in the future';
      }
      // Check if end date is before start date
      if (formData.startDate && selectedDay < toLocalDateOnly(formData.startDate)) {
        newErrors.endDate = 'End date must be on or after start date';
      }
    }

    if (!formData.periodType) {
      newErrors.periodType = 'Period type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await generateBalanceSheet({
        startDate: formData.startDate,
        endDate: formData.endDate,
        periodType: formData.periodType
      }).unwrap();

      showSuccessToast('Balance sheet generated successfully');
      onSuccess();
    } catch (error) {
      handleApiError(error, 'Generate Balance Sheet');
    }
  };

  const handleChange = (field, value) => {
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

  const getPeriodTypeDescription = (periodType) => {
    switch (periodType) {
      case 'monthly':
        return 'Generate a balance sheet for the current month';
      case 'quarterly':
        return 'Generate a balance sheet for the current quarter';
      case 'yearly':
        return 'Generate a balance sheet for the current year';
      default:
        return '';
    }
  };

  const getEstimatedGenerationTime = (periodType) => {
    switch (periodType) {
      case 'monthly':
        return '2-3 minutes';
      case 'quarterly':
        return '3-5 minutes';
      case 'yearly':
        return '5-10 minutes';
      default:
        return '2-3 minutes';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg mr-3">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Generate Balance Sheet</h3>
              <p className="text-sm text-gray-500">Create a new financial position statement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className={`block w-full pl-10 pr-3 py-2 border rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.startDate ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isLoading}
              />
            </div>
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.startDate}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              The start date for the balance sheet period
            </p>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
                min={formData.startDate}
                className={`block w-full pl-10 pr-3 py-2 border rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.endDate ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isLoading}
              />
            </div>
            {errors.endDate && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.endDate}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              The end date for the balance sheet period (statement date)
            </p>
          </div>

          {/* Period Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.periodType}
              onChange={(e) => handleChange('periodType', e.target.value)}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                errors.periodType ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={isLoading}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
            {errors.periodType && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.periodType}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {getPeriodTypeDescription(formData.periodType)}
            </p>
          </div>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 mr-2" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">Generation Process</p>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Calculates assets from inventory, cash, and receivables</li>
                  <li>• Determines liabilities from payables and debt</li>
                  <li>• Computes equity from capital and retained earnings</li>
                  <li>• Estimated time: {getEstimatedGenerationTime(formData.periodType)}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </div>
              ) : (
                'Generate Balance Sheet'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBalanceSheetModal;
