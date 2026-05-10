import React from 'react';
import { Input } from '@/components/ui/input';

/**
 * Reusable single-line "Notes" field used by Sales, Purchase, SalesOrders,
 * and other order pages. Wraps a label + Input so the same JSX block isn't
 * copy-pasted between mobile and desktop layouts.
 *
 * Pass `density="compact"` (h-8) for the desktop chip-style row, or
 * `density="comfortable"` (h-10) for the stacked mobile layout.
 */
export function OrderNotesField({
  value,
  onChange,
  label = 'Notes',
  placeholder = 'Additional notes...',
  density = 'compact',
  containerClassName,
  inputClassName,
  autoComplete = 'off',
  disabled = false,
}) {
  const heightClass = density === 'comfortable' ? 'h-10' : 'h-8';
  const finalContainer =
    containerClassName ??
    (density === 'comfortable'
      ? ''
      : 'flex min-w-0 flex-1 flex-col basis-[min(100%,20rem)]');
  const finalInputCls =
    inputClassName ?? `${heightClass} w-full min-w-0 text-sm`;

  return (
    <div className={finalContainer}>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </label>
      <Input
        type="text"
        autoComplete={autoComplete}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        className={finalInputCls}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}

export default OrderNotesField;
