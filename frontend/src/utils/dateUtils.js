/**
 * Date Utility Functions for Pakistan Standard Time (Asia/Karachi)
 * 
 * All date formatting and manipulation uses Pakistan timezone.
 * Dates are sent to backend as YYYY-MM-DD strings for consistent filtering.
 */

const TIMEZONE = 'Asia/Karachi';

/**
 * Format date to YYYY-MM-DD string (for date inputs)
 * @param {Date|string} date - Date object or date string
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function formatDateForInput(date) {
  if (!date) return '';
  
  let d;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    return '';
  }
  
  if (isNaN(d.getTime())) return '';
  
  // Get date in Pakistan timezone (UTC+5)
  // Convert to Pakistan timezone by adding 5 hours to UTC
  const pakistanDate = new Date(d.getTime() + (5 * 60 * 60 * 1000));
  
  const year = pakistanDate.getUTCFullYear();
  const month = String(pakistanDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(pakistanDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format date for display in Pakistan timezone
 * @param {Date|string} date - Date object or date string
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatDatePakistan(date, options = {}) {
  if (!date) return '';
  
  let d;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    return '';
  }
  
  if (isNaN(d.getTime())) return '';
  
  // Convert to Pakistan timezone
  const pakistanDate = new Date(d.getTime() + (5 * 60 * 60 * 1000));
  
  const {
    includeTime = false,
    format = 'short' // 'short', 'long', 'medium'
  } = options;
  
  const year = pakistanDate.getUTCFullYear();
  const month = pakistanDate.getUTCMonth() + 1;
  const day = pakistanDate.getUTCDate();
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const monthNamesShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  let formattedDate = '';
  
  if (format === 'long') {
    formattedDate = `${day} ${monthNames[month - 1]}, ${year}`;
  } else if (format === 'medium') {
    formattedDate = `${day} ${monthNamesShort[month - 1]}, ${year}`;
  } else {
    // short format: DD/MM/YYYY
    formattedDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
  
  if (includeTime) {
    const hours = pakistanDate.getUTCHours();
    const minutes = pakistanDate.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    formattedDate += ` ${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
  }
  
  return formattedDate;
}

/**
 * Get current date in Pakistan timezone as YYYY-MM-DD
 * @returns {string} Current date string
 */
export function getCurrentDatePakistan() {
  return formatDateForInput(new Date());
}

/**
 * Get date N days ago in Pakistan timezone
 * @param {number} days - Number of days ago
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateForInput(date);
}

/**
 * Get start of month in Pakistan timezone
 * @param {Date|string} date - Date object or date string (default: today)
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getStartOfMonth(date = null) {
  const d = date ? (date instanceof Date ? date : new Date(date)) : new Date();
  const pakistanDate = new Date(d.getTime() + (5 * 60 * 60 * 1000));
  
  const year = pakistanDate.getUTCFullYear();
  const month = pakistanDate.getUTCMonth();
  
  return formatDateForInput(new Date(Date.UTC(year, month, 1)));
}

/**
 * Get end of month in Pakistan timezone
 * @param {Date|string} date - Date object or date string (default: today)
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getEndOfMonth(date = null) {
  const d = date ? (date instanceof Date ? date : new Date(date)) : new Date();
  const pakistanDate = new Date(d.getTime() + (5 * 60 * 60 * 1000));
  
  const year = pakistanDate.getUTCFullYear();
  const month = pakistanDate.getUTCMonth();
  
  // Get last day of month
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  
  return formatDateForInput(lastDay);
}

/**
 * Validate date string format (YYYY-MM-DD)
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid
 */
export function isValidDateString(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

/**
 * Parse date string to Date object (assuming Pakistan timezone)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} Date object
 */
export function parseDatePakistan(dateString) {
  if (!dateString || !isValidDateString(dateString)) {
    return null;
  }
  
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date in UTC, then adjust for Pakistan timezone
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  date.setUTCHours(date.getUTCHours() - 5);
  return date;
}

/**
 * Get preset date ranges
 * @returns {Object} Object with preset date range functions
 */
export function getDatePresets() {
  const today = getCurrentDatePakistan();
  
  return {
    today: {
      startDate: today,
      endDate: today,
      label: 'Today'
    },
    yesterday: {
      startDate: getDateDaysAgo(1),
      endDate: getDateDaysAgo(1),
      label: 'Yesterday'
    },
    last7Days: {
      startDate: getDateDaysAgo(7),
      endDate: today,
      label: 'Last 7 Days'
    },
    last30Days: {
      startDate: getDateDaysAgo(30),
      endDate: today,
      label: 'Last 30 Days'
    },
    thisMonth: {
      startDate: getStartOfMonth(),
      endDate: today,
      label: 'This Month'
    },
    lastMonth: {
      startDate: getStartOfMonth(getDateDaysAgo(30)),
      endDate: getEndOfMonth(getDateDaysAgo(30)),
      label: 'Last Month'
    },
    thisYear: {
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate: today,
      label: 'This Year'
    }
  };
}

export { TIMEZONE };
