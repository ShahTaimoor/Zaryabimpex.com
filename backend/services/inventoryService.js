const inventoryRepository = require('../repositories/InventoryRepository');
const stockAdjustmentRepository = require('../repositories/StockAdjustmentRepository');
const productRepository = require('../repositories/ProductRepository');
const productVariantRepository = require('../repositories/ProductVariantRepository');

function getCurrentStock(inv) {
  return Number(inv?.current_stock ?? inv?.currentStock ?? 0);
}

function getCost(inv) {
  const c = inv?.cost;
  return c && typeof c === 'object' ? c : (typeof c === 'string' ? JSON.parse(c || '{}') : {});
}

// Ensure an inventory record exists for the product (create from product stock if missing)
const ensureInventoryRecord = async (productId) => {
  let inv = await inventoryRepository.findByProduct(productId);
  if (inv) return inv;
  const product = await productRepository.findById(productId);
  if (!product) throw new Error('Product not found');
  inv = await inventoryRepository.create({
    productId,
    product: productId,
    productModel: 'Product',
    currentStock: product.stock_quantity ?? product.inventory?.currentStock ?? 0,
    reorderPoint: product.min_stock_level ?? product.inventory?.reorderPoint ?? 10,
    reorderQuantity: product.inventory?.reorderQuantity ?? 50,
    status: 'active'
  });
  return inv;
};

// Update stock levels
const updateStock = async ({ productId, type, quantity, reason, reference, referenceId, referenceModel, cost, performedBy, notes }) => {
  try {
    const inv = await ensureInventoryRecord(productId);
    const current = getCurrentStock(inv);
    const isIn = ['in', 'return'].includes(type);
    const newStock = isIn ? current + quantity : Math.max(0, current - quantity);
    if (!isIn && newStock !== current - quantity) {
      throw new Error('Insufficient stock');
    }

    const updatePayload = { currentStock: newStock };
    if (cost !== undefined && cost !== null && isIn) {
      const costObj = getCost(inv);
      if (costObj.average !== undefined) updatePayload.cost = { ...costObj, average: cost };
      else updatePayload.cost = { ...costObj, average: cost, lastPurchase: cost };
    }
    const updated = await inventoryRepository.updateByProductId(productId, updatePayload);

    const productRow = await productRepository.findById(productId);
    if (productRow) {
      await productRepository.update(productId, {
        stockQuantity: newStock,
        ...(cost !== undefined && cost !== null && isIn ? { costPrice: cost } : {})
      });
    } else {
      await productVariantRepository.updateById(productId, {
        inventory: { currentStock: newStock }
      });
    }

    return updated || inv;
  } catch (error) {
    console.error('Error updating stock:', error);
    throw error;
  }
};

// Reserve stock for an order (simple reserve; for expiring reservations use stockReservationService)
const reserveStock = async ({ productId, quantity }) => {
  try {
    const inv = await inventoryRepository.findByProduct(productId);
    if (!inv) throw new Error('Inventory record not found');
    const current = getCurrentStock(inv);
    const reserved = Number(inv?.reserved_stock ?? inv?.reservedStock ?? 0);
    const available = current - reserved;
    if (available < quantity) throw new Error('Insufficient available stock');
    await inventoryRepository.updateByProductId(productId, {
      reservedStock: reserved + quantity,
      availableStock: Math.max(0, current - (reserved + quantity))
    });
    return inventoryRepository.findByProduct(productId);
  } catch (error) {
    console.error('Error reserving stock:', error);
    throw error;
  }
};

// Release reserved stock
const releaseStock = async ({ productId, quantity }) => {
  try {
    const inv = await ensureInventoryRecord(productId);
    const reserved = Number(inv?.reserved_stock ?? inv?.reservedStock ?? 0);
    const current = getCurrentStock(inv);
    const newReserved = Math.max(0, reserved - quantity);
    await inventoryRepository.updateByProductId(productId, {
      reservedStock: newReserved,
      availableStock: Math.max(0, current - newReserved)
    });
    return inventoryRepository.findByProduct(productId);
  } catch (error) {
    console.error('Error releasing stock:', error);
    throw error;
  }
};

// Process stock adjustment
const processStockAdjustment = async ({ adjustments, type, reason, requestedBy, warehouse, notes }) => {
  try {
    const adjustment = await stockAdjustmentRepository.create({
      type,
      reason,
      adjustments: adjustments || [],
      requestedBy,
      warehouse: warehouse || 'Main Warehouse',
      notes
    });
    return adjustment;
  } catch (error) {
    console.error('Error processing stock adjustment:', error);
    throw error;
  }
};

// Get inventory status for a product
const getInventoryStatus = async (productId) => {
  try {
    let inv = await inventoryRepository.findOne({ product: productId, productId });
    if (!inv) {
      const product = await productRepository.findById(productId);
      if (!product) throw new Error('Product not found');
      inv = await inventoryRepository.create({
        productId,
        product: productId,
        productModel: 'Product',
        currentStock: product.inventory?.currentStock ?? product.stock_quantity ?? 0,
        reorderPoint: product.inventory?.reorderPoint ?? 10,
        reorderQuantity: product.inventory?.reorderQuantity ?? 50,
        status: 'active'
      });
    }
    return inv;
  } catch (error) {
    console.error('Error getting inventory status:', error);
    throw error;
  }
};

// Get low stock items
const getLowStockItems = async () => {
  try {
    return await inventoryRepository.findLowStock({ limit: 500 });
  } catch (error) {
    console.error('Error getting low stock items:', error);
    throw error;
  }
};

// Get inventory movement history (from movements JSONB)
const getInventoryHistory = async ({ productId, limit = 50, offset = 0, type, startDate, endDate }) => {
  try {
    const inv = await inventoryRepository.findOne({ product: productId, productId });
    if (!inv) return { movements: [], total: 0, hasMore: false };
    let movements = inv.movements && Array.isArray(inv.movements) ? inv.movements : (typeof inv.movements === 'string' ? JSON.parse(inv.movements || '[]') : []);
    if (type) movements = movements.filter(m => m.type === type);
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      movements = movements.filter(m => {
        const d = new Date(m.date);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }
    movements.sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = movements.length;
    const paginated = movements.slice(offset, offset + limit);
    return { movements: paginated, total, hasMore: offset + limit < total };
  } catch (error) {
    console.error('Error getting inventory history:', error);
    throw error;
  }
};

// Get inventory summary: counts across ALL products (inventory table when present, else product.stock_quantity).
const getInventorySummary = async () => {
  try {
    const totalProducts = await productRepository.count({});
    const allProducts = await productRepository.findAll({}, { limit: 50000 });
    const allInventoryRows = await inventoryRepository.findAll({}, { limit: 50000 });

    const invByProductId = new Map();
    (allInventoryRows || []).forEach((r) => {
      const pid = (r.product_id ?? r.productId ?? r.product)?.toString?.() ?? r.product_id;
      if (pid) invByProductId.set(pid, r);
    });

    let outOfStock = 0;
    let lowStock = 0;
    let totalValue = 0;

    for (const product of allProducts || []) {
      const pid = (product.id ?? product._id)?.toString?.();
      const inv = pid ? invByProductId.get(pid) : null;
      // Use inventory table as source of truth: no inventory row = treat as 0 stock (out of stock)
      const currentStock = inv != null
        ? getCurrentStock(inv)
        : Number(0);
      const reorderPoint = inv != null
        ? Number(inv.reorder_point ?? inv.reorderPoint ?? 0)
        : Number(product.min_stock_level ?? product.minStockLevel ?? product.minStock ?? 0);

      if (currentStock <= 0) outOfStock += 1;
      else if (reorderPoint > 0 && currentStock <= reorderPoint) lowStock += 1;

      const cost = Number(product.cost_price ?? product.costPrice ?? 0) || (product.pricing?.cost ?? 0);
      totalValue += currentStock * cost;
    }

    return { totalProducts, outOfStock, lowStock, totalValue };
  } catch (error) {
    console.error('Error getting inventory summary:', error);
    throw error;
  }
};

// Bulk update stock levels
const bulkUpdateStock = async (updates) => {
  const results = [];
  for (const update of updates) {
    try {
      const result = await updateStock(update);
      results.push({ success: true, productId: update.productId, inventory: result });
    } catch (error) {
      results.push({ success: false, productId: update.productId, error: error.message });
    }
  }
  return results;
};

// Create inventory record for new product
const createInventoryRecord = async (productId, initialStock = 0) => {
  const product = await productRepository.findById(productId);
  if (!product) throw new Error('Product not found');
  const inv = await inventoryRepository.create({
    productId,
    product: productId,
    productModel: 'Product',
    currentStock: initialStock,
    reorderPoint: product.inventory?.reorderPoint ?? 10,
    reorderQuantity: product.inventory?.reorderQuantity ?? 50,
    status: 'active'
  });
  return inv;
};

module.exports = {
  updateStock,
  reserveStock,
  releaseStock,
  processStockAdjustment,
  getInventoryStatus,
  getLowStockItems,
  getInventoryHistory,
  getInventorySummary,
  bulkUpdateStock,
  createInventoryRecord,
};
