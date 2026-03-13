import React, { useRef, useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';

const PrintReportModal = ({
  isOpen,
  onClose,
  reportTitle,
  data,
  columns,
  filters,
  summaryData
}) => {
  const printRef = useRef(null);
  const { companyInfo } = useCompanyInfo();

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

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            @media print {
              @page { size: A4 landscape; margin: 10mm; }
              body { font-family: 'Inter', sans-serif; font-size: 10px; color: #000; }
              .no-print { display: none !important; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
              th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
              .text-right { text-align: right; }
              .font-bold { font-weight: bold; }
            }
            body { font-family: 'Inter', sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .company-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .report-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #374151; }
            .filters { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 12px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #e5e7eb; padding: 8px 12px; }
            th { background-color: #f9fafb; font-weight: 600; color: #374151; }
            .text-right { text-align: right; }
            .summary-section { margin-top: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
            .summary-card { border: 1px solid #e5e7eb; padding: 10px; border-radius: 8px; }
            .summary-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
            .summary-value { font-size: 16px; font-weight: bold; color: #111827; }
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
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Print Preview</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Print Content Preview */}
        <div className="flex-1 overflow-auto p-8 bg-gray-50">
          <div ref={printRef} className="bg-white p-8 shadow-sm border border-gray-200 min-h-full mx-auto max-w-[210mm]">
            {/* Report Header */}
            <div className="header text-center mb-8">
              <div className="company-name text-3xl font-black uppercase tracking-tight">
                {companyInfo?.companyName || 'POS SYSTEM'}
              </div>
              <div className="text-sm text-gray-600 italic mb-2">
                {companyInfo?.address || ''} {companyInfo?.contactNumber ? `| Ph: ${companyInfo.contactNumber}` : ''}
              </div>
              <div className="report-title text-xl font-bold border-t border-b border-gray-200 py-2 mt-4">
                {reportTitle}
              </div>
            </div>

            {/* Filters Info */}
            <div className="filters flex justify-between text-sm text-gray-600 mb-6 bg-gray-50 p-3 rounded-lg">
              <div>
                <span className="font-semibold">Period:</span> {filters?.dateFrom || 'All Time'} to {filters?.dateTo || 'Present'}
              </div>
              <div>
                <span className="font-semibold">City:</span> {filters?.city || 'All Cities'}
              </div>
              <div>
                <span className="font-semibold">Printed:</span> {new Date().toLocaleString()}
              </div>
            </div>

            {/* Summary Section (Optional) */}
            {summaryData && (
              <div className="grid grid-cols-4 gap-4 mb-8">
                {Object.entries(summaryData).map(([label, value]) => (
                  <div key={label} className="border border-gray-200 p-3 rounded-lg">
                    <div className="text-[10px] text-gray-500 uppercase font-bold">{label}</div>
                    <div className="text-lg font-bold text-gray-900">
                      {typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2 }) : value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Data Table */}
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  {columns.map((col, idx) => (
                    <th key={idx} className={`border border-gray-300 p-2 text-xs font-bold uppercase ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className={`border border-gray-200 p-2 text-xs ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.bold ? 'font-bold' : ''}`}>
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer */}
            <div className="mt-12 pt-4 border-t border-gray-200 text-[10px] text-gray-400 flex justify-between">
              <div>Generated by POS Accounting System</div>
              <div>Page 1 of 1</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintReportModal;
