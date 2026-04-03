import { cn } from '@/lib/utils';
import { ShowDetailsSectionHeader } from '../ShowDetailsSectionHeader';

/**
 * Shared checkout-style card: pale blue gradient shell used on Sales, Sales Orders,
 * Purchase, and Purchase Order pages for “details + order summary” blocks.
 */
export function OrderCheckoutCard({ children, className }) {
  return (
    <div
      className={cn(
        'ml-auto mt-4 w-full max-w-5xl overflow-hidden rounded-2xl border-2 border-blue-200/90 bg-gradient-to-br from-sky-50/95 via-blue-50 to-indigo-50/95 shadow-[0_8px_30px_rgba(30,58,138,0.09)] ring-1 ring-blue-100/70',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Top strip: “Show details” header + optional detail fields (parent controls visibility).
 */
export function OrderDetailsSection({
  children,
  detailsTitle,
  showDetails,
  onShowDetailsChange,
  checkboxId,
  headerClassName,
  titleClassName,
  stripClassName,
}) {
  return (
    <div
      className={cn(
        'border-b border-blue-200/60 bg-white/40 px-5 py-5 sm:px-7',
        stripClassName
      )}
    >
      <ShowDetailsSectionHeader
        title={detailsTitle}
        showDetails={showDetails}
        onShowDetailsChange={onShowDetailsChange}
        checkboxId={checkboxId}
        className={cn(headerClassName === undefined ? 'mb-4' : headerClassName)}
        titleClassName={titleClassName}
      />
      {children}
    </div>
  );
}

/** Blue gradient bar with “Order Summary” (or custom) title. */
export function OrderSummaryBar({ title = 'Order Summary', className }) {
  return (
    <div
      className={cn(
        'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-700 px-5 py-3.5 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)] sm:px-7',
        className
      )}
    >
      <h3 className="text-base font-semibold tracking-tight text-white sm:text-lg">
        {title}
      </h3>
    </div>
  );
}

/** Body under Order Summary: soft gradient background for totals + optional payment/actions. */
export function OrderSummaryContent({ children, className }) {
  return (
    <div
      className={cn(
        'bg-gradient-to-b from-slate-50/90 to-white/70 px-5 py-5 sm:px-7',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Inset white panel for discount / payment inputs (matches Sales checkout). */
export function OrderInsetPanel({ children, className }) {
  return (
    <div
      className={cn(
        'mt-5 rounded-xl border border-slate-200/90 bg-white p-5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100/80',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Footer row for Clear / Print / primary actions under the summary block. */
export function OrderCheckoutActions({ children, className }) {
  return (
    <div
      className={cn(
        'mt-6 flex flex-col gap-3 border-t border-slate-200/70 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3',
        className
      )}
    >
      {children}
    </div>
  );
}
