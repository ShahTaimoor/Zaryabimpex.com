import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Minus, AlertCircle } from 'lucide-react';
import { 
  useGetEligibleItemsQuery,
  useCreateReturnMutation 
} from '../store/services/returnsApi';
import { useGetOrdersQuery } from '../store/services/salesApi';
import { useGetSalesOrdersQuery } from '../store/services/salesOrdersApi';
import { useGetPurchaseInvoicesQuery } from '../store/services/purchaseInvoicesApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { LoadingSpinner } from '../components/LoadingSpinner';

const CreateReturnModal = ({ isOpen, onClose, onSuccess, defaultReturnType = 'sales' }) => {
  const isPurchaseReturn = defaultReturnType === 'purchase';
  const [formData, setFormData] = useState({
    originalOrder: '',
    returnType: 'return',
    priority: 'normal',
    refundMethod: 'original_payment',
    items: [],
    generalNotes: '',
    origin: defaultReturnType
  });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [showOrderSearch, setShowOrderSearch] = useState(false);

  // Search for orders - for sales returns, search both Sales and SalesOrders
  const { data: salesData, isLoading: salesLoading } = useGetOrdersQuery(
    { search: orderSearch, limit: 10 },
    { skip: isPurchaseReturn || orderSearch.length < 1 }
  );
  
  const { data: salesOrdersData, isLoading: salesOrdersLoading } = useGetSalesOrdersQuery(
    { search: orderSearch, limit: 10 },
    { skip: isPurchaseReturn || orderSearch.length < 1 }
  );
  
  const { data: purchaseInvoicesData, isLoading: purchaseInvoicesLoading } = useGetPurchaseInvoicesQuery(
    { search: orderSearch, limit: 10 },
    { skip: !isPurchaseReturn || orderSearch.length < 1 }
  );
  
  const ordersLoading = isPurchaseReturn 
    ? purchaseInvoicesLoading 
    : (salesLoading || salesOrdersLoading);

  // Get eligible items for selected order
  const { data: eligibleItemsData, isLoading: eligibleItemsLoading } = useGetEligibleItemsQuery(
    selectedOrder?._id ? { orderId: selectedOrder._id, isPurchase: isPurchaseReturn } : null,
    { skip: !selectedOrder?._id }
  );

  // Create return mutation
  const [createReturn, { isLoading: isCreatingReturn }] = useCreateReturnMutation();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        originalOrder: '',
        returnType: 'return',
        priority: 'normal',
        refundMethod: 'original_payment',
        items: [],
        generalNotes: '',
        origin: defaultReturnType
      });
      setSelectedOrder(null);
      setOrderSearch('');
      setShowOrderSearch(false);
    }
  }, [isOpen, defaultReturnType]);

  const handleOrderSelect = (order) => {
    setSelectedOrder(order);
    setFormData(prev => ({ ...prev, originalOrder: order._id }));
    setShowOrderSearch(false);
    setOrderSearch('');
  };

  const handleAddItem = (orderItem, availableQuantity) => {
    // Handle different price field names for sales vs purchase
    const itemPrice = orderItem.price || orderItem.unitPrice || orderItem.unitCost || orderItem.totalCost / (orderItem.quantity || 1) || 0;
    
    const newItem = {
      product: orderItem.product._id,
      originalOrderItem: orderItem._id,
      quantity: 1,
      originalPrice: itemPrice,
      returnReason: 'changed_mind',
      condition: 'good',
      action: 'refund',
      returnReasonDetail: '',
      refundAmount: 0,
      restockingFee: 0
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...newItem, maxQuantity: availableQuantity }]
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
    
    if (!selectedOrder) {
      showErrorToast('Please select an order');
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
        showErrorToast('Invalid quantity for one or more items');
        return;
      }
    }

    try {
      await createReturn(formData).unwrap();
      showSuccessToast('Return request created successfully');
      onSuccess();
    } catch (error) {
      handleApiError(error, 'Create Return');
    }
  };

  const orders = useMemo(() => {
    if (isPurchaseReturn) {
      if (!purchaseInvoicesData) return [];
      return purchaseInvoicesData.data?.purchaseInvoices || purchaseInvoicesData.purchaseInvoices || purchaseInvoicesData.data || [];
    }

    // Combine Sales and SalesOrders for sales returns
    const salesOrders = salesData?.items || salesData?.data?.items || salesData?.data || [];
    const salesOrderList = salesOrdersData?.data?.salesOrders || salesOrdersData?.salesOrders || salesOrdersData?.data || [];
    
    // Combine and deduplicate by _id
    const combined = [...salesOrders, ...salesOrderList];
    const uniqueOrders = combined.filter((order, index, self) => 
      index === self.findIndex((o) => o._id === order._id)
    );
    
    return uniqueOrders;
  }, [salesData, salesOrdersData, purchaseInvoicesData, isPurchaseReturn]);
  const eligibleItems = eligibleItemsData?.data?.eligibleItems || eligibleItemsData?.eligibleItems || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className={`relative top-20 mx-auto p-0 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white flex flex-col ${selectedOrder ? 'max-h-[90vh]' : ''}`}>
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-medium text-gray-900">Create Return Request</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable Content - Only scroll when order is selected */}
        <div className={`${selectedOrder ? 'overflow-y-auto flex-1' : ''} p-5`}>
          <form id="return-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Order Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Original Order *
            </label>
            
            {!selectedOrder ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={
                    isPurchaseReturn
                      ? 'Search purchase orders by order number, supplier name...'
                      : 'Search orders by order number, customer name...'
                  }
                  value={orderSearch}
                  onChange={(e) => {
                    setOrderSearch(e.target.value);
                    setShowOrderSearch(true);
                  }}
                  onFocus={() => setShowOrderSearch(true)}
                  className="input pl-10"
                />
                
                {showOrderSearch && orderSearch && (
                  <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none">
                    {ordersLoading ? (
                      <div className="px-4 py-2 text-gray-500">Searching...</div>
                    ) : orders.length === 0 ? (
                      <div className="px-4 py-2 text-gray-500">No orders found</div>
                    ) : (
                      orders.map((order) => {
                        const supplier = order.supplier || order.purchaseInvoice?.supplier;
                        const customer = order.customer || order.salesOrder?.customer;
                        const partyName = isPurchaseReturn
                          ? (
                              supplier?.companyName ||
                              supplier?.name ||
                              supplier?.businessName ||
                              supplier?.contactPerson?.name ||
                              'Unknown supplier'
                            )
                          : (
                              customer?.businessName ||
                              [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') ||
                              customer?.email ||
                              'Unknown customer'
                            );

                        const orderTotal = order.total ?? order.grandTotal ?? order.amount ?? 0;
                        const orderDate = order.createdAt || order.invoiceDate || order.orderDate;
                        const orderNumber = order.orderNumber || order.soNumber || order.invoiceNumber || order.poNumber || 'N/A';

                        return (
                          <button
                            key={order._id}
                            type="button"
                            onClick={() => handleOrderSelect(order)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm text-gray-500">
                                {orderDate ? new Date(orderDate).toLocaleDateString() : '—'}
                              </span>
                              <span className="font-medium flex-1">
                                {partyName}
                              </span>
                              <span className="text-sm text-gray-600">
                                {orderNumber}
                              </span>
                              <span className="text-sm font-medium text-gray-900">
                                ${orderTotal.toFixed(2)}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {selectedOrder.orderNumber || selectedOrder.soNumber || selectedOrder.invoiceNumber || selectedOrder.poNumber || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">
                        {(() => {
                        const supplier = selectedOrder.supplier || selectedOrder.purchaseInvoice?.supplier;
                        const customer = selectedOrder.customer || selectedOrder.salesOrder?.customer;
                        const partyName = isPurchaseReturn
                          ? (
                              supplier?.companyName ||
                              supplier?.name ||
                              supplier?.businessName ||
                              supplier?.contactPerson?.name ||
                              'Unknown supplier'
                            )
                          : (
                              customer?.businessName ||
                              [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') ||
                              customer?.email ||
                              'Unknown customer'
                            );
                          const orderTotal = selectedOrder.total ?? selectedOrder.grandTotal ?? selectedOrder.amount ?? 0;
                          const orderDate = selectedOrder.createdAt || selectedOrder.invoiceDate || selectedOrder.orderDate;
                          return `${partyName} • $${orderTotal.toFixed(2)} • ${orderDate ? new Date(orderDate).toLocaleDateString() : '—'}`;
                        })()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(null);
                      setFormData(prev => ({ ...prev, originalOrder: '' }));
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {selectedOrder && (
            <>
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

              {/* Eligible Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Items to Return *
                </label>
                
                {eligibleItemsLoading ? (
                  <LoadingSpinner message="Loading eligible items..." />
                ) : eligibleItems.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                    <AlertCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p>No items are eligible for return from this order</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Available Items */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Available Items</h4>
                      <div className="space-y-2">
                        {eligibleItems.map((item, index) => (
                          <div key={item.orderItem._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex-1">
                              <div className="font-medium">{item.orderItem.product.name}</div>
                              <div className="text-sm text-gray-500">
                                Available: {item.availableQuantity} • 
                                Price: ${(item.orderItem.price || item.orderItem.unitPrice || item.orderItem.unitCost || 0).toFixed(2)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddItem(item.orderItem, item.availableQuantity)}
                              className="btn btn-primary btn-sm"
                              disabled={formData.items.some(i => i.originalOrderItem === item.orderItem._id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Selected Items */}
                    {formData.items.length > 0 && (
                      <div className="border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Selected Items</h4>
                        <div className="space-y-4">
                          {formData.items.map((item, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded border">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {eligibleItems.find(ei => ei.orderItem._id === item.originalOrderItem)?.orderItem.product.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Max quantity: {item.maxQuantity}
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
                          ))}
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
            </>
          )}

          </form>
        </div>

        {/* Footer - Fixed - Only show when order is selected */}
        {selectedOrder && (
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
            form="return-form"
            disabled={isCreatingReturn || !selectedOrder || formData.items.length === 0}
            className="btn btn-primary"
          >
            {isCreatingReturn ? (
              <LoadingSpinner size="sm" />
            ) : (
              'Create Return Request'
            )}
          </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateReturnModal;
