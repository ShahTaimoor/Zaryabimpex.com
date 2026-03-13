import React from 'react';

/**
 * ReturnPrintContent - Printable return document.
 * Replaces inline window.open() HTML in Returns and ReturnDetailModal.
 */
const ReturnPrintContent = ({
  returnData,
  companyInfo = {},
  partyLabel = 'Customer'
}) => {
  if (!returnData) return null;

  const companyName = companyInfo?.companyName || companyInfo?.data?.companyName || 'Your Company Name';
  const address = companyInfo?.address || companyInfo?.data?.address || '';
  const contactNumber = companyInfo?.contactNumber || companyInfo?.phone || companyInfo?.data?.contactNumber || '';
  const email = companyInfo?.email || companyInfo?.data?.email || '';

  const party = returnData.origin === 'purchase' ? returnData.supplier : returnData.customer;
  const partyName = returnData.origin === 'purchase'
    ? (party?.companyName || party?.company_name || party?.businessName || party?.business_name || party?.name || 'N/A')
    : (party?.businessName || party?.business_name || party?.displayName || party?.name ||
        (party?.firstName || party?.lastName ? `${party.firstName || ''} ${party.lastName || ''}`.trim() : null) || 'N/A');
  const partyEmail = party?.email || 'N/A';
  const partyPhone = party?.phone || 'N/A';

  const formatDate = (d) => {
    if (!d) return 'N/A';
    const date = new Date(d);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
  };

  const formatCurrency = (v) => {
    const n = Number(v);
    return isNaN(n) ? '0.00' : n.toFixed(2);
  };

  const items = returnData.items || [];
  const totalRefund = Number(returnData.totalRefundAmount) ||
    items.reduce((s, i) => s + (Number(i.refundAmount) || 0), 0);
  const totalRestock = Number(returnData.totalRestockingFee) ||
    items.reduce((s, i) => s + (Number(i.restockingFee) || 0), 0);
  const netRefund = Number(returnData.netRefundAmount) ?? (totalRefund - totalRestock);

  const docLabel = returnData.origin === 'purchase' ? 'Supplier' : 'Customer';
  const origLabel = returnData.origin === 'purchase' ? 'Invoice' : 'Order';
  const origRef = returnData.origin === 'purchase'
    ? (returnData.originalOrder?.invoiceNumber || returnData.originalOrder?.poNumber || 'N/A')
    : (returnData.originalOrder?.orderNumber || returnData.originalOrder?.invoiceNumber || 'N/A');

  return (
    <div className="print-document return-print-content">
      <div className="print-header text-center mb-4 pb-2 border-b border-gray-300">
        <h1 className="text-lg font-bold">{companyName}</h1>
        <p className="text-xs text-gray-600 mt-1">
          {[address, contactNumber, email].filter(Boolean).join(' | ')}
        </p>
        <p className="text-sm font-semibold mt-2">RETURN DOCUMENT</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            {returnData.origin === 'sales' && (party?.businessName || party?.business_name) && (
              <p><span className="font-medium">Business Name:</span> {party.businessName || party.business_name}</p>
            )}
        <div>
          <h3 className="font-semibold mb-2 border-b border-gray-200 pb-1">{docLabel.toUpperCase()} DETAILS</h3>
          <div className="space-y-1">
            <p><span className="font-medium">Name:</span> {partyName}</p>
            <p><span className="font-medium">Email:</span> {partyEmail}</p>
            <p><span className="font-medium">Phone:</span> {partyPhone}</p>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-2 border-b border-gray-200 pb-1">RETURN DETAILS</h3>
          <div className="space-y-1">
            <p><span className="font-medium">Return #:</span> {returnData.returnNumber}</p>
            <p><span className="font-medium">Original {origLabel}:</span> {origRef}</p>
            <p><span className="font-medium">Status:</span> {(returnData.status || 'PENDING').toUpperCase()}</p>
            <p><span className="font-medium">Priority:</span> {(returnData.priority || 'NORMAL').toUpperCase()}</p>
            <p><span className="font-medium">Return Date:</span> {formatDate(returnData.returnDate)}</p>
            <p><span className="font-medium">Refund Method:</span> {(returnData.refundMethod || 'Original Payment').replace('_', ' ').toUpperCase()}</p>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-gray-800 p-2 text-left">Product</th>
            <th className="border border-gray-800 p-2 text-center">Qty</th>
            <th className="border border-gray-800 p-2 text-right">Original Price</th>
            <th className="border border-gray-800 p-2">Reason</th>
            <th className="border border-gray-800 p-2">Condition</th>
            <th className="border border-gray-800 p-2 text-right">Refund</th>
            <th className="border border-gray-800 p-2 text-right">Restock Fee</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan="7" className="border border-gray-800 p-2 text-center">No items</td>
            </tr>
          ) : (
            items.map((item, i) => (
              <tr key={i}>
                <td className="border border-gray-800 p-2">{item.product?.name || 'N/A'}</td>
                <td className="border border-gray-800 p-2 text-center">{item.quantity || 0}</td>
                <td className="border border-gray-800 p-2 text-right">{formatCurrency(item.originalPrice)}</td>
                <td className="border border-gray-800 p-2">{(item.returnReason || 'N/A').replace('_', ' ')}</td>
                <td className="border border-gray-800 p-2">{(item.condition || 'N/A').toUpperCase()}</td>
                <td className="border border-gray-800 p-2 text-right">{formatCurrency(item.refundAmount)}</td>
                <td className="border border-gray-800 p-2 text-right">{formatCurrency(item.restockingFee)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-4 text-right space-y-1 text-sm">
        <p><span className="font-semibold">Total Refund:</span> {formatCurrency(totalRefund)}</p>
        <p><span className="font-semibold">Total Restocking Fee:</span> {formatCurrency(totalRestock)}</p>
        <p className="font-bold text-base"><span>Net Refund:</span> {formatCurrency(netRefund)}</p>
      </div>

      {returnData.generalNotes && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Notes</h3>
          <p className="text-sm text-gray-700">{returnData.generalNotes}</p>
        </div>
      )}

      <div className="print-footer mt-6 pt-4 border-t border-gray-300 text-center text-xs text-gray-600">
        <p>Generated on {new Date().toLocaleString()}</p>
        <p className="mt-1 font-semibold">{companyName}</p>
      </div>
    </div>
  );
};

export default ReturnPrintContent;
