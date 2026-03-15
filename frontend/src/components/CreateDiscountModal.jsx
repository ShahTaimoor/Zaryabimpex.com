import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { 
  Tag, 
  Percent, 
  TrendingUp, 
  Calendar, 
  Users, 
  Package, 
  AlertCircle,
  CheckCircle,
  Clock,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import {
  useCreateDiscountMutation,
  useGenerateCodeSuggestionsMutation,
  useCheckCodeAvailabilityQuery,
} from '../store/services/discountsApi';
import { useGetProductsQuery } from '../store/services/productsApi';
import { useGetCategoriesQuery } from '../store/services/categoriesApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/LoadingSpinner';

const CreateDiscountModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    code: '',
    type: 'percentage',
    value: 0,
    maximumDiscount: '',
    minimumOrderAmount: 0,
    applicableTo: 'all',
    applicableProducts: [],
    applicableCategories: [],
    applicableCustomers: [],
    customerTiers: [],
    businessTypes: [],
    usageLimit: '',
    usageLimitPerCustomer: '',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    combinableWithOtherDiscounts: false,
    combinableDiscounts: [],
    priority: 0,
    conditions: {
      minimumQuantity: 1,
      maximumQuantity: '',
      daysOfWeek: [],
      timeOfDay: {
        start: '',
        end: ''
      },
      firstTimeCustomersOnly: false,
      returningCustomersOnly: false
    }
  });
  
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('basic');
  const [codeSuggestions, setCodeSuggestions] = useState([]);
  const [showCodeSuggestions, setShowCodeSuggestions] = useState(false);

  // Fetch data for dropdowns
  const { data: productsData } = useGetProductsQuery({ limit: 1000 });
  const { data: categoriesData } = useGetCategoriesQuery({ limit: 1000 });
  const { data: customersData } = useGetCustomersQuery({ limit: 1000 });
  
  const products = productsData?.data?.products || productsData?.products || [];
  const categories = categoriesData?.data?.categories || categoriesData?.categories || [];
  const customers = customersData?.data?.customers || customersData?.customers || [];
  
  const [createDiscount, { isLoading: isCreating }] = useCreateDiscountMutation();
  const [generateCodeSuggestionsMutation] = useGenerateCodeSuggestionsMutation();

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Tag },
    { id: 'applicability', label: 'Applicability', icon: Users },
    { id: 'conditions', label: 'Conditions', icon: AlertCircle },
    { id: 'advanced', label: 'Advanced', icon: HelpCircle }
  ];

  const daysOfWeek = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
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

  // Generate code suggestions when name or type changes
  useEffect(() => {
    if (formData.name && formData.type) {
      generateCodeSuggestions();
    }
  }, [formData.name, formData.type]);

  const generateCodeSuggestions = async () => {
    try {
      const response = await generateCodeSuggestionsMutation({
        name: formData.name,
        type: formData.type
      }).unwrap();
      setCodeSuggestions(response?.suggestions || response?.data?.suggestions || []);
    } catch (error) {
      // Error generating code suggestions - silent fail
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Basic validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Code is required';
    } else if (!/^[A-Z0-9-_]+$/.test(formData.code)) {
      newErrors.code = 'Code can only contain uppercase letters, numbers, hyphens, and underscores';
    }

    if (formData.value <= 0) {
      newErrors.value = 'Value must be greater than 0';
    }

    if (formData.type === 'percentage' && formData.value > 100) {
      newErrors.value = 'Percentage cannot exceed 100%';
    }

    // Validate maximum discount if provided
    if (formData.maximumDiscount && formData.maximumDiscount !== '') {
      const maxDiscountValue = parseFloat(formData.maximumDiscount);
      if (isNaN(maxDiscountValue) || maxDiscountValue < 0) {
        newErrors.maximumDiscount = 'Maximum discount must be non-negative';
      }
    }

    if (!formData.validFrom) {
      newErrors.validFrom = 'Valid from date is required';
    }

    if (!formData.validUntil) {
      newErrors.validUntil = 'Valid until date is required';
    } else if (new Date(formData.validUntil) <= new Date(formData.validFrom)) {
      newErrors.validUntil = 'Valid until date must be after valid from date';
    }

    // Applicability validation
    if (formData.applicableTo === 'products' && formData.applicableProducts.length === 0) {
      newErrors.applicableProducts = 'At least one product must be selected';
    }

    if (formData.applicableTo === 'categories' && formData.applicableCategories.length === 0) {
      newErrors.applicableCategories = 'At least one category must be selected';
    }

    if (formData.applicableTo === 'customers' && formData.applicableCustomers.length === 0) {
      newErrors.applicableCustomers = 'At least one customer must be selected';
    }

    // Usage limits validation (when provided, must be non-negative integer)
    if (formData.usageLimit && formData.usageLimit !== '') {
      const usageLimitNum = parseInt(formData.usageLimit, 10);
      if (isNaN(usageLimitNum) || usageLimitNum < 0 || !Number.isInteger(Number(formData.usageLimit))) {
        newErrors.usageLimit = 'Usage limit must be a non-negative integer';
      }
    }
    if (formData.usageLimitPerCustomer && formData.usageLimitPerCustomer !== '') {
      const perCustomerNum = parseInt(formData.usageLimitPerCustomer, 10);
      if (isNaN(perCustomerNum) || perCustomerNum < 0 || !Number.isInteger(Number(formData.usageLimitPerCustomer))) {
        newErrors.usageLimitPerCustomer = 'Per-customer usage limit must be a non-negative integer';
      }
    }
    if (formData.usageLimit && formData.usageLimitPerCustomer && 
        parseInt(formData.usageLimitPerCustomer, 10) > parseInt(formData.usageLimit, 10)) {
      newErrors.usageLimitPerCustomer = 'Per-customer limit cannot exceed total limit';
    }

    // Conditions validation
    if (formData.conditions.minimumQuantity && formData.conditions.maximumQuantity &&
        parseInt(formData.conditions.minimumQuantity) > parseInt(formData.conditions.maximumQuantity)) {
      newErrors.maximumQuantity = 'Maximum quantity cannot be less than minimum quantity';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Show error toast with list of incorrect fields
      const errorMessages = [];
      if (errors.name) errorMessages.push(`Name is incorrect: ${errors.name}`);
      if (errors.code) errorMessages.push(`Code is incorrect: ${errors.code}`);
      if (errors.value) errorMessages.push(`Value is incorrect: ${errors.value}`);
      if (errors.validFrom) errorMessages.push(`Valid from date is incorrect: ${errors.validFrom}`);
      if (errors.validUntil) errorMessages.push(`Valid until date is incorrect: ${errors.validUntil}`);
      if (errors.applicableProducts) errorMessages.push(`Products selection is incorrect: ${errors.applicableProducts}`);
      if (errors.applicableCategories) errorMessages.push(`Categories selection is incorrect: ${errors.applicableCategories}`);
      if (errors.applicableCustomers) errorMessages.push(`Customers selection is incorrect: ${errors.applicableCustomers}`);
      if (errors.maximumDiscount) errorMessages.push(`Maximum discount is incorrect: ${errors.maximumDiscount}`);
      if (errors.usageLimit) errorMessages.push(`Usage limit is incorrect: ${errors.usageLimit}`);
      if (errors.usageLimitPerCustomer) errorMessages.push(`Usage limit per customer is incorrect: ${errors.usageLimitPerCustomer}`);
      if (errors.maximumQuantity) errorMessages.push(`Maximum quantity is incorrect: ${errors.maximumQuantity}`);
      
      const errorMessage = errorMessages.length > 0 
        ? errorMessages.join('. ')
        : 'Please fill all required fields correctly';
      
      showErrorToast(errorMessage);
      
      // Check if current tab has errors, if yes, stay on current tab
      // Otherwise, go to first tab with errors
      const currentTabHasErrors = 
        (activeTab === 'basic' && (errors.name || errors.code || errors.value || errors.validFrom || errors.validUntil || errors.maximumDiscount || errors.minimumOrderAmount)) ||
        (activeTab === 'applicability' && (errors.applicableProducts || errors.applicableCategories || errors.applicableCustomers)) ||
        (activeTab === 'conditions' && (errors.maximumQuantity || errors.minimumQuantity)) ||
        (activeTab === 'advanced' && (errors.usageLimit || errors.usageLimitPerCustomer || errors.priority));
      
      if (!currentTabHasErrors) {
        // Only switch tab if current tab doesn't have errors
        if (errors.name || errors.code || errors.value || errors.validFrom || errors.validUntil || errors.maximumDiscount || errors.minimumOrderAmount) {
          setActiveTab('basic');
        } else if (errors.applicableProducts || errors.applicableCategories || errors.applicableCustomers) {
          setActiveTab('applicability');
        } else if (errors.maximumQuantity || errors.minimumQuantity) {
          setActiveTab('conditions');
        } else if (errors.usageLimit || errors.usageLimitPerCustomer || errors.priority) {
          setActiveTab('advanced');
        }
      }
      // If current tab has errors, stay on current tab (don't change activeTab)
      return;
    }

    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        code: formData.code.toUpperCase(),
        value: parseFloat(formData.value),
        // Only include maximumDiscount if it has a value, otherwise omit it completely
        ...(formData.maximumDiscount && formData.maximumDiscount !== '' 
          ? { maximumDiscount: parseFloat(formData.maximumDiscount) } 
          : {}),
        minimumOrderAmount: parseFloat(formData.minimumOrderAmount),
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        usageLimitPerCustomer: formData.usageLimitPerCustomer ? parseInt(formData.usageLimitPerCustomer) : null,
        priority: parseInt(formData.priority),
        conditions: {
          ...formData.conditions,
          minimumQuantity: parseInt(formData.conditions.minimumQuantity),
          maximumQuantity: formData.conditions.maximumQuantity ? parseInt(formData.conditions.maximumQuantity) : null
        }
      };

      await createDiscount(submitData).unwrap();
      showSuccessToast('Discount created successfully');
      onSuccess();
    } catch (error) {
      // Handle validation errors from backend
      const newErrors = {};
      const errorMessages = [];
      
      if (error?.data?.errors && Array.isArray(error.data.errors)) {
        error.data.errors.forEach((err) => {
          if (err.field && err.message) {
            newErrors[err.field] = err.message;
            // Format error message for display
            const fieldName = err.field
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim();
            errorMessages.push(`${fieldName} is incorrect: ${err.message}`);
          }
        });
      }
      
      // If we have field-specific errors, set them and show detailed toast
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        
        // Show detailed error messages
        if (errorMessages.length > 0) {
          showErrorToast(errorMessages.join('. '));
        } else {
          // Fallback: show field names that have errors
          const fieldNames = Object.keys(newErrors)
            .map(field => (field ?? '')
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim()
            )
            .join(', ');
          showErrorToast(`${fieldNames} ${Object.keys(newErrors).length === 1 ? 'is' : 'are'} incorrect. Please check and correct the fields.`);
        }
        
        // Check if current tab has errors, if yes, stay on current tab
        // Otherwise, go to first tab with errors
        const currentTabHasErrors = 
          (activeTab === 'basic' && (newErrors.name || newErrors.code || newErrors.value || newErrors.validFrom || newErrors.validUntil || newErrors.maximumDiscount || newErrors.minimumOrderAmount)) ||
          (activeTab === 'applicability' && (newErrors.applicableProducts || newErrors.applicableCategories || newErrors.applicableCustomers)) ||
          (activeTab === 'conditions' && (newErrors.maximumQuantity || newErrors.minimumQuantity)) ||
          (activeTab === 'advanced' && (newErrors.usageLimit || newErrors.usageLimitPerCustomer || newErrors.priority));
        
        if (!currentTabHasErrors) {
          // Only switch tab if current tab doesn't have errors
          if (newErrors.maximumDiscount || newErrors.minimumOrderAmount || newErrors.value || newErrors.name || newErrors.code || newErrors.validFrom || newErrors.validUntil) {
            setActiveTab('basic');
          } else if (newErrors.applicableProducts || newErrors.applicableCategories || newErrors.applicableCustomers) {
            setActiveTab('applicability');
          } else if (newErrors.maximumQuantity || newErrors.minimumQuantity) {
            setActiveTab('conditions');
          } else if (newErrors.usageLimit || newErrors.usageLimitPerCustomer || newErrors.priority) {
            setActiveTab('advanced');
          }
        }
        // If current tab has errors, stay on current tab (don't change activeTab)
      } else {
        // If no specific field errors, show general error message
        const errorMessage = error?.data?.message || error?.message || 'An error occurred while creating the discount';
        showErrorToast(errorMessage);
      }
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

  const handleConditionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        [field]: value
      }
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleTimeChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        timeOfDay: {
          ...prev.conditions.timeOfDay,
          [field]: value
        }
      }
    }));
  };

  const handleArrayChange = (field, value, checked) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked 
        ? [...prev[field], value]
        : prev[field].filter(item => item !== value)
    }));
  };

  const handleCodeSuggestionSelect = (suggestion) => {
    setFormData(prev => ({
      ...prev,
      code: suggestion
    }));
    setShowCodeSuggestions(false);
  };

  const { data: codeAvailabilityData } = useCheckCodeAvailabilityQuery(
    formData.code,
    { skip: formData.code.length < 3 }
  );
  
  useEffect(() => {
    if (codeAvailabilityData && !codeAvailabilityData.available) {
      setErrors(prev => ({
        ...prev,
        code: 'This code is already taken'
      }));
    } else if (codeAvailabilityData && codeAvailabilityData.available) {
      setErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors.code === 'This code is already taken') {
          delete newErrors.code;
        }
        return newErrors;
      });
    }
  }, [codeAvailabilityData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Discount"
      subtitle="Fill in the required information below"
      maxWidth="xl"
      variant="scrollable"
      contentClassName="p-8"
      className="rounded-2xl"
    >
          {/* Tabs */}
          <div className="border-b border-slate-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
          {activeTab === 'basic' && (
            <div className="space-y-8">
              {/* Basic Section */}
              <div>
                <h3 className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-6 border-b border-primary-100 pb-2">Primary Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium ${
                        errors.name ? 'border-red-300' : 'border-slate-200'
                      }`}
                      placeholder="e.g., Summer Sale 2024"
                      disabled={isCreating}
                    />
                    {errors.name && (
                      <p className="mt-1 text-xs text-red-600 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {errors.name}
                      </p>
                    )}
                  </div>

                  {/* Code */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Code *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          handleChange('code', value);
                          // Code availability is checked automatically via useCheckCodeAvailabilityQuery
                        }}
                        onFocus={() => setShowCodeSuggestions(true)}
                        className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-bold uppercase tracking-widest placeholder:text-slate-300 ${
                          errors.code ? 'border-red-300' : 'border-slate-200'
                        }`}
                        placeholder="e.g., SUMMER2024"
                        disabled={isCreating}
                      />
                      <button
                        type="button"
                        onClick={generateCodeSuggestions}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        disabled={isCreating}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Code Suggestions */}
                    {showCodeSuggestions && codeSuggestions.length > 0 && (
                      <div className="mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10">
                        {codeSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleCodeSuggestionSelect(suggestion)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {errors.code && (
                      <p className="mt-1 text-xs text-red-600 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {errors.code}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium"
                      rows={3}
                      placeholder="Describe the discount..."
                      disabled={isCreating}
                    />
                  </div>
                </div>
              </div>

              {/* Discount Details Section */}
              <div>
                <h3 className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-6 border-b border-primary-100 pb-2">Discount Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Type */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleChange('type', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-bold uppercase tracking-widest"
                      disabled={isCreating}
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed_amount">Fixed Amount</option>
                    </select>
                  </div>

                  {/* Value */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Value *</label>
                    <div className="relative">
                      {formData.type === 'percentage' ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={formData.value}
                            onChange={(e) => handleChange('value', parseFloat(e.target.value) || 0)}
                            className={`w-full pr-10 px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium ${
                              errors.value ? 'border-red-300' : 'border-slate-200'
                            }`}
                            placeholder="10"
                            disabled={isCreating}
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <Percent className="h-4 w-4 text-slate-400" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <TrendingUp className="h-4 w-4 text-slate-400" />
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.value}
                            onChange={(e) => handleChange('value', parseFloat(e.target.value) || 0)}
                            className={`w-full pl-10 px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium ${
                              errors.value ? 'border-red-300' : 'border-slate-200'
                            }`}
                            placeholder="10.00"
                            disabled={isCreating}
                          />
                        </>
                      )}
                    </div>
                    {errors.value && (
                      <p className="mt-1 text-xs text-red-600 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {errors.value}
                      </p>
                    )}
                  </div>

                  {/* Maximum Discount (for percentage) */}
                  {formData.type === 'percentage' && (
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Maximum Discount Amount (Optional)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <TrendingUp className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.maximumDiscount}
                          onChange={(e) => handleChange('maximumDiscount', e.target.value)}
                          className={`w-full pl-10 px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium ${
                            errors.maximumDiscount ? 'border-red-300' : 'border-slate-200'
                          }`}
                          placeholder="50.00"
                          disabled={isCreating}
                        />
                      </div>
                      {errors.maximumDiscount && (
                        <p className="mt-1 text-xs text-red-600 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {errors.maximumDiscount}
                        </p>
                      )}
                      {!errors.maximumDiscount && (
                        <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          Maximum amount that can be discounted
                        </p>
                      )}
                    </div>
                  )}

                  {/* Minimum Order Amount */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Minimum Order Amount</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <TrendingUp className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.minimumOrderAmount}
                        onChange={(e) => handleChange('minimumOrderAmount', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium"
                        placeholder="0.00"
                        disabled={isCreating}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Validity Period Section */}
              <div>
                <h3 className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-6 border-b border-primary-100 pb-2">Validity Period</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Valid From *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="date"
                        value={formData.validFrom}
                        onChange={(e) => handleChange('validFrom', e.target.value)}
                        className={`w-full pl-10 px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium ${
                          errors.validFrom ? 'border-red-300' : 'border-slate-200'
                        }`}
                        disabled={isCreating}
                      />
                    </div>
                    {errors.validFrom && (
                      <p className="mt-1 text-xs text-red-600 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {errors.validFrom}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Valid Until *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="date"
                        value={formData.validUntil}
                        onChange={(e) => handleChange('validUntil', e.target.value)}
                        className={`w-full pl-10 px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium ${
                          errors.validUntil ? 'border-red-300' : 'border-slate-200'
                        }`}
                        disabled={isCreating}
                      />
                    </div>
                    {errors.validUntil && (
                      <p className="mt-1 text-xs text-red-600 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {errors.validUntil}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'applicability' && (
            <div className="space-y-6">
              {/* Applicable To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applicable To <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.applicableTo}
                  onChange={(e) => handleChange('applicableTo', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={isCreating}
                >
                  <option value="all">All Orders</option>
                  <option value="products">Specific Products</option>
                  <option value="categories">Specific Categories</option>
                  <option value="customers">Specific Customers</option>
                </select>
              </div>

              {/* Products Selection */}
              {formData.applicableTo === 'products' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Products
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3">
                    {products?.data?.products?.map((product) => (
                      <label key={product._id} className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          checked={formData.applicableProducts.includes(product._id)}
                          onChange={(e) => handleArrayChange('applicableProducts', product._id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          disabled={isCreating}
                        />
                        <span className="text-sm text-gray-900">
                          {product.name} ({typeof product.category === 'object' ? (product.category?.name ?? 'N/A') : (product.category || 'N/A')})
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.applicableProducts && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.applicableProducts}
                    </p>
                  )}
                </div>
              )}

              {/* Categories Selection */}
              {formData.applicableTo === 'categories' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Categories
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3">
                    {categories?.data?.categories?.map((category) => (
                      <label key={category._id} className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          checked={formData.applicableCategories.includes(category._id)}
                          onChange={(e) => handleArrayChange('applicableCategories', category._id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          disabled={isCreating}
                        />
                        <span className="text-sm text-gray-900">{category.name}</span>
                      </label>
                    ))}
                  </div>
                  {errors.applicableCategories && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.applicableCategories}
                    </p>
                  )}
                </div>
              )}

              {/* Customers Selection */}
              {formData.applicableTo === 'customers' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Customers
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3">
                    {customers?.data?.customers?.map((customer) => (
                      <label key={customer._id} className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          checked={formData.applicableCustomers.includes(customer._id)}
                          onChange={(e) => handleArrayChange('applicableCustomers', customer._id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          disabled={isCreating}
                        />
                        <span className="text-sm text-gray-900">
                          {customer.displayName} ({customer.email})
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.applicableCustomers && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.applicableCustomers}
                    </p>
                  )}
                </div>
              )}

              {/* Customer Tiers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Tiers (Optional)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {customerTiers.map((tier) => (
                    <label key={tier.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.customerTiers.includes(tier.value)}
                        onChange={(e) => handleArrayChange('customerTiers', tier.value, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={isCreating}
                      />
                      <span className="text-sm text-gray-900 capitalize">{tier.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Business Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Types (Optional)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {businessTypes.map((type) => (
                    <label key={type.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.businessTypes.includes(type.value)}
                        onChange={(e) => handleArrayChange('businessTypes', type.value, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={isCreating}
                      />
                      <span className="text-sm text-gray-900 capitalize">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'conditions' && (
            <div className="space-y-6">
              {/* Quantity Conditions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.conditions.minimumQuantity}
                    onChange={(e) => handleConditionChange('minimumQuantity', parseInt(e.target.value) || 1)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.conditions.maximumQuantity}
                    onChange={(e) => handleConditionChange('maximumQuantity', e.target.value)}
                    className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      errors.maximumQuantity ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Leave empty for no limit"
                    disabled={isCreating}
                  />
                  {errors.maximumQuantity && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.maximumQuantity}
                    </p>
                  )}
                </div>
              </div>

              {/* Days of Week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Days of Week (Optional)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {daysOfWeek.map((day) => (
                    <label key={day.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.conditions.daysOfWeek.includes(day.value)}
                        onChange={(e) => {
                          const currentDays = formData.conditions.daysOfWeek;
                          const newDays = e.target.checked
                            ? [...currentDays, day.value]
                            : currentDays.filter(d => d !== day.value);
                          handleConditionChange('daysOfWeek', newDays);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={isCreating}
                      />
                      <span className="text-sm text-gray-900">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Time of Day */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time of Day (Optional)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={formData.conditions.timeOfDay.start}
                      onChange={(e) => handleTimeChange('start', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={isCreating}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={formData.conditions.timeOfDay.end}
                      onChange={(e) => handleTimeChange('end', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={isCreating}
                    />
                  </div>
                </div>
              </div>

              {/* Customer Type Restrictions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Restrictions (Optional)
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.conditions.firstTimeCustomersOnly}
                      onChange={(e) => handleConditionChange('firstTimeCustomersOnly', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={isCreating}
                    />
                    <span className="text-sm text-gray-900">First-time customers only</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.conditions.returningCustomersOnly}
                      onChange={(e) => handleConditionChange('returningCustomersOnly', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={isCreating}
                    />
                    <span className="text-sm text-gray-900">Returning customers only</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Usage Limits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Usage Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.usageLimit}
                    onChange={(e) => handleChange('usageLimit', e.target.value)}
                    className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      errors.usageLimit ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Leave empty for unlimited"
                    disabled={isCreating}
                  />
                  {errors.usageLimit && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.usageLimit}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usage Limit Per Customer
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.usageLimitPerCustomer}
                    onChange={(e) => handleChange('usageLimitPerCustomer', e.target.value)}
                    className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      errors.usageLimitPerCustomer ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Leave empty for unlimited"
                    disabled={isCreating}
                  />
                  {errors.usageLimitPerCustomer && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.usageLimitPerCustomer}
                    </p>
                  )}
                </div>
              </div>

              {/* Combination Rules */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.combinableWithOtherDiscounts}
                    onChange={(e) => handleChange('combinableWithOtherDiscounts', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isCreating}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Combinable with other discounts
                  </span>
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Allow this discount to be used together with other active discounts
                </p>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.priority}
                  onChange={(e) => handleChange('priority', parseInt(e.target.value) || 0)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="0"
                  disabled={isCreating}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Higher numbers have higher priority when multiple discounts apply
                </p>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-6 border-t border-slate-200 flex justify-between items-center">
            <div className="flex space-x-2">
              {activeTab !== 'basic' && (
                <button
                  type="button"
                  onClick={() => {
                    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
                    if (currentIndex > 0) {
                      setActiveTab(tabs[currentIndex - 1].id);
                    }
                  }}
                  className="px-6 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-200 rounded-xl transition-all"
                  disabled={isCreating}
                >
                  Previous
                </button>
              )}
              {activeTab !== 'advanced' && (
                <button
                  type="button"
                  onClick={() => {
                    // Validate current tab before moving to next
                    const currentTabErrors = {};
                    
                    if (activeTab === 'basic') {
                      if (!formData.name.trim()) currentTabErrors.name = 'Name is required';
                      if (!formData.code.trim()) currentTabErrors.code = 'Code is required';
                      else if (!/^[A-Z0-9-_]+$/.test(formData.code)) currentTabErrors.code = 'Code can only contain uppercase letters, numbers, hyphens, and underscores';
                      if (formData.value <= 0) currentTabErrors.value = 'Value must be greater than 0';
                      if (formData.type === 'percentage' && formData.value > 100) currentTabErrors.value = 'Percentage cannot exceed 100%';
                      if (!formData.validFrom) currentTabErrors.validFrom = 'Valid from date is required';
                      if (!formData.validUntil) currentTabErrors.validUntil = 'Valid until date is required';
                      else if (new Date(formData.validUntil) <= new Date(formData.validFrom)) {
                        currentTabErrors.validUntil = 'Valid until date must be after valid from date';
                      }
                      if (formData.maximumDiscount && parseFloat(formData.maximumDiscount) < 0) {
                        currentTabErrors.maximumDiscount = 'Maximum discount must be non-negative';
                      }
                    } else if (activeTab === 'applicability') {
                      if (formData.applicableTo === 'products' && formData.applicableProducts.length === 0) {
                        currentTabErrors.applicableProducts = 'At least one product must be selected';
                      }
                      if (formData.applicableTo === 'categories' && formData.applicableCategories.length === 0) {
                        currentTabErrors.applicableCategories = 'At least one category must be selected';
                      }
                      if (formData.applicableTo === 'customers' && formData.applicableCustomers.length === 0) {
                        currentTabErrors.applicableCustomers = 'At least one customer must be selected';
                      }
                    }
                    
                    if (Object.keys(currentTabErrors).length > 0) {
                      setErrors(prev => ({ ...prev, ...currentTabErrors }));
                      const errorMessages = Object.values(currentTabErrors);
                      showErrorToast(`Please fill the following fields: ${errorMessages.join(', ')}`);
                      return;
                    }
                    
                    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
                    if (currentIndex < tabs.length - 1) {
                      setActiveTab(tabs[currentIndex + 1].id);
                    }
                  }}
                  className="px-6 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-200 rounded-xl transition-all"
                  disabled={isCreating}
                >
                  Next
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-200 rounded-xl transition-all"
                disabled={isCreating}
              >
                Discard
              </button>
              {/* Only show Create Discount button on the last tab (advanced) */}
              {activeTab === 'advanced' && (
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    'Create Discount'
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
    </BaseModal>
  );
};

export default CreateDiscountModal;
