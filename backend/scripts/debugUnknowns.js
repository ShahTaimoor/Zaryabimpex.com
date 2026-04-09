const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('../config/postgres');

async function debugUnknowns() {
  const res = await query(`
    SELECT id, so_number, items 
    FROM sales_orders 
    WHERE items::text ILIKE '%Unknown Product%' 
  `);

  console.log(`Found ${res.rows.length} sales orders with Unknown Product.`);

  for (const row of res.rows) {
    console.log(`\nOrder: ${row.so_number} (ID: ${row.id})`);
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
    for (const item of items) {
       const name = item.name || item.productName;
       if (!name || name.toUpperCase() === 'UNKNOWN PRODUCT') {
         console.log(`  - Item with Missing Name: ProductID=${item.product || item.product_id}`);
       }
    }
  }

  const res2 = await query(`
    SELECT id, order_number, items 
    FROM sales 
    WHERE items::text ILIKE '%Unknown Product%' 
  `);

  console.log(`\nFound ${res2.rows.length} sales with Unknown Product.`);
  for (const row of res2.rows) {
    console.log(`\nSale: ${row.order_number} (ID: ${row.id})`);
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
    for (const item of items) {
       const name = item.name || item.productName;
       if (!name || name.toUpperCase() === 'UNKNOWN PRODUCT') {
         console.log(`  - Item with Missing Name: ProductID=${item.product || item.product_id}`);
       }
    }
  }
  process.exit(0);
}

debugUnknowns().catch(console.error);
