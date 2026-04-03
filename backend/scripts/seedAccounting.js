#!/usr/bin/env node
/**
 * Seeds balanced opening ledger entries so cash, bank, AR, inventory, AP, and equity
 * flow into the balance sheet (same accounts as balanceSheetCalculationService).
 *
 * Uses double-entry: each line posts Dr asset (or Dr equity for AP offset) vs Cr equity / Cr liability.
 *
 * Inventory (SEED_OPENING_INVENTORY): Dr 1200 Inventory, Cr 3100 Retained Earnings — same pattern as
 * product registration opening stock (`AccountingService.postProductOpeningStock`, reference_type
 * `product_opening_stock`). Cash/bank/AR seed lines still credit 3000 Owner Equity.
 *
 * Optional env (defaults are demo amounts in PKR):
 *   SEED_OPENING_CASH=50000
 *   SEED_OPENING_BANK=100000
 *   SEED_OPENING_AR=25000
 *   SEED_OPENING_INVENTORY=200000
 *   SEED_OPENING_AP=80000
 *   SEED_OPENING_DATE=2024-01-01
 *   SEED_FORCE=1  — remove prior seed_opening_balance rows and re-post
 *
 * Run: npm run seed:accounting
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { transaction, query } = require('../config/postgres');
const AccountingService = require('../services/accountingService');

const REF_TYPE = 'seed_opening_balance';
const REF_NUMBER = 'SEED-OPENING-v1';
/** Stable UUID so the same logical batch can be identified */
const BATCH_REF_ID = 'a0000001-0000-4000-8000-000000000001';

function num(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = parseFloat(v, 10);
  return Number.isFinite(n) ? n : def;
}

async function hasExistingSeed() {
  const r = await query(
    `SELECT 1 FROM account_ledger WHERE reference_type = $1 LIMIT 1`,
    [REF_TYPE]
  );
  return (r.rows || []).length > 0;
}

async function refreshBalancesAfterDelete(client, codes) {
  const unique = [...new Set(codes)];
  for (const code of unique) {
    await AccountingService.updateAccountBalance(client, code);
  }
}

/** Accounts to refresh after deleting/re-posting seed rows (includes 3100 for inventory seed + product opening stock) */
const BS_ACCOUNTS = ['1000', '1001', '1100', '1200', '2000', '3000', '3100'];

async function main() {
  const cash = num('SEED_OPENING_CASH', 50000);
  const bank = num('SEED_OPENING_BANK', 100000);
  const ar = num('SEED_OPENING_AR', 25000);
  const inventory = num('SEED_OPENING_INVENTORY', 200000);
  const ap = num('SEED_OPENING_AP', 80000);

  const dateStr = process.env.SEED_OPENING_DATE || '2024-01-01';
  const txnDate = new Date(`${dateStr}T12:00:00.000Z`);

  const force = process.env.SEED_FORCE === '1' || process.env.SEED_FORCE === 'true';

  if (!force && (await hasExistingSeed())) {
    console.log('Seed opening balances already exist (account_ledger.reference_type = seed_opening_balance).');
    console.log('Set SEED_FORCE=1 to remove them and re-seed.');
    process.exit(0);
    return;
  }

  if (cash + bank + ar + inventory === 0 && ap === 0) {
    console.log('All amounts are zero; nothing to seed. Set SEED_OPENING_* env vars or use defaults.');
    process.exit(0);
    return;
  }

  await transaction(async (client) => {
    if (force) {
      const del = await client.query(
        `DELETE FROM account_ledger WHERE reference_type = $1 RETURNING account_code`,
        [REF_TYPE]
      );
      const affected = new Set(
        (del.rows || []).map((row) => row.account_code).filter(Boolean)
      );
      BS_ACCOUNTS.forEach((code) => affected.add(code));
      await refreshBalancesAfterDelete(client, [...affected]);
      console.log('Removed previous seed_opening_balance ledger rows and refreshed balances.');
    }

    const baseMeta = {
      referenceType: REF_TYPE,
      referenceId: BATCH_REF_ID,
      referenceNumber: REF_NUMBER,
      transactionDate: txnDate,
      status: 'completed',
      currency: 'PKR',
    };

    const pairs = [];

    if (cash > 0) {
      pairs.push([
        { accountCode: '1000', debitAmount: cash, creditAmount: 0, description: 'Seed opening: cash' },
        { accountCode: '3000', debitAmount: 0, creditAmount: cash, description: 'Seed opening: owner equity (cash)' },
      ]);
    }
    if (bank > 0) {
      pairs.push([
        { accountCode: '1001', debitAmount: bank, creditAmount: 0, description: 'Seed opening: bank' },
        { accountCode: '3000', debitAmount: 0, creditAmount: bank, description: 'Seed opening: owner equity (bank)' },
      ]);
    }
    if (ar > 0) {
      pairs.push([
        { accountCode: '1100', debitAmount: ar, creditAmount: 0, description: 'Seed opening: accounts receivable' },
        { accountCode: '3000', debitAmount: 0, creditAmount: ar, description: 'Seed opening: owner equity (AR)' },
      ]);
    }
    if (inventory > 0) {
      pairs.push([
        { accountCode: '1200', debitAmount: inventory, creditAmount: 0, description: 'Seed opening: inventory' },
        { accountCode: '3100', debitAmount: 0, creditAmount: inventory, description: 'Seed opening: retained earnings (inventory)' },
      ]);
    }
    if (ap > 0) {
      pairs.push([
        { accountCode: '3000', debitAmount: ap, creditAmount: 0, description: 'Seed opening: equity offset for AP' },
        { accountCode: '2000', debitAmount: 0, creditAmount: ap, description: 'Seed opening: accounts payable' },
      ]);
    }

    for (const [e1, e2] of pairs) {
      await AccountingService.createTransaction(e1, e2, { ...baseMeta, referenceId: uuidv4() }, client);
    }

    console.log('✅ Posted seed opening balances:');
    console.log(`   Cash ${cash}, Bank ${bank}, AR ${ar}, Inventory ${inventory} (Cr 3100), AP ${ap}`);
    console.log(`   Transaction date: ${txnDate.toISOString().slice(0, 10)}`);
    console.log('   Balance sheet accounts: 1000, 1001, 1100, 1200, 2000, 3000, 3100');
    console.log('   Note: New products with opening stock post Dr 1200 / Cr 3100 as product_opening_stock (not this script).');
  });

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ seed:accounting failed:', err.message);
  process.exit(1);
});
