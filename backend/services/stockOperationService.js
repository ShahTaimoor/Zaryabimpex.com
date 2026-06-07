/**
 * Central inventory operations facade for multi-location stock.
 * All stock mutations should flow through applyStockChange().
 */
const inventoryService = require('./inventoryService');
const locationStockService = require('./locationStockService');
const warehouseStockRepository = require('../repositories/WarehouseStockRepository');
const shopStockRepository = require('../repositories/ShopStockRepository');
const settingsService = require('./settingsService');
const { isWarehouseInventoryEnabled } = require('../utils/warehouseInventory');

const LOCATION_TYPES = {
  WAREHOUSE: 'warehouse',
  SHOP: 'shop',
};

async function isLocationModeEnabled() {
  const settings = await settingsService.getCompanySettings();
  return isWarehouseInventoryEnabled(settings);
}

/**
 * Unified stock change entry — delegates to inventoryService.updateStock.
 */
async function applyStockChange(params, options = {}) {
  return inventoryService.updateStock(params, options);
}

/**
 * Per-location balances for one product.
 */
async function getProductLocationBalances(productId) {
  const [warehouse, shop] = await Promise.all([
    locationStockService.resolvePrimaryWarehouse().catch(() => null),
    locationStockService.resolvePrimaryShop().catch(() => null),
  ]);

  const locations = [];

  if (warehouse) {
    const row = await warehouseStockRepository.findByWarehouseAndProduct(warehouse.id, productId);
    const qty = Number(row?.quantity ?? 0);
    const reserved = Number(row?.reserved_quantity ?? 0);
    locations.push({
      locationType: LOCATION_TYPES.WAREHOUSE,
      locationId: warehouse.id,
      locationName: warehouse.name,
      locationCode: warehouse.code,
      quantity: qty,
      reservedQuantity: reserved,
      availableQuantity: Math.max(0, qty - reserved),
    });
  }

  if (shop) {
    const row = await shopStockRepository.findByShopAndProduct(shop.id, productId);
    const qty = Number(row?.quantity ?? 0);
    const reserved = Number(row?.reserved_quantity ?? 0);
    locations.push({
      locationType: LOCATION_TYPES.SHOP,
      locationId: shop.id,
      locationName: shop.name,
      locationCode: shop.code,
      quantity: qty,
      reservedQuantity: reserved,
      availableQuantity: Math.max(0, qty - reserved),
    });
  }

  const totalOnHand = locations.reduce((s, l) => s + l.quantity, 0);
  const totalAvailable = locations.reduce((s, l) => s + l.availableQuantity, 0);

  return {
    productId,
    locations,
    totalOnHand,
    totalAvailable,
  };
}

/**
 * Validate sufficient available stock at a selling location before sale.
 */
async function assertAvailableStock({ productId, quantity, shopId, warehouseId, sellFromShop = true }) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return;

  if (sellFromShop) {
    const shop = shopId
      ? { id: shopId }
      : await locationStockService.resolvePrimaryShop();
    const row = await shopStockRepository.findByShopAndProduct(shop.id, productId);
    const available = Math.max(0, Number(row?.quantity ?? 0) - Number(row?.reserved_quantity ?? 0));
    if (available < qty) {
      throw new Error(`Insufficient shop stock (available: ${available}, requested: ${qty})`);
    }
    return;
  }

  const warehouse = warehouseId
    ? { id: warehouseId }
    : await locationStockService.resolvePrimaryWarehouse();
  const row = await warehouseStockRepository.findByWarehouseAndProduct(warehouse.id, productId);
  const available = Math.max(0, Number(row?.quantity ?? 0) - Number(row?.reserved_quantity ?? 0));
  if (available < qty) {
    throw new Error(`Insufficient warehouse stock (available: ${available}, requested: ${qty})`);
  }
}

module.exports = {
  LOCATION_TYPES,
  isLocationModeEnabled,
  applyStockChange,
  getProductLocationBalances,
  assertAvailableStock,
  resolvePrimaryWarehouse: locationStockService.resolvePrimaryWarehouse,
  resolvePrimaryShop: locationStockService.resolvePrimaryShop,
};
