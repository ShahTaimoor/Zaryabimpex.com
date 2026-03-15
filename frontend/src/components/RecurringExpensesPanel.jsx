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
    { isActive: true },
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
    <div className="card">
      <div className="card-header flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 lg:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center space-x-2">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600 flex-shrink-0" />
            <span className="min-w-0">Recurring Expense Reminders</span>
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Track monthly obligations and record payments in a single click.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto flex-shrink-0">
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
          <button
            type="button"
            onClick={() => refetchUpcoming()}
            className="btn btn-outline btn-sm sm:btn-md flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap h-[36px] sm:h-[38px] flex-shrink-0 px-2 sm:px-3 text-xs sm:text-sm"
            disabled={upcomingFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 ${upcomingFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
            <span className="sm:hidden">Ref</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm sm:btn-md flex items-center justify-center gap-1.5 whitespace-nowrap h-[36px] sm:h-[38px] flex-shrink-0 px-2.5 sm:px-3 md:px-3.5 text-xs sm:text-sm"
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden lg:inline">{showCreateForm ? 'Close' : 'Add Recurring Expense'}</span>
            <span className="hidden md:inline lg:hidden">{showCreateForm ? 'Close' : 'Add Expense'}</span>
            <span className="hidden sm:inline md:hidden">{showCreateForm ? 'Close' : 'Add'}</span>
            <span className="sm:hidden">{showCreateForm ? 'Close' : '+'}</span>
          </button>
        </div>
      </div>

      <div className="card-content space-y-6">
        {showCreateForm && (
          <div className="border border-dashed border-primary-200 rounded-lg p-4 bg-primary-50/40">
            <h3 className="text-sm font-semibold text-primary-700 flex items-center space-x-2 mb-3">
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
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="form-label">Due Day of Month*</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  className="input"
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
                <input
                  type="number"
                  min="0"
                  max="31"
                  className="input"
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
                <label className="form-label">Start From</label>
                <input
                  type="date"
                  className="input"
                  value={formData.startFromDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, startFromDate: e.target.value }))
                  }
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
                <textarea
                  className="input"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2 flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline btn-md w-full sm:w-auto"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  disabled={false}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-md w-full sm:w-auto"
                  disabled={!formData.amount || !formData.expenseAccount}
                >
                  Save Recurring Expense
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div className="border rounded-lg p-4 md:p-5 lg:p-6 bg-gray-50 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 flex items-center space-x-2">
                <Clock className="h-5 w-5 md:h-6 md:w-6 text-primary-500 flex-shrink-0" />
                <span>Upcoming</span>
              </h3>
              {(upcomingLoading || upcomingFetching) && (
                <span className="text-xs md:text-sm text-gray-500">Loading...</span>
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
                            <span className="text-xs md:text-sm px-2 md:px-2.5 py-1 md:py-1.5 rounded-full bg-primary-100 text-primary-700">
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
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-3 border-t border-gray-100">
                          <div
                            className={`flex items-center space-x-1.5 text-sm md:text-base font-semibold ${
                              isOverdue ? 'text-danger-600' : 'text-primary-600'
                            }`}
                          >
                            {isOverdue ? (
                              <>
                                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                                <span>{Math.abs(daysLeft)} day(s) overdue</span>
                              </>
                            ) : (
                              <>
                                <Calendar className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                                <span>{daysLeft} day(s) left</span>
                              </>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <button
                              type="button"
                              className="btn btn-outline btn-md flex items-center justify-center gap-2 text-sm md:text-base"
                              onClick={() => handleSnoozeClick(expense, 3)}
                              disabled={false}
                            >
                              <Clock className="h-4 w-4 flex-shrink-0" />
                              <span>Snooze 3d</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-md flex items-center justify-center gap-2 text-sm md:text-base"
                              onClick={() => handleRecordPaymentClick(expense)}
                              disabled={false}
                            >
                              <Banknote className="h-4 w-4 flex-shrink-0" />
                              <span>Record Payment</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4 md:p-5 lg:p-6 bg-white flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 flex items-center space-x-2">
                <Calendar className="h-5 w-5 md:h-6 md:w-6 text-gray-500 flex-shrink-0" />
                <span>Active Recurring Expenses</span>
              </h3>
              {activeLoading && <span className="text-xs md:text-sm text-gray-500">Loading...</span>}
            </div>
            {activeExpenses.length === 0 ? (
              <div className="text-center text-sm md:text-base text-gray-500 border border-dashed border-gray-200 rounded-lg py-8 md:py-10 px-4 flex-1 flex flex-col items-center justify-center">
                <p>No recurring expenses configured yet.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[600px] divide-y">
                {activeExpenses.map((expense) => (
                  <div key={expense._id} className="py-4 md:py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm md:text-base font-semibold text-gray-800">{expense.name}</p>
                      <p className="text-xs md:text-sm text-gray-500 mt-1">
                        Due every month on day {expense.dayOfMonth} •{' '}
                        {expense.reminderDaysBefore} day(s) reminder
                      </p>
                      <p className="text-xs md:text-sm text-gray-500 mt-1">
                        Next: {formatDate(expense.nextDueDate)} • {formatCurrency(expense.amount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <button
                        type="button"
                        className="btn btn-outline btn-md flex items-center justify-center gap-2 flex-1 md:flex-none text-sm md:text-base"
                        onClick={() => handleSnoozeClick(expense, 30)}
                        disabled={isSubmitting}
                      >
                        Skip Month
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-md flex items-center justify-center gap-2 flex-1 md:flex-none text-sm md:text-base"
                        onClick={() => handleDeactivateClick(expense._id)}
                        disabled={isSubmitting}
                      >
                        Deactivate
                      </button>
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


