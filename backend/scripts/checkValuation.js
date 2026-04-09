const { query } = require('../config/postgres');

async function check() {
  const sql = `
    SELECT 
      SUM(COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) * COALESCE(p.cost_price, 0)) as "totalStockValue"
    FROM products p
    LEFT JOIN inventory_balance ib ON ib.product_id = p.id
    LEFT JOIN inventory i ON i.product_id = p.id AND i.deleted_at IS NULL
    WHERE p.is_deleted = FALSE AND p.is_active = TRUE
  `;
  const result = await query(sql);
  console.log(JSON.stringify(result.rows[0], null, 2));
}

check();
