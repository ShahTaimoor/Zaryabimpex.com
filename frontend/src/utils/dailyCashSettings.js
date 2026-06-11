/** Daily Cash Closing is off unless explicitly enabled in company order settings. */
export function isDailyCashClosingEnabled(orderSettings) {
  return orderSettings?.dailyCashClosingEnabled === true;
}

export function isDailyCashNavItem(item) {
  return item?.requiresFeature === 'dailyCashClosing'
    || item?.href === '/daily-cash'
    || item?.href === '/till'
    || item?.name === 'Daily Cash Closing';
}

export function isDailyCashNavVisible(item, orderSettings) {
  if (!isDailyCashNavItem(item)) return true;
  return isDailyCashClosingEnabled(orderSettings);
}
