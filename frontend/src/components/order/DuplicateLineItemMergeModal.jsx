import React, { useEffect, useRef } from 'react';
import BaseModal from '@/components/BaseModal';
import { Button } from '@/components/ui/button';

/**
 * Shown when the user adds a product that is already on the order/cart.
 * Confirms merging into the existing line by increasing quantity only.
 */
export function DuplicateLineItemMergeModal({
  isOpen,
  onClose,
  onConfirm,
  productName,
  currentQuantity,
  quantityToAdd,
  newTotalQuantity,
  title = 'Duplicate product',
  scopeLabel = 'order',
  confirmText = 'Update quantity',
}) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    // The trigger (e.g. ProductSearch) re-focuses its own input ~100ms after
    // calling onAddProduct, which would steal focus from the modal. Re-claim
    // focus across a few frames and once more after that delayed refocus.
    let cancelled = false;
    const focusConfirm = () => {
      if (cancelled) return;
      const btn = confirmBtnRef.current;
      if (btn && document.activeElement !== btn) {
        btn.focus({ preventScroll: true });
      }
    };

    const r1 = requestAnimationFrame(focusConfirm);
    const r2 = requestAnimationFrame(() => requestAnimationFrame(focusConfirm));
    const t1 = window.setTimeout(focusConfirm, 80);
    const t2 = window.setTimeout(focusConfirm, 180);
    const t3 = window.setTimeout(focusConfirm, 320);

    return () => {
      cancelled = true;
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onConfirm?.();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={`${productName || 'This product'} is already on this ${scopeLabel}. Add the new quantity to the existing line instead of creating another row.`}
      maxWidth="md"
      variant="centered"
      zIndex={10050}
      className="h-auto"
      contentClassName="px-5 pb-1 pt-0"
      headerClassName="!py-3.5"
      footerClassName="!py-3"
      footer={
        <div
          className="flex justify-end gap-3 w-full"
          onKeyDown={handleKeyDown}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-w-[110px]"
          >
            Cancel
          </Button>
          <Button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            autoFocus
            className="min-w-[160px] bg-blue-600 text-white shadow hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="text-sm text-gray-700" onKeyDown={handleKeyDown}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <div>
            <div className="text-xs text-gray-500">Current quantity</div>
            <div className="text-lg font-semibold text-gray-900 tabular-nums">{currentQuantity}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Adding</div>
            <div className="text-lg font-semibold text-gray-900 tabular-nums">+{quantityToAdd}</div>
          </div>
          <div className="col-span-2 pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-500">New total quantity</div>
            <div className="text-xl font-semibold text-blue-700 tabular-nums">{newTotalQuantity}</div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
