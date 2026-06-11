import React, { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSpinner } from './LoadingSpinner';
import { downloadPdfFromPayload } from '../services/pdfService';

/**
 * Export PDF button — delegates generation to pdfService.
 */
const PdfExportButton = React.forwardRef(({ getData, label = 'PDF', className = '' }, ref) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const payload = await getData();
      if (!payload) return;

      const toastId = toast.loading('Generating PDF: Preparing...');
      await downloadPdfFromPayload(payload, {
        onProgress: (msg) => toast.loading(`Generating PDF: ${msg}`, { id: toastId }),
      });
      toast.success('PDF generated successfully', { id: toastId });
    } catch (error) {
      console.error('PDF Export error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  };

  React.useImperativeHandle(ref, () => ({
    handleExport,
  }));

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className={`flex items-center ${label ? 'gap-2 px-3 sm:px-4' : 'px-1'} py-2 bg-white border border-gray-200 hover:border-red-500 hover:bg-red-50 text-gray-700 hover:text-red-700 rounded-lg transition-all duration-200 shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group ${className}`}
      title={label || 'Export PDF'}
    >
      {isExporting ? (
        <LoadingSpinner size="sm" inline />
      ) : (
        <FileText className="h-4 w-4 text-red-600 group-hover:scale-110 transition-transform" />
      )}
      {label && <span className="text-sm font-semibold tracking-tight">{label}</span>}
      {label && !isExporting && (
        <Download className="h-3.5 w-3.5 ml-1 opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all text-red-600" />
      )}
    </button>
  );
});

export default PdfExportButton;
