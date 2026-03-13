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
  useCancelTransformationMutation,
} from '../store/services/productTransformationsApi';
import { useGetVariantsByBaseProductQuery } from '../store/services/productVariantsApi';
import { useGetProductsQuery } from '../store/services/productsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner, LoadingButton } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ValidatedInput, { ValidatedSelect } from '../components/ValidatedInput';

const ProductTransformations = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBaseProduct, setSelectedBaseProduct] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch transformations
  const { data: transformationsData, isLoading: transformationsLoading, refetch } = useGetTransformationsQuery({
    baseProduct: selectedBaseProduct || undefined,
    status: statusFilter || undefined,
    search: searchTerm || undefined
  });
  const transformations = React.useMemo(() => {
    return transformationsData?.data?.transformations || transformationsData?.transformations || [];
  }, [transformationsData]);

  // Fetch products for base product selector
  const { data: productsData } = useGetProductsQuery({});
  const products = React.useMemo(() => {
    return productsData?.data?.products || productsData?.products || [];
  }, [productsData]);


  const [cancelTransformation, { isLoading: isCancelling }] = useCancelTransformationMutation();

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleCancelTransformation = async (id) => {
    try {
      await cancelTransformation(id).unwrap();
      showSuccessToast('Transformation cancelled');
      refetch();
    } catch (error) {
      handleApiError(error, 'ProductTransformations');
    }
  };

  const getTransformationNumber = (t) => t.transformationNumber ?? t.transformation_number ?? '';
  const getBaseProductName = (t) => t.baseProduct?.name ?? t.base_product_name ?? '';
  const getTargetVariantName = (t) => t.targetVariant?.displayName ?? t.target_variant_name ?? '';
  const getBaseStockBefore = (t) => t.baseProductStockBefore ?? t.base_product_stock_before ?? 0;
  const getBaseStockAfter = (t) => t.baseProductStockAfter ?? t.base_product_stock_after ?? 0;
  const getVariantStockBefore = (t) => t.variantStockBefore ?? t.variant_stock_before ?? 0;
  const getVariantStockAfter = (t) => t.variantStockAfter ?? t.variant_stock_after ?? 0;
  const getUnitCost = (t) => t.unitTransformationCost ?? t.unit_transformation_cost ?? 0;
  const getTotalCost = (t) => t.totalTransformationCost ?? t.total_transformation_cost ?? 0;
  const getTransformationDate = (t) => t.transformationDate ?? t.created_at ?? t.updated_at;
  const getStatus = (t) => t.status ?? 'completed';
  const getPerformedBy = (t) => {
    const pb = t.performedBy;
    if (!pb) return '';
    return [pb.firstName, pb.lastName].filter(Boolean).join(' ').trim() || '-';
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  return (
    <div className="p-3 sm:p-5 xl:p-6 2xl:p-8">
      <div className="mb-4 xl:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div>
            <h1 className="text-xl sm:text-2xl xl:text-3xl font-bold text-gray-900">Product Transformations</h1>
            <p className="mt-0.5 xl:mt-1 text-xs sm:text-sm xl:text-base text-gray-600">Convert base products to variants and track transformations</p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-1.5 xl:gap-2 w-full sm:w-auto text-sm min-h-[2rem] xl:min-h-9"
          >
            <Plus className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
            New Transformation
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 xl:p-4 mb-4 xl:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 xl:gap-3 2xl:gap-4">
          <div className="relative">
            <Search className="absolute left-2 xl:left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 xl:h-4 xl:w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search transformations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 xl:pl-10 w-full text-sm min-h-[2rem] xl:min-h-9"
            />
          </div>
          <ValidatedSelect
            value={selectedBaseProduct}
            onChange={(e) => setSelectedBaseProduct(e.target.value)}
            options={[
              { value: '', label: 'All Products' },
              ...products.map(p => ({ value: p._id ?? p.id, label: p.name ?? p.productName }))
            ]}
            className="w-full"
          />
          <ValidatedSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            className="w-full"
          />
          <Button
            onClick={() => refetch()}
            variant="secondary"
            size="default"
            className="flex items-center justify-center gap-1.5 xl:gap-2 w-full sm:w-auto text-sm min-h-[2rem] xl:min-h-9"
          >
            <RefreshCw className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
            Refresh
          </Button>
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
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="default"
            size="default"
          >
            New Transformation
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1.5 xl:px-4 xl:py-2 2xl:px-6 2xl:py-3 text-left text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-500 uppercase tracking-wider">Transformation #</th>
                  <th className="px-2 py-1.5 xl:px-4 xl:py-2 2xl:px-6 2xl:py-3 text-left text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-500 uppercase tracking-wider">Base Product</th>
                  <th className="px-2 py-1.5 xl:px-4 xl:py-2 2xl:px-6 2xl:py-3 text-left text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-500 uppercase tracking-wider">Target Variant</th>
                  <th className="px-2 py-1.5 xl:px-4 xl:py-2 2xl:px-6 2xl:py-3 text-left text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-2 py-1.5 xl:px-4 xl:py-2 2xl:px-6 2xl:py-3 text-left text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                  <th className="px-2 py-1.5 xl:px-4 xl:py-2 2xl:px-6 2xl:py-3 text-left text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                  <th className="px-2 py-1.5 xl:px-4 xl:py-2 2xl:px-6 2xl:py-3 text-left text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-2 py-1.5 xl:px-4 xl:py-2 2xl:px-6 2xl:py-3 text-left text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-500 uppercase tracking-wider">Performed By</th>
                  <th className="px-2 py-1.5 xl:px-4 xl:py-2 2xl:px-6 2xl:py-3 text-left text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-2 py-1.5 xl:px-4 xl:py-2 2xl:px-6 2xl:py-3 text-right text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transformations.map((transformation) => {
                  const tStatus = getStatus(transformation);
                  const canCancel = tStatus === 'pending' || tStatus === 'in_progress';
                  return (
                  <tr key={transformation._id ?? transformation.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 whitespace-nowrap">
                      <div className="text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-900">
                        {getTransformationNumber(transformation)}
                      </div>
                    </td>
                    <td className="px-2 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 whitespace-nowrap">
                      <div className="text-[10px] xl:text-xs 2xl:text-sm text-gray-900">
                        {getBaseProductName(transformation)}
                      </div>
                      <div className="text-[10px] xl:text-xs text-gray-500">
                        Stock: {getBaseStockBefore(transformation)} → {getBaseStockAfter(transformation)}
                      </div>
                    </td>
                    <td className="px-2 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 whitespace-nowrap">
                      <div className="text-[10px] xl:text-xs 2xl:text-sm text-gray-900">
                        {getTargetVariantName(transformation)}
                      </div>
                      <div className="text-[10px] xl:text-xs text-gray-500">
                        Stock: {getVariantStockBefore(transformation)} → {getVariantStockAfter(transformation)}
                      </div>
                    </td>
                    <td className="px-2 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 whitespace-nowrap text-[10px] xl:text-xs 2xl:text-sm text-gray-900">
                      {transformation.quantity}
                    </td>
                    <td className="px-2 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 whitespace-nowrap text-[10px] xl:text-xs 2xl:text-sm text-gray-900">
                      {Number(getUnitCost(transformation)).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 whitespace-nowrap text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-900">
                      {Number(getTotalCost(transformation)).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 whitespace-nowrap text-[10px] xl:text-xs 2xl:text-sm text-gray-500">
                      {new Date(getTransformationDate(transformation)).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 whitespace-nowrap text-[10px] xl:text-xs 2xl:text-sm text-gray-500">
                      {getPerformedBy(transformation)}
                    </td>
                    <td className="px-2 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 whitespace-nowrap">
                      <span className={`px-1.5 xl:px-2 py-0.5 xl:py-1 text-[10px] xl:text-xs font-semibold rounded-full ${
                        tStatus === 'completed' ? 'bg-green-100 text-green-800' :
                        tStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        tStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tStatus}
                      </span>
                    </td>
                    <td className="px-2 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 whitespace-nowrap text-right text-[10px] xl:text-xs 2xl:text-sm font-medium">
                      {canCancel && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancelTransformation(transformation._id ?? transformation.id)}
                          disabled={isCancelling}
                          className="text-[10px] xl:text-xs min-h-[1.75rem] xl:min-h-8"
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                );})}
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
    setAvailableVariants(Array.isArray(variants) ? variants : []);
  }, [variantsData]);

  React.useEffect(() => {
    if (formData.baseProduct) {
      const product = products.find(p => (p._id ?? p.id) === formData.baseProduct);
      setSelectedBaseProductData(product);
      setFormData(prev => ({ ...prev, targetVariant: '' }));
    }
  }, [formData.baseProduct, products]);

  React.useEffect(() => {
    if (formData.targetVariant) {
      const variant = availableVariants.find(v => (v._id ?? v.id) === formData.targetVariant);
      setSelectedVariantData(variant);
      if (variant) {
        const cost = variant.transformationCost ?? variant.transformation_cost ?? 0;
        setFormData(prev => ({ ...prev, unitTransformationCost: cost }));
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

  const availableStock = selectedBaseProductData?.inventory?.currentStock
    ?? selectedBaseProductData?.stockQuantity
    ?? selectedBaseProductData?.stock_quantity
    ?? 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 xl:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 xl:px-6 xl:py-4 flex items-center justify-between">
          <h2 className="text-base xl:text-xl font-bold text-gray-900">Create Product Transformation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="h-5 w-5 xl:h-6 xl:w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 xl:p-6 space-y-3 xl:space-y-4">
          <ValidatedSelect
            label="Base Product"
            value={formData.baseProduct}
            onChange={(e) => setFormData({ ...formData, baseProduct: e.target.value })}
            options={[
              { value: '', label: 'Select Base Product' },
              ...products.map(p => {
                const stock = p.inventory?.currentStock ?? p.stockQuantity ?? p.stock_quantity ?? 0;
                return { value: p._id ?? p.id, label: `${p.name ?? p.productName} (Stock: ${stock})` };
              })
            ]}
            required
          />

          {formData.baseProduct && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 xl:p-4">
                <div className="flex items-center gap-1.5 xl:gap-2 mb-1.5 xl:mb-2">
                  <Package className="h-4 w-4 xl:h-5 xl:w-5 text-blue-600" />
                  <span className="text-sm xl:text-base font-medium text-blue-900">Available Stock</span>
                </div>
                <p className="text-xs xl:text-sm text-blue-700">
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
                    .filter(v => (v.status ?? (v.is_active === false ? 'inactive' : 'active')) === 'active')
                    .map(v => {
                      const stock = v.inventory?.currentStock ?? v.inventory_data?.current_stock ?? v.inventory_data?.currentStock ?? 0;
                      const label = `${v.displayName ?? v.display_name ?? v.variant_name ?? ''} (Current Stock: ${stock})`;
                      return { value: v._id ?? v.id, label };
                    })
                ]}
                required
              />

              {availableVariants.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 xl:p-4">
                  <div className="flex items-center gap-1.5 xl:gap-2">
                    <AlertCircle className="h-4 w-4 xl:h-5 xl:w-5 text-yellow-600" />
                    <span className="text-xs xl:text-sm text-yellow-800">
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 xl:p-4">
              <div className="flex items-center gap-1.5 xl:gap-2">
                <AlertCircle className="h-4 w-4 xl:h-5 xl:w-5 text-red-600" />
                <span className="text-xs xl:text-sm text-red-800">
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 xl:p-4">
              <div className="flex items-center justify-between mb-1.5 xl:mb-2">
                <span className="text-xs xl:text-sm text-gray-600">Variant default cost:</span>
                <span className="text-xs xl:text-sm font-medium text-gray-900">
                  {Number(selectedVariantData.transformationCost ?? selectedVariantData.transformation_cost ?? 0).toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, unitTransformationCost: selectedVariantData.transformationCost ?? selectedVariantData.transformation_cost ?? 0 })}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Use default cost
              </button>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 xl:p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs xl:text-sm font-medium text-gray-700">Total Transformation Cost:</span>
              <span className="text-base xl:text-lg font-bold text-gray-900">
                {totalCost.toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs xl:text-sm font-medium text-gray-700 mb-0.5 xl:mb-1">
              Notes (optional)
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full"
              placeholder="Add any additional notes about this transformation..."
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 xl:gap-3 pt-3 xl:pt-4 border-t">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              size="default"
              className="w-full sm:w-auto text-sm min-h-[2rem] xl:min-h-9"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              isLoading={isSubmitting}
              disabled={formData.quantity > availableStock || !formData.baseProduct || !formData.targetVariant}
              variant="default"
              size="default"
              className="w-full sm:w-auto text-sm min-h-[2rem] xl:min-h-9"
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

