import React from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Package,
} from 'lucide-react';

/**
 * Reusable status badge for orders, invoices, returns, etc.
 *
 * Replaces the four near-identical local `StatusBadge` / `getStatusBadge`
 * implementations across PurchaseOrders, PurchaseInvoices, SaleReturns,
 * and PurchaseReturns. Each domain shares the same chip layout but exposes
 * different status vocabularies, which we centralize here.
 *
 * Usage:
 *   <EntityStatusBadge type="purchase_order" status={po.status} />
 *   <EntityStatusBadge type="purchase_invoice" status={inv.status} />
 *   <EntityStatusBadge type="return" status={ret.status} />
 *
 * Pass `size="sm"` (default) or `size="xs"` to control padding.
 */

const TITLE_CASE = (s) =>
  typeof s === 'string' && s.length
    ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
    : '';

const PRESETS = {
  purchase_order: {
    fallback: 'draft',
    map: {
      draft: { color: 'bg-gray-100 text-gray-800', icon: FileText, label: 'Pending' },
      confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Confirmed' },
      partially_received: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Partially Received' },
      fully_received: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Fully Received' },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' },
      closed: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Closed' },
    },
  },
  purchase_invoice: {
    fallback: 'draft',
    map: {
      draft: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Draft' },
      confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Confirmed' },
      received: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Received' },
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Paid' },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' },
      closed: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Closed' },
    },
  },
  return: {
    fallback: 'pending',
    map: {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      approved: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
      processing: { color: 'bg-purple-100 text-purple-800', icon: Package, label: 'Processing' },
      received: { color: 'bg-indigo-100 text-indigo-800', icon: Package, label: 'Received' },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
      processed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Processed' },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Cancelled' },
    },
  },
};

const SIZE_CLASSES = {
  xs: 'px-2 py-0.5 text-[10px]',
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function EntityStatusBadge({
  type,
  status,
  size = 'sm',
  className = '',
  showIcon = true,
  fallbackLabel,
}) {
  const preset = PRESETS[type] || PRESETS.purchase_order;
  const config =
    preset.map[status] ||
    preset.map[preset.fallback] || {
      color: 'bg-gray-100 text-gray-800',
      icon: Clock,
      label: fallbackLabel ?? TITLE_CASE(status) ?? 'Unknown',
    };
  const Icon = config.icon;
  const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.sm;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeCls} ${config.color} ${className}`}
    >
      {showIcon && Icon ? <Icon className="h-3 w-3" /> : null}
      {config.label}
    </span>
  );
}

export default EntityStatusBadge;
