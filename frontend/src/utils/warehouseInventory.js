/** Warehouse / shop split inventory feature flag (default off). */
export function isWarehouseInventoryEnabled(companySettings) {
  return companySettings?.orderSettings?.warehouseInventoryEnabled === true;
}
