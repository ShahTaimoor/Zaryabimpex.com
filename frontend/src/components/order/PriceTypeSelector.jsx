import React from 'react';
import { PRICE_TYPE_OPTIONS, normalizePriceType } from '@/utils/priceTypeUtils';

/**
 * Single source of truth UI for the order Price Type selector. Used in
 * Sales (POS) and Sales Orders to keep the value, options, and styling
 * consistent across both pages.
 *
 * Props:
 *   - value: current price type ('wholesale' | 'retail' | 'distributor' | 'custom')
 *   - onChange: (next: string) => void
 *   - label: optional label text (default: "Price Type:")
 *   - showLabel: render the label (default: true)
 *   - id: input id for label association
 *   - disabled: disable the dropdown
 *   - className: extra container classes
 *   - selectClassName: override classes on the underlying <select>
 *   - variant: 'inline' | 'stacked' — inline (compact, label beside select)
 *              or stacked (label above select for forms)
 *   - options: optional override list of { value, label }
 */
export function PriceTypeSelector({
  value,
  onChange,
  label = 'Price Type:',
  showLabel = true,
  id,
  disabled = false,
  className = '',
  selectClassName,
  variant = 'inline',
  options = PRICE_TYPE_OPTIONS,
}) {
  const safeValue = normalizePriceType(value);
  const handleChange = (e) => {
    onChange?.(normalizePriceType(e.target.value));
  };

  const labelEl = showLabel ? (
    <label
      htmlFor={id}
      className={
        variant === 'inline'
          ? 'text-[10px] font-bold text-gray-400 uppercase tracking-wider'
          : 'block text-xs font-medium text-gray-700 mb-1'
      }
    >
      {label}
    </label>
  ) : null;

  const defaultSelectClass =
    variant === 'inline'
      ? 'bg-gray-50 border-none text-[11px] font-bold text-gray-700 rounded-md py-0 px-2 h-5 focus:ring-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
      : 'input h-8 text-sm';

  const selectEl = (
    <select
      id={id}
      value={safeValue}
      onChange={handleChange}
      disabled={disabled}
      className={selectClassName ?? defaultSelectClass}
      data-testid="price-type-selector"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col ${className}`}>
        {labelEl}
        {selectEl}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {labelEl}
      {selectEl}
    </div>
  );
}
