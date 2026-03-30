-- Payouts recorded before `investor_payouts` existed only updated investors.total_paid_out.
-- Create one history row per investor so "Payout history" and "Last paid" can show something.
-- paid_at is approximate: last update time on the investor row (or created_at).
INSERT INTO investor_payouts (investor_id, amount, paid_at, created_by)
SELECT i.id,
       i.total_paid_out::decimal(15,2),
       COALESCE(i.updated_at, i.created_at, CURRENT_TIMESTAMP),
       NULL
FROM investors i
WHERE i.deleted_at IS NULL
  AND COALESCE(i.total_paid_out, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM investor_payouts p WHERE p.investor_id = i.id
  );
