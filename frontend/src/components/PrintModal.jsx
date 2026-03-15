import React, { useRef, useEffect, useMemo } from 'react';
import { X, Printer } from 'lucide-react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import PrintDocument from './PrintDocument';

const PrintModal = ({
  isOpen,
  onClose,
  orderData,
  companyInfo,
  documentTitle = 'Invoice',
  partyLabel = 'Customer'
}) => {
  const printRef = useRef(null);
  const { companyInfo: companySettings } = useCompanyInfo();
  const resolvedDocumentTitle = documentTitle || 'Invoice';

  // Sync with Company Settings - removed local states in favor of direct prop passing in render
  // (All print states are now handled via companySettings.printSettings)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const documentNumber =
    orderData?.invoiceNumber ||
    orderData?.orderNumber ||
    orderData?.poNumber ||
    orderData?.referenceNumber ||
    orderData?._id ||
    'N/A';

  const generatedAt = new Date();

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    // Create a new iframe for printing to avoid clearing the current document
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;

    // Get checkbox states at the time of printing
    // Note: We are printing the 'printContent' which is already rendered in the DOM with the correct visibility
    // based on React state. So we just need to copy the HTML.

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${resolvedDocumentTitle} - ${documentNumber}</title>
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin: 10mm;
              }
              body {
                font-family: 'Inter', Arial, sans-serif;
                font-size: 11px;
                color: #000;
                margin: 0;
                padding: 0;
                background: #fff;
              }
              .print-preview-scale {
                transform: none !important;
                width: 100% !important;
              }
              .print-document {
                width: 100% !important;
                max-width: 100% !important;
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .print-document__toolbar, .no-print, button, .btn {
                display: none !important;
              }
              .print-document__table th, 
              .print-document__table td {
                padding: 3px 4px !important;
                font-size: 11px !important;
                border: 1px solid #000 !important;
              }
            }
            .print-document {
              width: 100%;
              font-family: 'Inter', 'Segoe UI', sans-serif;
            }
            .print-document__title {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 8px;
            }
            .print-document__company {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
            }
            .print-document__company-details {
              text-align: right;
              flex: 1;
            }
            .print-document__company-name {
              font-size: 24px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .print-document__company-subtitle {
              font-size: 14px;
              color: #4b5563;
            }
            .print-document__logo-wrap {
              text-align: left;
            }
            .print-document__logo-img {
              max-height: 60px;
              max-width: 200px;
              object-fit: contain;
            }
            .print-document__info-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              margin-bottom: 20px;
            }
            .print-document__info-section {
              border-top: 1px solid #e5e7eb;
              padding-top: 8px;
            }
            .print-document__info-title {
              font-size: 11px;
              font-weight: 600;
              color: #4b5563;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .print-document__info-row, .print-document__info-line {
              font-size: 11px;
              margin-bottom: 3px;
              display: flex;
              justify-content: space-between;
            }
            .print-document__info-label {
              font-weight: 600;
              color: #374151;
            }
            .print-document__info-value {
              text-align: right;
            }
            .print-document__table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            .print-document__table th {
              background: #f3f4f6;
              border: 1px solid #e5e7eb;
              padding: 4px 6px;
              font-size: 11px;
              font-weight: 700;
            }
            .print-document__table td {
              border: 1px solid #e5e7eb;
              padding: 4px 6px;
              font-size: 11px;
            }
            .print-document__summary {
              margin-top: 20px;
              display: flex;
              justify-content: flex-end;
            }
            .print-document__summary-table {
              width: 200px;
            }
            .print-document__summary-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              margin-bottom: 4px;
            }
            .print-document__summary-row--total {
              border-top: 1px solid #000;
              padding-top: 5px;
              font-weight: 700;
              font-size: 14px;
            }
            .print-document__footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #4b5563;
            }
            .print-document__footer span {
              display: block;
            }
            /* Helper for hiding elements */
            .hidden {
              display: none !important;
            }

            /* Layout 2 (Professional Boxed Layout) */
            .print-document--layout2 {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #000;
              line-height: 1.4;
            }
            .layout2-header {
              margin-bottom: 20px;
            }
            .layout2-company-name {
              font-size: 28px;
              color: #000;
              margin-bottom: 4px;
            }
            .layout2-table th {
              background-color: #f3f4f6 !important;
              color: #000 !important;
              font-weight: 700 !important;
              border: 1px solid #000 !important;
              text-align: center;
            }
            .layout2-table td {
              border: 1px solid #000 !important;
              color: #000 !important;
              padding: 4px;
            }
            .urdu-note {
              font-family: inherit;
              font-weight: 700;
              margin-top: 40px;
            }
            .grid { display: grid; }
            .grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
            .col-span-8 { grid-column: span 8 / span 8; }
            .col-span-4 { grid-column: span 4 / span 4; }
            .col-span-2 { grid-column: span 2 / span 2; }
            .items-center { align-items: center; }
            .gap-4 { gap: 1rem; }
            .p-2 { padding: 0.5rem; }
            .p-4 { padding: 1rem; }
            .uppercase { text-transform: uppercase; }
            .underline { text-decoration: underline; }

            /* Tailwind Preflight / Reset for Print */
            *, ::before, ::after {
              box-sizing: border-box;
              border-width: 0;
              border-style: solid;
              border-color: #e5e7eb;
            }

            /* Utilities */
            .border-black { border-color: #000 !important; }
            .border-t { border-top-width: 1px; }
            .border-l { border-left-width: 1px; }
            .border-r { border-right-width: 1px; }
            .border-b { border-bottom-width: 1px; }
            .border-b-2 { border-bottom-width: 2px; }
            .font-bold { font-weight: 700; }
            .font-medium { font-weight: 500; }
            .italic { font-style: italic; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-sm { font-size: 0.875rem; }
            .text-lg { font-size: 1.125rem; }
            .text-3xl { font-size: 1.875rem; }
            .text-4xl { font-size: 2.25rem; }
            .mb-1 { margin-bottom: 0.25rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mb-6 { margin-bottom: 1.5rem; }
            .mt-0 { margin-top: 0; }
            .mt-8 { margin-top: 2rem; }
            .w-full { width: 100%; }
            .max-h-20 { max-height: 5rem; }
            .w-auto { width: auto; }
            .object-contain { object-fit: contain; }
            .uppercase { text-transform: uppercase; }
            .underline { text-decoration: underline; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      // Cleanup
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };

  if (!isOpen || !orderData) return null;

  const documentHeading = `${resolvedDocumentTitle} Details`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 p-4 overflow-hidden">
      <div className="w-full h-full overflow-auto flex items-center justify-center">
        <div className="bg-transparent w-full max-w-[95vw] max-h-[92vh] flex flex-col items-center">
          <div className="p-4 print-preview-wrapper w-full">
            <div ref={printRef} className="print-preview-scale">
              <PrintDocument
                companySettings={companySettings || {}}
                orderData={orderData}
                printSettings={{
                  ...companySettings?.printSettings,
                  headerText: companySettings?.printSettings?.headerText,
                  footerText: companySettings?.printSettings?.footerText
                }}
                documentTitle={resolvedDocumentTitle}
                partyLabel={partyLabel}
              >
                {/* No-print Toolbar; all print options are controlled from Settings → Print Preview */}
                <div className="print-document__toolbar no-print mb-6 border-b pb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">{documentHeading}</h2>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handlePrint}
                        className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 flex items-center gap-2"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </button>
                      <button
                        onClick={onClose}
                        className="bg-white text-gray-700 px-4 py-2 rounded border border-gray-300 shadow-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Close
                      </button>
                    </div>
                  </div>

                </div>
              </PrintDocument>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintModal;