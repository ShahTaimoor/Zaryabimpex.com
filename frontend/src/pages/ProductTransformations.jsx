import React, { useState } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Package,
  ArrowRight,
  Calendar,
  User,
  TrendingUp,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import {
  useGetTransformationsQuery,
  useCreateTransformationMutation,
} from '../store/services/productTransformationsApi';
import { useGetVariantsByBaseProductQuery } from '../store/services/productVariantsApi';
import { useGetProductsQuery } from '../store/services/productsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingButton } from '../components/LoadingSpinner';
import ValidatedInput, { ValidatedSelect } from '../components/ValidatedInput';

const ProductTransformations = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBaseProduct, setSelectedBaseProduct] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch transformations
  const { data: transformationsData, isLoading: transformationsLoading, refetch } = useGetTransformationsQuery({
    baseProduct: selectedBaseProduct || undefined,
    status: statusFilter || undefined
  });
  const transformations = React.useMemo(() => {
    return transformationsData?.data?.transformations || transformationsData?.transformations || [];
  }, [transformationsData]);

  // Fetch products for base product selector
  const { data: productsData } = useGetProductsQuery({});
  const products = React.useMemo(() => {
    return productsData?.data?.products || productsData?.products || [];
  }, [productsData]);


  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Product Transformations</h1>
            <p className="mt-1 text-sm sm:text-base text-gray-600">Convert base products to variants and track transformations</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            New Transformation
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transformations..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            className="w-full"
          />
          <button
            onClick={() => refetch()}
            className="btn btn-secondary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Transformations Table */}
      {transformationsLoading ? (
        <LoadingSpinner />
      ) : transformations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No transformations found</h3>
          <p className="text-sm sm:text-base text-gray-500 mb-4">Get started by creating a new product transformation.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-md"
          >
            New Transformation
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transformation #</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base Product</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Variant</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performed By</th>
                  <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transformations.map((transformation) => (
                  <tr key={transformation._id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {transformation.transformationNumber}
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-gray-900">
                        {transformation.baseProduct?.name || transformation.baseProductName}
                      </div>
                      <div className="text-xs text-gray-500">
                        Stock: {transformation.baseProductStockBefore} → {transformation.baseProductStockAfter}
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-gray-900">
                        {transformation.targetVariant?.displayName || transformation.targetVariantName}
                      </div>
                      <div className="text-xs text-gray-500">
                        Stock: {transformation.variantStockBefore} → {transformation.variantStockAfter}
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {transformation.quantity}
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      ${transformation.unitTransformationCost?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                      ${transformation.totalTransformationCost?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                      {new Date(transformation.transformationDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                      {transformation.performedBy?.firstName} {transformation.performedBy?.lastName}
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        transformation.status === 'completed' ? 'bg-green-100 text-green-800' :
                        transformation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        transformation.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {transformation.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transformation Modal */}
      {isModalOpen && (
        <TransformationModal
          products={products}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
};

// Transformation Modal Component
const TransformationModal = ({ products, isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    baseProduct: '',
    targetVariant: '',
    quantity: 1,
    unitTransformationCost: 0,
    notes: ''
  });
  const [availableVariants, setAvailableVariants] = useState([]);
  const [selectedBaseProductData, setSelectedBaseProductData] = useState(null);
  const [selectedVariantData, setSelectedVariantData] = useState(null);

  // Fetch variants when base product is selected
  // Fetch variants when base product is selected
  const { data: variantsData } = useGetVariantsByBaseProductQuery(
    formData.baseProduct,
    { skip: !formData.baseProduct }
  );

  React.useEffect(() => {
    const variants = variantsData?.data?.variants || variantsData?.variants || [];
    if (variants.length > 0) {
      setAvailableVariants(variants);
    }
  }, [variantsData]);

  React.useEffect(() => {
    if (formData.baseProduct) {
      const product = products.find(p => p._id === formData.baseProduct);
      setSelectedBaseProductData(product);
      setFormData(prev => ({ ...prev, targetVariant: '' }));
    }
  }, [formData.baseProduct, products]);

  React.useEffect(() => {
    if (formData.targetVariant) {
      const variant = availableVariants.find(v => v._id === formData.targetVariant);
      setSelectedVariantData(variant);
      if (variant) {
        setFormData(prev => ({
          ...prev,
          unitTransformationCost: variant.transformationCost || 0
        }));
      }
    }
  }, [formData.targetVariant, availableVariants]);

  const [createTransformation, { isLoading: isSubmitting }] = useCreateTransformationMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createTransformation(formData).unwrap();
      showSuccessToast('Transformation completed successfully');
      onClose();
      onSuccess();
      setFormData({
        baseProduct: '',
        targetVariant: '',
        quantity: 1,
        unitTransformationCost: 0,
        notes: ''
      });
    } catch (error) {
      handleApiError(error, 'ProductTransformations');
    }
  };

  // Calculate total cost
  const totalCost = formData.quantity * formData.unitTransformationCost;

  // Get available stock
  const availableStock = selectedBaseProductData?.inventory?.currentStock || 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Create Product Transformation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <ValidatedSelect
            label="Base Product"
            value={formData.baseProduct}
            onChange={(e) => setFormData({ ...formData, baseProduct: e.target.value })}
            options={[
              { value: '', label: 'Select Base Product' },
              ...products.map(p => ({ 
                value: p._id, 
                label: `${p.name} (Stock: ${p.inventory?.currentStock || 0})` 
              }))
            ]}
            required
          />

          {formData.baseProduct && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Available Stock</span>
                </div>
                <p className="text-sm text-blue-700">
                  {availableStock} units available for transformation
                </p>
              </div>

              <ValidatedSelect
                label="Target Variant"
                value={formData.targetVariant}
                onChange={(e) => setFormData({ ...formData, targetVariant: e.target.value })}
                options={[
                  { value: '', label: 'Select Variant' },
                  ...availableVariants
                    .filter(v => v.status === 'active')
                    .map(v => ({ 
                      value: v._id, 
                      label: `${v.displayName} (Current Stock: ${v.inventory?.currentStock || 0})` 
                    }))
                ]}
                required
              />

              {availableVariants.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm text-yellow-800">
                      No variants found for this product. Please create a variant first.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          <ValidatedInput
            label="Quantity"
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
            min="1"
            max={availableStock}
            required
          />

          {formData.quantity > availableStock && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm text-red-800">
                  Insufficient stock. Available: {availableStock}, Requested: {formData.quantity}
                </span>
              </div>
            </div>
          )}

          <ValidatedInput
            label="Unit Transformation Cost"
            type="number"
            value={formData.unitTransformationCost}
            onChange={(e) => setFormData({ ...formData, unitTransformationCost: parseFloat(e.target.value) || 0 })}
            min="0"
            step="0.01"
            required
          />

          {selectedVariantData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Variant default cost:</span>
                <span className="text-sm font-medium text-gray-900">
                  ${selectedVariantData.transformationCost?.toFixed(2) || '0.00'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, unitTransformationCost: selectedVariantData.transformationCost || 0 })}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Use default cost
              </button>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Total Transformation Cost:</span>
              <span className="text-lg font-bold text-gray-900">
                ${totalCost.toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="input w-full"
              placeholder="Add any additional notes about this transformation..."
            />
          </div>

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
              disabled={formData.quantity > availableStock || !formData.baseProduct || !formData.targetVariant}
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              Execute Transformation
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductTransformations;

