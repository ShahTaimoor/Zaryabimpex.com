#!/usr/bin/env node
require('dotenv').config();
const { query, transaction } = require('../config/postgres');
const AccountingService = require('../services/accountingService');

/**
 * Seed script to ensure all products with stock have corresponding ledger entries 
 * in the Inventory account (1200). 
 * 
 * This fixes "old entries" that were created before the automated ledger 
 * synchronization was implemented, ensuring the Balance Sheet reflect the actual 
 * physical stock value.
 * 
 * Double-entry: Dr 1200 (Inventory), Cr 3100 (Retained Earnings)
 */

async function main() {
  console.log('🚀 Starting Product Stock Ledger Synchronization...');

  // Identify products with physical stock but NO completed ledger entries in Account 1200
  // Reference: AccountingService handles these as reference_type='product_opening_stock'
  const findStaleProductsQuery = `
    SELECT p.id, p.name, p.cost_price, i.current_stock 
    FROM products p
    JOIN inventory i ON p.id = i.product_id
    WHERE i.current_stock > 0
    AND NOT EXISTS (
      SELECT 1 FROM account_ledger al 
      WHERE al.reference_id::text = p.id::text 
      AND al.account_code = '1200'
      AND al.status = 'completed'
      AND al.reversed_at IS NULL
    )
    AND p.deleted_at IS NULL
  `;

  try {
    // Get a valid system user ID for the created_by field (UUID required)
    const userResult = await query('SELECT id FROM users WHERE is_active = TRUE ORDER BY created_at LIMIT 1');
    const systemUserId = userResult.rows[0]?.id;

    if (!systemUserId) {
      console.error('❌ No active users found in the database. Cannot create ledger entries.');
      process.exit(1);
    }

    const result = await query(findStaleProductsQuery);
    const staleProducts = result.rows;

    if (staleProducts.length === 0) {
      console.log('✅ Balance Sheet Sync: All product stocks are already reflected in the ledger.');
      process.exit(0);
    }

    console.log(`🔍 Found ${staleProducts.length} products with missing ledger entries.`);

    let successCount = 0;
    let failCount = 0;

    for (const product of staleProducts) {
      try {
        const qty = parseFloat(product.current_stock);
        const cost = parseFloat(product.cost_price) || 0;

        if (qty * cost < 0.01) {
          console.log(`   ⏭️ Skipping ${product.name} (Zero value: ${qty} units @ ${cost})`);
          continue;
        }

        await AccountingService.postProductOpeningStock(product.id, qty, cost, {
          createdBy: systemUserId,
          transactionDate: new Date(),
        });

        successCount++;
        console.log(`   [${successCount}/${staleProducts.length}] Synced: ${product.name} (${qty} units @ ${cost} = ${Math.round(qty * cost * 100) / 100})`);
      } catch (err) {
        failCount++;
        console.error(`   ❌ Failed to sync: ${product.name}`, err.message);
      }
    }

    console.log('\n✨ Synchronization Summary:');
    console.log(`   Total Identified: ${staleProducts.length}`);
    console.log(`   Successfully Fixed: ${successCount}`);
    console.log(`   Failed: ${failCount}`);

    // Final refresh of accounts to be absolutely sure the Balance Sheet is correct
    await transaction(async (client) => {
      console.log('🔄 Finalizing account balance calculations...');
      await AccountingService.updateAccountBalance(client, '1200');
      await AccountingService.updateAccountBalance(client, '3100');
    });

    console.log('✅ All done. The Balance Sheet and Stock Reports should now be accurate.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
