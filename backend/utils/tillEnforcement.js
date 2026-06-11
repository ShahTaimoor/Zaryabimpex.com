const settingsService = require('../services/settingsService');
const UserRepository = require('../repositories/UserRepository');

/** Roles exempt from requiring an open shop till (admin opens the till for everyone). */
const DEFAULT_TILL_EXEMPT_ROLES = ['admin', 'manager'];

/**
 * Whether the user must have an open till before cash transactions are recorded.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isTillRequiredForUser(userId) {
  if (!userId) return true;

  const settings = await settingsService.getCompanySettings();
  const orderSettings = settings?.orderSettings || {};

  if (orderSettings.requireTillSession === false) {
    return false;
  }

  const user = await UserRepository.findById(userId);
  const role = String(user?.role || '').toLowerCase();
  const exemptRoles = (orderSettings.tillExemptRoles ?? DEFAULT_TILL_EXEMPT_ROLES)
    .map((r) => String(r).toLowerCase());

  if (role && exemptRoles.includes(role)) {
    return false;
  }

  return true;
}

module.exports = {
  DEFAULT_TILL_EXEMPT_ROLES,
  isTillRequiredForUser,
};
