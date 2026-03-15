import React, { useState } from 'react';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Package, 
  AlertCircle,
  MessageSquare,
  Phone,
  Mail,
  User,
  Calendar,
  TrendingUp,
  FileText,
  Edit,
  Send,
  Printer
} from 'lucide-react';
import { useGetReturnQuery } from '../store/services/returnsApi';
import { useGetCompanySettingsQuery } from '../store/services/settingsApi';
import { LoadingSpinner } from '../components/LoadingSpinner';

const ReturnDetailModal = ({ 
  return: returnData,
  returnData: returnDataProp, // Accept both 'return' and 'returnData' props
  isOpen, 
  onClose, 
  onStatusUpdate, 
  onAddNote, 
  onAddCommunication,
  onUpdate, // Accept onUpdate as alias for onStatusUpdate
  isLoading 
}) => {
  // Use returnDataProp if provided, otherwise use returnData (from 'return' prop)
  const actualReturnData = returnDataProp || returnData;
  const [activeTab, setActiveTab] = useState('details');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [communicationData, setCommunicationData] = useState({
    type: 'email',
    message: '',
    recipient: ''
  });

  // Fetch detailed return data
  const { data: detailedReturn, isLoading: detailLoading } = useGetReturnQuery(
    actualReturnData?._id,
    {
      skip: !actualReturnData?._id || !isOpen,
    }
  );

  // Fetch company settings
  const { data: companySettings } = useGetCompanySettingsQuery();

  const returnInfo = detailedReturn?.data || detailedReturn || actualReturnData;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Package className="h-5 w-5 text-blue-500" />;
      case 'received':
        return <Package className="h-5 w-5 text-green-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'received':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to format dates properly
  const formatDate = (dateValue, options = {}) => {
    if (!dateValue) return 'N/A';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
      
      if (options.format === 'datetime') {
        return date.toLocaleString();
      } else if (options.format === 'date') {
        return date.toLocaleDateString();
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      return 'N/A';
    }
  };


  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Get the return data and company settings
    const returnData = returnInfo;
    const companyName = companySettings?.data?.companyName || companySettings?.companyName || 'Your Company Name';
    
    // Create the print content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Return Document - ${returnData.returnNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 10px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; }
          .company-name { font-size: 16px; font-weight: bold; color: #333; }
          .document-title { font-size: 14px; color: #666; margin-top: 5px; }
          .return-info { margin-bottom: 15px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; padding: 2px 0; border-bottom: 1px solid #eee; font-size: 11px; }
          .info-label { font-weight: bold; color: #333; }
          .info-value { color: #666; }
          .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
          .items-table th, .items-table td { border: 1px solid #ddd; padding: 4px; text-align: left; }
          .items-table th { background-color: #f5f5f5; font-weight: bold; font-size: 10px; }
          .items-table tr:nth-child(even) { background-color: #f9f9f9; }
          .totals { margin-top: 15px; text-align: right; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; padding: 2px 0; font-size: 11px; }
          .total-label { font-weight: bold; }
          .total-value { font-weight: bold; font-size: 12px; }
          .footer { margin-top: 20px; text-align: center; color: #666; font-size: 10px; }
          @media print {
            body { margin: 5px; font-size: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companyName}</div>
          <div class="company-details" style="font-size: 10px; color: #666; margin-top: 5px;">
            ${companySettings?.data?.address || companySettings?.address || ''} | ${companySettings?.data?.contactNumber || companySettings?.contactNumber || ''} | ${companySettings?.data?.email || companySettings?.email || ''}
          </div>
          <div class="document-title">RETURN DOCUMENT</div>
        </div>
        
        <div class="return-info" style="display: flex; gap: 20px; margin-bottom: 15px;">
          <div style="flex: 1;">
            <h3 style="color: #333; margin-bottom: 8px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 3px;">${returnData.origin === 'purchase' ? 'SUPPLIER' : 'CUSTOMER'} DETAILS</h3>
            <div class="info-row">
              <span class="info-label">${returnData.origin === 'purchase' ? 'Supplier' : 'Customer'} Name:</span>
              <span class="info-value">${returnData.origin === 'purchase' 
                ? (returnData.supplier?.companyName || returnData.supplier?.businessName || returnData.supplier?.name || 'N/A')
                : (returnData.customer?.firstName && returnData.customer?.lastName ? 
                    `${returnData.customer.firstName} ${returnData.customer.lastName}` : 
                    returnData.customer?.name || 
                    returnData.customer?.businessName || 
                    'N/A')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span class="info-value">${returnData.origin === 'purchase' 
                ? (returnData.supplier?.email || 'N/A')
                : (returnData.customer?.email || 'N/A')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span class="info-value">${returnData.origin === 'purchase' 
                ? (returnData.supplier?.phone || 'N/A')
                : (returnData.customer?.phone || 'N/A')}</span>
            </div>
          </div>
          <div style="flex: 1;">
            <h3 style="color: #333; margin-bottom: 8px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 3px;">RETURN DETAILS</h3>
            <div class="info-row">
              <span class="info-label">Return Number:</span>
              <span class="info-value">${returnData.returnNumber}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Original ${returnData.origin === 'purchase' ? 'Invoice' : 'Order'}:</span>
              <span class="info-value">${returnData.origin === 'purchase' 
                ? (returnData.originalOrder?.invoiceNumber || returnData.originalOrder?.poNumber || 'N/A')
                : (returnData.originalOrder?.orderNumber || returnData.originalOrder?.invoiceNumber || 'N/A')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value">${returnData.status?.toUpperCase() || 'PENDING'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Priority:</span>
              <span class="info-value">${returnData.priority?.toUpperCase() || 'NORMAL'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Return Date:</span>
              <span class="info-value">${returnData.returnDate 
                ? (() => {
                    const date = new Date(returnData.returnDate);
                    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
                  })()
                : 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Refund Method:</span>
              <span class="info-value">${returnData.refundMethod?.replace('_', ' ').toUpperCase() || 'ORIGINAL PAYMENT'}</span>
            </div>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Original Price</th>
              <th>Return Reason</th>
              <th>Condition</th>
              <th>Refund Amount</th>
              <th>Restocking Fee</th>
            </tr>
          </thead>
          <tbody>
            ${returnData.items?.map(item => `
              <tr>
                <td>${item.product?.name || 'N/A'}</td>
                <td>${item.quantity || 0}</td>
                <td>$${(item.originalPrice || 0).toFixed(2)}</td>
                <td>${item.returnReason?.replace('_', ' ').toUpperCase() || 'N/A'}</td>
                <td>${item.condition?.toUpperCase() || 'N/A'}</td>
                <td>$${(item.refundAmount || 0).toFixed(2)}</td>
                <td>$${(item.restockingFee || 0).toFixed(2)}</td>
              </tr>
            `).join('') || '<tr><td colspan="7">No items found</td></tr>'}
          </tbody>
        </table>
        
        <div class="totals">
          <div class="total-row">
            <span class="total-label">Total Refund Amount:</span>
            <span class="total-value">$${returnData.totalRefundAmount ? returnData.totalRefundAmount.toFixed(2) : 
              returnData.items ? returnData.items.reduce((sum, item) => sum + (item.refundAmount || 0), 0).toFixed(2) : '0.00'}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Total Restocking Fee:</span>
            <span class="total-value">$${returnData.totalRestockingFee ? returnData.totalRestockingFee.toFixed(2) : 
              returnData.items ? returnData.items.reduce((sum, item) => sum + (item.restockingFee || 0), 0).toFixed(2) : '0.00'}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Net Refund Amount:</span>
            <span class="total-value">$${returnData.netRefundAmount ? returnData.netRefundAmount.toFixed(2) : 
              returnData.items ? (returnData.items.reduce((sum, item) => sum + (item.refundAmount || 0), 0) - 
                returnData.items.reduce((sum, item) => sum + (item.restockingFee || 0), 0)).toFixed(2) : '0.00'}</span>
          </div>
        </div>
        
        ${returnData.generalNotes ? `
          <div style="margin-top: 30px;">
            <h3 style="color: #333; margin-bottom: 10px;">Notes:</h3>
            <p style="color: #666; line-height: 1.5;">${returnData.generalNotes}</p>
          </div>
        ` : ''}
        
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>This is a computer-generated document.</p>
          <p style="margin-top: 10px; font-weight: bold;">${companyName}</p>
          <p>${companySettings?.data?.address || ''}</p>
          <p>Phone: ${companySettings?.data?.contactNumber || ''} | Email: ${companySettings?.data?.email || ''}</p>
        </div>
      </body>
      </html>
    `;
    
    // Write the content to the new window
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for the content to load, then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };


  const handleAddNote = async () => {
    if (!onAddNote) {
      console.warn('No add note callback provided');
      return;
    }
    try {
      await onAddNote(noteText, isInternalNote);
      setShowNoteModal(false);
      setNoteText('');
      setIsInternalNote(false);
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleAddCommunication = async () => {
    if (!onAddCommunication) {
      console.warn('No add communication callback provided');
      return;
    }
    try {
      await onAddCommunication(communicationData);
      setShowCommunicationModal(false);
      setCommunicationData({ type: 'email', message: '', recipient: '' });
    } catch (error) {
      console.error('Error adding communication:', error);
    }
  };


  if (!isOpen || !returnInfo) return null;

  const tabs = [
    { id: 'details', label: 'Details', icon: FileText },
    { id: 'items', label: 'Items', icon: Package },
    { id: 'notes', label: 'Notes', icon: MessageSquare },
    { id: 'communication', label: 'Communication', icon: Phone }
  ];


  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-medium text-gray-900">
              Return {returnInfo.returnNumber}
            </h3>
            <p className="text-sm text-gray-500">
              Created {formatDate(returnInfo.returnDate)}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="text-gray-400 hover:text-gray-600"
              title="Print Return Document"
            >
              <Printer className="h-6 w-6" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(returnInfo.status)}`}>
              {getStatusIcon(returnInfo.status)}
              <span className="ml-2 capitalize">{returnInfo.status}</span>
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(returnInfo.priority)}`}>
              {returnInfo.priority || 'normal'} priority
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Customer/Supplier Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                  <div className="card-header">
                    <h4 className="text-lg font-medium text-gray-900">
                      {returnInfo.origin === 'purchase' ? 'Supplier' : 'Customer'} Information
                    </h4>
                  </div>
                  <div className="card-content">
                    <div className="space-y-3">
                      {returnInfo.origin === 'purchase' ? (
                        <>
                          <div className="flex items-center">
                            <User className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <div className="font-medium">
                                {returnInfo.supplier?.companyName || returnInfo.supplier?.businessName || returnInfo.supplier?.name || 'N/A'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {returnInfo.supplier?.email || 'N/A'}
                              </div>
                            </div>
                          </div>
                          {returnInfo.supplier?.phone && (
                            <div className="flex items-center">
                              <Phone className="h-5 w-5 text-gray-400 mr-3" />
                              <span>{returnInfo.supplier.phone}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <User className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <div className="font-medium">
                                {returnInfo.customer?.firstName} {returnInfo.customer?.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {returnInfo.customer?.email}
                              </div>
                            </div>
                          </div>
                          {returnInfo.customer?.phone && (
                            <div className="flex items-center">
                              <Phone className="h-5 w-5 text-gray-400 mr-3" />
                              <span>{returnInfo.customer.phone}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {(returnInfo.originalOrder?.orderNumber || returnInfo.originalOrder?.invoiceNumber || returnInfo.originalOrder?.poNumber || returnInfo.originalOrder?.createdAt || returnInfo.originalOrder?.total) && (
                  <div className="card">
                    <div className="card-header">
                      <h4 className="text-lg font-medium text-gray-900">
                        {returnInfo.origin === 'purchase' ? 'Purchase Invoice' : 'Order'} Information
                      </h4>
                    </div>
                    <div className="card-content">
                      <div className="space-y-3">
                        {(returnInfo.originalOrder?.orderNumber || returnInfo.originalOrder?.invoiceNumber || returnInfo.originalOrder?.poNumber) && (
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <div className="font-medium">
                                {returnInfo.origin === 'purchase' 
                                  ? (returnInfo.originalOrder?.invoiceNumber || returnInfo.originalOrder?.poNumber)
                                  : (returnInfo.originalOrder?.orderNumber || returnInfo.originalOrder?.invoiceNumber)}
                              </div>
                              <div className="text-sm text-gray-500">
                                Original {returnInfo.origin === 'purchase' ? 'invoice' : 'order'}
                              </div>
                            </div>
                          </div>
                        )}
                        {returnInfo.originalOrder?.createdAt && formatDate(returnInfo.originalOrder.createdAt) !== 'N/A' && (
                          <div className="flex items-center">
                            <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                            <span>
                              {formatDate(returnInfo.originalOrder.createdAt)}
                            </span>
                          </div>
                        )}
                        {returnInfo.originalOrder?.total && (
                          <div className="flex items-center">
                            <TrendingUp className="h-5 w-5 text-gray-400 mr-3" />
                            <span>
                              ${returnInfo.originalOrder.total.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Return Details */}
              <div className="card">
                <div className="card-header">
                  <h4 className="text-lg font-medium text-gray-900">Return Details</h4>
                </div>
                <div className="card-content">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Return Type</label>
                      <p className="mt-1 text-sm text-gray-900 capitalize">{returnInfo.returnType}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Refund Method</label>
                      <p className="mt-1 text-sm text-gray-900 capitalize">
                        {returnInfo.refundMethod?.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Total Refund</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        ${returnInfo.netRefundAmount?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="card">
                <div className="card-header">
                  <h4 className="text-lg font-medium text-gray-900">Timeline</h4>
                </div>
                <div className="card-content">
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">Return Requested</p>
                        <p className="text-sm text-gray-500">
                          {formatDate(returnInfo.returnDate, { format: 'datetime' })}
                        </p>
                      </div>
                    </div>
                    
                    {returnInfo.completionDate && (
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">Completed</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(returnInfo.completionDate, { format: 'datetime' })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-4">
              {returnInfo.items?.map((item, index) => (
                <div key={index} className="card">
                  <div className="card-header">
                    <h4 className="text-lg font-medium text-gray-900">{item.product?.name}</h4>
                  </div>
                  <div className="card-content">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Quantity</label>
                        <p className="mt-1 text-sm text-gray-900">{item.quantity}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Return Reason</label>
                        <p className="mt-1 text-sm text-gray-900 capitalize">
                          {item.returnReason?.replace('_', ' ')}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Condition</label>
                        <p className="mt-1 text-sm text-gray-900 capitalize">{item.condition}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Refund Amount</label>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          ${item.refundAmount?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                    {item.returnReasonDetail && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700">Reason Details</label>
                        <p className="mt-1 text-sm text-gray-900">{item.returnReasonDetail}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-medium text-gray-900">Notes</h4>
                <button
                  onClick={() => setShowNoteModal(true)}
                  className="btn btn-primary btn-sm"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Add Note
                </button>
              </div>
              
              {returnInfo.notes?.length > 0 ? (
                <div className="space-y-3">
                  {returnInfo.notes.map((note, index) => (
                    <div key={index} className={`p-3 rounded-lg ${note.isInternal ? 'bg-blue-50' : 'bg-gray-50'}`}>
                      <div className="flex justify-between items-start">
                        <p className="text-sm text-gray-900">{note.note}</p>
                        <div className="text-xs text-gray-500 ml-3">
                          {formatDate(note.addedAt)}
                        </div>
                      </div>
                      {note.addedBy && (
                        <p className="text-xs text-gray-500 mt-1">
                          Added by {note.addedBy.firstName} {note.addedBy.lastName}
                          {note.isInternal && ' (Internal)'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p>No notes added yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'communication' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-medium text-gray-900">Communication Log</h4>
                <button
                  onClick={() => setShowCommunicationModal(true)}
                  className="btn btn-primary btn-sm"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Log Communication
                </button>
              </div>
              
              {returnInfo.communication?.length > 0 ? (
                <div className="space-y-3">
                  {returnInfo.communication.map((comm, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {comm.type === 'email' && <Mail className="h-4 w-4 text-gray-400" />}
                            {comm.type === 'phone' && <Phone className="h-4 w-4 text-gray-400" />}
                            {comm.type === 'in_person' && <User className="h-4 w-4 text-gray-400" />}
                            {comm.type === 'system' && <AlertCircle className="h-4 w-4 text-gray-400" />}
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {comm.type.replace('_', ' ')}
                            </span>
                            {comm.recipient && (
                              <span className="text-sm text-gray-500">to {comm.recipient}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 mt-1">{comm.message}</p>
                        </div>
                        <div className="text-xs text-gray-500 ml-3">
                          {formatDate(comm.sentAt)}
                        </div>
                      </div>
                      {comm.sentBy && (
                        <p className="text-xs text-gray-500 mt-1">
                          Sent by {comm.sentBy.firstName} {comm.sentBy.lastName}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Phone className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p>No communication logged yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Close
          </button>
        </div>
      </div>

      {/* Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900">Add Note</h4>
              <button
                onClick={() => setShowNoteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Enter your note..."
                className="input"
                rows={4}
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">Internal note (not visible to customer)</span>
              </label>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowNoteModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                disabled={isLoading || !noteText.trim()}
                className="btn btn-primary"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : 'Add Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Communication Modal */}
      {showCommunicationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900">Log Communication</h4>
              <button
                onClick={() => setShowCommunicationModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={communicationData.type}
                  onChange={(e) => setCommunicationData(prev => ({ ...prev, type: e.target.value }))}
                  className="input"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="in_person">In Person</option>
                  <option value="system">System</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={communicationData.message}
                  onChange={(e) => setCommunicationData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Enter communication details..."
                  className="input"
                  rows={4}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient (Optional)
                </label>
                <input
                  type="text"
                  value={communicationData.recipient}
                  onChange={(e) => setCommunicationData(prev => ({ ...prev, recipient: e.target.value }))}
                  placeholder="e.g., customer email or phone"
                  className="input"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCommunicationModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCommunication}
                disabled={isLoading || !communicationData.message.trim()}
                className="btn btn-primary"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : 'Log Communication'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnDetailModal;
