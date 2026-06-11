import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Banknote,
  Wallet,
  Users,
  FileText,
  RotateCcw,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import DateFilter from '../DateFilter';

/** Shared black & white theme for all cash/bank voucher forms. */
const MONO_THEME = {
  accentBorder: 'border-l-neutral-900',
  accentClass: 'text-neutral-900',
  iconWrapClass: 'bg-neutral-100 text-neutral-900',
  badgeClass: 'border border-neutral-300 bg-neutral-100 text-neutral-800',
  ringClass: 'ring-neutral-200',
  panelClass: 'border-neutral-200 bg-neutral-50',
  chipActive: 'border-neutral-900 bg-neutral-900 text-white',
  chipIdle:
    'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50',
  amountRing: 'focus-within:ring-neutral-300 focus-within:border-neutral-900',
  amountText: 'text-neutral-900',
  submitBtnClass: 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900',
};

const VOUCHER_VARIANTS = {
  'cash-receipt': {
    ...MONO_THEME,
    title: 'Cash Receipt',
    subtitle: 'Record cash received from a customer or supplier',
    Icon: Banknote,
    BadgeIcon: ArrowDownLeft,
    badgeText: 'Money In',
  },
  'cash-payment': {
    ...MONO_THEME,
    title: 'Cash Payment',
    subtitle: 'Record cash paid to a supplier, customer, or expense',
    Icon: Wallet,
    BadgeIcon: ArrowUpRight,
    badgeText: 'Money Out',
  },
  'bank-receipt': {
    ...MONO_THEME,
    title: 'Bank Receipt',
    subtitle: 'Record funds received into a bank account',
    Icon: Landmark,
    BadgeIcon: ArrowDownLeft,
    badgeText: 'Bank In',
  },
  'bank-payment': {
    ...MONO_THEME,
    title: 'Bank Payment',
    subtitle: 'Record funds paid from a bank account',
    Icon: Landmark,
    BadgeIcon: ArrowUpRight,
    badgeText: 'Bank Out',
  },
  expense: {
    ...MONO_THEME,
    title: 'Record Expense',
    subtitle: 'Log operating expenses from cash or bank to the right expense account',
    Icon: Wallet,
    BadgeIcon: ArrowUpRight,
    badgeText: 'Expense',
  },
};

const VariantContext = React.createContext(VOUCHER_VARIANTS['cash-receipt']);

export function usePaymentFormVariant() {
  return React.useContext(VariantContext);
}

/** Professional voucher form shell — cash/bank receipt & payment. */
export function PaymentFormCard({
  variant = 'cash-receipt',
  title,
  subtitle,
  children,
  className = '',
}) {
  const theme = VOUCHER_VARIANTS[variant] || VOUCHER_VARIANTS['cash-receipt'];
  const HeaderIcon = theme.Icon;
  const BadgeIcon = theme.BadgeIcon;

  return (
    <VariantContext.Provider value={theme}>
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm',
          className
        )}
      >
        <div
          className={cn(
            'border-b border-neutral-200 bg-white px-5 py-4 sm:px-6 sm:py-5 border-l-4',
            theme.accentBorder
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                  theme.iconWrapClass
                )}
              >
                <HeaderIcon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl">
                  {title || theme.title}
                </h3>
                <p className="mt-0.5 text-sm text-neutral-500 leading-snug">
                  {subtitle || theme.subtitle}
                </p>
              </div>
            </div>
            <span
              className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide',
                theme.badgeClass
              )}
            >
              <BadgeIcon className="h-3.5 w-3.5" aria-hidden />
              {theme.badgeText}
            </span>
          </div>
        </div>
        <div className="p-5 sm:p-6 lg:p-7">{children}</div>
      </div>
    </VariantContext.Provider>
  );
}

export function PaymentFormGrid({ children }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-7">{children}</div>
  );
}

export function PaymentFormColumn({ children, className = '' }) {
  return <div className={cn('space-y-5', className)}>{children}</div>;
}

/** Grouped panel inside the voucher form (party, amount, bank details, etc.). */
export function PaymentFormSection({
  title,
  description,
  icon: Icon = FileText,
  children,
  className = '',
}) {
  const theme = usePaymentFormVariant();
  return (
    <section
      className={cn(
        'rounded-xl border p-4 sm:p-5',
        theme.panelClass,
        className
      )}
    >
      {(title || description) && (
        <div className="mb-4 flex items-start gap-2.5">
          <div
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1',
              theme.ringClass
            )}
          >
            <Icon className={cn('h-4 w-4', theme.accentClass)} aria-hidden />
          </div>
          <div>
            {title ? (
              <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">{description}</p>
            ) : null}
          </div>
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const DEFAULT_PARTY_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
];

/** Segmented control for customer / supplier / expense type. */
export function PaymentPartyTypeRadio({
  label = 'Payment Type',
  value,
  onChange,
  options = DEFAULT_PARTY_OPTIONS,
  onOptionChange,
  className = '',
}) {
  const theme = usePaymentFormVariant();
  return (
    <div className={className}>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={label}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <label
              key={opt.value}
              className={cn(
                'cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                active ? theme.chipActive : theme.chipIdle
              )}
            >
              <input
                type="radio"
                value={opt.value}
                checked={active}
                onChange={(e) => {
                  onChange(e.target.value);
                  onOptionChange?.(e.target.value);
                }}
                className="sr-only"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Styled label wrapper matching payment voucher forms. */
export function PaymentFormField({
  label,
  required = false,
  helpText,
  children,
  className = '',
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label className="block text-sm font-medium text-neutral-700">
          {label}
          {required ? <span className="ml-0.5 text-neutral-900">*</span> : null}
        </label>
      ) : null}
      {children}
      {helpText ? <p className="text-xs text-neutral-500">{helpText}</p> : null}
    </div>
  );
}

/** Single-date picker matching dashboard DateFilter popover design. */
export function PaymentDateField({
  label = 'Date',
  value,
  onChange,
  required = false,
  placeholder = 'Pick a date',
  className = '',
  max,
  min,
}) {
  return (
    <PaymentFormField label={label} required={required} className={className}>
      <DateFilter
        mode="single"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        showLabel={false}
        max={max}
        min={min}
      />
    </PaymentFormField>
  );
}

/** Prominent amount input for voucher forms. */
export function PaymentAmountField({
  label = 'Amount',
  value,
  onChange,
  required = true,
  placeholder = '0.00',
  className = '',
}) {
  const theme = usePaymentFormVariant();
  return (
    <PaymentFormField label={label} required={required} className={className}>
      <div
        className={cn(
          'flex h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 shadow-sm transition-shadow focus-within:ring-2',
          theme.amountRing
        )}
      >
        <span className={cn('shrink-0 text-sm font-bold', theme.amountText)}>Rs</span>
        <input
          type="number"
          autoComplete="off"
          step="0.01"
          min="0"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="h-full w-full border-0 bg-transparent text-sm font-semibold text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:ring-0"
        />
      </div>
    </PaymentFormField>
  );
}

/** Bank account select with consistent styling. */
export function PaymentBankSelect({
  label = 'Bank Account',
  value,
  onChange,
  banks = [],
  loading = false,
  error = null,
  emptyHint = null,
  required = true,
}) {
  const theme = usePaymentFormVariant();
  return (
    <PaymentFormField label={label} required={required}>
      <select
        value={value}
        onChange={onChange}
        required={required}
        disabled={loading}
        className="input h-11 w-full rounded-lg border-neutral-200 bg-white text-sm shadow-sm transition-colors focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
      >
        <option value="">Select bank account...</option>
        {banks.map((bank) => (
          <option key={bank._id || bank.id} value={bank._id || bank.id}>
            {bank.bankName} — {bank.accountNumber}
            {bank.accountName ? ` (${bank.accountName})` : ''}
          </option>
        ))}
      </select>
      {loading ? <p className="text-xs text-neutral-500">Loading bank accounts...</p> : null}
      {error ? <p className="text-xs text-neutral-700">{error}</p> : null}
      {emptyHint ? <p className="text-xs text-neutral-600">{emptyHint}</p> : null}
    </PaymentFormField>
  );
}

/** Balance summary card under party picker. */
export function PaymentBalancePanel({
  balance,
  pendingBalance,
  advanceBalance,
  showDetails = false,
  className = '',
}) {
  const amount = Number(balance) || 0;
  const pending = Number(pendingBalance) || 0;
  const advance = Number(advanceBalance) || 0;
  const isPayable = amount < -0.001;
  const isReceivable = amount > 0.001;
  const hasBalance = Math.abs(amount) > 0.001;

  const tone = isPayable
    ? {
        wrap: 'border-neutral-400 bg-neutral-100',
        label: 'text-neutral-600',
        value: 'text-neutral-900',
        badge: 'bg-neutral-900 text-white',
        text: 'Payable',
      }
    : isReceivable
    ? {
        wrap: 'border-neutral-300 bg-white',
        label: 'text-neutral-600',
        value: 'text-neutral-900',
        badge: 'bg-neutral-200 text-neutral-800',
        text: 'Receivable',
      }
    : {
        wrap: 'border-neutral-200 bg-neutral-50',
        label: 'text-neutral-500',
        value: 'text-neutral-700',
        badge: 'bg-neutral-100 text-neutral-600',
        text: 'No balance',
      };

  return (
    <div className={cn('space-y-1.5', className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Account Balance
      </span>
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border px-4 py-3',
          tone.wrap
        )}
      >
        <div>
          <span className={cn('text-xs font-medium', tone.label)}>
            {hasBalance ? (isPayable ? 'Amount payable' : 'Amount receivable') : 'Current balance'}
          </span>
          <p className={cn('mt-0.5 text-xl font-bold tabular-nums', tone.value)}>
            {hasBalance
              ? Math.abs(amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '0.00'}
          </p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', tone.badge)}>
          {tone.text}
        </span>
      </div>
      {showDetails && (pending !== 0 || advance !== 0) ? (
        <p className="text-[11px] text-neutral-400 tabular-nums">
          Pending {pending.toFixed(2)} · Advance {advance.toFixed(2)} · Net {amount.toFixed(2)}
        </p>
      ) : null}
    </div>
  );
}

export const paymentFormInputClass =
  'h-11 rounded-lg border-neutral-200 bg-white shadow-sm text-sm';

/** Reset / Save footer styled for payment voucher forms. */
export function PaymentFormActions({
  onReset,
  onSubmit,
  resetLabel = 'Reset',
  submitLabel = 'Save',
  submittingLabel,
  isSubmitting = false,
  submitDisabled = false,
  className = '',
}) {
  const theme = usePaymentFormVariant();
  const finalSubmittingLabel = submittingLabel ?? `${submitLabel}...`;

  return (
    <div
      className={cn(
        '-mx-5 -mb-5 mt-6 flex flex-col-reverse gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-4 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-end sm:px-6 lg:-mx-7 lg:-mb-7',
        className
      )}
    >
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          disabled={isSubmitting}
          className="inline-flex h-11 w-full sm:w-auto sm:min-w-[8.5rem] items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          <span>{resetLabel}</span>
        </button>
      ) : null}
      {onSubmit ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || submitDisabled}
          className={cn(
            'inline-flex h-11 w-full sm:w-auto sm:min-w-[10rem] items-center justify-center gap-2 rounded-lg border px-5 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            theme.submitBtnClass
          )}
        >
          <Save className="h-4 w-4" aria-hidden />
          <span>{isSubmitting ? finalSubmittingLabel : submitLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
