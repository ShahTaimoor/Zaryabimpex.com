const inventoryRepository = require('../repositories/InventoryRepository');
const stockAdjustmentRepository = require('../repositories/StockAdjustmentRepository');
const productRepository = require('../repositories/ProductRepository');
const { query: pgQuery } = require('../config/postgres');
const productVariantRepository = require('../repositories/ProductVariantRepository');
const AccountingService = require('./accountingService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(v) {
  if (!v) return false;
  return UUID_REGEX.test(String(v));
}


function getCurrentStock(inv) {
  return Number(inv?.current_stock ?? inv?.currentStock ?? 0);
}

function getCost(inv) {
  const c = inv?.cost;
  return c && typeof c === 'object' ? c : (typeof c === 'string' ? JSON.parse(c || '{}') : {});
}

// Ensure an inventory record exists for the product (create from product stock if missing)
const ensureInventoryRecord = async (productId, client = null) => {
  let inv = await inventoryRepository.findOne({ product: productId, productId }, client);
  if (inv) return inv;
  const product = await productRepository.findById(productId, true);
  if (!product) throw new Error('Product not found');
  inv = await inventoryRepository.create({
    productId,
    product: productId,
    productModel: 'Product',
    currentStock: product.stock_quantity ?? product.inventory?.currentStock ?? 0,
    reorderPoint: product.min_stock_level ?? product.inventory?.reorderPoint ?? 10,
    reorderQuantity: product.inventory?.reorderQuantity ?? 50,
    status: 'active'
  }, client);
  return inv;
};

// Update stock levels with Average Cost Method for incoming stock
const updateStock = async ({ productId, type, quantity, reason, reference, referenceId, referenceModel, cost, performedBy, notes }, options = {}) => {
  const { client = null, skipAccountingEntry = false } = options;
  try {
    const inv = await ensureInventoryRecord(productId, client);
    const current = getCurrentStock(inv);
    const isIn = ['in', 'return'].includes(type);
    const newStock = isIn ? current + quantity : current - quantity;

    let finalCost = cost; // Default to provided cost

    // Implement Average Cost Method for incoming stock
    if (cost !== undefined && cost !== null && isIn && current > 0) {
      // Get current product cost price
      const productRow = await productRepository.findById(productId, true);
      const currentCostPrice = parseFloat(productRow?.cost_price || productRow?.costPrice || 0);

      if (currentCostPrice > 0) {
        // Calculate new average cost using weighted average formula
        // New Average Cost = (Old Stock Value + New Stock Value) / Total Quantity
        const oldStockValue = current * currentCostPrice;
        const newStockValue = quantity * cost;
        const totalValue = oldStockValue + newStockValue;
        const newAverageCost = Math.round((totalValue / newStock) * 100) / 100; // Round to 2 decimal places

        finalCost = newAverageCost;

        console.log(`Average Cost Calculation for Product ${productId}:`);
        console.log(`  Current Stock: ${current} units @ ${currentCostPrice} = ${oldStockValue}`);
        console.log(`  New Stock: ${quantity} units @ ${cost} = ${newStockValue}`);
        console.log(`  Total Value: ${totalValue}, Total Quantity: ${newStock}`);
        console.log(`  New Average Cost: ${newAverageCost}`);
      }
    }

    const updatePayload = { currentStock: newStock };
    if (finalCost !== undefined && finalCost !== null && isIn) {
      const costObj = getCost(inv);
      updatePayload.cost = { ...costObj, average: finalCost, lastPurchase: cost || finalCost };
    }
    const updated = await inventoryRepository.updateByProductId(productId, updatePayload, client);

    const productRow = await productRepository.findById(productId, true);
    if (productRow) {
      await productRepository.update(productId, {
        stockQuantity: newStock,
        ...(finalCost !== undefined && finalCost !== null && isIn ? { costPrice: finalCost } : {})
      }, client);

      // Update Accounting Ledger (Ensure physical stock matches financial value)
      if (!skipAccountingEntry) {
        try {
          const delta = isIn ? quantity : -quantity;
          const unitCost = cost || parseFloat(productRow.cost_price || productRow.costPrice) || 0;
          const validatedUserId = isValidUuid(performedBy) ? performedBy : null;

          await AccountingService.recordInventoryValueChange({
            productId,
            delta,
            unitCost,
            reason: reason || `Inventory ${type}`,
            referenceType: referenceModel === 'PurchaseInvoice' ? 'purchase_invoice' : (referenceModel === 'Sale' ? 'sale' : 'inventory_adjustment'),
            referenceId,
            referenceNumber,
            createdBy: validatedUserId,
            transactionDate: new Date()
          }, client);
        } catch (accErr) {
          // When called inside an explicit transaction, fail fast to preserve atomicity.
          if (client) {
            console.error('Ledger update failed within transaction. Aborting stock update.');
            throw accErr;
          }
          console.error('Failed to update ledger for inventory movement (non-critical outside transaction):', accErr);
        }
      }
    } else {
      await productVariantRepository.updateById(productId, {
        inventory: { currentStock: newStock }
      }, client);
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

// Get inventory summary: counts across ALL products (inventory table when present; no row => 0 stock).
const getInventorySummary = async () => {
  try {
    const result = await pgQuery(
      `WITH base AS (
         SELECT
           CASE WHEN i.id IS NOT NULL THEN COALESCE(i.current_stock::numeric, 0) ELSE 0::numeric END AS current_stock,
           CASE WHEN i.id IS NOT NULL THEN COALESCE(i.reorder_point::numeric, 0)
                ELSE COALESCE(p.min_stock_level::numeric, 0) END AS reorder_point,
           COALESCE(p.cost_price::numeric, 0) AS unit_cost
         FROM products p
         LEFT JOIN inventory i ON i.product_id = p.id AND i.deleted_at IS NULL
         WHERE (p.is_deleted = FALSE OR p.is_deleted IS NULL)
       ),
       pc AS (
         SELECT COUNT(*)::int AS total_products
         FROM products p
         WHERE (p.is_deleted = FALSE OR p.is_deleted IS NULL)
       )
       SELECT
         MAX(pc.total_products)::int AS total_products,
         COUNT(*) FILTER (WHERE b.current_stock <= 0)::int AS out_of_stock,
         COUNT(*) FILTER (
           WHERE b.current_stock > 0 AND b.reorder_point > 0 AND b.current_stock <= b.reorder_point
         )::int AS low_stock,
         COALESCE(SUM(b.current_stock * b.unit_cost), 0)::float AS total_value
       FROM base b
       CROSS JOIN pc`,
      []
    );
    const row = result.rows[0] || {};
    return {
      totalProducts: parseInt(row.total_products, 10) || 0,
      outOfStock: parseInt(row.out_of_stock, 10) || 0,
      lowStock: parseInt(row.low_stock, 10) || 0,
      totalValue: parseFloat(row.total_value) || 0,
    };
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
