-- Add logo URL column to settings (company) for Postgres-only company route
ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo TEXT;
