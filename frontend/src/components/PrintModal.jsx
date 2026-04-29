import React, { useRef, useEffect, useCallback } from 'react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { useGetBalanceSummaryQuery } from '../store/services/customerBalancesApi';
import PrintDocument from './PrintDocument';
import { PrintModal, PrintWrapper } from './print';
import { PRINT_PAGE_STYLE, THERMAL_PRINT_PAGE_STYLE } from './print/printPageStyle';
import { getInvoicePdfPayload } from '../utils/invoicePdfUtils';

/**
 * DirectPrintInvoice - Triggers print dialog directly without opening the preview modal.
 * Renders content off-screen and calls print immediately.
 */
export const DirectPrintInvoice = ({
  orderData,
  documentTitle = 'Invoice',
  partyLabel = 'Customer',
  onComplete
}) => {
  const { companyInfo: companySettings } = useCompanyInfo();
  const resolvedDocumentTitle = documentTitle || 'Invoice';
  const printRef = useRef(null);

  const customerId =
    orderData?.customer_id ||
    orderData?.customerId ||
    orderData?.customer?._id ||
    orderData?.customer?.id ||
    orderData?.customer?.customerId ||
    null;

  const { data: balanceSummaryData } = useGetBalanceSummaryQuery(customerId, {
    skip: !customerId
  });

  const ledgerBalance =
    balanceSummaryData?.data?.balances?.currentBalance ??
    balanceSummaryData?.balances?.currentBalance ??
    null;

  const handlePrint = useCallback(() => {
    if (printRef.current?.print) {
      printRef.current.print();
    }
  }, []);

  useEffect(() => {
    if (orderData) {
      const timer = setTimeout(handlePrint, 150);
      return () => clearTimeout(timer);
    }
  }, [orderData, handlePrint]);

  const handleAfterPrint = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  if (!orderData) return null;

  const isCompact = companySettings?.printSettings?.invoiceLayout === 'compact' || orderData?.invoiceLayout === 'compact';
  const selectedPageStyle = isCompact ? THERMAL_PRINT_PAGE_STYLE : (pageStyle || PRINT_PAGE_STYLE);

  return (
    <div style={{ position: 'fixed', left: '-9999px', top: 0, visibility: 'hidden' }} aria-hidden="true">
      <PrintWrapper
        ref={printRef}
        documentTitle={resolvedDocumentTitle}
        pageStyle={selectedPageStyle}
        onAfterPrint={handleAfterPrint}
      >
        <PrintDocument
          companySettings={companySettings || {}}
          orderData={orderData}
          ledgerBalance={ledgerBalance}
          printSettings={{
            ...companySettings?.printSettings,
            headerText: companySettings?.printSettings?.headerText,
            footerText: companySettings?.printSettings?.footerText
          }}
          documentTitle={resolvedDocumentTitle}
          partyLabel={partyLabel}
        />
      </PrintWrapper>
    </div>
  );
};

/**
 * Invoice Print Modal - Sale invoices, Purchase invoices, Sale returns.
 * Uses centralized PrintModal + PrintWrapper (react-to-print).
 */
const InvoicePrintModal = ({
  isOpen,
  onClose,
  orderData,
  documentTitle = 'Invoice',
  partyLabel = 'Customer',
  autoPrint = false,
  onAfterPrint
}) => {
  const { companyInfo: companySettings } = useCompanyInfo();
  const resolvedDocumentTitle = documentTitle || 'Invoice';

  const customerId =
    orderData?.customer_id ||
    orderData?.customerId ||
    orderData?.customer?._id ||
    orderData?.customer?.id ||
    orderData?.customer?.customerId ||
    null;

  const { data: balanceSummaryData } = useGetBalanceSummaryQuery(customerId, {
    skip: !customerId
  });

  const ledgerBalance =
    balanceSummaryData?.data?.balances?.currentBalance ??
    balanceSummaryData?.balances?.currentBalance ??
    null;

  const isCompact = companySettings?.printSettings?.invoiceLayout === 'compact' || orderData?.invoiceLayout === 'compact';
  const pageStyle = isCompact ? THERMAL_PRINT_PAGE_STYLE : PRINT_PAGE_STYLE;

  return (
    <PrintModal
      isOpen={isOpen}
      onClose={onClose}
      documentTitle={resolvedDocumentTitle}
      hasData={!!orderData}
      emptyMessage="No invoice data to print."
      autoPrint={autoPrint}
      onAfterPrint={onAfterPrint}
      pageStyle={pageStyle}
      getPdfData={() => getInvoicePdfPayload(orderData, companySettings, resolvedDocumentTitle, partyLabel, ledgerBalance)}
    >
      <PrintDocument
        companySettings={companySettings || {}}
        orderData={orderData}
        ledgerBalance={ledgerBalance}
        printSettings={{
          ...companySettings?.printSettings,
          headerText: companySettings?.printSettings?.headerText,
          footerText: companySettings?.printSettings?.footerText
        }}
        documentTitle={resolvedDocumentTitle}
        partyLabel={partyLabel}
      />
    </PrintModal>
  );
};

export default InvoicePrintModal;
