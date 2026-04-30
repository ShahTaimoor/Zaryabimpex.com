import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import './thermalReceipt.css';

const ThermalReceipt = ({
  companySettings = {},
  orderData = {},
  printSettings = {},
  documentTitle = 'Receipt'
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
    if (barcodeRef.current && invoiceNumber && invoiceNumber !== 'N/A') {
      try {
        JsBarcode(barcodeRef.current, invoiceNumber, {
          format: 'CODE128',
          width: 2,
          height: 56,
          displayValue: true,
          fontSize: 11,
          margin: 4,
          marginLeft: 6,
          marginRight: 6,
          marginTop: 4,
          marginBottom: 4,
          textMargin: 2,
          lineColor: '#000000',
          background: '#ffffff',
          textAlign: 'center',
          flat: true
        });
      } catch (error) {
        console.error('Barcode generation failed:', error);
      }
    }
  }, [invoiceNumber]);

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
        {customerInfo?.name && (
          <div className="thermal-receipt__info-row">
            <span>Customer:</span>
            <span>{customerInfo.name}</span>
          </div>
        )}
      </div>

      <div className="thermal-receipt__divider"></div>

      <table className="thermal-receipt__table">
        <thead>
          <tr>
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
      </div>

      <div className="thermal-receipt__footer">
        {payment.method && (
          <div className="thermal-receipt__info-row">
            <span>Paid by:</span>
            <span>{payment.method}</span>
          </div>
        )}
        <div className="thermal-receipt__divider"></div>
        <div className="thermal-receipt__barcode">
          <canvas ref={barcodeRef} width="520" height="140"></canvas>
        </div>
        {receiptFooterText && (
          <div className="thermal-receipt__custom-footer">
            {receiptFooterText}
          </div>
        )}
        {!receiptFooterText && <div>Thank You for Shopping!</div>}
        <div style={{ fontSize: '9px', marginTop: '2mm' }}>
          {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default ThermalReceipt;
