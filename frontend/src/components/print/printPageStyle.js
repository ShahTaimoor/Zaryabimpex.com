/**
 * A4 print page style for react-to-print (injected into print iframe via `pageStyle`).
 *
 * Thermal printing uses buildThermalPrintPageStyle() from thermalPrintConfig.js.
 * Native @media print rules live in printStyles.css (imported in index.jsx).
 *
 * A4 styles are scoped to `.print-document` and `.account-ledger-print` only —
 * never use bare `table {}`, `th {}`, or `td {}` here.
 */

export {
  THERMAL_PRINT_PAGE_STYLE,
  buildThermalPrintPageStyle,
  getThermalConfig,
  getThermalCssVariables,
  getThermalPrintPageStyle,
  THERMAL_PRINTER_PRESETS,
} from './thermalPrintConfig';

export const PRINT_PAGE_STYLE = `
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    font-family: 'Inter', Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .no-print, .btn, button, .print-toolbar { display: none !important; }

  .print-wrapper,
  .print-preview-scale,
  .print-modal-preview {
    box-shadow: none;
    border: none;
    overflow: visible;
    transform: none;
  }

  /* ── A4 document shell ─────────────────────────────────────────────── */
  .print-document {
    width: 100%;
    max-width: 100%;
    box-shadow: none;
    border: none;
    padding: 10mm;
    margin: 0;
    border-radius: 0;
    page-break-inside: avoid;
  }

  .print-document table,
  .print-document__table,
  .layout2-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }

  .print-document th,
  .print-document td,
  .print-document__table th,
  .print-document__table td,
  .layout2-table th,
  .layout2-table td {
    border: 1px solid #000;
    padding: 4px 6px;
    font-size: 11px;
    line-height: 1.2;
  }

  .print-document th,
  .print-document__table th,
  .layout2-table th {
    background-color: #f3f4f6;
    font-weight: 700;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-document__company-name { font-size: 20px; font-weight: 700; }
  .print-document__summary-table { font-size: 11px; }
  .print-document__footer { font-size: 9px; margin-top: 16px; }

  .receipt-voucher {
    max-width: 400px;
    margin: 0 auto;
    page-break-inside: avoid;
  }

  /* ── Account ledger (not thermal, not standard invoice) ────────────── */
  .account-ledger-print {
    padding: 10mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .account-ledger-print table,
  .account-ledger-print-table,
  .account-ledger-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
  }

  .account-ledger-print th,
  .account-ledger-print td,
  .account-ledger-print-table th,
  .account-ledger-print-table td,
  .account-ledger-table th,
  .account-ledger-table td {
    border: 1px solid #000;
    padding: 4px 6px;
    font-size: 10px;
    line-height: 1.2;
  }

  /* ── Sale invoice — emerald ───────────────────────────────────────── */
  .print-document.print-document--sale .print-document__table th,
  .print-document.print-document--sale .layout2-table th {
    background-color: #059669;
    color: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .print-document.print-document--sale .print-document__section-label { color: #047857; }
  .print-document.print-document--sale .print-document__summary-row--total {
    background-color: #d1fae5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Purchase invoice — blue ──────────────────────────────────────── */
  .print-document.print-document--purchase .print-document__table th,
  .print-document.print-document--purchase .layout2-table th {
    background-color: #2563eb;
    color: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .print-document.print-document--purchase .print-document__section-label { color: #1d4ed8; }
  .print-document.print-document--purchase .print-document__summary-row--total {
    background-color: #dbeafe;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Modal preview layout restore ─────────────────────────────────── */
  .print-modal-preview .print-document__company {
    flex-direction: row;
    align-items: center;
  }
  .print-modal-preview .print-document__company-details { text-align: right; }
  .print-modal-preview .print-document__info-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .print-modal-preview .print-document__summary { justify-content: flex-end; }
  .print-modal-preview .print-document__summary-table { width: 260px; }

  .print-document tr,
  .account-ledger-print tr { page-break-inside: avoid; }
  .print-document thead,
  .account-ledger-print thead { display: table-header-group; }

  .text-right { text-align: right; }
  .text-left { text-align: left; }
  .text-center { text-align: center; }
  .font-bold { font-weight: 700; }
`;
