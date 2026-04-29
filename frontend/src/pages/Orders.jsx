import React, { useState, useEffect } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
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
  Printer,
  BookOpen
} from 'lucide-react';
import {
  useGetOrdersQuery,
  useLazyGetOrderByIdQuery,
  useDeleteOrderMutation,
  usePostMissingSalesToLedgerMutation,
} from '../store/services/salesApi';
import { useGetCompanySettingsQuery } from '../store/services/settingsApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../components/ComponentRegistry';
import DateFilter from '../components/DateFilter';
import PrintModal from '../components/PrintModal';
import BaseModal from '../components/BaseModal';
import { Button } from '@/components/ui/button';
import { formatDateForInput, getCurrentDatePakistan, getLocalDateString } from '../utils/dateUtils';
import ExcelExportButton from '../components/ExcelExportButton';
import PdfExportButton from '../components/PdfExportButton';
import { getInvoicePdfPayload } from '../utils/invoicePdfUtils';
import PaginationControls from '../components/PaginationControls';
import { useCursorPagination } from '../hooks/useCursorPagination';

const INVOICE_PAGE_SIZE = 50;

// Safe date display: avoid "Invalid Date" when value is missing or invalid (PostgreSQL may send sale_date, created_at)
const formatOrderDate = (order) => {
  const raw = order?.sale_date ?? order?.billDate ?? order?.order_date ?? order?.created_at ?? order?.createdAt;
  if (raw == null) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

// Check if order/invoice is within last 1 month (edit allowed only for invoices from past 30 days)
const canEditInvoice = (order) => {
  const raw = order?.sale_date ?? order?.billDate ?? order?.order_date ?? order?.created_at ?? order?.createdAt;
  if (raw == null) return false;
  const invoiceDate = new Date(raw);
  if (Number.isNaN(invoiceDate.getTime())) return false;
  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
  oneMonthAgo.setHours(0, 0, 0, 0);
  invoiceDate.setHours(0, 0, 0, 0);
  return invoiceDate >= oneMonthAgo && invoiceDate <= now;
};

// Check if order/invoice is within last 2 weeks (delete allowed only for invoices from past 14 days)
const canDeleteInvoice = (order) => {
  const raw = order?.sale_date ?? order?.billDate ?? order?.order_date ?? order?.created_at ?? order?.createdAt;
  if (raw == null) return false;
  const invoiceDate = new Date(raw);
  if (Number.isNaN(invoiceDate.getTime())) return false;
  const now = new Date();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  twoWeeksAgo.setHours(0, 0, 0, 0);
  invoiceDate.setHours(0, 0, 0, 0);
  return invoiceDate >= twoWeeksAgo && invoiceDate <= now;
};

const getDerivedPaymentStatus = (order) => {
  const total = Number(order?.pricing?.total ?? order?.total ?? 0) || 0;
  const paid = Number(
    order?.payment?.amountPaid ??
    order?.payment?.amountReceived ??
    order?.amount_paid ??
    order?.amountPaid ??
    order?.amount_received ??
    order?.amountReceived ??
    0
  ) || 0;

  if (total <= 0) return order?.payment?.status ?? order?.payment_status ?? order?.paymentStatus ?? 'pending';
  if (paid <= 0) return 'pending';
  if (paid + 0.01 >= total) return 'paid';
  return 'partial';
};

const OrderCard = ({ order, onView, onEdit, onPrint }) => {
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
              Order #{order.order_number ?? order.orderNumber ?? '—'}
            </h3>
            <p className="text-sm text-gray-600">
              {order.customer?.business_name ?? order.customer?.businessName ?? order.customer?.name ?? order.customerInfo?.businessName ?? order.customerInfo?.business_name ?? order.customerInfo?.name ?? 'Walk-in Customer'}
            </p>
            <p className="text-sm text-gray-600">
              {formatOrderDate(order)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900">
              {Math.round(order.pricing?.total ?? order.total ?? 0)}
            </p>
            <p className="text-sm text-gray-600">
              {order.lineItemCount ?? order.items?.length ?? 0} item{(order.lineItemCount ?? order.items?.length ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`badge ${getStatusColor(order?.status ?? '')}`}>
              {order?.status ?? '—'}
            </span>
            <span className={`badge ${getPaymentStatusColor(getDerivedPaymentStatus(order))}`}>
              {getDerivedPaymentStatus(order)}
            </span>
            <span className="badge badge-info">
              {order.orderType}
            </span>
          </div>
          <div className="flex items-center flex-nowrap gap-1">
            <button
              onClick={() => onView(order)}
              className="shrink-0 text-primary-600 hover:text-primary-800"
              title="View Invoice"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPrint(order)}
              className="shrink-0 text-green-600 hover:text-green-800"
              title="Print Invoice"
            >
              <Printer className="h-4 w-4" />
            </button>
            {canEditInvoice(order) && (
              <button
                onClick={() => onEdit(order)}
                className="shrink-0 text-blue-600 hover:text-blue-800"
                title="Edit Invoice"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Orders = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState('');
  const today = getLocalDateString();
  const [fromDate, setFromDate] = useState(today); // Today
  const [toDate, setToDate] = useState(today); // Today
  const {
    currentPage: invoicePage,
    currentCursor,
    updateFromPagination,
    getUiPagination,
    goToPage,
  } = useCursorPagination([debouncedSearch, statusFilter, fromDate, toDate]);

  // Handle date change from DateFilter component
  const handleDateChange = (newStartDate, newEndDate) => {
    setFromDate(newStartDate || '');
    setToDate(newEndDate || '');
  };

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const { openTab } = useTab();
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrderData, setPrintOrderData] = useState(null);

  // Mutations
  const [deleteOrder] = useDeleteOrderMutation();
  const [postMissingSalesToLedger, { isLoading: isPostingToLedger }] = usePostMissingSalesToLedgerMutation();
  const [fetchOrderById] = useLazyGetOrderByIdQuery();

  // Fetch orders
  const { data: ordersResponse, isLoading, error, refetch: refetchOrders } = useGetOrdersQuery(
    {
      search: debouncedSearch,
      status: statusFilter || undefined,
      dateFrom: fromDate || undefined,
      dateTo: toDate || undefined,
      page: invoicePage,
      cursor: currentCursor,
      limit: INVOICE_PAGE_SIZE
    },
    { refetchOnMountOrArgChange: 120 }
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

  const ordersPagination = ordersResponse?.data?.pagination ?? ordersResponse?.pagination ?? {};
  const uiPagination = React.useMemo(
    () => getUiPagination(ordersPagination, INVOICE_PAGE_SIZE),
    [getUiPagination, ordersPagination]
  );
  const invoiceRowOffset = (invoicePage - 1) * INVOICE_PAGE_SIZE;

  useEffect(() => {
    updateFromPagination(ordersPagination);
  }, [ordersPagination, updateFromPagination]);

  // Fetch company settings
  const { data: companySettingsData } = useGetCompanySettingsQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const companySettings = companySettingsData?.data || {};
  const taxSystemEnabled = companySettings.taxEnabled === true;
  const companyName = companySettings.companyName?.trim() || 'Your Company Name';
  const companyAddress = companySettings.address?.trim() || '';
  const companyPhone = companySettings.contactNumber?.trim() || '';
  const companyEmail = companySettings.email?.trim() || '';

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

  // Event handlers - Edit opens Sales page in new tab (same as Purchase Invoice edit)
  const handleEdit = async (order) => {
    try {
      // Use the list row's derived payment status (this is already correct in the UI)
      // because the "fetch by id" response can contain mismatched payment fields.
      const derivedPaymentStatus = getDerivedPaymentStatus(order);

      const result = await fetchOrderById(order._id || order.id).unwrap();
      const orderData = result?.order || result?.data?.order || result;
      const freshOrder = orderData || order;

      const isPendingInEditor = derivedPaymentStatus === 'pending';
      const paymentFromFetched = freshOrder.payment || {};
      const paymentFromList = order.payment || {};

      const amountPaidCandidate =
        paymentFromFetched?.amountPaid ??
        paymentFromFetched?.amountReceived ??
        paymentFromList?.amountPaid ??
        paymentFromList?.amountReceived ??
        0;

      const paymentForEditor = {
        ...paymentFromFetched,
        ...paymentFromList,
        status: isPendingInEditor ? 'pending' : (paymentFromFetched?.status ?? paymentFromFetched?.payment_status ?? paymentFromList?.status ?? paymentFromList?.payment_status ?? ''),
        amountPaid: isPendingInEditor ? 0 : Number(amountPaidCandidate) || 0,
        amountReceived: isPendingInEditor ? 0 : Number(amountPaidCandidate) || 0,
      };

      const editData = {
        orderId: freshOrder._id || freshOrder.id,
        isEditMode: true,
        customer: freshOrder.customer || freshOrder.customerInfo,
        orderNumber: freshOrder.order_number ?? freshOrder.orderNumber,
        notes: freshOrder.notes || '',
        items: (freshOrder.items || []).map(item => {
          // Preserve full product object (with name) for cart display; API returns product: { _id, name } from enrichItemsWithProductNames
          const productObj = item.product && typeof item.product === 'object';
          const rawId = productObj
            ? (item.product._id || item.product.id)
            : (item.product_id || item.product);
          const isManualLine =
            item.isManual === true ||
            item.is_manual === true ||
            (typeof rawId === 'string' && rawId.startsWith('manual_'));
          const lineUnitCost = Number(item.unitCost ?? item.unit_cost ?? 0) || 0;
          const product = productObj
            ? {
              _id: item.product._id || item.product.id,
              name: item.product.name || item.product.displayName || item.product.variantName || 'Product',
              isVariant: item.product.isVariant,
              isManual: isManualLine || item.product.isManual === true,
              displayName: item.product.displayName,
              variantName: item.product.variantName,
              inventory: item.product.inventory || { currentStock: 0, reorderPoint: 0 },
              pricing: {
                ...(item.product.pricing || {}),
                ...(isManualLine ? { cost: lineUnitCost } : {})
              },
              ...(item.product.imageUrl || item.imageUrl ? { imageUrl: item.product.imageUrl || item.imageUrl } : {})
            }
            : {
              _id: rawId,
              name: item.name || item.productName || 'Unknown Product',
              isManual: isManualLine,
              inventory: { currentStock: 999999, reorderPoint: 0 },
              pricing: { cost: isManualLine ? lineUnitCost : 0 },
              ...(item.imageUrl ? { imageUrl: item.imageUrl } : {})
            };
          return {
            product,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice ?? item.unit_price ?? 0,
            totalPrice: item.total ?? (item.quantity * (item.unitPrice ?? item.unit_price ?? 0))
          };
        }),
        payment: paymentForEditor,
        // The "Pending" label in the UI is based on the invoice/order status (not payment.status).
        // Pass it through so the edit screen can correctly initialize Amount Paid.
        orderStatus: freshOrder.status ?? freshOrder.order_status ?? freshOrder.orderStatus ?? '',
        paymentStatus: freshOrder.payment?.status ?? freshOrder.payment_status ?? freshOrder.paymentStatus ?? '',
        orderType: freshOrder.orderType ?? freshOrder.order_type ?? 'retail',
        billDate: freshOrder.sale_date ?? freshOrder.billDate ?? freshOrder.order_date ?? freshOrder.created_at ?? freshOrder.createdAt,
        // Pass discount fields explicitly so Sales edit can hydrate manual/code discounts.
        discountAmount:
          freshOrder.discountAmount ??
          freshOrder.discount ??
          freshOrder.pricing?.discountAmount ??
          freshOrder.pricing?.discount ??
          0,
        discount:
          freshOrder.discount ??
          freshOrder.discountAmount ??
          freshOrder.pricing?.discountAmount ??
          freshOrder.pricing?.discount ??
          0,
        appliedDiscounts:
          freshOrder.appliedDiscounts ??
          freshOrder.applied_discounts ??
          freshOrder.pricing?.appliedDiscounts ??
          [],
        pricing: {
          ...(freshOrder.pricing || {}),
          discountAmount:
            freshOrder.pricing?.discountAmount ??
            freshOrder.discountAmount ??
            freshOrder.discount ??
            freshOrder.pricing?.discount ??
            0
        }
      };

      const componentInfo = getComponentInfo('/sales');
      if (componentInfo) {
        const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        openTab({
          title: `Edit Sale - ${editData.orderNumber || freshOrder._id || freshOrder.id}`,
          path: '/sales',
          component: componentInfo.component,
          icon: componentInfo.icon,
          allowMultiple: true,
          props: { tabId: newTabId, editData }
        });
        showSuccessToast(`Opening invoice for editing...`);
      } else {
        showErrorToast('Sales page not found');
      }
    } catch (err) {
      handleApiError(err, 'Loading invoice for edit');
    }
  };

  const handlePrint = async (order) => {
    try {
      // Same payment normalization as handleEdit: fetch-by-id can disagree with list row on payment fields.
      const derivedPaymentStatus = getDerivedPaymentStatus(order);
      const result = await fetchOrderById(order._id || order.id).unwrap();
      const orderData = result?.order || result?.data?.order || result;
      const freshOrder = orderData || order;

      const isPendingInEditor = derivedPaymentStatus === 'pending';
      const paymentFromFetched = freshOrder.payment || {};
      const paymentFromList = order.payment || {};

      const amountPaidCandidate =
        paymentFromFetched?.amountPaid ??
        paymentFromFetched?.amountReceived ??
        paymentFromList?.amountPaid ??
        paymentFromList?.amountReceived ??
        freshOrder.amount_paid ??
        order.amount_paid ??
        0;

      const paymentForPrint = {
        ...paymentFromFetched,
        ...paymentFromList,
        status: isPendingInEditor ? 'pending' : (paymentFromFetched?.status ?? paymentFromFetched?.payment_status ?? paymentFromList?.status ?? paymentFromList?.payment_status ?? ''),
        amountPaid: isPendingInEditor ? 0 : Number(amountPaidCandidate) || 0,
        amountReceived: isPendingInEditor ? 0 : Number(amountPaidCandidate) || 0,
      };

      const mergedPrintData = {
        ...freshOrder,
        payment: paymentForPrint,
        amount_paid: isPendingInEditor ? 0 : Number(amountPaidCandidate) || 0,
        payment_status: isPendingInEditor ? 'pending' : (freshOrder.payment_status ?? freshOrder.paymentStatus ?? paymentForPrint.status),
      };

      setPrintOrderData(mergedPrintData);
      setShowPrintModal(true);
    } catch (err) {
      handleApiError(err, 'Loading invoice for print');
      setPrintOrderData(order);
      setShowPrintModal(true);
    }
  };

  const handleDelete = (order) => {
    if (window.confirm(`Are you sure you want to delete invoice ${order.order_number ?? order.orderNumber ?? order.id ?? 'this'}?`)) {
      handleDeleteOrder(order._id);
    }
  };

  const handleView = (order) => {
    setSelectedOrder(order);
    setShowViewModal(true);
  };

  const handlePostMissingToLedger = async () => {
    if (!window.confirm('Post all sales invoices that are not yet in the account ledger? This will add AR, Revenue, and COGS/Inventory entries for each missing sale.')) return;
    try {
      const result = await postMissingSalesToLedger({}).unwrap();
      const posted = Number(result?.posted) || 0;
      const errList = Array.isArray(result?.errors) ? result.errors : [];
      const msg = result?.message
        || (posted > 0
          ? `Posted ${posted} sale(s) to the ledger.${errList.length ? ` ${errList.length} failed.` : ''}`
          : errList.length
            ? `No new sales posted. ${errList.length} failed.`
            : 'All sales were already in the ledger.');
      showSuccessToast(msg);
      refetchOrders();
    } catch (error) {
      handleApiError(error, 'Post to ledger');
    }
  };

  const getExportData = () => {
    return {
      title: 'Sales Invoices Report',
      filename: `Sales_Invoices_${fromDate}_to_${toDate}.xlsx`,
      company: {
        name: companySettings.companyName || 'ZARYAB IMPEX',
        address: companySettings.address || companySettings.billingAddress || '',
        contact: `${companySettings.contactNumber || ''} ${companySettings.email ? '| ' + companySettings.email : ''}`.trim()
      },
      columns: [
        { header: 'S.No', key: 'sno', width: 8, type: 'number' },
        { header: 'Image', key: 'imageUrl', width: 12, type: 'image' },
        { header: 'Invoice #', key: 'orderNumber', width: 15 },
        { header: 'Customer', key: 'customerName', width: 35 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Items', key: 'itemsCount', width: 10, type: 'number' },
        { header: 'Total', key: 'total', width: 20, type: 'currency' },
        { header: 'Payment', key: 'paymentStatus', width: 15 },
        { header: 'Type', key: 'orderType', width: 15 },
        { header: 'Notes', key: 'notes', width: 40 }
      ],
      data: orders.map((order, i) => ({
        sno: i + 1,
        imageUrl: order.items?.[0]?.product?.imageUrl ?? order.items?.[0]?.productData?.imageUrl ?? null,
        orderNumber: order.order_number ?? order.orderNumber ?? '—',
        customerName: order.customer?.businessName ?? order.customer?.business_name ?? order.customer?.displayName ?? order.customer?.name ?? order.customerInfo?.businessName ?? order.customerInfo?.business_name ?? order.customerInfo?.name ?? 'Walk-in Customer',
        date: formatOrderDate(order),
        itemsCount: order.lineItemCount ?? order.items?.length ?? 0,
        total: Number(order.pricing?.total ?? order.total ?? 0),
        paymentStatus: getDerivedPaymentStatus(order).toUpperCase(),
        orderType: (order.orderType ?? order.order_type ?? '—').toUpperCase(),
        notes: order.notes?.trim() || ''
      })),
      summary: {
        rows: [
          {
            label: 'GRAND TOTAL:',
            orderNumber: `${orders.length} Invoices`,
            total: orders.reduce((sum, o) => sum + Number(o.pricing?.total ?? o.total ?? 0), 0)
          }
        ]
      }
    };
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

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden px-2 sm:px-0">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sales Invoices</h1>
          <p className="text-sm sm:text-base text-gray-600">View and manage sales invoices</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePostMissingToLedger}
            disabled={isPostingToLedger}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Post any past sales/invoices that were never recorded to the account ledger"
          >
            <BookOpen className="h-4 w-4" />
            {isPostingToLedger ? 'Posting…' : 'Post missing to ledger'}
          </button>
          <ExcelExportButton
            getData={getExportData}
            label="Export"
          />
          <PdfExportButton
            getData={getExportData}
            label="PDF"
          />
          <DateFilter
            startDate={fromDate}
            endDate={toDate}
            onDateChange={handleDateChange}
            compact={true}
            showPresets={true}
            className="flex-1 min-w-[200px]"
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
              <div className="grid grid-cols-[3rem_7rem_1fr_6rem_4rem_6rem_1fr_5.5rem_1fr_6rem] gap-3 xl:gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="col-span-1">S.No</div>
                <div className="col-span-1">Order #</div>
                <div className="col-span-1">Customer</div>
                <div className="col-span-1">Date</div>
                <div className="col-span-1 text-center">Items</div>
                <div className="col-span-1 text-center">Total</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-1 text-center">Type</div>
                <div className="col-span-1">Notes</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
            </div>
          </div>

          {/* Mobile Header */}
          <div className="lg:hidden bg-gray-50 border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-700">
              Sales Invoices ({ordersPagination.total ?? orders.length})
            </h3>
          </div>

          {/* Table Body / Cards */}
          <div className="divide-y divide-gray-200">
            {orders.map((order, idx) => (
              <div key={order?.id ?? order?._id ?? order?.order_number ?? order?.orderNumber ?? `order-${idx}`}>
                {/* Desktop Table Row */}
                <div className="hidden lg:block px-4 xl:px-6 py-3 xl:py-4 hover:bg-gray-50 transition-colors">
                  <div className="grid grid-cols-[3rem_7rem_1fr_6rem_4rem_6rem_1fr_5.5rem_1fr_6rem] gap-3 xl:gap-4 items-center text-sm">
                    {/* S.No */}
                    <div className="col-span-1 text-gray-500 font-medium">
                      {invoiceRowOffset + idx + 1}
                    </div>

                    {/* Order Number */}
                    <div className="col-span-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        #{order.order_number ?? order.orderNumber ?? '—'}
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="col-span-1 min-w-0">
                      <div className="text-gray-900 truncate" title={order.customer?.businessName ?? order.customer?.business_name ?? order.customer?.displayName ?? order.customer?.name ?? order.customerInfo?.businessName ?? order.customerInfo?.business_name ?? order.customerInfo?.name ?? 'Walk-in'}>
                        {order.customer?.businessName ?? order.customer?.business_name ?? order.customer?.displayName ?? order.customer?.name ?? order.customerInfo?.businessName ?? order.customerInfo?.business_name ?? order.customerInfo?.name ?? 'Walk-in Customer'}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="col-span-1 text-gray-600">
                      {formatOrderDate(order)}
                    </div>

                    {/* Items */}
                    <div className="col-span-1 text-center text-gray-600">
                      {order.lineItemCount ?? order.items?.length ?? 0}
                    </div>

                    {/* Total */}
                    <div className="col-span-1 text-center font-semibold text-gray-900">
                      {Math.round(order.pricing?.total ?? order.total ?? 0)}
                    </div>

                    {/* Status */}
                    <div className="col-span-1 flex flex-row flex-wrap gap-1 justify-center items-center">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${(order?.status === 'completed' || order?.status === 'delivered')
                        ? 'bg-green-100 text-green-800'
                        : (order?.status === 'pending' || order?.status === 'processing')
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                        }`}>
                        {order?.status ?? '—'}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${getDerivedPaymentStatus(order) === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {getDerivedPaymentStatus(order)}
                      </span>
                    </div>

                    {/* Type */}
                    <div className="col-span-1 text-center">
                      <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase">
                        {order.orderType ?? order.order_type ?? '—'}
                      </span>
                    </div>

                    {/* Notes */}
                    <div className="col-span-1 min-w-0">
                      <span className="text-xs text-gray-500 block truncate" title={order.notes?.trim() || '—'}>
                        {order.notes?.trim() || '—'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex justify-end gap-0.5">
                      <button onClick={() => handleView(order)} className="p-1 text-primary-600 hover:text-primary-800" title="View"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => handlePrint(order)} className="p-1 text-green-600 hover:text-green-800" title="Print"><Printer className="h-4 w-4" /></button>
                      <ExcelExportButton
                        getData={async () => {
                          try {
                            const result = await fetchOrderById(order._id || order.id).unwrap();
                            const freshOrder = result?.order || result?.data?.order || result || order;
                            const payload = getInvoicePdfPayload(freshOrder, companySettings, 'Sales Invoice', 'Customer');
                            return {
                              ...payload,
                              filename: `Invoice_${order.order_number ?? order.orderNumber}.xlsx`
                            };
                          } catch (err) {
                            return {
                              ...getInvoicePdfPayload(order, companySettings, 'Sales Invoice', 'Customer'),
                              filename: `Invoice_${order.order_number ?? order.orderNumber}.xlsx`
                            };
                          }
                        }}
                        label=""
                        className="p-1 bg-transparent border-none shadow-none hover:bg-transparent text-green-600 hover:text-green-800 px-1 py-1"
                      />
                      <PdfExportButton
                        getData={async () => {
                          try {
                            const result = await fetchOrderById(order._id || order.id).unwrap();
                            const freshOrder = result?.order || result?.data?.order || result || order;
                            return getInvoicePdfPayload(freshOrder, companySettings, 'Sales Invoice', 'Customer');
                          } catch (err) {
                            return getInvoicePdfPayload(order, companySettings, 'Sales Invoice', 'Customer');
                          }
                        }}
                        label=""
                        className="p-1 bg-transparent border-none shadow-none hover:bg-transparent text-red-600 hover:text-red-800 px-1 py-1"
                      />
                      {canEditInvoice(order) && <button onClick={() => handleEdit(order)} className="p-1 text-blue-600 hover:text-blue-800" title="Edit"><Edit className="h-4 w-4" /></button>}
                      {canDeleteInvoice(order) && <button onClick={() => handleDelete(order)} className="p-1 text-red-600 hover:text-red-800" title="Delete"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </div>
                </div>

                {/* Mobile View */}
                <div className="lg:hidden px-4 py-4 hover:bg-gray-50 transition-colors">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{idx + 1}</span>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 truncate">#{order.order_number ?? '—'}</h3>
                          <p className="text-xs text-gray-500">{order.customer?.businessName ?? order.customer?.business_name ?? order.customer?.displayName ?? order.customer?.name ?? order.customerInfo?.businessName ?? order.customerInfo?.business_name ?? order.customerInfo?.name ?? 'Walk-in'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{Math.round(order.pricing?.total ?? 0)}</p>
                        <p className="text-[10px] text-gray-500">{formatOrderDate(order)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 uppercase">{order.orderType ?? '—'}</span>
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${order?.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>{order?.status ?? '—'}</span>
                    </div>
                    <div className="flex justify-start gap-1 pt-2 border-t border-gray-100">
                      <button onClick={() => handleView(order)} className="p-2 text-primary-600"><Eye className="h-5 w-5" /></button>
                      <button onClick={() => handlePrint(order)} className="p-2 text-green-600"><Printer className="h-5 w-5" /></button>
                      {canEditInvoice(order) && <button onClick={() => handleEdit(order)} className="p-2 text-blue-600"><Edit className="h-5 w-5" /></button>}
                      {canDeleteInvoice(order) && <button onClick={() => handleDelete(order)} className="p-2 text-red-600"><Trash2 className="h-5 w-5" /></button>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <PaginationControls
            page={uiPagination.current}
            totalPages={Math.max(1, Number(uiPagination.pages) || 1)}
            onPageChange={(page) => goToPage(page, uiPagination.hasNext)}
            totalItems={uiPagination.total}
            limit={uiPagination.limit ?? INVOICE_PAGE_SIZE}
          />
        </div>
      )}

      {/* View Modal */}
      <BaseModal
        isOpen={showViewModal && !!selectedOrder}
        onClose={() => setShowViewModal(false)}
        title="Sales Invoice Details"
        maxWidth="xl"
        variant="scrollable"
        contentClassName="p-6"
        headerExtra={
          selectedOrder ? (
            <div className="flex flex-wrap gap-2 justify-end shrink-0">
              <Button
                type="button"
                size="sm"
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => handlePrint(selectedOrder)}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              {canDeleteInvoice(selectedOrder) && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Are you sure you want to delete invoice ${selectedOrder.order_number ?? selectedOrder.orderNumber ?? 'this'}?`
                      )
                    ) {
                      handleDeleteOrder(selectedOrder._id);
                      setShowViewModal(false);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {selectedOrder && (
          <>
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
                  <p className="font-medium">{selectedOrder.customer?.business_name ?? selectedOrder.customer?.businessName ?? selectedOrder.customer?.name ?? selectedOrder.customerInfo?.businessName ?? selectedOrder.customerInfo?.business_name ?? selectedOrder.customerInfo?.name ?? 'Walk-in Customer'}</p>
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
                  <p><span className="font-medium">Invoice #:</span> {selectedOrder.order_number ?? selectedOrder.orderNumber ?? '—'}</p>
                  <p><span className="font-medium">Date:</span> {formatOrderDate(selectedOrder)}</p>
                  {(selectedOrder.sale_date ?? selectedOrder.billDate) && (selectedOrder.created_at ?? selectedOrder.createdAt) && new Date(selectedOrder.sale_date ?? selectedOrder.billDate).getTime() !== new Date(selectedOrder.created_at ?? selectedOrder.createdAt).getTime() && (
                    <p className="text-xs text-gray-500">(Original: {formatOrderDate({ created_at: selectedOrder.created_at, createdAt: selectedOrder.createdAt })})</p>
                  )}
                  <p><span className="font-medium">Status:</span> {selectedOrder.status ?? selectedOrder.Status ?? '—'}</p>
                  <p><span className="font-medium">Type:</span> {selectedOrder.order_type ?? selectedOrder.orderType ?? '—'}</p>
                </div>
              </div>

              {/* Payment Information */}
              <div className="text-right">
                <h3 className="font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">Payment:</h3>
                <div className="space-y-1">
                  <p><span className="font-medium">Status:</span> {getDerivedPaymentStatus(selectedOrder)}</p>
                  <p><span className="font-medium">Method:</span> {selectedOrder.payment?.method ?? selectedOrder.payment_method ?? '—'}</p>
                  <p><span className="font-medium">Amount:</span> {Math.round(selectedOrder.pricing?.total ?? selectedOrder.total ?? 0)}</p>
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
            {(() => {
              const items = Array.isArray(selectedOrder?.items) ? selectedOrder.items : [];
              const sumFromItems = items.reduce((s, i) => {
                const qty = Number(i.quantity ?? i.qty) || 0;
                const price = Number(i.unitPrice ?? i.unit_price ?? i.price) || 0;
                const lineTotal = Number(i.total ?? i.subtotal ?? i.lineTotal) || (qty * price);
                return s + lineTotal;
              }, 0);
              const viewSubtotal = Number(selectedOrder?.subtotal ?? selectedOrder?.pricing?.subtotal) || (items.length > 0 ? sumFromItems : 0);
              const viewDiscount = Number(selectedOrder?.discount ?? selectedOrder?.pricing?.discountAmount ?? selectedOrder?.pricing?.discount) || 0;
              const viewTax = Number(selectedOrder?.tax ?? selectedOrder?.pricing?.taxAmount) || 0;
              const viewTotal = Number(selectedOrder?.total ?? selectedOrder?.pricing?.total) || (viewSubtotal - viewDiscount + viewTax);
              return (
                <div className="flex justify-end">
                  <div className="w-80">
                    <table className="w-full">
                      <tbody>
                        <tr>
                          <td className="px-4 py-2">Subtotal:</td>
                          <td className="px-4 py-2 text-right">{Math.round(viewSubtotal)}</td>
                        </tr>
                        {taxSystemEnabled && viewTax > 0 && (
                        <tr>
                          <td className="px-4 py-2">Tax:</td>
                          <td className="px-4 py-2 text-right">{Math.round(viewTax)}</td>
                        </tr>
                        )}
                        <tr>
                          <td className="px-4 py-2">Discount:</td>
                          <td className="px-4 py-2 text-right">{Math.round(viewDiscount)}</td>
                        </tr>
                        <tr className="border-t-2 border-gray-900">
                          <td className="px-4 py-2 font-bold">Total:</td>
                          <td className="px-4 py-2 text-right font-bold">{Math.round(viewTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-gray-500">
              Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </div>
          </>
        )}
      </BaseModal>

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
