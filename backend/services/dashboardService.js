const { query } = require('../config/postgres');
const { parseDateParams } = require('../utils/dateFilter');
const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Aggregated metrics for the main Dashboard date range (replaces N× full list fetches with all=true).
 * Date semantics match existing list APIs: Pakistan day bounds where applicable.
 */
async function getRangeSummary(queryParams = {}) {
  const { startDate, endDate } = parseDateParams(queryParams);
  if (!startDate || !endDate) {
    const err = new Error('dateFrom and dateTo are required');
    err.statusCode = 400;
    throw err;
  }

  const dStart = getStartOfDayPakistan(startDate);
  const dEnd = getEndOfDayPakistan(endDate);

  const [
    pendingSo,
    pendingPo,
    soRange,
    poRange,
    salesInv,
    piRange,
    cr,
    cp,
    br,
    bp,
    cogsRow,
  ] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS c FROM sales_orders WHERE deleted_at IS NULL AND status = 'draft'`,
      []
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM purchases WHERE deleted_at IS NULL AND status = 'draft'`,
      []
    ),
    query(
      `SELECT COUNT(*)::int AS c,
              COALESCE(SUM(total), 0)::float AS sum_total,
              COALESCE(SUM(GREATEST(0, COALESCE(subtotal,0) + COALESCE(tax,0) - COALESCE(total,0))), 0)::float AS sum_discount
       FROM sales_orders
       WHERE deleted_at IS NULL
         AND created_at >= $1 AND created_at <= $2`,
      [dStart, dEnd]
    ),
    query(
      `SELECT COUNT(*)::int AS c,
              COALESCE(SUM(total), 0)::float AS sum_total
       FROM purchases
       WHERE deleted_at IS NULL
         AND purchase_date::date >= $1::date AND purchase_date::date <= $2::date`,
      [startDate, endDate]
    ),
    query(
      `SELECT COUNT(*)::int AS c,
              COALESCE(SUM(total), 0)::float AS sum_total,
              COALESCE(SUM(discount), 0)::float AS sum_discount,
              COALESCE(SUM(COALESCE(amount_paid, 0)), 0)::float AS sum_amount_paid
       FROM sales
       WHERE deleted_at IS NULL
         AND sale_date >= $1 AND sale_date <= $2`,
      [dStart, dEnd]
    ),
    query(
      `SELECT COUNT(*)::int AS c,
              COALESCE(SUM(
                COALESCE(NULLIF(pricing->>'total','')::numeric, NULLIF(pricing->>'grandTotal','')::numeric, 0)
              ), 0)::float AS sum_total
       FROM purchase_invoices pi
       WHERE pi.deleted_at IS NULL
         AND COALESCE(pi.invoice_date, pi.created_at) >= $1
         AND COALESCE(pi.invoice_date, pi.created_at) <= $2`,
      [dStart, dEnd]
    ),
    query(
      `SELECT COUNT(*)::int AS c, COALESCE(SUM(amount), 0)::float AS sum_amount
       FROM cash_receipts WHERE deleted_at IS NULL AND date >= $1 AND date <= $2`,
      [dStart, dEnd]
    ),
    query(
      `SELECT COUNT(*)::int AS c,
              COALESCE(SUM(amount), 0)::float AS sum_amount,
              COALESCE(SUM(CASE WHEN supplier_id IS NULL AND customer_id IS NULL THEN amount ELSE 0 END), 0)::float AS sum_operating
       FROM cash_payments WHERE deleted_at IS NULL AND date >= $1 AND date <= $2`,
      [dStart, dEnd]
    ),
    query(
      `SELECT COUNT(*)::int AS c, COALESCE(SUM(amount), 0)::float AS sum_amount
       FROM bank_receipts WHERE deleted_at IS NULL AND date >= $1 AND date <= $2`,
      [dStart, dEnd]
    ),
    query(
      `SELECT COUNT(*)::int AS c,
              COALESCE(SUM(amount), 0)::float AS sum_amount,
              COALESCE(SUM(CASE WHEN supplier_id IS NULL AND customer_id IS NULL THEN amount ELSE 0 END), 0)::float AS sum_operating
       FROM bank_payments WHERE deleted_at IS NULL AND date >= $1 AND date <= $2`,
      [dStart, dEnd]
    ),
    query(
      `SELECT COALESCE(SUM(per_sale.cogs), 0)::float AS cogs
       FROM (
         SELECT (
           SELECT COALESCE(SUM(
             COALESCE(NULLIF(elem->>'quantity','')::numeric, NULLIF(elem->>'qty','')::numeric, 0) *
             COALESCE(
               NULLIF(elem->>'unitCost','')::numeric,
               NULLIF(elem->>'cost_price','')::numeric,
               NULLIF(elem->>'costPrice','')::numeric,
               0
             )
           ), 0)
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.items) = 'array' THEN s.items ELSE '[]'::jsonb END) AS elem
         ) AS cogs
         FROM sales s
         WHERE s.deleted_at IS NULL AND s.sale_date >= $1 AND s.sale_date <= $2
       ) per_sale`,
      [dStart, dEnd]
    ),
  ]);

  return {
    dateFrom: startDate,
    dateTo: endDate,
    pendingSalesOrdersCount: pendingSo.rows[0]?.c ?? 0,
    pendingPurchaseOrdersCount: pendingPo.rows[0]?.c ?? 0,
    salesOrdersInRange: {
      count: soRange.rows[0]?.c ?? 0,
      sumTotal: num(soRange.rows[0]?.sum_total),
      sumDiscount: num(soRange.rows[0]?.sum_discount),
    },
    purchaseOrdersInRange: {
      count: poRange.rows[0]?.c ?? 0,
      sumTotal: num(poRange.rows[0]?.sum_total),
    },
    salesInvoicesInRange: {
      count: salesInv.rows[0]?.c ?? 0,
      sumTotal: num(salesInv.rows[0]?.sum_total),
      sumDiscount: num(salesInv.rows[0]?.sum_discount),
      sumAmountPaid: num(salesInv.rows[0]?.sum_amount_paid),
      sumCogs: num(cogsRow.rows[0]?.cogs),
    },
    purchaseInvoicesInRange: {
      count: piRange.rows[0]?.c ?? 0,
      sumTotal: num(piRange.rows[0]?.sum_total),
    },
    cashReceipts: { count: cr.rows[0]?.c ?? 0, sumAmount: num(cr.rows[0]?.sum_amount) },
    cashPayments: {
      count: cp.rows[0]?.c ?? 0,
      sumAmount: num(cp.rows[0]?.sum_amount),
      sumOperating: num(cp.rows[0]?.sum_operating),
    },
    bankReceipts: { count: br.rows[0]?.c ?? 0, sumAmount: num(br.rows[0]?.sum_amount) },
    bankPayments: {
      count: bp.rows[0]?.c ?? 0,
      sumAmount: num(bp.rows[0]?.sum_amount),
      sumOperating: num(bp.rows[0]?.sum_operating),
    },
  };
}

module.exports = {
  getRangeSummary,
};
