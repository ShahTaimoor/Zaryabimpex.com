import React, { useRef, useCallback, useEffect } from 'react';
import BaseModal from '../BaseModal';
import { Button } from '@/components/ui/button';
import PrintWrapper from './PrintWrapper';
import PrintTrigger from './PrintTrigger';
import { PRINT_PAGE_STYLE } from './printPageStyle';

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
  zIndex = 50
}) => {
  const printRef = useRef(null);

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
    <div className="flex justify-end gap-3 no-print">
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
      maxWidth="2xl"
      variant="centered"
      contentClassName="p-4 overflow-auto max-h-[75vh] min-w-0 flex justify-center"
      className="max-h-[90vh] flex flex-col"
      footer={footer}
      zIndex={zIndex}
    >
      <PrintWrapper ref={printRef} documentTitle={documentTitle} pageStyle={PRINT_PAGE_STYLE}>
        {hasData ? (
          <div className="print-preview-scale print-modal-preview max-w-full overflow-auto flex justify-center">
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
