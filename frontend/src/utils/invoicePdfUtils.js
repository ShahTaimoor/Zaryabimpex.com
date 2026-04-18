import { formatQuantityDisplay } from './dualUnitUtils';

/**
 * Formats order/invoice data for the PdfExportButton
 * @param {Object} orderData - The invoice/order data
 * @param {Object} companySettings - Company settings for header
 * @param {string} documentTitle - Title for the PDF
 * @param {string} partyLabel - 'Customer' or 'Supplier'
 * @returns {Object} Payload for PdfExportButton
 */
export const getInvoicePdfPayload = (orderData, companySettings, documentTitle = 'Invoice', partyLabel = 'Customer') => {
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

  // Columns for the items table
  const columns = [
    { header: 'S.No', key: 'sno', width: 10 },
    { header: 'Image', key: 'imageUrl', width: 20, type: 'image' },
    { header: 'Product Name', key: 'name', width: 45 },
    { header: 'Quantity', key: 'qty', width: 20 },
    { header: 'Unit Price', key: 'price', width: 25 },
    { header: 'Total', key: 'total', width: 25 }
  ];

  // Map items to rows
  const items = Array.isArray(orderData.items) ? orderData.items : [];
  const data = items.map((item, index) => {
    const product = item.product || item.productData || {};
    const name = product.name || item.name || `Item ${index + 1}`;
    const qty = item.quantity ?? item.qty ?? 0;
    const price = item.unitPrice ?? item.price ?? item.unitCost ?? 0;
    const total = item.total ?? item.lineTotal ?? (qty * price);
    const imageUrl = product.imageUrl || item.imageUrl || item.image_url || null;

    return {
      sno: index + 1,
      name: name,
      imageUrl: imageUrl,
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

  summaryRows.push({ name: 'Subtotal:', total: Math.round(subtotal).toLocaleString() });
  if (discount > 0) summaryRows.push({ name: 'Discount:', total: `-${Math.round(discount).toLocaleString()}` });
  if (tax > 0) summaryRows.push({ name: 'Tax:', total: Math.round(tax).toLocaleString() });
  summaryRows.push({ name: 'Grand Total:', total: Math.round(total).toLocaleString() });

  // Add party details if needed - currently PdfExportButton only supports one table
  // We can add them to the title or use a multi-table approach if we improve PdfExportButton

  const orderId = orderData.invoiceNumber || orderData.soNumber || orderData.orderNumber || orderData.id || orderData._id || 'Draft';
  const filename = `${documentTitle.replace(/\s+/g, '_')}_${orderId}.pdf`;

  return {
    title: `${partyLabel}: ${partyName}`,
    company: {
      name: companySettings?.companyName || 'ZARYAB IMPEX',
      address: companySettings?.address || companySettings?.billingAddress || '',
      contact: `${companySettings?.contactNumber || ''} ${companySettings?.email ? '| ' + companySettings.email : ''}`.trim()
    },
    columns,
    data,
    summary: {
      rows: summaryRows
    },
    filename
  };
};
