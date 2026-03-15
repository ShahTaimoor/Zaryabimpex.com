/**
 * Date Filter Utility for Pakistan Standard Time (Asia/Karachi)
 * 
 * This utility ensures all date filtering is done consistently using Pakistan timezone.
 * All dates are converted to Pakistan timezone before filtering to prevent browser timezone conflicts.
 */

const TIMEZONE = 'Asia/Karachi';

/**
 * Convert a date string or Date object to Pakistan timezone
 * @param {string|Date} dateInput - Date string (YYYY-MM-DD) or Date object
 * @returns {Date} Date object in Pakistan timezone
 */
function toPakistanDate(dateInput) {
  if (!dateInput) return null;
  
  // If it's already a Date object, use it
  if (dateInput instanceof Date) {
    return dateInput;
  }
  
  // If it's a string in YYYY-MM-DD format
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    // Create date in Pakistan timezone (UTC+5)
    // We'll create it as UTC midnight and then adjust for Pakistan timezone
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    // Pakistan is UTC+5, so subtract 5 hours to get local midnight
    date.setUTCHours(date.getUTCHours() - 5);
    return date;
  }
  
  // Try parsing as ISO string
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateInput}`);
  }
  
  return date;
}

/**
 * Get start of day in Pakistan timezone
 * @param {string|Date} dateInput - Date string (YYYY-MM-DD) or Date object
 * @returns {Date} Start of day (00:00:00) in Pakistan timezone as UTC
 */
function getStartOfDayPakistan(dateInput) {
  if (!dateInput) return null;
  
  // If it's a YYYY-MM-DD string, parse it directly
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    // Pakistan is UTC+5, so midnight in Pakistan is 19:00 UTC the previous day
    // To represent midnight in Pakistan on YYYY-MM-DD, we create UTC date at 19:00 on (YYYY-MM-DD - 1 day)
    // Actually simpler: create UTC date at 19:00 on the previous day
    const utcDate = new Date(Date.UTC(year, month - 1, day - 1, 19, 0, 0, 0));
    return utcDate;
  }
  
  // For Date objects, convert to Pakistan timezone
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  
  // Get date components in local timezone (assuming server is in Pakistan or we want to treat as such)
  // Convert to Pakistan timezone: create date string, then convert
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Create UTC date representing midnight in Pakistan (UTC+5)
  // Pakistan midnight on YYYY-MM-DD = UTC 19:00 on (YYYY-MM-DD - 1 day)
  const pakistanMidnight = new Date(Date.UTC(year, month, day - 1, 19, 0, 0, 0));
  
  return pakistanMidnight;
}

/**
 * Get end of day in Pakistan timezone
 * @param {string|Date} dateInput - Date string (YYYY-MM-DD) or Date object
 * @returns {Date} End of day (23:59:59.999) in Pakistan timezone as UTC
 */
function getEndOfDayPakistan(dateInput) {
  if (!dateInput) return null;
  
  // If it's a YYYY-MM-DD string, parse it directly
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    // Pakistan is UTC+5, so 23:59:59.999 in Pakistan = 18:59:59.999 UTC same day
    const utcDate = new Date(Date.UTC(year, month - 1, day, 18, 59, 59, 999));
    return utcDate;
  }
  
  // For Date objects, convert to Pakistan timezone
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  
  // Get date components
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Create UTC date representing end of day in Pakistan (UTC+5)
  // Pakistan 23:59:59.999 on YYYY-MM-DD = UTC 18:59:59.999 on YYYY-MM-DD
  const pakistanEndOfDay = new Date(Date.UTC(year, month, day, 18, 59, 59, 999));
  
  return pakistanEndOfDay;
}

/**
 * Build MongoDB date filter for a date range in Pakistan timezone
 * @param {string|Date} startDate - Start date (YYYY-MM-DD) or Date object
 * @param {string|Date} endDate - End date (YYYY-MM-DD) or Date object
 * @param {string} fieldName - MongoDB field name to filter (default: 'createdAt')
 * @returns {Object} MongoDB query filter object
 */
function buildDateRangeFilter(startDate, endDate, fieldName = 'createdAt') {
  const filter = {};
  
  if (startDate || endDate) {
    filter[fieldName] = {};
    
    if (startDate) {
      filter[fieldName].$gte = getStartOfDayPakistan(startDate);
    }
    
    if (endDate) {
      filter[fieldName].$lte = getEndOfDayPakistan(endDate);
    }
  }
  
  return filter;
}

/**
 * Build MongoDB date filter for multiple date fields
 * @param {string|Date} startDate - Start date (YYYY-MM-DD) or Date object
 * @param {string|Date} endDate - End date (YYYY-MM-DD) or Date object
 * @param {Array<string>} fieldNames - Array of MongoDB field names to filter
 * @returns {Object} MongoDB query filter object with $or conditions
 */
function buildMultiFieldDateFilter(startDate, endDate, fieldNames = ['createdAt']) {
  if (!startDate && !endDate) {
    return {};
  }
  
  if (fieldNames.length === 1) {
    return buildDateRangeFilter(startDate, endDate, fieldNames[0]);
  }
  
  const dateConditions = [];
  const start = startDate ? getStartOfDayPakistan(startDate) : null;
  const end = endDate ? getEndOfDayPakistan(endDate) : null;
  
  fieldNames.forEach(fieldName => {
    const condition = {};
    condition[fieldName] = {};
    
    if (start) {
      condition[fieldName].$gte = start;
    }
    
    if (end) {
      condition[fieldName].$lte = end;
    }
    
    dateConditions.push(condition);
  });
  
  return { $or: dateConditions };
}

/**
 * Parse date query parameters from request
 * Supports multiple parameter name variations:
 * - dateFrom/dateTo
 * - startDate/endDate
 * - fromDate/toDate
 * - from/to
 * @param {Object} queryParams - Request query parameters
 * @returns {Object} Object with startDate and endDate
 */
function parseDateParams(queryParams) {
  const startDate = queryParams.dateFrom || 
                    queryParams.startDate || 
                    queryParams.fromDate || 
                    queryParams.from || 
                    null;
  
  const endDate = queryParams.dateTo || 
                  queryParams.endDate || 
                  queryParams.toDate || 
                  queryParams.to || 
                  null;
  
  return { startDate, endDate };
}

/**
 * Format date to YYYY-MM-DD string in Pakistan timezone
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDatePakistan(date) {
  if (!date) return null;
  
  const d = new Date(date);
  // Adjust for Pakistan timezone (UTC+5)
  d.setUTCHours(d.getUTCHours() + 5);
  
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Get current date in Pakistan timezone as YYYY-MM-DD
 * @returns {string} Current date string
 */
function getCurrentDatePakistan() {
  return formatDatePakistan(new Date());
}

/**
 * Validate date string format (YYYY-MM-DD)
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid
 */
function isValidDateString(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

module.exports = {
  TIMEZONE,
  toPakistanDate,
  getStartOfDayPakistan,
  getEndOfDayPakistan,
  buildDateRangeFilter,
  buildMultiFieldDateFilter,
  parseDateParams,
  formatDatePakistan,
  getCurrentDatePakistan,
  isValidDateString
};
