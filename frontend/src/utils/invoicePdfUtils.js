import { formatQuantityDisplay } from './dualUnitUtils';

/**
 * Formats order/invoice data for the PdfExportButton
 * @param {Object} orderData - The invoice/order data
 * @param {Object} companySettings - Company settings for header
 * @param {string} documentTitle - Title for the PDF
 * @param {string} partyLabel - 'Customer' or 'Supplier'
 * @returns {Object} Payload for PdfExportButton
 */
export const getInvoicePdfPayload = (orderData, companySettings, documentTitle = 'Invoice', partyLabel = 'Customer', ledgerBalanceProp = null) => {
  if (!orderData) return null;

  const isSale = partyLabel.toLowerCase().includes('customer');
  // Thoroughly resolve the customer/supplier name
  const resolvePartyName = (data) => {
    if (!data || typeof data !== 'object') return null;
    return (
      data.businessName || data.business_name ||
      data.displayName || data.companyName ||
      data.name || data.fullName || data.title ||
      data.contactName || data.business_label ||
      (data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : null)
    );
  };

  let name = orderData.customerName || orderData.customer_name || orderData.supplierName || orderData.supplier_name;

  if (!name) {
    // Check various common object containers
    const containers = [
      orderData.customerInfo, orderData.customer_info,
      orderData.supplierInfo, orderData.supplier_info,
      orderData.customer, orderData.supplier,
      orderData.customer_id, orderData.supplier_id,
      orderData.customerData, orderData.supplierData,
      orderData.party, orderData.client
    ];

    for (const container of containers) {
      const resolved = resolvePartyName(container);
      if (resolved) {
        name = resolved;
        break;
      }
    }
  }

  const partyName = name || (isSale ? 'Walk-in Customer' : 'Supplier');

  // Columns for the items table to match Layout 2
  const columns = [
    { header: 'Item', key: 'name', width: 85 },
    { header: 'Description', key: 'description', width: 45 },
    { header: 'Qty', key: 'qty', width: 20 },
    { header: 'Price', key: 'price', width: 25 },
    { header: 'Total', key: 'total', width: 25 }
  ];

  // Map items to rows - look in various common fields and nested data
  const rawData = orderData.data || orderData;
  const items = Array.isArray(rawData.items) ? rawData.items :
    Array.isArray(rawData.orderItems) ? rawData.orderItems :
      Array.isArray(rawData.products) ? rawData.products :
        Array.isArray(rawData.invoiceItems) ? rawData.invoiceItems :
          Array.isArray(orderData.items) ? orderData.items : [];

  const data = items.map((item, index) => {
    const product = item.product || item.productData || {};
    const sku = item.sku || product.sku || '';
    const brand = item.brand || product.brand || '';
    let displayName = product.name || item.name || `Item ${index + 1}`;
    if (sku) displayName += ` (SKU: ${sku})`;

    const qty = item.quantity ?? item.qty ?? 0;
    const price = item.unitPrice ?? item.price ?? item.unitCost ?? 0;
    const total = item.total ?? item.lineTotal ?? (qty * price);

    return {
      name: displayName,
      description: item.description || product.description || '—',
      qty: formatQuantityDisplay(qty, product, null, { boxes: item.boxes, pieces: item.pieces }),
      price: Math.round(price).toLocaleString(),
      total: Math.round(total).toLocaleString()
    };
  });

  // Summary rows
  const summaryRows = [];
  const subtotal = orderData.pricing?.subtotal ?? orderData.subtotal ?? 0;
  const discount = orderData.pricing?.discountAmount ?? orderData.discount ?? 0;
  const tax = orderData.pricing?.taxAmount ?? orderData.tax ?? 0;
  const total = orderData.pricing?.total ?? orderData.total ?? 0;

  const printShowTax = companySettings?.printSettings?.showTax !== false;
  const showTaxInSummary =
    companySettings?.taxEnabled === true && printShowTax && tax > 0;

  summaryRows.push({ name: 'Subtotal', total: Math.round(subtotal).toLocaleString() });
  if (discount > 0) summaryRows.push({ name: 'Discount', total: `-${Math.round(discount).toLocaleString()}` });
  if (showTaxInSummary) {
    summaryRows.push({ name: 'Tax', total: Math.round(tax).toLocaleString() });
  }
  summaryRows.push({ name: 'Total', total: Math.round(total).toLocaleString() });

  // Add Ledger Balance if available
  const ledgerBalance = ledgerBalanceProp ?? orderData.ledgerBalance ?? orderData.customer?.balance ?? null;
  if (ledgerBalance !== null) {
    summaryRows.push({ name: 'Ledger Balance', total: Math.round(ledgerBalance).toLocaleString() });
  }

  // Add party details if needed - currently PdfExportButton only supports one table
  // We can add them to the title or use a multi-table approach if we improve PdfExportButton

  const orderId = orderData.invoiceNumber || orderData.soNumber || orderData.orderNumber || orderData.id || orderData._id || 'Draft';
  const filename = `${documentTitle.replace(/\s+/g, '_')}_${orderId}.pdf`;

  // Resolve party details for "Bill To"
  const partyInfo = orderData.customerInfo || orderData.supplierInfo || orderData.customer || orderData.supplier || {};
  let partyAddress = partyInfo.address || '';
  if (typeof partyAddress === 'object') {
    partyAddress = Object.values(partyAddress).filter(v => typeof v === 'string').join(', ');
  }
  const partyPhone = partyInfo.phone || partyInfo.contactNumber || '';

  return {
    title: `${documentTitle}: #${orderId}`,
    orientation: 'portrait',
    company: {
      name: companySettings?.companyName || 'ZARYAB IMPEX',
      address: companySettings?.address || companySettings?.billingAddress || '',
      contact: `${companySettings?.contactNumber || ''} ${companySettings?.email ? '| ' + companySettings.email : ''}`.trim()
    },
    party: {
      label: `${partyLabel} Details:`,
      name: partyName,
      address: partyAddress,
      phone: partyPhone
    },
    columns,
    data,
    summary: {
      rows: summaryRows
    },
    filename
  };
};
