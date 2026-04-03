import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Shared header for order/detail cards: section title + "Show details" checkbox.
 * Keep boolean state in the parent; only the detail field blocks should be conditionally rendered.
 */
export function ShowDetailsSectionHeader({
  title,
  showDetails,
  onShowDetailsChange,
  checkboxId,
  className,
  titleClassName,
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className
      )}
    >
      <h3
        className={cn(
          'text-base sm:text-lg font-semibold tracking-tight text-slate-900 m-0',
          titleClassName
        )}
      >
        {title}
      </h3>
      <label
        htmlFor={checkboxId}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none"
      >
        <Input
          type="checkbox"
          id={checkboxId}
          checked={showDetails}
          onChange={(e) => onShowDetailsChange(e.target.checked)}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <span>Show details</span>
      </label>
    </div>
  );
}
