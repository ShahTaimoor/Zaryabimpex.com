/**
 * Backfill FIFO inventory batches from historical purchase stock movements.
 * Skips transfer_in (internal moves) and rows that already have a matching batch.
 *
 * Usage:
 *   node scripts/backfillFifoBatchesFromMovements.js --dry-run
 *   node scripts/backfillFifoBatchesFromMovements.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { connectDB, query, transaction } = require('../config/postgres');
const fifoService = require('../services/fifoService');

function mapReferenceType(movementType, referenceType) {
  const ref = String(referenceType || '').toLowerCase();
  if (ref.includes('purchase')) return 'purchase_invoice';
  if (movementType === 'adjustment_in') return 'adjustment';
  return referenceType || 'purchase_invoice';
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDB();

  const movements = await query(
    `SELECT sm.*
     FROM stock_movements sm
     WHERE sm.movement_type IN ('purchase', 'purchase_in', 'adjustment_in')
       AND sm.quantity > 0
       AND (sm.status = 'completed' OR sm.status IS NULL)
     ORDER BY sm.created_at ASC`
  );

  console.log(`Found ${movements.rows.length} inbound purchase movements to evaluate`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of movements.rows) {
    const sourceType = mapReferenceType(row.movement_type, row.reference_type);
    const sourceId = row.reference_id;

    const existing = await query(
      `SELECT id FROM inventory_batches
       WHERE product_id = $1
         AND source_type = $2
         AND source_id IS NOT DISTINCT FROM $3::uuid
         AND ABS(unit_cost - $4::numeric) < 0.0001
         AND ABS(quantity_received - $5::numeric) < 0.0001
       LIMIT 1`,
      [row.product_id, sourceType, sourceId, row.unit_cost, row.quantity]
    );
    if (existing.rows.length > 0) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(
        '[dry-run] batch',
        row.product_id,
        'qty',
        row.quantity,
        'cost',
        row.unit_cost,
        'ref',
        sourceType,
        sourceId
      );
      created += 1;
      continue;
    }

    try {
      await transaction(async (client) => {
        await fifoService.receiveStock(
          {
            productId: row.product_id,
            quantity: row.quantity,
            unitCost: row.unit_cost,
            purchaseDate: row.created_at,
            purchaseId: sourceId,
            supplierId: row.supplier_id,
            warehouseId: row.warehouse_id,
            referenceModel: sourceType,
            referenceId: sourceId,
            referenceNumber: row.reference_number,
            userId: row.user_id,
            notes: 'Backfilled from stock_movements',
            movementType: 'purchase_in',
          },
          client
        );
      });
      created += 1;
    } catch (err) {
      errors += 1;
      console.error('Failed row', row.id, err.message);
    }
  }

  console.log(
    `Done. Created: ${created}, skipped: ${skipped}, errors: ${errors}${dryRun ? ' (dry-run)' : ''}`
  );
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
