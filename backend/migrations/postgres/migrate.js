const path = require('path');
const fs = require('fs');
// Load .env: try backend/.env first (where your .env lives), then project root
const backendEnv = path.join(__dirname, '../../.env');
const rootEnv = path.resolve(process.cwd(), '.env');
if (fs.existsSync(backendEnv)) {
  require('dotenv').config({ path: backendEnv });
} else {
  require('dotenv').config({ path: rootEnv });
}

// Fail fast with a clear message if Postgres password is missing (avoids SCRAM "must be a string" error)
const pw = process.env.POSTGRES_PASSWORD;
if (pw === undefined || pw === null || typeof pw !== 'string') {
  console.error('❌ POSTGRES_PASSWORD is not set or not a string. Set it in backend/.env (e.g. POSTGRES_PASSWORD=yourpassword).');
  process.exit(1);
}

const { query, connectDB } = require('../../config/postgres');

const MIGRATIONS = [
  '001_create_schema.sql',
  '002_insert_default_accounts.sql',
  '003_add_users_categories.sql',
  '004_users_auth_fields.sql',
  '005_returns_reference_id_varchar.sql',
  '006_mongo_repos_tables.sql',
  '007_settings_logo.sql',
  '008_customer_transactions.sql',
  '009_payment_applications.sql',
  '010_customer_transactions_reversal.sql',
  '011_sales_applied_discounts.sql',
  '012_customers_credit_policy.sql',
  '013_returns_inspection_refund.sql',
  '014_audit_logs.sql',
  '015_disputes_counters.sql',
  '016_batches.sql',
  '017_optional_audit_tables.sql',
  '018_account_ledger_reference_id_not_null.sql',
  '019_add_supplier_to_receipts.sql',
  '020_add_business_name_to_suppliers.sql',
  '021_stock_movement_return_quarantine_inventory_balance.sql',
  '022_returns_status_workflow.sql',
  '023_add_wholesale_price_to_products.sql',
  '024_add_business_type_customer_tier_to_customers.sql',
  '025_sales_amount_paid.sql',
  '026_add_bank_account.sql',
  '027_sales_order_type.sql',
  '028_suppliers_type_rating.sql',
  '029_backfill_supplier_opening_balance_to_ledger.sql',
  '030_purchases_allow_draft_status.sql',
  '031_customer_balances_ar_only.sql',
  '032_add_purchase_returns_account.sql',
  '033_chart_of_accounts_metadata.sql',
  '034_reverse_ledger_for_deleted_receipts_payments.sql',
  '035_reverse_ledger_for_deleted_purchase_invoices.sql',
  '036_allow_duplicate_products_sku.sql',
  '037_item_wise_confirmation.sql',
  '038_order_settings.sql',
  '039_products_pieces_per_box.sql',
  '040_add_image_to_products.sql'
];

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getCompletedMigrations() {
  const result = await query('SELECT name FROM schema_migrations');
  return new Set(result.rows.map((r) => r.name));
}

// PostgreSQL codes for "object already exists" – treat as already applied
const ALREADY_EXISTS_CODES = new Set(['42710', '42P07', '42P16']);

async function runMigration(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skipping ${fileName} (file not found)`);
    return;
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`Running migration: ${fileName}...`);
  try {
    await query(sql);
    await query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [fileName]);
    console.log(`✅ ${fileName} completed`);
  } catch (error) {
    if (ALREADY_EXISTS_CODES.has(error.code)) {
      console.log(`⏭️  ${fileName} already applied (objects exist), marking as done`);
      await query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [fileName]);
      return;
    }
    console.error(`❌ ${fileName} failed:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await connectDB();
    console.log('✅ Connected to PostgreSQL\n');

    await ensureMigrationsTable();
    const completed = await getCompletedMigrations();

    for (const fileName of MIGRATIONS) {
      if (completed.has(fileName)) {
        console.log(`⏭️  Skipping ${fileName} (already applied)`);
        continue;
      }
      await runMigration(fileName);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Migrations finished.');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runMigration };
