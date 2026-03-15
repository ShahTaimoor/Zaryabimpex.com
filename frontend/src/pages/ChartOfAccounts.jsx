import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  FolderTree,
  TrendingUp,
  TrendingDown,
  Building,
  CreditCard,
  Save,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useGetAccountsQuery,
  useGetCategoriesGroupedQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
} from '../store/services/chartOfAccountsApi';
import { LoadingSpinner, LoadingButton } from '../components/LoadingSpinner';
import { handleApiError } from '../utils/errorHandler';

const AccountTypeBadge = ({ type }) => {
  const config = {
    asset: { bg: 'bg-green-100', text: 'text-green-800', label: 'Asset', icon: TrendingUp },
    liability: { bg: 'bg-red-100', text: 'text-red-800', label: 'Liability', icon: TrendingDown },
    equity: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Equity', icon: Building },
    revenue: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Revenue', icon: TrendingUp },
    expense: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Expense', icon: CreditCard }
  };

  const typeConfig = config[type] || config.asset;
  const Icon = typeConfig.icon;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeConfig.bg} ${typeConfig.text}`}>
      <Icon className="h-3 w-3 mr-1" />
      {typeConfig.label}
    </span>
  );
};


const AccountForm = ({ account, onSave, onCancel, isOpen, existingAccounts, presetType, presetCategory, categories, categoryOptions }) => {
  const [autoGenerateCode, setAutoGenerateCode] = useState(!account); // Auto-generate for new accounts
  const [formData, setFormData] = useState({
    accountCode: account?.accountCode || '',
    accountName: account?.accountName || '',
    accountType: account?.accountType || presetType || 'asset',
    accountCategory: account?.accountCategory || presetCategory || 'current_assets',
    parentAccount: account?.parentAccount?._id || '',
    level: account?.level || 0,
    normalBalance: account?.normalBalance || 'debit',
    openingBalance: account?.openingBalance || 0,
    description: account?.description || '',
    allowDirectPosting: account?.allowDirectPosting !== undefined ? account.allowDirectPosting : true,
    isTaxable: account?.isTaxable || false,
    taxRate: account?.taxRate || 0,
    requiresReconciliation: account?.requiresReconciliation || false
  });

  // Reset form data when account prop changes (for new accounts, account will be null)
  useEffect(() => {
    setFormData({
      accountCode: account?.accountCode || '',
      accountName: account?.accountName || '',
      accountType: account?.accountType || presetType || 'asset',
      accountCategory: account?.accountCategory || presetCategory || 'current_assets',
      parentAccount: account?.parentAccount?._id || '',
      level: account?.level || 0,
      normalBalance: account?.normalBalance || 'debit',
      openingBalance: account?.openingBalance || 0,
      description: account?.description || '',
      allowDirectPosting: account?.allowDirectPosting !== undefined ? account.allowDirectPosting : true,
      isTaxable: account?.isTaxable || false,
      taxRate: account?.taxRate || 0,
      requiresReconciliation: account?.requiresReconciliation || false
    });
    setAutoGenerateCode(!account); // Enable auto-generation for new accounts
  }, [account, presetType, presetCategory]);

  // Standard account code ranges following accounting principles
  const accountCodeRanges = {
    asset: { start: 1000, end: 1999, prefix: '1' },
    liability: { start: 2000, end: 2999, prefix: '2' },
    equity: { start: 3000, end: 3999, prefix: '3' },
    revenue: { start: 4000, end: 4999, prefix: '4' },
    expense: { start: 5000, end: 5999, prefix: '5' }
  };


  const extractAccountArray = (accounts) => {
    if (Array.isArray(accounts)) return accounts;
    if (!accounts) return [];
    if (Array.isArray(accounts.data)) return accounts.data;
    if (Array.isArray(accounts.accounts)) return accounts.accounts;
    if (Array.isArray(accounts.data?.accounts)) return accounts.data.accounts;
    return [];
  };

  // Generate next available account code based on account type
  const generateAccountCode = (accountType) => {
    const range = accountCodeRanges[accountType];
    if (!range) return '1000';

    const accountList = extractAccountArray(existingAccounts);
    if (!accountList.length) {
      return range.start?.toString() || '1000';
    }

    // Get all account codes for this type
    const existingCodes = accountList
      .filter(acc => acc.accountType === accountType)
      .map(acc => parseInt(acc.accountCode))
      .filter(code => !isNaN(code) && code >= range.start && code <= range.end)
      .sort((a, b) => a - b);

    // Find next available code
    let nextCode = range.start;
    for (const code of existingCodes) {
      if (code === nextCode) {
        nextCode++;
      } else if (code > nextCode) {
        break;
      }
    }

    // Make sure we don't exceed the range
    if (nextCode > range.end) {
      toast.error(`No more account codes available for ${accountType}. Range: ${range.start}-${range.end}`);
      return range.start.toString();
    }

    return nextCode.toString();
  };

  // Update form data when preset values change
  useEffect(() => {
    if (presetType && presetCategory && !account) {
      // Set normal balance based on account type
      const normalBalance = ['asset', 'expense'].includes(presetType) ? 'debit' : 'credit';
      
      setFormData(prev => ({
        ...prev,
        accountType: presetType,
        accountCategory: presetCategory,
        normalBalance: normalBalance
      }));
    }
  }, [presetType, presetCategory, account]);

  // Auto-generate account code when type changes and auto-generate is enabled
  useEffect(() => {
    if (autoGenerateCode && !account && formData.accountType) {
      const newCode = generateAccountCode(formData.accountType);
      setFormData(prev => ({ ...prev, accountCode: newCode }));
    }
  }, [formData.accountType, autoGenerateCode, account]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {account ? 'Edit Account' : 'Create New Account'}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Account Code *
                </label>
                {!account && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="autoGenerateCode"
                      checked={autoGenerateCode}
                      onChange={(e) => {
                        setAutoGenerateCode(e.target.checked);
                        if (e.target.checked) {
                          const newCode = generateAccountCode(formData.accountType);
                          setFormData({ ...formData, accountCode: newCode });
                        }
                      }}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="autoGenerateCode" className="text-xs text-gray-600 cursor-pointer">
                      Auto-generate
                    </label>
                  </div>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={formData.accountCode}
                  onChange={(e) => setFormData({ ...formData, accountCode: e.target.value.toUpperCase() })}
                  className="input pr-20"
                  placeholder={autoGenerateCode ? "Auto-generated" : "e.g., 1000, 2000, 3000"}
                  required
                  disabled={!!account || autoGenerateCode} // Can't change code after creation or when auto-generating
                />
                {autoGenerateCode && !account && (
                  <button
                    type="button"
                    onClick={() => {
                      const newCode = generateAccountCode(formData.accountType);
                      setFormData({ ...formData, accountCode: newCode });
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-primary-600 hover:text-primary-800 font-medium"
                  >
                    Regenerate
                  </button>
                )}
              </div>
              {autoGenerateCode && !account && (
                <p className="text-xs text-gray-500 mt-1">
                  Range: {accountCodeRanges[formData.accountType]?.start} - {accountCodeRanges[formData.accountType]?.end}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Name *
              </label>
              <input
                type="text"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                className="input"
                placeholder="e.g., Cash in Hand"
                required
              />
            </div>
          </div>

          {/* Account Type and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type *
              </label>
              <select
                value={formData.accountType}
                onChange={(e) => {
                  const newType = e.target.value;
                  setFormData({ 
                    ...formData, 
                    accountType: newType,
                    accountCategory: categoryOptions[newType][0].value
                  });
                }}
                className="input"
                required
                disabled={!!account} // Can't change type after creation
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Category *
              </label>
              <select
                value={formData.accountCategory}
                onChange={(e) => setFormData({ ...formData, accountCategory: e.target.value })}
                className="input"
                required
              >
                {categoryOptions[formData.accountType].map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Normal Balance and Opening Balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Normal Balance *
              </label>
              <select
                value={formData.normalBalance}
                onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value })}
                className="input"
                required
                disabled={!!account} // Can't change after creation
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>

            {!account && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Opening Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                  className="input"
                  placeholder="0.00"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
              placeholder="Account description..."
            />
          </div>

          {/* Checkboxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="allowDirectPosting"
                checked={formData.allowDirectPosting}
                onChange={(e) => setFormData({ ...formData, allowDirectPosting: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="allowDirectPosting" className="ml-2 text-sm text-gray-700">
                Allow Direct Posting
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isTaxable"
                checked={formData.isTaxable}
                onChange={(e) => setFormData({ ...formData, isTaxable: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isTaxable" className="ml-2 text-sm text-gray-700">
                Taxable
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="requiresReconciliation"
                checked={formData.requiresReconciliation}
                onChange={(e) => setFormData({ ...formData, requiresReconciliation: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="requiresReconciliation" className="ml-2 text-sm text-gray-700">
                Requires Reconciliation
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              <Save className="h-4 w-4 mr-2" />
              {account ? 'Update Account' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Category Management Component
const CategoryManagement = ({ categories, onCategoryCreated, onCategoryUpdated, onCategoryDeleted }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [autoGenerateCode, setAutoGenerateCode] = useState(true); // Auto-generate for new categories
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    accountType: 'asset',
    description: '',
    displayOrder: 0,
    color: '#6B7280'
  });

  // Function to generate category code from name
  const generateCategoryCode = (name) => {
    if (!name) return '';
    
    // Convert to uppercase and replace spaces/special characters with underscores
    let code = name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    
    // Limit to reasonable length
    if (code.length > 20) {
      code = code.substring(0, 20);
    }
    
    return code;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedCategory) {
        await accountCategoriesAPI.updateCategory(selectedCategory._id, formData);
        onCategoryUpdated();
        toast.success('Category updated successfully!');
      } else {
        await accountCategoriesAPI.createCategory(formData);
        onCategoryCreated();
        toast.success('Category created successfully!');
      }
      setIsFormOpen(false);
      setSelectedCategory(null);
      setAutoGenerateCode(true);
      setFormData({
        name: '',
        code: '',
        accountType: 'asset',
        description: '',
        displayOrder: 0,
        color: '#6B7280'
      });
    } catch (error) {
      handleApiError(error, 'Category Management');
    }
  };

  const handleEdit = (category) => {
    setSelectedCategory(category);
    setAutoGenerateCode(false); // Disable auto-generation when editing
    setFormData({
      name: category.name,
      code: category.code,
      accountType: category.accountType,
      description: category.description || '',
      displayOrder: category.displayOrder || 0,
      color: category.color || '#6B7280'
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (category) => {
    if (window.confirm(`Are you sure you want to delete category "${category.name}"?`)) {
      try {
        await accountCategoriesAPI.deleteCategory(category._id);
        onCategoryDeleted();
        toast.success('Category deleted successfully!');
      } catch (error) {
        handleApiError(error, 'Category Deletion');
      }
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Account Categories</h3>
        <button
          onClick={() => {
            setSelectedCategory(null);
            setAutoGenerateCode(true); // Enable auto-generation for new categories
            setFormData({
              name: '',
              code: '',
              accountType: 'asset',
              description: '',
              displayOrder: 0,
              color: '#6B7280'
            });
            setIsFormOpen(true);
          }}
          className="btn btn-primary btn-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(categories).map(([accountType, typeCategories]) => (
          <div key={accountType} className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 capitalize">{accountType}</h4>
            <div className="space-y-2">
              {typeCategories.map((category) => (
                <div key={category._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm font-medium">{category.name}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleEdit(category)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    {!category.isSystemCategory && (
                      <button
                        onClick={() => handleDelete(category)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Category Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      const newFormData = { ...formData, name: newName };
                      
                      // Auto-generate code if enabled
                      if (autoGenerateCode && !selectedCategory) {
                        newFormData.code = generateCategoryCode(newName);
                      }
                      
                      setFormData(newFormData);
                    }}
                    className="input"
                    placeholder="e.g., Current Assets"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category Code *
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="input flex-1"
                      placeholder="e.g., CUR_ASSETS"
                      required
                    />
                    {!selectedCategory && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, code: generateCategoryCode(formData.name) })}
                        className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                        title="Regenerate code from name"
                      >
                        Regenerate
                      </button>
                    )}
                  </div>
                  {!selectedCategory && (
                    <div className="mt-2 flex items-center">
                      <input
                        type="checkbox"
                        id="autoGenerateCode"
                        checked={autoGenerateCode}
                        onChange={(e) => setAutoGenerateCode(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="autoGenerateCode" className="ml-2 text-sm text-gray-600">
                        Auto-generate from name
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type *
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    className="input"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Category description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="input flex-1"
                    placeholder="#6B7280"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {selectedCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const ChartOfAccounts = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Function to organize accounts into 3-level hierarchy
  const organizeAccountsHierarchy = (accounts) => {
    let accountList = [];

    if (Array.isArray(accounts)) {
      accountList = accounts;
    } else if (accounts?.data) {
      if (Array.isArray(accounts.data)) {
        accountList = accounts.data;
      } else if (Array.isArray(accounts.data.accounts)) {
        accountList = accounts.data.accounts;
      } else if (Array.isArray(accounts.accounts)) {
        accountList = accounts.accounts;
      }
    }

    if (!Array.isArray(accountList)) {
      return {};
    }

    const hierarchy = {
      asset: {},
      liability: {},
      equity: {},
      revenue: {},
      expense: {}
    };

    // Group accounts by type and category
    accountList.forEach(account => {
      const type = account.accountType;
      const category = account.accountCategory;
      if (!hierarchy[type][category]) {
        hierarchy[type][category] = [];
      }
      hierarchy[type][category].push(account);
    });

    // Sort accounts within each category by account code
    Object.keys(hierarchy).forEach(type => {
      Object.keys(hierarchy[type]).forEach(category => {
        hierarchy[type][category].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
      });
    });

    return hierarchy;
  };

  // Account categories based on Chart of Accounts model enum
  const categoryOptions = {
    asset: [
      { value: 'current_assets', label: 'Current Assets' },
      { value: 'fixed_assets', label: 'Fixed Assets' },
      { value: 'other_assets', label: 'Other Assets' },
      { value: 'inventory', label: 'Inventory' },
      { value: 'prepaid_expenses', label: 'Prepaid Expenses' }
    ],
    liability: [
      { value: 'current_liabilities', label: 'Current Liabilities' },
      { value: 'long_term_liabilities', label: 'Long-term Liabilities' },
      { value: 'accrued_expenses', label: 'Accrued Expenses' },
      { value: 'deferred_revenue', label: 'Deferred Revenue' }
    ],
    equity: [
      { value: 'owner_equity', label: 'Owner Equity' },
      { value: 'retained_earnings', label: 'Retained Earnings' }
    ],
    revenue: [
      { value: 'sales_revenue', label: 'Sales Revenue' },
      { value: 'other_revenue', label: 'Other Revenue' }
    ],
    expense: [
      { value: 'cost_of_goods_sold', label: 'Cost of Goods Sold' },
      { value: 'operating_expenses', label: 'Operating Expenses' },
      { value: 'other_expenses', label: 'Other Expenses' },
      { value: 'manufacturing_overhead', label: 'Manufacturing Overhead' },
      { value: 'service_delivery', label: 'Service Delivery' },
      { value: 'quality_control', label: 'Quality Control' },
      { value: 'warehouse_operations', label: 'Warehouse Operations' },
      { value: 'shipping_handling', label: 'Shipping & Handling' },
      { value: 'security_loss_prevention', label: 'Security & Loss Prevention' }
    ]
  };

  const [filterType, setFilterType] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [presetType, setPresetType] = useState(null);
  const [presetCategory, setPresetCategory] = useState(null);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  
  // Fetch accounts
  const { data: accountsResponse, isLoading, error, refetch: refetchAccounts } = useGetAccountsQuery(
    { 
      search: searchTerm,
      accountType: filterType || undefined,
      isActive: !showInactive ? 'true' : undefined
    },
    {
      onError: () => {
        // Error handled by RTK Query
      }
    }
  );

  // Extract accounts array from response (RTK Query transformResponse normalizes it)
  const accounts = React.useMemo(() => {
    if (Array.isArray(accountsResponse)) return accountsResponse;
    // Fallback in case transformResponse doesn't work
    if (Array.isArray(accountsResponse?.data)) return accountsResponse.data;
    if (Array.isArray(accountsResponse?.data?.accounts)) return accountsResponse.data.accounts;
    if (Array.isArray(accountsResponse?.accounts)) return accountsResponse.accounts;
    return [];
  }, [accountsResponse]);

  // Fetch account categories
  const { data: categories, isLoading: categoriesLoading } = useGetCategoriesGroupedQuery(undefined, {
    onError: () => {
      // Error handled by RTK Query
    }
  });

  // Mutations
  const [createAccount] = useCreateAccountMutation();
  const [updateAccount] = useUpdateAccountMutation();
  const [deleteAccount] = useDeleteAccountMutation();

  const handleSave = async (formData) => {
    try {
      if (selectedAccount) {
        await updateAccount({ id: selectedAccount._id, ...formData }).unwrap();
        toast.success('Account updated successfully!');
      } else {
        await createAccount(formData).unwrap();
        toast.success('Account created successfully!');
      }
      setIsFormOpen(false);
      setSelectedAccount(null);
      refetchAccounts();
    } catch (error) {
      handleApiError(error, selectedAccount ? 'Account Update' : 'Account Creation');
    }
  };

  const handleEdit = (account) => {
    setSelectedAccount(account);
    setIsFormOpen(true);
  };

  const handleDelete = async (account) => {
    if (window.confirm(`Are you sure you want to delete account "${account.accountName}"?`)) {
      try {
        await deleteAccount(account._id).unwrap();
        toast.success('Account deleted successfully!');
        refetchAccounts();
      } catch (error) {
        handleApiError(error, 'Account Deletion');
      }
    }
  };

  const handleAddNew = () => {
    setSelectedAccount(null);
    setPresetType(null);
    setPresetCategory(null);
    setIsFormOpen(true);
  };

  const handleQuickCreate = (accountType, accountCategory) => {
    setSelectedAccount(null);
    setPresetType(accountType);
    setPresetCategory(accountCategory);
    setIsFormOpen(true);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
            <p className="text-gray-600">Manage your accounting structure and account heads</p>
          </div>
        </div>
        <div className="card">
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">
              <FolderTree className="mx-auto h-12 w-12" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Accounts</h3>
            <p className="text-gray-600 mb-4">Failed to load chart of accounts. Please try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your accounting structure and account heads</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowCategoryManagement(!showCategoryManagement)}
            className="btn btn-secondary btn-md flex items-center justify-center gap-2"
          >
            <FolderTree className="h-4 w-4" />
            <span className="hidden sm:inline">{showCategoryManagement ? 'Hide Categories' : 'Manage Categories'}</span>
            <span className="sm:hidden">Categories</span>
          </button>
          <button
            onClick={handleAddNew}
            className="btn btn-primary btn-md flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Account
          </button>
        </div>
      </div>

      {/* Quick Create Buttons */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Quick Create Accounts</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {/* Asset */}
          <button
            onClick={() => handleQuickCreate('asset', 'current_assets')}
            className="flex flex-col items-center p-4 border-2 border-green-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors group"
          >
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-200">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Asset</h4>
            <p className="text-xs text-gray-600 text-center">Current Assets</p>
          </button>

          {/* Liability */}
          <button
            onClick={() => handleQuickCreate('liability', 'current_liabilities')}
            className="flex flex-col items-center p-4 border-2 border-red-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-colors group"
          >
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-red-200">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Liability</h4>
            <p className="text-xs text-gray-600 text-center">Current Liabilities</p>
          </button>

          {/* Equity */}
          <button
            onClick={() => handleQuickCreate('equity', 'owner_equity')}
            className="flex flex-col items-center p-4 border-2 border-blue-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-200">
              <Building className="h-6 w-6 text-blue-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Equity</h4>
            <p className="text-xs text-gray-600 text-center">Owner Equity</p>
          </button>

          {/* Revenue */}
          <button
            onClick={() => handleQuickCreate('revenue', 'sales_revenue')}
            className="flex flex-col items-center p-4 border-2 border-purple-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors group"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-200">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Revenue</h4>
            <p className="text-xs text-gray-600 text-center">Sales Revenue</p>
          </button>

          {/* Expense */}
          <button
            onClick={() => handleQuickCreate('expense', 'operating_expenses')}
            className="flex flex-col items-center p-4 border-2 border-orange-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors group"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-orange-200">
              <CreditCard className="h-6 w-6 text-orange-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Expense</h4>
            <p className="text-xs text-gray-600 text-center">Operating Expenses</p>
          </button>
        </div>
      </div>

      {/* Category Management Section */}
      {showCategoryManagement && (
        <CategoryManagement
          categories={categories?.data || {}}
          onCategoryCreated={() => queryClient.invalidateQueries('accountCategories')}
          onCategoryUpdated={() => queryClient.invalidateQueries('accountCategories')}
          onCategoryDeleted={() => queryClient.invalidateQueries('accountCategories')}
        />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by account code, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 input w-full"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input w-full sm:w-48"
        >
          <option value="">All Types</option>
          <option value="asset">Assets</option>
          <option value="liability">Liabilities</option>
          <option value="equity">Equity</option>
          <option value="revenue">Revenue</option>
          <option value="expense">Expenses</option>
        </select>

        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`btn btn-md ${showInactive ? 'btn-primary' : 'btn-secondary'} flex items-center justify-center gap-2 w-full sm:w-auto`}
        >
          {showInactive ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
          {showInactive ? 'Show Active' : 'Show All'}
        </button>
      </div>

      {/* Accounts Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Balance
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Normal Balance
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!accounts || accounts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <FolderTree className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p>No accounts found. Create your first account to get started.</p>
                  </td>
                </tr>
              ) : (
                (() => {
                  const hierarchy = organizeAccountsHierarchy(accounts);
                  const typeLabels = {
                    asset: 'Assets',
                    liability: 'Liabilities', 
                    equity: 'Equity',
                    revenue: 'Revenue',
                    expense: 'Expenses'
                  };
                  
                  const rows = [];
                  
                  // Generate hierarchical rows
                  Object.keys(hierarchy).forEach(type => {
                    const typeAccounts = hierarchy[type];
                    const hasAccounts = Object.values(typeAccounts).some(category => category.length > 0);
                    
                    if (hasAccounts) {
                      // Type header row
                      rows.push(
                        <tr key={`type-${type}`} className="bg-gray-50 border-t-2 border-gray-200">
                          <td colSpan="7" className="px-6 py-3">
                            <div className="flex items-center">
                              <AccountTypeBadge type={type} />
                              <span className="ml-3 text-lg font-semibold text-gray-900">
                                {typeLabels[type]}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                      
                      // Category and account rows
                      Object.keys(typeAccounts).forEach(category => {
                        const categoryAccounts = typeAccounts[category];
                        
                        if (categoryAccounts.length > 0) {
                          // Category header row
                          const categoryLabel = categoryOptions[type]?.find(cat => cat.value === category)?.label || category;
                          rows.push(
                            <tr key={`category-${type}-${category}`} className="bg-blue-50">
                              <td colSpan="7" className="px-6 py-2 pl-12">
                                <div className="flex items-center">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                                  <span className="text-sm font-medium text-blue-900">
                                    {categoryLabel}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                          
                          // Individual account rows
                          categoryAccounts.forEach(account => {
                            rows.push(
                              <tr key={account._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap pl-20">
                                  <span className="text-sm font-mono font-medium text-gray-900">
                                    {account.accountCode}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{account.accountName}</div>
                                    {account.description && (
                                      <div className="text-xs text-gray-500">{account.description}</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <AccountTypeBadge type={account.accountType} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm text-gray-600 capitalize">
                                    {account.accountCategory.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <span className={`text-sm font-semibold ${
                                    account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {account.currentBalance.toFixed(2)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                    account.normalBalance === 'debit' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {account.normalBalance.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex items-center justify-end space-x-2">
                                    <button
                                      onClick={() => handleEdit(account)}
                                      className="text-blue-600 hover:text-blue-900"
                                      title="Edit"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    {!account.isSystemAccount && (
                                      <button
                                        onClick={() => handleDelete(account)}
                                        className="text-red-600 hover:text-red-900"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        }
                      });
                    }
                  });
                  
                  return rows;
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Form Modal */}
      <AccountForm
        account={selectedAccount}
        onSave={handleSave}
        onCancel={() => {
          setIsFormOpen(false);
          setSelectedAccount(null);
          setPresetType(null);
          setPresetCategory(null);
        }}
        isOpen={isFormOpen}
        existingAccounts={accounts}
        presetType={presetType}
        presetCategory={presetCategory}
        categories={categories}
        categoryOptions={categoryOptions}
      />
    </div>
  );
};

export default ChartOfAccounts;

