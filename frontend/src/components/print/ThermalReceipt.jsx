import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { getThermalCssVariables } from './thermalPrintConfig';
import './thermalReceipt.css';

/** Stable two-column row for thermal receipts (grid, not flex). */
export function ThermalReceiptRow({ label, value, className = '', valueClassName = '' }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={`thermal-receipt__row ${className}`.trim()}>
      <span className="thermal-receipt__row-label">{label}</span>
      <span className={`thermal-receipt__row-value ${valueClassName}`.trim()}>{value}</span>
    </div>
  );
}

const ThermalReceipt = ({
  companySettings = {},
  orderData = {},
  printSettings = {},
  documentTitle = 'Receipt',
  thermalConfig,
  items: itemsProp,
  subtotal = 0,
  discount = 0,
  tax = 0,
  shipping = 0,
  total = 0,
  receivedAmount = null,
  previousBalance = null,
  combinedRemainingBalance = null,
  showBalanceSummary = false,
  invoiceNumber: invoiceNumberProp,
  customerName,
  invoiceDate,
  notes: notesProp,
}) => {
  const barcodeRef = useRef(null);

  const {
    companyName = 'Store Name',
    address = '',
    contactNumber = '',
    email = '',
  } = companySettings;

  const receiptFooterText = printSettings?.receiptFooterText || '';

  const {
    showThermalCustomerName = true,
    showThermalPaidBy = true,
    showThermalBarcode = true,
    showThermalBarcodeValue = true,
    showThermalFooter = true,
    showThermalPrintDate = true,
  } = printSettings || {};

  const { customerInfo = {}, payment = {} } = orderData || {};

  const invoiceNumber =
    invoiceNumberProp ||
    orderData?.invoiceNumber ||
    orderData?.orderNumber ||
    orderData?.order_number ||
    orderData?.poNumber ||
    orderData?.referenceNumber ||
    orderData?.id ||
    orderData?._id ||
    'N/A';

  const resolvedCustomerName =
    customerName ||
    customerInfo?.name ||
    orderData?.customer?.name ||
    '';

  const resolvedDate =
    invoiceDate ||
    orderData?.sale_date ||
    orderData?.saleDate ||
    orderData?.createdAt;

  const notes = String(notesProp ?? orderData?.notes ?? '').trim();

  const items = Array.isArray(itemsProp) ? itemsProp : (orderData?.items || []);

  const cssVars = getThermalCssVariables(thermalConfig || {});

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return '-';
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  useEffect(() => {
    if (showThermalBarcode && barcodeRef.current && invoiceNumber && invoiceNumber !== 'N/A') {
      try {
        JsBarcode(barcodeRef.current, String(invoiceNumber), {
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
          flat: true,
        });
      } catch (error) {
        console.error('Barcode generation failed:', error);
      }
    }
  }, [invoiceNumber, showThermalBarcode, showThermalBarcodeValue]);

  const showSubtotal = Number(subtotal) > 0 && (Number(discount) > 0 || Number(tax) > 0);
  const showReceived = receivedAmount != null && Number(receivedAmount) >= 0;
  const invoiceBalance = Math.max(0, Number(total) - Number(receivedAmount || 0));

  return (
    <div className="thermal-receipt break-inside-avoid" style={cssVars}>
      <div className="thermal-receipt__header">
        <h1 className="thermal-receipt__store-name">{companyName}</h1>
        <div className="thermal-receipt__store-details">
          {address && <div>{address}</div>}
          {contactNumber && <div>Tel: {contactNumber}</div>}
          {email && <div>{email}</div>}
        </div>
      </div>

      <div className="thermal-receipt__divider" />

      <div className="thermal-receipt__info">
        <ThermalReceiptRow label={`${documentTitle}:`} value={invoiceNumber} />
        <ThermalReceiptRow label="Date:" value={formatDate(resolvedDate)} />
        {showThermalCustomerName && resolvedCustomerName && (
          <ThermalReceiptRow
            label="Customer:"
            value={resolvedCustomerName}
            valueClassName="thermal-receipt__row-value--wrap"
          />
        )}
        {notes && (
          <ThermalReceiptRow
            label="Notes:"
            value={notes}
            valueClassName="thermal-receipt__row-value--wrap"
          />
        )}
      </div>

      <div className="thermal-receipt__divider" />

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
            const price = item.unitPrice || item.unit_price || item.price || 0;
            const lineTotal =
              item.total ??
              item.lineTotal ??
              item.subtotal ??
              (Number(qty) * Number(price));
            return (
              <tr key={item.id || item._id || index}>
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
        {showSubtotal && (
          <ThermalReceiptRow label="Subtotal:" value={formatCurrency(subtotal)} />
        )}
        {Number(discount) > 0 && (
          <ThermalReceiptRow label="Discount:" value={`-${formatCurrency(discount)}`} />
        )}
        {Number(tax) > 0 && (
          <ThermalReceiptRow label="Tax:" value={formatCurrency(tax)} />
        )}
        {Number(shipping) > 0 && (
          <ThermalReceiptRow label="Shipping:" value={formatCurrency(shipping)} />
        )}
        <ThermalReceiptRow
          label="TOTAL:"
          value={formatCurrency(total)}
          className="thermal-receipt__summary-row--total"
        />
        {showReceived && (
          <ThermalReceiptRow label="Received:" value={formatCurrency(receivedAmount)} />
        )}
       
       
      </div>

      <div className="thermal-receipt__footer">
        {showThermalPaidBy && payment.method && (
          <ThermalReceiptRow label="Paid by:" value={payment.method} />
        )}
        {showThermalBarcode && (
          <>
            <div className="thermal-receipt__divider" />
            <div className="thermal-receipt__barcode">
              <canvas ref={barcodeRef} width="520" height="100" />
            </div>
          </>
        )}
        {showThermalFooter && (
          <>
            {receiptFooterText ? (
              <div className="thermal-receipt__custom-footer">{receiptFooterText}</div>
            ) : (
              <div>Thank You for Shopping!</div>
            )}
          </>
        )}
        {showThermalPrintDate && (
          <div className="thermal-receipt__print-date">{new Date().toLocaleString()}</div>
        )}
      </div>
    </div>
  );
};

export default ThermalReceipt;
