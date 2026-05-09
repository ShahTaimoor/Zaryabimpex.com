/**
 * Read a boolean stored in localStorage ('true' / 'false').
 * @param {string} key
 * @param {boolean} [defaultWhenMissing=false] - used when the key is absent
 */
export function getVisibilityFlag(key, defaultWhenMissing = false) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return defaultWhenMissing;
    return v === 'true';
  } catch {
    return defaultWhenMissing;
  }
}

/** Contact person field is on by default when the user has never toggled Settings. */
export const getContactPersonVisible = (isSupplier) =>
  getVisibilityFlag(
    isSupplier ? 'showSupplierSetting_contactPerson' : 'showCustomerSetting_contactPerson',
    true
  );
