/**
 * Print page style string for react-to-print.
 * Injected into the print iframe so styles apply when printing.
 */
export const PRINT_PAGE_STYLE = `
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0 !important;
    padding: 0 !important;
    font-family: 'Inter', Arial, Helvetica, sans-serif !important;
    font-size: 11px !important;
    color: #000 !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .no-print, .btn, button, .print-toolbar { display: none !important; }
  .print-wrapper, .print-preview-scale { box-shadow: none !important; border: none !important; }
  table { width: 100% !important; border-collapse: collapse !important; }
  th, td { border: 1px solid #333 !important; padding: 4px 6px !important; font-size: 10px !important; }
  th { background-color: #f3f4f6 !important; font-weight: 700 !important; }
  .print-document__company-name { font-size: 20px !important; font-weight: 700 !important; }
  .print-document__table th, .print-document__table td { padding: 4px 6px !important; }
  .print-document__summary-table { font-size: 11px !important; }
  .print-document__footer { font-size: 9px !important; margin-top: 16px !important; }
  .receipt-voucher { max-width: 400px !important; margin: 0 auto !important; }
  .layout2-table th, .layout2-table td { border: 1px solid #000 !important; }
  .print-document, .receipt-voucher { page-break-inside: avoid; }
  .print-document--compact { width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
  /* Sale invoice - emerald */
  .print-document.print-document--sale .print-document__table th,
  .print-document.print-document--sale .layout2-table th {
    background-color: #059669 !important; color: #fff !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  .print-document.print-document--sale .print-document__section-label { color: #047857 !important; }
  .print-document.print-document--sale .print-document__summary-row--total {
    background-color: #d1fae5 !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  /* Purchase invoice - blue */
  .print-document.print-document--purchase .print-document__table th,
  .print-document.print-document--purchase .layout2-table th {
    background-color: #2563eb !important; color: #fff !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  .print-document.print-document--purchase .print-document__section-label { color: #1d4ed8 !important; }
  .print-document.print-document--purchase .print-document__summary-row--total {
    background-color: #dbeafe !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
`;

export const THERMAL_PRINT_PAGE_STYLE = `
  @page { 
    size: 80mm auto !important; 
    margin: 0 !important; 
  }
  html, body {
    width: 80mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    overflow: hidden !important;
    -webkit-text-size-adjust: 100% !important;
    zoom: 1 !important;
  }
  * { 
    box-sizing: border-box !important; 
  }
  .no-print, .btn, button, .print-toolbar { display: none !important; }
  
  .thermal-receipt { 
    width: 72mm !important; 
    max-width: 72mm !important;
    margin: 0 auto !important; 
    padding: 2mm 1mm !important;
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    line-height: 1.1 !important;
    display: block !important;
    color: #000 !important;
    transform: none !important;
  }
  .thermal-receipt table { 
    border-collapse: collapse !important; 
    width: 100% !important; 
    margin: 0 !important;
    table-layout: fixed !important;
  }
  .thermal-receipt th, .thermal-receipt td { 
    border: none !important; 
    border-bottom: 1px solid #000 !important; 
    padding: 1mm 0 !important; 
    font-size: 12px !important;
    font-weight: 600 !important;
    word-wrap: break-word !important;
    overflow: hidden !important;
  }
  /* Column widths for thermal */
  .thermal-receipt th:nth-child(1), .thermal-receipt td:nth-child(1) { width: 40% !important; text-align: left !important; }
  .thermal-receipt th:nth-child(2), .thermal-receipt td:nth-child(2) { width: 15% !important; text-align: center !important; }
  .thermal-receipt th:nth-child(3), .thermal-receipt td:nth-child(3) { width: 20% !important; text-align: right !important; }
  .thermal-receipt th:nth-child(4), .thermal-receipt td:nth-child(4) { width: 25% !important; text-align: right !important; }

  .thermal-receipt__divider { 
    border-top: 1px dashed #000 !important; 
    margin: 2mm 0 !important; 
    width: 100% !important;
  }
  .thermal-receipt__summary-row--total { 
    font-size: 16px !important; 
    font-weight: bold !important; 
    border-top: 1px solid #000 !important; 
    margin-top: 1mm !important;
    padding-top: 1mm !important;
  }
  .thermal-receipt tbody tr:last-child td {
    border-bottom: none !important;
  }
  /* Remove any transforms that might shrink content */
  .print-wrapper, .print-preview-scale, .print-modal-preview, .print-document {
    transform: none !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
  .thermal-receipt canvas {
    width: 52mm !important;
    max-width: 52mm !important;
    height: 14mm !important;
    display: block !important;
    margin: 0 auto !important;
    image-rendering: auto !important;
  }
`;
