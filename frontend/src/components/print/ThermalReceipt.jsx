import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import './thermalReceipt.css';

const ThermalReceipt = ({
  companySettings = {},
  orderData = {},
  printSettings = {},
  documentTitle = 'Receipt',
  receivedAmount = null,
  previousBalance = null,
  combinedRemainingBalance = null,
  showBalanceSummary = false,
}) => {
  const barcodeRef = useRef(null);

  const {
    companyName = 'Store Name',
    address = '',
    contactNumber = '',
    email = ''
  } = companySettings;
  const receiptFooterText = printSettings?.receiptFooterText || '';

  const {
    showThermalCustomerName = true,
    showThermalPaidBy = true,
    showThermalBarcode = true,
    showThermalBarcodeValue = true,
    showThermalFooter = true,
    showThermalPrintDate = true
  } = printSettings || {};

  const {
    createdAt = new Date(),
    sale_date,
    items = [],
    pricing = {},
    customerInfo = {},
    payment = {}
  } = orderData;

  const invoiceNumber =
    orderData?.invoiceNumber ||
    orderData?.orderNumber ||
    orderData?.order_number ||
    orderData?.poNumber ||
    orderData?.referenceNumber ||
    orderData?.id ||
    orderData?._id ||
    'N/A';

  const discount = pricing.discountAmount || pricing.discount || orderData.discount || 0;
  const tax = pricing.taxAmount || orderData.tax || 0;
  const shipping = pricing.shipping || 0;
  const total = pricing.total || orderData.total || 0;
  const notes = String(orderData.notes || '').trim();

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (value) => {
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  useEffect(() => {
    if (showThermalBarcode && barcodeRef.current && invoiceNumber && invoiceNumber !== 'N/A') {
      try {
        JsBarcode(barcodeRef.current, invoiceNumber, {
          format: 'CODE128',
          width: 2,
          height: 40,
          displayValue: showThermalBarcodeValue,
          fontSize: 9,
          margin: 2,
          marginLeft: 4,
          marginRight: 4,
          marginTop: 2,
          marginBottom: 2,
          textMargin: 1,
          lineColor: '#000000',
          background: '#ffffff',
          textAlign: 'center',
          flat: true
        });
      } catch (error) {
        console.error('Barcode generation failed:', error);
      }
    }
  }, [invoiceNumber, showThermalBarcode, showThermalBarcodeValue]);

  return (
    <div className="thermal-receipt break-inside-avoid">
      <div className="thermal-receipt__header">
        <h1 className="thermal-receipt__store-name">{companyName}</h1>
        <div className="thermal-receipt__store-details">
          {address && <div>{address}</div>}
          {contactNumber && <div>Tel: {contactNumber}</div>}
          {email && <div>{email}</div>}
        </div>
      </div>

      <div className="thermal-receipt__divider"></div>

      <div className="thermal-receipt__info">
        <div className="thermal-receipt__info-row">
          <span>{documentTitle}:</span>
          <span>{invoiceNumber}</span>
        </div>
        <div className="thermal-receipt__info-row">
          <span>Date:</span>
          <span>{formatDate(sale_date || createdAt)}</span>
        </div>
        {showThermalCustomerName && customerInfo?.name && (
          <div className="thermal-receipt__info-row">
            <span>Customer:</span>
            <span>{customerInfo.name}</span>
          </div>
        )}
        {notes && (
          <div className="thermal-receipt__info-row thermal-receipt__info-row--notes">
            <span>Notes:</span>
            <span className="thermal-receipt__notes-value">{notes}</span>
          </div>
        )}
      </div>

      <div className="thermal-receipt__divider"></div>

      <table className="thermal-receipt__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const qty = item.quantity || item.qty || 0;
            const price = item.unitPrice || item.price || 0;
            const lineTotal = item.total || (qty * price);
            return (
              <tr key={index}>
                <td>{index + 1}</td>
                <td className="thermal-receipt__item-name">
                  {item.product?.name || item.name || `Item ${index + 1}`}
                </td>
                <td>{qty}</td>
                <td>{formatCurrency(price)}</td>
                <td>{formatCurrency(lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="thermal-receipt__summary">
        {discount > 0 && (
          <div className="thermal-receipt__summary-row">
            <span>Discount:</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="thermal-receipt__summary-row">
            <span>Tax:</span>
            <span>{formatCurrency(tax)}</span>
          </div>
        )}
        {shipping > 0 && (
          <div className="thermal-receipt__summary-row">
            <span>Shipping:</span>
            <span>{formatCurrency(shipping)}</span>
          </div>
        )}
        <div className="thermal-receipt__summary-row thermal-receipt__summary-row--total">
          <span>TOTAL:</span>
          <span>{formatCurrency(total)}</span>
        </div>
        {receivedAmount != null && Number(receivedAmount) > 0 && (
          <div className="thermal-receipt__summary-row">
            <span>Received:</span>
            <span>{formatCurrency(receivedAmount)}</span>
          </div>
        )}
        {showBalanceSummary && previousBalance != null && (
          <div className="thermal-receipt__summary-row">
            <span>Prev. Balance:</span>
            <span>{formatCurrency(previousBalance)}</span>
          </div>
        )}
        {showBalanceSummary && combinedRemainingBalance != null && (
          <div className="thermal-receipt__summary-row thermal-receipt__summary-row--total">
            <span>Remaining Balance:</span>
            <span>{formatCurrency(combinedRemainingBalance)}</span>
          </div>
        )}
      </div>

      <div className="thermal-receipt__footer">
        {showThermalPaidBy && payment.method && (
          <div className="thermal-receipt__info-row">
            <span>Paid by:</span>
            <span>{payment.method}</span>
          </div>
        )}
        {showThermalBarcode && (
          <>
            <div className="thermal-receipt__divider"></div>
            <div className="thermal-receipt__barcode">
              <canvas ref={barcodeRef} width="520" height="100"></canvas>
            </div>
          </>
        )}
        {showThermalFooter && (
          <>
            {receiptFooterText && (
              <div className="thermal-receipt__custom-footer">
                {receiptFooterText}
              </div>
            )}
            {!receiptFooterText && <div>Thank You for Shopping!</div>}
          </>
        )}
        {showThermalPrintDate && (
          <div style={{ fontSize: '9px', marginTop: '2mm' }}>
            {new Date().toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThermalReceipt;
