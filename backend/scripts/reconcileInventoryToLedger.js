const { query, transaction } = require('../config/postgres');
const AccountingService = require('../services/accountingService');

async function reconcile() {
  console.log('🚀 Starting Full Inventory-to-Ledger Reconciliation...');

  try {
    // 1. Find all active products and calculate physical vs ledger values
    const sql = `
      WITH ib_agg AS (
        SELECT product_id, SUM(COALESCE(quantity, 0))::numeric AS quantity
        FROM inventory_balance
        GROUP BY product_id
      ),
      inv_agg AS (
        SELECT product_id, SUM(COALESCE(current_stock, 0))::numeric AS current_stock
        FROM inventory
        WHERE deleted_at IS NULL
        GROUP BY product_id
      ),
      ledger_agg AS (
        SELECT reference_id::text AS product_id,
               SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0))::numeric AS ledger_value
        FROM account_ledger
        WHERE account_code = '1200'
          AND status = 'completed'
          AND reversed_at IS NULL
        GROUP BY reference_id::text
      )
      SELECT
        p.id,
        p.name,
        p.cost_price,
        COALESCE(ib.quantity, inv.current_stock, p.stock_quantity, 0) AS stock_quantity,
        (COALESCE(ib.quantity, inv.current_stock, p.stock_quantity, 0) * COALESCE(p.cost_price, 0)) AS physical_value,
        COALESCE(l.ledger_value, 0) AS ledger_value
      FROM products p
      LEFT JOIN ib_agg ib ON ib.product_id = p.id
      LEFT JOIN inv_agg inv ON inv.product_id = p.id
      LEFT JOIN ledger_agg l ON l.product_id = p.id::text
      WHERE p.is_active = TRUE AND p.is_deleted = FALSE
    `;

    const result = await query(sql);
    const products = result.rows;

    const mismatches = products.filter(p => {
      const phys = parseFloat(p.physical_value || 0);
      const ledg = parseFloat(p.ledger_value || 0);
      return Math.abs(phys - ledg) > 0.01;
    });

    const userResult = await query("SELECT id FROM users WHERE is_active = TRUE ORDER BY created_at LIMIT 1");
    const systemUserId = userResult.rows[0]?.id;

    let adjustedCount = 0;
    let totalAdjustmentVal = 0;

    if (mismatches.length > 0) {
      console.log(`🔍 Found ${mismatches.length} products with valuation discrepancies.`);

      for (const p of mismatches) {
        const phys = parseFloat(p.physical_value || 0);
        const ledg = parseFloat(p.ledger_value || 0);
        const diff = phys - ledg;

        console.log(`   ⚖️ Reconciling ${p.name}: Phys=${phys.toFixed(2)}, Ledg=${ledg.toFixed(2)}, Diff=${diff.toFixed(2)}`);

        await transaction(async (client) => {
          // We create a one-time adjustment transaction to align the ledger with physical reality
          const amount = Math.abs(Math.round(diff * 100) / 100);
          const refId = String(p.id);
          const refNum = `RECON-${Date.now()}-${refId.slice(0, 4)}`;

          if (diff > 0) {
            // Physical is higher than Ledger -> Increase Ledger (Dr 1200, Cr 3100)
            await AccountingService.createTransaction(
              { accountCode: '1200', debitAmount: amount, description: `Reconciliation Adjustment (Increase to match physical value of ${p.stock_quantity} units)` },
              { accountCode: '3100', creditAmount: amount, description: 'Inventory Reconciliation Offset' },
              {
                referenceType: 'inventory_reconciliation',
                referenceId: refId,
                referenceNumber: refNum,
                transactionDate: new Date(),
                currency: 'PKR',
                createdBy: systemUserId
              },
              client
            );
          } else {
            // Ledger is higher than Physical -> Decrease Ledger (Dr 3100, Cr 1200)
            await AccountingService.createTransaction(
              { accountCode: '3100', debitAmount: amount, description: 'Inventory Reconciliation Offset' },
              { accountCode: '1200', creditAmount: amount, description: `Reconciliation Adjustment (Decrease to match physical value of ${p.stock_quantity} units)` },
              {
                referenceType: 'inventory_reconciliation',
                referenceId: refId,
                referenceNumber: refNum,
                transactionDate: new Date(),
                currency: 'PKR',
                createdBy: systemUserId
              },
              client
            );
          }
          
          // Update account balances
          await AccountingService.updateAccountBalance(client, '1200');
          await AccountingService.updateAccountBalance(client, '3100');
        });

        adjustedCount++;
        totalAdjustmentVal += Math.abs(diff);
      }
    } else {
      console.log('✅ Active products are in sync.');
    }

    // 2. Identify and handle orphaned ledger entries (products that were hard-deleted)
    const orphanSql = `
      SELECT reference_id, SUM(debit_amount - credit_amount) as amount
      FROM account_ledger 
      WHERE account_code = '1200' 
        AND status = 'completed' 
        AND reversed_at IS NULL 
        AND reference_id::text NOT IN (SELECT id::text FROM products)
      GROUP BY reference_id
    `;
    const orphanResult = await query(orphanSql);
    const orphans = orphanResult.rows;

    if (orphans.length > 0) {
      console.log(`🔍 Found ${orphans.length} orphaned ledger entries (hard-deleted products).`);
      for (const orphan of orphans) {
        const amount = parseFloat(orphan.amount);
        if (Math.abs(amount) < 0.01) continue;

        console.log(`   ⚖️ Reconciling Orphan [${orphan.reference_id}]: Amount=${amount.toFixed(2)} -> Writing off`);

        await transaction(async (client) => {
          // Opposite of current amount to zero it out
          const adjAmount = Math.abs(Math.round(amount * 100) / 100);
          const refNum = `RECON-ORPHAN-${Date.now()}`;

          if (amount > 0) {
            // positive balance -> decrease (Dr 3100, Cr 1200)
            await AccountingService.createTransaction(
              { accountCode: '3100', debitAmount: adjAmount, description: 'Inventory Reconciliation Offset (Orphan)' },
              { accountCode: '1200', creditAmount: adjAmount, description: 'Reconciliation Adjustment (Orphan cleanup)' },
              {
                referenceType: 'inventory_reconciliation',
                referenceId: orphan.reference_id,
                referenceNumber: refNum,
                transactionDate: new Date(),
                currency: 'PKR',
                createdBy: systemUserId
              },
              client
            );
          } else {
            // negative balance -> increase (Dr 1200, Cr 3100)
            await AccountingService.createTransaction(
              { accountCode: '1200', debitAmount: adjAmount, description: 'Reconciliation Adjustment (Orphan cleanup)' },
              { accountCode: '3100', creditAmount: adjAmount, description: 'Inventory Reconciliation Offset (Orphan)' },
              {
                referenceType: 'inventory_reconciliation',
                referenceId: orphan.reference_id,
                referenceNumber: refNum,
                transactionDate: new Date(),
                currency: 'PKR',
                createdBy: systemUserId
              },
              client
            );
          }
          await AccountingService.updateAccountBalance(client, '1200');
          await AccountingService.updateAccountBalance(client, '3100');
        });
        adjustedCount++;
      }
    }

    console.log(`\n✅ Finished! Adjusted ${adjustedCount} items.`);
    console.log('🚀 Balance Sheet and Inventory Reports are now perfectly synchronized.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Reconciliation failed:', err);
    process.exit(1);
  }
}

reconcile();
