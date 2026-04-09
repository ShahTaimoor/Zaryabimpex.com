const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('../config/postgres');
const logger = require('../utils/logger');

async function fixUnknownProducts() {
  logger.info('Starting repair of Unknown Products in Sales and Sales Orders...');

  // 1. Repair Sales (Invoices)
  const salesRes = await query(`
    SELECT id, items, order_number 
    FROM sales 
    WHERE items::text ILIKE '%Unknown Product%' 
       OR items::text ILIKE '%"name": null%'
       OR items::text NOT LIKE '%"name":%'
  `);

  logger.info(`Found ${salesRes.rows.length} sales to potentially fix.`);

  for (const sale of salesRes.rows) {
    let items = sale.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { continue; }
    }
    if (!Array.isArray(items)) continue;

    let changed = false;
    for (const item of items) {
      const name = item.name || item.productName || item.product_name;
      if (!name || name.toUpperCase() === 'UNKNOWN PRODUCT') {
        const productId = item.product || item.product_id;
        if (!productId) continue;

        // Try to find name from other records or products table
        const productInfo = await findProductInfo(productId);
        if (productInfo) {
          item.name = productInfo.name;
          item.sku = productInfo.sku || item.sku || null;
          changed = true;
          logger.info(`Fixed item in sale ${sale.order_number}: ${productId} -> ${productInfo.name}`);
        }
      }
    }

    if (changed) {
      await query('UPDATE sales SET items = $1 WHERE id = $2', [JSON.stringify(items), sale.id]);
    }
  }

  // 2. Repair Sales Orders
  const soRes = await query(`
    SELECT id, items, so_number 
    FROM sales_orders 
    WHERE items::text ILIKE '%Unknown Product%' 
       OR items::text ILIKE '%"name": null%'
       OR items::text NOT LIKE '%"name":%'
  `);

  logger.info(`Found ${soRes.rows.length} sales orders to potentially fix.`);

  for (const so of soRes.rows) {
    let items = so.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { continue; }
    }
    if (!Array.isArray(items)) continue;

    let changed = false;
    for (const item of items) {
      const name = item.name || item.productName || item.product_name;
      if (!name || name.toUpperCase() === 'UNKNOWN PRODUCT') {
        const productId = item.product || item.product_id;
        if (!productId) continue;

        const productInfo = await findProductInfo(productId);
        if (productInfo) {
          item.name = productInfo.name;
          item.sku = productInfo.sku || item.sku || null;
          changed = true;
          logger.info(`Fixed item in sales order ${so.so_number}: ${productId} -> ${productInfo.name}`);
        }
      }
    }

    if (changed) {
      await query('UPDATE sales_orders SET items = $1 WHERE id = $2', [JSON.stringify(items), so.id]);
    }
  }

  logger.info('Repair complete.');
  process.exit(0);
}

const productCache = {};

async function findProductInfo(productId) {
  if (productCache[productId]) return productCache[productId];

  // Check products
  const pRes = await query('SELECT name, sku FROM products WHERE id = $1', [productId]);
  if (pRes.rows[0]) {
    productCache[productId] = pRes.rows[0];
    return pRes.rows[0];
  }

  // Check variants
  const vRes = await query('SELECT display_name as name, sku FROM product_variants WHERE id = $1', [productId]);
  if (vRes.rows[0]) {
    productCache[productId] = vRes.rows[0];
    return vRes.rows[0];
  }

  // Search sales history for a name associated with this ID
  const histRes = await query(`
    SELECT name, sku FROM (
      SELECT (elem->>'name') as name, (elem->>'sku') as sku, s.created_at 
      FROM sales s, jsonb_array_elements(items) elem 
      WHERE (elem->>'product' = $1 OR elem->>'product_id' = $1) 
        AND (elem->>'name') IS NOT NULL 
        AND (elem->>'name') NOT ILIKE 'Unknown Product'
      UNION ALL
      SELECT (elem->>'productName') as name, (elem->>'sku') as sku, pi.created_at 
      FROM purchase_invoices pi, jsonb_array_elements(items) elem 
      WHERE (elem->>'product' = $1 OR elem->>'product_id' = $1) 
        AND (elem->>'productName') IS NOT NULL 
        AND (elem->>'productName') NOT ILIKE 'Unknown Product'
    ) h ORDER BY created_at DESC LIMIT 1
  `, [productId]);

  if (histRes.rows[0]) {
    productCache[productId] = histRes.rows[0];
    return histRes.rows[0];
  }

  return null;
}

fixUnknownProducts().catch(err => {
  logger.error('Repair utility failed:', err);
  process.exit(1);
});
