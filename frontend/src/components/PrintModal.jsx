import React, { useRef, useEffect, useCallback, useMemo } from 'react';

import { useCompanyInfo } from '../hooks/useCompanyInfo';

import { useGetBalanceSummaryQuery } from '../store/services/customerBalancesApi';

import { useGetUnifiedBalanceQuery } from '../store/services/accountingApi';

import { useGetBalanceSummaryQuery as useGetSupplierBalanceSummaryQuery } from '../store/services/supplierBalancesApi';

import PrintDocument from './PrintDocument';

import { PrintModal, PrintWrapper } from './print';

import { PRINT_PAGE_STYLE, THERMAL_PRINT_PAGE_STYLE } from './print/printPageStyle';

import { getInvoicePdfPayload } from '../utils/invoicePdfUtils';

import { hasFreshPrintLedgerBalance, resolvePrintLedgerBalance } from '../utils/printBalanceUtils';

import { useSensitiveDataPermissions } from '../hooks/useSensitiveDataPermissions';



function usePrintPartyLedgerBalance(orderData, partyLabel) {

  const isSupplier = String(partyLabel || '').toLowerCase() === 'supplier';



  const customerId =

    orderData?.customer_id ||

    orderData?.customerId ||

    orderData?.customer?._id ||

    orderData?.customer?.id ||

    orderData?.customer?.customerId ||

    null;



  const supplierId =

    orderData?.supplier_id ||

    orderData?.supplierId ||

    orderData?.supplier?._id ||

    orderData?.supplier?.id ||

    null;



  const partyId = isSupplier ? supplierId : customerId;



  const {

    data: customerUnifiedData,

    isFetching: isCustomerUnifiedFetching,

    isLoading: isCustomerUnifiedLoading,

  } = useGetUnifiedBalanceQuery(

    { type: 'customer', id: customerId },

    { skip: isSupplier || !customerId, refetchOnMountOrArgChange: true }

  );



  const {

    data: supplierUnifiedData,

    isFetching: isSupplierUnifiedFetching,

    isLoading: isSupplierUnifiedLoading,

  } = useGetUnifiedBalanceQuery(

    { type: 'supplier', id: supplierId },

    { skip: !isSupplier || !supplierId, refetchOnMountOrArgChange: true }

  );



  const { data: customerBalanceSummaryData } = useGetBalanceSummaryQuery(customerId, {

    skip: isSupplier || !customerId,

    refetchOnMountOrArgChange: true,

  });



  const { data: supplierBalanceSummaryData } = useGetSupplierBalanceSummaryQuery(supplierId, {

    skip: !isSupplier || !supplierId,

    refetchOnMountOrArgChange: true,

  });



  const apiBalance = useMemo(() => {

    if (isSupplier) {

      if (supplierUnifiedData?.balance !== undefined && supplierUnifiedData?.balance !== null) {

        return supplierUnifiedData.balance;

      }

      return (

        supplierBalanceSummaryData?.data?.balances?.currentBalance ??

        supplierBalanceSummaryData?.balances?.currentBalance ??

        null

      );

    }



    if (customerUnifiedData?.balance !== undefined && customerUnifiedData?.balance !== null) {

      return customerUnifiedData.balance;

    }



    return (

      customerBalanceSummaryData?.data?.balances?.currentBalance ??

      customerBalanceSummaryData?.balances?.currentBalance ??

      null

    );

  }, [

    isSupplier,

    customerUnifiedData?.balance,

    supplierUnifiedData?.balance,

    customerBalanceSummaryData,

    supplierBalanceSummaryData,

  ]);



  const isLedgerLoading = isSupplier

    ? Boolean(supplierId && (isSupplierUnifiedLoading || isSupplierUnifiedFetching))

    : Boolean(customerId && (isCustomerUnifiedLoading || isCustomerUnifiedFetching));



  return { apiBalance, isLedgerLoading, partyId };

}



/**

 * DirectPrintInvoice - Triggers print dialog directly without opening the preview modal.

 * Renders content off-screen and calls print immediately.

 */

export const DirectPrintInvoice = ({

  orderData,

  documentTitle = 'Invoice',

  partyLabel = 'Customer',

  ledgerBalance: ledgerBalanceProp = null,

  onComplete

}) => {

  const { companyInfo: companySettings } = useCompanyInfo();

  const resolvedDocumentTitle = documentTitle || 'Invoice';

  const printRef = useRef(null);

  const { apiBalance, isLedgerLoading } = usePrintPartyLedgerBalance(orderData, partyLabel);



  const ledgerBalance = resolvePrintLedgerBalance({

    ledgerBalanceProp,

    orderData,

    apiBalance,

  });



  const handlePrint = useCallback(() => {

    if (printRef.current?.print) {

      printRef.current.print();

    }

  }, []);



  useEffect(() => {

    if (!orderData) return;

    if (!hasFreshPrintLedgerBalance(orderData) && isLedgerLoading) return;



    const timer = setTimeout(handlePrint, 150);

    return () => clearTimeout(timer);

  }, [orderData, isLedgerLoading, handlePrint, ledgerBalance]);



  const handleAfterPrint = useCallback(() => {

    onComplete?.();

  }, [onComplete]);



  if (!orderData) return null;



  const isCompact = companySettings?.printSettings?.invoiceLayout === 'compact' || orderData?.invoiceLayout === 'compact';

  const selectedPageStyle = isCompact ? THERMAL_PRINT_PAGE_STYLE : PRINT_PAGE_STYLE;



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

  ledgerBalance: ledgerBalanceProp = null,

  autoPrint = false,

  onAfterPrint

}) => {

  const { companyInfo: companySettings } = useCompanyInfo();

  const { getPartyPermissions } = useSensitiveDataPermissions();

  const resolvedDocumentTitle = documentTitle || 'Invoice';

  const { canViewBalance, canViewPhone } = getPartyPermissions(partyLabel);

  const { apiBalance } = usePrintPartyLedgerBalance(orderData, partyLabel);



  const ledgerBalance = resolvePrintLedgerBalance({

    ledgerBalanceProp,

    orderData,

    apiBalance,

  });



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

      getPdfData={() => getInvoicePdfPayload(orderData, companySettings, resolvedDocumentTitle, partyLabel, canViewBalance ? ledgerBalance : null, { canViewBalance, canViewPhone })}

      shareConfig={{

        orderData,

        documentTitle: resolvedDocumentTitle,

        partyLabel,

        ledgerBalance: canViewBalance ? ledgerBalance : null,

        requireSaved: !String(orderData?.orderNumber || orderData?.order_number || '').startsWith('TEMP-'),

      }}

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


