import { useCallback, useState } from 'react';
import { showSuccessToast, showErrorToast, handleApiError } from '@/utils/errorHandler';

/**
 * Shared "Apply Last Prices" / "Restore Current Prices" state machine.
 *
 * Replaces the two near-identical handlers in Sales.jsx and
 * SalesOrders.jsx. Pages stay in charge of the line-item shape — they
 * pass `getProductId` to identify items and `applyPriceToItem` to control
 * how an item is mutated when a new unit price is applied. SalesOrders
 * uses this hook to also recompute per-item `subtotal` / `taxAmount` /
 * `total` fields; Sales just swaps `unitPrice`.
 *
 * Required config:
 *   - items, setItems         current line items + setter
 *   - selectedCustomer        customer object (must expose ._id)
 *   - fetchLastPrices(id)     async function returning { prices, orderNumber, orderDate }
 *                             where `prices[productId] = { unitPrice }`.
 *                             Throw / return null when the customer has no prior order.
 *   - getProductId(item)      stable string id used to match against `prices`
 *
 * Optional:
 *   - applyPriceToItem(item, lastPrice)  returns the updated item object.
 *                                        Default: { ...item, unitPrice: lastPrice }.
 *   - errorContext             label passed to handleApiError (default 'Apply Last Prices')
 */
export function useApplyLastPrices({
  items,
  setItems,
  selectedCustomer,
  fetchLastPrices,
  getProductId,
  applyPriceToItem,
  errorContext = 'Apply Last Prices',
}) {
  const [isApplying, setIsApplying] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [originalPrices, setOriginalPrices] = useState({});
  const [priceStatus, setPriceStatus] = useState({});

  const reset = useCallback(() => {
    setIsApplied(false);
    setOriginalPrices({});
    setPriceStatus({});
  }, []);

  const defaultApply = (item, lastPrice) => ({ ...item, unitPrice: lastPrice });

  const apply = useCallback(async () => {
    if (!selectedCustomer) {
      showErrorToast('Please select a customer first');
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      showErrorToast('Please add products to cart first');
      return;
    }

    setIsApplying(true);
    try {
      const result = await fetchLastPrices(selectedCustomer._id);
      if (!result) {
        showErrorToast('No previous order found for this customer');
        return;
      }
      const { prices, orderNumber, orderDate } = result;
      if (!prices || Object.keys(prices).length === 0) {
        showErrorToast('No previous order found for this customer');
        return;
      }

      const originalPricesMap = {};
      const priceStatusMap = {};
      items.forEach((item) => {
        originalPricesMap[getProductId(item)] = item.unitPrice;
      });
      setOriginalPrices(originalPricesMap);

      let updatedCount = 0;
      let unchangedCount = 0;
      let notFoundCount = 0;
      const apply = applyPriceToItem || defaultApply;
      const updated = items.map((item) => {
        const productId = getProductId(item);
        const entry = prices[productId];
        if (!entry) {
          notFoundCount += 1;
          priceStatusMap[productId] = 'not-found';
          return item;
        }
        const lastPrice = entry.unitPrice;
        if (lastPrice !== item.unitPrice) {
          updatedCount += 1;
          priceStatusMap[productId] = 'updated';
          return apply(item, lastPrice);
        }
        unchangedCount += 1;
        priceStatusMap[productId] = 'unchanged';
        return item;
      });

      setItems(updated);
      setPriceStatus(priceStatusMap);
      setIsApplied(true);

      const orderDateStr = orderDate
        ? new Date(orderDate).toLocaleDateString()
        : 'previous order';
      const sourceLabel = orderNumber || 'previous order';
      if (updatedCount > 0) {
        let message = `Applied prices from ${sourceLabel} (${orderDateStr}). Updated ${updatedCount} product(s).`;
        if (unchangedCount > 0)
          message += ` ${unchangedCount} product(s) had same price.`;
        if (notFoundCount > 0)
          message += ` ${notFoundCount} product(s) not found in previous order.`;
        showSuccessToast(message);
      } else if (unchangedCount > 0) {
        showSuccessToast(
          `All products already have the same prices as in ${sourceLabel} (${orderDateStr}).`
        );
      } else {
        showErrorToast('No matching products found in previous order');
      }
    } catch (error) {
      handleApiError(error, errorContext);
    } finally {
      setIsApplying(false);
    }
  }, [
    selectedCustomer,
    items,
    setItems,
    fetchLastPrices,
    getProductId,
    applyPriceToItem,
    errorContext,
  ]);

  const restore = useCallback(() => {
    if (Object.keys(originalPrices).length === 0) {
      showErrorToast('No original prices to restore');
      return;
    }
    setIsRestoring(true);
    try {
      let restoredCount = 0;
      const apply = applyPriceToItem || defaultApply;
      const restored = items.map((item) => {
        const productId = getProductId(item);
        const original = originalPrices[productId];
        if (original === undefined) return item;
        restoredCount += 1;
        return apply(item, original);
      });

      setItems(restored);
      reset();

      if (restoredCount > 0) {
        showSuccessToast(`Restored original prices for ${restoredCount} product(s).`);
      } else {
        showErrorToast('No matching products found to restore');
      }
    } finally {
      setIsRestoring(false);
    }
  }, [originalPrices, items, setItems, getProductId, applyPriceToItem, reset]);

  return {
    apply,
    restore,
    reset,
    isApplying,
    isRestoring,
    setIsApplying,
    setIsRestoring,
    isApplied,
    setIsApplied,
    originalPrices,
    setOriginalPrices,
    priceStatus,
    setPriceStatus,
  };
}

export default useApplyLastPrices;
