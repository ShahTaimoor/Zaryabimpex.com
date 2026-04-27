import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Tag,
  Folder,
  FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';

import {
  useGetCategoriesQuery,
  useGetCategoryTreeQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from '../store/services/categoriesApi';
import PaginationControls from '../components/PaginationControls';
import { flattenCategoryApiTree } from '../utils/categoryTree';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import PageShell from '../components/PageShell';

const CategoryModal = ({ category, isOpen, onClose, onSave, isSubmitting, categories = [], categoryType = 'parent' }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentCategory: '',
    sortOrder: 0,
    isActive: true
  });

  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        parentCategory: category.parentCategory?._id || '',
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive !== undefined ? category.isActive : true
      });
    } else {
      setFormData({
        name: '',
        description: '',
        parentCategory: '',
        sortOrder: 0,
        isActive: true
      });
    }
    setErrors({});
  }, [category, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
    }
    
    // For child categories, parent category is required
    if (!category && categoryType === 'child' && !formData.parentCategory) {
      newErrors.parentCategory = 'Parent category is required for child categories';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <PageShell contentClassName="flex items-start sm:items-center justify-center pt-4 px-4 pb-6 sm:pb-20 text-center">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-lg sm:my-8 max-h-[90vh] flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 overflow-y-auto flex-1">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {category ? 'Edit Category' : 
                 categoryType === 'parent' ? 'Add New Parent Category' : 'Add New Child Category'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter category name"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    autoComplete="off"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter category description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Optional description of the category
                  </p>
                </div>

                {!category && categoryType === 'child' && (
                  <div>
                    <label htmlFor="parentCategory" className="block text-sm font-medium text-gray-700 mb-1">
                      Parent Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="parentCategory"
                      name="parentCategory"
                      value={formData.parentCategory}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Select a parent category</option>
                      {categories
                        .filter(cat => !cat.parentCategory) // Only show parent categories
                        .map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name}
                          </option>
                        ))}
                    </select>
                    <p className="mt-1 text-sm text-gray-500">
                      Select the parent category for this subcategory
                    </p>
                    {errors.parentCategory && (
                      <p className="mt-1 text-sm text-red-600">{errors.parentCategory}</p>
                    )}
                  </div>
                )}

                {!category && categoryType === 'parent' && (
                  <div>
                    <label htmlFor="parentCategory" className="block text-sm font-medium text-gray-700 mb-1">
                      Parent Category
                    </label>
                    <input
                      type="text"
                      value="No parent (Top level category)"
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm bg-gray-50 text-gray-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      This will be a top-level parent category
                    </p>
                  </div>
                )}

                {category && (
                  <div>
                    <label htmlFor="parentCategory" className="block text-sm font-medium text-gray-700 mb-1">
                      Parent Category
                    </label>
                    <select
                      id="parentCategory"
                      name="parentCategory"
                      value={formData.parentCategory}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">No parent category (Top level)</option>
                      {categories
                        .filter(cat => !category || cat._id !== category._id) // Don't allow self as parent
                        .map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name}
                          </option>
                        ))}
                    </select>
                    <p className="mt-1 text-sm text-gray-500">
                      Optional parent category for hierarchical organization
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 mb-1">
                      Sort Order
                    </label>
                    <input
                      id="sortOrder"
                      name="sortOrder"
                      type="number"
                      min="0"
                      value={formData.sortOrder}
                      onChange={handleChange}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">Display order (lower numbers first)</p>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="isActive"
                      name="isActive"
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                      Active
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse flex-shrink-0">
              <LoadingButton
                type="submit"
                isLoading={isSubmitting}
                disabled={!formData.name || isSubmitting}
                variant="default"
                size="default"
                className="w-full sm:w-auto sm:ml-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {category ? 'Update Category' : 'Create Category'}
              </LoadingButton>
              <Button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                variant="secondary"
                size="default"
                className="w-full sm:w-auto mt-3 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </PageShell>
    </div>
  );
};

export const Categories = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryType, setCategoryType] = useState('parent'); // 'parent' or 'child'
  const [searchParams] = useSearchParams();

  // Auto-open modal if URL has action=add parameter
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsModalOpen(true);
      // Clean up the URL parameter
      const url = new URL(window.location);
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url);
    }
  }, [searchParams]);

  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, error, refetch } = useGetCategoriesQuery(
    { search: debouncedSearch, page, limit: 50 },
    { refetchOnMountOrArgChange: 120 }
  );

  const { data: modalTree } = useGetCategoryTreeQuery(undefined, {
    skip: !isModalOpen,
    refetchOnMountOrArgChange: 300,
  });

  const modalCategoryList = useMemo(() => {
    const roots = Array.isArray(modalTree) ? modalTree : [];
    return flattenCategoryApiTree(roots);
  }, [modalTree]);

  const [createCategory, { isLoading: creating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateCategoryMutation();
  const [deleteCategory, { isLoading: deleting }] = useDeleteCategoryMutation();

  const handleEdit = (category) => {
    setSelectedCategory(category);
    setIsModalOpen(true);
  };

  const { confirmation, confirmDelete, handleConfirm, handleCancel } = useDeleteConfirmation();

  const handleDelete = (category) => {
    confirmDelete(category.name, 'Category', async () => {
      try {
        await deleteCategory(category._id).unwrap();
        toast.success('Category deleted successfully');
        refetch();
      } catch (error) {
        toast.error(error?.data?.message || 'Failed to delete category');
      }
    });
  };

  const handleSave = (data) => {
    // Clean the data before sending to API
    const cleanData = {
      ...data,
      parentCategory: data.parentCategory === '' ? undefined : data.parentCategory,
      sortOrder: parseInt(data.sortOrder) || 0,
      isActive: Boolean(data.isActive)
    };
    
    if (selectedCategory) {
      updateCategory({ id: selectedCategory._id, ...cleanData })
        .unwrap()
        .then(() => {
          toast.success('Category updated successfully');
          setIsModalOpen(false);
          setSelectedCategory(null);
          refetch();
        })
        .catch((error) => {
          toast.error(error?.data?.message || 'Failed to update category');
        });
    } else {
      createCategory(cleanData)
        .unwrap()
        .then(() => {
          toast.success('Category created successfully');
          setIsModalOpen(false);
          setSelectedCategory(null);
          refetch();
        })
        .catch((error) => {
          const validationErrors = error?.data?.errors;
          if (validationErrors) {
            toast.error(`Validation failed: ${Object.values(validationErrors).join(', ')}`);
          } else {
            toast.error(error?.data?.message || 'Failed to create category');
          }
        });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
    setCategoryType('parent'); // Reset to default
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-danger-600">Failed to load categories</p>
      </div>
    );
  }

  // Backend returns: { categories: [], pagination: {} }
  const categories = data?.categories || data?.data?.categories || [];
  const pagination = data?.pagination || data?.data?.pagination || {};

  if (isLoading && !data) {
    return <LoadingPage />;
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header with Add Category Button */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
            <p className="text-gray-600">Manage your product categories</p>
          </div>
          <div className="flex-shrink-0 flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => {
                setSelectedCategory(null);
                setCategoryType('parent');
                setIsModalOpen(true);
              }}
              variant="default"
              size="lg"
              className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow"
            >
              <FolderOpen className="h-5 w-5 mr-2" />
              Add Parent Category
            </Button>
            <Button
              onClick={() => {
                setSelectedCategory(null);
                setCategoryType('child');
                setIsModalOpen(true);
              }}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-shadow"
            >
              <Folder className="h-5 w-5 mr-2" />
              Add Child Category
            </Button>
          </div>
        </div>
      </div>



      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading categories...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-red-600">Error loading categories: {error.message}</p>
          <Button
            onClick={() => refetch()}
            variant="secondary"
            size="sm"
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Tag className="mx-auto h-16 w-16 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No categories found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding your first category.'}
          </p>
          <p className="mt-2 text-xs text-gray-400">Total in database: {pagination?.total || 0}</p>
          <Button
            onClick={() => refetch()}
            variant="secondary"
            size="sm"
            className="mt-4"
          >
            Refresh
          </Button>
          {!searchTerm && (
            <div className="mt-6">
              <Button
                onClick={() => {
                  setCategoryType('parent');
                  setIsModalOpen(true);
                }}
                variant="default"
                size="lg"
                className="shadow-lg hover:shadow-xl transition-shadow"
              >
                <FolderOpen className="h-5 w-5 mr-2" />
                Add Your First Parent Category
              </Button>
              <p className="mt-3 text-xs text-gray-400">
                💡 Tip: Start with parent categories (like "Electronics"), then add subcategories
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">Type</div>
              <div className="col-span-4">Category Name</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-1">Parent</div>
              <div className="col-span-1">Sort</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Actions</div>
            </div>
          </div>
          
          {/* Table Body */}
          <div className="divide-y divide-gray-200">
            {categories.map((category) => (
              <div key={category._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Type Icon */}
                  <div className="col-span-1">
                    {category.parentCategory ? (
                      <Folder className="h-5 w-5 text-gray-400" />
                    ) : (
                      <FolderOpen className="h-5 w-5 text-primary-600" />
                    )}
                  </div>
                  
                  {/* Category Name */}
                  <div className="col-span-4">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{category.name}</h3>
                    </div>
                  </div>
                  
                  {/* Description */}
                  <div className="col-span-3">
                    <p className="text-sm text-gray-600 truncate">
                      {category.description || '-'}
                    </p>
                  </div>
                  
                  {/* Parent Category */}
                  <div className="col-span-1">
                    <span className="text-xs text-gray-500">
                      {category.parentCategory ? category.parentCategory.name : '-'}
                    </span>
                  </div>
                  
                  {/* Sort Order */}
                  <div className="col-span-1">
                    <span className="text-xs text-gray-500">{category.sortOrder}</span>
                  </div>
                  
                  {/* Status */}
                  <div className="col-span-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      category.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  {/* Actions */}
                  <div className="col-span-1">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="text-primary-600 hover:text-primary-800 p-1"
                        title="Edit category"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        className="text-danger-600 hover:text-danger-800 p-1"
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <PaginationControls
            page={page}
            totalPages={Math.max(1, pagination?.pages || 1)}
            onPageChange={setPage}
            totalItems={pagination?.total}
            limit={pagination?.limit || 50}
            className="rounded-b-lg"
          />
        </div>
      )}

      {/* Category Modal */}
      <CategoryModal
        category={selectedCategory}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        isSubmitting={creating || updating}
        categories={modalCategoryList}
        categoryType={categoryType}
      />
      
      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        itemName={confirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType={confirmation.message?.split(' ')[1] || ''}
      />
    </div>
  );
};

export default Categories;
