import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, Plus, Minus, Package, AlertTriangle } from 'lucide-react';
import { useFormValidation } from '../hooks/useFormValidation';
import { validateRequired, validatePositiveNumber } from '../utils/validation';
import { LoadingButton } from './LoadingSpinner';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { useGetProductsQuery } from '../store/services/productsApi';
import { useCreateStockAdjustmentMutation } from '../store/services/inventoryApi';
import { SearchableDropdown } from './SearchableDropdown';
import { formatCurrency } from '../utils/formatters';

const StockAdjustmentModal = ({ isOpen, onClose, onSuccess }) => {
  const [adjustmentType, setAdjustmentType] = useState('physical_count');
  const [adjustments, setAdjustments] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  const {
    values,
    errors,
    handleChange,
    handleBlur,
    validateForm,
    resetForm,
    setError,
    clearError
  } = useFormValidation(
    {
      reason: '',
      warehouse: 'Main Warehouse',
      notes: '',
    },
    {
      reason: (value) => validateRequired(value, 'Reason') || null,
    }
  );

  // Fetch products for search
  const { data: productsResponse, isLoading: productsLoading } = useGetProductsQuery(
    { search: productSearchTerm, limit: 20 },
    {
      skip: productSearchTerm.length === 0,
    }
  );

  const products = productsResponse?.data?.products || productsResponse?.products || [];

  // Create stock adjustment mutation
  const [createStockAdjustment, { isLoading: creating }] = useCreateStockAdjustmentMutation();

  const resetModal = () => {
    resetForm();
    setAdjustmentType('physical_count');
    setAdjustments([]);
    setSelectedProduct(null);
    setProductSearchTerm('');
    setIsAddingProduct(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleProductSelect = async (product) => {
    setSelectedProduct(product);
    setIsAddingProduct(true);
    
    // Check if product already exists in adjustments
    const existingAdjustment = adjustments.find(adj => adj.product._id === product._id);
    if (existingAdjustment) {
      showErrorToast('Product is already in the adjustment list');
      setIsAddingProduct(false);
      return;
    }
  };

  const addProductToAdjustment = (currentStock, adjustedStock) => {
    if (!selectedProduct) return;
    
    const variance = adjustedStock - currentStock;
    
    const newAdjustment = {
      product: selectedProduct,
      currentStock,
      adjustedStock,
      variance,
      cost: selectedProduct.pricing?.cost || 0,
      notes: '',
    };
    
    setAdjustments(prev => [...prev, newAdjustment]);
    setSelectedProduct(null);
    setIsAddingProduct(false);
    setProductSearchTerm('');
  };

  const removeAdjustment = (productId) => {
    setAdjustments(prev => prev.filter(adj => adj.product._id !== productId));
  };

  const updateAdjustment = (productId, field, value) => {
    setAdjustments(prev => prev.map(adj => {
      if (adj.product._id === productId) {
        const updated = { ...adj, [field]: value };
        if (field === 'adjustedStock') {
          updated.variance = value - adj.currentStock;
        }
        return updated;
      }
      return adj;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (adjustments.length === 0) {
      showErrorToast('Please add at least one product to adjust');
      return;
    }
    
    const formErrors = validateForm();
    if (Object.values(formErrors).some(e => e !== null)) {
      showErrorToast('Please correct the form errors');
      return;
    }
    
    const adjustmentData = {
      type: adjustmentType,
      reason: values.reason,
      warehouse: values.warehouse,
      notes: values.notes,
      adjustments: adjustments.map(adj => ({
        product: adj.product._id,
        currentStock: adj.currentStock,
        adjustedStock: adj.adjustedStock,
        cost: adj.cost,
        notes: adj.notes,
      })),
    };
    
    createStockAdjustment(adjustmentData)
      .unwrap()
      .then(() => {
        showSuccessToast('Stock adjustment request created successfully');
        onSuccess();
        resetModal();
      })
      .catch((error) => {
        handleApiError(error, 'Stock Adjustment Creation');
      });
  };

  const normalizeCategoryLabel = (category) => {
    if (!category) return 'N/A';
    if (typeof category === 'string') return category;
    if (typeof category === 'object') {
      if (React.isValidElement(category)) {
        return 'N/A';
      }

      const candidateFields = [
        'label',
        'name',
        'displayName',
        'title',
        'fullName',
        'code',
        'id',
        '_id'
      ];

      for (const field of candidateFields) {
        if (category[field]) {
          const value = category[field];
          if (typeof value === 'string') {
            return value;
          }
        }
      }
    }

    return 'N/A';
  };

  const getProductPrice = (product) => {
    if (!product) return null;

    const candidates = [
      product.price,
      product.defaultPrice,
      product.sellingPrice,
      product.cost,
      product.pricing?.retail,
      product.pricing?.sellingPrice,
      product.pricing?.wholesale,
      product.pricing?.price,
      product.pricing?.cost
    ];

    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined) continue;
      if (typeof candidate === 'number' && !Number.isNaN(candidate)) {
        return candidate;
      }
      if (typeof candidate === 'string') {
        const parsed = parseFloat(candidate);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }

    return null;
  };

  const formatProductPrice = (product) => {
    const price = getProductPrice(product);
    if (price === null) return 'Price: —';
    const formatted = formatCurrency(price) || '';
    return `Price: ${formatted || '—'}`;
  };

  const productDisplayKey = (product) => (
    <div className="flex items-center gap-3 text-sm text-gray-700 w-full">
      <span className="font-semibold text-gray-900 truncate">{product.name}</span>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-xs text-gray-500 text-right">
        <span>Category: {normalizeCategoryLabel(product.category)}</span>
        <span className="text-gray-300">•</span>
        <span>Stock: {product.inventory?.currentStock ?? 0}</span>
        <span className="text-gray-300">•</span>
        <span>{formatProductPrice(product)}</span>
      </div>
    </div>
  );

  const totalVariance = adjustments.reduce((sum, adj) => sum + adj.variance, 0);
  const totalCostImpact = adjustments.reduce((sum, adj) => sum + (adj.variance * adj.cost), 0);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center mb-6"
                >
                  Create Stock Adjustment
                  <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Adjustment Type and Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adjustment Type
                      </label>
                      <select
                        value={adjustmentType}
                        onChange={(e) => setAdjustmentType(e.target.value)}
                        className="select"
                      >
                        <option value="physical_count">Physical Count</option>
                        <option value="damage">Damage</option>
                        <option value="theft">Theft</option>
                        <option value="transfer">Transfer</option>
                        <option value="correction">Correction</option>
                        <option value="return">Return</option>
                        <option value="write_off">Write Off</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Warehouse
                      </label>
                      <input
                        type="text"
                        name="warehouse"
                        value={values.warehouse}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="input"
                        placeholder="Warehouse location"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="reason"
                      value={values.reason}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`input ${errors.reason ? 'input-error' : ''}`}
                      placeholder="Enter reason for adjustment"
                    />
                    {errors.reason && <p className="text-red-600 text-sm mt-1">{errors.reason}</p>}
                  </div>

                  {/* Add Products */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Products
                    </label>
                    <SearchableDropdown
                      placeholder="Search products to adjust..."
                      items={products?.data?.products || []}
                      onSelect={handleProductSelect}
                      onSearch={setProductSearchTerm}
                      displayKey={productDisplayKey}
                      loading={productsLoading}
                      emptyMessage="No products found"
                    />
                  </div>

                  {/* Product Adjustment Form */}
                  {isAddingProduct && selectedProduct && (
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Adjust Stock for {selectedProduct.name}</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(null);
                            setIsAddingProduct(false);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Current Stock
                          </label>
                          <input
                            type="number"
                            value={selectedProduct.inventory?.currentStock || 0}
                            className="input bg-gray-100"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Adjusted Stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="input"
                            placeholder="Enter new stock level"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const adjustedStock = parseFloat(e.target.value) || 0;
                                addProductToAdjustment(
                                  selectedProduct.inventory?.currentStock || 0,
                                  adjustedStock
                                );
                              }
                            }}
                            autoFocus
                          />
                        </div>
                      </div>
                      
                      <div className="mt-3 flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            const adjustedStock = document.querySelector('input[placeholder="Enter new stock level"]').value;
                            addProductToAdjustment(
                              selectedProduct.inventory?.currentStock || 0,
                              parseFloat(adjustedStock) || 0
                            );
                          }}
                          className="btn btn-primary flex-1"
                        >
                          Add to Adjustment
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(null);
                            setIsAddingProduct(false);
                          }}
                          className="btn btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Adjustments List */}
                  {adjustments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Adjustments ({adjustments.length})</h4>
                      <div className="space-y-3">
                        {adjustments.map((adjustment) => (
                          <div key={adjustment.product._id} className="bg-white border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <Package className="h-5 w-5 text-gray-400" />
                              <div className="flex-1 flex items-center gap-3">
                                <span className="font-semibold text-gray-900">
                                  {adjustment.product.name}
                                </span>
                                <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-xs text-gray-500 text-right">
                                  <span>
                                    Category: {normalizeCategoryLabel(adjustment.product.category)}
                                  </span>
                                  <span className="text-gray-300">•</span>
                                  <span>Stock: {adjustment.currentStock}</span>
                                  <span className="text-gray-300">•</span>
                                  <span>{formatProductPrice(adjustment.product)}</span>
                                </div>
                              </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAdjustment(adjustment.product._id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Current Stock
                                </label>
                                <input
                                  type="number"
                                  value={adjustment.currentStock}
                                  className="input bg-gray-100"
                                  readOnly
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Adjusted Stock
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={adjustment.adjustedStock}
                                  onChange={(e) => updateAdjustment(adjustment.product._id, 'adjustedStock', parseFloat(e.target.value) || 0)}
                                  className="input"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Variance
                                </label>
                                <div className={`input bg-gray-100 ${adjustment.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {adjustment.variance >= 0 ? '+' : ''}{adjustment.variance}
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Cost Impact
                                </label>
                                <div className={`input bg-gray-100 ${adjustment.variance * adjustment.cost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ${(adjustment.variance * adjustment.cost).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {adjustments.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">Adjustment Summary</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-gray-600">Total Products</div>
                          <div className="text-lg font-semibold">{adjustments.length}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Total Variance</div>
                          <div className={`text-lg font-semibold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalVariance >= 0 ? '+' : ''}{totalVariance}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Cost Impact</div>
                          <div className={`text-lg font-semibold ${totalCostImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${totalCostImpact.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={values.notes}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      rows={3}
                      className="input"
                      placeholder="Additional notes (optional)"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-3 pt-6 border-t">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      type="submit"
                      isLoading={creating}
                      className="btn btn-primary"
                    >
                      Create Adjustment Request
                    </LoadingButton>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default StockAdjustmentModal;
