import { loadImageForPdf } from '../utils/pdf/imageLoader';
import { getInvoicePdfPayload } from '../utils/invoicePdfUtils';

const BATCH_SIZE = 10;

/**
 * Build jsPDF document from export payload (shared by download + share).
 */
export async function buildPdfDocument(payload, { onProgress } = {}) {
  if (!payload) throw new Error('PDF payload is required');

  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF(payload.orientation || 'portrait');
  let currentY = 10;
  const startX = 5;

  if (payload.company) {
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.setFont('helvetica', 'bold');
    doc.text(payload.company.name || '', startX, currentY);
    currentY += 8;

    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    if (payload.company.address) {
      doc.text(payload.company.address, startX, currentY);
      currentY += 5;
    }
    if (payload.company.contact) {
      doc.text(payload.company.contact, startX, currentY);
      currentY += 5;
    }
    currentY += 5;
  }

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  const cleanTitle = (payload.title || 'Report').split(':')[0].trim();
  doc.text(cleanTitle, startX, currentY);
  currentY += 10;

  if (payload.party) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(payload.party.label || 'Bill To:', startX, currentY);
    currentY += 5;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(payload.party.name || '', startX, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (payload.party.address) {
      const splitAddress = doc.splitTextToSize(String(payload.party.address), 90);
      doc.text(splitAddress, startX, currentY);
      currentY += splitAddress.length * 4 + 2;
    }
    if (payload.party.phone) {
      doc.text(`Phone: ${payload.party.phone}`, startX, currentY);
      currentY += 5;
    }
    currentY += 5;
  }

  const heads = [payload.columns.map((c) => c.header)];
  const imageColumnsIndices = [];
  payload.columns.forEach((col, idx) => {
    if (col.type === 'image' || col.key === 'imageUrl' || col.key === 'image') {
      imageColumnsIndices.push(idx);
    }
  });

  const rows = [];
  const imagesMap = {};

  payload.data.forEach((item, rowIndex) => {
    const rowData = [];
    payload.columns.forEach((col, colIndex) => {
      if (imageColumnsIndices.includes(colIndex)) {
        rowData.push('');
      } else {
        rowData.push(String(item[col.key] ?? ''));
      }
    });
    rows[rowIndex] = rowData;
  });

  if (imageColumnsIndices.length > 0) {
    onProgress?.('Processing images...');
    for (let i = 0; i < payload.data.length; i += BATCH_SIZE) {
      const batch = payload.data.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (item, idx) => {
          const rowIndex = i + idx;
          for (const colIndex of imageColumnsIndices) {
            const col = payload.columns[colIndex];
            const imgData = await loadImageForPdf(item[col.key]);
            if (imgData) {
              imagesMap[`${rowIndex}_${colIndex}`] = imgData;
            }
          }
        })
      );
    }
  }

  onProgress?.('Finalizing...');

  const columnStyles = {};
  payload.columns.forEach((col, idx) => {
    if (col.width) columnStyles[idx] = { cellWidth: col.width };
    if (imageColumnsIndices.includes(idx)) {
      columnStyles[idx] = { ...columnStyles[idx], cellWidth: 20, minCellHeight: 20, halign: 'center' };
    }
  });

  autoTable(doc, {
    startY: currentY,
    head: heads,
    body: rows,
    theme: 'grid',
    margin: { left: 5, right: 5 },
    styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle', halign: 'left' },
    headStyles: { fillColor: [243, 244, 246], textColor: 31, fontStyle: 'bold', halign: 'center' },
    columnStyles,
    didDrawCell(data) {
      if (data.cell.section === 'body' && imageColumnsIndices.includes(data.column.index)) {
        const rowIndex = data.row.index;
        const imgData = imagesMap[`${rowIndex}_${data.column.index}`];
        if (imgData) {
          const dim = 14;
          const x = data.cell.x + (data.cell.width - dim) / 2;
          const y = data.cell.y + (data.cell.height - dim) / 2;
          doc.addImage(imgData, 'JPEG', x, y, dim, dim);
        }
      }
    },
  });

  if (payload.summary?.rows?.length > 0) {
    const summaryBody = payload.summary.rows.map((row) =>
      payload.columns.map((col) => row[col.key] ?? '')
    );

    autoTable(doc, {
      startY: (doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY) + 5,
      head: [],
      body: summaryBody,
      styles: { fontSize: 9, fontStyle: 'bold', textColor: [0, 0, 0], cellPadding: 2, fillColor: [248, 250, 252] },
      theme: 'plain',
      margin: { left: 105 },
    });
  }

  let finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY) + 25;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  if (finalY + 20 > pageHeight) {
    doc.addPage();
    finalY = 30;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.line(startX, finalY, startX + 60, finalY);
  doc.text('Customer Signature', startX, finalY + 5);
  doc.line(pageWidth - 65, finalY, pageWidth - startX, finalY);
  doc.text('Authorized Signature', pageWidth - 65, finalY + 5);

  return doc;
}

export function sanitizePdfFilename(filename) {
  let name = filename || `Export_${new Date().toLocaleDateString()}.pdf`;
  return name.replace(/\.xlsx$/i, '.pdf').replace(/\//g, '-');
}

/** Returns PDF Blob from payload. */
export async function generatePdfBlob(payload, options = {}) {
  const doc = await buildPdfDocument(payload, options);
  const filename = sanitizePdfFilename(payload.filename);
  const blob = doc.output('blob');
  return { blob, filename, doc };
}

/** Trigger browser download from payload. */
export async function downloadPdfFromPayload(payload, options = {}) {
  const { doc, filename } = await generatePdfBlob(payload, options);
  doc.save(filename);
  return filename;
}

/**
 * Generate invoice PDF from order data (reuses invoicePdfUtils template mapping).
 */
export async function generateInvoicePDF(orderData, {
  companySettings,
  documentTitle = 'Invoice',
  partyLabel = 'Customer',
  ledgerBalance = null,
  permissions = {},
  onProgress,
} = {}) {
  const payload = getInvoicePdfPayload(
    orderData,
    companySettings,
    documentTitle,
    partyLabel,
    ledgerBalance,
    permissions
  );
  if (!payload) throw new Error('Unable to build invoice PDF data');

  const { blob, filename } = await generatePdfBlob(payload, { onProgress });
  const file = new File([blob], filename, { type: 'application/pdf' });

  return { blob, file, filename, payload };
}
