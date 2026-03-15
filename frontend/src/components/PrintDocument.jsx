import React, { useMemo } from 'react';

const PrintDocument = ({
    companySettings,
    orderData,
    printSettings,
    documentTitle = 'Invoice',
    partyLabel = 'Customer',
    children
}) => {
    const {
        showLogo = true,
        showCompanyDetails = true,
        showTax = true,
        showDiscount = true,
        showFooter = true,
        showDate = true,
        showEmail = true,
        showCameraTime = false,
        showDescription = true,
        showPrintBusinessName = true,
        showPrintContactName = true,
        showPrintAddress = true,
        showPrintCity = true,
        showPrintState = true,
        showPrintPostalCode = true,
        showPrintInvoiceNumber = true,
        showPrintInvoiceDate = true,
        showPrintInvoiceStatus = true,
        showPrintInvoiceType = true,
        showPrintPaymentStatus = true,
        showPrintPaymentMethod = true,
        showPrintPaymentAmount = true,
        headerText = '',
        footerText = '',
        invoiceLayout = 'standard'
    } = printSettings || {};

    const formatDate = (date) =>
        new Date(date || new Date()).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

    const formatDateTime = (date) =>
        new Date(date || new Date()).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

    const formatCurrency = (value) => {
        if (value === undefined || value === null || isNaN(value)) return '-';
        return Number(value).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    };

    const toNumber = (value, fallback = 0) => {
        if (value === undefined || value === null) return fallback;
        const num = typeof value === 'number' ? value : parseFloat(value);
        return Number.isFinite(num) ? num : fallback;
    };

    const formatText = (value, fallback = 'N/A') =>
        value && String(value).trim() !== '' ? value : fallback;

    const partyHeaderLabel =
        partyLabel?.toLowerCase() === 'supplier' ? 'Supplier' : 'Bill To';

    // Fallback for companySettings if null
    const safeCompanySettings = companySettings || {};

    const resolvedCompanyName =
        safeCompanySettings.companyName || 'Your Company Name';
    const resolvedDocumentTitle = documentTitle || 'Invoice';
    const resolvedCompanySubtitle = resolvedDocumentTitle;
    const resolvedCompanyAddress = safeCompanySettings.address || '';
    const resolvedCompanyPhone = safeCompanySettings.contactNumber || safeCompanySettings.phone || '';

    const partyInfo = useMemo(() => {
        if (!orderData) {
            return {
                name: 'Walk-in Customer',
                email: 'N/A',
                phone: 'N/A',
                extra: '',
                address: '',
                street: '',
                city: '',
                state: '',
                postalCode: ''
            };
        }

        // Party: customer (sales) or supplier (purchase). Prefer explicit customerInfo/supplierInfo for stored snapshot.
        const info = orderData.customerInfo || orderData.supplierInfo || {};
        const fullParty = (typeof orderData.customer === 'object' ? orderData.customer : null) ||
            (typeof orderData.supplier === 'object' ? orderData.supplier : null) || {};

        // Merge them, preferring info for basic details but keeping balance from fullParty if missing in info
        const customer = { ...fullParty, ...info };

        const composedName =
            customer.name ||
            customer.displayName ||
            customer.businessName ||
            customer.companyName ||
            customer.fullName ||
            '—';
        const businessName =
            customer.businessName ||
            customer.companyName ||
            orderData.customerInfo?.businessName ||
            orderData.customer?.businessName ||
            '';

        // Get customer/supplier address: addresses array (with street/city/state/postalCode), then full string fallback
        let customerAddress = '';
        let street = '';
        let city = '';
        let state = '';
        let postalCode = '';
        const pickAddr = (defaultAddress) => {
            if (!defaultAddress) return;
            street = defaultAddress.street || '';
            city = defaultAddress.city || '';
            state = defaultAddress.state || '';
            postalCode = defaultAddress.zipCode || defaultAddress.zip || defaultAddress.postalCode || '';
            customerAddress = [street, city, state, defaultAddress.country, postalCode].filter(Boolean).join(', ');
        };
        if (customer.addresses && Array.isArray(customer.addresses) && customer.addresses.length > 0) {
            const defaultAddress = customer.addresses.find(addr => addr.isDefault) ||
                customer.addresses.find(addr => addr.type === 'billing' || addr.type === 'both') ||
                customer.addresses[0];
            pickAddr(defaultAddress);
        }
        if (!customerAddress) {
            const refParty = orderData.customer || orderData.supplier;
            if (refParty?.addresses && Array.isArray(refParty.addresses) && refParty.addresses.length > 0) {
                const defaultAddress = refParty.addresses.find(addr => addr.isDefault) ||
                    refParty.addresses.find(addr => addr.type === 'billing' || addr.type === 'both') ||
                    refParty.addresses[0];
                pickAddr(defaultAddress);
            }
        }
        if (!customerAddress) {
            customerAddress =
                customer.address ||
                customer.location ||
                customer.companyAddress ||
                customer.billingAddress ||
                orderData.customerInfo?.address ||
                orderData.supplierInfo?.address ||
                orderData.shippingAddress ||
                orderData.billingAddress ||
                '';
        }

        return {
            name: composedName,
            email: customer.email || 'N/A',
            phone: customer.phone || 'N/A',
            extra: businessName,
            address: customerAddress,
            street,
            city,
            state,
            postalCode,
            balance: customer.currentBalance !== undefined
                ? customer.currentBalance
                : ((toNumber(customer.pendingBalance || 0)) - (toNumber(customer.advanceBalance || 0)))
        };
    }, [orderData]);

    const items = Array.isArray(orderData?.items) ? orderData.items : [];

    const computedSubtotal =
        orderData?.pricing?.subtotal ??
        orderData?.subtotal ??
        items.reduce((sum, item) => {
            const qty = toNumber(item.quantity ?? item.qty, 0);
            const price = toNumber(
                item.unitPrice ?? item.price ?? item.unitCost ?? item.rate,
                0
            );
            return sum + qty * price;
        }, 0);

    const discountValue =
        orderData?.pricing?.discountAmount ??
        orderData?.discount ??
        orderData?.pricing?.discount ??
        0;
    const taxValue =
        orderData?.pricing?.taxAmount ??
        orderData?.tax ??
        (orderData?.pricing?.isTaxExempt ? 0 : 0);
    const totalValue =
        orderData?.pricing?.total ??
        orderData?.total ??
        computedSubtotal - toNumber(discountValue) + toNumber(taxValue);

    const documentNumber =
        orderData?.invoiceNumber ||
        orderData?.orderNumber ||
        orderData?.poNumber ||
        orderData?.referenceNumber ||
        orderData?._id ||
        'N/A';

    const documentStatus =
        orderData?.status ||
        orderData?.orderStatus ||
        orderData?.invoiceStatus ||
        orderData?.payment?.status ||
        'Pending';

    const documentType =
        orderData?.orderType ||
        orderData?.type ||
        resolvedDocumentTitle ||
        'Invoice';

    const paymentStatus =
        orderData?.payment?.status ||
        (orderData?.payment?.isPartialPayment
            ? 'Partial'
            : orderData?.payment?.remainingBalance > 0
                ? 'Pending'
                : orderData?.payment?.amountPaid
                    ? 'Paid'
                    : orderData?.payment?.method
                        ? 'Pending'
                        : 'N/A');

    const paymentMethod = orderData?.payment?.method || 'N/A';
    const paymentAmount =
        orderData?.payment?.amountPaid ??
        orderData?.pricing?.total ??
        orderData?.total ??
        0;

    const generatedAt = new Date();

    const billToLines = [
        showPrintContactName ? { label: 'Name:', value: partyInfo.name } : null,
        showPrintBusinessName && partyInfo.extra ? { label: 'Business:', value: partyInfo.extra } : null,
        showEmail && partyInfo.email !== 'N/A' ? { label: 'Email:', value: partyInfo.email } : null,
        partyInfo.phone !== 'N/A' ? { label: 'Phone:', value: partyInfo.phone } : null,
        showPrintAddress && (partyInfo.street || partyInfo.address) ? { label: 'Address:', value: (partyInfo.street || partyInfo.address) } : null,
        showPrintCity && partyInfo.city ? { label: 'City:', value: partyInfo.city } : null,
        showPrintState && partyInfo.state ? { label: 'State:', value: partyInfo.state } : null,
        showPrintPostalCode && partyInfo.postalCode ? { label: 'Postal:', value: partyInfo.postalCode } : null
    ].filter(Boolean);

    const invoiceDetailLines = [
        showPrintInvoiceNumber ? { label: 'Invoice #:', value: formatText(documentNumber) } : null,
        (showPrintInvoiceDate && showDate) ? { label: 'Date:', value: formatDate(orderData?.createdAt || orderData?.invoiceDate) } : null,
        showPrintInvoiceStatus ? { label: 'Status:', value: formatText(documentStatus) } : null,
        showPrintInvoiceType ? { label: 'Type:', value: formatText(documentType) } : null
    ].filter(Boolean);

    const paymentDetailLines = [
        showPrintPaymentStatus ? { label: 'Status:', value: formatText(paymentStatus) } : null,
        showPrintPaymentMethod ? { label: 'Method:', value: formatText(paymentMethod) } : null,
        showPrintPaymentAmount ? { label: 'Amount:', value: formatCurrency(paymentAmount) } : null
    ].filter(Boolean);

    const hasCameraTime = orderData?.billStartTime || orderData?.billEndTime;

    // ==========================================
    // Layout 2 (Professional Boxed Layout)
    // ==========================================
    if (invoiceLayout === 'layout2') {
        const totalReceivables = toNumber(totalValue) + toNumber(partyInfo.balance || 0);

        return (
            <div className="print-document print-document--layout2">
                {children}

                {/* Header Section */}
                <div className="layout2-header">
                    <div className="grid grid-cols-12 gap-4 items-center mb-2">
                        <div className="col-span-2">
                            {showLogo && safeCompanySettings.logo && (
                                <img
                                    src={safeCompanySettings.logo}
                                    alt="Logo"
                                    className="max-h-20 w-auto object-contain"
                                />
                            )}
                        </div>
                        <div className="col-span-8 text-center">
                            <h1 className="layout2-company-name italic font-bold text-4xl mb-1">
                                {resolvedCompanyName}
                            </h1>
                            <div className="layout2-company-address italic text-sm">
                                {resolvedCompanyAddress}
                            </div>
                            <div className="layout2-company-phone italic text-sm">
                                Phone # {resolvedCompanyPhone}
                            </div>
                        </div>
                        <div className="col-span-2"></div>
                    </div>
                    <div className="border-b-2 border-black w-full mb-6"></div>
                </div>

                {/* Info Boxes */}
                <div className="grid grid-cols-12 gap-0 mb-6 border-t border-l border-black">
                    <div className="col-span-8 p-2 border-r border-b border-black font-medium">
                        Customer: <span className="uppercase">{partyInfo.name}</span> {partyInfo.phone !== 'N/A' && partyInfo.phone}
                    </div>
                    <div className="col-span-4 p-2 border-r border-b border-black font-medium text-right">
                        Invoice Date: {formatDate(orderData?.createdAt || orderData?.invoiceDate)}
                    </div>
                    <div className="col-span-8 p-2 border-r border-b border-black font-medium min-h-[40px]">
                        Address: {partyInfo.address}
                    </div>
                    <div className="col-span-4 p-2 border-r border-b border-black font-medium text-right italic">
                        Invoice No: {documentNumber}
                    </div>
                </div>

                {/* Items Table */}
                <table className="layout2-table w-full border-collapse mb-0">
                    <thead>
                        <tr>
                            <th className="border border-black p-1 text-center w-[60px]">S.No</th>
                            <th className="border border-black p-1 text-center">Product Name</th>
                            <th className="border border-black p-1 text-center w-[100px]">Quantity</th>
                            <th className="border border-black p-1 text-center w-[120px]">Price</th>
                            <th className="border border-black p-1 text-center w-[150px]">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            const qty = toNumber(item.quantity ?? item.qty, 0);
                            const price = toNumber(
                                item.unitPrice ?? item.price ?? item.unitCost ?? item.rate,
                                0
                            );
                            const lineTotal = toNumber(item.total ?? item.lineTotal ?? item.totalPrice ?? item.totalCost, qty * price);
                            return (
                                <tr key={index}>
                                    <td className="border border-black p-1 text-center">{index + 1}</td>
                                    <td className="border border-black p-1 uppercase">{item.product?.name || item.name || `Item ${index + 1}`}</td>
                                    <td className="border border-black p-1 text-center">{formatCurrency(qty)}</td>
                                    <td className="border border-black p-1 text-right">{formatCurrency(price)}</td>
                                    <td className="border border-black p-1 text-right">{formatCurrency(lineTotal)}</td>
                                </tr>
                            );
                        })}
                        {/* Summary Footer of Table */}
                        <tr className="font-bold">
                            <td colSpan="4" className="border border-black p-1 text-right">Total</td>
                            <td className="border border-black p-1 text-right">{formatCurrency(computedSubtotal)}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Bottom Section */}
                <div className="grid grid-cols-12 gap-0 mt-0">
                    <div className="col-span-8 p-4 italic">
                        <div className="mb-2">
                            Printed By: <span className="underline font-bold uppercase">{orderData?.createdBy?.firstName || (orderData?.createdBy?.name ? orderData.createdBy.name.split(' ')[0] : 'ADMIN')}</span>
                        </div>
                        <div>
                            Entry Date Time: {formatDateTime(orderData?.createdAt || orderData?.invoiceDate)}
                        </div>
                        <div className="mb-6">
                            Print Date Time: {formatDateTime(generatedAt)}
                        </div>
                        <div className="urdu-note text-right font-bold text-lg mt-8" dir="rtl">
                            نوٹ: پلٹی شدہ مال کی ٹوٹ پھوٹ کی ذمہ داری نہیں ہو گی۔ مال دوکان میں چیک
                        </div>
                    </div>
                    <div className="col-span-4">
                        <table className="w-full border-collapse border-l border-black">
                            <tbody>
                                <tr>
                                    <td className="border-b border-r border-black p-1 text-right font-bold">Invoice Discount</td>
                                    <td className="border-b border-r border-black p-1 text-right">{formatCurrency(discountValue)}</td>
                                </tr>
                                <tr>
                                    <td className="border-b border-r border-black p-1 text-right font-bold">Net Amount</td>
                                    <td className="border-b border-r border-black p-1 text-right font-bold">{formatCurrency(totalValue)}</td>
                                </tr>
                                <tr>
                                    <td className="border-b border-r border-black p-1 text-right font-bold">Received Amount</td>
                                    <td className="border-b border-r border-black p-1 text-right">{formatCurrency(orderData?.payment?.amountPaid || 0)}</td>
                                </tr>
                                <tr>
                                    <td className="border-b border-r border-black p-1 text-right font-bold">Invoice Balance</td>
                                    <td className="border-b border-r border-black p-1 text-right">{formatCurrency(toNumber(totalValue) - toNumber(orderData?.payment?.amountPaid || 0))}</td>
                                </tr>
                                <tr>
                                    <td className="border-b border-r border-black p-1 text-right font-bold">Previous Balance</td>
                                    <td className="border-b border-r border-black p-1 text-right">{formatCurrency(partyInfo.balance || 0)}</td>
                                </tr>
                                <tr>
                                    <td className="border-b border-r border-black p-1 text-right font-bold">Total Receivables</td>
                                    <td className="border-b border-r border-black p-1 text-right font-bold">{formatCurrency(totalReceivables)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="print-document">
            {/* Option to inject content (like toolbar) at the top that is hidden in print via CSS if needed */}
            {children}

            {/* Header Text */}
            {headerText && (
                <div className="text-center text-sm text-gray-600 mb-4 pb-2 border-b border-gray-100">
                    {headerText}
                </div>
            )}

            {/* Company Header - logo from Redux/companySettings, placeholder when none */}
            <div className="print-document__company">
                {showLogo && (
                    <div className="print-document__logo-wrap">
                        {safeCompanySettings.logo ? (
                            <img
                                src={safeCompanySettings.logo}
                                alt="Company Logo"
                                className="print-document__logo-img"
                            />
                        ) : (
                            <div className="print-document__logo-placeholder" aria-hidden>
                                {resolvedCompanyName
                                    ? resolvedCompanyName.charAt(0).toUpperCase()
                                    : '?'}
                            </div>
                        )}
                    </div>
                )}

                <div className="print-document__company-details">
                    <div className="print-document__company-name">{resolvedCompanyName}</div>
                    {showCompanyDetails && (
                        <div className="print-document__company-subtitle">{resolvedCompanySubtitle}</div>
                    )}
                </div>
            </div>

            <div className="print-document__info-grid">
                <div className="print-document__info-block">
                    <div className="print-document__section-label">{partyHeaderLabel}:</div>
                    {billToLines.map((line, idx) => (
                        <div key={`bill-${idx}`} className="print-document__info-line">
                            <span className="print-document__info-label">{line.label}</span>
                            <span className="print-document__info-value">{line.value}</span>
                        </div>
                    ))}
                </div>
                {invoiceDetailLines.length > 0 && (
                    <div className="print-document__info-block">
                        <div className="print-document__section-label">Invoice Details:</div>
                        {invoiceDetailLines.map((line, idx) => (
                            <div key={`inv-${idx}`} className="print-document__info-line">
                                <span className="print-document__info-label">{line.label}</span>
                                <span className="print-document__info-value">{line.value}</span>
                            </div>
                        ))}
                    </div>
                )}
                {paymentDetailLines.length > 0 && (
                    <div className="print-document__info-block">
                        <div className="print-document__section-label">Payment:</div>
                        {paymentDetailLines.map((line, idx) => (
                            <div key={`pay-${idx}`} className="print-document__info-line">
                                <span className="print-document__info-label">{line.label}</span>
                                <span className="print-document__info-value">{line.value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* CCTV Camera Time Section */}
            {/* We only show if hasCameraTime AND showCameraTime are true. 
          In Preview mode (Settings), we might want to force showing it if the toggle is ON, 
          using fake data if orderData doesn't have it. 
          But for now let's respect the props. Settings.jsx will pass an orderData with camera time if it wants to demo it.
      */}
            {hasCameraTime && showCameraTime && (
                <div className="print-document__info-grid mt-4">
                    <div className="print-document__info-block" style={{ gridColumn: '1 / -1' }}>
                        <div className="print-document__section-label" style={{ color: '#2563eb', borderTop: '2px solid #93c5fd', paddingTop: '12px' }}>
                            Camera Time
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                            {orderData.billStartTime && (
                                <div className="print-document__info-line">
                                    <span className="print-document__info-label">From:</span>
                                    <span className="print-document__info-value">
                                        {formatDateTime(orderData.billStartTime)}
                                    </span>
                                </div>
                            )}
                            {orderData.billEndTime && (
                                <div className="print-document__info-line">
                                    <span className="print-document__info-label">To:</span>
                                    <span className="print-document__info-value">
                                        {formatDateTime(orderData.billEndTime)}
                                    </span>
                                </div>
                            )}
                            {orderData.billStartTime && orderData.billEndTime && (
                                <div className="print-document__info-line" style={{ fontSize: '11px', color: '#6b7280' }}>
                                    <span className="print-document__info-label">Duration:</span>
                                    <span className="print-document__info-value">
                                        {Math.round((new Date(orderData.billEndTime) - new Date(orderData.billStartTime)) / 1000)} seconds
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="print-document__section-label mt-6">Items:</div>

            <table className="print-document__table mt-3">
                <thead>
                    <tr>
                        <th>Item</th>
                        {showDescription && <th>Description</th>}
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={showDescription ? "5" : "4"} style={{ textAlign: 'center' }}>
                                No items available
                            </td>
                        </tr>
                    )}
                    {items.map((item, index) => {
                        const qty = toNumber(item.quantity ?? item.qty, 0);
                        const price = toNumber(
                            item.unitPrice ?? item.price ?? item.unitCost ?? item.costPerUnit ?? item.rate,
                            0
                        );
                        const lineTotal = toNumber(item.total ?? item.lineTotal ?? item.totalPrice ?? item.totalCost, qty * price);
                        return (
                            <tr key={index}>
                                <td>{item.product?.name || item.name || `Item ${index + 1}`}</td>
                                {showDescription && (
                                    <td>
                                        {item.product?.description ||
                                            item.description ||
                                            item.notes ||
                                            '—'}
                                    </td>
                                )}
                                <td>{formatCurrency(qty)}</td>
                                <td>{formatCurrency(price)}</td>
                                <td>{formatCurrency(lineTotal)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="print-document__summary">
                <div className="print-document__summary-table">
                    <div className="print-document__summary-row">
                        <span>Subtotal</span>
                        <span>{formatCurrency(computedSubtotal)}</span>
                    </div>
                    {showTax && (
                        <div className="print-document__summary-row">
                            <span>Tax</span>
                            <span>{formatCurrency(taxValue)}</span>
                        </div>
                    )}
                    {showDiscount && (
                        <div className="print-document__summary-row">
                            <span>Discount</span>
                            <span>{formatCurrency(discountValue)}</span>
                        </div>
                    )}
                    <div className="print-document__summary-row print-document__summary-row--total">
                        <span>Total</span>
                        <span>{formatCurrency(totalValue)}</span>
                    </div>
                </div>
            </div>

            {showFooter && (
                <div className="print-document__footer">
                    <div className="print-document__generated">
                        Generated on {formatDateTime(generatedAt)} &nbsp;•&nbsp; Printed by{' '}
                        {orderData?.createdBy?.name || 'Current User'}
                    </div>
                    {showCompanyDetails && resolvedCompanyAddress && <span>{resolvedCompanyAddress}</span>}
                    {showCompanyDetails && resolvedCompanyPhone && <span>Phone: {resolvedCompanyPhone}</span>}
                    {footerText && (
                        <div className="mt-2 text-gray-500">
                            {footerText}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PrintDocument;
