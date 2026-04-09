const { query } = require('../config/postgres');

async function syncInventoryBalance() {
  console.log('🚀 Starting Inventory Balance Re-synchronization...');
  
  try {
    const result = await query(`
      INSERT INTO inventory_balance (product_id, quantity, quantity_reserved, quantity_quarantine, updated_at)
      SELECT 
        product_id, 
        COALESCE(current_stock, 0), 
        COALESCE(reserved_stock, 0), 
        0, 
        CURRENT_TIMESTAMP
      FROM inventory
      WHERE deleted_at IS NULL
      ON CONFLICT (product_id) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        quantity_reserved = EXCLUDED.quantity_reserved,
        updated_at = CURRENT_TIMESTAMP;
    `);
    
    console.log(`✅ Successfully synchronized inventory_balance table.`);
    console.log(`Rows affected: ${result.rowCount}`);
    
    // Check the specific product mentioned by user
    const checkUserProduct = await query(`
      SELECT p.name, i.current_stock, ib.quantity as balance_quantity
      FROM products p
      JOIN inventory i ON i.product_id = p.id
      JOIN inventory_balance ib ON ib.product_id = p.id
      WHERE p.name LIKE '%sadsadqwweqwtes%'
    `);
    
    if (checkUserProduct.rows.length > 0) {
      console.log('Verification for "sadsadqwweqwtes":');
      console.log(JSON.stringify(checkUserProduct.rows[0], null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error synchronizing inventory balance:', error);
    process.exit(1);
  }
}

syncInventoryBalance();
