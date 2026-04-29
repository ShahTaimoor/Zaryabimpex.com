import React, { useState, useEffect, useMemo } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  FileText,
  Search,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Printer,
  Calendar,

} from 'lucide-react';
import {
  useGetPurchaseInvoicesQuery,
  useLazyGetPurchaseInvoicesQuery,
  useLazyGetPurchaseInvoiceQuery,
  useConfirmPurchaseInvoiceMutation,
  useDeletePurchaseInvoiceMutation,

} from '../store/services/purchaseInvoicesApi';
import { useLazyGetSupplierQuery } from '../store/services/suppliersApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../components/ComponentRegistry';
import PrintModal from '../components/PrintModal';
import { Button } from '@/components/ui/button';
import DateFilter from '../components/DateFilter';
import { getCurrentDatePakistan, formatDateForInput } from '../utils/dateUtils';
import ExcelExportButton from '../components/ExcelExportButton';
import PdfExportButton from '../components/PdfExportButton';
import { getInvoicePdfPayload } from '../utils/invoicePdfUtils';
import PaginationControls from '../components/PaginationControls';
import { useCursorPagination } from '../hooks/useCursorPagination';

const PI_PAGE_SIZE = 50;

/** Normalize list API envelope to an invoices array */
function purchaseInvoicesFromResponse(res) {
  if (!res) return [];
  const top = res?.data ?? res;
  if (top?.data?.invoices) return top.data.invoices;
  if (top?.invoices) return top.invoices;
  if (top?.data?.data?.invoices) return top.data.data.invoices;
  if (Array.isArray(top)) return top;
  if (Array.isArray(top?.data)) return top.data;
  return [];
}

// Edit allowed only within 1 month of invoice date
const canEditByDate = (invoice) => {
  const raw = invoice?.invoiceDate ?? invoice?.invoice_date ?? invoice?.createdAt;
  if (raw == null) return false;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  cutoff.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d >= cutoff;
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    draft: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Draft' },
    confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Confirmed' },
    received: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Received' },
    paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Paid' },
    cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' },
    closed: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Closed' }
  };

  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3 mr-0.5 sm:mr-1" />
      {config.label}
    </span>
  );
};

const PurchaseInvoiceCard = ({ invoice, onEdit, onDelete, onConfirm, onView, onPrint }) => (
  <div className="card hover:shadow-lg transition-shadow">
    <div className="card-content">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
            <StatusBadge status={invoice.status} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-600">
              <FileText className="h-4 w-4 mr-2" />
              {invoice.supplierInfo?.businessName || invoice.supplierInfo?.business_name || invoice.supplierInfo?.companyName || invoice.supplierInfo?.name || 'Unknown Supplier'}
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <TrendingUp className="h-4 w-4 mr-2" />
              {Math.round(invoice.pricing?.total || 0)} ({invoice.lineItemCount ?? invoice.items?.length ?? 0} items)
            </div>

            <div className="text-sm text-gray-500">
              {invoice.invoiceDate || invoice.invoice_date || invoice.createdAt
                ? new Date(invoice.invoiceDate || invoice.invoice_date || invoice.createdAt).toLocaleDateString()
                : 'Invalid Date'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onView(invoice)}
            className="text-gray-600 hover:text-gray-800"
            title="View Invoice"
          >
            <Eye className="h-4 w-4" />
          </button>

          <button
            onClick={() => onPrint && onPrint(invoice)}
            className="text-green-600 hover:text-green-800"
            title="Print Invoice"
          >
            <Printer className="h-4 w-4" />
          </button>

          {canEditByDate(invoice) && (
            <button
              onClick={() => onEdit(invoice)}
              className="text-blue-600 hover:text-blue-800"
              title="Edit Invoice"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}

          {/* Show delete button for all statuses except paid and closed */}
          {!['paid', 'closed'].includes(invoice.status) && (
            <button
              onClick={() => onDelete(invoice)}
              className="text-red-600 hover:text-red-800"
              title="Delete Invoice"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);

export const PurchaseInvoices = () => {
  const { companyInfo: companySettings } = useCompanyInfo();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState('');
  const today = getCurrentDatePakistan();
  const [dateFrom, setDateFrom] = useState(today); // Today
  const [dateTo, setDateTo] = useState(today); // Today
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const {
    currentPage: invoicePage,
    currentCursor,
    updateFromPagination,
    getUiPagination,
    goToPage,
  } = useCursorPagination([debouncedSearch, statusFilter, dateFrom, dateTo]);

  const { openTab } = useTab();

  // Build query params
  const queryParams = useMemo(() => {
    const params = {
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      page: invoicePage,
      cursor: currentCursor,
      limit: PI_PAGE_SIZE,
    };

    if (dateFrom) {
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      params.dateTo = dateTo;
    }

    return params;
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, invoicePage, currentCursor]);

  // Fetch purchase invoices
  const { data: piResponse, isLoading, error, refetch } = useGetPurchaseInvoicesQuery(
    queryParams,
    { refetchOnMountOrArgChange: 120 }
  );

  const [fetchPurchaseInvoicesAll] = useLazyGetPurchaseInvoicesQuery();

  // Editing occurs in Purchase page; no supplier query needed here

  const [getPurchaseInvoiceById] = useLazyGetPurchaseInvoiceQuery();

  // Mutations
  const [confirmPurchaseInvoiceMutation, { isLoading: confirming }] = useConfirmPurchaseInvoiceMutation();
  const [deletePurchaseInvoiceMutation, { isLoading: deleting }] = useDeletePurchaseInvoiceMutation();


  const [getSupplierById] = useLazyGetSupplierQuery();

  // Print helper - fetch full invoice by ID, and fetch supplier if address is missing
  const handlePrint = async (invoice) => {
    if (!invoice) return;
    const id = invoice.id || invoice._id;
    if (id) {
      try {
        const result = await getPurchaseInvoiceById(id).unwrap();
        let fullInvoice = result?.invoice || result?.data?.invoice || result?.data || result;
        const supplierId = fullInvoice?.supplier_id || fullInvoice?.supplierId || fullInvoice?.supplier?.id || fullInvoice?.supplier?._id || fullInvoice?.supplierInfo?.id || fullInvoice?.supplierInfo?._id;
        const hasAddress = !!(fullInvoice?.supplierInfo?.address || fullInvoice?.supplier?.address);
        if (!hasAddress && supplierId && typeof supplierId === 'string') {
          try {
            const supResult = await getSupplierById(supplierId).unwrap();
            const supplier = supResult?.supplier || supResult?.data?.supplier || supResult;
            if (supplier) {
              let addr = '';
              if (typeof supplier.address === 'string' && supplier.address.trim()) addr = supplier.address.trim();
              else if (Array.isArray(supplier.address) && supplier.address.length > 0) {
                const a = supplier.address.find(x => x.isDefault) || supplier.address.find(x => x.type === 'billing' || x.type === 'both') || supplier.address[0];
                const parts = [a.street || a.address_line1 || a.addressLine1, a.city, a.state || a.province, a.country, a.zipCode || a.zip].filter(Boolean);
                addr = parts.join(', ');
              } else if (supplier.address && typeof supplier.address === 'object') {
                const a = supplier.address;
                const parts = [a.street || a.address_line1 || a.addressLine1 || a.line1, a.address_line2 || a.addressLine2, a.city, a.state || a.province, a.country, a.zipCode || a.zip || a.postal_code].filter(Boolean);
                addr = parts.join(', ');
              } else if (supplier.addresses?.length) {
                const a = supplier.addresses.find(x => x.isDefault) || supplier.addresses.find(x => x.type === 'billing' || x.type === 'both') || supplier.addresses[0];
                addr = [a.street || a.address_line1 || a.addressLine1, a.city, a.state || a.province, a.country, a.zipCode || a.zip].filter(Boolean).join(', ');
              }
              if (addr) {
                fullInvoice = {
                  ...fullInvoice,
                  supplierInfo: { ...(fullInvoice.supplierInfo || {}), address: addr },
                  supplier: typeof fullInvoice.supplier === 'object' ? { ...fullInvoice.supplier, address: addr } : fullInvoice.supplier
                };
              }
            }
          } catch (e) { /* ignore */ }
        }
        setSelectedInvoice(fullInvoice || invoice);
      } catch {
        setSelectedInvoice(invoice);
      }
    } else {
      setSelectedInvoice(invoice);
    }
    setShowViewModal(true);
  };

  // Table columns configuration
  const columns = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      accessor: (item) => item.invoiceNumber,
      render: (value, item) => (
        <div className="font-medium text-gray-900">{value}</div>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      accessor: (item) => item.supplierInfo?.companyName || item.supplierInfo?.name || 'Unknown',
      render: (value, item) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">
            {item.invoiceDate || item.invoice_date || item.createdAt
              ? new Date(item.invoiceDate || item.invoice_date || item.createdAt).toLocaleDateString()
              : 'Invalid Date'}
          </div>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      accessor: (item) => item.pricing?.total || 0,
      render: (value, item) => (
        <div className="text-right">
          <div className="font-semibold text-gray-900">{Math.round(value)}</div>
          <div className="text-sm text-gray-500">{item.lineItemCount ?? item.items?.length ?? 0} items</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (item) => item.status,
      render: (value, item) => <StatusBadge status={value} />,
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      accessor: (item) => item.payment?.status || 'pending',
      render: (value, item) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${value === 'paid' ? 'bg-green-100 text-green-800' :
          value === 'partial' ? 'bg-yellow-100 text-yellow-800' :
            value === 'overdue' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
          }`}>
          {value}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: () => '',
      render: (value, item) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleView(item)}
            className="text-gray-600 hover:text-gray-800"
            title="View Invoice"
          >
            <Eye className="h-4 w-4" />
          </button>

          <button
            onClick={() => handlePrint(item)}
            className="text-green-600 hover:text-green-800"
            title="Print Invoice"
          >
            <Printer className="h-4 w-4" />
          </button>

          {canEditByDate(item) && (
            <button
              onClick={() => handleEdit(item)}
              className="text-blue-600 hover:text-blue-800"
              title="Edit Invoice"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}

          {/* Show delete button for all statuses except paid and closed */}
          {!['paid', 'closed'].includes(item.status) && (
            <button
              onClick={() => handleDelete(item)}
              className="text-red-600 hover:text-red-800"
              title="Delete Invoice"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Event handlers
  const handleConfirm = (invoice) => {
    if (window.confirm(`Are you sure you want to confirm invoice ${invoice.invoiceNumber}?`)) {
      confirmPurchaseInvoiceMutation(invoice._id || invoice.id)
        .unwrap()
        .then(() => {
          showSuccessToast('Purchase invoice confirmed successfully');
          refetch();
        })
        .catch((error) => {
          handleApiError(error, 'Purchase Invoice Confirmation');
        });
    }
  };

  const handleDelete = (invoice) => {
    const message = invoice.status === 'confirmed'
      ? `Are you sure you want to delete invoice ${invoice.invoiceNumber}?\n\nThis will:\n• Remove ${invoice.lineItemCount ?? invoice.items?.length ?? 0} products from inventory\n• Reduce supplier balance by ${Math.round((invoice.pricing?.total || 0) - (invoice.payment?.amount || 0))}`
      : `Are you sure you want to delete invoice ${invoice.invoiceNumber}?`;

    if (window.confirm(message)) {
      deletePurchaseInvoiceMutation(invoice._id || invoice.id)
        .unwrap()
        .then(() => {
          showSuccessToast('Purchase invoice deleted successfully');
          refetch();
        })
        .catch((error) => {
          handleApiError(error, 'Purchase Invoice Deletion');
        });
    }
  };

  const handleEdit = async (invoice) => {
    const componentInfo = getComponentInfo('/purchase');
    if (!componentInfo) {
      showErrorToast('Purchase page not found');
      return;
    }
    const id = invoice._id || invoice.id;
    let row = invoice;
    if (id) {
      try {
        const result = await getPurchaseInvoiceById(id).unwrap();
        const full = result?.invoice || result?.data?.invoice || result?.data || result;
        if (full) row = full;
      } catch {
        /* use list row */
      }
    }

    const newTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const invoiceData = {
      invoiceId: row._id || row.id,
      invoiceNumber: row.invoiceNumber,
      supplier: row.supplierInfo,
      items: row.items || [],
      notes: row.notes || '',
      invoiceType: row.invoiceType || 'purchase',
      invoiceDate: row.invoiceDate || row.createdAt,
      createdAt: row.createdAt,
      isEditMode: true,
      payment: row.payment || {}
    };

    openTab({
      title: `Edit Purchase - ${row.invoiceNumber}`,
      path: '/purchase',
      component: componentInfo.component,
      icon: componentInfo.icon,
      allowMultiple: true,
      props: {
        tabId: newTabId,
        editData: invoiceData
      }
    });

    showSuccessToast(`Opening ${row.invoiceNumber} for editing...`);
  };

  const handleView = (invoice) => {
    setSelectedInvoice(invoice);
    setShowViewModal(true);
  };



  // Memoize invoices data - must be before conditional returns to follow Rules of Hooks
  const invoices = useMemo(
    () => purchaseInvoicesFromResponse(piResponse),
    [piResponse]
  );

  const piPagination = piResponse?.data?.pagination ?? piResponse?.pagination ?? {};
  const uiPagination = useMemo(
    () => getUiPagination(piPagination, PI_PAGE_SIZE),
    [getUiPagination, piPagination]
  );
  const invoiceRowOffset = (invoicePage - 1) * PI_PAGE_SIZE;

  useEffect(() => {
    updateFromPagination(piPagination);
  }, [piPagination, updateFromPagination]);

  const getExportData = async () => {
    let res;
    try {
      res = await fetchPurchaseInvoicesAll({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        dateFrom,
        dateTo,
        all: 'true',
      }).unwrap();
    } catch (e) {
      handleApiError(e, 'Purchase invoices export');
      return null;
    }
    const allRows = purchaseInvoicesFromResponse(res);
    return {
      title: 'Purchase Invoices Report',
      filename: `Purchase_Invoices_${dateFrom}_to_${dateTo}.xlsx`,
      company: {
        name: companySettings?.companyName || 'ZARYAB IMPEX',
        address: companySettings?.address || companySettings?.billingAddress || '',
        contact: `${companySettings?.contactNumber || ''} ${companySettings?.email ? '| ' + companySettings.email : ''}`.trim()
      },
      columns: [
        { header: 'S.No', key: 'sno', width: 8, type: 'number' },
        { header: 'Image', key: 'imageUrl', width: 12, type: 'image' },
        { header: 'Invoice #', key: 'invoiceNumber', width: 15 },
        { header: 'Supplier', key: 'supplierName', width: 35 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Items', key: 'itemsCount', width: 10, type: 'number' },
        { header: 'Total', key: 'total', width: 20, type: 'currency' },
        { header: 'Payment', key: 'paymentStatus', width: 15 },
        { header: 'Notes', key: 'notes', width: 40 }
      ],
      data: allRows.map((invoice, i) => ({
        sno: i + 1,
        imageUrl: invoice.items?.[0]?.product?.imageUrl ?? invoice.items?.[0]?.productData?.imageUrl ?? null,
        invoiceNumber: invoice.invoiceNumber ?? '—',
        supplierName: invoice.supplierInfo?.companyName || invoice.supplierInfo?.name || invoice.supplier?.companyName || invoice.supplier?.name || 'Unknown',
        date: invoice.invoiceDate || invoice.invoice_date || invoice.createdAt
          ? new Date(invoice.invoiceDate || invoice.invoice_date || invoice.createdAt).toLocaleDateString()
          : 'Invalid Date',
        itemsCount: invoice.lineItemCount ?? invoice.items?.length ?? 0,
        total: Number(invoice.pricing?.total || 0),
        paymentStatus: (invoice.payment?.status || 'pending').toUpperCase(),
        notes: invoice.notes?.trim() || ''
      })),
      summary: {
        rows: [
          {
            label: 'GRAND TOTAL:',
            invoiceNumber: `${allRows.length} Invoices`,
            total: allRows.reduce((sum, o) => sum + Number(o.pricing?.total || 0), 0)
          }
        ]
      }
    };
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <p className="text-sm sm:text-base text-red-600">Failed to load purchase invoices</p>
        <Button onClick={refetch} variant="default" size="default" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Purchase Invoices</h1>
          <p className="text-sm sm:text-base text-gray-600">Track and manage supplier invoices and receipts</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto items-stretch sm:items-center">
          <ExcelExportButton
            getData={getExportData}
            label="Export"
          />
          <PdfExportButton
            getData={getExportData}
            label="PDF"
          />
          <div className="w-full sm:w-auto">
            <DateFilter
              startDate={dateFrom}
              endDate={dateTo}
              onDateChange={(start, end) => {
                setDateFrom(start || '');
                setDateTo(end || '');
              }}
              compact={true}
              showPresets={true}
              className="w-full"
            />
          </div>
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
              placeholder="Search by invoice number, supplier name..."
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
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="received">Received</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Purchase Invoices Table */}
      {invoices.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <FileText className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No purchase invoices found</h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 px-4">
            {searchTerm || statusFilter || dateFrom || dateTo ? 'Try adjusting your filters.' : 'No purchase invoices have been created yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header - Desktop Only */}
          <div className="hidden md:block bg-gray-50 px-4 lg:px-6 py-3 border-b border-gray-200">
            <div className="grid grid-cols-12 gap-3 lg:gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">S.No</div>
              <div className="col-span-1">Invoice #</div>
              <div className="col-span-2">Supplier</div>
              <div className="col-span-1">Date</div>
              <div className="col-span-1">Items</div>
              <div className="col-span-1">Total</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Payment</div>
              <div className="col-span-1">Notes</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200">
            {invoices.map((invoice, idx) => (
              <div key={invoice._id || idx} className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors">
                {/* Mobile Card Layout */}
                <div className="md:hidden space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{invoiceRowOffset + idx + 1}</span>
                        <h3 className="font-semibold text-sm text-gray-900 truncate">{invoice.invoiceNumber}</h3>
                        <StatusBadge status={invoice.status} />
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {invoice.supplierInfo?.businessName || invoice.supplierInfo?.business_name || invoice.supplierInfo?.companyName || invoice.supplierInfo?.name || 'Unknown Supplier'}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{invoice.invoiceDate || invoice.invoice_date || invoice.createdAt
                          ? new Date(invoice.invoiceDate || invoice.invoice_date || invoice.createdAt).toLocaleDateString()
                          : 'Invalid Date'}</span>
                        <span>•</span>
                        <span>{invoice.lineItemCount ?? invoice.items?.length ?? 0} items</span>
                      </div>
                    </div>
                    <div className="flex items-center flex-nowrap gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleView(invoice)}
                        className="shrink-0 text-gray-600 hover:text-gray-800 p-1"
                        title="View Invoice"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(invoice)}
                        className="shrink-0 text-green-600 hover:text-green-800 p-1"
                        title="Print Invoice"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {canEditByDate(invoice) && (
                        <button
                          onClick={() => handleEdit(invoice)}
                          className="shrink-0 text-blue-600 hover:text-blue-800 p-1"
                          title="Edit Invoice"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {!['paid', 'closed'].includes(invoice.status) && (
                        <button
                          onClick={() => handleDelete(invoice)}
                          className="shrink-0 text-red-600 hover:text-red-800 p-1"
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div>
                      <span className="text-xs text-gray-500">Payment:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ml-1 ${invoice.payment?.status === 'paid' ? 'bg-green-100 text-green-800' :
                        invoice.payment?.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          invoice.payment?.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                        {invoice.payment?.status || 'pending'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">Total:</span>
                      <p className="font-semibold text-sm text-gray-900">{Math.round(invoice.pricing?.total || 0)}</p>
                    </div>
                  </div>
                  {invoice.notes?.trim() && (
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">Notes: </span>
                      <span className="text-xs text-gray-600">{invoice.notes.trim()}</span>
                    </div>
                  )}
                </div>

                <div className="hidden md:grid grid-cols-12 gap-3 lg:gap-4 items-center">
                  {/* S.No */}
                  <div className="col-span-1 text-xs text-gray-500 font-medium">
                    {idx + 1}
                  </div>

                  {/* Invoice Number */}
                  <div className="col-span-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {invoice.invoiceNumber}
                    </div>
                  </div>

                  {/* Supplier */}
                  <div className="col-span-2 min-w-0">
                    <div className="text-sm text-gray-900 truncate" title={invoice.supplierInfo?.businessName || invoice.supplierInfo?.business_name || invoice.supplierInfo?.companyName || invoice.supplierInfo?.name || 'Unknown Supplier'}>
                      {invoice.supplierInfo?.businessName || invoice.supplierInfo?.business_name || invoice.supplierInfo?.companyName || invoice.supplierInfo?.name || 'Unknown Supplier'}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="col-span-1">
                    <span className="text-xs sm:text-sm text-gray-600">
                      {invoice.invoiceDate || invoice.invoice_date || invoice.createdAt
                        ? new Date(invoice.invoiceDate || invoice.invoice_date || invoice.createdAt).toLocaleDateString()
                        : 'Invalid Date'}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="col-span-1">
                    <span className="text-xs sm:text-sm text-gray-600">
                      {invoice.lineItemCount ?? invoice.items?.length ?? 0}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="col-span-1">
                    <span className="font-semibold text-sm text-gray-900">
                      {Math.round(invoice.pricing?.total || 0)}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-1">
                    <StatusBadge status={invoice.status} />
                  </div>

                  {/* Payment */}
                  <div className="col-span-1">
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${invoice.payment?.status === 'paid' ? 'bg-green-100 text-green-800' :
                      invoice.payment?.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        invoice.payment?.status === 'overdue' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                      }`}>
                      {invoice.payment?.status || 'pending'}
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="col-span-1">
                    <span
                      className="text-xs text-gray-600 block truncate"
                      title={invoice.notes?.trim() || 'No notes'}
                    >
                      {invoice.notes?.trim() || '—'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end">
                    <div className="flex items-center flex-nowrap gap-1">
                      <button
                        onClick={() => handleView(invoice)}
                        className="shrink-0 text-gray-600 hover:text-gray-800 p-1"
                        title="View Invoice"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(invoice)}
                        className="shrink-0 text-green-600 hover:text-green-800 p-1"
                        title="Print Invoice"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <ExcelExportButton
                        getData={async () => {
                          try {
                            const result = await getPurchaseInvoiceById(invoice.id || invoice._id).unwrap();
                            const fullInvoice = result?.invoice || result?.data?.invoice || result?.data || result || invoice;
                            const payload = getInvoicePdfPayload(fullInvoice, companySettings, 'Purchase Invoice', 'Supplier');
                            return {
                              ...payload,
                              filename: `Purchase_Invoice_${invoice.invoiceNumber}.xlsx`
                            };
                          } catch (err) {
                            return {
                              ...getInvoicePdfPayload(invoice, companySettings, 'Purchase Invoice', 'Supplier'),
                              filename: `Purchase_Invoice_${invoice.invoiceNumber}.xlsx`
                            };
                          }
                        }}
                        label=""
                        className="p-1 bg-transparent border-none shadow-none hover:bg-transparent text-green-600 hover:text-green-800 px-1 py-1"
                      />
                      <PdfExportButton
                        getData={async () => {
                          try {
                            const result = await getPurchaseInvoiceById(invoice.id || invoice._id).unwrap();
                            const fullInvoice = result?.invoice || result?.data?.invoice || result?.data || result || invoice;
                            return getInvoicePdfPayload(fullInvoice, companySettings, 'Purchase Invoice', 'Supplier');
                          } catch (err) {
                            return getInvoicePdfPayload(invoice, companySettings, 'Purchase Invoice', 'Supplier');
                          }
                        }}
                        label=""
                        className="p-1 bg-transparent border-none shadow-none hover:bg-transparent text-red-600 hover:text-red-800 px-1 py-1"
                      />

                      {canEditByDate(invoice) && (
                        <button
                          onClick={() => handleEdit(invoice)}
                          className="shrink-0 text-blue-600 hover:text-blue-800 p-1"
                          title="Edit Invoice"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}

                      {/* Show delete button for all statuses except paid and closed */}
                      {!['paid', 'closed'].includes(invoice.status) && (
                        <button
                          onClick={() => handleDelete(invoice)}
                          className="shrink-0 text-red-600 hover:text-red-800 p-1"
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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
            limit={uiPagination.limit ?? PI_PAGE_SIZE}
          />
        </div>
      )}




      {/* View Modal with Print Support */}
      <PrintModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        orderData={selectedInvoice ? {
          ...selectedInvoice,
          supplier: selectedInvoice.supplierInfo || selectedInvoice.supplier,
          supplierInfo: { ...(selectedInvoice.supplierInfo || {}), address: selectedInvoice.supplierInfo?.address || selectedInvoice.supplier?.address }
        } : null}
        documentTitle="Purchase Invoice"
        partyLabel="Supplier"
      />

      {/* Edit modal removed: editing handled via opening /purchase tab */}
    </div>
  );
};
