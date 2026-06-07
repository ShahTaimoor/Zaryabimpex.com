/** Normalize warehouse/shop list from RTK Query responses */
export function normalizeLocationList(data, key = 'warehouses') {
  if (!data) return [];
  return data?.data?.[key] ?? data?.[key] ?? [];
}

export function getLocationId(item) {
  return item?.id || item?._id || '';
}

export function getPrimaryLocation(locations) {
  if (!locations?.length) return null;
  return locations.find((l) => l.is_primary || l.isPrimary) || locations[0];
}

/** Unified stock fields from product DTOs, inventory rows, or location stock API rows */
export function getProductStockFields(item) {
  if (!item) {
    return { onHand: 0, reserved: 0, available: 0, warehouse: 0, shop: 0 };
  }
  const onHand = Number(
    item.availableQuantity ??
    item.quantity ??
    item.currentStock ??
    item.stockQuantity ??
    item.inventory?.currentStock ??
    0
  );
  const reserved = Number(item.reservedQuantity ?? item.reservedStock ?? item.inventory?.reservedStock ?? 0);
  const warehouse = Number(item.warehouseStock ?? item.warehouseAvailableStock ?? 0);
  const shop = Number(item.shopStock ?? item.shopAvailableStock ?? onHand);
  const available = Number(
    item.availableQuantity ??
    item.warehouseAvailableStock ??
    item.shopAvailableStock ??
    Math.max(0, onHand - reserved)
  );
  return { onHand, reserved, available, warehouse, shop };
}

export function formatStockQty(value) {
  return Number(value ?? 0).toLocaleString();
}
