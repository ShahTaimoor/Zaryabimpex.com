import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Bell,
  Clock,
  Plus,
  X,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Banknote
} from 'lucide-react';
import DateFilter from './DateFilter';
import {
  useGetUpcomingExpensesQuery,
  useGetRecurringExpensesQuery,
  useCreateRecurringExpenseMutation,
  useRecordPaymentMutation,
  useDeactivateRecurringExpenseMutation,
  useSnoozeRecurringExpenseMutation,
} from '../store/services/expensesApi';
import { useGetBanksQuery } from '../store/services/banksApi';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Button } from '@/components/ui/button';
import { LoadingSpinner, LoadingInline } from './LoadingSpinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';

const defaultFormState = {
  name: '',
  description: '',
  amount: '',
  dayOfMonth: 1,
  reminderDaysBefore: 3,
  defaultPaymentType: 'cash',
  expenseAccount: '',
  bank: '',
  notes: '',
  startFromDate: ''
};

const computeDaysUntilDue = (dueDate) => {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

const getPayeeLabel = (expense) => {
  if (expense?.supplier) {
    return (
      expense.supplier.displayName ||
      expense.supplier.companyName ||
      expense.supplier.businessName ||
      expense.supplier.name
    );
  }

  if (expense?.customer) {
    return (
      expense.customer.displayName ||
      expense.customer.businessName ||
      expense.customer.name ||
      [expense.customer.firstName, expense.customer.lastName].filter(Boolean).join(' ')
    );
  }

  return 'General Expense';
};

const RecurringExpensesPanel = ({ expenseAccounts = [], onPaymentRecorded }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState(defaultFormState);
  const [reminderWindow, setReminderWindow] = useState(7);

  const {
    data: upcomingData,
    isLoading: upcomingLoading,
    isFetching: upcomingFetching,
    refetch: refetchUpcoming
  } = useGetUpcomingExpensesQuery(
    { days: reminderWindow },
    {
      pollingInterval: 60_000
    }
  );

  const {
    data: activeData,
    isLoading: activeLoading
  } = useGetRecurringExpensesQuery(
    { status: 'active' }
  );

  const {
    data: banksData,
    isLoading: banksLoading
  } = useGetBanksQuery(
    { isActive: true, all: 'true' },
    {
      staleTime: 5 * 60_000
    }
  );

  const normalizeExpenses = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.expenses)) return payload.expenses;
    if (Array.isArray(payload?.data?.recurringExpenses)) return payload.data.recurringExpenses;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    return [];
  };

  const upcomingExpenses = useMemo(() => normalizeExpenses(upcomingData), [upcomingData]);
  const activeExpenses = useMemo(() => normalizeExpenses(activeData), [activeData]);

  const bankOptions = useMemo(
    () => banksData?.data?.banks || banksData?.banks || [],
    [banksData]
  );

  const expenseAccountOptions = useMemo(
    () => (Array.isArray(expenseAccounts) ? expenseAccounts : []),
    [expenseAccounts]
  );

  const resetForm = () => {
    setFormData(defaultFormState);
  };

  const [createRecurringExpense, { isLoading: isCreatingRecurringExpense }] = useCreateRecurringExpenseMutation();
  const [recordPayment, { isLoading: isRecordingPayment }] = useRecordPaymentMutation();
  const [deactivateRecurringExpense, { isLoading: isDeactivating }] = useDeactivateRecurringExpenseMutation();
  const [snoozeRecurringExpense, { isLoading: isSnoozing }] = useSnoozeRecurringExpenseMutation();

  const isSubmitting = isCreatingRecurringExpense || isRecordingPayment || isDeactivating || isSnoozing;

  const handleCreateRecurringExpense = async (payload) => {
    try {
      await createRecurringExpense(payload).unwrap();
      showSuccessToast('Recurring expense created');
      setShowCreateForm(false);
      resetForm();
    } catch (error) {
      handleApiError(error, 'Create Recurring Expense');
    }
  };

  const handleRecordPayment = async (id, payload) => {
    try {
      const response = await recordPayment({ id, ...payload }).unwrap();
      showSuccessToast('Payment recorded successfully');
      if (typeof onPaymentRecorded === 'function') {
        onPaymentRecorded(response?.data || response);
      }
    } catch (error) {
      handleApiError(error, 'Record Payment');
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await deactivateRecurringExpense(id).unwrap();
      showSuccessToast('Recurring expense deactivated');
    } catch (error) {
      handleApiError(error, 'Deactivate Recurring Expense');
    }
  };

  const handleSnooze = async (id, payload) => {
    try {
      await snoozeRecurringExpense({ id, ...payload }).unwrap();
      showSuccessToast('Reminder updated');
    } catch (error) {
      handleApiError(error, 'Snooze Recurring Expense');
    }
  };

  const handleExpenseSelect = (accountId) => {
    const selectedAccount = expenseAccountOptions.find((account) => account._id === accountId);
    setFormData((prev) => ({
      ...prev,
      expenseAccount: accountId,
      name: selectedAccount ? selectedAccount.accountName : ''
    }));
  };

  const handleCreateSubmit = (event) => {
    event.preventDefault();

    if (!formData.expenseAccount) {
      showErrorToast('Please select an expense account');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      amount: parseFloat(formData.amount),
      dayOfMonth: Number(formData.dayOfMonth),
      reminderDaysBefore: Number(formData.reminderDaysBefore),
      defaultPaymentType: formData.defaultPaymentType,
      expenseAccount: formData.expenseAccount || undefined,
      bank: formData.defaultPaymentType === 'bank' ? formData.bank || undefined : undefined,
      notes: formData.notes?.trim() || undefined,
      startFromDate: formData.startFromDate || undefined
    };

    handleCreateRecurringExpense(payload);
  };

  const handleRecordPaymentClick = (expense) => {
    handleRecordPayment(expense._id, {
      paymentType: expense.defaultPaymentType,
      notes: `Recurring payment for ${expense.name}`
    });
  };

  const handleSnoozeClick = (expense, days = 3) => {
    handleSnooze(expense._id, { snoozeDays: days });
  };

  const handleDeactivateClick = (expenseId) => {
    handleDeactivate(expenseId);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 className="flex items-center space-x-2 text-base font-semibold text-neutral-900 sm:text-lg">
            <Bell className="h-5 w-5 shrink-0 text-neutral-700 sm:h-6 sm:w-6" />
            <span className="min-w-0">Recurring Expense Reminders</span>
          </h2>
          <p className="mt-1 text-sm text-neutral-600 sm:text-base">
            Track monthly obligations and record payments in a single click.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">Show next</label>
            <select
              value={reminderWindow}
              onChange={(e) => setReminderWindow(Number(e.target.value))}
              className="input w-20 sm:w-24 md:w-26 text-xs sm:text-sm h-[36px] sm:h-[38px]"
            >
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
          <Button
            type="button"
            onClick={() => refetchUpcoming()}
            variant="outline"
            size="sm"
            className="flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap h-[36px] sm:h-[38px] flex-shrink-0 px-2 sm:px-3 text-xs sm:text-sm"
            disabled={upcomingFetching}
          >
            {upcomingFetching ? (
              <LoadingSpinner size="sm" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            )}
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Ref</span>
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="flex items-center justify-center gap-1.5 whitespace-nowrap h-[36px] sm:h-[38px] flex-shrink-0 px-2.5 sm:px-3 md:px-3.5 text-xs sm:text-sm"
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden lg:inline">{showCreateForm ? 'Close' : 'Add Recurring Expense'}</span>
            <span className="hidden md:inline lg:hidden">{showCreateForm ? 'Close' : 'Add Expense'}</span>
            <span className="hidden sm:inline md:hidden">{showCreateForm ? 'Close' : 'Add'}</span>
            <span className="sm:hidden">{showCreateForm ? 'Close' : '+'}</span>
          </Button>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        {showCreateForm && (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4">
            <h3 className="mb-3 flex items-center space-x-2 text-sm font-semibold text-neutral-900">
              <Plus className="h-4 w-4" />
              <span>Create Recurring Expense</span>
            </h3>
            <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Expense Account*</label>
                <select
                  className="input"
                  value={formData.expenseAccount}
                  onChange={(e) => handleExpenseSelect(e.target.value)}
                  required
                >
                  <option value="">Select expense account</option>
                  {expenseAccountOptions.map((account) => (
                    <option key={account._id} value={account._id}>
                      {account.accountName} ({account.accountCode})
                    </option>
                  ))}
                </select>
                {formData.name && (
                  <p className="text-xs text-gray-500 mt-1">Selected: {formData.name}</p>
                )}
              </div>
              <div>
                <label className="form-label">Amount*</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="form-label">Due Day of Month*</label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    dayOfMonth: Number(e.target.value)
                  }))}
                  required
                />
              </div>
              <div>
                <label className="form-label">Reminder (days before)</label>
                <Input
                  type="number"
                  min={0}
                  max={31}
                  value={formData.reminderDaysBefore}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    reminderDaysBefore: Number(e.target.value)
                  }))}
                />
              </div>
              <div>
                <label className="form-label">Default Payment Type*</label>
                <select
                  className="input"
                  value={formData.defaultPaymentType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      defaultPaymentType: e.target.value,
                      bank: e.target.value === 'bank' ? prev.bank : ''
                    }))
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <DateFilter mode="single"
                  label="Start From"
                  value={formData.startFromDate}
                  onChange={(date) =>
                    setFormData((prev) => ({ ...prev, startFromDate: date }))
                  }
                  size="sm"
                />
              </div>
              {formData.defaultPaymentType === 'bank' && (
                <div>
                  <label className="form-label">Bank Account*</label>
                  <select
                    className="input"
                    value={formData.bank}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bank: e.target.value }))}
                    required
                    disabled={banksLoading}
                  >
                    <option value="">Select bank account</option>
                    {bankOptions.map((bank) => (
                      <option key={bank._id} value={bank._id}>
                        {bank.bankName} • {bank.accountNumber}
                        {bank.accountName ? ` (${bank.accountName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="md:col-span-2">
                <label className="form-label">Notes</label>
                <Textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2 flex flex-col-reverse sm:flex-row justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  disabled={false}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="default"
                  className="w-full sm:w-auto"
                  disabled={!formData.amount || !formData.expenseAccount}
                >
                  Save Recurring Expense
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2 2xl:gap-6">
          <div className="flex min-h-0 flex-col rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 flex items-center space-x-2">
                <Clock className="h-5 w-5 shrink-0 text-neutral-600 md:h-6 md:w-6" />
                <span>Upcoming</span>
              </h3>
              {(upcomingLoading || upcomingFetching) && (
                <LoadingInline />
              )}
            </div>
            {upcomingExpenses.length === 0 ? (
              <div className="text-center text-sm md:text-base text-gray-500 bg-white border border-dashed border-gray-200 rounded-lg py-8 md:py-10 px-4 flex-1 flex flex-col items-center justify-center">
                <CheckCircle className="h-6 w-6 md:h-8 md:w-8 mx-auto text-success-500 mb-3" />
                <p>No reminders due in the next {reminderWindow} days.</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4 flex-1 overflow-y-auto max-h-[600px]">
                {upcomingExpenses.map((expense) => {
                  const daysLeft = computeDaysUntilDue(expense.nextDueDate);
                  const isOverdue = typeof daysLeft === 'number' && daysLeft < 0;
                  return (
                    <div
                      key={expense._id}
                      className={`rounded-lg border bg-white p-4 md:p-5 shadow-sm ${
                        isOverdue ? 'border-danger-200 bg-danger-50/40' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:gap-4">
                        <div>
                          <div className="flex items-center flex-wrap gap-2 mb-2">
                            <h4 className="text-base md:text-lg font-semibold text-gray-900">{expense.name}</h4>
                            <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-800 md:px-2.5 md:py-1.5 md:text-sm">
                              {expense.defaultPaymentType === 'bank' ? 'Bank' : 'Cash'}
                            </span>
                          </div>
                          <p className="text-sm md:text-base text-gray-600">
                            {formatCurrency(expense.amount)} • Due {formatDate(expense.nextDueDate)}
                          </p>
                          <p className="text-xs md:text-sm text-gray-500 mt-1">
                            {getPayeeLabel(expense)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-3 border-t border-neutral-100 pt-3">
                          <div
                            className={`flex items-center gap-1.5 text-sm font-semibold ${
                              isOverdue ? 'text-danger-600' : 'text-neutral-700'
                            }`}
                          >
                            {isOverdue ? (
                              <>
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>{Math.abs(daysLeft)} day(s) overdue</span>
                              </>
                            ) : (
                              <>
                                <Calendar className="h-4 w-4 shrink-0" />
                                <span>{daysLeft} day(s) left</span>
                              </>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full border-neutral-300 sm:flex-1"
                              onClick={() => handleSnoozeClick(expense, 3)}
                              disabled={false}
                            >
                              <Clock className="h-4 w-4 shrink-0" />
                              <span>Snooze 3d</span>
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="w-full border-neutral-900 bg-neutral-900 hover:bg-neutral-800 sm:flex-1"
                              onClick={() => handleRecordPaymentClick(expense)}
                              disabled={false}
                            >
                              <Banknote className="h-4 w-4 shrink-0" />
                              <span>Record Payment</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-col rounded-lg border border-neutral-200 bg-white p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="flex items-center space-x-2 text-base font-semibold text-neutral-700 md:text-lg">
                <Calendar className="h-5 w-5 shrink-0 text-neutral-500 md:h-6 md:w-6" />
                <span>Active Recurring Expenses</span>
              </h3>
              {activeLoading ? (
                <LoadingInline />
              ) : null}
            </div>
            {activeExpenses.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 px-4 py-8 text-center md:py-10">
                <p className="text-sm text-neutral-500 md:text-base">
                  No recurring expenses configured yet.
                </p>
              </div>
            ) : (
              <div className="max-h-[600px] flex-1 space-y-3 overflow-y-auto">
                {activeExpenses.map((expense) => (
                  <div
                    key={expense._id}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:p-4"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-neutral-900 sm:text-base">
                        {expense.name}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
                        Due every month on day {expense.dayOfMonth} ·{' '}
                        {expense.reminderDaysBefore} day(s) reminder
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
                        Next: {formatDate(expense.nextDueDate)} · {formatCurrency(expense.amount)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-3 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-neutral-300 text-neutral-700 sm:w-auto"
                        onClick={() => handleSnoozeClick(expense, 30)}
                        disabled={isSubmitting}
                      >
                        Skip Month
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleDeactivateClick(expense._id)}
                        disabled={isSubmitting}
                      >
                        Deactivate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecurringExpensesPanel;


