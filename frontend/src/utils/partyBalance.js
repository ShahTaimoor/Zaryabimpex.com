/**
 * Helpers for resolving balance / credit numbers on customer & supplier
 * objects. The same nullish chains (currentBalance ?? pendingBalance −
 * advanceBalance) were duplicated across Sales, SalesOrders, SaleReturns,
 * PurchaseOrders, Purchase, and PurchaseReturns.
 */

const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Net balance for a customer.
 *   Convention used everywhere in the app:
 *     positive = customer owes us (receivable)
 *     negative = we owe customer (payable / advance)
 */
export function getCustomerBalance(customer) {
  if (!customer) return 0;
  if (customer.currentBalance !== undefined && customer.currentBalance !== null) {
    return toNum(customer.currentBalance);
  }
  return toNum(customer.pendingBalance) - toNum(customer.advanceBalance);
}

/**
 * Outstanding payable for a supplier.
 *   positive = we owe the supplier (payable)
 *   negative = supplier owes us (advance / credit note)
 */
export function getSupplierOutstanding(supplier) {
  if (!supplier) return 0;
  return toNum(supplier.pendingBalance ?? supplier.outstandingBalance ?? 0);
}

/**
 * Customer credit limit (camelCase or snake_case fallback). Always
 * non-negative; missing/invalid values return 0.
 */
export function getCustomerCreditLimit(customer) {
  if (!customer) return 0;
  const raw =
    customer.creditLimit ??
    customer.credit_limit ??
    0;
  return Math.max(0, toNum(raw));
}
