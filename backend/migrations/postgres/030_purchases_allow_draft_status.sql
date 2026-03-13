-- Allow 'draft' status in purchases table for purchase orders
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('draft', 'pending', 'confirmed', 'received', 'completed', 'cancelled'));
