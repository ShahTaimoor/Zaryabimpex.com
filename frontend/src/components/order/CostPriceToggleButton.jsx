import React from 'react';
import { Eye, EyeOff, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Two reusable header-action buttons used by Sales and SalesOrders:
 *
 *   - <CostPriceToggleButton />  Show / Hide cost (BP source price).
 *   - <ProfitToggleButton />     Show / Hide estimated profit (BP) line.
 *
 * Each one is a no-op when the caller's permission gate is false, so
 * pages don't need to wrap them in extra conditionals.
 */

export function CostPriceToggleButton({
  enabled,
  canView = true,
  onToggle,
  size = 'sm',
  className = 'flex items-center space-x-2',
  showLabel = 'Show Cost',
  hideLabel = 'Hide Cost',
  title,
}) {
  if (!canView) return null;
  const Icon = enabled ? EyeOff : Eye;
  const resolvedTitle =
    title ?? (enabled ? 'Hide cost prices' : 'Show cost prices');
  return (
    <Button
      type="button"
      onClick={() => onToggle?.(!enabled)}
      variant="secondary"
      size={size}
      className={className}
      title={resolvedTitle}
    >
      <Icon className="h-4 w-4" />
      <span>{enabled ? hideLabel : showLabel}</span>
    </Button>
  );
}

export function ProfitToggleButton({
  enabled,
  canView = true,
  onToggle,
  totalProfit,
  showProfitValue = false,
  size = 'sm',
  className = 'flex items-center space-x-2',
  showLabel = 'Show BP',
  hideLabel = 'Hide BP',
  title = 'Show estimated profit (BP)',
  formatProfit,
}) {
  if (!canView) return null;
  const profitValue = Number(totalProfit ?? 0) || 0;
  const formatter =
    typeof formatProfit === 'function'
      ? formatProfit
      : (n) =>
          new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(n);

  return (
    <>
      <Button
        type="button"
        onClick={() => onToggle?.(!enabled)}
        variant="secondary"
        size={size}
        className={className}
        title={title}
      >
        <Calculator className="h-4 w-4" />
        <span>{enabled ? hideLabel : showLabel}</span>
      </Button>
      {showProfitValue && enabled && (
        <span
          className={`text-sm font-semibold ${
            profitValue >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {formatter(profitValue)}
        </span>
      )}
    </>
  );
}

export default CostPriceToggleButton;
