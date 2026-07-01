const warehouseRepository = require('../repositories/WarehouseRepository');
const shopRepository = require('../repositories/ShopRepository');
const warehouseStockRepository = require('../repositories/WarehouseStockRepository');
const shopStockRepository = require('../repositories/ShopStockRepository');
const productRepository = require('../repositories/ProductRepository');
const inventoryRepository = require('../repositories/InventoryRepository');
const inventoryBalanceRepository = require('../repositories/postgres/InventoryBalanceRepository');
const StockMovementService = require('./stockMovementService');
const fifoService = require('./fifoService');

async function resolvePrimaryWarehouse(client = null) {
  let wh = await warehouseRepository.findPrimary();
  if (!wh) {
    const list = await warehouseRepository.findAll({ isActive: true }, { limit: 1 });
    wh = list[0];
  }
  if (!wh) throw new Error('No active warehouse configured. Create a warehouse first.');
  return wh;
}

async function resolvePrimaryShop(client = null) {
  let shop = await shopRepository.findPrimary(client);
  if (!shop) {
    const list = await shopRepository.findAll({ isActive: true }, { limit: 1 });
    shop = list[0];
  }
  if (!shop) throw new Error('No active shop configured. Create a shop first.');
  return shop;
}

/**
 * Keep legacy inventory / products / inventory_balance aligned with primary shop stock (POS UI).
 */
async function syncLegacyInventoryFromShop(shopId, productId, client = null) {
  const stockRow = await shopStockRepository.findByShopAndProduct(shopId, productId, client);
  const qty = Number(stockRow?.quantity ?? 0);
  const reserved = Number(stockRow?.reserved_quantity ?? 0);
  const available = Math.max(0, qty - reserved);

  let inv = await inventoryRepository.findOne({ productId, product: productId }, client);
  if (!inv) {
    inv = await inventoryRepository.create({
      productId,
      product: productId,
      currentStock: qty,
      reservedStock: reserved,
      availableStock: available,
      reorderPoint: 10,
      reorderQuantity: 50,
      status: 'active',
    }, client);
  } else {
    await inventoryRepository.updateByProductId(productId, {
      currentStock: qty,
      reservedStock: reserved,
      availableStock: available,
    }, client);
  }

  const product = await productRepository.findById(productId, true);
  if (product) {
    await productRepository.update(productId, { stockQuantity: qty }, client);
  }

  try {
    await inventoryBalanceRepository.syncBalance(productId, qty, reserved, 0, client);
  } catch (_) {
    /* inventory_balance optional */
  }

  return { currentStock: qty, availableStock: available, reservedStock: reserved };
}

async function receiveAtWarehouse(
  {
    productId,
    quantity,
    warehouseId,
    cost,
    reason,
    reference,
    referenceId,
    referenceNumber,
    performedBy,
    notes,
    movementType = 'purchase',
  },
  options = {}
) {
  const { client = null, skipFifoReceive = false, skipFifoConsume = false } = options;
  const qty = Number(quantity);
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    throw new Error('Invalid warehouse stock receipt');
  }

  const warehouse = warehouseId
    ? await warehouseRepository.findById(warehouseId)
    : await resolvePrimaryWarehouse(client);
  if (!warehouse) throw new Error('Warehouse not found');

  const product = await productRepository.findById(productId, true);
  if (!product) throw new Error('Product not found');

  const { previousQuantity, newQuantity } = await warehouseStockRepository.adjustQuantity(
    warehouse.id,
    productId,
    qty,
    client
  );

  const receiptCost = cost != null && Number.isFinite(Number(cost))
    ? Number(cost)
    : parseFloat(product.cost_price || product.costPrice || 0);

  if (!skipFifoReceive) {
    await fifoService.receiveStock(
      {
        productId,
        quantity: qty,
        unitCost: receiptCost,
        warehouseId: warehouse.id,
        referenceModel: movementType === 'purchase' ? 'PurchaseInvoice' : 'StockAdjustment',
        referenceId: referenceId || null,
        referenceNumber: referenceNumber || reference || null,
        userId: performedBy,
        notes: notes || reason || 'Warehouse stock in',
        movementType: 'purchase_in',
      },
      client
    );
  }

  await StockMovementService.createMovement({
    productId,
    movementType,
    quantity: qty,
    unitCost: receiptCost,
    referenceType: 'purchase_order',
    referenceId: referenceId || null,
    referenceNumber: referenceNumber || reference || null,
    location: warehouse.code || warehouse.name,
    warehouseId: warehouse.id,
    fromLocation: null,
    toLocation: warehouse.code || warehouse.name,
    reason: reason || 'Warehouse stock in',
    notes: notes || null,
    previousStock: previousQuantity,
    newStock: newQuantity,
    skipInventoryUpdate: true,
  }, { id: performedBy });

  return { warehouseId: warehouse.id, previousQuantity, newQuantity, currentStock: newQuantity };
}

async function issueFromWarehouse(
  {
    productId,
    quantity,
    warehouseId,
    reason,
    referenceId,
    referenceNumber,
    performedBy,
    notes,
    movementType = 'transfer_out',
  },
  options = {}
) {
  const { client = null, skipFifoReceive = false, skipFifoConsume = false } = options;
  const effectiveSkipFifoConsume = skipFifoConsume || movementType === 'transfer_out';
  const qty = Number(quantity);
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    throw new Error('Invalid warehouse stock issue');
  }

  const warehouse = warehouseId
    ? await warehouseRepository.findById(warehouseId)
    : await resolvePrimaryWarehouse(client);
  if (!warehouse) throw new Error('Warehouse not found');

  const product = await productRepository.findById(productId, true);
  if (!product) throw new Error('Product not found');

  const { previousQuantity, newQuantity } = await warehouseStockRepository.adjustQuantity(
    warehouse.id,
    productId,
    -qty,
    client
  );

  let movementUnitCost = parseFloat(product.cost_price || 0);
  if (!effectiveSkipFifoConsume) {
    const fifoResult = await fifoService.reduceFromPurchaseBatches({
      productId,
      quantity: qty,
      purchaseReferenceId: referenceId,
      returnId: referenceId,
      referenceNumber,
      userId: performedBy,
      notes: notes || reason || 'Warehouse stock out',
    }, client).catch(async () => {
      return fifoService.consumeStock({
        productId,
        quantity: qty,
        referenceModel: 'StockAdjustment',
        referenceId,
        referenceNumber,
        userId: performedBy,
        notes: notes || reason || 'Warehouse stock out',
        movementType: movementType || 'transfer_out',
      }, client);
    });
    movementUnitCost = fifoResult.unitCost || movementUnitCost;
  }

  await StockMovementService.createMovement({
    productId,
    movementType,
    quantity: qty,
    unitCost: movementUnitCost,
    referenceType: 'transfer',
    referenceId,
    referenceNumber,
    location: warehouse.code || warehouse.name,
    warehouseId: warehouse.id,
    fromLocation: warehouse.code || warehouse.name,
    reason: reason || 'Warehouse stock out',
    notes,
    previousStock: previousQuantity,
    newStock: newQuantity,
    skipInventoryUpdate: true,
  }, { id: performedBy });

  return { warehouseId: warehouse.id, previousQuantity, newQuantity };
}

async function issueFromShop(
  { productId, quantity, shopId, reason, reference, referenceId, referenceNumber, performedBy, notes },
  options = {}
) {
  const { client = null, skipFifoConsume = false, unitCost: overrideUnitCost } = options;
  const qty = Number(quantity);
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    throw new Error('Invalid shop stock issue');
  }

  const shop = shopId ? await shopRepository.findById(shopId) : await resolvePrimaryShop(client);
  if (!shop) throw new Error('Shop not found');

  const product = await productRepository.findById(productId, true);
  if (!product) throw new Error('Product not found');

  const { previousQuantity, newQuantity } = await shopStockRepository.adjustQuantity(
    shop.id,
    productId,
    -qty,
    client
  );

  await syncLegacyInventoryFromShop(shop.id, productId, client);

  let movementUnitCost = overrideUnitCost ?? parseFloat(product.cost_price || 0);
  if (!skipFifoConsume) {
    const fifoResult = await fifoService.consumeStock({
      productId,
      quantity: qty,
      saleId: referenceId,
      referenceModel: 'Sale',
      referenceId,
      referenceNumber: referenceNumber || reference || null,
      userId: performedBy,
      notes: notes || reason || 'Shop stock out',
      movementType: 'sale_out',
    }, client);
    movementUnitCost = fifoResult.unitCost || movementUnitCost;
  }

  await StockMovementService.createMovement({
    productId,
    movementType: 'sale',
    quantity: qty,
    unitCost: movementUnitCost,
    referenceType: 'sales_order',
    referenceId: referenceId || null,
    referenceNumber: referenceNumber || reference || null,
    location: shop.code || shop.name,
    shopId: shop.id,
    toLocation: shop.code || shop.name,
    reason: reason || 'Shop stock out',
    notes,
    previousStock: previousQuantity,
    newStock: newQuantity,
    skipInventoryUpdate: true,
  }, { id: performedBy });

  return { shopId: shop.id, previousQuantity, newQuantity, currentStock: newQuantity, unitCost: movementUnitCost };
}

async function restoreToShop(
  { productId, quantity, shopId, reason, referenceId, referenceNumber, performedBy, notes, unitCost },
  options = {}
) {
  const { client = null, skipFifoReceive = false } = options;
  const qty = Number(quantity);
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    throw new Error('Invalid shop stock restore');
  }

  const shop = shopId ? await shopRepository.findById(shopId) : await resolvePrimaryShop(client);
  if (!shop) throw new Error('Shop not found');

  const product = await productRepository.findById(productId, true);
  if (!product) throw new Error('Product not found');

  const { previousQuantity, newQuantity } = await shopStockRepository.adjustQuantity(
    shop.id,
    productId,
    qty,
    client
  );

  await syncLegacyInventoryFromShop(shop.id, productId, client);

  const restoreCost = unitCost != null
    ? Number(unitCost)
    : parseFloat(product.cost_price || 0);

  if (!skipFifoReceive) {
    await fifoService.receiveStock(
      {
        productId,
        quantity: qty,
        unitCost: restoreCost,
        shopId: shop.id,
        referenceModel: 'Return',
        referenceId,
        referenceNumber,
        userId: performedBy,
        notes: notes || reason || 'Shop stock restore',
        movementType: 'sale_return_in',
      },
      client
    );
  }

  await StockMovementService.createMovement({
    productId,
    movementType: 'return_in',
    quantity: qty,
    unitCost: restoreCost,
    referenceType: 'return',
    referenceId,
    referenceNumber,
    location: shop.code || shop.name,
    shopId: shop.id,
    reason: reason || 'Shop stock restore',
    notes,
    previousStock: previousQuantity,
    newStock: newQuantity,
    skipInventoryUpdate: true,
  }, { id: performedBy });

  return { shopId: shop.id, previousQuantity, newQuantity, currentStock: newQuantity };
}

async function receiveAtShop(
  { productId, quantity, shopId, unitCost, reason, referenceId, referenceNumber, performedBy, notes },
  options = {}
) {
  const { client = null, skipFifoReceive = false } = options;
  const qty = Number(quantity);
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    throw new Error('Invalid shop stock receipt');
  }

  const shop = shopId ? await shopRepository.findById(shopId) : await resolvePrimaryShop(client);
  if (!shop) throw new Error('Shop not found');

  const product = await productRepository.findById(productId, true);
  if (!product) throw new Error('Product not found');

  const { previousQuantity, newQuantity } = await shopStockRepository.adjustQuantity(
    shop.id,
    productId,
    qty,
    client
  );

  await syncLegacyInventoryFromShop(shop.id, productId, client);

  const receiptCost = unitCost != null
    ? Number(unitCost)
    : parseFloat(product.cost_price || 0);

  if (!skipFifoReceive) {
    await fifoService.receiveStock(
      {
        productId,
        quantity: qty,
        unitCost: receiptCost,
        shopId: shop.id,
        referenceModel: 'Transfer',
        referenceId,
        referenceNumber,
        userId: performedBy,
        notes: notes || reason || 'Shop stock in',
        movementType: 'transfer_in',
      },
      client
    );
  }

  await StockMovementService.createMovement({
    productId,
    movementType: 'transfer_in',
    quantity: qty,
    unitCost: receiptCost,
    referenceType: 'transfer',
    referenceId,
    referenceNumber,
    location: shop.code || shop.name,
    toLocation: shop.code || shop.name,
    fromLocation: null,
    reason: reason || 'Shop stock in',
    notes,
    previousStock: previousQuantity,
    newStock: newQuantity,
    skipInventoryUpdate: true,
  }, { id: performedBy });

  return { shopId: shop.id, previousQuantity, newQuantity, currentStock: newQuantity };
}

/**
 * Admin physical count: set warehouse quantity to an absolute level.
 */
async function setWarehouseStockLevel(
  {
    productId,
    targetQuantity,
    warehouseId,
    cost,
    reason,
    referenceId,
    referenceNumber,
    performedBy,
    notes,
  },
  options = {}
) {
  const { client = null } = options;
  const warehouse = warehouseId
    ? await warehouseRepository.findById(warehouseId)
    : await resolvePrimaryWarehouse(client);
  if (!warehouse) throw new Error('Warehouse not found');

  const row = await warehouseStockRepository.ensureRow(warehouse.id, productId, client);
  const current = Number(row.quantity ?? 0);
  const target = Number(targetQuantity);
  if (!Number.isFinite(target) || target < 0) {
    throw new Error('Target warehouse quantity must be zero or greater');
  }
  const delta = target - current;
  if (delta === 0) {
    return { warehouseId: warehouse.id, previousQuantity: current, newQuantity: current, currentStock: current };
  }
  if (delta > 0) {
    return receiveAtWarehouse({
      productId,
      quantity: delta,
      warehouseId: warehouse.id,
      cost,
      reason: reason || 'Warehouse stock adjustment',
      referenceId,
      referenceNumber,
      performedBy,
      notes,
      movementType: 'adjustment_in',
    }, options);
  }
  return issueFromWarehouse({
    productId,
    quantity: Math.abs(delta),
    warehouseId: warehouse.id,
    reason: reason || 'Warehouse stock adjustment',
    referenceId,
    referenceNumber,
    performedBy,
    notes,
    movementType: 'adjustment_out',
  }, options);
}

async function getWarehouseStockQuantity(warehouseId, productId, client = null) {
  const warehouse = warehouseId
    ? await warehouseRepository.findById(warehouseId)
    : await resolvePrimaryWarehouse(client);
  if (!warehouse) return 0;
  const row = await warehouseStockRepository.findByWarehouseAndProduct(warehouse.id, productId, client);
  return Number(row?.quantity ?? 0);
}

async function getShopStockForProducts(shopId, productIds) {
  const shop = shopId ? await shopRepository.findById(shopId) : await resolvePrimaryShop();
  const rows = await shopStockRepository.findByShopAndProductIds(shop.id, productIds);
  const map = new Map();
  rows.forEach((r) => map.set(String(r.product_id), r));
  return { shopId: shop.id, shopName: shop.name, shopCode: shop.code, stockByProduct: map };
}

async function getWarehouseStockForProducts(warehouseId, productIds) {
  const warehouse = warehouseId
    ? await warehouseRepository.findById(warehouseId)
    : await resolvePrimaryWarehouse();
  const rows = await warehouseStockRepository.findByWarehouseAndProductIds(warehouse.id, productIds);
  const map = new Map();
  rows.forEach((r) => map.set(String(r.product_id), r));
  return {
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    warehouseCode: warehouse.code,
    stockByProduct: map,
  };
}

module.exports = {
  resolvePrimaryWarehouse,
  resolvePrimaryShop,
  syncLegacyInventoryFromShop,
  receiveAtWarehouse,
  issueFromWarehouse,
  issueFromShop,
  restoreToShop,
  receiveAtShop,
  setWarehouseStockLevel,
  getWarehouseStockQuantity,
  getShopStockForProducts,
  getWarehouseStockForProducts,
};
