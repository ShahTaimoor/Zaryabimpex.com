import React, { useState } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Tag,
  X,
  AlertCircle
} from 'lucide-react';
import {
  useGetVariantsQuery,
  useCreateVariantMutation,
  useUpdateVariantMutation,
  useDeleteVariantMutation,
} from '../store/services/productVariantsApi';
import { useGetProductsQuery } from '../store/services/productsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingButton } from '../components/LoadingSpinner';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import ValidatedInput, { ValidatedSelect } from '../components/ValidatedInput';
import { useFormValidation } from '../hooks/useFormValidation';

const ProductVariants = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBaseProduct, setSelectedBaseProduct] = useState('');
  const [variantTypeFilter, setVariantTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);

  // Fetch variants
  const { data: variantsData, isLoading: variantsLoading, refetch } = useGetVariantsQuery({
    baseProduct: selectedBaseProduct || undefined,
    variantType: variantTypeFilter || undefined,
    search: searchTerm || undefined
  });

  // Fetch products for base product selector
  const { data: productsData } = useGetProductsQuery({});

  const variants = variantsData?.variants || variantsData?.data?.variants || [];
  const products = productsData?.products || productsData?.data?.products || [];

  // Delete mutation
  const [deleteVariant, { isLoading: isDeleting }] = useDeleteVariantMutation();

  const handleDelete = async (id) => {
    try {
      await deleteVariant(id).unwrap();
      showSuccessToast('Variant deleted successfully');
      refetch();
    } catch (error) {
      handleApiError(error, 'ProductVariants');
    }
  };

  const { isDeleteDialogOpen, itemToDelete, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteConfirmation(
    handleDelete
  );

  const handleEdit = (variant) => {
    setEditingVariant(variant);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingVariant(null);
  };

  const variantTypes = [
    { value: '', label: 'All Types' },
    { value: 'color', label: 'Color' },
    { value: 'warranty', label: 'Warranty' },
    { value: 'size', label: 'Size' },
    { value: 'finish', label: 'Finish' },
    { value: 'custom', label: 'Custom' }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Product Variants</h1>
            <p className="mt-1 text-sm sm:text-base text-gray-600">Manage product variants and transformations</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add Variant
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search variants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <ValidatedSelect
            value={selectedBaseProduct}
            onChange={(e) => setSelectedBaseProduct(e.target.value)}
            options={[
              { value: '', label: 'All Products' },
              ...products.map(p => ({ value: p._id, label: p.name }))
            ]}
            className="w-full"
          />
          <ValidatedSelect
            value={variantTypeFilter}
            onChange={(e) => setVariantTypeFilter(e.target.value)}
            options={variantTypes}
            className="w-full"
          />
        </div>
      </div>

      {/* Variants Table */}
      {variantsLoading ? (
        <LoadingSpinner />
      ) : variants.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No variants found</h3>
          <p className="text-sm sm:text-base text-gray-500 mb-4">Get started by creating a new product variant.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-md"
          >
            Add Variant
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base Product</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variant Name</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retail Price</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transformation Cost</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {variants.map((variant) => (
                  <tr key={variant._id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {variant.baseProduct?.name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-gray-900">{variant.displayName}</div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {variant.variantType}
                      </span>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                      {variant.variantValue}
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {variant.inventory?.currentStock || 0}
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      ${variant.pricing?.retail?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      ${variant.transformationCost?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        variant.status === 'active' ? 'bg-green-100 text-green-800' :
                        variant.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {variant.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(variant)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(variant._id, variant.displayName)}
                          className="text-red-600 hover:text-red-900 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Variant Modal */}
      {isModalOpen && (
        <VariantModal
          variant={editingVariant}
          products={products}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={() => {
            refetch();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
        itemName={itemToDelete?.name || ''}
        itemType="variant"
      />
    </div>
  );
};

// Variant Modal Component
const VariantModal = ({ variant, products, isOpen, onClose, onSuccess }) => {
  const [createVariant, { isLoading: isCreating }] = useCreateVariantMutation();
  const [updateVariant, { isLoading: isUpdating }] = useUpdateVariantMutation();
  const [formData, setFormData] = useState({
    baseProduct: '',
    variantName: '',
    variantType: 'color',
    variantValue: '',
    displayName: '',
    description: '',
    pricing: {
      cost: 0,
      retail: 0,
      wholesale: 0,
      distributor: 0
    },
    transformationCost: 0,
    sku: '',
    status: 'active'
  });

  React.useEffect(() => {
    if (variant) {
      setFormData({
        baseProduct: variant.baseProduct?._id || variant.baseProduct || '',
        variantName: variant.variantName || '',
        variantType: variant.variantType || 'color',
        variantValue: variant.variantValue || '',
        displayName: variant.displayName || '',
        description: variant.description || '',
        pricing: variant.pricing || { cost: 0, retail: 0, wholesale: 0, distributor: 0 },
        transformationCost: variant.transformationCost || 0,
        sku: variant.sku || '',
        status: variant.status || 'active'
      });
    } else {
      setFormData({
        baseProduct: '',
        variantName: '',
        variantType: 'color',
        variantValue: '',
        displayName: '',
        description: '',
        pricing: { cost: 0, retail: 0, wholesale: 0, distributor: 0 },
        transformationCost: 0,
        sku: '',
        status: 'active'
      });
    }
  }, [variant, isOpen]);

  // Auto-generate variant name from variantValue when creating new variant (backup for initial load)
  React.useEffect(() => {
    if (formData.variantValue && !variant) {
      const trimmedValue = formData.variantValue.trim();
      const trimmedName = formData.variantName?.trim() || '';
      if (trimmedValue && (!trimmedName || trimmedName === '')) {
        setFormData(prev => ({
          ...prev,
          variantName: trimmedValue
        }));
      }
    }
  }, [formData.variantValue, variant]);

  React.useEffect(() => {
    if (formData.baseProduct && formData.variantValue) {
      const baseProduct = products.find(p => p._id === formData.baseProduct);
      if (baseProduct && !variant) {
        setFormData(prev => ({
          ...prev,
          displayName: `${baseProduct.name} - ${formData.variantValue}`
        }));
      }
    }
  }, [formData.baseProduct, formData.variantValue, products, variant]);

  // Auto-calculate pricing based on base product
  React.useEffect(() => {
    if (formData.baseProduct && !variant) {
      const baseProduct = products.find(p => p._id === formData.baseProduct);
      if (baseProduct) {
        setFormData(prev => ({
          ...prev,
          pricing: {
            cost: baseProduct.pricing.cost + prev.transformationCost,
            retail: baseProduct.pricing.retail + prev.transformationCost,
            wholesale: baseProduct.pricing.wholesale + prev.transformationCost,
            distributor: baseProduct.pricing.distributor ? baseProduct.pricing.distributor + prev.transformationCost : 0
          }
        }));
      }
    }
  }, [formData.baseProduct, formData.transformationCost, products, variant]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Ensure variantName is set (fallback to variantValue if empty)
      const trimmedVariantName = (formData.variantName || '').trim();
      const trimmedVariantValue = (formData.variantValue || '').trim();
      const finalVariantName = (trimmedVariantName && trimmedVariantName.length > 0) 
        ? trimmedVariantName 
        : (trimmedVariantValue && trimmedVariantValue.length > 0 ? trimmedVariantValue : '');
      
      if (!finalVariantName || finalVariantName.length === 0) {
        showErrorToast('Variant name is required. Please fill in Variant Value or Variant Name.');
        return;
      }

      // Create submitData with explicit variantName to ensure it's not empty
      const submitData = {
        baseProduct: formData.baseProduct,
        variantType: formData.variantType,
        variantValue: formData.variantValue,
        variantName: finalVariantName, // Explicitly set to ensure it's not empty
        displayName: formData.displayName,
        description: formData.description,
        pricing: formData.pricing,
        transformationCost: formData.transformationCost,
        sku: formData.sku,
        status: formData.status
      };

      if (variant) {
        await updateVariant({ id: variant._id, ...submitData }).unwrap();
        showSuccessToast('Variant updated successfully');
      } else {
        await createVariant(submitData).unwrap();
        showSuccessToast('Variant created successfully');
      }
      onClose();
      onSuccess();
    } catch (error) {
      handleApiError(error, 'ProductVariants');
    }
  };

  const isSubmitting = isCreating || isUpdating;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            {variant ? 'Edit Variant' : 'Create Variant'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <ValidatedSelect
            label="Base Product"
            value={formData.baseProduct}
            onChange={(e) => setFormData({ ...formData, baseProduct: e.target.value })}
            options={[
              { value: '', label: 'Select Base Product' },
              ...products.map(p => ({ value: p._id, label: p.name }))
            ]}
            required
            disabled={!!variant}
          />

          <ValidatedSelect
            label="Variant Type"
            value={formData.variantType}
            onChange={(e) => setFormData({ ...formData, variantType: e.target.value })}
            options={[
              { value: 'color', label: 'Color' },
              { value: 'warranty', label: 'Warranty' },
              { value: 'size', label: 'Size' },
              { value: 'finish', label: 'Finish' },
              { value: 'custom', label: 'Custom' }
            ]}
            required
            disabled={!!variant}
          />

          <ValidatedInput
            label="Variant Value"
            type="text"
            value={formData.variantValue}
            onChange={(e) => {
              const newValue = e.target.value;
              setFormData(prev => {
                // Auto-update variantName if it's empty, whitespace, or matches old variantValue
                const prevVariantName = prev.variantName?.trim() || '';
                const prevVariantValue = prev.variantValue?.trim() || '';
                const shouldUpdateName = !prevVariantName || prevVariantName === prevVariantValue;
                const newVariantName = shouldUpdateName ? newValue : prev.variantName;
                return {
                  ...prev,
                  variantValue: newValue,
                  variantName: newVariantName
                };
              });
            }}
            placeholder="e.g., Red, With Warranty, Large"
            required
            disabled={!!variant}
          />

          <ValidatedInput
            label="Variant Name"
            type="text"
            value={formData.variantName}
            onChange={(e) => setFormData({ ...formData, variantName: e.target.value })}
            placeholder="e.g., Red, With Warranty, Large"
            required
          />

          <ValidatedInput
            label="Display Name"
            type="text"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="e.g., Spoiler - Red"
            required
          />

          <ValidatedInput
            label="Transformation Cost (per unit)"
            type="number"
            value={formData.transformationCost}
            onChange={(e) => setFormData({ ...formData, transformationCost: parseFloat(e.target.value) || 0 })}
            min="0"
            step="0.01"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ValidatedInput
              label="Retail Price"
              type="number"
              value={formData.pricing.retail}
              onChange={(e) => setFormData({
                ...formData,
                pricing: { ...formData.pricing, retail: parseFloat(e.target.value) || 0 }
              })}
              min="0"
              step="0.01"
              required
            />
            <ValidatedInput
              label="Wholesale Price"
              type="number"
              value={formData.pricing.wholesale}
              onChange={(e) => setFormData({
                ...formData,
                pricing: { ...formData.pricing, wholesale: parseFloat(e.target.value) || 0 }
              })}
              min="0"
              step="0.01"
              required
            />
          </div>

          <ValidatedInput
            label="SKU (optional)"
            type="text"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            placeholder="Auto-generated if left empty"
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-md w-full sm:w-auto"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              isLoading={isSubmitting}
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              {variant ? 'Update' : 'Create'}
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductVariants;

