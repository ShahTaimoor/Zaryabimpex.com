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
