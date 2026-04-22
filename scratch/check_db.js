const { query } = require('./backend/config/postgres');

async function check() {
  try {
    const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'journal_voucher_entries' AND column_name = 'bank_id'");
    console.log('Bank ID in JV entries:', res.rows.length > 0 ? 'YES' : 'NO');
    
    const res2 = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'account_ledger' AND column_name = 'bank_id'");
    console.log('Bank ID in Ledger:', res2.rows.length > 0 ? 'YES' : 'NO');

    const res3 = await query("SELECT reference_type, bank_id, count(*) FROM account_ledger WHERE account_code = '1001' GROUP BY reference_type, bank_id");
    console.table(res3.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

check();
