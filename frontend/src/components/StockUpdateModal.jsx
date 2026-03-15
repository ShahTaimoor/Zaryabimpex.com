import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, TrendingUp, TrendingDown, Package, AlertTriangle } from 'lucide-react';
import { useFormValidation } from '../hooks/useFormValidation';
import { validateRequired, validatePositiveNumber } from '../utils/validation';
import { LoadingButton } from './LoadingSpinner';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { useUpdateStockMutation } from '../store/services/inventoryApi';

const StockUpdateModal = ({ isOpen, onClose, product, onSuccess }) => {
  const [updateType, setUpdateType] = useState('adjustment');
  const [updateStock, { isLoading: updating }] = useUpdateStockMutation();

  const {
    values,
    errors,
    handleChange,
    handleBlur,
    validateForm,
    resetForm
  } = useFormValidation(
    {
      quantity: '',
      reason: '',
      cost: '',
      notes: '',
    },
    {
      quantity: (value) => validateRequired(value, 'Quantity') || validatePositiveNumber(value, 'Quantity') || null,
      reason: (value) => validateRequired(value, 'Reason') || null,
    }
  );

  // Update stock mutation
  const resetModal = () => {
    resetForm();
    setUpdateType('adjustment');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formErrors = validateForm();
    if (Object.values(formErrors).some(e => e !== null)) {
      showErrorToast('Please correct the form errors');
      return;
    }
    
    let movementType = 'adjustment';
    let quantity = parseFloat(values.quantity);
    
    // Determine movement type based on update type
    switch (updateType) {
      case 'add':
        movementType = 'in';
        break;
      case 'remove':
        movementType = 'out';
        break;
      case 'adjustment':
        // For adjustment, quantity is the new total stock level
        quantity = parseFloat(values.quantity);
        break;
      default:
        break;
    }
    
    const stockData = {
      productId: product?.product?._id || product?._id,
      type: movementType,
      quantity: updateType === 'adjustment' ? quantity : Math.abs(quantity),
      reason: values.reason,
      cost: values.cost ? parseFloat(values.cost) : undefined,
      notes: values.notes,
    };
    
    updateStock(stockData)
      .unwrap()
      .then(() => {
        showSuccessToast('Stock updated successfully');
        onSuccess();
        resetModal();
      })
      .catch((error) => {
        handleApiError(error, 'Stock Update');
      });
  };

  const getMovementIcon = () => {
    switch (updateType) {
      case 'add':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'remove':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      case 'adjustment':
        return <Package className="h-5 w-5 text-blue-600" />;
      default:
        return <Package className="h-5 w-5 text-gray-600" />;
    }
  };

  const getMovementLabel = () => {
    switch (updateType) {
      case 'add':
        return 'Add Stock';
      case 'remove':
        return 'Remove Stock';
      case 'adjustment':
        return 'Adjust Stock';
      default:
        return 'Update Stock';
    }
  };

  const getQuantityLabel = () => {
    switch (updateType) {
      case 'add':
        return 'Quantity to Add';
      case 'remove':
        return 'Quantity to Remove';
      case 'adjustment':
        return 'New Stock Level';
      default:
        return 'Quantity';
    }
  };

  const getQuantityPlaceholder = () => {
    switch (updateType) {
      case 'adjustment':
        return product?.currentStock?.toString() || '0';
      default:
        return '0';
    }
  };

  if (!product) return null;

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center mb-6"
                >
                  {getMovementLabel()}
                  <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Title>

                {/* Product Info */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-gray-400" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {product?.product?.name || product?.name || 'Unknown Product'}
                      </div>
                      <div className="text-sm text-gray-500">
                        Category: {product?.product?.category || product?.category || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Current Stock</div>
                      <div className="font-semibold text-lg">
                        {product?.currentStock || product?.inventory?.currentStock || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Available</div>
                      <div className="font-semibold text-lg">
                        {product?.availableStock || (product?.currentStock || 0) - (product?.reservedStock || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Update Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Update Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setUpdateType('add')}
                        className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                          updateType === 'add'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <TrendingUp className="h-4 w-4 mx-auto mb-1" />
                        Add Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpdateType('remove')}
                        className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                          updateType === 'remove'
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <TrendingDown className="h-4 w-4 mx-auto mb-1" />
                        Remove Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpdateType('adjustment')}
                        className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                          updateType === 'adjustment'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <Package className="h-4 w-4 mx-auto mb-1" />
                        Adjust Stock
                      </button>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getQuantityLabel()} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      value={values.quantity}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`input ${errors.quantity ? 'input-error' : ''}`}
                      placeholder={getQuantityPlaceholder()}
                      min="0"
                      step="0.01"
                      autoFocus
                    />
                    {errors.quantity && <p className="text-red-600 text-sm mt-1">{errors.quantity}</p>}
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="reason"
                      value={values.reason}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`select ${errors.reason ? 'select-error' : ''}`}
                    >
                      <option value="">Select a reason</option>
                      <option value="Physical count">Physical count</option>
                      <option value="Damaged goods">Damaged goods</option>
                      <option value="Theft/Loss">Theft/Loss</option>
                      <option value="Transfer">Transfer</option>
                      <option value="Return">Return</option>
                      <option value="Purchase receipt">Purchase receipt</option>
                      <option value="Sale">Sale</option>
                      <option value="Adjustment">Adjustment</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.reason && <p className="text-red-600 text-sm mt-1">{errors.reason}</p>}
                  </div>

                  {/* Cost (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cost per Unit
                    </label>
                    <input
                      type="number"
                      name="cost"
                      value={values.cost}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="input"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional: Cost per unit for inventory valuation</p>
                  </div>

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

                  {/* Preview */}
                  {values.quantity && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        {getMovementIcon()}
                        <span className="font-medium text-blue-900">Preview</span>
                      </div>
                      <div className="text-sm text-blue-800">
                        <div>Current Stock: {product?.currentStock || product?.inventory?.currentStock || 0}</div>
                        {updateType === 'adjustment' ? (
                          <div>New Stock Level: {values.quantity}</div>
                        ) : (
                          <>
                            <div>{updateType === 'add' ? 'Adding' : 'Removing'}: {values.quantity}</div>
                            <div>
                              New Stock Level: {
                                updateType === 'add' 
                                  ? (product?.currentStock || 0) + parseFloat(values.quantity || 0)
                                  : Math.max(0, (product?.currentStock || 0) - parseFloat(values.quantity || 0))
                              }
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

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
                      isLoading={updating}
                      className="btn btn-primary"
                    >
                      Update Stock
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

export default StockUpdateModal;
