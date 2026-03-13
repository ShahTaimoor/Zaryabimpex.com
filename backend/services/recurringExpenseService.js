const getStartOfDay = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const daysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

const computeDueDateForMonth = (year, month, desiredDay) => {
  const maxDay = daysInMonth(year, month);
  const day = Math.min(desiredDay, maxDay);
  return new Date(year, month, day, 0, 0, 0, 0);
};

const addMonths = (date, months) => {
  const target = new Date(date.getTime());
  const originalDay = target.getDate();

  // Move to the first day of the current month to avoid overflow issues
  target.setDate(1);
  target.setMonth(target.getMonth() + months);

  const maxDay = daysInMonth(target.getFullYear(), target.getMonth());
  target.setDate(Math.min(originalDay, maxDay));
  target.setHours(0, 0, 0, 0);

  return target;
};

const calculateInitialDueDate = (dayOfMonth, referenceDate = new Date()) => {
  const today = getStartOfDay(referenceDate);
  const candidate = computeDueDateForMonth(today.getFullYear(), today.getMonth(), dayOfMonth);

  if (candidate >= today) {
    return candidate;
  }

  const nextMonthDate = addMonths(candidate, 1);
  return computeDueDateForMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), dayOfMonth);
};

const calculateNextDueDate = (currentDueDate, dayOfMonth) => {
  const nextMonth = addMonths(getStartOfDay(currentDueDate), 1);
  return computeDueDateForMonth(nextMonth.getFullYear(), nextMonth.getMonth(), dayOfMonth);
};

const isDueWithinDays = (dueDate, days, referenceDate = new Date()) => {
  const start = getStartOfDay(referenceDate);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);

  return dueDate >= start && dueDate <= end;
};

const hasReminderWindowStarted = (dueDate, reminderDaysBefore, referenceDate = new Date()) => {
  const start = new Date(dueDate);
  start.setDate(start.getDate() - reminderDaysBefore);
  start.setHours(0, 0, 0, 0);

  const current = getStartOfDay(referenceDate);
  return current >= start && current <= dueDate;
};

module.exports = {
  calculateInitialDueDate,
  calculateNextDueDate,
  isDueWithinDays,
  hasReminderWindowStarted
};


