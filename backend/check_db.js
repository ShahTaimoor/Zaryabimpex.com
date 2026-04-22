const { query } = require('./config/postgres');
require('dotenv').config();

async function check() {
  try {
    const res = await query("SELECT count(*) FROM bank_receipts");
    console.log('Bank Receipts count:', res.rows[0].count);
    
    const res2 = await query("SELECT count(*) FROM bank_payments");
    console.log('Bank Payments count:', res2.rows[0].count);

    const res3 = await query("SELECT reference_type, count(*) FROM account_ledger GROUP BY reference_type");
    console.table(res3.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

check();
