/**
 * Build printable/shareable order payload from active POS cart (Sales / Purchase).
 */
export function buildCartInvoiceOrder({
  selectedParty,
  partyType = 'customer',
  cartItems,
  pricing,
  payment,
  invoiceNumber,
  orderType,
  ledgerBalance,
  createdByUser,
  isEditMode = false,
  savedInvoiceRemaining = null,
}) {
  const isCustomer = partyType === 'customer';
  let partyAddress = '';

  if (selectedParty?.addresses?.length) {
    const addr =
      selectedParty.addresses.find((a) => a.isDefault) ||
      selectedParty.addresses.find((a) => a.type === 'billing' || a.type === 'both') ||
      selectedParty.addresses[0];
    if (addr) {
      partyAddress = [addr.street, addr.city, addr.state, addr.country, addr.zipCode || addr.zip]
        .filter(Boolean)
        .join(', ');
    }
  } else if (selectedParty?.address) {
    partyAddress = selectedParty.address;
  }

  const partyInfo = selectedParty
    ? {
        name:
          selectedParty.businessName ||
          selectedParty.business_name ||
          selectedParty.displayName ||
          selectedParty.name,
        email: selectedParty.email,
        phone: selectedParty.phone,
        businessName: selectedParty.businessName || selectedParty.business_name,
        address: partyAddress || undefined,
        currentBalance: selectedParty.currentBalance,
        pendingBalance: selectedParty.pendingBalance,
        advanceBalance: selectedParty.advanceBalance,
      }
    : null;

  return {
    orderNumber: `TEMP-${Date.now()}`,
    orderType,
    isEditMode,
    savedInvoiceRemaining:
      savedInvoiceRemaining !== undefined && savedInvoiceRemaining !== null
        ? Number(savedInvoiceRemaining)
        : undefined,
    ledgerBalance: Number.isFinite(Number(ledgerBalance)) ? Number(ledgerBalance) : undefined,
    ...(isCustomer
      ? { customer: selectedParty ?? undefined, customerInfo: partyInfo }
      : { supplier: selectedParty ?? undefined, supplierInfo: partyInfo }),
    items: cartItems,
    pricing,
    payment,
    createdAt: new Date(),
    createdBy: createdByUser,
    invoiceNumber,
  };
}
