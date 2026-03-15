import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, AlertCircle } from 'lucide-react';
import { useCreatePurchaseReturnMutation } from '../store/services/purchaseReturnsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/LoadingSpinner';

const CreatePurchaseReturnModal = ({ isOpen, onClose, onSuccess, purchaseInvoice, supplier }) => {
  const [formData, setFormData] = useState({
    originalOrder: purchaseInvoice?._id || '',
    returnType: 'return',
    priority: 'normal',
    refundMethod: 'original_payment',
    items: [],
    generalNotes: '',
    origin: 'purchase'
  });

  const [createPurchaseReturn, { isLoading: isCreatingReturn }] = useCreatePurchaseReturnMutation();

  useEffect(() => {
    if (isOpen && purchaseInvoice) {
      setFormData({
        originalOrder: purchaseInvoice._id,
        returnType: 'return',
        priority: 'normal',
        refundMethod: 'original_payment',
        items: [],
        generalNotes: '',
        origin: 'purchase'
      });
    }
  }, [isOpen, purchaseInvoice]);

  // Calculate available quantity for each item (considering already returned items)
  const getAvailableQuantity = (orderItem) => {
    // For now, assume all items are available
    // In production, you'd check existing returns for this order item
    return orderItem.quantity || 0;
  };

  const handleAddItem = (orderItem) => {
    const availableQuantity = getAvailableQuantity(orderItem);
    if (availableQuantity <= 0) {
      showErrorToast('No items available for return');
      return;
    }

    const itemPrice = orderItem.price || orderItem.unitPrice || orderItem.costPerUnit || orderItem.unitCost || 0;
    
    const newItem = {
      product: orderItem.product?._id || orderItem.product,
      originalOrderItem: orderItem._id,
      quantity: 1,
      originalPrice: itemPrice,
      returnReason: 'defective',
      condition: 'good',
      action: 'refund',
      returnReasonDetail: '',
      refundAmount: 0,
      restockingFee: 0,
      maxQuantity: availableQuantity
    };

    // Check if item already added
    if (formData.items.some(i => i.originalOrderItem === orderItem._id)) {
      showErrorToast('Item already added to return');
      return;
    }

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!purchaseInvoice) {
      showErrorToast('Purchase invoice information is missing');
      return;
    }

    if (formData.items.length === 0) {
      showErrorToast('Please add at least one item to return');
      return;
    }

    // Validate all items
    for (const item of formData.items) {
      if (!item.returnReason) {
        showErrorToast('Please select a return reason for all items');
        return;
      }
      if (!item.condition) {
        showErrorToast('Please select a condition for all items');
        return;
      }
      if (item.quantity < 1 || item.quantity > item.maxQuantity) {
        showErrorToast(`Invalid quantity for ${item.product?.name || 'item'}. Max: ${item.maxQuantity}`);
        return;
      }
    }

    try {
      await createPurchaseReturn(formData).unwrap();
      showSuccessToast('Purchase return created successfully');
      onSuccess();
    } catch (error) {
      handleApiError(error, 'Create Purchase Return');
    }
  };

  if (!isOpen || !purchaseInvoice) return null;

  const invoiceItems = purchaseInvoice.items || [];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-0 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Create Purchase Return</h3>
            <p className="text-sm text-gray-600 mt-1">
              Invoice: {purchaseInvoice.invoiceNumber || purchaseInvoice.poNumber || 'N/A'} • 
              Supplier: {supplier?.companyName || supplier?.businessName || supplier?.name || 'N/A'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5">
          <form id="purchase-return-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Return Type and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Type *
                </label>
                <select
                  value={formData.returnType}
                  onChange={(e) => setFormData(prev => ({ ...prev, returnType: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="return">Return</option>
                  <option value="exchange">Exchange</option>
                  <option value="warranty">Warranty</option>
                  <option value="recall">Recall</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="input"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Items to Return */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Items to Return *
              </label>
              
              {invoiceItems.length === 0 ? (
                <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                  <AlertCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p>No items found in this purchase invoice</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Available Items */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Available Items</h4>
                    <div className="space-y-2">
                      {invoiceItems.map((item) => {
                        const availableQuantity = getAvailableQuantity(item);
                        const isAlreadyAdded = formData.items.some(i => i.originalOrderItem === item._id);
                        const productName = item.product?.name || item.product?.displayName || 'Unknown Product';
                        const itemPrice = item.price || item.unitPrice || item.costPerUnit || item.unitCost || 0;

                        return (
                          <div key={item._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex-1">
                              <div className="font-medium">{productName}</div>
                              <div className="text-sm text-gray-500">
                                Available: {availableQuantity} • 
                                Price: ${itemPrice.toFixed(2)} • 
                                Original Qty: {item.quantity}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddItem(item)}
                              className="btn btn-primary btn-sm"
                              disabled={isAlreadyAdded || availableQuantity <= 0}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Items */}
                  {formData.items.length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Selected Items for Return</h4>
                      <div className="space-y-4">
                        {formData.items.map((item, index) => {
                          const orderItem = invoiceItems.find(oi => oi._id === item.originalOrderItem);
                          const productName = orderItem?.product?.name || orderItem?.product?.displayName || 'Unknown Product';

                          return (
                            <div key={index} className="p-3 bg-gray-50 rounded border">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="font-medium">{productName}</div>
                                  <div className="text-sm text-gray-500">
                                    Max quantity: {item.maxQuantity} • 
                                    Price: ${item.originalPrice.toFixed(2)}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Quantity *
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.maxQuantity}
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                    className="input"
                                    required
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Return Reason *
                                  </label>
                                  <select
                                    value={item.returnReason}
                                    onChange={(e) => handleItemChange(index, 'returnReason', e.target.value)}
                                    className="input"
                                    required
                                  >
                                    <option value="">Select reason</option>
                                    <option value="defective">Defective</option>
                                    <option value="wrong_item">Wrong Item</option>
                                    <option value="not_as_described">Not as Described</option>
                                    <option value="damaged_shipping">Damaged in Shipping</option>
                                    <option value="changed_mind">Changed Mind</option>
                                    <option value="duplicate_order">Duplicate Order</option>
                                    <option value="size_issue">Size Issue</option>
                                    <option value="quality_issue">Quality Issue</option>
                                    <option value="late_delivery">Late Delivery</option>
                                    <option value="other">Other</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Condition *
                                  </label>
                                  <select
                                    value={item.condition}
                                    onChange={(e) => handleItemChange(index, 'condition', e.target.value)}
                                    className="input"
                                    required
                                  >
                                    <option value="">Select condition</option>
                                    <option value="new">New</option>
                                    <option value="like_new">Like New</option>
                                    <option value="good">Good</option>
                                    <option value="fair">Fair</option>
                                    <option value="poor">Poor</option>
                                    <option value="damaged">Damaged</option>
                                  </select>
                                </div>
                              </div>

                              <div className="mt-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Return Reason Details
                                </label>
                                <textarea
                                  value={item.returnReasonDetail}
                                  onChange={(e) => handleItemChange(index, 'returnReasonDetail', e.target.value)}
                                  placeholder="Additional details about the return reason..."
                                  className="input"
                                  rows={2}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Refund Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Refund Method
              </label>
              <select
                value={formData.refundMethod}
                onChange={(e) => setFormData(prev => ({ ...prev, refundMethod: e.target.value }))}
                className="input"
              >
                <option value="original_payment">Original Payment Method</option>
                <option value="store_credit">Store Credit</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.generalNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, generalNotes: e.target.value }))}
                placeholder="Additional notes about this return request..."
                className="input"
                rows={3}
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="purchase-return-form"
            disabled={isCreatingReturn || formData.items.length === 0}
            className="btn btn-primary"
          >
            {isCreatingReturn ? (
              <LoadingSpinner size="sm" />
            ) : (
              'Create Return Request'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePurchaseReturnModal;
