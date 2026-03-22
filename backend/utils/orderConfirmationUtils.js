/**
 * Order confirmation utilities for Sales Orders and Purchase Orders.
 * Supports full order confirmation and partial (item-wise) confirmation.
 *
 * Item confirmationStatus: 'pending' | 'confirmed' | 'cancelled'
 * Order confirmation_status: 'pending' | 'partially_completed' | 'completed'
 */

const ITEM_STATUSES = ['pending', 'confirmed', 'cancelled'];
const ORDER_STATUSES = ['pending', 'partially_completed', 'completed'];

/**
 * Ensure each item has a valid confirmationStatus (default: 'pending')
 * @param {Array} items - Order line items
 * @returns {Array} - Items with confirmationStatus set
 */
function ensureItemConfirmationStatus(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const status = item.confirmationStatus ?? item.confirmation_status ?? 'pending';
    const valid = ITEM_STATUSES.includes(status) ? status : 'pending';
    return { ...item, confirmationStatus: valid, confirmation_status: valid };
  });
}

/**
 * Compute order-level confirmation_status from item confirmationStatuses.
 * Cancelled items are excluded from the count.
 * - All non-cancelled confirmed → 'completed'
 * - Some non-cancelled confirmed → 'partially_completed'
 * - None confirmed → 'pending'
 *
 * @param {Array} items - Order line items with confirmationStatus
 * @returns {'pending'|'partially_completed'|'completed'}
 */
function computeOrderConfirmationStatus(items) {
  if (!Array.isArray(items) || items.length === 0) return 'pending';
  const nonCancelled = items.filter(
    (i) => (i.confirmationStatus ?? i.confirmation_status ?? 'pending') !== 'cancelled'
  );
  if (nonCancelled.length === 0) return 'pending';
  const confirmedCount = nonCancelled.filter(
    (i) => (i.confirmationStatus ?? i.confirmation_status) === 'confirmed'
  ).length;
  if (confirmedCount === 0) return 'pending';
  if (confirmedCount === nonCancelled.length) return 'completed';
  return 'partially_completed';
}

/**
 * Recalculate subtotal and total from items (exclude cancelled items)
 * @param {Array} items - Order items
 * @param {Function} getLineTotal - (item) => number
 * @param {number} tax - Tax amount
 * @returns {{ subtotal: number, total: number }}
 */
function recalculateTotalsFromItems(items, getLineTotal, tax = 0) {
  if (!Array.isArray(items)) return { subtotal: 0, total: 0 };
  const nonCancelled = items.filter(
    (i) => (i.confirmationStatus ?? i.confirmation_status ?? 'pending') !== 'cancelled'
  );
  const subtotal = nonCancelled.reduce((sum, i) => sum + (getLineTotal(i) || 0), 0);
  const total = subtotal + (Number(tax) || 0);
  return { subtotal, total };
}

/**
 * Get line total for sales order item (quantity * unitPrice)
 */
function getSalesOrderLineTotal(item) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice ?? item.unit_price ?? 0);
  return qty * price;
}

/**
 * Get line total for purchase order item (quantity * costPerUnit)
 */
function getPurchaseOrderLineTotal(item) {
  const qty = Number(item.quantity) || 0;
  const cost = Number(item.costPerUnit ?? item.cost_per_unit ?? item.unitCost ?? 0);
  return qty * cost;
}

module.exports = {
  ITEM_STATUSES,
  ORDER_STATUSES,
  ensureItemConfirmationStatus,
  computeOrderConfirmationStatus,
  recalculateTotalsFromItems,
  getSalesOrderLineTotal,
  getPurchaseOrderLineTotal
};
