const settingsService = require('../services/settingsService');

/** Daily Cash Closing is off unless explicitly enabled in company settings. */
async function isDailyCashClosingEnabled() {
  const settings = await settingsService.getCompanySettings();
  const value = settings?.orderSettings?.dailyCashClosingEnabled;
  return value === true || value === 'true' || value === 1;
}

module.exports = {
  isDailyCashClosingEnabled,
};
