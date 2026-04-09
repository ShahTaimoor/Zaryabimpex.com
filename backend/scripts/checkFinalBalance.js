const { query } = require('../config/postgres');

async function check() {
  const sql = `
    WITH phys AS (
      SELECT 
        p.id,
        (COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) * COALESCE(p.cost_price, 0)) as val
      FROM products p
      LEFT JOIN inventory_balance ib ON ib.product_id = p.id
      LEFT JOIN inventory i ON i.product_id = p.id AND i.deleted_at IS NULL
      WHERE p.is_deleted = FALSE AND p.is_active = TRUE
    ),
    ledg AS (
      SELECT 
        SUM(debit_amount - credit_amount) as total
      FROM account_ledger 
      WHERE account_code = '1200' AND status = 'completed' AND reversed_at IS NULL
    )
    SELECT (SELECT SUM(val) FROM phys) as phys_total, (SELECT total FROM ledg) as ledg_total;
  `;
  const result = await query(sql);
  const row = result.rows[0];
  console.log(JSON.stringify(row, null, 2));
  
  const diff = parseFloat(row.phys_total) - parseFloat(row.ledg_total);
  console.log(`Difference: ${diff}`);
}

check();
