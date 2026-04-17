const { query } = require('../config/postgres');

async function run() {
  const accountRes = await query(
    `SELECT account_code, account_name, opening_balance, current_balance, normal_balance
     FROM chart_of_accounts
     WHERE account_code = '3100' AND deleted_at IS NULL
     LIMIT 1`
  );

  const ledgerRes = await query(
    `SELECT
       COALESCE(SUM(credit_amount - debit_amount), 0) AS net_credit
     FROM account_ledger
     WHERE account_code = '3100'
       AND status = 'completed'
       AND reversed_at IS NULL`
  );

  const byRefTypeRes = await query(
    `SELECT
       COALESCE(reference_type, '(none)') AS reference_type,
       COUNT(*) AS rows,
       COALESCE(SUM(credit_amount - debit_amount), 0) AS net
     FROM account_ledger
     WHERE account_code = '3100'
       AND status = 'completed'
       AND reversed_at IS NULL
     GROUP BY COALESCE(reference_type, '(none)')
     ORDER BY ABS(COALESCE(SUM(credit_amount - debit_amount), 0)) DESC
     LIMIT 20`
  );

  const recentRes = await query(
    `SELECT transaction_date, reference_type, reference_number, debit_amount, credit_amount, description
     FROM account_ledger
     WHERE account_code = '3100'
       AND status = 'completed'
       AND reversed_at IS NULL
     ORDER BY transaction_date DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 20`
  );

  const account = accountRes.rows[0] || null;
  const opening = parseFloat(account?.opening_balance || 0);
  const current = parseFloat(account?.current_balance || 0);
  const ledgerNet = parseFloat(ledgerRes.rows[0]?.net_credit || 0);
  const calculated = opening + ledgerNet;
  const gap = current - calculated;

  const payload = {
    account,
    openingBalance: opening,
    ledgerNetCreditMinusDebit: ledgerNet,
    calculatedBalanceFromLedger: calculated,
    currentBalanceFromChartOfAccounts: current,
    mismatchGapCurrentMinusCalculated: gap,
    byReferenceType: byRefTypeRes.rows,
    recentEntries: recentRes.rows
  };

  console.log(JSON.stringify(payload, null, 2));
}

run().catch((err) => {
  console.error('diagnoseAccount3100 failed:', err);
  process.exit(1);
});
