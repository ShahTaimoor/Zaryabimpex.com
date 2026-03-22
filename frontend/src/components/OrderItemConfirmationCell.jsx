import React from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

/**
 * Status badge and checkbox/actions for item-wise order confirmation.
 * Used in Sales Orders and Purchase Orders view modals.
 * Flow: Select items via checkbox → Confirm selected → Creates invoice for confirmed items.
 */
const STATUS_CONFIG = {
  pending: {
    color: 'bg-gray-100 text-gray-800',
    icon: Clock,
    label: 'Pending',
  },
  confirmed: {
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    label: 'Confirmed',
  },
  cancelled: {
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    label: 'Cancelled',
  },
};

export function getItemConfirmationStatus(item) {
  return item?.confirmationStatus ?? item?.confirmation_status ?? 'pending';
}

export function getOrderConfirmationStatus(order) {
  const status = order?.confirmation_status ?? order?.confirmationStatus;
  if (status) return status;
  const items = order?.items ?? [];
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

const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  partially_completed: 'Partially Completed',
  completed: 'Completed',
};

export function OrderConfirmationStatusBadge({ order }) {
  const status = getOrderConfirmationStatus(order);
  const label = ORDER_STATUS_LABELS[status] ?? status;
  const config = {
    pending: 'bg-gray-100 text-gray-800',
    partially_completed: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
  }[status] ?? 'bg-gray-100 text-gray-800';

  return (
    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${config}`}>
      {label}
    </span>
  );
}

/**
 * Cell for each item: checkbox for pending (to select for confirm), badge only for confirmed/cancelled.
 */
export function OrderItemConfirmationCell({
  item,
  itemIndex,
  status,
  canEdit,
  selected,
  onToggleSelect,
  onCancel,
  isUpdating,
}) {
  const itemStatus = status ?? getItemConfirmationStatus(item);
  const config = STATUS_CONFIG[itemStatus] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;

  if (itemStatus === 'pending' && canEdit) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect?.(itemIndex)}
              disabled={isUpdating}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-xs text-gray-600">Select to confirm</span>
          </label>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={() => onCancel(itemIndex)}
            disabled={isUpdating}
            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 text-left"
          >
            Cancel item
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    </div>
  );
}

/**
 * Bulk actions: Select all pending, Confirm selected.
 */
export function OrderConfirmSelectedActions({
  items,
  canEdit,
  selectedIndices,
  onSelectAll,
  onSelectNone,
  onConfirmSelected,
  isUpdating,
}) {
  if (!items?.length || !canEdit) return null;

  const pendingItems = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => (item.confirmationStatus ?? item.confirmation_status ?? 'pending') === 'pending');
  const pendingCount = pendingItems.length;
  const pendingIndices = pendingItems.map(({ idx }) => idx);
  const allPendingSelected = pendingCount > 0 && pendingIndices.every((i) => selectedIndices.includes(i));
  const selectedCount = selectedIndices.filter((i) => pendingIndices.includes(i)).length;

  if (pendingCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 mb-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={allPendingSelected}
          onChange={(e) => (e.target.checked ? onSelectAll?.(pendingIndices) : onSelectNone?.())}
          disabled={isUpdating}
          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <span className="text-sm text-gray-700">Select all pending ({pendingCount})</span>
      </label>
      {selectedCount > 0 && (
        <button
          type="button"
          onClick={() => onConfirmSelected?.(selectedIndices.filter((i) => pendingIndices.includes(i)))}
          disabled={isUpdating}
          className="text-sm px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          Confirm selected ({selectedCount}) & create invoice
        </button>
      )}
    </div>
  );
}
