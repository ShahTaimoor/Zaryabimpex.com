-- Add confirmation_status to sales_orders and purchase_orders (and purchases for PO UI)
-- Supports: pending (none confirmed), partially_completed (some confirmed), completed (all confirmed)
-- Each item in items JSONB will have confirmationStatus: 'pending' | 'confirmed' | 'cancelled'

-- Sales Orders
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS confirmation_status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_confirmation_status_check;
ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_confirmation_status_check
  CHECK (confirmation_status IN ('pending', 'partially_completed', 'completed'));
UPDATE sales_orders SET confirmation_status = 'pending' WHERE confirmation_status IS NULL;

-- Purchase Orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS confirmation_status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_confirmation_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_confirmation_status_check
  CHECK (confirmation_status IN ('pending', 'partially_completed', 'completed'));
UPDATE purchase_orders SET confirmation_status = 'pending' WHERE confirmation_status IS NULL;

-- Purchases (used by Purchase Orders UI)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS confirmation_status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_confirmation_status_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_confirmation_status_check
  CHECK (confirmation_status IN ('pending', 'partially_completed', 'completed'));
UPDATE purchases SET confirmation_status = 'pending' WHERE confirmation_status IS NULL;
