-- Add order_settings JSONB for item-wise confirmation toggles
ALTER TABLE settings ADD COLUMN IF NOT EXISTS order_settings JSONB DEFAULT '{}';
