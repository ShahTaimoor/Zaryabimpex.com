#!/usr/bin/env node
/**
 * Fix previous Sale Return ledger entries: set transaction_date to return_date
 * so P&L date filtering includes sale and return in the same period.
 *
 * Run from backend folder: node scripts/fixSaleReturnLedgerDates.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { query } = require('../config/postgres');

async function fixSaleReturnLedgerDates() {
  console.log('Fixing Sale Return ledger entries: aligning transaction_date to return_date...\n');

  // Update account_ledger entries for Sale Returns to use return_date
  // so P&L date filtering includes sale + return in same period (fixes negative COGS / inflated profit)
  const result = await query(
    `UPDATE account_ledger al
     SET transaction_date = r.return_date,
         updated_at = CURRENT_TIMESTAMP
     FROM returns r
     WHERE al.reference_type = 'Sale Return'
       AND al.reference_id::text = r.id::text
       AND r.return_type = 'sale_return'
       AND r.deleted_at IS NULL
       AND al.reversed_at IS NULL
       AND (al.transaction_date IS DISTINCT FROM r.return_date
            OR al.transaction_date IS NULL)
     RETURNING al.id`
  );

  const updated = result?.rowCount ?? result?.rows?.length ?? 0;
  console.log(`Updated ${updated} ledger entry/entries.\n`);

  if (updated > 0) {
    console.log('Done. P&L reports should now show correct gross profit for periods with returns.');
  } else {
    console.log('No entries needed updating (either none exist or dates already match).');
  }
}

fixSaleReturnLedgerDates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
