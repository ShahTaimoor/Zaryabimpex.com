const { query } = require('../config/postgres');

async function fixNaNProducts() {
  try {
    console.log('🔍 Checking for products with NaN values...');
    const nanProducts = await query(`
      SELECT id, name FROM products 
      WHERE cost_price = 'NaN' 
         OR selling_price = 'NaN' 
         OR wholesale_price = 'NaN' 
         OR stock_quantity = 'NaN'
    `);
    
    if (nanProducts.rows.length === 0) {
      console.log('✅ No NaN values found.');
      return;
    }
    
    console.log(`⚠️ Found ${nanProducts.rows.length} product(s) with NaN values:`);
    nanProducts.rows.forEach(p => console.log(` - [${p.id}] ${p.name}`));
    
    const ids = nanProducts.rows.map(p => `'${p.id}'`).join(',');
    const deleteResult = await query(`DELETE FROM products WHERE id IN (${ids})`);
    
    console.log(`✅ Deleted ${deleteResult.rowCount} stray product(s).`);
    
    // Verify the summary now works
    const summary = await query(`
      SELECT 
        SUM(COALESCE(stock_quantity, 0) * COALESCE(cost_price, 0)) as cost,
        SUM(COALESCE(stock_quantity, 0) * COALESCE(selling_price, 0)) as retail,
        SUM(COALESCE(stock_quantity, 0) * COALESCE(wholesale_price, 0)) as wholesale
      FROM products
      WHERE is_active = true AND is_deleted = false
    `);
    
    console.log('📈 New Inventory Valuations:');
    console.log(JSON.stringify(summary.rows[0], null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing NaN products:', err);
    process.exit(1);
  }
}

fixNaNProducts();
