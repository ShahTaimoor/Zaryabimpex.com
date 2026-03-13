import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import { useGetReturnQuery } from '../store/services/returnsApi';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { useIssueRefundMutation } from '../store/services/saleReturnsApi';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PrintModal, ReturnPrintContent } from './print';
import { showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { Button } from '@/components/ui/button';

const ReturnDetailModal = ({
  return: returnData,
  returnData: returnDataProp,
  isOpen,
  onClose,
  onStatusUpdate,
  onAddNote,
  onAddCommunication,
  onUpdate,
  isLoading
}) => {
  const actualReturnData = returnDataProp || returnData;
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showIssueRefundModal, setShowIssueRefundModal] = useState(false);
  const [issueRefundMethod, setIssueRefundMethod] = useState('cash');

  const [issueRefund, { isLoading: isIssuingRefund }] = useIssueRefundMutation();

  const { data: detailedReturn, isLoading: detailLoading } = useGetReturnQuery(
    actualReturnData?._id,
    { skip: !actualReturnData?._id || !isOpen }
  );

  const { companyInfo } = useCompanyInfo();
  const returnInfo = detailedReturn?.data || detailedReturn || actualReturnData;

  const getStatusColor = (status) => {
    const map = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800',
      received: 'bg-green-100 text-green-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (v) => {
    const n = Number(v);
    return isNaN(n) ? '0.00' : n.toFixed(2);
  };

  // Format address - can be string, object {street, city, state, country, zipCode, ...}, or array
  const formatAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (Array.isArray(addr)) {
      const a = addr.find(x => x.isDefault) || addr[0];
      return formatAddress(a);
    }
    if (typeof addr !== 'object') return String(addr);
    const parts = [
      addr.street || addr.address_line1 || addr.addressLine1 || addr.line1,
      addr.address_line2 || addr.addressLine2 || addr.line2,
      addr.city,
      addr.state || addr.province,
      addr.country,
      addr.zipCode || addr.zip || addr.postalCode || addr.postal_code
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handlePrint = () => setShowPrintModal(true);

  const handleIssueRefund = async () => {
    if (!returnInfo?._id && !returnInfo?.id) return;
    try {
      await issueRefund({ returnId: returnInfo._id || returnInfo.id, method: issueRefundMethod }).unwrap();
      showSuccessToast('Refund issued successfully');
      setShowIssueRefundModal(false);
      onUpdate?.();
      onStatusUpdate?.();
    } catch (err) {
      showErrorToast(err?.data?.message || err?.message || 'Failed to issue refund');
    }
  };

  const canIssueRefund = returnInfo?.origin === 'sales' &&
    (returnInfo?.refundMethod === 'deferred' || returnInfo?.refundMethod === 'none' || returnInfo?.refund_details?.refundMethod === 'deferred') &&
    !returnInfo?.refund_details?.refundPaidAt &&
    returnInfo?.status === 'processed';

  if (!isOpen || !returnInfo) return null;

  const companyName = companyInfo?.companyName || companyInfo?.data?.companyName || 'Your Company';
  const companyAddress = formatAddress(companyInfo?.address || companyInfo?.data?.address);
  const companyPhone = companyInfo?.contactNumber || companyInfo?.phone || companyInfo?.data?.contactNumber || '';
  const companyEmail = companyInfo?.email || companyInfo?.data?.email || '';

  const party = returnInfo.origin === 'purchase' ? returnInfo.supplier : returnInfo.customer;
  const partyName = returnInfo.origin === 'purchase'
    ? (party?.companyName || party?.businessName || party?.name || 'N/A')
    : (party?.businessName || party?.business_name || party?.displayName || party?.name ||
        [party?.firstName, party?.lastName].filter(Boolean).join(' ') || 'N/A');
  const partyEmail = party?.email || '';
  const partyPhone = party?.phone || '';
  const partyAddress = formatAddress(party?.address || party?.businessAddress);

  const origRef = returnInfo.origin === 'purchase'
    ? (returnInfo.originalOrder?.invoiceNumber || returnInfo.originalOrder?.poNumber || 'N/A')
    : (returnInfo.originalOrder?.orderNumber || returnInfo.originalOrder?.invoiceNumber || 'N/A');

  const docLabel = returnInfo.origin === 'purchase' ? 'Supplier' : 'Customer';
  const items = returnInfo.items || [];
  const netRefund = Number(returnInfo.netRefundAmount) || 0;

  return (
    <>
      {/* View Modal - Same design as Orders/Sales Invoices view */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {returnInfo.origin === 'purchase' ? 'Purchase' : 'Sale'} Return Details
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={handlePrint}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print</span>
                </button>
                <button
                  onClick={onClose}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Return Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">{companyName}</h1>
              {companyAddress && <p className="text-sm text-gray-600">{companyAddress}</p>}
              {(companyPhone || companyEmail) && (
                <p className="text-sm text-gray-600">
                  {[companyPhone && `Phone: ${companyPhone}`, companyEmail && `Email: ${companyEmail}`]
                    .filter(Boolean)
                    .join(' | ')}
                </p>
              )}
              <p className="text-lg text-gray-600">
                {returnInfo.origin === 'purchase' ? 'Purchase' : 'Sale'} Return
              </p>
            </div>

            {/* Details Grid - Same 3-column layout as Orders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              {/* Bill To / Return To */}
              <div>
                <h3 className="font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">
                  {docLabel}:
                </h3>
                <div className="space-y-1">
                  <p className="font-medium">{partyName}</p>
                  {partyEmail && <p className="text-gray-600">{partyEmail}</p>}
                  {partyPhone && <p className="text-gray-600">{partyPhone}</p>}
                  {partyAddress && <p className="text-gray-600">{partyAddress}</p>}
                </div>
              </div>

              {/* Return Information */}
              <div className="text-left md:text-center">
                <h3 className="font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">
                  Return Details:
                </h3>
                <div className="space-y-1">
                  <p><span className="font-medium">Return #:</span> {returnInfo.returnNumber || '—'}</p>
                  <p><span className="font-medium">Date:</span> {formatDate(returnInfo.returnDate)}</p>
                  <p><span className="font-medium">Original {returnInfo.origin === 'purchase' ? 'Invoice' : 'Order'}:</span> {origRef}</p>
                  <p><span className="font-medium">Type:</span> {(returnInfo.returnType || '—').replace('_', ' ')}</p>
                </div>
              </div>

              {/* Status & Refund */}
              <div className="text-left md:text-right">
                <h3 className="font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">
                  Status & Refund:
                </h3>
                <div className="space-y-1">
                  <p>
                    <span className="font-medium">Status:</span>{' '}
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(returnInfo.status)}`}>
                      {(returnInfo.status || '—').replace('_', ' ')}
                    </span>
                  </p>
                  <p><span className="font-medium">Priority:</span> {(returnInfo.priority || 'normal').replace('_', ' ')}</p>
                  <p><span className="font-medium">Refund Method:</span> {(returnInfo.refundMethod || '—').replace('_', ' ')}</p>
                  <p><span className="font-medium">Net Refund:</span> {formatCurrency(netRefund)}</p>
                  {returnInfo?.refund_details?.refundPaidAt && (
                    <p className="text-green-600 text-sm">
                      Paid on {formatDate(returnInfo.refund_details.refundPaidAt)}
                    </p>
                  )}
                  {canIssueRefund && (
                    <Button
                      onClick={() => setShowIssueRefundModal(true)}
                      variant="default"
                      size="sm"
                      className="mt-2"
                    >
                      Issue Refund
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table - Same style as Orders */}
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">Items:</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Qty</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Original Price</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Reason</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Condition</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? (
                      items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="border border-gray-300 px-4 py-2">
                            {item.product?.name || item.productName || 'Unknown'}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{item.quantity}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">
                            {formatCurrency(item.originalPrice || item.unitPrice)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {(item.returnReason || '—').replace('_', ' ')}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {(item.condition || '—').replace('_', ' ')}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right">
                            {formatCurrency(item.refundAmount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="border border-gray-300 px-4 py-2 text-center text-gray-500">
                          No items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals - Same style as Orders */}
            <div className="flex justify-end">
              <div className="w-80">
                <table className="w-full">
                  <tbody>
                    <tr>
                      <td className="px-4 py-2">Subtotal Refund:</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(returnInfo.totalRefundAmount || netRefund)}</td>
                    </tr>
                    {Number(returnInfo.totalRestockingFee) > 0 && (
                      <tr>
                        <td className="px-4 py-2">Restock Fee:</td>
                        <td className="px-4 py-2 text-right">-{formatCurrency(returnInfo.totalRestockingFee)}</td>
                      </tr>
                    )}
                    <tr className="border-t border-gray-300">
                      <td className="px-4 py-2 font-semibold">Net Refund:</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(netRefund)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Refund Modal */}
      {showIssueRefundModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Issue Refund</h4>
            <p className="text-sm text-gray-600 mb-4">
              Record payment for Return {returnInfo?.returnNumber}. Amount: {formatCurrency(returnInfo?.netRefundAmount)}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select
                value={issueRefundMethod}
                onChange={(e) => setIssueRefundMethod(e.target.value)}
                className="input w-full"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Check</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowIssueRefundModal(false)}>Cancel</Button>
              <Button onClick={handleIssueRefund} disabled={isIssuingRefund}>
                {isIssuingRefund ? <LoadingSpinner size="sm" /> : 'Issue Refund'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && (
        <PrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          documentTitle={`Return ${returnInfo?.returnNumber || 'Document'}`}
          zIndex={60}
          hasData={!!returnInfo}
          emptyMessage="No return data to print."
        >
          <ReturnPrintContent returnData={returnInfo} companyInfo={companyInfo} />
        </PrintModal>
      )}
    </>
  );
};

export default ReturnDetailModal;
