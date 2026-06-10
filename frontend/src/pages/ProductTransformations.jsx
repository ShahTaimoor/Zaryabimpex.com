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
  CheckCircle,
  Printer
} from 'lucide-react';
import {
  useGetTransformationsQuery,
  useCreateTransformationMutation,
  useCancelTransformationMutation,
} from '../store/services/productTransformationsApi';
import { useGetVariantQuery, useLazyGetVariantQuery } from '../store/services/productVariantsApi';
import { useGetProductQuery } from '../store/services/productsApi';
import { ProductSearchableSelect } from '../components/ProductSearchableSelect';
import { VariantSearchableSelect } from '../components/VariantSearchableSelect';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingButton, LoadingTable } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ValidatedInput, { ValidatedSelect } from '../components/ValidatedInput';
import { PageLayout } from '../components/layout/PageLayout';
import { PageHeader } from '../components/layout/PageHeader';
import BarcodeLabelPrinter from '../components/BarcodeLabelPrinter';

/** Rows for BarcodeLabelPrinter: base product + target variant (labels for both). */
function buildLabelPrinterRows(baseProduct, variant, options = {}) {
  const overrideBc =
    options.optionalVariantBarcode != null
      ? String(options.optionalVariantBarcode).trim()
      : '';
  const rows = [];
  if (baseProduct) rows.push(baseProduct);
  if (variant) {
    const rawP = variant.pricing;
    const pricing =
      rawP && typeof rawP === 'object' && !Array.isArray(rawP)
        ? rawP
        : {
            retail: Number(variant.retailPrice ?? variant.retail_price ?? 0),
            wholesale: Number(variant.wholesalePrice ?? variant.wholesale_price ?? 0),
            cost: Number(variant.cost ?? variant.costPrice ?? variant.cost_price ?? 0),
          };
    rows.push({
      _id: variant._id ?? variant.id,
      id: variant._id ?? variant.id,
      name:
        variant.displayName ??
        variant.display_name ??
        variant.variantName ??
        variant.variant_name ??
        'Variant',
      barcode: overrideBc || (variant.barcode ?? ''),
      sku: variant.sku ?? '',
      pricing,
    });
  }
  return rows;
}

function getTransformationBaseProductId(t) {
  return (
    t.base_product_id ??
    t.baseProductId ??
    t.baseProduct?.id ??
    t.base_product?.id ??
    (typeof t.baseProduct === 'string' ? t.baseProduct : null)
  );
}

function getTransformationTargetVariantId(t) {
  return (
    t.target_variant_id ??
    t.targetVariantId ??
    t.targetVariant?.id ??
    t.target_variant?.id ??
    (typeof t.targetVariant === 'string' ? t.targetVariant : null)
  );
}

/**
 * Unit transformation cost for UI defaults: uses DB `transformation_cost` when &gt; 0;
 * otherwise estimates from variant retail minus base product retail (how variants are priced in Product Variants).
 */
function getEffectiveVariantTransformationCost(variant, baseProduct) {
  if (!variant) return 0;
  const raw =
    variant.transformationCost ?? variant.transformation_cost;
  const stored = raw == null || raw === '' ? NaN : Number(raw);
  if (Number.isFinite(stored) && stored > 0) return stored;

  const vp = variant.pricing || {};
  const bp = baseProduct?.pricing || {};
  const vRetail = Number(vp.retail ?? vp.wholesale ?? 0);
  const bRetail = Number(bp.retail ?? 0);
  if (vRetail > 0 && bRetail >= 0 && vRetail > bRetail) {
    return Math.round((vRetail - bRetail) * 100) / 100;
  }
  return Number.isFinite(stored) ? stored : 0;
}

const ProductTransformations = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBaseProduct, setSelectedBaseProduct] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [barcodePrintQueue, setBarcodePrintQueue] = useState(null);

  // Fetch transformations
  const { data: transformationsData, isLoading: transformationsLoading, refetch } = useGetTransformationsQuery({
    baseProduct: selectedBaseProduct || undefined,
    status: statusFilter || undefined,
    search: searchTerm || undefined
  });
  const transformations = React.useMemo(() => {
    return transformationsData?.data?.transformations || transformationsData?.transformations || [];
  }, [transformationsData]);

  const [cancelTransformation, { isLoading: isCancelling }] = useCancelTransformationMutation();
  const [fetchVariantById] = useLazyGetVariantQuery();
  const [printingLabelsRowId, setPrintingLabelsRowId] = useState(null);

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

  const handlePrintLabelsFromRow = async (transformation) => {
    const rowId = transformation._id ?? transformation.id;
    const baseId = getTransformationBaseProductId(transformation);
    const variantId = getTransformationTargetVariantId(transformation);
    if (!variantId) {
      showErrorToast('This row has no variant id — cannot load labels.');
      return;
    }
    setPrintingLabelsRowId(rowId);
    try {
      const res = await fetchVariantById(variantId).unwrap();
      const variant = res?.variant ?? res?.data?.variant ?? res;
      const base = baseId
        ? products.find((p) => String(p._id ?? p.id) === String(baseId))
        : null;
      const rows = buildLabelPrinterRows(base, variant);
      if (rows.length === 0) {
        showErrorToast('No label data available for this transformation.');
        return;
      }
      setBarcodePrintQueue(rows);
    } catch (error) {
      handleApiError(error, 'ProductTransformations');
    } finally {
      setPrintingLabelsRowId(null);
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
    <PageLayout>
      <PageHeader
        title="Product Transformations"
        subtitle="Convert base products to variants and track transformations"
        icon={Package}
        actions={
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-1.5 xl:gap-2 w-full sm:w-auto text-sm min-h-[2rem] xl:min-h-9"
          >
            <Plus className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
            New Transformation
          </Button>
        }
      />

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
          <ProductSearchableSelect
            placeholder="All products — search to filter by base"
            value={selectedBaseProduct}
            onValueChange={setSelectedBaseProduct}
            allowClear
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
        <LoadingTable rows={6} columns={5} />
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
          <div className="table-scroll">
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
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {tStatus !== 'cancelled' && getTransformationTargetVariantId(transformation) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title="Print barcode labels for base product and target variant"
                            onClick={() => handlePrintLabelsFromRow(transformation)}
                            disabled={printingLabelsRowId === (transformation._id ?? transformation.id)}
                            className="text-[10px] xl:text-xs min-h-[1.75rem] xl:min-h-8"
                          >
                            <Printer className="h-3 w-3 xl:h-3.5 xl:w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Labels</span>
                          </Button>
                        )}
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
                      </div>
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
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={() => {
            refetch();
          }}
          onOpenBarcodePrint={(items) => setBarcodePrintQueue(items)}
        />
      )}

      {barcodePrintQueue?.length > 0 && (
        <BarcodeLabelPrinter
          products={barcodePrintQueue}
          onClose={() => setBarcodePrintQueue(null)}
          modalTitle="Print product / variant barcode labels"
        />
      )}
    </PageLayout>
  );
};

// Transformation Modal Component
const TransformationModal = ({ isOpen, onClose, onSuccess, onOpenBarcodePrint }) => {
  const [formData, setFormData] = useState({
    baseProduct: '',
    targetVariant: '',
    quantity: 1,
    unitTransformationCost: 0,
    notes: '',
    /** Not sent to API — used only for printed labels (variant row). */
    optionalBarcode: '',
  });
  const prevBaseProductIdRef = React.useRef('');

  const { data: baseProductResponse } = useGetProductQuery(formData.baseProduct, {
    skip: !formData.baseProduct,
  });
  const selectedBaseProductData = React.useMemo(() => {
    const data = baseProductResponse;
    return data?.data?.product ?? data?.product ?? data?.data ?? data ?? null;
  }, [baseProductResponse]);

  const { data: variantResponse } = useGetVariantQuery(formData.targetVariant, {
    skip: !formData.targetVariant,
  });
  const selectedVariantData = React.useMemo(() => {
    const data = variantResponse;
    return data?.data?.variant ?? data?.variant ?? data?.data ?? data ?? null;
  }, [variantResponse]);

  React.useEffect(() => {
    if (!formData.baseProduct) {
      prevBaseProductIdRef.current = '';
      return;
    }
    if (prevBaseProductIdRef.current !== formData.baseProduct) {
      const prevId = prevBaseProductIdRef.current;
      prevBaseProductIdRef.current = formData.baseProduct;
      if (prevId !== '') {
        setFormData((prev) => ({ ...prev, targetVariant: '', optionalBarcode: '' }));
      }
    }
  }, [formData.baseProduct]);

  React.useEffect(() => {
    if (selectedVariantData && selectedBaseProductData) {
      const cost = getEffectiveVariantTransformationCost(selectedVariantData, selectedBaseProductData);
      setFormData((prev) => ({ ...prev, unitTransformationCost: cost }));
    }
  }, [selectedVariantData, selectedBaseProductData]);

  const [createTransformation, { isLoading: isSubmitting }] = useCreateTransformationMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.baseProduct) {
        showErrorToast('Please select a base product.');
        return;
      }
      if (!formData.targetVariant) {
        showErrorToast('Please select a target variant.');
        return;
      }
      const baseSnap = selectedBaseProductData;
      const variantSnap = selectedVariantData;
      const labelOpts = { optionalVariantBarcode: formData.optionalBarcode };
      await createTransformation({
        baseProduct: formData.baseProduct,
        targetVariant: formData.targetVariant,
        quantity: formData.quantity,
        unitTransformationCost: formData.unitTransformationCost,
        notes: formData.notes,
      }).unwrap();
      let rows = buildLabelPrinterRows(baseSnap, variantSnap, labelOpts);
      if (rows.length === 0) {
        rows = buildLabelPrinterRows(selectedBaseProductData, selectedVariantData, labelOpts);
      }
      if (rows.length > 0 && typeof onOpenBarcodePrint === 'function') {
        onOpenBarcodePrint(rows);
      }
      showSuccessToast('Transformation completed successfully');
      onClose();
      onSuccess();
      setFormData({
        baseProduct: '',
        targetVariant: '',
        quantity: 1,
        unitTransformationCost: 0,
        notes: '',
        optionalBarcode: '',
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

  const labelPrinterProducts = React.useMemo(
    () =>
      buildLabelPrinterRows(selectedBaseProductData, selectedVariantData, {
        optionalVariantBarcode: formData.optionalBarcode,
      }),
    [selectedBaseProductData, selectedVariantData, formData.optionalBarcode]
  );

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
          <ProductSearchableSelect
            label="Base Product"
            placeholder="Search base product…"
            value={formData.baseProduct}
            onValueChange={(id) =>
              setFormData((prev) => ({ ...prev, baseProduct: id, optionalBarcode: '' }))
            }
            withinModal
            className="w-full"
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

              <VariantSearchableSelect
                label="Target Variant"
                placeholder="Search variant for this product…"
                baseProductId={formData.baseProduct}
                value={formData.targetVariant}
                onValueChange={(id) =>
                  setFormData((prev) => ({ ...prev, targetVariant: id, optionalBarcode: '' }))
                }
                withinModal
                className="w-full"
              />

              {formData.targetVariant && (
                <>
                  <ValidatedInput
                    name="transformationQuantity"
                    label="Quantity (units from base stock)"
                    type="number"
                    value={formData.quantity < 1 ? 1 : formData.quantity}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setFormData({
                        ...formData,
                        quantity: Number.isFinite(n) && n >= 1 ? n : 1,
                      });
                    }}
                    min="1"
                    {...(availableStock > 0 ? { max: availableStock } : {})}
                    required
                    helpText={
                      availableStock > 0
                        ? `Cannot exceed available base stock (${availableStock}).`
                        : 'No base stock on hand — add stock in Inventory (or receive on Purchase) before transforming.'
                    }
                  />

                  <div>
                    <label
                      htmlFor="transformation-optional-barcode"
                      className="block text-xs xl:text-sm font-medium text-gray-700 mb-0.5 xl:mb-1"
                    >
                      Barcode for labels (optional)
                    </label>
                    <Input
                      id="transformation-optional-barcode"
                      type="text"
                      autoComplete="off"
                      value={formData.optionalBarcode}
                      onChange={(e) =>
                        setFormData({ ...formData, optionalBarcode: e.target.value })
                      }
                      className="w-full text-sm"
                      placeholder="Leave blank to use the variant’s saved barcode on printed labels"
                    />
                    <p className="mt-0.5 text-[10px] xl:text-xs text-gray-500">
                      Only affects label printing here — does not change the variant in Product Variants.
                    </p>
                  </div>

                  {formData.quantity > availableStock && availableStock >= 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 xl:p-4">
                      <div className="flex items-center gap-1.5 xl:gap-2">
                        <AlertCircle className="h-4 w-4 xl:h-5 xl:w-5 text-red-600" />
                        <span className="text-xs xl:text-sm text-red-800">
                          Insufficient stock. Available: {availableStock}, Requested: {formData.quantity}
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedVariantData && labelPrinterProducts.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 xl:p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs xl:text-sm font-medium text-gray-800">Barcodes &amp; SKUs</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs min-h-[2rem]"
                          onClick={() => onOpenBarcodePrint?.(labelPrinterProducts)}
                        >
                          <Printer className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                          Print labels
                        </Button>
                      </div>
                      <div className="text-[10px] xl:text-xs text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium text-gray-700">Base:</span>{' '}
                          {selectedBaseProductData?.barcode ? `BC ${selectedBaseProductData.barcode}` : 'No barcode'}{' '}
                          · {selectedBaseProductData?.sku ? `SKU ${selectedBaseProductData.sku}` : 'No SKU'}
                        </p>
                        <p>
                          <span className="font-medium text-gray-700">Variant:</span>{' '}
                          {formData.optionalBarcode?.trim()
                            ? `BC ${formData.optionalBarcode.trim()} (for labels)`
                            : selectedVariantData.barcode
                              ? `BC ${selectedVariantData.barcode}`
                              : 'No barcode'}{' '}
                          · {selectedVariantData.sku ? `SKU ${selectedVariantData.sku}` : 'No SKU'}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
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
                  {getEffectiveVariantTransformationCost(selectedVariantData, selectedBaseProductData).toFixed(2)}
                </span>
              </div>
              {(() => {
                const stored = Number(selectedVariantData.transformationCost ?? selectedVariantData.transformation_cost ?? 0);
                const effective = getEffectiveVariantTransformationCost(selectedVariantData, selectedBaseProductData);
                if (!Number.isFinite(stored) || stored <= 0) {
                  if (effective > 0) {
                    return (
                      <p className="text-[10px] xl:text-xs text-blue-800 mb-1.5 xl:mb-2">
                        Stored transformation cost is 0 — using retail difference (variant retail − base retail). Set a value in Product Variants to save it on the variant.
                      </p>
                    );
                  }
                  return (
                    <p className="text-[10px] xl:text-xs text-blue-800 mb-1.5 xl:mb-2">
                      No stored transformation cost (0). Enter a unit cost above or set &quot;Transformation cost&quot; on the variant in Product Variants.
                    </p>
                  );
                }
                return null;
              })()}
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    unitTransformationCost: getEffectiveVariantTransformationCost(
                      selectedVariantData,
                      selectedBaseProductData
                    ),
                  })
                }
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

