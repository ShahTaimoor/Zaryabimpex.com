/**
 * Sync FIFO opening-balance batches from current physical stock minus existing batch layers.
 *
 * Usage:
 *   node scripts/syncFifoOpeningBatches.js --dry-run
 *   node scripts/syncFifoOpeningBatches.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { connectDB, query, transaction } = require('../config/postgres');
const fifoService = require('../services/fifoService');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDB();

  const rows = await query(`
    WITH stock AS (
      SELECT p.id AS product_id, p.name, p.sku,
        GREATEST(COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0), 0)::numeric AS physical_qty,
        COALESCE(b.batch_qty, 0)::numeric AS batch_qty
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id AND i.deleted_at IS NULL
      LEFT JOIN (
        SELECT product_id, SUM(quantity) AS quantity
        FROM inventory_balance
        GROUP BY product_id
      ) ib ON ib.product_id = p.id
      LEFT JOIN (
        SELECT product_id, SUM(quantity_remaining) AS batch_qty
        FROM inventory_batches
        WHERE status = 'active' AND quantity_remaining > 0
        GROUP BY product_id
      ) b ON b.product_id = p.id
      WHERE (p.is_deleted = FALSE OR p.is_deleted IS NULL)
        AND (p.is_active = TRUE OR p.is_active IS NULL)
    )
    SELECT product_id, name, sku, physical_qty, batch_qty,
      (physical_qty - batch_qty) AS gap
    FROM stock
    WHERE physical_qty > batch_qty
    ORDER BY gap DESC
  `);

  console.log(`Found ${rows.rows.length} product(s) needing FIFO opening-balance sync`);

  let synced = 0;
  let errors = 0;

  for (const row of rows.rows) {
    const gap = Number(row.gap);
    if (gap <= 0) continue;

    if (dryRun) {
      console.log(
        `[dry-run] ${row.name || row.sku || row.product_id}: physical=${row.physical_qty}, batches=${row.batch_qty}, sync=${gap}`
      );
      synced += 1;
      continue;
    }

    try {
      await transaction(async (client) => {
        const result = await fifoService.ensureFifoCoverage(row.product_id, client);
        console.log(
          `Synced ${row.name || row.product_id}: +${result.synced} units (physical ${result.physicalQty})`
        );
      });
      synced += 1;
    } catch (err) {
      errors += 1;
      console.error(`Failed ${row.product_id}:`, err.message);
    }
  }

  console.log(`Done. Synced: ${synced}, errors: ${errors}${dryRun ? ' (dry-run)' : ''}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
