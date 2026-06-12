import React, { useRef, useCallback, useEffect, useState } from 'react';
import BaseModal from '../BaseModal';
import { Button } from '@/components/ui/button';
import PrintWrapper from './PrintWrapper';
import PrintTrigger from './PrintTrigger';
import { PRINT_PAGE_STYLE } from './printPageStyle';
import PdfExportButton from '../PdfExportButton';
import WhatsAppShareButton from '../invoice/WhatsAppShareButton';

/**
 * PrintModal - Unified print preview modal using BaseModal + react-to-print.
 * Replaces ReceiptPaymentPrintModal and PrintModal overlay logic.
 *
 * Props:
 *   - isOpen, onClose
 *   - documentTitle: string
 *   - children: ReactNode - The printable content (e.g. PrintDocument)
 *   - emptyMessage: string - Shown when no data
 *   - hasData: boolean - Whether to show content or empty state
 *   - autoPrint: boolean - Auto-trigger print on open (optional)
 */
const PrintModal = ({
  isOpen,
  onClose,
  documentTitle = 'Print Preview',
  children,
  emptyMessage = 'No data to print.',
  hasData = true,
  autoPrint = false,
  zIndex = 50,
  getPdfData,
  shareConfig,
  onAfterPrint,
  pageStyle = PRINT_PAGE_STYLE
}) => {
  const printRef = useRef(null);
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const syncViewport = () => setIsNarrowViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  const handlePrint = useCallback(() => {
    if (printRef.current?.print) {
      printRef.current.print();
    }
  }, []);

  useEffect(() => {
    if (isOpen && autoPrint && hasData) {
      const timer = setTimeout(handlePrint, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint, hasData, handlePrint]);

  const footer = (
    <div className="flex flex-wrap justify-end gap-3 no-print">
      {shareConfig?.orderData && (
        <WhatsAppShareButton
          orderData={shareConfig.orderData}
          documentTitle={shareConfig.documentTitle || documentTitle}
          partyLabel={shareConfig.partyLabel || 'Customer'}
          ledgerBalance={shareConfig.ledgerBalance}
          requireSaved={shareConfig.requireSaved !== false}
          label="WhatsApp"
        />
      )}
      {getPdfData && (
        <PdfExportButton
          getData={getPdfData}
          label="Download PDF"
          className="bg-red-600 text-white hover:bg-red-700 hover:text-white border-red-600"
        />
      )}
      <PrintTrigger
        onPrint={handlePrint}
        disabled={!hasData}
        variant="default"
        className="flex items-center gap-2"
      />
      <Button type="button" onClick={onClose} variant="secondary">
        Close
      </Button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${documentTitle} – Print Preview`}
      maxWidth={isNarrowViewport ? 'full' : '2xl'}
      variant="centered"
      contentClassName="p-3 sm:p-4 overflow-x-hidden overflow-y-auto max-h-[75vh] min-w-0 flex justify-center"
      className="max-h-[90vh] flex flex-col"
      footer={footer}
      zIndex={zIndex}
    >
      <PrintWrapper
        ref={printRef}
        documentTitle={documentTitle}
        pageStyle={pageStyle}
        onAfterPrint={onAfterPrint}
      >
        {hasData ? (
          <div className="print-preview-scale print-modal-preview w-full max-w-full overflow-x-hidden flex justify-center">
            {children}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <p>{emptyMessage}</p>
          </div>
        )}
      </PrintWrapper>
    </BaseModal>
  );
};

export default PrintModal;
