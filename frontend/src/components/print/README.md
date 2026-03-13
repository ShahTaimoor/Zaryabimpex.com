# Centralized Print System

Unified print architecture for the POS + E-commerce application. All print operations use `react-to-print`; no direct `window.open()` or `window.print()` calls.

## Folder Structure

```
frontend/src/components/print/
├── README.md           # This file
├── index.js            # Barrel exports
├── printStyles.css     # Centralized @media print styles
├── PrintModal.jsx      # Unified modal (BaseModal + PrintWrapper)
├── PrintWrapper.jsx    # react-to-print integration
├── PrintTrigger.jsx    # Reusable print button
├── PrintLayout.jsx     # A4 and thermal layout wrappers
├── ReturnPrintContent.jsx  # Return document template
└── (PrintDocument remains in ../PrintDocument.jsx for invoice/receipt layouts)
```

## Components

| Component | Purpose |
|-----------|---------|
| **PrintModal** | Unified preview modal using BaseModal; renders children and Print/Close footer |
| **PrintWrapper** | Wraps content, exposes `print()` via ref; uses react-to-print |
| **PrintTrigger** | Button that calls `onPrint` callback |
| **PrintLayout** | `PrintLayoutA4`, `PrintLayoutThermal` for format-specific wrappers |
| **ReturnPrintContent** | React component for return documents |

## Usage

### Invoice / Receipt (via existing modals)

`ReceiptPaymentPrintModal` and `PrintModal` (InvoicePrintModal) now use the new system internally:

```jsx
// Cash/Bank Receipts, Payments
<ReceiptPaymentPrintModal
  isOpen={showPrintModal}
  onClose={() => setShowPrintModal(false)}
  documentTitle="Cash Receipt"
  receiptData={printData}
/>
```

```jsx
// Sale/Purchase invoices
<PrintModal
  isOpen={showPrintModal}
  onClose={() => setShowPrintModal(false)}
  orderData={printData}
  documentTitle="Sales Invoice"
  partyLabel="Customer"
/>
```

### Returns Page

```jsx
import { PrintModal, ReturnPrintContent } from '../components/print';

const [showPrintModal, setShowPrintModal] = useState(false);
const [printReturnData, setPrintReturnData] = useState(null);

const handlePrint = (returnItem) => {
  setPrintReturnData(returnItem);
  setShowPrintModal(true);
};

// In JSX:
<PrintModal
  isOpen={showPrintModal}
  onClose={() => { setShowPrintModal(false); setPrintReturnData(null); }}
  documentTitle={printReturnData ? `Return ${printReturnData.returnNumber}` : 'Return Document'}
  hasData={!!printReturnData}
  emptyMessage="No return data to print."
>
  <ReturnPrintContent returnData={printReturnData} companyInfo={companyInfo} />
</PrintModal>
```

### Ledger Summary (direct print)

```jsx
import { useReactToPrint } from 'react-to-print';

const printRef = useRef(null);

const handleLedgerPrint = useReactToPrint({
  contentRef: printRef,
  documentTitle: `Account Ledger Summary - ${customerName}`,
});

// Print button calls handleLedgerPrint()
// Content is in a div with ref={printRef}
```

### Custom content with PrintModal

```jsx
<PrintModal
  isOpen={isOpen}
  onClose={onClose}
  documentTitle="My Document"
  hasData={!!data}
  zIndex={60}  // For nested modals
>
  <MyPrintableContent data={data} />
</PrintModal>
```

## Print Styles

`printStyles.css` is imported in `index.jsx`. It provides:

- `@media print` rules for hiding `.no-print`, nav, sidebar
- `@page` rules for A4 portrait/landscape and 80mm thermal
- Table, header, footer styling
- Layout classes: `.print-layout-a4`, `.print-layout-thermal`

## Supported Document Types

- Sale invoices
- Purchase invoices
- Sale returns
- Cash receipts
- Bank receipts
- Cash/Bank payments
- Ledger summaries

## Scalability & Maintainability

1. **Single source of truth**: All print goes through react-to-print; no scattered iframe/window logic.
2. **Consistent UX**: PrintModal uses BaseModal for overlay, Escape, backdrop close.
3. **Centralized styles**: One `printStyles.css`; no inline `<style>` in components.
4. **Composable layouts**: PrintLayout supports A4 and thermal; add more via `getPrintLayout`.
5. **Reusable content**: ReturnPrintContent, PrintDocument shared across pages.
6. **Easy extension**: Add new `*PrintContent.jsx` for new document types; use PrintModal + PrintWrapper.
