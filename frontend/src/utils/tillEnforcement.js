export const DEFAULT_TILL_EXEMPT_ROLES = ['admin', 'manager'];

/**
 * Client-side mirror of backend till enforcement rules.
 */
export function isAutoOpenTillEnabled(orderSettings = {}) {
  return orderSettings?.autoOpenTillSession !== false;
}

/**
 * Client-side mirror of backend till enforcement rules.
 */
export function isTillRequiredForUser(orderSettings = {}, userRole) {
  if (orderSettings?.requireTillSession === false) {
    return false;
  }
  const role = String(userRole || '').toLowerCase();
  const exemptRoles = (orderSettings?.tillExemptRoles ?? DEFAULT_TILL_EXEMPT_ROLES)
    .map((r) => String(r).toLowerCase());
  if (role && exemptRoles.includes(role)) {
    return false;
  }
  return true;
}

export function getTillErrorCode(error) {
  return (
    error?.data?.error?.code ||
    error?.data?.code ||
    error?.response?.data?.error?.code ||
    error?.response?.data?.code ||
    null
  );
}

export function isTillSessionError(error) {
  const code = getTillErrorCode(error);
  return code === 'NO_OPEN_TILL' || code === 'TILL_ALREADY_CLOSED';
}

export function getTillErrorMessage(error) {
  return (
    error?.data?.error?.message ||
    error?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    'Open the till before completing cash transactions.'
  );
}
