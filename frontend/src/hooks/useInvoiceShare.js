import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useCompanyInfo } from './useCompanyInfo';
import { useSensitiveDataPermissions } from './useSensitiveDataPermissions';
import { shareInvoiceWhatsApp, InvoiceShareValidationError } from '../services/shareService';

/**
 * Hook for sharing invoices via WhatsApp (UI-agnostic).
 */
export function useInvoiceShare({ partyLabel = 'Customer', requireSaved = true } = {}) {
  const { companyInfo } = useCompanyInfo();
  const { getPartyPermissions } = useSensitiveDataPermissions();
  const [isSharing, setIsSharing] = useState(false);

  const shareInvoice = useCallback(
    async (orderData, options = {}) => {
      if (isSharing) return null;

      const printPerms = getPartyPermissions(partyLabel);
      const mergedRequireSaved = options.requireSaved ?? requireSaved;

      try {
        setIsSharing(true);
        const toastId = toast.loading('Preparing WhatsApp share...');

        const result = await shareInvoiceWhatsApp({
          orderData,
          companySettings: companyInfo,
          documentTitle: options.documentTitle || 'Invoice',
          partyLabel,
          ledgerBalance: options.ledgerBalance ?? null,
          permissions: printPerms,
          requireSaved: mergedRequireSaved,
          pdfLink: options.pdfLink,
          onProgress: (msg) => toast.loading(msg, { id: toastId }),
        });

        if (result.method === 'cancelled') {
          toast.dismiss(toastId);
          return result;
        }

        if (result.method === 'whatsapp-composer') {
          toast.success('PDF saved — open WhatsApp, pick the customer, and attach the file', { id: toastId });
        } else {
          toast.success('Choose WhatsApp, then select the customer to share', { id: toastId });
        }
        return result;
      } catch (error) {
        if (error instanceof InvoiceShareValidationError) {
          toast.error(error.message);
        } else {
          console.error('WhatsApp share failed:', error);
          toast.error(error?.message || 'Failed to share invoice on WhatsApp');
        }
        throw error;
      } finally {
        setIsSharing(false);
      }
    },
    [companyInfo, getPartyPermissions, isSharing, partyLabel, requireSaved]
  );

  return { shareInvoice, isSharing };
}
