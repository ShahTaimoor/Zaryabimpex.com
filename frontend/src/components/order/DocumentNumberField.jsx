import React from 'react';
import { Input } from '@/components/ui/input';

/**
 * Reusable "Document number with auto-generate" control used by Sales,
 * SalesOrders, and Purchase. Renders the label, the auto-generate
 * checkbox, the input, and an inline "Regenerate" hint button.
 *
 * Props:
 * - label, autoLabel: text overrides
 * - autoGenerate, onAutoGenerateChange(checked)
 * - value, onChange(value)
 * - onRegenerate(): called when user clicks "Regenerate" while auto is on.
 *   When autoGenerate is true and onRegenerate is provided, the user can
 *   click the inline link to refresh the number from the parent's generator.
 * - id: unique base id for the checkbox (helps when rendering both mobile
 *   and desktop variants on the same page).
 * - placeholder, manualPlaceholder: input placeholders for the two states.
 * - disabled: hard disable the entire control (e.g. read-only edit).
 * - inputClassName, containerClassName: layout overrides.
 */
export function DocumentNumberField({
  label = 'Document Number',
  autoLabel = 'Auto-generate',
  autoGenerate,
  onAutoGenerateChange,
  value,
  onChange,
  onRegenerate,
  id,
  placeholder = 'Auto-generated',
  manualPlaceholder = 'Enter number',
  disabled = false,
  inputClassName = 'w-full pr-16 h-8 text-sm',
  containerClassName = 'flex flex-col w-72',
}) {
  const checkboxId = id || 'doc-number-auto';
  const showRegenerate = autoGenerate && typeof onRegenerate === 'function';

  return (
    <div className={containerClassName}>
      <div className="flex items-center gap-3 mb-1">
        <label className="block text-xs font-medium text-gray-700 m-0">
          {label}
        </label>
        <label
          htmlFor={checkboxId}
          className="flex items-center space-x-1 text-[11px] text-gray-600 cursor-pointer select-none"
        >
          <Input
            type="checkbox"
            id={checkboxId}
            checked={!!autoGenerate}
            onChange={(e) => onAutoGenerateChange?.(e.target.checked)}
            disabled={disabled}
            className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <span>{autoLabel}</span>
        </label>
      </div>
      <div className="relative">
        <Input
          type="text"
          autoComplete="off"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          className={inputClassName}
          placeholder={autoGenerate ? placeholder : manualPlaceholder}
          disabled={disabled || autoGenerate}
        />
        {showRegenerate && (
          <button
            type="button"
            onClick={() => onRegenerate?.()}
            disabled={disabled}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[11px] text-primary-600 hover:text-primary-800 font-medium disabled:opacity-50"
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}

export default DocumentNumberField;
