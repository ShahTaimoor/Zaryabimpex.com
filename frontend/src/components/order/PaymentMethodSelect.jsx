import React from 'react';

/**
 * Reusable Payment Method dropdown for the Sales and Purchase checkout
 * panels. Uses the `bank:<id>` encoding scheme that the existing call
 * sites rely on so callers can keep two pieces of state:
 *   - `value`: 'cash' | 'bank' | 'credit_card' | 'debit_card' | 'check' | 'account' | 'split'
 *   - `bankAccountId`: '' or a bank id when value === 'bank'
 *
 * The component decodes/encodes the optgroup option transparently and
 * fires `onChange(method, bankAccountId)` with both values updated.
 */

export const DEFAULT_PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Card' },
  { value: 'debit_card', label: 'Debit' },
  { value: 'check', label: 'Check' },
  { value: 'account', label: 'Acc' },
  { value: 'split', label: 'Split' },
];

export function PaymentMethodSelect({
  value,
  bankAccountId,
  banks = [],
  onChange,
  options = DEFAULT_PAYMENT_OPTIONS,
  showSelectBankPlaceholder = false,
  className = 'border-none bg-transparent p-0 text-[10px] font-bold text-primary-600 focus:ring-0 cursor-pointer max-w-[60px] overflow-hidden text-ellipsis',
  disabled = false,
}) {
  const encoded =
    value === 'bank' && bankAccountId ? `bank:${bankAccountId}` : value;

  const handleChange = (e) => {
    const v = e.target.value;
    if (v.startsWith('bank:')) {
      onChange?.('bank', v.slice(5));
    } else {
      onChange?.(v, '');
    }
  };

  const cashOption = options.find((o) => o.value === 'cash');
  const otherOptions = options.filter((o) => o.value !== 'cash');

  return (
    <select
      value={encoded}
      onChange={handleChange}
      disabled={disabled}
      className={className}
    >
      {cashOption && (
        <option value={cashOption.value}>{cashOption.label}</option>
      )}
      {showSelectBankPlaceholder && (
        <option value="bank" disabled>
          Select Bank
        </option>
      )}
      {banks.length > 0 && (
        <optgroup label="Banks">
          {banks.map((bank) => {
            const bid = bank._id || bank.id;
            if (!bid) return null;
            const label = [bank.bankName, bank.accountNumber]
              .filter(Boolean)
              .join(' - ');
            return (
              <option key={bid} value={`bank:${bid}`}>
                {label}
              </option>
            );
          })}
        </optgroup>
      )}
      {otherOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default PaymentMethodSelect;
