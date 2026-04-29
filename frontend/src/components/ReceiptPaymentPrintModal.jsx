import React, { useMemo } from 'react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { useGetBalanceSummaryQuery } from '../store/services/customerBalancesApi';
import { useGetBalanceSummaryQuery as useGetSupplierBalanceSummaryQuery } from '../store/services/supplierBalancesApi';
import PrintDocument from './PrintDocument';
import { PrintModal } from './print';
import { PRINT_PAGE_STYLE, THERMAL_PRINT_PAGE_STYLE } from './print/printPageStyle';

/**
 * Modal for printing receipt/payment vouchers (Cash Receipt, Bank Receipt, Cash Payment, Bank Payment).
 * Uses centralized PrintModal + PrintWrapper (react-to-print). Maps receiptData to orderData for PrintDocument.
 */
const ReceiptPaymentPrintModal = ({
  isOpen,
  onClose,
  documentTitle = 'Receipt',
  receiptData
}) => {
  const { companyInfo: companySettings } = useCompanyInfo();
  const customerId = receiptData?.customer?.id || receiptData?.customer?._id || null;
  const supplierId = receiptData?.supplier?.id || receiptData?.supplier?._id || null;
  const { data: customerBalanceData } = useGetBalanceSummaryQuery(customerId, { skip: !customerId || !!supplierId });
  const { data: supplierBalanceData } = useGetSupplierBalanceSummaryQuery(supplierId, { skip: !supplierId });
  const ledgerBalance = customerId
    ? (customerBalanceData?.data?.balances?.currentBalance ?? customerBalanceData?.balances?.currentBalance ?? null)
    : supplierId
      ? (supplierBalanceData?.data?.balances?.currentBalance ?? supplierBalanceData?.balances?.currentBalance ?? null)
      : null;
  const resolvedDocumentTitle = documentTitle || 'Receipt';

  const orderData = useMemo(() => {
    if (!receiptData) return null;
    const amount = Number(receiptData.amount) || 0;
    const party = receiptData.customer || receiptData.supplier || {};
    const isSupplier = !!receiptData.supplier && !receiptData.customer;
    const partyName =
      party.businessName ||
      party.business_name ||
      party.companyName ||
      party.company_name ||
      party.name ||
      (party.firstName || party.lastName
        ? `${party.firstName || ''} ${party.lastName || ''}`.trim()
        : '') ||
      '—';
    const paymentMethod =
      resolvedDocumentTitle.toLowerCase().includes('bank') ? 'Bank' : 'Cash';
    return {
      invoiceNumber: receiptData.voucherCode || receiptData.referenceNumber || receiptData._id || '—',
      createdAt: receiptData.date,
      customerInfo: {
        name: partyName,
        businessName: isSupplier ? '' : (party.businessName || party.business_name || party.companyName || party.company_name || ''),
        companyName: isSupplier ? (party.companyName || party.company_name || party.businessName || party.business_name || '') : '',
        email: party.email || 'N/A',
        phone: party.phone || party.contactNumber || 'N/A',
        address: party.address || '',
        currentBalance: party.currentBalance,
        pendingBalance: party.pendingBalance,
        advanceBalance: party.advanceBalance
      },
      customer: party,
      items: [
        {
          name: receiptData.particular || resolvedDocumentTitle,
          quantity: 1,
          unitPrice: amount,
          total: amount,
          description: receiptData.notes || ''
        }
      ],
      subtotal: amount,
      tax: 0,
      discount: 0,
      total: amount,
      payment: {
        method: paymentMethod,
        status: 'Paid',
        amountPaid: amount
      }
    };
  }, [receiptData, resolvedDocumentTitle]);

  const partyLabel =
    receiptData?.supplier && !receiptData?.customer ? 'Supplier' : 'Customer';
    
  const isCompact = companySettings?.printSettings?.invoiceLayout === 'compact';
  const printSettings = {
    ...companySettings?.printSettings,
    invoiceLayout: isCompact ? 'compact' : 'receipt'
  };

  const pageStyle = isCompact ? THERMAL_PRINT_PAGE_STYLE : PRINT_PAGE_STYLE;

  return (
    <PrintModal
      isOpen={isOpen}
      onClose={onClose}
      documentTitle={resolvedDocumentTitle}
      hasData={!!orderData}
      emptyMessage="No receipt data to print."
      pageStyle={pageStyle}
    >
      <PrintDocument
        companySettings={companySettings || {}}
        orderData={orderData}
        ledgerBalance={ledgerBalance}
        printSettings={printSettings}
        documentTitle={resolvedDocumentTitle}
        partyLabel={partyLabel}
      />
    </PrintModal>
  );
};

export default ReceiptPaymentPrintModal;
