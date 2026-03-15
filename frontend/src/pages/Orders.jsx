import React, { useState } from 'react';
import {
  ShoppingCart,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Trash2,
  Edit,
  Printer
} from 'lucide-react';
import {
  useGetOrdersQuery,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
} from '../store/services/salesApi';
import { useGetProductsQuery } from '../store/services/productsApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useGetCompanySettingsQuery } from '../store/services/settingsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../components/ComponentRegistry';
import DateFilter from '../components/DateFilter';
import PrintModal from '../components/PrintModal';

// Helper function to get local date in YYYY-MM-DD format (avoids timezone issues with toISOString)
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const OrderCard = ({ order, onDelete, onView, onEdit, onPrint }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'badge-success';
      case 'pending':
      case 'processing':
        return 'badge-warning';
      case 'cancelled':
        return 'badge-danger';
      default:
        return 'badge-gray';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'badge-success';
      case 'partial':
        return 'badge-warning';
      case 'pending':
        return 'badge-gray';
      default:
        return 'badge-gray';
    }
  };

  return (
    <div className="card">
      <div className="card-content">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">
              Order #{order.orderNumber}
            </h3>
            <p className="text-sm text-gray-600">
              {order.customerInfo?.name || 'Walk-in Customer'}
            </p>
            <p className="text-sm text-gray-600">
              {order.billDate ? new Date(order.billDate).toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900">
              {Math.round(order.pricing.total)}
            </p>
            <p className="text-sm text-gray-600">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`badge ${getStatusColor(order.status)}`}>
              {order.status}
            </span>
            <span className={`badge ${getPaymentStatusColor(order.payment.status)}`}>
              {order.payment.status}
            </span>
            <span className="badge badge-info">
              {order.orderType}
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onView(order)}
              className="text-primary-600 hover:text-primary-800"
              title="View Invoice"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPrint(order)}
              className="text-green-600 hover:text-green-800"
              title="Print Invoice"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={() => onEdit(order)}
              className="text-blue-600 hover:text-blue-800"
              title="Edit Invoice"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(order)}
              className="text-red-600 hover:text-red-800"
              title="Delete Invoice"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Orders = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const today = getLocalDateString();
  const [fromDate, setFromDate] = useState(today); // Today
  const [toDate, setToDate] = useState(today); // Today

  // Handle date change from DateFilter component
  const handleDateChange = (newStartDate, newEndDate) => {
    setFromDate(newStartDate || '');
    setToDate(newEndDate || '');
  };

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    notes: '',
    items: [],
    billDate: '',
    customer: null,
    orderType: 'retail'
  });

  const { openTab } = useTab();
  const [showProductModal, setShowProductModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrderData, setPrintOrderData] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newProductQuantity, setNewProductQuantity] = useState(1);
  const [newProductRate, setNewProductRate] = useState(0);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // Mutations
  const [updateOrder] = useUpdateOrderMutation();
  const [deleteOrder] = useDeleteOrderMutation();

  // Fetch orders
  const { data: ordersResponse, isLoading, error, refetch: refetchOrders } = useGetOrdersQuery(
    {
      search: searchTerm,
      status: statusFilter || undefined,
      dateFrom: fromDate || undefined,
      dateTo: toDate || undefined,
      limit: 999999 // Get all orders without pagination
    }
  );

  // Extract orders from response
  const orders = React.useMemo(() => {
    if (!ordersResponse) return [];
    if (ordersResponse?.data?.orders) return ordersResponse.data.orders;
    if (ordersResponse?.orders) return ordersResponse.orders;
    if (ordersResponse?.data?.data?.orders) return ordersResponse.data.data.orders;
    if (Array.isArray(ordersResponse)) return ordersResponse;
    return [];
  }, [ordersResponse]);

  // Fetch company settings
  const { data: companySettingsData } = useGetCompanySettingsQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const companySettings = companySettingsData?.data || {};
  const companyName = companySettings.companyName?.trim() || 'Your Company Name';
  const companyAddress = companySettings.address?.trim() || '';
  const companyPhone = companySettings.contactNumber?.trim() || '';
  const companyEmail = companySettings.email?.trim() || '';

  // Products query for adding items
  const { data: productsResponse } = useGetProductsQuery(
    {
      search: productSearchTerm,
      limit: 50
    },
    {
      skip: !showEditModal && !showProductModal, // Fetch products when edit modal or product modal is open
    }
  );

  // Extract products from response
  const products = React.useMemo(() => {
    if (!productsResponse) return [];
    if (productsResponse?.data?.products) return productsResponse.data.products;
    if (productsResponse?.products) return productsResponse.products;
    if (productsResponse?.data?.data?.products) return productsResponse.data.data.products;
    if (Array.isArray(productsResponse)) return productsResponse;
    return [];
  }, [productsResponse]);

  // Customers query for customer selection
  const { data: customersResponse } = useGetCustomersQuery(
    {
      search: customerSearchTerm,
      limit: 50
    },
    {
      skip: !showEditModal,
      keepPreviousData: true,
    }
  );

  // Extract customers from response
  const customers = React.useMemo(() => {
    if (!customersResponse) return [];
    if (customersResponse?.data?.customers) return customersResponse.data.customers;
    if (customersResponse?.customers) return customersResponse.customers;
    if (customersResponse?.data?.data?.customers) return customersResponse.data.data.customers;
    if (Array.isArray(customersResponse)) return customersResponse;
    return [];
  }, [customersResponse]);

  // Handlers
  const handleDeleteOrder = async (orderId) => {
    try {
      await deleteOrder(orderId).unwrap();
      showSuccessToast('Sales invoice deleted successfully');
      refetchOrders();
    } catch (error) {
      handleApiError(error, 'Sales Invoice Deletion');
    }
  };

  const handleUpdateOrder = async (id, data) => {
    try {
      await updateOrder({ id, ...data }).unwrap();
      showSuccessToast('Sales invoice updated successfully');
      refetchOrders();
    } catch (error) {
      handleApiError(error, 'Sales Invoice Update');
    }
  };

  // Event handlers
  const handleEdit = (order) => {
    // Initialize edit form with order data
    setSelectedOrder(order);

    // Format items for editing (ensure product ID is available)
    const formattedItems = (order.items || []).map(item => ({
      product: item.product?._id || item.product || null,
      productName: item.product?.name || 'Unknown Product',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      total: item.total || (item.quantity * item.unitPrice) || 0
    }));

    // Ensure customer is ID string, not object
    let customerId = null;
    if (order.customer) {
      customerId = typeof order.customer === 'object'
        ? (order.customer._id || order.customer.id || order.customer)
        : order.customer;
    }

    // Format billDate for input (YYYY-MM-DD format)
    const formatDateForInput = (date) => {
      if (!date) return '';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setEditFormData({
      notes: order.notes || '',
      items: formattedItems,
      customer: customerId,
      orderType: order.orderType || 'retail',
      billDate: formatDateForInput(order.billDate || order.createdAt)
    });

    // Reset product selection fields
    setSelectedProduct(null);
    setNewProductQuantity(1);
    setNewProductRate(0);
    setProductSearchTerm('');
    setCustomerSearchTerm(order.customerInfo?.name || '');

    // Open edit modal
    setShowEditModal(true);
  };

  const handlePrint = (order) => {
    setPrintOrderData(order);
    setShowPrintModal(true);
  };

  const handleDelete = (order) => {
    if (window.confirm(`Are you sure you want to delete invoice ${order.orderNumber}?`)) {
      handleDeleteOrder(order._id);
    }
  };

  const handleView = (order) => {
    setSelectedOrder(order);
    setShowViewModal(true);
  };

  const handleAddNewProduct = () => {
    if (!selectedProduct || !newProductRate) {
      showErrorToast('Please select a product and enter a rate');
      return;
    }

    // Check if product is out of stock
    if (selectedProduct.inventory?.currentStock === 0) {
      showErrorToast(`${selectedProduct.name} is out of stock and cannot be added to the invoice.`);
      return;
    }

    // Check if requested quantity exceeds available stock
    if (newProductQuantity > selectedProduct.inventory?.currentStock) {
      showErrorToast(`Cannot add ${newProductQuantity} units.Only ${selectedProduct.inventory?.currentStock} units available in stock.`);
      return;
    }

    const newItem = {
      product: selectedProduct._id, // Store product ID for backend
      productName: selectedProduct.name, // Store name for display
      quantity: newProductQuantity,
      unitPrice: newProductRate,
      total: newProductQuantity * newProductRate
    };

    const updatedItems = [...editFormData.items, newItem];
    setEditFormData({ ...editFormData, items: updatedItems });

    // Reset form
    setSelectedProduct(null);
    setNewProductQuantity(1);
    setNewProductRate(0);
    setProductSearchTerm('');

    showSuccessToast(`${selectedProduct.name} added to invoice`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-danger-600">Failed to load sales invoices</p>
      </div>
    );
  }

  // orders already defined above via useMemo

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden px-2 sm:px-0">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sales Invoices</h1>
          <p className="text-sm sm:text-base text-gray-600">View and manage sales invoices</p>
        </div>

        {/* Date Filter using DateFilter component */}
        <div className="w-full sm:w-auto">
          <DateFilter
            startDate={fromDate}
            endDate={toDate}
            onDateChange={handleDateChange}
            compact={true}
            showPresets={true}
            className="w-full"
          />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3 sm:space-y-4">
        {/* Search and Status Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number, customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full text-sm sm:text-base"
            />
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto sm:min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-full text-sm sm:text-base"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="text-center py-12 px-4">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter ? 'Try adjusting your search terms.' : 'No orders have been placed yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Desktop Table Header */}
          <div className="hidden lg:block bg-gray-50 border-b border-gray-200">
            <div className="px-4 xl:px-6 py-3">
              <div className="grid grid-cols-12 gap-3 xl:gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="col-span-2">Order Number</div>
                <div className="col-span-2">Customer</div>
                <div className="col-span-1">Date</div>
                <div className="col-span-1">Items</div>
                <div className="col-span-1">Total</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Type</div>
                <div className="col-span-1">Notes</div>
                <div className="col-span-1 min-w-[100px]">Actions</div>
              </div>
            </div>
          </div>

          {/* Mobile Header */}
          <div className="lg:hidden bg-gray-50 border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-700">Sales Invoices ({orders.length})</h3>
          </div>

          {/* Table Body / Cards */}
          <div className="divide-y divide-gray-200">
            {orders.map((order) => (
              <div key={order._id}>
                {/* Desktop Table Row */}
                <div className="hidden lg:block px-4 xl:px-6 py-3 xl:py-4 hover:bg-gray-50 transition-colors">
                  <div className="grid grid-cols-12 gap-3 xl:gap-4 items-center">
                    {/* Order Number */}
                    <div className="col-span-2 min-w-0">
                      <div className="font-medium text-gray-900 truncate text-sm">
                        #{order.orderNumber}
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="col-span-2 min-w-0">
                      <div className="text-sm text-gray-900 truncate">
                        {order.customerInfo?.name || 'Walk-in Customer'}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="col-span-1">
                      <span className="text-xs xl:text-sm text-gray-600">
                        {order.billDate ? new Date(order.billDate).toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="col-span-1">
                      <span className="text-xs xl:text-sm text-gray-600">
                        {order.items.length}
                      </span>
                    </div>

                    {/* Total */}
                    <div className="col-span-1">
                      <span className="font-semibold text-gray-900 text-sm xl:text-base">
                        {Math.round(order.pricing.total)}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <div className="flex flex-wrap gap-1">
                        <span className={`inline - flex px - 2 py - 1 text - xs font - medium rounded - full ${order.status === 'completed' || order.status === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'pending' || order.status === 'processing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : order.status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                          } `}>
                          {order.status}
                        </span>
                        <span className={`inline - flex px - 2 py - 1 text - xs font - medium rounded - full ${order.payment.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : order.payment.status === 'partial'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          } `}>
                          {order.payment.status}
                        </span>
                      </div>
                    </div>

                    {/* Type */}
                    <div className="col-span-1">
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                        {order.orderType}
                      </span>
                    </div>

                    {/* Notes */}
                    <div className="col-span-1 min-w-0">
                      <span
                        className="text-xs text-gray-600 block truncate"
                        title={order.notes?.trim() || 'No notes'}
                      >
                        {order.notes?.trim() || '—'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 min-w-0">
                      <div className="flex items-center space-x-1 flex-wrap gap-1">
                        <button
                          onClick={() => handleView(order)}
                          className="text-primary-600 hover:text-primary-800 p-1 flex-shrink-0"
                          title="View Invoice"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handlePrint(order)}
                          className="text-green-600 hover:text-green-800 p-1 flex-shrink-0"
                          title="Print Invoice"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(order)}
                          className="text-blue-600 hover:text-blue-800 p-1 flex-shrink-0"
                          title="Edit Invoice"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(order)}
                          className="text-red-600 hover:text-red-800 p-1 flex-shrink-0"
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="lg:hidden px-4 py-4 hover:bg-gray-50 transition-colors">
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          #{order.orderNumber}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1 truncate">
                          {order.customerInfo?.name || 'Walk-in Customer'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-semibold text-gray-900">
                          {Math.round(order.pricing.total)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Date</p>
                        <p className="text-sm font-medium text-gray-900">
                          {order.billDate ? new Date(order.billDate).toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Type</p>
                        <span className="inline-flex text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                          {order.orderType}
                        </span>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline - flex px - 2 py - 1 text - xs font - medium rounded - full ${order.status === 'completed' || order.status === 'delivered'
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'pending' || order.status === 'processing'
                            ? 'bg-yellow-100 text-yellow-800'
                            : order.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                        } `}>
                        {order.status}
                      </span>
                      <span className={`inline - flex px - 2 py - 1 text - xs font - medium rounded - full ${order.payment.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : order.payment.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        } `}>
                        {order.payment.status}
                      </span>
                    </div>

                    {/* Notes */}
                    {order.notes?.trim() && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Notes</p>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {order.notes.trim()}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex items-center flex-wrap gap-2 justify-start">
                        <button
                          onClick={() => handleView(order)}
                          className="text-primary-600 hover:text-primary-800 p-2 rounded hover:bg-primary-50 transition-colors flex-shrink-0"
                          title="View Invoice"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handlePrint(order)}
                          className="text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50 transition-colors flex-shrink-0"
                          title="Print Invoice"
                        >
                          <Printer className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(order)}
                          className="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition-colors flex-shrink-0"
                          title="Edit Invoice"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(order)}
                          className="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Sales Invoice Details</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePrint(selectedOrder)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Invoice Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{companyName}</h1>
                {companyAddress && (
                  <p className="text-sm text-gray-600">{companyAddress}</p>
                )}
                {(companyPhone || companyEmail) && (
                  <p className="text-sm text-gray-600">
                    {[companyPhone && `Phone: ${companyPhone} `, companyEmail && `Email: ${companyEmail} `]
                      .filter(Boolean)
                      .join(' | ')}
                  </p>
                )}
                <p className="text-lg text-gray-600">Sales Invoice</p>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-3 gap-8 mb-8">
                {/* Customer Information */}
                <div>
                  <h3 className="font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">Bill To:</h3>
                  <div className="space-y-1">
                    <p className="font-medium">{selectedOrder.customerInfo?.name || 'Walk-in Customer'}</p>
                    <p className="text-gray-600">{selectedOrder.customerInfo?.email || ''}</p>
                    <p className="text-gray-600">{selectedOrder.customerInfo?.phone || ''}</p>
                    <p className="text-gray-600">{selectedOrder.customerInfo?.address || ''}</p>
                    {selectedOrder.customerInfo?.pendingBalance && (
                      <p className="font-medium text-gray-900 mt-2">
                        Pending Balance: {Math.round(selectedOrder.customerInfo.pendingBalance)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Invoice Information */}
                <div className="text-right">
                  <h3 className="font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">Invoice Details:</h3>
                  <div className="space-y-1">
                    <p><span className="font-medium">Invoice #:</span> {selectedOrder.orderNumber}</p>
                    <p><span className="font-medium">Date:</span> {selectedOrder.billDate ? new Date(selectedOrder.billDate).toLocaleDateString() : new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                    {selectedOrder.billDate && new Date(selectedOrder.billDate).getTime() !== new Date(selectedOrder.createdAt).getTime() && (
                      <p className="text-xs text-gray-500">(Original: {new Date(selectedOrder.createdAt).toLocaleDateString()})</p>
                    )}
                    <p><span className="font-medium">Status:</span> {selectedOrder.status}</p>
                    <p><span className="font-medium">Type:</span> {selectedOrder.orderType}</p>
                  </div>
                </div>

                {/* Payment Information */}
                <div className="text-right">
                  <h3 className="font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">Payment:</h3>
                  <div className="space-y-1">
                    <p><span className="font-medium">Status:</span> {selectedOrder.payment?.status}</p>
                    <p><span className="font-medium">Method:</span> {selectedOrder.payment?.method}</p>
                    <p><span className="font-medium">Amount:</span> {Math.round(selectedOrder.pricing?.total || 0)}</p>
                  </div>
                </div>
              </div>

              {/* CCTV Camera Time Section */}
              {(selectedOrder.billStartTime || selectedOrder.billEndTime) && (
                <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-gray-900 border-b border-blue-300 pb-2 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Camera Time
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.billStartTime && (
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">From:</span>{' '}
                        <span className="text-gray-900">
                          {new Date(selectedOrder.billStartTime).toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          })}
                        </span>
                      </p>
                    )}
                    {selectedOrder.billEndTime && (
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">To:</span>{' '}
                        <span className="text-gray-900">
                          {new Date(selectedOrder.billEndTime).toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          })}
                        </span>
                      </p>
                    )}
                    {selectedOrder.billStartTime && selectedOrder.billEndTime && (
                      <p className="text-xs text-gray-600 mt-2">
                        Duration: {Math.round((new Date(selectedOrder.billEndTime) - new Date(selectedOrder.billStartTime)) / 1000)} seconds
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">Items:</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left">Item</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Qty</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Price</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item, index) => (
                        <tr key={index}>
                          <td className="border border-gray-300 px-4 py-2">{item.product?.name || 'Unknown Product'}</td>
                          <td className="border border-gray-300 px-4 py-2">{item.product?.description || ''}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{item.quantity}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{Math.round(item.unitPrice)}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{Math.round(item.total)}</td>
                        </tr>
                      )) || (
                          <tr>
                            <td colSpan="5" className="border border-gray-300 px-4 py-2 text-center text-gray-500">
                              No items found
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-80">
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <td className="px-4 py-2">Subtotal:</td>
                        <td className="px-4 py-2 text-right">{Math.round(selectedOrder.pricing?.subtotal || 0)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Tax:</td>
                        <td className="px-4 py-2 text-right">{Math.round(selectedOrder.pricing?.taxAmount || 0)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Discount:</td>
                        <td className="px-4 py-2 text-right">{Math.round(selectedOrder.pricing?.discountAmount || 0)}</td>
                      </tr>
                      <tr className="border-t-2 border-gray-900">
                        <td className="px-4 py-2 font-bold">Total:</td>
                        <td className="px-4 py-2 text-right font-bold">{Math.round(selectedOrder.pricing?.total || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 text-center text-sm text-gray-500">
                Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Edit Sales Invoice</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setCustomerSearchTerm('');
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>

              {/* Customer Information */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Selection</label>
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {/* Customer Suggestions */}
                    {customerSearchTerm && customers?.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                        {customers.slice(0, 5).map((customer) => {
                          // Get city from addresses
                          const defaultAddress = customer.addresses?.find(addr => addr.isDefault) || customer.addresses?.[0];
                          const city = defaultAddress?.city || '';

                          return (
                            <div
                              key={customer._id}
                              onClick={() => {
                                setEditFormData({ ...editFormData, customer: customer._id });
                                setCustomerSearchTerm(customer.displayName);
                              }}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <div className="font-medium">{customer.displayName}</div>
                                <div className="text-sm text-gray-600">{customer.email}</div>
                              </div>
                              {city && (
                                <div className="text-xs text-gray-500 ml-2">{city}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Selected Customer Display */}
                    {editFormData.customer && (
                      <div className="mt-2 p-2 bg-blue-50 rounded border">
                        <div className="text-sm font-medium text-blue-900">
                          Selected: {selectedOrder.customerInfo?.name || 'Customer'}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditFormData({ ...editFormData, customer: null });
                            setCustomerSearchTerm('');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          Clear selection
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order Type</label>
                    <select
                      value={editFormData.orderType}
                      onChange={(e) => setEditFormData({ ...editFormData, orderType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="return">Return</option>
                      <option value="exchange">Exchange</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <p className="text-gray-900">{selectedOrder.customerInfo?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <p className="text-gray-900">{selectedOrder.customerInfo?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                    <p className="text-gray-900">{selectedOrder.orderNumber}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bill Date <span className="text-xs text-gray-500">(for backdating/postdating)</span>
                    </label>
                    <input
                      type="date"
                      value={editFormData.billDate}
                      onChange={(e) => setEditFormData({ ...editFormData, billDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Original date: {new Date(selectedOrder.createdAt).toLocaleDateString()}
                    </p>
                    {selectedOrder.billStartTime && editFormData.billDate &&
                      new Date(editFormData.billDate).toDateString() !== new Date(selectedOrder.billStartTime).toDateString() && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-xs text-yellow-800">
                            <strong>⚠ CCTV Note:</strong> Changing the bill date will not change CCTV recording timestamps.
                            CCTV footage is available at the actual recording time ({new Date(selectedOrder.billStartTime).toLocaleString()}),
                            not the bill date.
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* Edit Form */}
              <form onSubmit={(e) => {
                e.preventDefault();
                // Format items for backend - ensure product is ID, not object
                const formattedItems = editFormData.items.map(item => ({
                  product: item.product?._id || item.product, // Extract ID if object, otherwise use as-is
                  quantity: item.quantity,
                  unitPrice: item.unitPrice
                }));

                // Ensure customer is ID string, not object
                let customerId = null;
                if (editFormData.customer) {
                  customerId = typeof editFormData.customer === 'object'
                    ? (editFormData.customer._id || editFormData.customer.id || editFormData.customer)
                    : editFormData.customer;
                }

                const updateData = {
                  notes: editFormData.notes,
                  items: formattedItems,
                  orderType: editFormData.orderType,
                  customer: customerId || undefined, // Only include if not null
                  billDate: editFormData.billDate || undefined // Include billDate for backdating/postdating
                };

                handleUpdateOrder(selectedOrder._id, updateData);
                setShowEditModal(false);
              }}>

                {/* Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any notes or comments..."
                  />
                </div>

                {/* Items Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Items</h3>

                  {/* Product Selection Bar */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Add New Product</h4>

                    {/* Product Search and Input Fields Row */}
                    <div className="grid grid-cols-12 gap-4 items-end">
                      {/* Product Search - 6 columns */}
                      <div className="col-span-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Product Search
                        </label>
                        <input
                          type="text"
                          placeholder="Search or type product name..."
                          value={productSearchTerm}
                          onChange={(e) => setProductSearchTerm(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {/* Product Suggestions */}
                        {productSearchTerm && products?.length > 0 && (
                          <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg">
                            {products.slice(0, 5).map((product) => (
                              <div
                                key={product._id}
                                onClick={() => {
                                  setProductSearchTerm(product.name);
                                  setSelectedProduct(product);
                                  // Auto-fill rate with retail price when product is selected
                                  const defaultRate = product.pricing?.retail || 0;
                                  setNewProductRate(defaultRate);
                                }}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{product.name}</div>
                                <div className="text-sm text-gray-600">
                                  Stock: {product.inventory?.currentStock || 0} |
                                  Retail: {Math.round(product.pricing?.retail || 0)} |
                                  Wholesale: {Math.round(product.pricing?.wholesale || 0)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {productSearchTerm && products?.length === 0 && (
                          <div className="mt-2 p-2 text-sm text-gray-500 text-center">
                            No products found matching "{productSearchTerm}"
                          </div>
                        )}
                        {/* Show selected product info */}
                        {selectedProduct && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border">
                            <div className="text-sm font-medium text-blue-900">
                              Selected: {selectedProduct.name}
                            </div>
                            <div className="text-xs text-blue-700 mt-1">
                              Stock: {selectedProduct.inventory?.currentStock || 0} |
                              Retail: {Math.round(selectedProduct.pricing?.retail || 0)} |
                              Wholesale: {Math.round(selectedProduct.pricing?.wholesale || 0)}
                            </div>
                            {newProductRate === 0 && (
                              <div className="text-xs text-orange-600 mt-1">
                                ⚠ Rate is 0 - please enter a rate or select a product again
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Stock - 1 column */}
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Stock
                        </label>
                        <input
                          type="text"
                          value={selectedProduct ? selectedProduct.inventory?.currentStock || 0 : '0'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-center bg-gray-50"
                          disabled
                          placeholder="0"
                        />
                      </div>

                      {/* Quantity - 1 column */}
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={selectedProduct?.inventory?.currentStock || 1}
                          value={newProductQuantity}
                          onChange={(e) => setNewProductQuantity(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-center"
                          placeholder="1"
                        />
                      </div>

                      {/* Rate - 2 columns */}
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Rate
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={newProductRate}
                          onChange={(e) => setNewProductRate(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-center"
                          placeholder="0"
                        />
                      </div>

                      {/* Amount - 1 column */}
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amount
                        </label>
                        <input
                          type="text"
                          value={selectedProduct ? Math.round(newProductQuantity * newProductRate) : ''}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-center font-medium bg-gray-50"
                          disabled
                          placeholder=""
                        />
                      </div>

                      {/* Add Button - 1 column */}
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          &nbsp;
                        </label>
                        <button
                          type="button"
                          onClick={handleAddNewProduct}
                          className="w-full bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center"
                          disabled={!selectedProduct || !newProductRate}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Item</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Qty</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Unit Price</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editFormData.items?.map((item, index) => (
                          <tr key={index}>
                            <td className="border border-gray-300 px-4 py-2">
                              {item.productName || item.product?.name || 'Unknown Product'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...editFormData.items];
                                  newItems[index].quantity = parseInt(e.target.value) || 1;
                                  newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                              />
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => {
                                  const newItems = [...editFormData.items];
                                  newItems[index].unitPrice = parseFloat(e.target.value) || 0;
                                  newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                              />
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {Math.round(item.total)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const newItems = editFormData.items.filter((_, i) => i !== index);
                                  setEditFormData({ ...editFormData, items: newItems });
                                }}
                                className="text-red-600 hover:text-red-800"
                                title="Remove Item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        )) || (
                            <tr>
                              <td colSpan="5" className="border border-gray-300 px-4 py-2 text-center text-gray-500">
                                No items found
                              </td>
                            </tr>
                          )}
                      </tbody>
                    </table>
                  </div>

                  {/* Order Summary */}
                  {editFormData.items && editFormData.items.length > 0 && (
                    <div className="mt-4 flex justify-end">
                      <div className="w-80">
                        <table className="w-full">
                          <tbody>
                            <tr>
                              <td className="px-4 py-2">Subtotal:</td>
                              <td className="px-4 py-2 text-right">
                                {Math.round(editFormData.items.reduce((sum, item) => sum + item.total, 0))}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-4 py-2">Tax:</td>
                              <td className="px-4 py-2 text-right">
                                {Math.round(selectedOrder.pricing?.taxAmount || 0)}
                              </td>
                            </tr>
                            <tr>
                              <td className="px-4 py-2">Discount:</td>
                              <td className="px-4 py-2 text-right">
                                {Math.round(selectedOrder.pricing?.discountAmount || 0)}
                              </td>
                            </tr>
                            <tr className="border-t-2 border-gray-900">
                              <td className="px-4 py-2 font-bold">Total:</td>
                              <td className="px-4 py-2 text-right font-bold">
                                {Math.round(editFormData.items.reduce((sum, item) => sum + item.total, 0) + (selectedOrder.pricing?.taxAmount || 0) - (selectedOrder.pricing?.discountAmount || 0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={false}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Update Invoice
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Product Selection Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Select Product</h2>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>

              {/* Search */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Products List */}
              <div className="max-h-96 overflow-y-auto">
                {productsData?.products?.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {productsData.products.map((product) => (
                      <div key={product._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{product.name}</h3>
                            <p className="text-sm text-gray-600">{product.description}</p>
                            <div className="mt-2 flex space-x-4 text-sm text-gray-500">
                              <span>Stock: {product.inventory?.currentStock || 0}</span>
                              <span>Retail: {Math.round(product.pricing?.retail || 0)}</span>
                              <span>Wholesale: {Math.round(product.pricing?.wholesale || 0)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              // Add product to cart
                              const newItem = {
                                product: product._id, // Store product ID for backend
                                productName: product.name, // Store name for display
                                quantity: 1,
                                unitPrice: product.pricing?.retail || 0,
                                total: product.pricing?.retail || 0
                              };

                              const updatedItems = [...editFormData.items, newItem];
                              setEditFormData({ ...editFormData, items: updatedItems });
                              setShowProductModal(false);
                              showSuccessToast('Product added to invoice');
                            }}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                          >
                            Add to Invoice
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {productSearchTerm ? 'No products found matching your search.' : 'No products available.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      <PrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setPrintOrderData(null);
        }}
        orderData={printOrderData}
        documentTitle="Sales Invoice"
        partyLabel="Customer"
      />
    </div>
  );
};
