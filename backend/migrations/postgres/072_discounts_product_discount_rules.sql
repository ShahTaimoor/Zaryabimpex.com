-- Per-product discount rules: [{ "productId": "<uuid>", "type": "percentage"|"fixed_amount" (optional), "value": <number> }]
-- When empty, product-targeted discounts use the row-level type/value on eligible line subtotals (see discountService).
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS product_discount_rules JSONB NOT NULL DEFAULT '[]'::jsonb;
