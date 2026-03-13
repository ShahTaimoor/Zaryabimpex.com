#!/usr/bin/env node
/**
 * Backfill cost (unitCost / cost_price) on all existing sale invoice items
 * so that P&L (Profit & Loss) calculations are correct for historical data.
 *
 * Run from backend folder: node scripts/backfillSalesItemCosts.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const salesRepository = require('../repositories/postgres/SalesRepository');
const productRepository = require('../repositories/ProductRepository');
const productVariantRepository = require('../repositories/ProductVariantRepository');
const inventoryRepository = require('../repositories/postgres/InventoryRepository');

/**
 * Resolve unit cost for a product/variant ID (same logic as sales edit and createSale).
 */
async function getUnitCostForProduct(productId) {
  if (!productId) return 0;
  const id = typeof productId === 'string' ? productId : (productId?.toString?.() || String(productId));

  let product = await productRepository.findById(id);
  let isVariant = false;
  if (!product) {
    product = await productVariantRepository.findById(id);
    if (product) isVariant = true;
  }
  if (!product) return 0;

  let unitCost = 0;
  const pid = product.id || product._id;
  if (pid) {
    const inv = await inventoryRepository.findByProduct(pid);
    if (inv && inv.cost) {
      const costObj = typeof inv.cost === 'string' ? JSON.parse(inv.cost) : inv.cost;
      unitCost = costObj.average ?? costObj.lastPurchase ?? 0;
    }
    if (unitCost === 0) {
      if (isVariant) {
        const pricing = typeof product.pricing === 'string' ? (() => { try { return JSON.parse(product.pricing || '{}'); } catch { return {}; } })() : (product.pricing || {});
        unitCost = Number(pricing.cost ?? pricing.cost_price ?? 0) || 0;
      } else {
        unitCost = Number(product.costPrice ?? product.cost_price ?? 0) || 0;
      }
    }
  }
  return unitCost;
}

/**
 * Check if an item already has cost (no need to change).
 */
function itemHasCost(item) {
  const cost = Number(item.unitCost ?? item.cost_price ?? item.costPrice ?? 0);
  return cost > 0 || (item.unitCost !== undefined || item.cost_price !== undefined);
}

async function backfillSalesItemCosts() {
  console.log('Backfilling cost on sale invoice items for correct P&L...\n');

  const sales = await salesRepository.findAll({}, { limit: 500000 });
  console.log(`Found ${sales.length} sales to process.\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const sale of sales) {
    const items = Array.isArray(sale.items) ? sale.items : (typeof sale.items === 'string' ? (() => { try { return JSON.parse(sale.items || '[]'); } catch { return []; } })() : []);
    if (items.length === 0) {
      skippedCount++;
      continue;
    }

    let needsUpdate = false;
    const newItems = [];

    for (const item of items) {
      const productId = item.product_id ?? item.product;
      const pid = productId && (typeof productId === 'string' ? productId : (productId._id ?? productId.id ?? productId)?.toString?.());
      let unitCost = Number(item.unitCost ?? item.cost_price ?? item.costPrice ?? 0);

      if (!itemHasCost(item) && pid) {
        unitCost = await getUnitCostForProduct(pid);
        needsUpdate = true;
      }

      const productRef = pid || (item.product && (typeof item.product === 'string' ? item.product : (item.product._id ?? item.product.id ?? item.product))) || item.product_id || productId;
      newItems.push({
        ...item,
        product: productRef,
        product_id: productRef,
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? item.unit_price ?? 0,
        unitCost,
        cost_price: unitCost,
        subtotal: item.subtotal,
        total: item.total,
        discountAmount: item.discountAmount ?? item.discount_amount,
        taxAmount: item.taxAmount ?? item.tax_amount
      });
    }

    if (needsUpdate) {
      try {
        await salesRepository.update(sale.id, { items: newItems });
        updatedCount++;
        const ref = sale.order_number ?? sale.orderNumber ?? sale.id;
        console.log(`  Updated sale ${ref} (${newItems.length} items)`);
      } catch (err) {
        errorCount++;
        console.error(`  Failed to update sale ${sale.id}:`, err.message);
      }
    } else {
      skippedCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Done. Updated: ${updatedCount}, Skipped (no change): ${skippedCount}, Errors: ${errorCount}`);
  console.log('P&L will now use correct COGS for all sale invoices.');
  console.log('='.repeat(50));
  return { updatedCount, skippedCount, errorCount };
}

async function main() {
  try {
    const { errorCount } = await backfillSalesItemCosts();
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
}

main();
